/**
 * Adapter UAZAPI para a interface `WhatsappProvider`.
 *
 * NÃO reimplementa nada: apenas DELEGA para `uazapiSendText` já existente,
 * encaminhando os mesmos argumentos e devolvendo o mesmo retorno, sem nenhuma
 * transformação. Comportamento de envio IDÊNTICO ao atual.
 */
import { uazapiSendText } from "@/lib/whatsapp/uazapi-send";
import type {
  WhatsappProvider,
  WhatsappSendTextProviderResult,
} from "@/lib/whatsapp/whatsapp-provider";

export const uazapiAdapter: WhatsappProvider = {
  id: "uazapi",
  sendText(
    numero: string,
    text: string,
    instanceToken?: string | null
  ): Promise<WhatsappSendTextProviderResult> {
    // Encaminha tal e qual — mesma assinatura, mesmo retorno de uazapiSendText.
    return uazapiSendText(numero, text, instanceToken);
  },
};
