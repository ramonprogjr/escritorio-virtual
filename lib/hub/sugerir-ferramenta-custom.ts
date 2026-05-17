import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { mistralDefaultModelId } from "@/lib/ia/hub-model-defaults";
import { HUB_AGENTE_FERRAMENTAS_CATALOGO } from "@/lib/hub/agente-ferramentas-registry";

const MODEL = process.env.HUB_FERRAMENTA_SUGESTAO_MISTRAL_MODEL?.trim() || mistralDefaultModelId();

export type SugestaoFerramentaCustom = {
  titulo: string;
  slug_curto: string;
  descricao_curta: string;
  descricao_modelo: string;
  builtin_impl: string;
  smart_provider: "none" | "mistral" | "gemini";
  smart_prompt: string;
};

export async function sugerirFerramentaCustomComMistral(params: {
  tituloPedido: string;
}): Promise<{ ok: true; sugestao: SugestaoFerramentaCustom } | { ok: false; error: string }> {
  const builtins = HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => `${t.id}: ${t.titulo}`).join("\n");

  const system = `És um assistente que propõe ferramentas Hub para CRM. Responde APENAS com um único objeto JSON válido (sem markdown), chaves:
titulo (string curta PT),
slug_curto (string só [a-z0-9_]{3,40}, sem prefixo hub_custom_),
descricao_curta (string PT opcional: 1 linha para administradores no CRM, o que a ferramenta faz),
descricao_modelo (string: quando o modelo Mistral deve chamar esta função — 1–3 frases),
builtin_impl (string: um destes IDs exactos: ${HUB_AGENTE_FERRAMENTAS_CATALOGO.map((t) => t.id).join(", ")}),
smart_provider ("none" | "mistral" | "gemini" — "gemini" para análise/síntese pesada de dados, "mistral" para pós-processamento leve, "none" só se raw JSON bastar),
smart_prompt (string PT: instruções para o modelo interno pós-processar o JSON; vazio se smart_provider é none).`;

  const user = `Pedido do utilizador para nova ferramenta:\n"${params.tituloPedido}"\n\nBuiltins disponíveis:\n${builtins}`;

  const chat = await mistralChatCompletion({
    model: MODEL,
    system,
    messages: [{ role: "user", content: user }],
    maxTokens: 800,
    temperature: 0.35,
  });

  if (!chat.ok) return { ok: false, error: chat.error };

  let parsed: unknown;
  try {
    let t = chat.text.trim();
    if (t.startsWith("```")) {
      t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    }
    parsed = JSON.parse(t);
  } catch {
    return { ok: false, error: "Mistral não devolveu JSON válido." };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Formato de sugestão inválido." };
  }

  const o = parsed as Record<string, unknown>;
  const titulo = String(o.titulo || "").trim();
  const slug_curto = String(o.slug_curto || "").trim().toLowerCase();
  const descricao_curta = String(o.descricao_curta || "").trim();
  const descricao_modelo = String(o.descricao_modelo || "").trim();
  const builtin_impl = String(o.builtin_impl || "").trim();
  const sp = String(o.smart_provider || "none").toLowerCase();
  const smart_provider =
    sp === "gemini" || sp === "mistral" || sp === "none" ? (sp as SugestaoFerramentaCustom["smart_provider"]) : "none";
  const smart_prompt = String(o.smart_prompt || "").trim();

  if (!titulo || !slug_curto || !descricao_modelo || !builtin_impl) {
    return { ok: false, error: "Sugestão incompleta (titulo, slug_curto, descricao_modelo, builtin_impl)." };
  }

  return {
    ok: true,
    sugestao: {
      titulo,
      slug_curto,
      descricao_curta,
      descricao_modelo,
      builtin_impl,
      smart_provider,
      smart_prompt: smart_provider === "none" ? "" : smart_prompt,
    },
  };
}
