import { geminiGenerateTextSimple } from "@/lib/ia/gemini-text";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { mistralDefaultModelId } from "@/lib/ia/hub-model-defaults";

/**
 * Pós-processa o JSON devolvido por um builtin antes de voltar ao modelo principal.
 */
export async function smartPosProcessarResultadoFerramenta(params: {
  provider: "mistral" | "gemini";
  model?: string | null;
  instrucoes: string;
  payloadBruto: string;
}): Promise<{ ok: true; texto: string } | { ok: false; error: string }> {
  const sys = `${params.instrucoes.trim()}\n\nRegras: baseie-se apenas nos dados JSON abaixo; não invente factos; resposta concisa em português (pode ser JSON ou texto útil ao assistente).`;
  const user = `Dados brutos (JSON):\n${params.payloadBruto.slice(0, 120_000)}`;

  if (params.provider === "gemini") {
    const out = await geminiGenerateTextSimple({
      model: params.model?.trim() || undefined,
      prompt: `${sys}\n\n${user}`,
      maxOutputTokens: 2048,
    });
    if (!out.ok) return out;
    return { ok: true, texto: out.text };
  }

  const mid = params.model?.trim() || mistralDefaultModelId();
  const chat = await mistralChatCompletion({
    model: mid,
    system: sys,
    messages: [{ role: "user", content: user }],
    maxTokens: 2048,
    temperature: 0.35,
  });
  if (!chat.ok) return { ok: false, error: chat.error };
  return { ok: true, texto: chat.text };
}
