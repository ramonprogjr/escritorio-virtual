import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { gerarPlaybookViaIa } from "@/lib/playbook/gerar-fluxo-ia";
import { extrairTextoDocumentoRag } from "@/lib/hub/rag";
import { mistralTranscreverAudioBuffer } from "@/lib/whatsapp/mistral-transcribe-audio";
import { registrarConsumoIA } from "@/lib/ia/metering";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";

/** Limite de upload de documento (base64) — alinhado aos uploads de playbook. */
const MAX_DOC_BYTES = 8 * 1024 * 1024;
/** Limite de upload de áudio. */
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Decodifica um payload base64 (com ou sem prefixo data:) em Buffer, com teto de tamanho. */
function bufferDeBase64(base64: string, maxBytes: number): { ok: true; buffer: Buffer } | { ok: false; error: string } {
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64.replace(/^data:[^;]+;base64,/, ""), "base64");
  } catch {
    return { ok: false, error: "Conteúdo inválido (base64)." };
  }
  if (buffer.byteLength === 0) return { ok: false, error: "Arquivo vazio." };
  if (buffer.byteLength > maxBytes) return { ok: false, error: "Arquivo muito grande." };
  return { ok: true, buffer };
}

type DocumentoEntrada = { base64?: unknown; mimeType?: unknown; nomeArquivo?: unknown };

/** Decodifica um documento base64 e extrai o texto (PDF/DOCX/txt). */
function textoDoDocumento(
  doc: DocumentoEntrada
): { ok: true; texto: string } | { ok: false; error: string } {
  const base64 = typeof doc.base64 === "string" ? doc.base64 : "";
  if (!base64) return { ok: false, error: "Documento sem conteúdo." };
  const buf = bufferDeBase64(base64, MAX_DOC_BYTES);
  if (!buf.ok) return { ok: false, error: buf.error === "Arquivo muito grande." ? "Documento muito grande (máx. 8 MB)." : buf.error };
  return extrairTextoDocumentoRag(
    typeof doc.nomeArquivo === "string" ? doc.nomeArquivo : "documento",
    typeof doc.mimeType === "string" ? doc.mimeType : null,
    buf.buffer
  );
}

/**
 * POST { descricao: string }
 * Gera (NÃO publica) um playbook — fluxo conversacional + regras — a partir de uma descrição
 * em linguagem natural. A IA sugere; o dono revisa e publica via PUT /playbook/conteudo.
 * Debita Tijolos por fase de geração (origem="playbook_builder_ia").
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  // E-B6: guard de gestor — endpoint debita Tijolos e chama IA (custo real).
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  // Teto anti-abuso por tenant — geração multi-fase + documento/áudio (LLM pago, mais caro).
  const limite = requireIaRateLimit(`playbook-gerar-ia:${g.ctx.tenantId}`, 15);
  if (limite) return limite;

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { descricao?: unknown; documento?: unknown; audio?: unknown };
  try {
    body = (await request.json()) as {
      descricao?: unknown;
      documento?: unknown;
      audio?: unknown;
    };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const descricaoTexto = typeof body.descricao === "string" ? body.descricao.trim() : "";

  // Fonte da descrição: documento (PDF/DOCX/txt) e/ou áudio têm prioridade; texto livre complementa.
  const avisosEntrada: string[] = [];
  let descricao = descricaoTexto;

  if (body.documento && typeof body.documento === "object") {
    const ext = textoDoDocumento(body.documento as DocumentoEntrada);
    if (!ext.ok) {
      return NextResponse.json({ error: ext.error }, { status: 400 });
    }
    const doTexto = ext.texto.trim();
    descricao = descricao ? `${descricao}\n\n## Documento de referência\n${doTexto}` : doTexto;
    avisosEntrada.push("Playbook gerado a partir do documento enviado.");
  }

  if (body.audio && typeof body.audio === "object") {
    const audio = body.audio as DocumentoEntrada;
    const base64 = typeof audio.base64 === "string" ? audio.base64 : "";
    if (!base64) return NextResponse.json({ error: "Áudio sem conteúdo." }, { status: 400 });
    const buf = bufferDeBase64(base64, MAX_AUDIO_BYTES);
    if (!buf.ok) {
      return NextResponse.json(
        { error: buf.error === "Arquivo muito grande." ? "Áudio muito grande (máx. 25 MB)." : buf.error },
        { status: 400 }
      );
    }
    const tr = await mistralTranscreverAudioBuffer(
      buf.buffer,
      typeof audio.nomeArquivo === "string" ? audio.nomeArquivo : "audio-instrucao.webm",
      typeof audio.mimeType === "string" ? audio.mimeType : undefined
    );
    if (!tr.ok) {
      const amigavel =
        tr.erro === "mistral_api_key_ausente"
          ? "Transcrição de áudio indisponível (MISTRAL_API_KEY não configurada)."
          : tr.erro === "mistral_transcricao_vazia"
            ? "Não consegui entender o áudio. Tente gravar de novo, mais perto do microfone."
            : `Falha ao transcrever o áudio: ${tr.erro}`;
      return NextResponse.json({ error: amigavel }, { status: 502 });
    }
    const falado = tr.texto.trim();
    descricao = descricao ? `${descricao}\n\n## Instruções faladas (transcrição)\n${falado}` : falado;
    avisosEntrada.push(`Áudio transcrito: «${falado.slice(0, 160)}${falado.length > 160 ? "…" : ""}»`);
  }

  if (descricao.length < 12) {
    return NextResponse.json(
      { error: "Descreva (ou envie um documento com) um pouco mais de detalhe — mín. 12 caracteres de conteúdo útil." },
      { status: 400 }
    );
  }

  const supabase = db();

  // E-B6: resolve agente com tenant_id para isolar por tenant da sessão.
  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, modelo_padrao, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });

  // Isolamento de tenant: 404 se o agente pertence a outro tenant.
  const agenteRow = agente as { agente_slug: string; nome?: string | null; modelo_padrao?: string | null; tenant_id?: string | null } | null;
  if (!agenteRow) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  if (agenteRow.tenant_id != null && String(agenteRow.tenant_id) !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });
  }

  // Tenant SEMPRE da sessão — nunca do body (body.tenantId era a brecha).
  const tenantId = g.ctx.tenantId;

  const out = await gerarPlaybookViaIa({
    descricao,
    agenteNome: (agenteRow.nome as string | null) ?? slug,
    agenteSlug: slug,
    modeloFromDb: (agenteRow.modelo_padrao as string | null) ?? undefined,
    tenantId,
  });

  // Metering (Tijolos): best-effort, por fase de geração — nunca bloqueia a resposta.
  for (const u of out.usos) {
    void registrarConsumoIA({
      tenantId,
      origem: "playbook_builder_ia",
      modelo: u.modeloLog,
      tokensEntrada: u.tokensEntrada,
      tokensSaida: u.tokensSaida,
      refTipo: "agente",
      refId: slug,
    });
  }

  // Instrumentação (Fase 4): mede se o feature é útil/fácil — entrada usada, sucesso,
  // se o fluxo validou de primeira (sem auto_fix), se usou fallback de template, e custo.
  const temDoc = Boolean(body.documento && typeof body.documento === "object");
  const temAudio = Boolean(body.audio && typeof body.audio === "object");
  const entrada = temAudio ? "audio" : temDoc ? "documento" : "texto";
  const tokensTotal = out.usos.reduce((s, u) => s + u.tokensEntrada + u.tokensSaida, 0);
  void registrarEvento(supabase, {
    event_type: "playbook_builder_gerado",
    entity_type: "agente",
    entity_id: slug,
    ator: "owner",
    tenant_id: tenantId,
    payload: {
      entrada,
      multi_entrada: [temAudio, temDoc, Boolean(descricaoTexto)].filter(Boolean).length > 1,
      sucesso: out.ok,
      fases: out.usos.length,
      precisou_auto_fix: out.usos.some((u) => u.fase === "auto_fix"),
      usou_fallback_template: out.ok && out.avisos.some((a) => /esqueleto/i.test(a)),
      tokens_total: tokensTotal,
      descricao_chars: descricao.length,
      erro: out.ok ? null : out.erro,
    },
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.erro }, { status: 502 });
  }

  return NextResponse.json({
    markdown: out.markdown,
    flowDefinition: out.flowDefinition,
    regras: out.regras,
    avisos: [...avisosEntrada, ...out.avisos],
  });
}
