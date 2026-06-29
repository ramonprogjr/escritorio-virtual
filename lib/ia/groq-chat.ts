const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_TIMEOUT_MS = 30_000;

function groqDefaultModel(): string {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

export async function groqChatCompletion(params: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
}): Promise<
  | { ok: true; text: string; inputTokens: number; outputTokens: number; model: string }
  | { ok: false; error: string }
> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return { ok: false, error: "GROQ_API_KEY não configurada" };

  const model = groqDefaultModel();
  const body = {
    model,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.maxTokens ?? 1024,
    messages: [{ role: "system" as const, content: params.system }, ...params.messages],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("groq_timeout"), DEFAULT_GROQ_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      const causa =
        res.status === 401
          ? "chave Groq inválida ou inativa (confira GROQ_API_KEY)"
          : res.status === 429
            ? "quota Groq esgotada (limite free tier)"
            : `HTTP ${res.status}`;
      return { ok: false, error: `Groq: ${causa}${t ? ` · ${t.slice(0, 200)}` : ""}` };
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | unknown } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    const raw = data.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : "";
    if (!text.trim()) return { ok: false, error: "Groq: resposta sem texto" };

    return {
      ok: true,
      text,
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      model: data.model ?? model,
    };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: msg.toLowerCase().includes("abort") ? `Groq timeout após ${DEFAULT_GROQ_TIMEOUT_MS}ms` : msg,
    };
  }
}
