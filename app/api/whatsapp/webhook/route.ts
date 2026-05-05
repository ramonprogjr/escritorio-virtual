import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Market identification from message content ───────────────────────────────

function identificarMercado(mensagem: string): string {
  const t = mensagem.toLowerCase();

  if (t.includes("imóvel") || t.includes("imovel") || t.includes("apartamento") ||
      t.includes("casa") || t.includes("terreno") || t.includes("imobili")) {
    return "imobiliario";
  }
  if (t.includes("arquitet") || t.includes("projeto") || t.includes("planta") ||
      t.includes("reforma") || t.includes("obra") || t.includes("construç")) {
    return "arquitetura";
  }
  if (t.includes("fornece") || t.includes("serviço") || t.includes("servico") ||
      t.includes("orçamento") || t.includes("orcamento")) {
    return "fornecedor";
  }
  if (t.includes("produto") || t.includes("comprar") || t.includes("adquirir") ||
      t.includes("quanto custa") || t.includes("valor")) {
    return "produto";
  }

  return "geral";
}

// ─── Find or create lead by phone ────────────────────────────────────────────

async function encontrarOuCriarLead(
  telefone: string,
  nome: string,
  mercado: string,
  mensagem: string
) {
  const supabase = db();

  // Check returning lead
  const { data: existente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .eq("telefone", telefone)
    .maybeSingle();

  if (existente) {
    await supabase
      .from("hub_leads_crm")
      .update({ atualizado_em: new Date().toISOString() })
      .eq("id", existente.id);

    await supabase.from("hub_atividades").insert({
      lead_id: existente.id,
      tipo: "mensagem",
      descricao: `WhatsApp: ${mensagem.slice(0, 100)}`,
      feito_por: "sistema",
      feito_por_tipo: "ia",
    });

    return { lead: existente, isNovo: false };
  }

  // Create new lead
  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert({
      nome: nome || `Lead ${telefone.slice(-4)}`,
      telefone,
      origem: "whatsapp",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: "sdr",
      metadata: { mercado, primeira_mensagem: mensagem.slice(0, 200) },
    })
    .select()
    .single();

  if (error || !novoLead) {
    throw new Error(`Falha ao criar lead: ${error?.message}`);
  }

  // Save memories using our schema (chave/valor/confianca/criado_por)
  await supabase.from("hub_memorias_lead").insert([
    {
      lead_id: novoLead.id,
      chave: "telefone",
      valor: telefone,
      confianca: 1.0,
      criado_por: "sistema",
    },
    {
      lead_id: novoLead.id,
      chave: "mercado",
      valor: mercado,
      confianca: 0.9,
      criado_por: "analise",
    },
  ]);

  await supabase.from("hub_atividades").insert({
    lead_id: novoLead.id,
    tipo: "mensagem",
    descricao: `Novo lead via WhatsApp — mercado: ${mercado}`,
    feito_por: "sistema",
    feito_por_tipo: "ia",
  });

  return { lead: novoLead, isNovo: true };
}

// ─── Find best agent for market ───────────────────────────────────────────────

async function buscarAgentePorMercado(mercado: string) {
  const supabase = db();

  // Mari handles imobiliario and arquitetura directly
  if (mercado === "imobiliario" || mercado === "arquitetura") {
    const { data: mari } = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug, nome, area, prefixo_mercado")
      .eq("agente_slug", "mari")
      .eq("ativo", true)
      .maybeSingle();

    if (mari) return mari;
  }

  // Generic: match by area field
  const { data: especifico } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, area")
    .eq("ativo", true)
    .ilike("area", `%${mercado}%`)
    .neq("agente_slug", "mari")
    .maybeSingle();

  if (especifico) return especifico;

  // Fallback: SDR
  const { data: sdr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, area")
    .eq("agente_slug", "sdr")
    .maybeSingle();

  return sdr;
}

// ─── GET — health check + Meta verification ───────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }

  return NextResponse.json({ status: "ok", service: "obra10plus-webhook" });
}

// ─── POST — Evolution API messages ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = db();

  try {
    const body = await request.json();

    // ── Evolution API format ──
    const event    = body.event as string | undefined;
    const instance = body.instance as string | undefined;
    const data     = body.data as Record<string, unknown> | undefined;

    // ── Legacy Meta format ──
    if (body.object === "whatsapp_business_account") {
      return NextResponse.json({ status: "meta_format_deprecated" });
    }

    if (event !== "messages.upsert") {
      return NextResponse.json({ status: "ignored", event });
    }

    if (!data) return NextResponse.json({ status: "no_data" });

    const key     = data.key as Record<string, unknown> | undefined;
    const msg     = data.message as Record<string, unknown> | undefined;
    const fromMe  = (key?.fromMe as boolean) || false;
    const remoteJid = (key?.remoteJid as string) || "";
    const telefone  = remoteJid.replace("@s.whatsapp.net", "").replace(/\D/g, "");
    const pushName  = (data.pushName as string) || "";
    const messageId = (key?.id as string) || "";
    const timestamp = (data.messageTimestamp as number) || Date.now();

    const texto =
      (msg?.conversation as string) ||
      ((msg?.extendedTextMessage as Record<string, unknown>)?.text as string) ||
      ((msg?.imageMessage as Record<string, unknown>)?.caption as string) ||
      "";

    if (fromMe)           return NextResponse.json({ status: "outgoing_ignored" });
    if (!telefone || !texto) return NextResponse.json({ status: "invalid_message" });

    console.log(`[WEBHOOK] ${telefone}: ${texto.slice(0, 80)}`);

    const mercado = identificarMercado(texto);
    const { lead, isNovo } = await encontrarOuCriarLead(telefone, pushName, mercado, texto);

    // Save to message queue (non-blocking — ignore if table doesn't exist yet)
    try {
      await supabase.from("hub_fila_mensagens").insert({
        lead_id:   lead.id,
        agente_id: lead.agente_responsavel || "sdr",
        canal:     "whatsapp",
        direcao:   "entrada",
        conteudo:  texto,
        status:    "pendente",
        metadata:  { telefone, pushName, messageId, timestamp, mercado, instance, isNovo },
      });
    } catch {
      // Table may not exist yet — not critical
    }

    const agente = await buscarAgentePorMercado(mercado);

    // Log IA action (non-blocking)
    try {
      await supabase.from("hub_acoes_ia").insert({
        agente_slug: agente?.agente_slug || "sdr",
        tipo:        "lead_qualificado",
        descricao:   `Mensagem recebida — mercado: ${mercado} — lead: ${isNovo ? "novo" : "retornou"}`,
        lead_id:     lead.id,
        sucesso:     true,
        metadata:    { telefone, mercado, isNovo, agente: agente?.agente_slug },
      });
    } catch {
      // Table may not exist yet — not critical
    }

    // TODO: uncomment when ready to send automatic replies
    // await processarMensagem({ leadId: lead.id, mensagem: texto, canal: "whatsapp", telefone, segmento: mercado })

    return NextResponse.json({
      status:  "ok",
      lead_id: lead.id,
      mercado,
      agente:  agente?.agente_slug,
      isNovo,
    });

  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : "Erro desconhecido";
    console.error("[WEBHOOK] Erro:", msg);
    return NextResponse.json({ status: "erro", erro: msg }, { status: 500 });
  }
}
