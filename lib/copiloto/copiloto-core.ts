/**
 * Núcleo do Copiloto de Voz Global (Fase 0) — comando por voz em qualquer tela.
 *
 * Travas de segurança (por construção, não convenção):
 *  - Só ferramentas com HUB_FERRAMENTA_ACESSO === "leitura" são executáveis nesta fase.
 *  - Confirmação stateless via HMAC: o /interpretar assina (ferramenta+params+ts);
 *    o /executar revalida a assinatura + TTL antes de executar. Sem tabela nova.
 *  - Rate-limit por tenant (memória, TTL 60s) para conter spam de microfone.
 *
 * A IA SUGERE; o dono confirma toda ESCRITA (escrita só liga na Fase 3).
 */

import { createHmac, timingSafeEqual } from "crypto";
import {
  HUB_FERRAMENTA_ACESSO,
  type HubAgenteFerramentaId,
  type HubFerramentaNivelAcesso,
} from "@/lib/hub/agente-ferramentas-registry";

/** Slug do agente-copiloto resolvido em runtime (sem seed no banco até a Fase 6). */
export const COPILOTO_AGENTE_SLUG = "copiloto-global";

/** Ferramentas liberadas na Fase 1 (somente leitura). */
export const COPILOTO_FERRAMENTAS_LEITURA: HubAgenteFerramentaId[] = (
  Object.keys(HUB_FERRAMENTA_ACESSO) as HubAgenteFerramentaId[]
).filter((id) => HUB_FERRAMENTA_ACESSO[id] === "leitura");

export function nivelDaFerramenta(tool: string): HubFerramentaNivelAcesso | null {
  return (HUB_FERRAMENTA_ACESSO as Record<string, HubFerramentaNivelAcesso>)[tool] ?? null;
}

/** Descrição compacta das ferramentas de leitura para o prompt de classificação. */
const FERRAMENTAS_DOC = `Ferramentas disponíveis (TODAS de leitura — nunca alteram dados):
- hub_lead_resumo: resumo do lead atual no CRM (estágio, contato, responsáveis). Params: {} (usa o lead da tela).
- hub_lead_memorias: memórias/notas automáticas guardadas sobre o lead atual. Params: {}.
- hub_lead_lookup_por_telefone: busca a ficha de um lead pelo telefone. Params: { "telefone": "<só dígitos>" }.
- hub_metricas_escritorio: métricas gerais do escritório (leads, conversões). Params: {}.`;

export function construirPromptCopiloto(ctx: { rota: string; temLead: boolean }): string {
  return `És o Copiloto de voz do Obra10+ (CRM de arquitetura/obra/imobiliário, Brasil). O dono fala um comando e tu classificas a INTENÇÃO numa ferramenta de LEITURA. NÃO executas nada — só propões.

${FERRAMENTAS_DOC}

Contexto atual: rota="${ctx.rota}"${ctx.temLead ? " (há um lead aberto nesta tela — use {} para operar sobre ele)" : " (sem lead aberto)"}.

Devolve APENAS um objeto JSON (sem markdown), com:
{
 "acao": "ler" | "nao_entendi",
 "ferramenta": "<uma das ferramentas acima, ou vazio se nao_entendi>",
 "params": { ... },
 "descricao_humana": "frase curta em pt-BR do que vais responder",
 "confianca": 0.0..1.0
}
Se o pedido envolver ALTERAR/criar/salvar algo, responde acao="nao_entendi" e descricao_humana explicando que escrita por voz ainda não está disponível. Se não houver lead aberto e a ferramenta precisar de um, peça o telefone via hub_lead_lookup_por_telefone.`;
}

// ── Confirmação stateless (HMAC) ─────────────────────────────────────────────
function segredo(): string {
  return process.env.COPILOTO_HMAC_SECRET?.trim() || "copiloto-dev-secret-trocar-em-prod";
}

export function assinarConfirmacao(
  ferramenta: string,
  params: Record<string, unknown>,
  ts: number
): string {
  const payload = `${ferramenta}|${JSON.stringify(params)}|${ts}`;
  return createHmac("sha256", segredo()).update(payload).digest("hex");
}

const TTL_CONFIRMACAO_MS = 5 * 60 * 1000;

export function validarConfirmacao(
  confirmacaoId: string,
  ferramenta: string,
  params: Record<string, unknown>,
  ts: number
): { ok: true } | { ok: false; erro: string } {
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_CONFIRMACAO_MS) {
    return { ok: false, erro: "confirmacao_expirada" };
  }
  const esperado = assinarConfirmacao(ferramenta, params, ts);
  const a = Buffer.from(confirmacaoId || "", "utf8");
  const b = Buffer.from(esperado, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, erro: "confirmacao_invalida" };
  }
  return { ok: true };
}

// ── Rate-limit por tenant (memória, best-effort) ─────────────────────────────
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_JANELA_MS = 60_000;
const rateMap = new Map<string, number[]>();

export function dentroDoRateLimit(tenantId: string): boolean {
  const agora = Date.now();
  const arr = (rateMap.get(tenantId) ?? []).filter((t) => agora - t < RATE_LIMIT_JANELA_MS);
  if (arr.length >= RATE_LIMIT_MAX) {
    rateMap.set(tenantId, arr);
    return false;
  }
  arr.push(agora);
  rateMap.set(tenantId, arr);
  return true;
}

/** Extrai JSON de uma resposta da IA (com ou sem cercas markdown). */
export function extrairJsonObjeto(raw: string): Record<string, unknown> | null {
  const t = (raw ?? "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const inner = fence ? fence[1].trim() : t;
  const start = inner.indexOf("{");
  const end = inner.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(inner.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
