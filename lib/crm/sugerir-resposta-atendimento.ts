import type { SupabaseClient } from "@supabase/supabase-js";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";

/**
 * "Mari sugere": lê a conversa do lead (os 2 ledgers) e propõe a PRÓXIMA resposta ao operador humano
 * — que revisa e envia. Reaproveita a IA (Mistral) já viva. Best-effort: retorna erro legível, nunca lança.
 */

type MsgHist = { role: "user" | "assistant"; content: string; criado_em: string };

export async function sugerirRespostaAtendimento(
  supabase: SupabaseClient,
  leadId: string
): Promise<{ ok: true; sugestao: string } | { ok: false; error: string }> {
  const [{ data: fila }, { data: hist }] = await Promise.all([
    supabase
      .from("hub_fila_mensagens")
      .select("conteudo, direcao, criado_em")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: false })
      .limit(20),
    supabase
      .from("hub_mensagens")
      .select("conteudo, remetente, criado_em")
      .eq("lead_id", leadId)
      .order("criado_em", { ascending: false })
      .limit(20),
  ]);

  const msgs: MsgHist[] = [];
  for (const m of (fila || []) as Record<string, unknown>[]) {
    const c = String(m.conteudo ?? "").trim();
    if (c) msgs.push({ role: String(m.direcao) === "entrada" ? "user" : "assistant", content: c, criado_em: String(m.criado_em ?? "") });
  }
  for (const m of (hist || []) as Record<string, unknown>[]) {
    const c = String(m.conteudo ?? "").trim();
    const rem = String(m.remetente ?? "").toLowerCase();
    if (c) msgs.push({ role: rem === "lead" || rem === "cliente" || rem === "contato" ? "user" : "assistant", content: c, criado_em: String(m.criado_em ?? "") });
  }
  if (!msgs.length) return { ok: false, error: "sem_conversa" };

  // Ordena ASC e pega as últimas ~14 falas (ignora placeholders de mídia crua).
  msgs.sort((a, b) => a.criado_em.localeCompare(b.criado_em));
  const historico = msgs
    .filter((m) => !/^\s*\[[^\]]*recebido\]\s*$/i.test(m.content))
    .slice(-14)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 800) }));
  if (!historico.length) return { ok: false, error: "sem_conversa" };

  const system =
    "Você é o atendente do Obra10+ (construção, arquitetura e imóveis) no WhatsApp. Com base na conversa, " +
    "sugira a PRÓXIMA resposta ao cliente: cordial, objetiva, em português do Brasil, no máximo 2 frases. " +
    "Não invente dados, valores ou prazos que não estejam na conversa; não prometa o que não sabe. " +
    "Responda SÓ com a mensagem sugerida, sem aspas e sem rótulo.";

  const r = await mistralChatCompletion({
    model: "mistral-small-latest",
    system,
    messages: historico,
    temperature: 0.5,
    maxTokens: 220,
  });
  if (!r.ok) return { ok: false, error: r.error };
  const sugestao = r.text.trim().replace(/^["']|["']$/g, "");
  if (!sugestao) return { ok: false, error: "sugestao_vazia" };
  return { ok: true, sugestao };
}
