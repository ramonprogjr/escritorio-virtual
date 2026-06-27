/**
 * Abstração PROVIDER-AGNÓSTICA de envio de WhatsApp.
 *
 * Hoje o único provedor implementado é a UAZAPI (ver `adapters/uazapi-adapter.ts`),
 * mas o orquestrador de envio (`whatsapp-send.ts`) passa a falar com esta interface
 * em vez de chamar a UAZAPI diretamente. Trocar de provedor = novo adapter + a env
 * `WHATSAPP_PROVIDER`, sem mexer na lógica de negócio do envio.
 *
 * IMPORTANTE: a assinatura e o retorno de `sendText` são IDÊNTICOS aos da função
 * `uazapiSendText` já existente — o adapter só encaminha. Zero mudança de comportamento.
 */
import type { UazapiSendTextResult } from "@/lib/whatsapp/uazapi-send";
import { uazapiAdapter } from "@/lib/whatsapp/adapters/uazapi-adapter";

/** Resultado de envio de texto — mesmo shape já usado pelo provedor UAZAPI. */
export type WhatsappSendTextProviderResult = UazapiSendTextResult;

export interface WhatsappProvider {
  /** Identificador técnico do provedor (ex.: "uazapi"). */
  readonly id: string;
  /**
   * Envia uma mensagem de texto. Mesmos parâmetros/retorno de `uazapiSendText`:
   * `(numero, text, instanceToken?)`.
   */
  sendText(
    numero: string,
    text: string,
    instanceToken?: string | null
  ): Promise<WhatsappSendTextProviderResult>;
}

/**
 * Resolve o provedor de WhatsApp a partir de `process.env.WHATSAPP_PROVIDER`
 * (default: "uazapi"). Provedor desconhecido cai no default (uazapi) para
 * preservar o comportamento atual de produção.
 */
export function getWhatsappProvider(): WhatsappProvider {
  const id = (process.env.WHATSAPP_PROVIDER?.trim() || "uazapi").toLowerCase();
  switch (id) {
    case "uazapi":
    default:
      // Provedor desconhecido cai no default (uazapi) — preserva o comportamento atual.
      return uazapiAdapter;
  }
}
