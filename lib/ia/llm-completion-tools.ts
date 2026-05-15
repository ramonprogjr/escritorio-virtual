import {
  isMistralFamilyModelId,
  mistralDefaultModelId,
  resolveInferenceModelId,
} from "@/lib/ia/hub-model-defaults";
import {
  mistralChatCompletionToolRound,
  type MistralChatMessagePayload,
  type MistralChatToolDefinition,
} from "@/lib/ia/mistral-chat-tools";

const MAX_TOOL_ROUNDS = 6;

export async function completarChatComFerramentasMistral(params: {
  systemPrompt: string;
  mensagens: Array<{ role: "user" | "assistant"; content: string }>;
  modeloFromDb: string;
  tools: MistralChatToolDefinition[];
  maxTokens?: number;
  executarTool: (nome: string, argumentosSerializados: string) => Promise<string>;
}): Promise<
  | { ok: true; texto: string; tokensEntrada: number; tokensSaida: number; modeloLog: string }
  | { ok: false; erro: string }
> {
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (!mistralKey) {
    return { ok: false, erro: "MISTRAL_API_KEY não configurada." };
  }
  if (!params.tools.length) {
    return { ok: false, erro: "Lista de ferramentas vazia." };
  }

  const modeloResolved = resolveInferenceModelId(params.modeloFromDb);
  const mid = isMistralFamilyModelId(modeloResolved) ? modeloResolved : mistralDefaultModelId();

  let messages: MistralChatMessagePayload[] = params.mensagens.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let tokensEntrada = 0;
  let tokensSaida = 0;

  let systemExtra = `\n\n═══ FERRAMENTAS ═══\nTem ferramentas para ler dados do CRM. Use-as quando precisar de factos sobre o lead; não invente estados ou valores.`;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const out = await mistralChatCompletionToolRound({
      model: mid,
      system: params.systemPrompt + systemExtra,
      messages,
      tools: params.tools,
      maxTokens: params.maxTokens ?? 1024,
    });

    if (!out.ok) return { ok: false, erro: out.error };

    tokensEntrada += out.usage.inputTokens;
    tokensSaida += out.usage.outputTokens;

    if (out.kind === "message") {
      return {
        ok: true,
        texto: out.text,
        tokensEntrada,
        tokensSaida,
        modeloLog: mid,
      };
    }

    const assistantPayload: MistralChatMessagePayload = {
      role: "assistant",
      content: null,
      tool_calls: out.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments ?? "{}",
        },
      })),
    };
    messages = [...messages, assistantPayload];

    for (const tc of out.toolCalls) {
      const name = tc.function?.name ?? "";
      const argsStr = tc.function?.arguments ?? "{}";
      const result = await params.executarTool(name, typeof argsStr === "string" ? argsStr : "{}");
      messages.push({
        role: "tool",
        name,
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return {
    ok: false,
    erro: "Limite de voltas com ferramentas excedido; simplifique o pedido ou desative tools.",
  };
}
