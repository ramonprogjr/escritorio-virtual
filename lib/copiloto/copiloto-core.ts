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

/**
 * Allowlist de ESCRITA liberada na Fase 3 (estrita — qualquer outra escrita continua bloqueada).
 * NÃO inclui hub_crm_criar_cadastro, hub_whatsapp_menu nem ferramentas de relatório:
 * criar cadastro / disparar WhatsApp são irreversíveis-para-fora e ficam para fases futuras.
 */
export const COPILOTO_FERRAMENTAS_ESCRITA_FASE3: HubAgenteFerramentaId[] = [
  "hub_registar_nota_lead",
  "hub_atualizar_lead",
];

/**
 * Uma ferramenta é executável pelo copiloto se for de LEITURA (auto-exec) OU
 * se estiver na allowlist de escrita da Fase 3 (só após confirmação humana).
 * Gate por construção: o que não passa por aqui é 403 no /executar.
 */
export function ferramentaExecutavel(tool: string): boolean {
  if (nivelDaFerramenta(tool) === "leitura") return true;
  return (COPILOTO_FERRAMENTAS_ESCRITA_FASE3 as string[]).includes(tool);
}

/** Descrição compacta das ferramentas de LEITURA (auto-executam, nunca alteram dados). */
const FERRAMENTAS_LEITURA_DOC = `Ferramentas de LEITURA (acao="ler" — nunca alteram dados, respondem na hora):
- hub_lead_resumo: resumo do lead atual no CRM (estágio, contato, responsáveis). Params: {} (usa o lead da tela).
- hub_lead_memorias: memórias/notas automáticas guardadas sobre o lead atual. Params: {}.
- hub_lead_lookup_por_telefone: busca a ficha de um lead pelo telefone. Params: { "telefone": "<só dígitos>" }.
- hub_metricas_escritorio: métricas gerais do escritório (leads, conversões). Params: {}.`;

/**
 * Ferramentas de ESCRITA liberadas na Fase 3. Params reais (lidos do executor).
 * Para ESCRITA o copiloto SÓ propõe — quem confirma é o dono, com um clique.
 */
const FERRAMENTAS_ESCRITA_DOC = `Ferramentas de ESCRITA (acao="escrever" — ALTERAM dados; exigem que o dono confirme depois):
- hub_registar_nota_lead: adiciona uma NOTA na linha do tempo do lead atual. Params: { "texto": "<a nota, em pt-BR>" }.
- hub_atualizar_lead: atualiza campos do lead ATUAL. Envie só os campos a mudar. Params possíveis:
    { "estagio": "novo|em_atendimento|aguardando_resposta|qualificando|encaminhado|qualificado|proposta|negociando|fechamento",
      "score": 0..100, "valor_estimado": <número>, "nome": "<texto>", "email": "<texto>",
      "interesse_principal": "<texto>", "proxima_acao": "<texto>", "data_proxima_acao": "<ISO ou data>",
      "tags_adicionar": ["tag"] }.
    NÃO mude estágio para "ganho", "perdido", "convertido_negocio" nem "spam_invalido" (isso é decisão humana no CRM).`;

export function construirPromptCopiloto(ctx: { rota: string; temLead: boolean }): string {
  return `És o Copiloto de voz do Obra10+ (CRM de arquitetura/obra/imobiliário, Brasil). O dono fala um comando e tu classificas a INTENÇÃO numa ferramenta. NÃO executas nada — só propões. TODA escrita só acontece depois de o dono CONFIRMAR.

${FERRAMENTAS_LEITURA_DOC}

${FERRAMENTAS_ESCRITA_DOC}

Contexto atual: rota="${ctx.rota}"${ctx.temLead ? " (há um lead aberto nesta tela — use {} ou opere sobre ele)" : " (sem lead aberto — escrita sobre lead não é possível sem lead aberto)"}.

Devolve APENAS um objeto JSON (sem markdown), com:
{
 "acao": "ler" | "escrever" | "nao_entendi",
 "ferramenta": "<uma das ferramentas acima, ou vazio se nao_entendi>",
 "params": { ... },
 "descricao_humana": "frase curta em pt-BR; se for escrever, descreve CLARAMENTE o que vai mudar (ex.: 'Vou marcar o lead como qualificado e anotar que ele pediu orçamento')",
 "confianca": 0.0..1.0
}
Regras:
- LEITURA → acao="ler".
- ESCRITA (registar nota OU atualizar lead) → acao="escrever"; em descricao_humana explica o efeito em pt-BR simples.
- Escrita sobre lead exige lead aberto; se não houver, responde acao="nao_entendi" pedindo para abrir o lead.
- Qualquer outra ação (criar cadastro, enviar WhatsApp, apagar) → acao="nao_entendi" dizendo que ainda não está disponível por voz.`;
}

// ── Confirmação stateless (HMAC) ─────────────────────────────────────────────

/** Erro tipado: segredo HMAC ausente em produção (fail-closed). */
export class CopilotoSegredoAusenteError extends Error {
  constructor() {
    super("copiloto indisponível: segredo não configurado");
    this.name = "CopilotoSegredoAusenteError";
  }
}

const SEGREDO_DEV_FALLBACK = "copiloto-dev-secret-trocar-em-prod";

/**
 * Segredo do HMAC. Fail-closed: em produção, COPILOTO_HMAC_SECRET é OBRIGATÓRIO —
 * sem ele, lança CopilotoSegredoAusenteError (assinar/validar viram 503 no endpoint).
 * Em dev/test mantém o fallback com aviso, para não travar o desenvolvimento.
 */
function segredo(): string {
  const env = process.env.COPILOTO_HMAC_SECRET?.trim();
  if (env) return env;
  if (process.env.NODE_ENV === "production") {
    throw new CopilotoSegredoAusenteError();
  }
  console.warn(
    "[copiloto] COPILOTO_HMAC_SECRET ausente — usando segredo de DEV. Configure em produção."
  );
  return SEGREDO_DEV_FALLBACK;
}

/**
 * Assina a proposta. O `leadId` (contexto no momento do /interpretar) entra DENTRO da
 * assinatura: se o dono navegar para outro lead e confirmar, o leadId do /executar não
 * casa e a proposta é recusada — a escrita nunca cai no lead errado.
 * `leadId` vazio (leitura sem lead) é normalizado para "".
 */
export function assinarConfirmacao(
  ferramenta: string,
  params: Record<string, unknown>,
  ts: number,
  leadId = ""
): string {
  const lead = (leadId || "").trim();
  const payload = `${ferramenta}|${JSON.stringify(params)}|${lead}|${ts}`;
  return createHmac("sha256", segredo()).update(payload).digest("hex");
}

const TTL_CONFIRMACAO_MS = 5 * 60 * 1000;

export function validarConfirmacao(
  confirmacaoId: string,
  ferramenta: string,
  params: Record<string, unknown>,
  ts: number,
  leadId = ""
): { ok: true } | { ok: false; erro: string } {
  if (!Number.isFinite(ts) || Date.now() - ts > TTL_CONFIRMACAO_MS) {
    return { ok: false, erro: "confirmacao_expirada" };
  }
  const esperado = assinarConfirmacao(ferramenta, params, ts, leadId);
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
