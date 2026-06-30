import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  COPILOTO_AGENTE_SLUG,
  CopilotoSegredoAusenteError,
  escritaSemLead,
  ferramentaExecutavel,
  nivelDaFerramenta,
  validarConfirmacao,
} from "@/lib/copiloto/copiloto-core";

/**
 * SEC-7 (auditoria das tools de ESCRITA da IA): grava QUEM/QUAL ferramenta/QUANDO/tenant em
 * hub_decision_logs quando o copiloto executa uma escrita. Este endpoint é o ÚNICO caminho de
 * escrita do copiloto (HMAC + allowlist + confirmação humana já validados acima), então é o
 * chokepoint correto — uma linha por escrita, sem instrumentar cada tool.
 *
 * TOLERÂNCIA (igual lib/ia/aprovacoes.ts): tenant_id é gravado SEMPRE (service_role bypassa RLS —
 * log de ação da IA não pode nascer órfão); se a coluna tenant_id ainda não existe (migração E7
 * pendente), repete o INSERT sem ela. Best-effort puro: NUNCA quebra a execução da ferramenta —
 * a auditoria é efeito secundário, não bloqueador.
 */
function auditDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function auditarEscritaCopiloto(
  tenant: string,
  ferramenta: string,
  leadId: string,
  sucesso: boolean
): Promise<void> {
  try {
    const db = auditDb();
    const linha: Record<string, unknown> = {
      agente_slug: COPILOTO_AGENTE_SLUG,
      tipo: "ferramenta_ia_escrita",
      descricao: `Copiloto executou ${ferramenta}${leadId ? ` (lead ${leadId})` : ""}`,
      lead_id: leadId || null,
      aprovado_por: "humano",
      resultado: sucesso ? "executado" : "falhou",
    };
    const tenantTrim = (tenant ?? "").trim();
    const comTenant = tenantTrim ? { tenant_id: tenantTrim, ...linha } : linha;
    const { error } = await db.from("hub_decision_logs").insert(comTenant);
    if (error && tenantTrim && isMissingPgColumn(error, "tenant_id")) {
      await db.from("hub_decision_logs").insert(linha); // migração E7 (tenant_id) ainda não aplicada
    }
  } catch {
    // Auditoria best-effort: nunca afeta a resposta ao usuário.
  }
}

/**
 * POST { ferramenta, params, confirmacaoId, ts, contexto:{ leadId? } }
 * Executa a ferramenta proposta — SOMENTE após validar o HMAC e SOMENTE ferramentas executáveis
 * pelo copiloto (leitura OU allowlist de escrita Fase 3). tenantId vem da sessão, nunca do body.
 *
 * Segurança da escrita: este endpoint só roda quando o cliente o chama APÓS o dono CONFIRMAR
 * (o fluxo de leitura auto-executa; o de escrita exige clique). A allowlist + HMAC + TTL garantem
 * que não há execução de escrita não-proposta ou adulterada.
 */
export async function POST(request: NextRequest) {
  const auth = await autenticarCopiloto();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  let body: {
    ferramenta?: unknown;
    params?: unknown;
    confirmacaoId?: unknown;
    ts?: unknown;
    contexto?: { leadId?: unknown };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const ferramenta = typeof body.ferramenta === "string" ? body.ferramenta.trim() : "";
  const params =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as Record<string, unknown>)
      : {};
  const confirmacaoId = typeof body.confirmacaoId === "string" ? body.confirmacaoId : "";
  const ts = typeof body.ts === "number" ? body.ts : NaN;

  const leadId =
    typeof body.contexto?.leadId === "string" ? body.contexto.leadId.trim() : "";

  // 1) Integridade: a proposta tem de ter sido assinada por nós, estar no prazo E
  //    ter sido feita para ESTE lead. O leadId entra na assinatura — se o dono falou
  //    num lead, navegou para outro e confirmou, o leadId do body não casa → recusa.
  let v: ReturnType<typeof validarConfirmacao>;
  try {
    v = validarConfirmacao(confirmacaoId, ferramenta, params, ts, leadId);
  } catch (e) {
    if (e instanceof CopilotoSegredoAusenteError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
  if (!v.ok) {
    const msg =
      v.erro === "confirmacao_expirada"
        ? "A proposta expirou. Fale o comando de novo."
        : "Proposta inválida.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  // 2) Trava de construção: só LEITURA ou as ferramentas de escrita da allowlist Fase 3.
  //    Qualquer outra ferramenta (ex. hub_crm_criar_cadastro, hub_whatsapp_menu) → 403.
  if (!ferramentaExecutavel(ferramenta)) {
    return NextResponse.json(
      { error: "Esta ação não está disponível pelo copiloto." },
      { status: 403 }
    );
  }

  const ehEscrita = nivelDaFerramenta(ferramenta) === "escrita";
  const semLead = escritaSemLead(ferramenta);

  // Escrita SOBRE LEAD exige um lead aberto (essas tools operam em ctx.leadId).
  // Escrita de obra/EAP opera sobre obra_id nos params — não precisa de lead.
  if (ehEscrita && !semLead && !leadId) {
    return NextResponse.json(
      { error: "Abra um lead para registrar nota ou atualizar." },
      { status: 400 }
    );
  }

  let resultadoStr: string;
  try {
    resultadoStr = await executarFerramentaHub(ferramenta, JSON.stringify(params), {
      leadId,
      agenteSlug: COPILOTO_AGENTE_SLUG,
      tenantId: auth.tenantId,
      // As tools de escrita de LEAD exigem modoOperacao="canal_whatsapp" por construção interna.
      // O copiloto é o DONO autenticado confirmando manualmente — gate equivalente/superior ao
      // do atendimento automático — então liberamos esse modo só para a escrita allowlist de lead.
      // As tools de obra/EAP NÃO têm esse gate — não injetamos o modo nelas.
      ...(ehEscrita && !semLead ? { modoOperacao: "canal_whatsapp" } : {}),
    });
  } catch (e) {
    // SEC-7: registra a tentativa de escrita que FALHOU por exceção (auditoria não some no erro).
    if (ehEscrita) await auditarEscritaCopiloto(auth.tenantId, ferramenta, leadId, false);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao executar." },
      { status: 500 }
    );
  }

  // SEC-7: auditoria da ESCRITA da IA (quem/qual ferramenta/quando/tenant). Só para escrita —
  // leitura não muda dados. Best-effort: não bloqueia a resposta nem falha o request.
  if (ehEscrita) await auditarEscritaCopiloto(auth.tenantId, ferramenta, leadId, true);

  let resultado: unknown = resultadoStr;
  try {
    resultado = JSON.parse(resultadoStr);
  } catch {
    /* resultado textual simples */
  }

  return NextResponse.json({ ok: true, ferramenta, resultado });
}
