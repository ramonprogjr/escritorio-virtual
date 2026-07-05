import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { loadCurrentPlaybookMarkdown } from "@/lib/playbook/custom-playbook";
import { analyzePlaybookWithMistral, buildLocalPlaybookAnalysisFallback } from "@/lib/playbook/mistral-analysis";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";

/** Retorna true se a linha pertence a outro tenant (service-role bypassa RLS). */
function agenteForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // Chama Mistral (custo) e lê o playbook do agente — exige sessão CRM ativa.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  // Teto anti-abuso por tenant (LLM pago).
  const limite = requireIaRateLimit(`playbook-analisar:${g.ctx.tenantId}`, 20);
  if (limite) return limite;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  let markdown: string | null = null;
  let origemPlaybook: "conteudo_body" | "object_path" | "public_url" = "object_path";
  let metaPath: string | null = null;
  let metaUrl: string | null = null;

  try {
    const body = (await request.json()) as { content?: unknown };
    if (typeof body?.content === "string" && body.content.trim()) {
      markdown = body.content.trim();
      origemPlaybook = "conteudo_body";
    }
  } catch {
    /* body opcional — carrega do storage */
  }

  if (!markdown) {
    const loaded = await loadCurrentPlaybookMarkdown(supabase, slug);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }
    markdown = loaded.markdown;
    origemPlaybook = loaded.origem;
    metaPath = loaded.playbook_object_path;
    metaUrl = loaded.playbook_public_url;
  }

  const analysis = await analyzePlaybookWithMistral(markdown);
  if (!analysis.ok) {
    const fallback = buildLocalPlaybookAnalysisFallback(markdown);
    return NextResponse.json({
      sucesso: true,
      origem_playbook: origemPlaybook,
      playbook_object_path: metaPath,
      playbook_public_url: metaUrl,
      model: "local-fallback",
      analise: fallback,
      analise_origem: "fallback",
      aviso: analysis.error,
    });
  }

  return NextResponse.json({
    sucesso: true,
    origem_playbook: origemPlaybook,
    playbook_object_path: metaPath,
    playbook_public_url: metaUrl,
    model: analysis.model,
    analise: analysis.analise,
    analise_origem: "mistral",
  });
}
