import { NextRequest, NextResponse } from "next/server";
import { crmDb as db } from "@/lib/crm/supabase-server";
import { createHmac, timingSafeEqual } from "crypto";
import { identificarMercado, identificarIntencao } from "@/lib/ia/agentes-config";
import { whatsappSendText } from "@/lib/whatsapp/whatsapp-send";
import { resolverLinhaWhatsAppInbound } from "@/lib/whatsapp/resolver-linha-whatsapp";
import {
  extractWebhookInstanceRefs,
  normalizeWebhookInstanceId,
  parseWhatsappWebhookBody,
} from "@/lib/whatsapp/webhook-inbound";
import { webhookSecretQueryParam } from "@/lib/whatsapp/webhook-auth";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import {
  mergeMetadataWhatsapp,
  montarPatchContatoWhatsapp,
  pushNameParaNomeExibicao,
} from "@/lib/crm/sincronizar-contato-whatsapp";
import { telefoneConversaId, telefonesConversaEquivalentes } from "@/lib/crm/isolamento-conversa-lead";
import { garantirCodigoLead, prepararRowHubLeadInsert } from "@/lib/crm/lead-cadastro";
import { mercadoWhatsappParaPrefixo } from "@/lib/crm/lead-routing-rules";
import { resolverDestinoLead } from "@/lib/crm/lead-routing-config";
import { enriquecerLeadComPipeline } from "@/lib/crm/resolve-pipeline";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";
import { createWhatsappWebhookTrace } from "@/lib/observability/whatsapp-webhook-trace";
import { dispararProcessamentoJobsWhatsapp } from "@/lib/whatsapp/trigger-job-processor";
import { runWhatsappWorkerTick } from "@/lib/workers/whatsapp-job-worker";
import { supersedeJobsAntigosMesmoTelefone } from "@/lib/whatsapp/supersede-jobs-antigos";
import { ativarAtendimentoHumanoPorMensagemDoCelular } from "@/lib/whatsapp/human-handoff-from-device";
import { iaRateLimitExcedido } from "@/lib/ia/rate-limit-ia";

let warnedMissingWebhookSecret = false;
const WEBHOOK_DEDUPE_TTL_MS = 2 * 60 * 1000;
const webhookRecentKeys = new Map<string, number>();

function limparDedupeExpirados(nowMs: number) {
  for (const [k, ts] of webhookRecentKeys.entries()) {
    if (nowMs - ts > WEBHOOK_DEDUPE_TTL_MS) webhookRecentKeys.delete(k);
  }
}

function marcarWebhookDedupe(messageId: string | null | undefined, telefone: string): boolean {
  const mid = messageId?.trim();
  if (!mid) return false;
  const now = Date.now();
  limparDedupeExpirados(now);
  const key = `${telefone}|${mid}`;
  if (webhookRecentKeys.has(key)) return true;
  webhookRecentKeys.set(key, now);
  return false;
}

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Verifica origem do webhook quando WEBHOOK_SECRET está definido (HMAC ou segredo em header/Bearer). */
export function webhookAutenticado(request: NextRequest, rawBody: string, secret: string): boolean {
  const sig =
    request.headers.get("x-hub-signature-256") ||
    request.headers.get("x-signature");

  if (sig) {
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    let incoming = sig.trim();
    if (incoming.startsWith("sha256=")) incoming = incoming.slice(7);
    try {
      const a = Buffer.from(incoming, "hex");
      const b = Buffer.from(expectedHex, "hex");
      if (a.length === b.length && a.length > 0) return timingSafeEqual(a, b);
    } catch {
      /* fallthrough */
    }
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (timingSafeStringEqual(token, secret)) return true;
  }

  const headerName = (process.env.WEBHOOK_SECRET_HEADER || "x-webhook-secret").toLowerCase();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === headerName && timingSafeStringEqual((value || "").trim(), secret)) {
      return true;
    }
  }

  const qp = webhookSecretQueryParam().toLowerCase();
  const fromQuery = request.nextUrl.searchParams.get(qp)?.trim();
  if (fromQuery && timingSafeStringEqual(fromQuery, secret)) return true;

  return false;
}

async function encontrarOuCriarPessoa(telefone: string, nome: string, origem: string) {
  const supabase = db();

  // Telefone CANÔNICO (só dígitos, E.164 sem +): a MESMA forma na busca e na gravação.
  // Sem isto, um cadastro manual (com máscara/+55) e o auto-cadastro do WhatsApp
  // (só dígitos) viram 2 pessoas para o mesmo número.
  const telCanonico = telefoneConversaId(telefone);

  const buscarPorTelefone = async () =>
    (
      await supabase
        .from("hub_pessoas")
        .select("*")
        .eq("telefone", telCanonico)
        .maybeSingle()
    ).data;

  const pessoaExistente = await buscarPorTelefone();
  if (pessoaExistente) return pessoaExistente;

  const codigo = await gerarCodigoPessoa(supabase);

  const nomePessoa = pushNameParaNomeExibicao(nome) || nome?.trim() || "Lead WhatsApp";

  const { data: novaPessoa, error } = await supabase
    .from("hub_pessoas")
    .insert({
      codigo,
      nome: nomePessoa,
      telefone: telCanonico,
      whatsapp_id: telCanonico,
      tipo: "lead",
      origem: origem || "whatsapp",
      tenant_id: defaultTenantId(),
    })
    .select()
    .single();

  // Corrida / telefone já existente noutro formato: o UNIQUE bate (23505) e o insert
  // devolve null. Re-buscar a pessoa existente em vez de seguir com pessoa nula.
  if (error) {
    if ((error as { code?: string }).code === "23505") {
      const reencontrada = await buscarPorTelefone();
      if (reencontrada) return reencontrada;
    }
    console.error("[WEBHOOK] Erro ao criar pessoa:", error.message ?? error);
    return null;
  }

  return novaPessoa;
}

async function enviarMensagemWhatsApp(
  telefone: string,
  mensagem: string,
  opts?: { instanceToken?: string | null }
) {
  const r = await whatsappSendText(telefone, mensagem, { instanceToken: opts?.instanceToken });
  if (!r.ok) {
    console.error("[WEBHOOK] Erro ao enviar mensagem:", r.provider, r.error, r.status, r.body);
    return {
      ok: false as const,
      provider: r.provider ?? null,
      status: r.status ?? null,
      error: r.error,
      body: r.body ?? null,
    };
  }
  return {
    ok: true as const,
    provider: r.provider,
    status: r.status,
    body: r.body ?? null,
  };
}

async function mensagemWebhookJaProcessada(
  supabase: ReturnType<typeof db>,
  opts: { messageId?: string | null; telefone: string }
): Promise<boolean> {
  const mid = opts.messageId?.trim();
  if (!mid) return false;

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .select("id")
    .eq("canal", "whatsapp")
    .eq("message_id", mid)
    .eq("telefone", opts.telefone)
    .limit(1);

  if (error) {
    console.error("[WEBHOOK] Erro ao deduplicar message_id:", error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function encontrarOuCriarLead(telefone: string, nome: string, mercado: string, mensagem: string) {
  const supabase = db();
  const tel = telefoneConversaId(telefone);
  if (tel.length < 10) {
    return { lead: null, isNovo: false as const, pessoaId: null as string | null };
  }

  const pessoa = await encontrarOuCriarPessoa(tel, nome, "whatsapp");

  const { data: leadExistente } = await supabase
    .from("hub_leads_crm")
    .select("*")
    .eq("telefone", tel)
    .maybeSingle();

  if (leadExistente) {
    const waPatch = montarPatchContatoWhatsapp(leadExistente as Record<string, unknown>, {
      telefone: tel,
      pushName: nome,
      mercado,
    });
    const leadUpdate = {
      ...waPatch,
      pessoa_id: pessoa?.id ?? leadExistente.pessoa_id,
      tenant_id: leadExistente.tenant_id || defaultTenantId(),
      metadata: mergeMetadataWhatsapp(
        {
          ...(typeof leadExistente.metadata === "object" && leadExistente.metadata !== null
            ? (leadExistente.metadata as Record<string, unknown>)
            : {}),
          mercado,
          fase_atendimento: "conversa_ia",
        },
        { telefone: tel, pushName: nome, mercado }
      ),
    };
    let upd = await supabase.from("hub_leads_crm").update(leadUpdate).eq("id", leadExistente.id);
    if (upd.error && isMissingPgColumn(upd.error, "tenant_id")) {
      const { tenant_id: _t, ...semTenant } = leadUpdate;
      upd = await supabase.from("hub_leads_crm").update(semTenant).eq("id", leadExistente.id);
    }

    const { data: leadAtualizado } = await supabase
      .from("hub_leads_crm")
      .select("*")
      .eq("id", leadExistente.id)
      .maybeSingle();

    const leadFinal = leadAtualizado ?? leadExistente;
    await garantirCodigoLead(supabase, {
      id: leadFinal.id as string,
      codigo: (leadFinal as { codigo?: string | null }).codigo,
    });

    return {
      lead: leadFinal,
      isNovo: false,
      pessoaId: pessoa?.id ?? leadExistente.pessoa_id,
    };
  }

  const mercadoPrefix = mercadoWhatsappParaPrefixo(mercado);
  const agenteResponsavel = await resolverDestinoLead(supabase, {
    origem: "whatsapp",
    origem_cadastro: "whatsapp",
    mercados: [mercadoPrefix],
  });

  const nomeLead = pushNameParaNomeExibicao(nome) || `Lead ${tel.slice(-4)}`;

  const pessoaCodigo =
    pessoa && typeof pessoa === "object" && "codigo" in pessoa && pessoa.codigo != null
      ? String(pessoa.codigo)
      : null;

  const baseRow = await prepararRowHubLeadInsert(
    supabase,
    {
      nome: nomeLead,
      telefone: tel,
      origem: "whatsapp",
      estagio: "novo",
      score: 10,
      valor_estimado: 0,
      agente_responsavel: agenteResponsavel,
      pessoa_id: pessoa?.id ?? null,
      tenant_id: defaultTenantId(),
      metadata: mergeMetadataWhatsapp(
        {
          mercado,
          mercado_principal: mercadoPrefix,
          mercados: [mercadoPrefix],
          fase_atendimento: "conversa_ia",
          origem_cadastro: "whatsapp",
          primeira_mensagem: mensagem.slice(0, 200),
        },
        { telefone: tel, pushName: nome, mercado }
      ),
    },
    { pessoa_codigo: pessoaCodigo }
  );

  const rowNovoLead = await enriquecerLeadComPipeline(supabase, baseRow, mercadoPrefix);

  const { data: novoLead, error } = await supabase
    .from("hub_leads_crm")
    .insert(rowNovoLead)
    .select()
    .single();

  if (error || !novoLead) {
    console.error("[WEBHOOK] Erro ao criar lead:", error);
    return { lead: null, isNovo: false as const, pessoaId: null as string | null };
  }

  await supabase.from("hub_atividades").insert({
      lead_id: novoLead.id,
      tipo: "mensagem",
    descricao: `Contacto WhatsApp iniciado — mercado: ${mercado}`,
      feito_por: "sistema",
      feito_por_tipo: "ia",
      metadata: { telefone, mercado, primeira_mensagem: true },
  });

  return { lead: novoLead, isNovo: true, pessoaId: pessoa?.id ?? null };
}

type EnqueueWhatsappJobInput = {
  tenantId: string;
  telefone: string;
  leadId: string;
  agenteSlug: string;
  messageId: string;
  payload: Record<string, unknown>;
};

/**
 * Enfileira no hub_msg_jobs para processamento assíncrono pelo worker.
 * O processamento legado in-request foi removido da rota.
 */
async function enqueueWhatsappJob(
  supabase: ReturnType<typeof db>,
  input: EnqueueWhatsappJobInput
): Promise<"accepted" | "duplicate"> {
  const jobRow = {
    tenant_id: input.tenantId,
      canal: "whatsapp",
    telefone: input.telefone,
    lead_id: input.leadId,
    agente_slug: input.agenteSlug,
    message_id: input.messageId,
    payload: input.payload,
  };

  const { data, error } = await supabase
    .from("hub_msg_jobs")
    .upsert(jobRow, { onConflict: "canal,message_id", ignoreDuplicates: true })
    .select("id")
    .maybeSingle();

  if (error) throw error;
  if (data?.id) {
    await supersedeJobsAntigosMesmoTelefone(supabase, input.telefone, data.id);
  }
  return data?.id ? "accepted" : "duplicate";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hub_mode      = searchParams.get("hub.mode");
  const hub_token     = searchParams.get("hub.verify_token");
  const hub_challenge = searchParams.get("hub.challenge");

  if (hub_mode === "subscribe") {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (expected && hub_token === expected && hub_challenge) {
      return new NextResponse(hub_challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ status: "ok", service: "obra10plus-webhook", version: "2.0" });
}

export async function POST(request: NextRequest) {
  const trace = createWhatsappWebhookTrace(request);
  const { log } = trace;

  try {
    const rawBody = await request.text();
    log.info("wa.webhook.body_read", { body_bytes: rawBody.length });

    const skipVerify = process.env.NODE_ENV !== "production" && process.env.WEBHOOK_SKIP_SIGNATURE_VERIFY === "true";
    const secret = process.env.WEBHOOK_SECRET?.trim();

    if (process.env.NODE_ENV === "production" && !secret) {
      log.error("wa.webhook.config_missing", { field: "WEBHOOK_SECRET" });
      return trace.json({ error: "Webhook não configurado" }, 500, "config_missing");
    }

    if (secret && !skipVerify) {
      if (!webhookAutenticado(request, rawBody, secret)) {
        log.warn("wa.webhook.auth_failed", {
          has_signature_header: Boolean(
            request.headers.get("x-hub-signature-256") || request.headers.get("x-signature")
          ),
          has_bearer: Boolean(request.headers.get("authorization")?.startsWith("Bearer ")),
          has_query_wh: request.nextUrl.searchParams.has(webhookSecretQueryParam()),
        });
        return trace.json(
          {
            error: "Não autorizado",
            code: "WEBHOOK_AUTH_FAILED",
            message:
              "Falha na verificação do webhook (HMAC SHA-256 ou credencial Bearer/cabeçalho não confere com WEBHOOK_SECRET).",
          },
          401,
          "auth_failed"
        );
      }
      log.info("wa.webhook.auth_ok");
    } else if (!secret && !skipVerify) {
      if (!warnedMissingWebhookSecret) {
        warnedMissingWebhookSecret = true;
        log.warn("wa.webhook.auth_disabled", {
          hint: "Defina WEBHOOK_SECRET ou use WEBHOOK_SKIP_SIGNATURE_VERIFY=true só em dev",
        });
      }
    } else if (skipVerify) {
      log.warn("wa.webhook.auth_skipped_dev");
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return trace.json({ error: "JSON inválido" }, 400, "invalid_json");
    }

    const supabase = db();

    const inbound = parseWhatsappWebhookBody(body);
    if (inbound.kind === "outgoing_human") {
      const outbound = inbound.value;
      const telefoneLead = telefoneConversaId(outbound.telefone);
      if (telefoneLead.length < 10) {
        return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
      }

      // Comando /pausa | /retoma pelo celular do dono (ANTES do handoff). Pausa por TELEFONE — funciona mesmo sem lead no CRM.
      // "/pausa" sozinho pausa o número do chat atual; "/pausa 11 98888-7777" pausa o número citado. /retoma desfaz e devolve à IA.
      const { parseComandoPausa, pausarTelefone, retomarTelefone } = await import("@/lib/whatsapp/pausa-atendimento");
      const comando = parseComandoPausa(outbound.mensagemFinal || "", telefoneLead);
      if (comando) {
        const acao = comando.acao;
        const alvo = comando.alvo;
        const alvoMasc = `***${alvo.slice(-4)}`;
        let ok = false;
        let erro: string | null = null;

        if (acao === "pausa") {
          const r = await pausarTelefone(supabase, { telefone: alvo, fonte: "comando", motivo: "comando_celular", criadoPor: "wendel" });
          ok = r.ok;
          erro = r.ok ? null : r.error ?? "falha ao pausar";
          if (r.ok) {
            try {
              const { cancelarJobsIaPendentesTelefone } = await import("@/lib/whatsapp/human-handoff-from-device");
              await cancelarJobsIaPendentesTelefone(supabase, alvo);
            } catch {
              /* best-effort: cancelar jobs pendentes não é crítico */
            }
          }
        } else {
          const r = await retomarTelefone(supabase, { telefone: alvo });
          ok = r.ok;
          erro = r.ok ? null : r.error ?? "falha ao retomar";
          if (r.ok) {
            // Devolve à IA: limpa humano_responsavel por EQUIVALÊNCIA de sufixo-11 (não só igualdade
            // exata do telefone) — cobre lead cadastrado noutro formato (laudo Fable, Médio 8).
            try {
              const { telefonesConversaEquivalentes } = await import("@/lib/crm/isolamento-conversa-lead");
              const { data: leadsCand } = await supabase
                .from("hub_leads_crm")
                .select("id, telefone")
                .not("humano_responsavel", "is", null)
                .limit(300);
              const ids = (Array.isArray(leadsCand) ? leadsCand : [])
                .filter((l) => telefonesConversaEquivalentes(String((l as { telefone?: string }).telefone ?? ""), alvo))
                .map((l) => (l as { id: string }).id);
              if (ids.length) await supabase.from("hub_leads_crm").update({ humano_responsavel: null }).in("id", ids);
            } catch {
              /* best-effort */
            }
          }
        }

        // Feedback DURÁVEL ao dono no painel. Não mandamos WhatsApp de confirmação: no fromMe o
        // "telefone" é o OUTRO lado do chat (pode ser um cliente) — risco de mensagem indevida.
        // Em falha o alerta é CRÍTICO para o dono não achar que pausou sem ter pausado (laudo, Alto 4).
        try {
          await supabase.from("hub_alertas").insert({
            tipo: ok ? "info" : "critico",
            agente_slug: "atendimento_pausa",
            titulo: ok
              ? `IA ${acao === "pausa" ? "pausada" : "retomada"} para ${alvoMasc}`
              : `FALHA no comando /${acao} (${alvoMasc})`,
            mensagem: ok
              ? `Comando /${acao} pelo celular aplicado (${alvoMasc}).`
              : `Comando /${acao} pelo celular FALHOU (${alvoMasc}): ${erro}. A IA pode continuar ${acao === "pausa" ? "respondendo" : "pausada"} — verifique.`,
            dados: { acao, alvo_masc: alvoMasc, ok, erro },
          });
        } catch {
          /* best-effort: alerta não pode derrubar o webhook */
        }

        log.info("wa.webhook.comando_pausa", { acao, alvo_masc: alvoMasc, ok, erro });
        return trace.json({ status: "comando_pausa", acao, alvo_masc: alvoMasc, ok }, 200, "comando_pausa");
      }

      const handoff = await ativarAtendimentoHumanoPorMensagemDoCelular(supabase, {
        telefone: telefoneLead,
        mensagem: outbound.mensagemFinal,
        messageId: outbound.messageId || null,
        timestamp: outbound.timestamp,
      });

      log.info("wa.webhook.human_takeover_from_device", {
        telefone: trace.maskTelefone(telefoneLead),
        ok: handoff.ok,
        lead_id: handoff.leadId ?? null,
        humano_slug: handoff.humanoSlug,
        jobs_cancelados: handoff.jobsCancelados,
        motivo: handoff.motivo ?? null,
        message_id: outbound.messageId || null,
      });

      return trace.json(
        {
          status: handoff.ok ? "human_takeover" : "human_takeover_skipped",
          lead_id: handoff.leadId ?? null,
          humano_slug: handoff.humanoSlug,
          jobs_cancelados: handoff.jobsCancelados,
          motivo: handoff.motivo ?? null,
        },
        200,
        handoff.ok ? "human_takeover_ok" : "human_takeover_skipped"
      );
    }
    if (inbound.kind === "ignored") {
      log.info("wa.webhook.parse_ignored", {
        reason: inbound.status,
        event:
          typeof body.event === "string"
            ? body.event
            : typeof body.EventType === "string"
              ? body.EventType
              : undefined,
        top_keys: Object.keys(body).slice(0, 24),
        data_kind: Array.isArray(body.data) ? "array" : typeof body.data,
      });
      return trace.json({ status: inbound.status }, 200, "parse_ignored");
    }
    if (inbound.kind === "unknown_event") {
      log.info("wa.webhook.unknown_event", { event: inbound.event });
      return trace.json({ status: "ignored", event: inbound.event }, 200, "unknown_event");
    }

    const inboundRaw = inbound.value;
    const telefone = telefoneConversaId(inboundRaw.telefone);
    const {
      pushName,
      messageId,
      timestamp,
      tipoMidia,
      mensagemFinal,
      menuChoiceId,
      instance,
    } = inboundRaw;

    if (telefone.length < 10) {
      return trace.json({ status: "ignored", reason: "invalid_phone" }, 200, "invalid_phone");
    }

    const refs = extractWebhookInstanceRefs(body);
    const instanceKey = instance ?? refs.instanceId ?? normalizeWebhookInstanceId(body);
    const linhaWa = await resolverLinhaWhatsAppInbound(supabase, instanceKey, {
      instanceToken: refs.instanceToken,
      instanceName: refs.instanceName,
    });
    if (linhaWa.kind === "ignored") {
      log.warn("wa.webhook.resolver_ignored", {
        reason: linhaWa.reason,
        instance_id: instanceKey || null,
        has_instance_token: Boolean(refs.instanceToken),
      });
      return trace.json({ status: "ignored", reason: linhaWa.reason }, 200, "resolver_ignored", {
        reason: linhaWa.reason,
      });
    }

    const waSendOpts =
      linhaWa.kind === "agent_instance"
        ? { instanceToken: linhaWa.instanceToken as string }
        : {};

    log.info("wa.webhook.message_inbound", {
      telefone: trace.maskTelefone(telefone),
      push_name: pushName || null,
      message_id: messageId || null,
      preview: mensagemFinal.slice(0, 80),
      instance_id: instanceKey || null,
      linha_kind: linhaWa.kind,
      agente_slug: linhaWa.kind === "agent_instance" ? linhaWa.agenteSlug : null,
    });

    if (marcarWebhookDedupe(messageId, telefone)) {
      log.info("wa.webhook.duplicate_ignored_memory", {
        telefone: trace.maskTelefone(telefone),
        message_id: messageId || null,
      });
      return trace.json({ status: "ignored", reason: "duplicate_message_id_memory" }, 200, "duplicate_ignored");
    }

    if (await mensagemWebhookJaProcessada(supabase, { messageId, telefone })) {
      log.info("wa.webhook.duplicate_ignored", {
        telefone: trace.maskTelefone(telefone),
        message_id: messageId || null,
      });
      return trace.json({ status: "ignored", reason: "duplicate_message_id" }, 200, "duplicate_ignored");
    }

    // Teto anti-flood por REMETENTE, ANTES de qualquer processamento pesado / enfileirar job de IA
    // (cada job aciona LLM pago no worker). Colocado APÓS o dedup para que retries legítimos do
    // provedor (mesmo message_id, já descartados acima) não gastem o orçamento do remetente.
    // Responde 200 "ignored" de propósito: um 4xx dispararia retry-storm no WhatsApp/provedor.
    if (iaRateLimitExcedido(`wa-inbound:${telefone}`, 20)) {
      log.warn("wa.webhook.rate_limited", {
        telefone: trace.maskTelefone(telefone),
        message_id: messageId || null,
      });
      return trace.json({ status: "ignored", reason: "rate_limited" }, 200, "rate_limited");
    }

    const intencao = identificarIntencao(mensagemFinal);
    const mercado = identificarMercado(mensagemFinal);

    // P0-1: só desvia para o fluxo de PARCEIRO se NÃO existir lead para este número. Com um lead ativo,
    // uma frase de parceria no meio da conversa NÃO sequestra o atendimento — a Mari continua respondendo.
    let desviarParaParceiro = intencao === "parceiro";
    if (desviarParaParceiro) {
      const sufixoTel = telefone.slice(-8);
      if (sufixoTel.length >= 8) {
        const { data: leadsMesmoTel } = await supabase
          .from("hub_leads_crm")
          .select("id, telefone")
          .like("telefone", `%${sufixoTel}`)
          .limit(5);
        if (
          Array.isArray(leadsMesmoTel) &&
          leadsMesmoTel.some((l) =>
            telefonesConversaEquivalentes(telefone, String((l as { telefone?: string }).telefone ?? ""))
          )
        ) {
          desviarParaParceiro = false; // já é um lead nosso — atende, não desvia
        }
      }
    }

    // Roteamento para parceiro (só primeiro contato, sem lead ativo — ver P0-1 acima)
    if (desviarParaParceiro) {
      const telLimpo = telefone.replace(/\D/g, "");
      // Lookup ESCOPADO ao tenant (não mistura parceiros entre escritórios). Fallback
      // p/ schema legado sem a coluna tenant_id — mesmo padrão isMissingPgColumn do insert.
      let parceiroLookup = await supabase
        .from("hub_parceiros")
        .select("id, nome, status, modulo_atual")
        .eq("telefone", telLimpo)
        .eq("tenant_id", defaultTenantId())
        .maybeSingle();
      if (parceiroLookup.error && isMissingPgColumn(parceiroLookup.error, "tenant_id")) {
        parceiroLookup = await supabase
          .from("hub_parceiros")
          .select("id, nome, status, modulo_atual")
          .eq("telefone", telLimpo)
          .maybeSingle();
      }
      const parceiroExistente = parceiroLookup.data;

      if (!parceiroExistente) {
        const parceiroRow = {
          nome: pushName || `Parceiro ${telLimpo.slice(-4)}`,
          telefone: telLimpo,
          status: "captacao",
          tenant_id: defaultTenantId(),
        };
        let parIns = await supabase.from("hub_parceiros").insert(parceiroRow).select("id").single();
        if (parIns.error && isMissingPgColumn(parIns.error, "tenant_id")) {
          const { tenant_id: _t, ...semTenant } = parceiroRow;
          parIns = await supabase.from("hub_parceiros").insert(semTenant).select("id").single();
        }
        const { data: novoParceiro } = parIns;

        if (novoParceiro) {
          await supabase.from("hub_parceiros_captacao").insert({
            parceiro_id: novoParceiro.id,
            estagio: "interessado",
            origem: "whatsapp",
            canal: "whatsapp",
          });
          await supabase.from("hub_parceiros_log").insert({
            parceiro_id: novoParceiro.id,
            evento: "captado_via_whatsapp",
            descricao: `Parceiro captado via WhatsApp — mensagem: "${mensagemFinal.slice(0, 100)}"`,
            feito_por: "webhook",
            feito_por_tipo: "sistema",
            dados: { telefone: telLimpo, pushName, mensagem: mensagemFinal.slice(0, 200) },
          });

          const boas_vindas = `Olá${pushName ? `, ${pushName.split(" ")[0]}` : ""}! 👋\n\nQue ótimo que você tem interesse em ser parceiro da Obra10+!\n\nVou te enviar o link de cadastro em instantes. Um de nossos consultores também vai entrar em contato para explicar como funciona o programa.\n\nAté já! 🏆`;
          await enviarMensagemWhatsApp(telefone, boas_vindas, waSendOpts);
        }
      }

      await supabase.from("hub_alertas").insert({
        agente_slug: "diretor_geral_ia",
        tipo: "importante",
        titulo: "Novo interesse de parceiro via WhatsApp",
        mensagem: `${pushName || telefone} perguntou sobre parceria: "${mensagemFinal.slice(0, 80)}"`,
        lead_id: null,
        dados: { telefone, pushName, mensagem: mensagemFinal },
      });

      return trace.json({ status: "ok", intencao: "parceiro", telefone: trace.maskTelefone(telefone) }, 200, "parceiro_ok");
    }

    const { lead, isNovo, pessoaId } = await encontrarOuCriarLead(telefone, pushName, mercado, mensagemFinal);

    if (!lead) {
      log.error("wa.webhook.lead_failed", { telefone: trace.maskTelefone(telefone), mercado });
      return trace.json({ status: "erro", erro: "Falha ao criar lead", code: "LEAD_CREATE_FAILED" }, 500, "lead_failed");
    }

    log.info("wa.webhook.lead_ok", { lead_id: lead.id, is_novo: isNovo, mercado });

    let agenteResponsavelLead =
      typeof lead.agente_responsavel === "string" && lead.agente_responsavel.trim()
        ? lead.agente_responsavel.trim()
        : "sdr";

    if (linhaWa.kind === "agent_instance") {
      agenteResponsavelLead = linhaWa.agenteSlug;
      await supabase.from("hub_leads_crm").update({ agente_responsavel: linhaWa.agenteSlug }).eq("id", lead.id);
    }

    const agenteSlugHint = linhaWa.kind === "agent_instance" ? linhaWa.agenteSlug : agenteResponsavelLead;
    const messageIdParaFila = (messageId || "").trim();
    if (!messageIdParaFila) {
      log.warn("wa.webhook.message_missing_id", { telefone: trace.maskTelefone(telefone) });
      return trace.json({ status: "ignored", reason: "missing_message_id" }, 200, "missing_message_id");
    }

    if (isNovo) {
      try {
        const { data: contatos } = await supabase
          .from("hub_contatos_notificacao")
          .select("telefone, receber_novo_lead, canal")
          .eq("ativo", true)
          .eq("receber_novo_lead", true);

        if (contatos && contatos.length > 0) {
          const msg = `🔔 *Novo lead recebido!*\n\n*Nome:* ${pushName || telefone}\n*Mercado:* ${mercado}\n*Mensagem:* ${mensagemFinal.slice(0, 100)}\n\nAcesse o CRM para acompanhar.`;
          await Promise.allSettled(
            contatos
              .filter(c => c.canal === "whatsapp" || c.canal === "ambos")
              .map((c) => enviarMensagemWhatsApp(c.telefone, msg, waSendOpts))
          );
        }
      } catch (e) { console.error("[WEBHOOK] Erro notificação:", e); }
    }

    const enqueuePayload = {
            telefone,
            pushName,
            mercado,
      instance: instanceKey ?? null,
      instanceToken: waSendOpts.instanceToken ?? null,
            tipoMidia,
      mensagemFinal,
      menuChoiceId: menuChoiceId ?? null,
            leadId: lead.id,
      pessoaId: pessoaId ?? lead.pessoa_id ?? null,
      isNovo,
      timestamp,
      messageId: messageIdParaFila,
      agenteSlugHint,
      linhaKind: linhaWa.kind,
      hasInstanceToken: Boolean(waSendOpts.instanceToken),
    };

    const enqueueStatus = await enqueueWhatsappJob(supabase, {
      tenantId: defaultTenantId(),
            telefone,
      leadId: lead.id as string,
      agenteSlug: agenteSlugHint,
      messageId: messageIdParaFila,
      payload: enqueuePayload,
    });

    log.info("wa.webhook.job_enqueued", {
      enqueue_status: enqueueStatus,
      lead_id: lead.id,
      message_id: messageIdParaFila,
      agente_slug_hint: agenteSlugHint,
      mercado,
      is_novo: isNovo,
    });

    if (enqueueStatus === "accepted") {
      if (process.env.WHATSAPP_JOB_PROCESSOR === "worker_only") {
        dispararProcessamentoJobsWhatsapp(log);
      } else {
        void runWhatsappWorkerTick()
          .then((result) => {
            log.info("wa.webhook.job_processor_inline", {
              claimed: result.claimed,
              ok: !result.error,
              error: result.error ?? null,
            });
          })
          .catch((e) => {
            const msg = e instanceof Error ? e.message : String(e);
            log.warn("wa.webhook.job_processor_inline_failed", { error: msg.slice(0, 200) });
            dispararProcessamentoJobsWhatsapp(log);
          });
      }
    }

    return trace.json(
      {
        status: enqueueStatus,
        lead_id: lead.id,
        mercado,
        agente_slug_hint: agenteSlugHint,
        isNovo,
        queue: "hub_msg_jobs",
        message_id: messageIdParaFila,
      },
      200,
      enqueueStatus === "duplicate" ? "duplicate_accepted" : "accepted_async"
    );
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    log.error("wa.webhook.unhandled", { error: errMsg });
    return trace.json({ status: "erro", erro: errMsg, code: "UNHANDLED" }, 500, "unhandled_error");
  }
}
