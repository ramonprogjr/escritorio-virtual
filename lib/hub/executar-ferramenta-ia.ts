import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { HubAgenteFerramentaId } from "@/lib/hub/agente-ferramentas-registry";
import { uploadArquivo } from "@/lib/ia/storage";
import { defaultTenantId } from "@/lib/tenant-default";

export type FerramentaHubContexto = {
  leadId: string;
  agenteSlug: string;
  tenantId?: string;
  /** hub_agente_identidade.modo_operacao — usado para gates de escrita seguros */
  modoOperacao?: string | null;
};

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resultado JSON string para o modelo (sempre compacto). */
export async function executarFerramentaHub(
  toolName: string,
  argsJson: string,
  ctx: FerramentaHubContexto
): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    const p = JSON.parse(argsJson || "{}");
    if (p && typeof p === "object" && !Array.isArray(p)) args = p as Record<string, unknown>;
  } catch {
    return JSON.stringify({ erro: "argumentos_json_invalidos" });
  }

  const supabase = db();

  try {
    switch (toolName as HubAgenteFerramentaId) {
      case "hub_lead_resumo": {
        const { data, error } = await supabase
          .from("hub_leads_crm")
          .select(
            "id, nome, telefone, estagio, valor_estimado, agente_responsavel, humano_responsavel, atualizado_em, metadata"
          )
          .eq("id", ctx.leadId)
          .maybeSingle();
        if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
        if (!data) return JSON.stringify({ erro: "lead_nao_encontrado", lead_id: ctx.leadId });
        return JSON.stringify({
          lead: data,
          agente_slug_conversa: ctx.agenteSlug,
        });
      }
      case "hub_lead_memorias": {
        const limRaw = args.limite;
        const lim =
          typeof limRaw === "number" && Number.isFinite(limRaw)
            ? Math.min(10, Math.max(1, Math.floor(limRaw)))
            : 5;
        const { data, error } = await supabase
          .from("hub_memorias_lead")
          .select("chave, valor, confianca, criado_por, criado_em")
          .eq("lead_id", ctx.leadId)
          .order("confianca", { ascending: false })
          .limit(lim);
        if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
        return JSON.stringify({ memorias: data ?? [] });
      }
      case "hub_metricas_escritorio": {
        const tenant = (ctx.tenantId && ctx.tenantId.trim()) || defaultTenantId();
        const since = new Date(Date.now() - 7 * 86_400_000).toISOString();

        const { count: leadsTenant, error: e1 } = await supabase
          .from("hub_leads_crm")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", tenant);

        const { count: acoes7d, error: e2 } = await supabase
          .from("hub_acoes_ia")
          .select("*", { count: "exact", head: true })
          .eq("agente_slug", ctx.agenteSlug)
          .gte("criado_em", since);

        const { count: prompts7d, error: e3 } = await supabase
          .from("hub_prompt_logs")
          .select("*", { count: "exact", head: true })
          .eq("agente_slug", ctx.agenteSlug)
          .gte("criado_em", since);

        if (e1 || e2 || e3) {
          return JSON.stringify({
            erro: "supabase",
            detalhe: [e1?.message, e2?.message, e3?.message].filter(Boolean).join(" | ") || "contagem_falhou",
          });
        }

        return JSON.stringify({
          tenant_id: tenant,
          leads_total_no_tenant: leadsTenant ?? 0,
          acoes_ia_ultimos_7d_este_agente: acoes7d ?? 0,
          pedidos_inferencia_hub_ultimos_7d_este_agente: prompts7d ?? 0,
          nota: "Contagens agregadas; não substitui relatório financeiro nem detalhe por lead.",
        });
      }
      case "hub_relatorio_html_simples": {
        const titulo = typeof args.titulo === "string" ? args.titulo.trim() : "";
        const textoPlano = typeof args.texto_plano === "string" ? args.texto_plano.trim() : "";
        if (!titulo || !textoPlano) {
          return JSON.stringify({ erro: "titulo_e_texto_plano_obrigatorios" });
        }
        const tituloEsc = escapeHtml(titulo.slice(0, 240));
        const body = textoPlano
          .slice(0, 50_000)
          .split(/\r?\n/)
          .map((linha) => `<p>${escapeHtml(linha)}</p>`)
          .join("");
        const html = `<!DOCTYPE html><html lang="pt"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${tituloEsc}</title><style>body{font-family:system-ui,sans-serif;padding:1.25rem;line-height:1.5;color:#111}h1{font-size:1.25rem}</style></head><body><h1>${tituloEsc}</h1>${body}</body></html>`;
        const buffer = Buffer.from(html, "utf-8");
        const salvo = await uploadArquivo({
          arquivo: buffer,
          nome: `relatorio_ia_${Date.now()}.html`,
          tipo: "relatorio",
          origem: "ia_gerado",
          leadId: ctx.leadId,
          agenteSlug: ctx.agenteSlug,
          contentType: "text/html; charset=utf-8",
          metadata: { ferramenta: "hub_relatorio_html_simples" },
        });
        if (!salvo) return JSON.stringify({ erro: "upload_ou_gravacao_falhou" });
        return JSON.stringify({
          ok: true,
          url_publica: salvo.url,
          arquivo_id: salvo.id,
        });
      }
      case "hub_registar_nota_lead": {
        if (ctx.modoOperacao !== "canal_whatsapp") {
          return JSON.stringify({
            erro: "ferramenta_apenas_modo_atendimento_canal_whatsapp",
            modo_actual: ctx.modoOperacao ?? null,
          });
        }
        const textoBruto = typeof args.texto === "string" ? args.texto.trim() : "";
        if (!textoBruto) return JSON.stringify({ erro: "texto_obrigatorio" });
        const texto = textoBruto.slice(0, 8000);
        const { error } = await supabase.from("hub_atividades").insert({
          lead_id: ctx.leadId,
          tipo: "nota",
          descricao: texto,
          feito_por: ctx.agenteSlug,
          feito_por_tipo: "ia",
          metadata: { origem: "hub_registar_nota_lead" },
        });
        if (error) return JSON.stringify({ erro: "supabase", detalhe: error.message });
        return JSON.stringify({ ok: true, tipo: "nota_timeline" });
      }
      default:
        return JSON.stringify({ erro: "ferramenta_desconhecida", nome: toolName });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro_execucao";
    return JSON.stringify({ erro: "excecao", detalhe: msg });
  }
}
