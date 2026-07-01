const GROQ_TRANSCRIPTIONS_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const DEFAULT_GROQ_TRANSCRIBE_TIMEOUT_MS = 90_000;

function modeloTranscricaoGroq(): string {
  return process.env.GROQ_TRANSCRIBE_MODEL?.trim() || "whisper-large-v3-turbo";
}

type GroqTranscriptionJson = {
  text?: string;
};

async function transcreverBlobGroq(
  blob: Blob,
  fileName: string
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return { ok: false, erro: "groq_api_key_ausente" };

  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("model", modeloTranscricaoGroq());
  form.append("language", "pt");
  form.append("response_format", "json");

  try {
    const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: AbortSignal.timeout(DEFAULT_GROQ_TRANSCRIBE_TIMEOUT_MS),
    });

    const ct = res.headers.get("content-type") || "";
    let data: unknown;
    if (ct.includes("application/json")) {
      data = await res.json();
    } else {
      const t = await res.text();
      data = t ? { text: t } : undefined;
    }

    if (!res.ok) {
      const err =
        data && typeof data === "object" && "error" in data
          ? String((data as { error?: { message?: unknown } }).error?.message ?? "")
          : data && typeof data === "object" && "message" in data
            ? String((data as { message: unknown }).message)
            : `groq_transcribe_http_${res.status}`;
      return { ok: false, erro: err.slice(0, 500) || `groq_transcribe_http_${res.status}` };
    }

    const o = data as GroqTranscriptionJson;
    const texto = typeof o?.text === "string" ? o.text.trim() : "";
    if (!texto) return { ok: false, erro: "groq_transcricao_vazia" };
    return { ok: true, texto: texto.slice(0, 8000) };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "groq_transcribe_falhou" };
  }
}

/** Transcreve áudio a partir dos bytes via Groq Whisper (fallback do Voxtral/Mistral). */
export async function groqTranscreverAudioBuffer(
  buffer: Buffer,
  fileName = "audio-instrucao.webm",
  mimeType?: string
): Promise<{ ok: true; texto: string } | { ok: false; erro: string }> {
  if (!buffer || buffer.byteLength === 0) return { ok: false, erro: "audio_vazio" };
  const blob = new Blob([new Uint8Array(buffer)], mimeType ? { type: mimeType } : undefined);
  return transcreverBlobGroq(blob, fileName);
}
