import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";
import {
  assumirPorTelefone,
  devolverPorTelefone,
  operadorInfoFromWhatsapp,
} from "@/lib/crm/atendimento-handoff";
import type { OperadorWhatsapp } from "@/lib/whatsapp/operador-allowlist";
import {
  cancelarJobsIaPendentesGlobal,
  definirPausaGlobalAgente,
  lerPausaGlobalAgente,
  maybeAlertarPausaGlobalProlongada,
} from "@/lib/whatsapp/ia-global-pause";
import { defaultTenantId } from "@/lib/tenant-default";

export type ComandoOperador =
  | { tipo: "global_off" }
  | { tipo: "global_on" }
  | { tipo: "pausa_lead"; telefoneLead: string }
  | { tipo: "retoma_lead"; telefoneLead: string }
  | { tipo: "status" }
  | { tipo: "ajuda" };

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateLimitPorTelefone = new Map<string, number[]>();

function normalizarTextoComando(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^\/+/, "");
}

function extrairTelefoneLead(partes: string[]): string | null {
  for (let i = 1; i < partes.length; i++) {
    const tel = telefoneConversaId(partes[i] ?? "");
    if (tel.length >= 10) return tel;
  }
  return null;
}

/** Parse de comandos operador → linha comercial. */
export function parseComandoOperador(texto: string): ComandoOperador | null {
  const norm = normalizarTextoComando(texto);
  if (!norm) return null;

  if (norm === "ia-off" || norm === "ia off" || norm === "ia pausar" || norm === "ia pausar geral") {
    return { tipo: "global_off" };
  }
  if (norm === "ia-on" || norm === "ia on" || norm === "ia ativar" || norm === "ia retomar geral") {
    return { tipo: "global_on" };
  }
  if (norm === "ia status" || norm === "status") {
    return { tipo: "status" };
  }
  if (norm === "ia ajuda" || norm === "ajuda" || norm === "help") {
    return { tipo: "ajuda" };
  }

  const partes = norm.split(" ");
  if (partes[0] === "ia" && partes[1] === "pausa") {
    const tel = extrairTelefoneLead(partes);
    if (tel) return { tipo: "pausa_lead", telefoneLead: tel };
  }
  if (partes[0] === "ia" && (partes[1] === "retoma" || partes[1] === "on")) {
    const tel = extrairTelefoneLead(partes);
    if (tel) return { tipo: "retoma_lead", telefoneLead: tel };
  }

  // Aliases legados do plano
  if (partes[0] === "assumir") {
    const tel = extrairTelefoneLead(partes);
    if (tel) return { tipo: "pausa_lead", telefoneLead: tel };
  }
  if (partes[0] === "devolver") {
    const tel = extrairTelefoneLead(partes);
    if (tel) return { tipo: "retoma_lead", telefoneLead: tel };
  }

  return null;
}

export function textoAjudaComandos(): string {
  return [
    "*Comandos IA Obra10+*",
    "",
    "/ia-off — pausa IA em *toda* a linha",
    "/ia-on — reativa IA na linha",
    "/ia pausa 5511999887766 — pausa só nesse lead",
    "/ia retoma 5511999887766 — IA volta só nesse lead",
    "/ia status — situação atual",
    "",
    "Envie sempre neste chat (operador → número comercial), nunca no chat do cliente.",
  ].join("\n");
}

function rateLimitOk(telefoneOperador: string): boolean {
  const tel = telefoneConversaId(telefoneOperador);
  const now = Date.now();
  const prev = rateLimitPorTelefone.get(tel) ?? [];
  const fresh = prev.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX) {
    rateLimitPorTelefone.set(tel, fresh);
    return false;
  }
  fresh.push(now);
  rateLimitPorTelefone.set(tel, fresh);
  return true;
}

function mascararTel(tel: string): string {
  if (tel.length <= 4) return "****";
  return `${tel.slice(0, 4)}…${tel.slice(-4)}`;
}

export type ExecutarComandoCtx = {
  supabase: SupabaseClient;
  telefoneOperador: string;
  operador: OperadorWhatsapp;
  agenteSlug: string;
  texto: string;
};

export async function executarComandoOperador(
  ctx: ExecutarComandoCtx
): Promise<{ ok: boolean; respostaOperador: string; comando?: string }> {
  if (!rateLimitOk(ctx.telefoneOperador)) {
    return { ok: false, respostaOperador: "Muitos comandos em sequência. Aguarde um minuto." };
  }

  const parsed = parseComandoOperador(ctx.texto);
  if (!parsed) {
    return {
      ok: false,
      respostaOperador: "Comando não reconhecido. Envie /ia ajuda para ver a lista.",
    };
  }

  const operador = operadorInfoFromWhatsapp(ctx.operador);

  try {
    await ctx.supabase.from("hub_atividades").insert({
      tipo: "ia_acao",
      descricao: `Comando WhatsApp: ${parsed.tipo}`,
      feito_por: operador.slug,
      feito_por_tipo: "humano",
      tenant_id: defaultTenantId(),
      metadata: {
        via: "whatsapp_comando",
        comando: parsed.tipo,
        agente_slug: ctx.agenteSlug,
        operador_telefone_mascarado: mascararTel(ctx.telefoneOperador),
      },
    });
  } catch {
    /* non-critical */
  }

  switch (parsed.tipo) {
    case "ajuda":
      return { ok: true, respostaOperador: textoAjudaComandos(), comando: "ajuda" };

    case "global_off": {
      const r = await definirPausaGlobalAgente(ctx.supabase, ctx.agenteSlug, true, {
        por: operador.slug,
        motivo: "whatsapp_comando_ia_off",
      });
      if (!r.ok) {
        return {
          ok: false,
          respostaOperador: `Não foi possível pausar a linha (${r.erro ?? "erro"}).`,
          comando: "global_off",
        };
      }
      const cancelados = await cancelarJobsIaPendentesGlobal(ctx.supabase, ctx.agenteSlug);
      return {
        ok: true,
        respostaOperador: `✅ IA pausada em *toda* a linha (${ctx.agenteSlug}). Jobs cancelados: ${cancelados}. Use /ia-on para reativar.`,
        comando: "global_off",
      };
    }

    case "global_on": {
      const r = await definirPausaGlobalAgente(ctx.supabase, ctx.agenteSlug, false, {
        por: operador.slug,
      });
      if (!r.ok) {
        return {
          ok: false,
          respostaOperador: `Não foi possível reativar a linha (${r.erro ?? "erro"}).`,
          comando: "global_on",
        };
      }
      return {
        ok: true,
        respostaOperador: `✅ IA reativada na linha (${ctx.agenteSlug}). Novos leads voltam a ser atendidos pela IA.`,
        comando: "global_on",
      };
    }

    case "pausa_lead": {
      const r = await assumirPorTelefone(ctx.supabase, parsed.telefoneLead, operador, "whatsapp_comando");
      if (!r.ok) {
        return {
          ok: false,
          respostaOperador: `Não foi possível pausar o lead ${mascararTel(parsed.telefoneLead)}: ${r.erro ?? "erro"}.`,
          comando: "pausa_lead",
        };
      }
      return {
        ok: true,
        respostaOperador: `✅ IA pausada no lead ${mascararTel(parsed.telefoneLead)}. Jobs cancelados: ${r.jobsCancelados}.`,
        comando: "pausa_lead",
      };
    }

    case "retoma_lead": {
      const r = await devolverPorTelefone(ctx.supabase, parsed.telefoneLead, operador, "whatsapp_comando");
      if (!r.ok) {
        return {
          ok: false,
          respostaOperador: `Não foi possível reativar IA no lead ${mascararTel(parsed.telefoneLead)}: ${r.erro ?? "erro"}.`,
          comando: "retoma_lead",
        };
      }
      return {
        ok: true,
        respostaOperador: `✅ IA reativada no lead ${mascararTel(parsed.telefoneLead)}.`,
        comando: "retoma_lead",
      };
    }

    case "status": {
      const pause = await lerPausaGlobalAgente(ctx.supabase, ctx.agenteSlug);
      await maybeAlertarPausaGlobalProlongada(ctx.supabase, ctx.agenteSlug, pause);

      const { count } = await ctx.supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .not("humano_responsavel", "is", null);

      const emHumano = typeof count === "number" ? count : 0;
      const linha = pause.pausada ? "🔴 PAUSADA (global)" : "🟢 ATIVA (global)";
      const desde = pause.pausadaEm ? `\nDesde: ${pause.pausadaEm.slice(0, 16).replace("T", " ")} UTC` : "";
      return {
        ok: true,
        respostaOperador: `*Status IA — ${ctx.agenteSlug}*\nLinha: ${linha}${desde}\nConversas em humano: ${emHumano}`,
        comando: "status",
      };
    }

    default:
      return { ok: false, respostaOperador: "Comando não implementado." };
  }
}

/** True se o texto parece comando (para operador autorizado sem match exato). */
export function textoPareceComandoOperador(texto: string): boolean {
  const norm = normalizarTextoComando(texto);
  if (!norm) return false;
  return (
    norm.startsWith("ia") ||
    norm.startsWith("assumir") ||
    norm.startsWith("devolver") ||
    norm === "status" ||
    norm === "ajuda" ||
    norm === "help"
  );
}
