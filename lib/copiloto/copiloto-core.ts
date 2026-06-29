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
  // E0 — escrita de obra/EAP (operam sobre obra_id nos params, não sobre lead aberto).
  "hub_obra_criar",
  "hub_obra_eap_montar",
  // E2 — escrita de item (avanço/andamento; operam sobre obra_id/item_id, não sobre lead).
  "hub_obra_item_avanco",
  "hub_obra_item_andamento",
  // E3 — escrita de bloqueio (criar/resolver; operam sobre obra_id/item_id, não sobre lead).
  "hub_obra_bloqueio_criar",
  "hub_obra_bloqueio_resolver",
  // E5 — criar SC (compra; opera sobre obra_id, não sobre lead). A SC nasce em rascunho; APROVAR
  // a compra é 2º gate humano na tela (aprovar por voz é proibido por design).
  "hub_obra_sc_criar",
  // A0 — escrita de projeto/arquitetura (operam sobre projeto_id nos params, não sobre lead).
  "arq_criar_projeto",
  "arq_mover_estagio",
  "arq_programa_item",
  // A1 — aprovação do cliente (escrita CRÍTICA; operam sobre projeto_id/fase_id, não sobre lead).
  "arq_enviar_aprovacao",
  "arq_registrar_aprovacao",
  // A2 — elo Gerar Obra (escrita; opera sobre projeto_id, não sobre lead). Gate dourado humano.
  "arq_gerar_obra",
];

/**
 * Ferramentas de ESCRITA que operam sobre os PRÓPRIOS params (obra_id no body), não sobre
 * o lead aberto. O copiloto não deve exigir leadId para elas, nem injetar o modoOperacao
 * "canal_whatsapp" (elas não têm — e não devem ter — esse gate; são da Engenharia/global).
 */
export const COPILOTO_FERRAMENTAS_ESCRITA_SEM_LEAD: HubAgenteFerramentaId[] = [
  "hub_obra_criar",
  "hub_obra_eap_montar",
  "hub_obra_item_avanco",
  "hub_obra_item_andamento",
  "hub_obra_bloqueio_criar",
  "hub_obra_bloqueio_resolver",
  "hub_obra_sc_criar",
  "arq_criar_projeto",
  "arq_mover_estagio",
  "arq_programa_item",
  "arq_enviar_aprovacao",
  "arq_registrar_aprovacao",
  "arq_gerar_obra",
];

/** True se a ferramenta de escrita opera sem lead aberto (Engenharia/obra). */
export function escritaSemLead(tool: string): boolean {
  return (COPILOTO_FERRAMENTAS_ESCRITA_SEM_LEAD as string[]).includes(tool);
}

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

/** Ferramentas de Engenharia/Obra — injetadas só quando a rota é de obras/engenharia. */
const FERRAMENTAS_OBRA_DOC = `Ferramentas de ENGENHARIA/OBRA (use quando a tela for de obras):
- hub_obra_listar (LEITURA): lista as obras da carteira. Params: { "status"?: "<status>", "tipo_obra"?: "construcao|reforma|servico|…" }.
- hub_obra_resumo (LEITURA): resumo de UMA obra (status, tipo, nº de frentes). Params: { "obra_id": "<id da obra da tela>" }.
- hub_obra_hoje (LEITURA): fila de decisões do dia — atrasados, marcos dos próximos 15 dias e bloqueios das obras. Use para "o que pede decisão hoje", "o que está atrasado", "tem bloqueio". Params: {} (ou { "negocio_id"?: "<id>" }).
- hub_obra_criar (ESCRITA): cria obra nova com código automático e a EAP do preset. Params: { "titulo": "<nome>", "tipo_obra": "construcao|reforma|servico|…", "cliente_pessoa_id"?: "<id>", "cliente_empresa_id"?: "<id>" }. Em descricao_humana explique: "Vou criar a obra <titulo> (<tipo>) com a EAP padrão".
- hub_obra_eap_montar (ESCRITA): adiciona uma frente (disciplina) à EAP de uma obra. Params: { "obra_id": "<id>", "disciplina_slug": "eletrica|hidraulica|civil|…", "nome"?: "<texto>" }.
- hub_obra_item_listar (LEITURA): lista os itens de contrato da obra (avanço, situação automática pelo prazo, andamento, bloqueios). Filtra por disciplina/andar/situação. Use para "o que está atrasado na elétrica do andar 8", "itens da pintura", "o que está bloqueado". Params: { "obra_id": "<id da tela>", "disciplina_slug"?: "<slug>", "area_codigo"?: "ANDAR8|ROOFTOP|…", "situacao"?: "atrasado|em_andamento|…" }.
- hub_obra_item_avanco (ESCRITA): marca o % de avanço de UM item. Params: { "obra_id": "<id>", "item_id"?: "<id do item>", "nome"?: "<nome do item>", "area_codigo"?: "<andar p/ desambiguar>", "pct_avanco": 0..100 }. Se o nome existir em vários andares, NÃO aplique a vários — o sistema vai pedir para escolher. A Situação se recalcula sozinha (não a defina). Em descricao_humana: "Vou marcar <pct>% no item <nome> (<andar>)".
- hub_obra_item_andamento (ESCRITA): muda o andamento manual de um item e/ou marca bloqueios. Params: { "obra_id": "<id>", "item_id"?: "<id>", "nome"?: "<nome>", "area_codigo"?: "<andar>", "andamento"?: "nao_iniciado|iniciado|paralisado|finalizado|cancelado", "falta_material"?: true, "falta_pessoa"?: true, "falta_documento"?: true, "falta_ferramenta"?: true, "falta_equipamento"?: true }. "finalizado"/"cancelado" são decisões fortes — descreva com clareza. NUNCA escreva a Situação (é automática pelo prazo).
- hub_obra_bloqueios_listar (LEITURA): lista o que TRAVA as obras hoje (faltas com impacto e responsável). Use para "o que trava hoje", "o que está bloqueado", "o que falta na elétrica". Params: { "obra_id"?: "<id>", "tipo"?: "material|pessoa|documento|ferramenta|equipamento" }.
- hub_obra_bloqueio_criar (ESCRITA): registra um bloqueio (falta material/pessoa/documento/ferramenta/equipamento) num item ou na obra. Use para "tá faltando cimento no andar 9", "falta pedreiro na alvenaria". Params: { "obra_id": "<id>", "tipo": "material|pessoa|documento|ferramenta|equipamento", "item_id"?: "<id>", "nome"?: "<nome do item>", "area_codigo"?: "<andar p/ desambiguar>", "titulo"?: "<resumo, ex.: falta cimento>" }. Se o nome existir em vários andares, o sistema pede para escolher.
- hub_obra_bloqueio_resolver (ESCRITA): marca um bloqueio como resolvido (chegou/destravou) e limpa a falta no item. Use para "o cimento do 9 chegou", "já tem pedreiro na alvenaria". Params: { "obra_id": "<id>", "restricao_id"?: "<id>", "tipo"?: "material|pessoa|…", "item_id"?: "<id>", "nome"?: "<nome>", "area_codigo"?: "<andar>" }. Documento de SST NÃO é resolvido por voz. Decisão forte — descreva com clareza.
- hub_obra_estoque_consultar (LEITURA): consulta o inventário da obra (quanto há em estoque de cada item). Use para "quanto cimento tem", "tem vergalhão no estoque", "o que está zerado". Params: { "obra_id": "<id da tela>", "item"?: "<nome>", "categoria"?: "material|equipamento|servico|mao_de_obra" }.
- hub_obra_sc_criar (ESCRITA): cria uma SC (solicitação de compra) em RASCUNHO com um item + quantidade. Use para "pede 50 sacos de cimento", "preciso comprar vergalhão 10mm". Params: { "obra_id": "<id>", "item": "<o que comprar>", "quantidade": <número>, "tipo_material"?: "material|equipamento|servico|mao_de_obra", "frente_id"?: "<id da frente>" }. A SC nasce em RASCUNHO — APROVAR A COMPRA é decisão humana na tela (NUNCA por voz). Se o item casar com vários do catálogo, o sistema pede para escolher. Em descricao_humana: "Vou criar uma SC em rascunho: <qtd> <item>".`;

/** Ferramentas de Arquitetura/Projeto — injetadas só quando a rota é de arquitetura. */
const FERRAMENTAS_ARQ_DOC = `Ferramentas de ARQUITETURA/PROJETO (use quando a tela for de arquitetura/projetos):
- arq_resumo (LEITURA): lista os projetos da carteira (estágio, cliente, tipologia, aprovação). Params: { "estagio"?: "<slug>" }.
- arq_criar_projeto (ESCRITA): cria um projeto novo (código automático) em Briefing. Params: { "titulo"?: "<nome>", "tipologia"?: "residencial|corporativo|interiores|reforma|comercial|paisagismo", "cliente_nome"?: "<texto>", "area_m2"?: <número> }. Em descricao_humana explique: "Vou criar o projeto <titulo> (<tipologia>)".
- arq_mover_estagio (ESCRITA): move um projeto de estágio. Params: { "projeto_id": "<id do projeto da tela>", "estagio": "briefing|estudo|anteprojeto|executivo|aprovacao|entregue|arquivado" }.
- arq_programa_item (ESCRITA): monta o programa (cômodos) do projeto. Params: { "projeto_id": "<id>", "itens": ["sala","3 suítes","cozinha"] ou [{"nome":"Suíte máster","metragem_m2":18}] }.
- arq_enviar_aprovacao (ESCRITA): envia um entregável para o cliente aprovar. Params: { "projeto_id": "<id>", "fase_id": "<id do entregável>", "entregavel_url"?: "<url do arquivo, se anexar agora>" }. Use para "envia o executivo pro cliente aprovar". Se o entregável não tiver arquivo, o sistema pede para anexar a URL primeiro. Em descricao_humana: "Vou enviar <entregável> para o cliente aprovar".
- arq_registrar_aprovacao (ESCRITA): lança a resposta do cliente sobre um entregável aguardando. Params: { "projeto_id": "<id>", "fase_id": "<id>", "decisao": "aprovado|rejeitado", "motivo_rejeicao"?: "<obrigatório se rejeitado>" }. Use para "o cliente aprovou o anteprojeto", "o cliente reprovou o estudo, quer mudar a fachada". Rejeitar SEM motivo não é permitido — pergunte o motivo. Em descricao_humana: "Vou registrar que o cliente <aprovou|reprovou> <entregável>".
- arq_gerar_obra (ESCRITA): gera a OBRA de engenharia a partir de um projeto ENTREGUE/APROVADO (herda título, cliente, área, negócio + monta a EAP). Params: { "projeto_id": "<id do projeto da tela>", "titulo"?: "<nome do projeto, se não tiver o id>", "tipo_obra"?: "construcao|reforma|servico|…", "nome_obra"?: "<se diferente>" }. Use para "gera a obra do Casa Lago", "manda esse projeto pra engenharia". Se o projeto JÁ tem obra, o sistema avisa (não duplica); se não estiver entregue/aprovado, o sistema avisa. Em descricao_humana: "Vou gerar a obra do projeto <titulo>".`;

export function construirPromptCopiloto(ctx: { rota: string; temLead: boolean }): string {
  const rotaObra = /\/(obras|engenharia)/i.test(ctx.rota || "");
  const rotaArq = /\/arquitetura/i.test(ctx.rota || "");
  return `És o Copiloto de voz do Obra10+ (CRM de arquitetura/obra/imobiliário, Brasil). O dono fala um comando e tu classificas a INTENÇÃO numa ferramenta. NÃO executas nada — só propões. TODA escrita só acontece depois de o dono CONFIRMAR.

${FERRAMENTAS_LEITURA_DOC}

${FERRAMENTAS_ESCRITA_DOC}
${rotaObra ? `\n${FERRAMENTAS_OBRA_DOC}\n` : ""}${rotaArq ? `\n${FERRAMENTAS_ARQ_DOC}\n` : ""}
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
- ESCRITA (registar nota, atualizar lead${rotaObra ? ", criar obra, montar EAP, marcar avanço de item, mudar andamento de item, registrar bloqueio, resolver bloqueio, criar SC de compra" : ""}${rotaArq ? ", criar projeto, mover estágio, montar programa, enviar entregável para aprovação, registrar resposta do cliente, gerar obra do projeto" : ""}) → acao="escrever"; em descricao_humana explica o efeito em pt-BR simples.
- Escrita SOBRE LEAD exige lead aberto; se não houver, responde acao="nao_entendi" pedindo para abrir o lead.${rotaObra ? "\n- Criar obra / montar EAP / marcar avanço de item / mudar andamento de item / registrar bloqueio / resolver bloqueio / criar SC NÃO exigem lead aberto (usam o obra_id da tela). Se faltar o item ou o valor, pergunte UMA coisa (acao=\"nao_entendi\"), não invente. NUNCA escreva a Situação (é automática). Criar SC nasce em RASCUNHO — você NUNCA aprova a compra (aprovar é decisão humana na tela)." : ""}${rotaArq ? "\n- Criar projeto / mover estágio / montar programa / enviar para aprovação / registrar resposta / gerar obra NÃO exigem lead aberto. Para mover/programa/aprovação/gerar obra use o projeto_id da tela. Gerar obra só funciona se o projeto estiver entregue/aprovado e ainda não tiver obra — o sistema avisa nos dois casos (não force). Registrar reprovação SEM motivo não é permitido — pergunte o motivo. Se faltar dado essencial, pergunte UMA coisa (acao=\"nao_entendi\"), não invente." : ""}
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
