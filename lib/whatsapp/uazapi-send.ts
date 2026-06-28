import { uazapiBaseUrlNormalizado } from "@/lib/whatsapp/uazapi-http";

export type UazapiSendTextResult =
  | { ok: true; status: number; body?: unknown }
  | { ok: false; status?: number; body?: unknown; error: string };

/**
 * POST /send/text — header `token` = token da instância (não o admin).
 * @see docs/uazapi-openapi-spec
 */
export async function uazapiSendText(
  numero: string,
  text: string,
  instanceToken?: string | null
): Promise<UazapiSendTextResult> {
  const base = uazapiBaseUrlNormalizado();
  const token = (instanceToken?.trim() || process.env.UAZAPI_INSTANCE_TOKEN?.trim()) ?? "";

  if (!base || !token) {
    return {
      ok: false,
      error: "UAZAPI_BASE_URL ou token da instância não configurados (instância do agente ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const url = `${base}/send/text`;
  const number = numero.replace(/\D/g, "");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify({ number, text }),
    });

    const ct = res.headers.get("content-type") || "";
    let body: unknown;
    try {
      if (ct.includes("application/json")) {
        body = await res.json();
      } else {
        const t = await res.text();
        body = t || undefined;
      }
    } catch {
      body = undefined;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI",
    };
  }
}

/** Tipos de mídia aceitos pela UAZAPI em /send/media (subconjunto usado pelo playbook). */
export type UazapiMediaType =
  | "image"
  | "video"
  | "document"
  | "audio"
  | "myaudio"
  | "ptt";

export type UazapiSendMediaResult = UazapiSendTextResult;

export type UazapiSendMediaOptions = {
  /** Legenda/caption (campo `text` na UAZAPI). Ignorado para áudio. */
  caption?: string;
  /** Nome do arquivo exibido (apenas para document → campo `docName`). */
  docName?: string;
  /** Atraso em ms antes do envio (mostra "Digitando…"/"Gravando…"). */
  delayMs?: number;
};

/**
 * POST /send/media — envia mídia (imagem, vídeo, áudio ou documento) por URL pública ou base64.
 * Mesmo contrato de base/token/erro de `uazapiSendText`.
 * @see docs/uazapi-openapi-spec (16).yaml → /send/media
 */
export async function uazapiSendMedia(
  numero: string,
  type: UazapiMediaType,
  file: string,
  opts?: UazapiSendMediaOptions,
  instanceToken?: string | null
): Promise<UazapiSendMediaResult> {
  const base = uazapiBaseUrlNormalizado();
  const token = (instanceToken?.trim() || process.env.UAZAPI_INSTANCE_TOKEN?.trim()) ?? "";

  if (!base || !token) {
    return {
      ok: false,
      error:
        "UAZAPI_BASE_URL ou token da instância não configurados (instância do agente ou UAZAPI_INSTANCE_TOKEN)",
    };
  }

  const fileRef = (file ?? "").trim();
  if (!fileRef) {
    return { ok: false, error: "Mídia sem URL/arquivo (file vazio)." };
  }

  const url = `${base}/send/media`;
  const number = numero.replace(/\D/g, "");

  const payload: Record<string, unknown> = { number, type, file: fileRef };
  if (opts?.caption && opts.caption.trim()) payload.text = opts.caption.trim();
  if (opts?.docName && opts.docName.trim()) payload.docName = opts.docName.trim();
  if (typeof opts?.delayMs === "number" && opts.delayMs > 0) {
    payload.delay = Math.round(opts.delayMs);
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token,
      },
      body: JSON.stringify(payload),
    });

    const ct = res.headers.get("content-type") || "";
    let body: unknown;
    try {
      if (ct.includes("application/json")) {
        body = await res.json();
      } else {
        const t = await res.text();
        body = t || undefined;
      }
    } catch {
      body = undefined;
    }

    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}` };
    }

    return { ok: true, status: res.status, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erro ao chamar UAZAPI",
    };
  }
}

/** Envia um documento (PDF/DOCX/...) por URL pública ou base64. */
export async function uazapiSendDocument(
  numero: string,
  fileUrl: string,
  opts?: { caption?: string; fileName?: string; delayMs?: number },
  instanceToken?: string | null
): Promise<UazapiSendMediaResult> {
  return uazapiSendMedia(
    numero,
    "document",
    fileUrl,
    { caption: opts?.caption, docName: opts?.fileName, delayMs: opts?.delayMs },
    instanceToken
  );
}

/** Envia um áudio pré-selecionado por URL pública ou base64. */
export async function uazapiSendAudio(
  numero: string,
  fileUrl: string,
  opts?: { delayMs?: number },
  instanceToken?: string | null
): Promise<UazapiSendMediaResult> {
  return uazapiSendMedia(
    numero,
    "audio",
    fileUrl,
    { delayMs: opts?.delayMs },
    instanceToken
  );
}
