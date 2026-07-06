import { type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { listarCandidatosParceiro, type CandidatoParceiro } from "@/lib/crm/distribuir-lead";
import { tenantScopeOrFilter } from "@/lib/tenant-default";
import { crmDb as db, crmConfigError as supabaseConfigError } from "@/lib/crm/supabase-server";

/** Mesmo critério de mercado usado em sugerir-encaminhamento-auto (lê metadata do lead). */
function mercadoDoLead(metadata: unknown): string {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  const mp = meta.mercado_principal ?? meta.mercado;
  if (typeof mp === "string" && mp.trim()) return mp.trim().toUpperCase();
  const mercados = meta.mercados;
  if (Array.isArray(mercados) && mercados[0]) return String(mercados[0]).trim().toUpperCase();
  return "IMB";
}

export type FilaLeadItem = {
  lead_id: string;
  nome: string;
  telefone: string | null;
  mercado: string;
  cidade: string | null;
  estado: string | null;
  criado_em: string | null;
  /** top-3 do motor de score (regra determinística — sem LLM). */
  candidatos: CandidatoParceiro[];
};

/**
 * GET /api/crm/distribuicao/fila — leads aguardando distribuição + sugestão do motor.
 *
 * Read-only: NÃO cria encaminhamento (ao contrário de /sugerir). Reusa o mesmo
 * scoring determinístico (listarCandidatosParceiro) que o painel de distribuição,
 * sem depender de chave de LLM. A confirmação em 1 toque é feita no fluxo
 * /sugerir → /[id]/aprovar pelo cliente.
 *
 * Critério "aguardando distribuição": lead qualificado, sem encaminhamento
 * pendente/enviado, no tenant do chamador.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = supabaseConfigError();
  if (configErr) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: configErr },
      { status: 503 }
    );
  }

  const supabase: SupabaseClient = db();
  const tenantId = g.ctx.tenantId;
  const { searchParams } = new URL(request.url);
  const limite = Math.min(parseInt(searchParams.get("limite") || "12", 10) || 12, 30);

  // 1) leads qualificados do tenant (candidatos a distribuir)
  const { data: leads, error: leadsErr } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, estagio, metadata, pessoa_id, criado_em")
    .eq("estagio", "qualificado")
    .or(tenantScopeOrFilter(tenantId))
    .order("criado_em", { ascending: true })
    .limit(60);

  if (leadsErr) {
    return NextResponse.json({ error: leadsErr.message }, { status: 500 });
  }

  const baseLeads = leads ?? [];
  if (baseLeads.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // 2) remove os que já têm encaminhamento pendente/enviado (não estão "aguardando")
  const ids = baseLeads.map((l) => String(l.id));
  const { data: encs } = await supabase
    .from("hub_encaminhamentos")
    .select("lead_id, status")
    .in("lead_id", ids)
    .in("status", ["aguardando_validacao", "sugerido_ia", "aprovado_envio", "enviado"]);

  const ocupados = new Set((encs ?? []).map((e) => String(e.lead_id)));
  const aguardando = baseLeads.filter((l) => !ocupados.has(String(l.id))).slice(0, limite);

  if (aguardando.length === 0) {
    return NextResponse.json({ data: [] });
  }

  // 3) geo das pessoas vinculadas (1 query) para o scoring por cidade/UF
  const pessoaIds = Array.from(
    new Set(aguardando.map((l) => l.pessoa_id).filter((v): v is string => typeof v === "string"))
  );
  const geoPorPessoa = new Map<string, { cidade: string | null; estado: string | null }>();
  if (pessoaIds.length > 0) {
    const { data: pessoas } = await supabase
      .from("hub_pessoas")
      .select("id, cidade, estado")
      .in("id", pessoaIds);
    for (const p of pessoas ?? []) {
      geoPorPessoa.set(String(p.id), { cidade: p.cidade ?? null, estado: p.estado ?? null });
    }
  }

  // 4) sugestão do motor por lead (top-3) — paralelo, determinístico
  const itens: FilaLeadItem[] = await Promise.all(
    aguardando.map(async (l) => {
      const mercado = mercadoDoLead(l.metadata);
      const geo = l.pessoa_id ? geoPorPessoa.get(String(l.pessoa_id)) : undefined;
      const candidatos = await listarCandidatosParceiro(supabase, {
        mercado,
        cidade: geo?.cidade ?? null,
        estado: geo?.estado ?? null,
        tenant_id: tenantId,
        limite: 3,
      });
      return {
        lead_id: String(l.id),
        nome: String(l.nome ?? "Lead"),
        telefone: l.telefone != null ? String(l.telefone) : null,
        mercado,
        cidade: geo?.cidade ?? null,
        estado: geo?.estado ?? null,
        criado_em: l.criado_em != null ? String(l.criado_em) : null,
        candidatos,
      };
    })
  );

  return NextResponse.json({ data: itens });
}
