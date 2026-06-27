/**
 * Agent Builder por IA — gera um playbook (fluxo conversacional + regras de atendimento)
 * a partir de uma DESCRIÇÃO em linguagem natural do dono do agente.
 *
 * Estratégia (mesa redonda 27/jun): geração em DUAS fases para baixar a taxa de JSON inválido —
 *   Fase 1 (narrativa+regras, temp ~0.4): identidade, tom, saudação, pode/não-pode, o-que-coletar.
 *   Fase 2 (fluxo JSON, temp ~0.2): a PlaybookFlowDefinition (steps message/menu/input/complete).
 * Depois: parse/validate imediato → auto-fix reenviando os errors[] (até 2 tentativas, 2ª escalando
 * o modelo) → fallback ensureMarkdownWithWhatsappFlow (o dono nunca fica sem um playbook editável).
 *
 * A IA SUGERE; o dono confirma e publica (este módulo NÃO persiste nada).
 * Reusa: validatePlaybookFlowDefinition, upsertPlaybookFlowBlockInMarkdown, ensureMarkdownWithWhatsappFlow,
 * completarChatPreferindoMistral. Metering (Tijolos) é responsabilidade do endpoint, via os `usos` devolvidos.
 */

import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { validatePlaybookFlowDefinition } from "./flow-validate";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { upsertPlaybookFlowBlockInMarkdown } from "./playbook-flow-markdown";
import { ensureMarkdownWithWhatsappFlow } from "./playbook-flow-template";
import type { PlaybookFlowDefinition } from "./flow-definition-types";

/** Assinatura do helper LLM (injetável para testes). */
export type LlmCompletionFn = typeof completarChatPreferindoMistral;

/** Regras de trabalho/atendimento extraídas da descrição (Fase 1). */
export type PlaybookRegras = {
  identidade: string;
  tom: string;
  saudacao: string;
  pode_fazer: string[];
  nao_pode_fazer: string[];
  o_que_coletar: string[];
  perguntas_essenciais: string[];
};

/** Uso de tokens por fase — o endpoint usa para registrar consumo (Tijolos). */
export type UsoFaseIa = {
  fase: "narrativa" | "fluxo" | "auto_fix";
  modeloLog: string;
  tokensEntrada: number;
  tokensSaida: number;
};

export type GerarPlaybookOk = {
  ok: true;
  markdown: string;
  flowDefinition: PlaybookFlowDefinition;
  regras: PlaybookRegras;
  /** Avisos não-bloqueantes (ex.: usou fallback de template, auto-fix acionado). */
  avisos: string[];
  usos: UsoFaseIa[];
};

export type GerarPlaybookErro = { ok: false; erro: string; usos: UsoFaseIa[] };

export type GerarPlaybookOpts = {
  descricao: string;
  agenteNome: string;
  agenteSlug: string;
  /** Modelo "base" (Fase 1/2). Default "mistral". Auto-fix da 2ª tentativa escala para Claude. */
  modeloFromDb?: string;
  /** Modelo da última tentativa de auto-fix (mais robusto). Default "claude-sonnet-4-6". */
  modeloAutoFix?: string;
};

const MODELO_BASE_PADRAO = "mistral";
const MODELO_AUTOFIX_PADRAO = "claude-sonnet-4-6";
const MAX_AUTO_FIX = 2;

/** Documento do schema do fluxo embutido no prompt (compacto — NÃO o template inteiro). */
const SCHEMA_DOC = `O fluxo é um JSON \`PlaybookFlowDefinition\`:
{
  "obra10_playbook_flow_schema": 1,
  "entry_step_id": "<id do primeiro step>",
  "steps": [ ...PlaybookFlowStep ]
}
Cada step tem "id" (único, slug curto) e "kind". Os 4 tipos:
- message  → { "kind":"message", "id":"...", "message":"texto enviado ao cliente", "next":"<id>" }   // ou "complete":{...} para encerrar
- input    → { "kind":"input", "id":"...", "prompt":"pergunta", "field":"nome_campo", "input_type":"text|email|phone|number", "next":"<id>" }
- menu     → { "kind":"menu", "id":"...", "prompt":"pergunta", "menu_type":"button|list|text", "options":[ {"id":"op1","label":"Opção","next":"<id>"} ] }   // button=1-3 opções, list=4+; cada option tem "next" OU "complete"
- complete → { "kind":"complete", "id":"...", "complete":{ "type":"complete", "handoff_to":"arquitetura|imobiliario|parcerias|time_humano", "summary":"nota interna CRM", "user_message":"despedida ao cliente" } }
Regras DURAS: todo "next"/option.next/on_select aponta para um "id" REAL em steps; "entry_step_id" existe em steps; todo caminho termina em um step "complete" (ou message com "complete"); ids únicos; mensagens curtas (máx ~3 linhas). Opcional em qualquer step: "crm_patch":{ "estagio","potencial":"ALTO|MEDIO|BAIXO","tags_add":[...] }.`

const FLOW_EXEMPLO = `EXEMPLO mínimo (6 steps cobrindo os 4 kinds) — use como molde de ESTRUTURA, não de conteúdo:
{
  "obra10_playbook_flow_schema": 1,
  "entry_step_id": "saudacao",
  "steps": [
    { "kind": "message", "id": "saudacao", "message": "Oi! Sou a Ana, do Obra10+. Como posso te ajudar?", "next": "pergunta_nome" },
    { "kind": "input", "id": "pergunta_nome", "prompt": "Pra começar, qual é o seu nome?", "field": "nome", "input_type": "text", "next": "tipo" },
    { "kind": "menu", "id": "tipo", "prompt": "O que você procura?", "menu_type": "button", "options": [
      { "id": "projeto", "label": "Projeto de arquitetura", "next": "coleta_area" },
      { "id": "imovel", "label": "Comprar/alugar imóvel", "next": "fim_imovel" }
    ] },
    { "kind": "input", "id": "coleta_area", "prompt": "Qual a área aproximada em m²?", "field": "area_m2", "input_type": "number", "next": "fim_projeto" },
    { "kind": "complete", "id": "fim_projeto", "complete": { "type": "complete", "handoff_to": "arquitetura", "summary": "Lead de projeto qualificado", "user_message": "Perfeito! Um arquiteto vai te chamar já já. 🙌" } },
    { "kind": "complete", "id": "fim_imovel", "complete": { "type": "complete", "handoff_to": "imobiliario", "summary": "Lead imobiliário", "user_message": "Show! Um corretor entra em contato em breve." } }
  ]
}`

function extrairJsonObjeto(raw: string): Record<string, unknown> | null {
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

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function asArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function normalizarRegras(o: Record<string, unknown>, nome: string): PlaybookRegras {
  return {
    identidade: asStr(o.identidade, `Você é ${nome}, atendente do Obra10+.`),
    tom: asStr(o.tom, "Cordial, objetivo e humano. Máximo 3 linhas por mensagem."),
    saudacao: asStr(o.saudacao, `Oi! Sou ${nome}, do Obra10+. Como posso te ajudar?`),
    pode_fazer: asArr(o.pode_fazer).slice(0, 12),
    nao_pode_fazer: asArr(o.nao_pode_fazer).slice(0, 12),
    o_que_coletar: asArr(o.o_que_coletar).slice(0, 12),
    perguntas_essenciais: asArr(o.perguntas_essenciais).slice(0, 12),
  };
}

const SYSTEM_NARRATIVA = `És um especialista em desenhar atendimentos de IA para o ecossistema Obra10+ (arquitetura, obra/reforma, imobiliário — Brasil).
Recebes uma DESCRIÇÃO em linguagem natural de como o agente deve atender. Devolves APENAS um objeto JSON válido (sem markdown à volta, sem texto antes/depois) com as REGRAS de trabalho:
{
 "identidade": "1-2 frases: quem é o agente e sua missão",
 "tom": "como se comunica (ex.: cordial, objetivo, máx. 3 linhas)",
 "saudacao": "primeira mensagem ao cliente no WhatsApp, curta e natural — sem citar cargo/função interna",
 "pode_fazer": ["ações que o agente DEVE/pode fazer", "..."],
 "nao_pode_fazer": ["limites e proibições", "..."],
 "o_que_coletar": ["dados a coletar do lead", "..."],
 "perguntas_essenciais": ["perguntas de qualificação na ordem", "..."]
}
Português do Brasil. Listas curtas e acionáveis (máx. 12). Respeita fielmente o que a descrição pede; preenche lacunas com bom senso do mercado, sem inventar políticas comerciais específicas.`

function buildSystemFluxo(): string {
  return `És um especialista em montar FLUXOS conversacionais determinísticos para WhatsApp no Obra10+.
Recebes a DESCRIÇÃO do atendimento e as REGRAS já definidas. Devolves APENAS o JSON do fluxo (sem markdown à volta, sem texto antes/depois).

${SCHEMA_DOC}

${FLOW_EXEMPLO}

Diretrizes: começa por saudação + captura do nome; uma pergunta por step; usa "menu" para escolhas (button até 3 opções, list para 4+); usa "input" para dados livres; encerra cada caminho com "complete" + handoff coerente; mensagens curtas e humanas; ids em slug (ex.: "qualifica_area"). NUNCA deixes um "next" apontando para id inexistente.`
}

function buildUserFluxo(descricao: string, regras: PlaybookRegras, errosAnteriores?: string[]): string {
  const base = `## Descrição do atendimento
${descricao}

## Regras já definidas (JSON)
${JSON.stringify(regras, null, 0)}

## Saída
Apenas o JSON do PlaybookFlowDefinition.`
  if (errosAnteriores?.length) {
    return `${base}

## ⚠ A tua tentativa anterior foi INVÁLIDA. Corrige EXATAMENTE estes erros e devolve o JSON completo de novo:
${errosAnteriores.map((e) => `- ${e}`).join("\n")}`
  }
  return base
}

function montarNarrativaMarkdown(regras: PlaybookRegras, nome: string, slug: string): string {
  const li = (arr: string[]) => (arr.length ? arr.map((x) => `- ${x}`).join("\n") : "- (a definir)");
  const ol = (arr: string[]) => (arr.length ? arr.map((x, i) => `${i + 1}. ${x}`).join("\n") : "1. (a definir)");
  return `---
obra10_playbook_schema: 1
obra10_agente_slug: "${slug}"
obra10_agente_nome: "${nome}"
---

# Playbook — ${nome}

## §1 — Identidade
${regras.identidade}

**Tom:** ${regras.tom}

## §2 — Saudação
${regras.saudacao}

## §3 — O que ${nome} PODE fazer
${li(regras.pode_fazer)}

## §4 — O que ${nome} NÃO pode fazer
${li(regras.nao_pode_fazer)}

## §5 — O que coletar
${li(regras.o_que_coletar)}

## §6 — Perguntas essenciais
${ol(regras.perguntas_essenciais)}
`
}

/** Gera um playbook completo (regras + fluxo) a partir de uma descrição. NÃO persiste. */
export async function gerarPlaybookViaIa(
  opts: GerarPlaybookOpts,
  deps?: { llm?: LlmCompletionFn }
): Promise<GerarPlaybookOk | GerarPlaybookErro> {
  const llm = deps?.llm ?? completarChatPreferindoMistral;
  const descricao = (opts.descricao ?? "").trim();
  const nome = (opts.agenteNome ?? "").trim() || "Assistente";
  const slug = (opts.agenteSlug ?? "").trim() || "agente";
  const modeloBase = (opts.modeloFromDb ?? "").trim() || MODELO_BASE_PADRAO;
  const modeloAutoFix = (opts.modeloAutoFix ?? "").trim() || MODELO_AUTOFIX_PADRAO;
  const usos: UsoFaseIa[] = [];
  const avisos: string[] = [];

  if (descricao.length < 12) {
    return { ok: false, erro: "Descreva com um pouco mais de detalhe como o agente deve atender (mín. 12 caracteres).", usos };
  }

  // ── Fase 1: narrativa + regras ──────────────────────────────────────────
  const r1 = await llm({
    systemPrompt: SYSTEM_NARRATIVA,
    mensagens: [{ role: "user", content: `## Descrição\n${descricao}\n\n## Agente\n${nome}` }],
    modeloFromDb: modeloBase,
    maxTokens: 1400,
  });
  if (!r1.ok) return { ok: false, erro: `Falha ao gerar as regras: ${r1.erro}`, usos };
  usos.push({ fase: "narrativa", modeloLog: r1.modeloLog, tokensEntrada: r1.tokensEntrada, tokensSaida: r1.tokensSaida });
  const regrasObj = extrairJsonObjeto(r1.texto);
  const regras = normalizarRegras(regrasObj ?? {}, nome);
  if (!regrasObj) avisos.push("A IA não devolveu regras estruturadas; usei valores padrão coerentes.");

  // ── Fase 2: fluxo JSON, com auto-fix ────────────────────────────────────
  let flowDefinition: PlaybookFlowDefinition | null = null;
  let ultimosErros: string[] = [];
  for (let tentativa = 0; tentativa <= MAX_AUTO_FIX; tentativa++) {
    const ehAutoFix = tentativa > 0;
    const modelo = tentativa >= MAX_AUTO_FIX ? modeloAutoFix : modeloBase; // última tentativa escala
    const r = await llm({
      systemPrompt: buildSystemFluxo(),
      mensagens: [{ role: "user", content: buildUserFluxo(descricao, regras, ehAutoFix ? ultimosErros : undefined) }],
      modeloFromDb: modelo,
      maxTokens: 3000,
    });
    if (!r.ok) {
      ultimosErros = [`Erro do provedor IA: ${r.erro}`];
      continue;
    }
    usos.push({ fase: ehAutoFix ? "auto_fix" : "fluxo", modeloLog: r.modeloLog, tokensEntrada: r.tokensEntrada, tokensSaida: r.tokensSaida });
    const obj = extrairJsonObjeto(r.texto);
    if (!obj) {
      ultimosErros = ["A resposta não continha um objeto JSON válido."];
      continue;
    }
    const v = validatePlaybookFlowDefinition(obj);
    if (v.ok) {
      flowDefinition = v.definition;
      if (ehAutoFix) avisos.push(`Fluxo corrigido automaticamente após ${tentativa} ajuste(s).`);
      break;
    }
    ultimosErros = v.errors;
  }

  const narrativaMd = montarNarrativaMarkdown(regras, nome, slug);

  // ── Fluxo válido: monta markdown final ──────────────────────────────────
  if (flowDefinition) {
    return {
      ok: true,
      markdown: upsertPlaybookFlowBlockInMarkdown(narrativaMd, flowDefinition),
      flowDefinition,
      regras,
      avisos,
      usos,
    };
  }

  // ── Fallback: garante um playbook editável mesmo se o LLM falhar o fluxo ─
  const fb = await ensureMarkdownWithWhatsappFlow(narrativaMd);
  if (fb.ok) {
    // o fallback injeta o esqueleto do template; re-extrai a definição com o parser próprio
    const parsed = parsePlaybookFlowFromMarkdown(fb.markdown);
    avisos.push(
      "A IA não conseguiu um fluxo válido; gerei um esqueleto-base a partir do template para você editar." +
        (ultimosErros.length ? ` (último erro: ${ultimosErros[0]})` : "")
    );
    return {
      ok: true,
      markdown: fb.markdown,
      flowDefinition: parsed.ok
        ? parsed.definition
        : ({ obra10_playbook_flow_schema: 1, entry_step_id: "", steps: [] } as PlaybookFlowDefinition),
      regras,
      avisos,
      usos,
    };
  }

  return {
    ok: false,
    erro: `Não foi possível montar um fluxo válido. ${ultimosErros[0] ?? ""}`.trim(),
    usos,
  };
}
