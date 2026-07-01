import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Mapa mobile do escritório (tela interna) — exige sessão CRM ativa (Batch 5). */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json([]);
  }

  const supabase = db();

  const { data: agentes, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, area, nivel, ativo, pos_mobile_x, pos_mobile_y, sala_id, cor_departamento, modelo_padrao")
    .not("pos_mobile_x", "is", null)
    .order("nivel");

  if (error || !agentes) return NextResponse.json([]);

  const slugs = agentes.map(a => a.agente_slug as string);

  const { data: leadsAtivos } = await supabase
    .from("hub_leads_crm")
    .select("agente_responsavel")
    .in("agente_responsavel", slugs)
    .not("estagio", "in", '("ganho","perdido","arquivado")');

  const contagemLeads: Record<string, number> = {};
  for (const l of leadsAtivos || []) {
    if (l.agente_responsavel) {
      contagemLeads[l.agente_responsavel] = (contagemLeads[l.agente_responsavel] || 0) + 1;
    }
  }

  const resultado = agentes.map(ag => ({
    ...ag,
    leads_atendendo: contagemLeads[ag.agente_slug as string] || 0,
  }));

  return NextResponse.json(resultado);
}
