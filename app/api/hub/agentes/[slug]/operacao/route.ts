import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Retorna true se a linha pertence a outro tenant (service-role bypassa RLS). */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Servico indisponivel" }, { status: 503 });
  }

  // E-B2: guard de sessao + isolamento de tenant. Vaza custo_brl e prompts sem auth.
  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  // E-B2: verificar que o agente pertence ao tenant da sessao antes de devolver dados.
  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente nao encontrado" }, { status: 404 });
  }

  /** Historico de execucoes no painel (nao e "lifetime" completo; ver CRM / relatorios para auditoria longa). */
  const CICLOS_LOG_LIMIT = 150;

  const [ciclosR, logsR, acoesR, promptR] = await Promise.all([
    supabase
      .from("hub_ciclos_ia")
      .select("id, nome, descricao, tipo, ativo, cron_expressao, ultimo_ciclo, ultimo_status, total_execucoes, intervalo_minutos")
      .eq("agente_slug", slug)
      .order("nome"),
    supabase
      .from("hub_ciclos_log")
      .select("id, ciclo_id, status, erro, iniciado_em, finalizado_em, tokens_usados, custo_brl, acoes_tomadas")
      .eq("agente_slug", slug)
      .order("iniciado_em", { ascending: false })
      .limit(CICLOS_LOG_LIMIT),
    supabase
      .from("hub_acoes_ia")
      .select("id, tipo, descricao, lead_id, sucesso, criado_em, metadata")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(12),
    supabase
      .from("hub_prompt_logs")
      .select("criado_em")
      .eq("agente_slug", slug)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const errors = [ciclosR.error, logsR.error, acoesR.error, promptR.error].filter(Boolean);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map((e) => e?.message).join("; ") }, { status: 500 });
  }

  return NextResponse.json({
    ciclos: ciclosR.data || [],
    execucoes_ciclo: logsR.data || [],
    acoes: acoesR.data || [],
    ultimo_prompt_em: promptR.data?.criado_em ?? null,
  });
}
