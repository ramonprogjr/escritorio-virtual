import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sugerirEncaminhamentoAutomatico } from "@/lib/crm/sugerir-encaminhamento-auto";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: { lead_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.lead_id?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });
  }

  const tenantId = g.ctx.tenantId;
  const result = await sugerirEncaminhamentoAutomatico(db(), leadId, { tenant_id: tenantId });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, candidatos: result.candidatos ?? [] },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    encaminhamento_id: result.encaminhamento_id,
    principal: result.principal,
    candidatos: result.candidatos,
  });
}
