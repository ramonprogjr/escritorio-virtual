import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { aprovarEEnviarEncaminhamento } from "@/lib/crm/notificar-parceiro-lead";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  const supabase = db();

  // Guard de posse: aprova e envia (WhatsApp real ao parceiro) — sem isto, qualquer
  // chamador anônimo aprovava encaminhamentos de qualquer tenant.
  const { data: enc, error: encErr } = await supabase
    .from("hub_encaminhamentos")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (encErr) return NextResponse.json({ error: encErr.message }, { status: 500 });
  if (!enc || (enc.tenant_id && enc.tenant_id !== g.ctx.tenantId)) {
    return NextResponse.json({ error: "Encaminhamento não encontrado." }, { status: 404 });
  }

  let body: { parceiro_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await aprovarEEnviarEncaminhamento(supabase, id, {
    parceiro_id: body.parceiro_id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, telefone: result.telefone });
}
