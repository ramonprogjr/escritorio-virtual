import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
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
    return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  }

  // Arquivamento é destrutivo/administrativo — exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { motivo?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Body JSON inválido." }, { status: 400 });
  }

  const motivo = (body.motivo || "").trim();
  if (motivo.length < 10) {
    return NextResponse.json(
      { erro: "Informe o motivo do arquivamento (mínimo 10 caracteres)." },
      { status: 400 }
    );
  }

  const supabase = db();

  const { data: agenteRow } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!agenteRow || agenteForaDoTenant(agenteRow as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .update({
      arquivado_em: new Date().toISOString(),
      arquivado_motivo: motivo,
      ativo: false,
    })
    .eq("agente_slug", slug)
    .select("agente_slug")
    .maybeSingle();

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("arquivado_em") && msg.includes("does not exist")) {
      return NextResponse.json(
        {
          erro:
            "Coluna arquivado_em ausente no banco. Aplique a migração supabase/migrations/20260522200000_hub_agente_arquivado_em.sql.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, agente_slug: data.agente_slug });
}
