import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { tenantScopeOrFilter } from "@/lib/tenant-default";
import { whatsappConfigured, whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import { crmApiConfigError, resolveCallerAuthId } from "@/lib/crm/crm-api-auth";
import {
  crmHandoffDb,
  resolveOperador,
  tokenUazapiPorAgente,
} from "@/lib/crm/atendimento-handoff";
import { registrarEvento } from "@/lib/crm/registrar-evento";

function onlyDigits(s: string): string {
  return s.replace(/\D/g, "");
}

function allowWhatsappDryRun(): boolean {
  return process.env.NODE_ENV === "development" || process.env.WHATSAPP_DRY_RUN === "1";
}

export async function POST(request: NextRequest) {
  const configErr = crmApiConfigError();
  if (configErr) return configErr;

  // Identidade do operador (obrigatória) — cookie de sessão VALIDADO na fonte (Supabase)
  const authId = await resolveCallerAuthId(request);
  if (!authId) {
    return NextResponse.json(
      { error: "Sessão inválida ou identidade ausente." },
      { status: 401 }
    );
  }

  let body: { leadId?: string; texto?: string };
  try {
    body = (await request.json()) as { leadId?: string; texto?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  const texto = body.texto?.trim();
  if (!leadId || !texto) {
    return NextResponse.json({ error: "leadId e texto são obrigatórios" }, { status: 400 });
  }

  const supabase = crmHandoffDb();

  // Resolve operador
  const operador = await resolveOperador(supabase, authId);
  if (!operador) {
    return NextResponse.json(
      { error: "Utilizador não encontrado ou conta inativa." },
      { status: 403 }
    );
  }

  // Busca lead: telefone, humano_responsavel, agente_responsavel — escopada ao tenant
  // do operador (defesa em profundidade cross-tenant; legado sem tenant_id incluso).
  const { data: lead, error: leadErr } = await supabase
    .from("hub_leads_crm")
    .select("id, telefone, humano_responsavel, agente_responsavel")
    .eq("id", leadId)
    .or(tenantScopeOrFilter(operador.tenantId))
    .maybeSingle();

  if (leadErr) {
    return NextResponse.json({ error: leadErr.message }, { status: 500 });
  }
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  // Verifica se este operador está autorizado (tem o humano_responsavel ou é admin)
  const humanoAtual =
    typeof lead.humano_responsavel === "string" ? lead.humano_responsavel.trim() : "";
  if (!humanoAtual) {
    return NextResponse.json(
      { error: "Atendimento humano não assumido para este lead." },
      { status: 403 }
    );
  }
  // Operador diferente só pode enviar se for admin/owner
  if (
    humanoAtual !== operador.slug &&
    operador.role !== "owner" &&
    operador.role !== "admin"
  ) {
    return NextResponse.json(
      { error: `Lead está sob atendimento de outro operador (${humanoAtual}).` },
      { status: 403 }
    );
  }

  const telefone = onlyDigits(lead.telefone || "");
  if (!telefone) {
    return NextResponse.json({ error: "Lead sem telefone válido" }, { status: 400 });
  }

  // Resolve token WhatsApp: token do agente responsável pelo lead ou variável global
  const agenteSlug = typeof lead.agente_responsavel === "string" ? lead.agente_responsavel.trim() : "";
  const instanceToken = agenteSlug
    ? await tokenUazapiPorAgente(supabase, agenteSlug)
    : null;

  let sendSkipped = false;
  let sendInfo: { skipped?: boolean; status?: number; body?: unknown; provider?: string } = {};

  if (!whatsappConfigured({ instanceToken })) {
    if (!allowWhatsappDryRun()) {
      return NextResponse.json(
        {
          error:
            "WhatsApp não configurado: defina UAZAPI_BASE_URL + token da instância do agente ou UAZAPI_INSTANCE_TOKEN",
        },
        { status: 502 }
      );
    }
    sendSkipped = true;
    sendInfo = { skipped: true };
  } else {
    const envio = await whatsappSendText(telefone, texto, { instanceToken });
    if (!envio.ok) {
      return NextResponse.json(
        { error: envio.error, status: envio.status, body: envio.body },
        { status: 502 }
      );
    }
    sendInfo = { status: envio.status, body: envio.body, provider: envio.provider };
  }

  const agora = new Date().toISOString();
  const tenantId = operador.tenantId;

  const filaMetadata = sendSkipped
    ? { origem: "crm_atendimento", whatsapp_skipped: true, motivo: "provedor_ausente_ou_dry_run" }
    : {
        origem: "crm_atendimento",
        operador_nome: operador.nome,
        ...(sendInfo.provider ? { whatsapp_provider: sendInfo.provider } : {}),
        ...(agenteSlug ? { agente_instancia: agenteSlug } : {}),
      };

  const { error: filaErr } = await supabase.from("hub_fila_mensagens").insert({
    lead_id: leadId,
    agente_id: operador.slug,
    remetente_numero: telefone,
    canal: "whatsapp",
    direcao: "saida",
    conteudo: texto,
    status: sendSkipped ? "pendente" : "enviado",
    tenant_id: tenantId,
    resposta_enviada: !sendSkipped,
    enviada_em: sendSkipped ? null : agora,
    metadata: filaMetadata,
  });

  if (filaErr) {
    return NextResponse.json(
      {
        error: sendSkipped
          ? `Não foi possível gravar a mensagem na fila: ${filaErr.message}`
          : `Mensagem enviada ao WhatsApp, mas falha ao gravar fila: ${filaErr.message}`,
      },
      { status: 500 }
    );
  }

  await supabase.from("hub_atividades").insert({
    lead_id: leadId,
    tipo: "mensagem",
    descricao: texto.slice(0, 500),
    feito_por: operador.slug,
    feito_por_tipo: "humano",
    metadata: { origem: "crm_atendimento", operador_nome: operador.nome },
    tenant_id: tenantId,
  });

  await supabase
    .from("hub_leads_crm")
    .update({ ultimo_contato: agora, atualizado_em: agora })
    .eq("id", leadId)
    .or(tenantScopeOrFilter(tenantId));

  // Keystone F4 (hub_eventos): instrumentação best-effort — nunca bloqueia o envio da mensagem.
  await registrarEvento(supabase, {
    event_type: "mensagem_enviada",
    entity_type: "lead",
    entity_id: leadId,
    lead_id: leadId,
    ator: operador.slug,
    payload: { canal: "whatsapp", skipped: sendSkipped },
    tenant_id: tenantId,
  });

  return NextResponse.json({
    ok: true,
    whatsappSkipped: sendSkipped,
    whatsapp: sendInfo,
    operadorSlug: operador.slug,
    operadorNome: operador.nome,
  });
}
