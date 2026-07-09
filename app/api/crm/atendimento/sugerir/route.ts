import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { sugerirRespostaAtendimento } from "@/lib/crm/sugerir-resposta-atendimento";

/** "Mari sugere": propõe a próxima resposta ao operador (IA Mistral) a partir da conversa do lead. */
export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const sessao = await requireCrmSessao(request);
  if ("error" in sessao) return sessao.error;

  let body: { lead_id?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const leadId = body.lead_id?.trim();
  if (!leadId) return NextResponse.json({ error: "lead_id obrigatório" }, { status: 400 });

  const supabase = crmDb();
  // Escopo de tenant: só sugere para lead do próprio tenant (service-role bypassa RLS).
  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, tenant_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead || (lead.tenant_id && lead.tenant_id !== sessao.ctx.tenantId)) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  const r = await sugerirRespostaAtendimento(supabase, leadId);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
