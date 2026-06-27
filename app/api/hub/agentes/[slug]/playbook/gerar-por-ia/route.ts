import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gerarPlaybookViaIa } from "@/lib/playbook/gerar-fluxo-ia";
import { extrairTextoDocumentoRag } from "@/lib/hub/rag";
import { mistralTranscreverAudioBuffer } from "@/lib/whatsapp/mistral-transcribe-audio";
import { registrarConsumoIA } from "@/lib/ia/metering";
import { defaultTenantId } from "@/lib/tenant-default";

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

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { descricao?: unknown; tenantId?: unknown; documento?: unknown; audio?: unknown };
  try {
    body = (await request.json()) as {
      descricao?: unknown;
      tenantId?: unknown;
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

  // Resolve o agente (mesma convenção das demais rotas de playbook: por agente_slug).
  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, modelo_padrao")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  const tenantId =
    (typeof body.tenantId === "string" && body.tenantId.trim()) || defaultTenantId();

  const out = await gerarPlaybookViaIa({
    descricao,
    agenteNome: (agente.nome as string | null) ?? slug,
    agenteSlug: slug,
    modeloFromDb: (agente.modelo_padrao as string | null) ?? undefined,
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
