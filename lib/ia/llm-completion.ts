import Anthropic from "@anthropic-ai/sdk";
import {
  isAnthropicModelId,
  isMistralFamilyModelId,
  mistralDefaultModelId,
  resolveInferenceModelId,
} from "./hub-model-defaults";
import { mistralChatCompletion } from "./mistral-chat";
import { groqChatCompletion } from "./groq-chat";
import { assertSaldoAntesDoLLM } from "./metering";

/**
 * Testa se um erro Anthropic pode ser recuperado tentando o Mistral.
 *
 * Recebe `raw` (e.message) E `type` (APIError.type / error.error.type da resposta).
 * IMPORTANTE: o SDK Anthropic coloca o `error.type` em `APIError.type`, NÃO em
 * `APIError.message` — checar só `raw` perde os casos de `invalid_request_error`
 * onde o message é apenas "400 model 'claude-haiku' does not exist".
 */
function anthropicErroProvavelmenteRecuperavelComMistral(raw: string, type?: string | null): boolean {
  const s = raw.toLowerCase();
  const t = (type ?? "").toLowerCase();
  return (
    /credit balance|too low|billing|plan|purchase credit/.test(s) ||
    /invalid_request_error/.test(s) ||
    t === "invalid_request_error" ||
    // model ID inválido/inexistente — fallback ao Mistral faz sentido
    /model.*does not exist|unknown model|model.*not found|no such model/.test(s) ||
    /rate.?limit|429/.test(s) ||
    /overloaded|529/.test(s) ||
    /status code 402/.test(s)
  );
}

/**
 * Preferir Mistral quando o modelo não é explicitamente Claude; Anthropic para IDs `claude-*`.
 *
 * `tenantId` (opcional): quando presente, roda o gate `assertSaldoAntesDoLLM` ANTES de
 * gastar qualquer token. Em modo sombra (default — `IA_HARD_CAP` != "on") o gate nunca
 * bloqueia, só loga; em modo bloqueio, com saldo insuficiente, retorna erro sem chamar
 * nenhum provedor. Call sites sem `tenantId` mantêm o comportamento anterior (sem gate).
 */
export async function completarChatPreferindoMistral(params: {
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modeloFromDb: string;
  maxTokens?: number;
  tenantId?: string;
}): Promise<
  | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number; modeloLog: string }
  | { ok: false; erro: string }
> {
  if (params.tenantId?.trim()) {
    const gate = await assertSaldoAntesDoLLM(params.tenantId.trim());
    if (!gate.permitido) {
      return { ok: false, erro: "Saldo de créditos de IA esgotado. Recarregue os Tijolos para continuar." };
    }
  }

  const modeloResolved = resolveInferenceModelId(params.modeloFromDb);
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const maxTokens = params.maxTokens ?? 1024;

  async function viaMistral(): Promise<
    | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number; modeloLog: string }
    | { ok: false; erro: string }
  > {
    if (!mistralKey) {
      return { ok: false, erro: "MISTRAL_API_KEY não configurada." };
    }
    const mid = isMistralFamilyModelId(modeloResolved) ? modeloResolved : mistralDefaultModelId();
    const chat = await mistralChatCompletion({
      model: mid,
      system: params.systemPrompt,
      messages: params.mensagens,
      maxTokens,
    });
    if (!chat.ok) return { ok: false, erro: chat.error };
    return {
      ok: true,
      texto: chat.text,
      tokensEntrada: chat.inputTokens,
      tokensSaida: chat.outputTokens,
      modeloLog: chat.model,
    };
  }

  if (isAnthropicModelId(modeloResolved) && anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const resposta = await anthropic.messages.create({
        model: modeloResolved,
        max_tokens: maxTokens,
        system: params.systemPrompt,
        messages: params.mensagens,
      });
      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "";
      return {
        ok: true,
        texto,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        modeloLog: modeloResolved,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      // APIError.type contém "invalid_request_error" mas NÃO aparece em e.message
      const errType = (e != null && typeof e === "object" && "type" in e)
        ? String((e as { type?: unknown }).type ?? "")
        : "";
      if (mistralKey && anthropicErroProvavelmenteRecuperavelComMistral(raw, errType)) {
        const m = await viaMistral();
        if (m.ok) return m;
      }
      return { ok: false, erro: raw };
    }
  }

  const mistralOut = await viaMistral();
  if (mistralOut.ok) return mistralOut;

  if (anthropicKey) {
    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      const fallback = "claude-haiku-4-5-20251001";
      const resposta = await anthropic.messages.create({
        model: fallback,
        max_tokens: maxTokens,
        system: params.systemPrompt,
        messages: params.mensagens,
      });
      const texto = resposta.content[0].type === "text" ? resposta.content[0].text : "";
      return {
        ok: true,
        texto,
        tokensEntrada: resposta.usage.input_tokens,
        tokensSaida: resposta.usage.output_tokens,
        modeloLog: fallback,
      };
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const errType = (e != null && typeof e === "object" && "type" in e)
        ? String((e as { type?: unknown }).type ?? "")
        : "";
      if (mistralKey && anthropicErroProvavelmenteRecuperavelComMistral(raw, errType)) {
        const m = await viaMistral();
        if (m.ok) return m;
      }
      return { ok: false, erro: raw };
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    const groqOut = await groqChatCompletion({
      system: params.systemPrompt,
      messages: params.mensagens,
      maxTokens,
    });
    if (groqOut.ok) {
      return {
        ok: true,
        texto: groqOut.text,
        tokensEntrada: groqOut.inputTokens,
        tokensSaida: groqOut.outputTokens,
        modeloLog: groqOut.model,
      };
    }
  }

  return {
    ok: false,
    erro:
      mistralOut.erro ||
      "Nenhum provedor IA configurado: defina MISTRAL_API_KEY, ANTHROPIC_API_KEY ou GROQ_API_KEY",
  };
}
