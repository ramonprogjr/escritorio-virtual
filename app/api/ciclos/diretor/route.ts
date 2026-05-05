import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CRON_SECRET = process.env.CRON_SECRET || "obra10plus_cron_2026";

async function buscarDadosWindsor() {
  if (!process.env.WINDSOR_API_KEY) return null;

  try {
    const hoje = new Date();
    const seteDias = new Date(hoje.getTime() - 7 * 24 * 3600000);
    const dateFrom = seteDias.toISOString().split("T")[0];
    const dateTo = hoje.toISOString().split("T")[0];

    const res = await fetch(
      `https://connectors.windsor.ai/facebook?api_key=${process.env.WINDSOR_API_KEY}&date_from=${dateFrom}&date_to=${dateTo}&fields=campaign,spend,clicks,impressions,cpc,ctr`,
      { method: "GET", headers: { "Content-Type": "application/json" } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data?.data || null;
  } catch (e) {
    console.error("Erro Windsor:", e);
    return null;
  }
}

async function cicloTrafego() {
  const alertas: string[] = [];
  const sugestoes: string[] = [];

  const campanhas = await buscarDadosWindsor();

  if (!campanhas || campanhas.length === 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "info",
      agente_slug: "diretor",
      titulo: "Verificação de campanhas",
      mensagem: "Dados de campanhas não disponíveis. Configure a integração Windsor.ai.",
      dados: {},
    });
    return { alertas, sugestoes, total: 0 };
  }

  for (const camp of campanhas) {
    const spend = Number(camp.spend) || 0;
    const clicks = Number(camp.clicks) || 0;
    const cpc = spend > 0 && clicks > 0 ? spend / clicks : 0;

    if (cpc > 5) {
      await supabase.from("hub_alertas").insert({
        tipo: "critico",
        agente_slug: "diretor",
        titulo: `CPC crítico: ${camp.campaign}`,
        mensagem: `Campanha "${camp.campaign}" com CPC R$${cpc.toFixed(2)} — muito acima da meta.\nGasto: R$${spend.toFixed(0)} | Cliques: ${clicks}`,
        dados: { campanha: camp.campaign, cpc, spend, clicks },
      });
      alertas.push(`CPC crítico: ${camp.campaign} — R$${cpc.toFixed(2)}`);
    } else if (cpc > 3) {
      await supabase.from("hub_alertas").insert({
        tipo: "importante",
        agente_slug: "diretor",
        titulo: `CPC alto: ${camp.campaign}`,
        mensagem: `Campanha "${camp.campaign}" com CPC R$${cpc.toFixed(2)} — acima da meta de R$2,50.`,
        dados: { campanha: camp.campaign, cpc, spend, clicks },
      });
    }

    if (cpc < 2 && spend > 100) {
      sugestoes.push(`Campanha "${camp.campaign}" com ótimo CPC R$${cpc.toFixed(2)} — considere aumentar orçamento`);
    }
  }

  if (sugestoes.length > 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "sugestao",
      agente_slug: "diretor",
      titulo: `${sugestoes.length} sugestão(ões) de otimização`,
      mensagem: sugestoes.join("\n"),
      dados: { sugestoes },
    });
  }

  return { alertas, sugestoes, total: alertas.length + sugestoes.length };
}

async function cicloAnaliseManha() {
  const [leads, encaminhados, alertasAbertos] = await Promise.all([
    supabase.from("hub_leads_crm").select("id, estagio, valor_estimado").not("estagio", "in", '("ganho","perdido","arquivado")'),
    supabase.from("hub_encaminhamentos").select("id, status").gte("enviado_em", new Date(Date.now() - 7 * 24 * 3600000).toISOString()),
    supabase.from("hub_alertas").select("id, tipo").eq("resolvido", false),
  ]);

  const criticos = (alertasAbertos.data || []).filter(a => a.tipo === "critico").length;
  const todosLeads = leads.data || [];
  const receitaPotencial = todosLeads.reduce((s, l) => s + (l.valor_estimado || 0), 0);

  if (criticos > 0) {
    await supabase.from("hub_alertas").insert({
      tipo: "importante",
      agente_slug: "diretor",
      titulo: `${criticos} alerta(s) crítico(s) pendente(s)`,
      mensagem: `Há ${criticos} alertas críticos não resolvidos que precisam de atenção.`,
      dados: { criticos },
    });
  }

  return {
    leads_ativos: todosLeads.length,
    receita_potencial: receitaPotencial,
    criticos,
    encaminhamentos_7d: (encaminhados.data || []).length,
  };
}

async function cicloAnaliseNoite() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const [leadsHoje, encHoje, alertasHoje] = await Promise.all([
    supabase.from("hub_leads_crm").select("id, estagio", { count: "exact" }).gte("criado_em", hoje.toISOString()),
    supabase.from("hub_encaminhamentos").select("id, status", { count: "exact" }).gte("enviado_em", hoje.toISOString()),
    supabase.from("hub_alertas").select("id, tipo", { count: "exact" }).eq("resolvido", false),
  ]);

  const resumo = `📊 *Resumo do dia — Obra10+*

📥 Leads hoje: ${leadsHoje.count || 0}
🤝 Encaminhados: ${encHoje.count || 0}
⚠️ Alertas abertos: ${alertasHoje.count || 0}

${(alertasHoje.count || 0) > 0 ? "Verifique os alertas pendentes." : "✓ Operação saudável hoje!"}`;

  if ((alertasHoje.count || 0) > 0) {
    const { data: contatos } = await supabase
      .from("hub_contatos_notificacao")
      .select("*")
      .eq("ativo", true)
      .eq("notificar_critico", true);

    for (const c of contatos || []) {
      if (c.tipo === "whatsapp" && process.env.EVOLUTION_API_URL) {
        try {
          await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY! },
            body: JSON.stringify({ number: c.valor, text: resumo }),
          });
        } catch (e) { console.error("Erro resumo noite:", e); }
      }
    }
  }

  return { resumo, leads: leadsHoje.count, encaminhados: encHoje.count, alertas: alertasHoje.count };
}

export async function GET(request: NextRequest) {
  const ciclo = request.nextUrl.searchParams.get("ciclo") || "trafego";
  const secret = request.headers.get("x-cron-secret") || request.nextUrl.searchParams.get("secret");

  if (secret !== CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    let resultado;
    if (ciclo === "trafego") resultado = await cicloTrafego();
    else if (ciclo === "analise_manha") resultado = await cicloAnaliseManha();
    else if (ciclo === "analise_noite") resultado = await cicloAnaliseNoite();
    else resultado = {};

    return NextResponse.json({ ok: true, ciclo, resultado });
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : "Erro" }, { status: 500 });
  }
}

export const POST = GET;
