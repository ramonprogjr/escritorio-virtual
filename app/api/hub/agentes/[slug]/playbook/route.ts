import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { runPlaybookPipeline } from "@/lib/playbook/orchestrate";
import { loadAgentPlaybookSnapshot } from "@/lib/playbook/agent-snapshot";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";

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

/**
 * POST — gera playbook (Markdown) a partir do estado actual do agente no Supabase,
 * faz upload para `hub-agent-playbooks` e grava URL/hash em `hub_agente_identidade`.
 *
 * GET — devolve metadados do último playbook (sem regenerar).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // Leitura de metadados do playbook — exige sessão CRM ativa + isolamento de tenant.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select(
      "agente_slug, nome, playbook_object_path, playbook_public_url, playbook_generated_at, playbook_source_hash, tenant_id"
    )
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || agenteForaDoTenant(data as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // Gera/publica playbook a partir do estado do agente — exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  let force = false;
  try {
    const body = await request.json().catch(() => ({}));
    force = Boolean((body as { force?: boolean }).force);
  } catch {
    /* ignore */
  }

  if (!force) {
    const { data: row } = await supabase
      .from("hub_agente_identidade")
      .select("playbook_source_hash")
      .eq("agente_slug", slug)
      .maybeSingle();

    const current = await loadAgentPlaybookSnapshot(supabase, slug);
    if ("error" in current) {
      return NextResponse.json({ error: current.error }, { status: 404 });
    }

    if (row?.playbook_source_hash === current.hash) {
      const { data: meta } = await supabase
        .from("hub_agente_identidade")
        .select("playbook_public_url, playbook_object_path, playbook_generated_at, playbook_source_hash")
        .eq("agente_slug", slug)
        .maybeSingle();
      return NextResponse.json({
        sucesso: true,
        skipped: true,
        motivo: "Hash do snapshot igual ao playbook já gravado.",
        ...meta,
      });
    }
  }

  const result = await runPlaybookPipeline(supabase, slug);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    sucesso: true,
    skipped: false,
    playbook_public_url: result.publicUrl,
    playbook_object_path: result.path,
    playbook_source_hash: result.hash,
    mistral_appendix: result.mistral_appendix,
  });
}
