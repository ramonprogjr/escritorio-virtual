import type { SupabaseClient } from "@supabase/supabase-js";
import { telefoneConversaId } from "@/lib/crm/isolamento-conversa-lead";

/**
 * Gate central de PAUSA do atendimento IA (WhatsApp). Um só ponto de verdade, consultado no
 * processor logo após o gate de humano_responsavel. Ordem barato→caro com curto-circuito:
 *   (2) agente pausado (botão de pânico)  →  (3) deny-list (etiqueta/comando/seed)  →  (4) trava temporal.
 * (o (1) humano_responsavel fica no processor, não aqui). NUNCA consulta a UAZAPI — só Postgres.
 *
 * SEGURANÇA (laudo Fable 09/jul): fail-CLOSED. Erro de banco → LANÇA (o worker reclassifica para
 * retry e silêncio temporário é o comportamento seguro). O cache guarda SOMENTE positivos (pausada=
 * true) — negativo nunca é cacheado, para não abrir janela logo após um /pausa. Ver §1 do design.
 */

export type FontePausa = "etiqueta" | "comando" | "painel" | "seed";
export type ResultadoPausa = { pausada: boolean; motivo: string | null; fonte: string | null };

const CACHE_TTL_MS = 30_000;
// Cache SÓ de positivos: telefone/agente sabidamente pausado. Negativos nunca entram (evita
// responder um cliente recém-pausado por causa de um "não pausada" velho em cache).
const denyCache = new Map<string, { fonte: string | null; motivo: string | null; exp: number }>();
const agenteCache = new Map<string, { exp: number }>();

/** Últimos 11 dígitos — mesma equivalência de telefonesConversaEquivalentes e da coluna gerada. */
function sufixo11(telCanonico: string): string {
  return telCanonico.length >= 11 ? telCanonico.slice(-11) : telCanonico;
}

/**
 * Número BR sem DDI (10 = fixo, 11 = celular) → prefixa "55" para que o `right(telefone,11)` gravado
 * bata com o inbound (que sempre chega com 55). Para 11 dígitos é inócuo (sufixo-11 idêntico); para
 * 10 dígitos é o que conserta o match (laudo Fable, Alto 3). Já com DDI/comprido: não mexe.
 */
export function comDdi55(telCanonico: string): string {
  return telCanonico.length === 10 || telCanonico.length === 11 ? `55${telCanonico}` : telCanonico;
}

let goliveInvalidaAvisada = false;
function goliveAtMs(): number | null {
  const raw = process.env.IA_GOLIVE_AT?.trim();
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) {
    if (!goliveInvalidaAvisada) {
      goliveInvalidaAvisada = true;
      console.warn(
        `[PAUSA] IA_GOLIVE_AT inválida ("${raw}") — trava temporal DESLIGADA. Use ISO com fuso, ex.: 2026-07-09T07:00:00-03:00`
      );
    }
    return null;
  }
  return t;
}

/** Erro de leitura do gate = fail-CLOSED: lança para o worker reclassificar (retry/silêncio). */
async function agenteEstaPausado(supabase: SupabaseClient, agenteSlug: string | null | undefined): Promise<boolean> {
  const slug = typeof agenteSlug === "string" ? agenteSlug.trim() : "";
  if (!slug) return false;
  const c = agenteCache.get(slug);
  if (c && c.exp > Date.now()) return true; // cache só guarda positivos
  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .select("ia_whatsapp_pausada")
    .eq("agente_slug", slug)
    .maybeSingle();
  if (error) throw new Error(`pausa_gate: falha ao ler agente ${slug}: ${error.message}`);
  const pausada = (data as { ia_whatsapp_pausada?: boolean } | null)?.ia_whatsapp_pausada === true;
  if (pausada) agenteCache.set(slug, { exp: Date.now() + CACHE_TTL_MS });
  return pausada;
}

async function telefoneNaDenyList(
  supabase: SupabaseClient,
  telCanonico: string
): Promise<{ pausada: boolean; fonte: string | null; motivo: string | null }> {
  const suf = sufixo11(telCanonico);
  if (!suf || suf.length < 8) return { pausada: false, fonte: null, motivo: null };
  const c = denyCache.get(suf);
  if (c && c.exp > Date.now()) return { pausada: true, fonte: c.fonte, motivo: c.motivo };
  const { data, error } = await supabase
    .from("hub_atendimento_pausas")
    .select("fonte, motivo")
    .eq("telefone_sufixo11", suf)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`pausa_gate: falha ao ler deny-list ${suf}: ${error.message}`);
  const row = data as { fonte?: string; motivo?: string } | null;
  if (!row) return { pausada: false, fonte: null, motivo: null };
  const res = { pausada: true, fonte: row.fonte ?? null, motivo: row.motivo ?? null };
  denyCache.set(suf, { fonte: res.fonte, motivo: res.motivo, exp: Date.now() + CACHE_TTL_MS });
  return res;
}

/**
 * Verdadeiro = NÃO responder ao cliente (silêncio total; a mensagem recebida é gravada à parte).
 * LANÇA em erro de banco (fail-closed) — o chamador (worker via processor) reclassifica para retry.
 */
export async function verificarPausaAtendimento(
  supabase: SupabaseClient,
  params: {
    telefone: string;
    agenteSlug?: string | null;
    leadCriadoEm?: string | null;
    leadMetadata?: Record<string, unknown> | null;
  }
): Promise<ResultadoPausa> {
  const telCanonico = telefoneConversaId(params.telefone);

  // (2) botão de pânico do agente
  if (await agenteEstaPausado(supabase, params.agenteSlug)) {
    return { pausada: true, motivo: "agente_pausado", fonte: "painel" };
  }

  // (3) deny-list (etiqueta "pausa" sincronizada / comando /pausa / seed da lista de clientes ativos)
  const deny = await telefoneNaDenyList(supabase, telCanonico);
  if (deny.pausada) {
    return { pausada: true, motivo: deny.motivo ?? `deny_${deny.fonte ?? "?"}`, fonte: deny.fonte };
  }

  // (4) trava temporal — só lead nascido pós go-live (a menos de override ia_liberada). Zero query.
  const golive = goliveAtMs();
  if (golive != null) {
    const meta = params.leadMetadata;
    const liberada = meta && typeof meta === "object" && (meta as { ia_liberada?: unknown }).ia_liberada === true;
    const criado = params.leadCriadoEm ? Date.parse(String(params.leadCriadoEm)) : NaN;
    if (!liberada && !Number.isNaN(criado) && criado < golive) {
      return { pausada: true, motivo: "lead_pre_golive", fonte: "temporal" };
    }
  }

  return { pausada: false, motivo: null, fonte: null };
}

/** Adiciona/atualiza uma pausa por telefone (comando, seed, painel, etiqueta). Invalida o cache. */
export async function pausarTelefone(
  supabase: SupabaseClient,
  input: { telefone: string; fonte: FontePausa; labelid?: string | null; motivo?: string | null; criadoPor?: string | null; tenantId?: string | null }
): Promise<{ ok: boolean; telefone?: string; error?: string }> {
  const telBruto = telefoneConversaId(input.telefone);
  if (!telBruto || telBruto.length < 10) return { ok: false, error: "telefone inválido" };
  const tel = comDdi55(telBruto); // garante 55 p/ o sufixo-11 bater com o inbound
  const { error } = await supabase
    .from("hub_atendimento_pausas")
    .upsert(
      {
        telefone: tel,
        fonte: input.fonte,
        labelid: input.labelid ?? null,
        motivo: input.motivo ?? null,
        criado_por: input.criadoPor ?? null,
        tenant_id: input.tenantId ?? null,
      },
      { onConflict: "telefone,fonte" }
    );
  invalidarCachePausas();
  if (error) return { ok: false, error: error.message };
  return { ok: true, telefone: tel };
}

/**
 * Remove pausas de um telefone. Default: comando+painel (NÃO mexe em 'etiqueta' — controlada pela
 * etiqueta no celular — NEM em 'seed' — a lista de clientes ativos não some por um /retoma; remover
 * um seed é ação explícita do painel). Laudo Fable, Médio 9.
 */
export async function retomarTelefone(
  supabase: SupabaseClient,
  input: { telefone: string; fontes?: FontePausa[] }
): Promise<{ ok: boolean; removidas: number; error?: string }> {
  const telBruto = telefoneConversaId(input.telefone);
  if (!telBruto || telBruto.length < 10) return { ok: false, removidas: 0, error: "telefone inválido" };
  const tel = comDdi55(telBruto);
  const fontes = input.fontes && input.fontes.length ? input.fontes : (["comando", "painel"] as FontePausa[]);
  const { data, error } = await supabase
    .from("hub_atendimento_pausas")
    .delete()
    .eq("telefone_sufixo11", sufixo11(tel))
    .in("fonte", fontes)
    .select("id");
  invalidarCachePausas();
  if (error) return { ok: false, removidas: 0, error: error.message };
  return { ok: true, removidas: Array.isArray(data) ? data.length : 0 };
}

export function invalidarCachePausas(): void {
  denyCache.clear();
}

export function invalidarCacheAgentePausa(agenteSlug?: string): void {
  if (agenteSlug) agenteCache.delete(agenteSlug.trim());
  else agenteCache.clear();
}

export type ComandoPausa = { acao: "pausa" | "retoma"; alvo: string };

/**
 * Interpreta o comando do celular do dono: "/pausa", "/retoma", "/pausa 11 98888-7777".
 * Sem número → alvo = telefone do chat atual. Com número (≥10 dígitos) → alvo = número citado.
 * Retorna null quando não é comando (segue o fluxo normal de handoff). Pura → testável.
 */
export function parseComandoPausa(texto: string, telefoneChatAtual: string): ComandoPausa | null {
  const m = /^\/(pausa|retoma)\b\s*(.*)$/i.exec((texto || "").trim());
  if (!m) return null;
  const acao = m[1].toLowerCase() as "pausa" | "retoma";
  const alvoDigits = (m[2] || "").replace(/\D/g, "");
  const alvo = alvoDigits.length >= 10 ? telefoneConversaId(alvoDigits) : telefoneChatAtual;
  return { acao, alvo };
}
