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
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ erro: "Serviço indisponível" }, { status: 503 });
  }

  const { slug } = await params;
  const supabase = db();

  const { data: ag, error } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, cargo, area, nivel, ativo, cor_departamento, modelo_padrao, sala_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (error || !ag) {
    return NextResponse.json({ erro: "Agente não encontrado" }, { status: 404 });
  }

  const [conhecimento, conversas, atendendo, atendidosHoje] = await Promise.all([
    supabase
      .from("hub_agente_conhecimento")
      .select("secao, titulo")
      .eq("agente_slug", slug)
      .order("ordem", { ascending: true })
      .limit(50),
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio, origem, atualizado_em")
      .eq("agente_responsavel", slug)
      .not("estagio", "in", '("ganho","perdido","arquivado")')
      .order("atualizado_em", { ascending: false })
      .limit(12),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("agente_responsavel", slug)
      .not("estagio", "in", '("ganho","perdido","arquivado")'),
    supabase
      .from("hub_leads_crm")
      .select("id", { count: "exact", head: true })
      .eq("agente_responsavel", slug)
      .eq("estagio", "ganho")
      .gte("atualizado_em", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const convRows = (conversas.data || []).map(l => ({
    id: l.id as string,
    nome: (l.nome as string) || "—",
    estagio: (l.estagio as string) || "—",
    origem: (l.origem as string) || "—",
    atualizado_em: (l.atualizado_em as string) || "",
  }));

  const ck = (conhecimento.data || []).map(c => ({
    secao: (c.secao as string) || "Geral",
    titulo: (c.titulo as string) || "",
  }));

  const nAtend = atendendo.count || 0;
  const nGanho = atendidosHoje.count || 0;
  const conversao_pct = nAtend + nGanho > 0 ? Math.round((nGanho / (nAtend + nGanho)) * 100) : 0;

  return NextResponse.json({
    agente_slug: ag.agente_slug,
    nome: ag.nome,
    cargo: ag.cargo,
    area: ag.area,
    nivel: ag.nivel,
    ativo: ag.ativo,
    cor_departamento: ag.cor_departamento || "#c9a24a",
    modelo_padrao: ag.modelo_padrao || "",
    sala_id: ag.sala_id || "",
    conhecimento: ck,
    conversas_ativas: convRows,
    stats: {
      atendendo: nAtend,
      atendidos_hoje: nGanho,
      conversao_pct,
    },
  });
}
