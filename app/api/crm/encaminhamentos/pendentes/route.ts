import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { CandidatoParceiro } from "@/lib/crm/distribuir-lead";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseCriterio(raw: string | null | undefined): {
  parceiro_id?: string;
  parceiro_nome?: string;
  candidatos?: CandidatoParceiro[];
} {
  if (!raw?.trim()) return {};
  try {
    return JSON.parse(raw) as ReturnType<typeof parseCriterio>;
  } catch {
    return { parceiro_nome: raw };
  }
}

export async function GET(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const status = new URL(request.url).searchParams.get("status") || "aguardando_validacao";

  const { data, error } = await db()
    .from("hub_encaminhamentos")
    .select("id, lead_id, segmento, status, criterio_selecao, encaminhado_para, sugerido_ia, criado_em")
    .eq("status", status)
    .eq("tenant_id", g.ctx.tenantId)
    .order("criado_em", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leadIds = [...new Set((data ?? []).map((r) => r.lead_id).filter(Boolean))];
  let leadsMap = new Map<string, { nome: string; telefone: string | null; codigo: string | null }>();

  if (leadIds.length > 0) {
    const { data: leads } = await db()
      .from("hub_leads_crm")
      .select("id, nome, telefone, codigo")
      .in("id", leadIds);
    for (const l of leads ?? []) {
      leadsMap.set(String(l.id), {
        nome: String(l.nome),
        telefone: l.telefone,
        codigo: l.codigo,
      });
    }
  }

  const rows = (data ?? []).map((row) => {
    const criterio = parseCriterio(row.criterio_selecao as string);
    const lead = leadsMap.get(String(row.lead_id));
    return {
      id: row.id,
      lead_id: row.lead_id,
      lead_nome: lead?.nome ?? "—",
      lead_telefone: lead?.telefone,
      lead_codigo: lead?.codigo,
      segmento: row.segmento,
      status: row.status,
      sugerido_ia: row.sugerido_ia,
      criado_em: row.criado_em,
      parceiro_sugerido: criterio.parceiro_nome ?? row.encaminhado_para,
      parceiro_id: criterio.parceiro_id,
      candidatos: criterio.candidatos ?? [],
    };
  });

  return NextResponse.json({ data: rows });
}
