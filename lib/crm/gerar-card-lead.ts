import type { SupabaseClient } from "@supabase/supabase-js";
import { mistralChatCompletion } from "@/lib/ia/mistral-chat";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

/**
 * CARD-RESUMO do lead para o direcionamento ao parceiro (estilo Kommo — ver print do dono).
 * Ver docs/DESIGN-ATENDIMENTO-DEFINITIVO.md §5.
 *
 * Objetivo: quando a IA (ou o dono) direciona um lead para um escritório/parceiro, o parceiro
 * recebe um RESUMO do pedido — não um "novo lead" seco. Reaproveita a conversa já gravada em
 * `hub_fila_mensagens` (§4) + `lead.metadata` (interesse_principal/valor/primeira_mensagem).
 *
 * Regra de ouro: o card SEMPRE sai. Sem chave Mistral, erro de rede ou conversa vazia → cai no
 * card determinístico (interesse + primeira mensagem + valor). Nunca lança.
 */

export type CardFala = { de: "cliente" | "mari"; texto: string; em: string | null };

export type CardResumoLead = {
  nome: string;
  telefone: string | null;
  telefone_wa: string | null; // dígitos internacionais p/ link wa.me
  email: string | null;
  cidade: string | null;
  estado: string | null;
  mercado: string;
  codigo: string | null;
  valor_estimado: number | null;
  interesse_principal: string | null;
  pedido_resumo: string; // 1-2 frases do PEDIDO
  pontos: string[]; // bullets: escopo, orçamento, prazo, local
  ultimas_falas: CardFala[]; // últimas 3 falas do cliente (cru, curto)
  fonte_resumo: "ia" | "deterministico";
  gerado_em: string;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function mercadoDoLead(meta: Record<string, unknown>): string {
  const mp = meta.mercado_principal ?? meta.mercado;
  if (typeof mp === "string" && mp.trim()) return mp.trim().toUpperCase();
  const mercados = meta.mercados;
  if (Array.isArray(mercados) && mercados[0]) return String(mercados[0]).trim().toUpperCase();
  return "IMB";
}

/** Rótulo humano do mercado (o parceiro não deve ver o código interno). */
export function rotuloMercado(mercado: string): string {
  const m = mercado.trim().toUpperCase();
  if (m === "ARQ") return "Arquitetura";
  if (m === "PRO" || m === "ENG") return "Engenharia/Projetos";
  if (m === "IMB") return "Imóveis";
  if (m === "REF") return "Reforma";
  return mercado;
}

/** Dígitos internacionais para o link wa.me (garante DDI 55 quando vier sem). */
function telefoneWa(telefone: string | null | undefined): string | null {
  const bruto = telefoneConversaId(String(telefone ?? ""));
  if (!bruto || bruto.length < 10) return null;
  // 10/11 dígitos = número BR sem DDI → prefixa 55.
  if (bruto.length <= 11) return `55${bruto}`;
  return bruto;
}

function truncar(s: string, max: number): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Resumo IA do pedido do cliente (falha silenciosa → null, deixa o caller cair no determinístico). */
async function resumirPedidoIA(
  falasCliente: string[],
  ctx: { interesse: string | null; valor: number | null; cidade: string | null }
): Promise<{ pedido_resumo: string; pontos: string[] } | null> {
  if (!falasCliente.length) return null;
  const conversa = falasCliente.slice(-30).join("\n");
  const system =
    "Você resume o PEDIDO de um cliente para um parceiro que vai fazer um orçamento. " +
    "Seja fiel: NÃO invente escopo, valores ou prazos que o cliente não disse. " +
    "Responda SOMENTE em JSON válido no formato " +
    '{"pedido_resumo":"1-2 frases diretas do que o cliente quer","pontos":["bullet curto",...]}. ' +
    "Os pontos devem destacar (quando houver): escopo/serviço, metragem, orçamento citado, prazo e local. " +
    "No máximo 4 pontos. Sem saudações, sem markdown.";
  const dica =
    `Contexto do CRM (use se ajudar, sem inventar): interesse=${ctx.interesse ?? "—"}, ` +
    `valor_estimado=${ctx.valor != null ? `R$ ${ctx.valor}` : "—"}, cidade=${ctx.cidade ?? "—"}.`;

  const r = await mistralChatCompletion({
    model: "mistral-small-latest",
    system,
    messages: [{ role: "user", content: `${dica}\n\nFalas do cliente:\n${conversa}` }],
    temperature: 0.2,
    maxTokens: 320,
  });
  if (!r.ok) return null;

  try {
    const jsonStr = r.text.slice(r.text.indexOf("{"), r.text.lastIndexOf("}") + 1);
    const parsed = JSON.parse(jsonStr) as { pedido_resumo?: unknown; pontos?: unknown };
    const pedido = typeof parsed.pedido_resumo === "string" ? parsed.pedido_resumo.trim() : "";
    if (!pedido) return null;
    const pontos = Array.isArray(parsed.pontos)
      ? parsed.pontos.map((p) => truncar(String(p), 120)).filter(Boolean).slice(0, 4)
      : [];
    return { pedido_resumo: truncar(pedido, 280), pontos };
  } catch {
    // A IA não devolveu JSON — usa o texto cru como resumo (ainda melhor que nada).
    return { pedido_resumo: truncar(r.text, 280), pontos: [] };
  }
}

/** Monta o card-resumo do lead a partir da conversa gravada + dados do CRM. Nunca lança. */
export async function montarCardResumoLead(
  supabase: SupabaseClient,
  leadId: string
): Promise<CardResumoLead | null> {
  const { data: lead } = await supabase
    .from("hub_leads_crm")
    .select("id, nome, telefone, codigo, metadata, pessoa_id, interesse_principal, valor_estimado")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;

  const meta = asRecord(lead.metadata);
  const mercado = mercadoDoLead(meta);

  let cidade: string | null = null;
  let estado: string | null = null;
  let email: string | null = null;
  if (lead.pessoa_id) {
    const { data: pessoa } = await supabase
      .from("hub_pessoas")
      .select("cidade, estado, email")
      .eq("id", lead.pessoa_id)
      .maybeSingle();
    cidade = (pessoa?.cidade as string) ?? null;
    estado = (pessoa?.estado as string) ?? null;
    email = (pessoa?.email as string) ?? null;
  }

  // Conversa gravada (§4): últimas ~30 mensagens do lead.
  const { data: msgs } = await supabase
    .from("hub_fila_mensagens")
    .select("conteudo, direcao, criado_em")
    .eq("lead_id", leadId)
    .order("criado_em", { ascending: false })
    .limit(30);
  const linhas = Array.isArray(msgs) ? [...msgs].reverse() : [];

  const falasClienteBrutas = linhas
    .filter((m) => String(m.direcao) === "entrada")
    .map((m) => String(m.conteudo ?? "").trim())
    .filter((c) => c && !/^\s*\[[^\]]*recebido\]\s*$/i.test(c));

  const ultimas_falas: CardFala[] = linhas
    .filter((m) => {
      const c = String(m.conteudo ?? "").trim();
      return c && !/^\s*\[[^\]]*recebido\]\s*$/i.test(c);
    })
    .slice(-6)
    .map<CardFala>((m) => ({
      de: String(m.direcao) === "entrada" ? "cliente" : "mari",
      texto: truncar(String(m.conteudo ?? ""), 160),
      em: (m.criado_em as string) ?? null,
    }))
    .filter((f) => f.de === "cliente")
    .slice(-3);

  const interesse = (lead.interesse_principal as string) ?? null;
  const valor = typeof lead.valor_estimado === "number" ? lead.valor_estimado : null;
  const primeiraMsg = typeof meta.primeira_mensagem === "string" ? meta.primeira_mensagem : null;

  // Resumo: IA quando há conversa + chave; senão determinístico. O card SEMPRE sai.
  let pedido_resumo = "";
  let pontos: string[] = [];
  let fonte_resumo: "ia" | "deterministico" = "deterministico";

  const ia = await resumirPedidoIA(falasClienteBrutas, { interesse, valor, cidade });
  if (ia) {
    pedido_resumo = ia.pedido_resumo;
    pontos = ia.pontos;
    fonte_resumo = "ia";
  } else {
    // Determinístico: interesse + primeira mensagem + valor.
    const partes: string[] = [];
    if (interesse) partes.push(interesse);
    else if (primeiraMsg) partes.push(truncar(primeiraMsg, 160));
    else if (falasClienteBrutas.length) partes.push(truncar(falasClienteBrutas.join(" "), 160));
    pedido_resumo = partes.join(" — ") || "Lead sem conversa registrada — contate para qualificar.";
    if (valor != null) pontos.push(`Orçamento citado: R$ ${valor.toLocaleString("pt-BR")}`);
    if (cidade) pontos.push(`Local: ${cidade}${estado ? `/${estado}` : ""}`);
  }

  return {
    nome: String(lead.nome ?? "Lead"),
    telefone: (lead.telefone as string) ?? null,
    telefone_wa: telefoneWa(lead.telefone as string),
    email,
    cidade,
    estado,
    mercado,
    codigo: lead.codigo != null ? String(lead.codigo) : null,
    valor_estimado: valor,
    interesse_principal: interesse,
    pedido_resumo,
    pontos,
    ultimas_falas,
    fonte_resumo,
    gerado_em: new Date().toISOString(),
  };
}

/** Texto rico para o WhatsApp do parceiro (click-and-go: links wa.me + portal). */
export function formatarCardWhatsApp(
  card: CardResumoLead,
  opts: { encaminhamentoId?: string | null; appUrl: string }
): string {
  const codigo = card.codigo ? ` (${card.codigo})` : "";
  const local = card.cidade ? `${card.cidade}${card.estado ? `/${card.estado}` : ""}` : null;
  const linhas: string[] = [
    `🔔 *Novo lead para você!*`,
    ``,
    `*Nome:* ${card.nome}${codigo}`,
    `*Telefone:* ${card.telefone || "—"}${local ? ` · *Local:* ${local}` : ""}`,
    `*Mercado:* ${rotuloMercado(card.mercado)}`,
    ``,
    `📋 *Pedido:* ${card.pedido_resumo}`,
  ];
  for (const p of card.pontos.slice(0, 3)) linhas.push(`• ${p}`);
  const ultimaFala = [...card.ultimas_falas].reverse().find((f) => f.de === "cliente");
  if (ultimaFala) linhas.push(``, `💬 *Última fala:* "${ultimaFala.texto}"`);
  linhas.push(``);
  if (card.telefone_wa) linhas.push(`▶️ Abrir WhatsApp do cliente: https://wa.me/${card.telefone_wa}`);
  const base = opts.appUrl.replace(/\/+$/, "");
  const destino = opts.encaminhamentoId
    ? `${base}/parceiro/leads/${opts.encaminhamentoId}`
    : `${base}/parceiro/dashboard`;
  linhas.push(`▶️ Fazer orçamento: ${destino}`);
  return linhas.join("\n");
}
