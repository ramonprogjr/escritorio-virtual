import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { uploadCustomPlaybookForAgent } from "@/lib/playbook/custom-playbook";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // Upload de playbook customizado — escrita, exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { error: "Content-Type inválido. Use multipart/form-data com campo file." },
      { status: 415 }
    );
  }

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

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo no campo file." }, { status: 400 });
  }

  const markdown = await file.text();
  const parsed = parsePlaybookFlowFromMarkdown(markdown);
  const noFlowBlock = !parsed.ok && parsed.reason === "not_found";

  if (!noFlowBlock) {
    if (!parsed.ok) {
      return NextResponse.json(
        { error: "Fluxo playbook inválido.", errors: parsed.errors },
        { status: 400 }
      );
    }

    const validated = validatePlaybookFlowDefinition(parsed.definition);
    if (!validated.ok) {
      return NextResponse.json(
        { error: "Fluxo playbook inválido.", errors: validated.errors },
        { status: 400 }
      );
    }
  }

  const result = await uploadCustomPlaybookForAgent(supabase, slug, file);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    sucesso: true,
    tipo: result.tipo,
    nome_arquivo: result.nome_arquivo,
    bytes: result.bytes,
    playbook_object_path: result.playbook_object_path,
    playbook_public_url: result.playbook_public_url,
    playbook_generated_at: result.playbook_generated_at,
    playbook_source_hash: result.playbook_source_hash,
  });
}
