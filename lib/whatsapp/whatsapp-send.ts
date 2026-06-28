import { getWhatsappProvider } from "@/lib/whatsapp/whatsapp-provider";
import type { UazapiMediaType, UazapiSendMediaOptions } from "@/lib/whatsapp/uazapi-send";

export type WhatsappSendTextResult =
  | { ok: true; status: number; body?: unknown; provider: "uazapi" }
  | { ok: false; status?: number; body?: unknown; error: string; provider?: "uazapi" };

export type WhatsappSendMediaResult = WhatsappSendTextResult;

export function whatsappProvider(): "uazapi" | null {
  if (!process.env.UAZAPI_BASE_URL?.trim()) return null;
  /** Permite só envio por token por linha se BASE_URL existir */
  return "uazapi";
}

/** True se há base URL e token global OU se for enviado token por chamada */
export function whatsappConfigured(opts?: { instanceToken?: string | null }): boolean {
  if (!process.env.UAZAPI_BASE_URL?.trim()) return false;
  if (opts?.instanceToken?.trim()) return true;
  return Boolean(process.env.UAZAPI_INSTANCE_TOKEN?.trim());
}

/** Envia texto via UAZAPI; `numero` pode incluir máscara — normaliza para dígitos. */
export async function whatsappSendText(
  numero: string,
  text: string,
  opts?: { instanceToken?: string | null }
): Promise<WhatsappSendTextResult> {
  const provider = whatsappProvider();
  if (provider === "uazapi") {
    if (!whatsappConfigured(opts)) {
      return {
        ok: false,
        error:
          "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
      };
    }
    const r = await getWhatsappProvider().sendText(numero, text, opts?.instanceToken ?? undefined);
    if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
    return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
  }
  return {
    ok: false,
    error: "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância",
  };
}

/**
 * Envia mídia (documento/áudio/imagem) por URL pública via provedor de WhatsApp.
 * Tolerante: provedor sem suporte a mídia retorna erro amigável (não derruba o runtime).
 */
export async function whatsappSendMedia(
  numero: string,
  type: UazapiMediaType,
  file: string,
  opts?: UazapiSendMediaOptions & { instanceToken?: string | null }
): Promise<WhatsappSendMediaResult> {
  const provider = whatsappProvider();
  if (provider !== "uazapi") {
    return {
      ok: false,
      error: "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância",
    };
  }
  if (!whatsappConfigured({ instanceToken: opts?.instanceToken })) {
    return {
      ok: false,
      error:
        "WhatsApp não configurado: defina UAZAPI_BASE_URL e token da instância (agente ligado à UAZAPI ou UAZAPI_INSTANCE_TOKEN)",
    };
  }
  const impl = getWhatsappProvider();
  if (typeof impl.sendMedia !== "function") {
    return { ok: false, error: "Provedor de WhatsApp atual não suporta envio de mídia." };
  }
  const r = await impl.sendMedia(
    numero,
    type,
    file,
    { caption: opts?.caption, docName: opts?.docName, delayMs: opts?.delayMs },
    opts?.instanceToken ?? undefined
  );
  if (r.ok) return { ok: true, status: r.status, body: r.body, provider: "uazapi" };
  return { ok: false, status: r.status, body: r.body, error: r.error, provider: "uazapi" };
}
