import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = db();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const [identidade, conhecimento, conversasAtivas, atendidosHoje] = await Promise.all([
    supabase
      .from("hub_agente_identidade")
      .select("agente_slug, nome, cargo, area, nivel, ativo, cor_departamento, modelo_padrao, sala_id")
      .eq("agente_slug", slug)
      .single(),

    supabase
      .from("hub_agente_conhecimento")
      .select("secao, titulo")
      .eq("agente_slug", slug)
      .eq("ativo", true)
      .order("ordem")
      .limit(20),

    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, origem, atualizado_em")
      .eq("agente_responsavel", slug)
      .not("estagio", "in", '("ganho","perdido","arquivado")')
      .order("atualizado_em", { ascending: false })
      .limit(5),

    supabase
      .from("hub_leads_crm")
      .select("id, estagio", { count: "exact", head: false })
      .eq("agente_responsavel", slug)
      .gte("atualizado_em", hoje.toISOString()),
  ]);

  if (!identidade.data) return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });

  const total = atendidosHoje.data?.length || 0;
  const convertidos = atendidosHoje.data?.filter(l => l.estagio === "ganho").length || 0;

  return NextResponse.json({
    ...identidade.data,
    conhecimento: conhecimento.data || [],
    conversas_ativas: conversasAtivas.data || [],
    stats: {
      atendendo: conversasAtivas.data?.length || 0,
      atendidos_hoje: total,
      conversao_pct: total > 0 ? Math.round((convertidos / total) * 100) : 0,
    },
  });
}
