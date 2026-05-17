/**
 * Geração texto simples (Google AI Gemini) — usado p.ex. na camada «smart» de ferramentas Hub.
 * Chave: GOOGLE_AI_API_KEY ou GEMINI_API_KEY (primeira definida ganha).
 */

const GEMINI_GENERATE =
  "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent";

function geminiApiKey(): string | null {
  const a = process.env.GOOGLE_AI_API_KEY?.trim();
  const b = process.env.GEMINI_API_KEY?.trim();
  return a || b || null;
}

export async function geminiGenerateTextSimple(params: {
  /** Ex.: gemini-2.0-flash, gemini-1.5-flash */
  model?: string;
  prompt: string;
  maxOutputTokens?: number;
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const key = geminiApiKey();
  if (!key) {
    return {
      ok: false,
      error: "GOOGLE_AI_API_KEY ou GEMINI_API_KEY não configurada no servidor.",
    };
  }

  const model = (params.model?.trim() || "gemini-2.0-flash").replace(/^models\//, "");
  const url = `${GEMINI_GENERATE.replace("{model}", encodeURIComponent(model))}?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: params.prompt }] }],
      generationConfig: {
        maxOutputTokens: params.maxOutputTokens ?? 2048,
        temperature: 0.35,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `Gemini HTTP ${res.status}: ${t.slice(0, 400)}` };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") ?? "";

  if (!text.trim()) {
    return { ok: false, error: "Gemini: resposta sem texto." };
  }

  return { ok: true, text: text.trim() };
}

export function geminiConfigured(): boolean {
  return Boolean(geminiApiKey());
}
