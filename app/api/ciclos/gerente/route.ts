import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronRequestAuthorized } from "@/lib/cron-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function cicloRelatorioManha() {
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1); ontem.setHours(0, 0, 0, 0);
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const [leadsOntem, qualificados, encaminhados, alerts] = await Promise.all([
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).gte("criado_em", ontem.toISOString()).lt("criado_em", hoje.toISOString()),
    supabase.from("hub_leads_crm").select("id", { count: "exact", head: true }).eq("estagio", "qualificado").gte("atualizado_em", ontem.toISOString()),
    supabase.from("hub_encaminhamentos").select("id", { count: "exact", head: true }).gte("enviado_em", ontem.toISOString()),
    supabase.from("hub_alertas").select("id", { count: "exact", head: true }).eq("resolvido", false),
  ]);

  const totalLeads = leadsOntem.count || 0;
  const totalQual = qualificados.count || 0;
  const totalEnc = encaminhados.count || 0;
  const totalAlerts = alerts.count || 0;
  const taxaQual = totalLeads > 0 ? Math.round((totalQual / totalLeads) * 100) : 0;

  const relatorio = `📊 *Relatório Matinal — Obra10+*
📅 ${ontem.toLocaleDateString("pt-BR")}

📥 Leads recebidos: ${totalLeads}
✅ Qualificados: ${totalQual} (${taxaQual}%)
🤝 Encaminhados: ${totalEnc}
⚠️ Alertas abertos: ${totalAlerts}

${totalAlerts > 0 ? "⚡ Há alertas pendentes no sistema." : "✓ Operação saudável ontem."}

👉 ${process.env.NEXT_PUBLIC_APP_URL || "https://escritorio-virtual-xi.vercel.app"}/crm`;

  const { data: contatos } = await supabase
    .from("hub_contatos_notificacao")
    .select("*")
    .eq("ativo", true)
    .eq("notificar_novo_lead", true);

  for (const c of contatos || []) {
    if (c.tipo === "whatsapp" && process.env.EVOLUTION_API_URL) {
      try {
        await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/obra10plus`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "apikey": process.env.EVOLUTION_API_KEY! },
          body: JSON.stringify({ number: c.valor, text: relatorio }),
        });
      } catch (e) { console.error("Erro relatório:", e); }
    }
  }

  await supabase.from("hub_alertas").insert({
    tipo: "info",
    agente_slug: "gerente_atendimento",
    titulo: `Relatório matinal — ${ontem.toLocaleDateString("pt-BR")}`,
    mensagem: relatorio,
    dados: { leads: totalLeads, qualificados: totalQual, encaminhados: totalEnc, alertas: totalAlerts },
  });

  return { relatorio, leads: totalLeads, qualificados: totalQual, encaminhados: totalEnc };
}

async function cicloSupervisao() {
  const alertas: string[] = [];

  const { data: msgsRecentes } = await supabase
    .from("hub_fila_mensagens")
    .select("lead_id, conteudo, direcao, criado_em, agente_id")
    .eq("direcao", "entrada")
    .gte("criado_em", new Date(Date.now() - 30 * 60000).toISOString());

  const palavrasReclamacao = ["péssimo", "ruim", "demora", "horrível", "absurdo", "descaso", "problema", "errado", "mentira", "cancelar"];

  for (const msg of msgsRecentes || []) {
    const conteudo = (msg.conteudo as string).toLowerCase();
    const temReclamacao = palavrasReclamacao.some(p => conteudo.includes(p));

    if (temReclamacao) {
      await supabase.from("hub_alertas").insert({
        tipo: "importante",
        agente_slug: "gerente_atendimento",
        titulo: "Possível reclamação detectada",
        mensagem: `Lead sinalizou insatisfação: "${msg.conteudo}"`,
        dados: { lead_id: msg.lead_id, mensagem: msg.conteudo },
        lead_id: msg.lead_id,
      });
      alertas.push(`Reclamação detectada: ${msg.lead_id}`);
    }
  }

  return { alertas, total: alertas.length };
}

export async function GET(request: NextRequest) {
  const ciclo = request.nextUrl.searchParams.get("ciclo") || "relatorio_manha";

  if (!cronRequestAuthorized(request)) {
    return NextResponse.json({ erro: "Não autorizado" }, { status: 401 });
  }

  try {
    let resultado;
    if (ciclo === "relatorio_manha") resultado = await cicloRelatorioManha();
    else if (ciclo === "supervisao") resultado = await cicloSupervisao();
    else resultado = {};

    return NextResponse.json({ ok: true, ciclo, resultado });
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : "Erro" }, { status: 500 });
  }
}

export const POST = GET;
