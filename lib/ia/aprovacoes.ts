// ============================================================
// APROVAÇÕES — Sistema Universal de Aprovação Humana
// Tudo que precisa de humano chega aqui como card completo
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Grava no log de decisões SEMPRE com `tenant_id` (log de dinheiro nunca órfão — service_role
 * bypassa RLS). TOLERÂNCIA: a coluna `tenant_id` é adicionada a hub_decision_logs pela migração E7
 * (ESTRUTURA-UNIFICADA §7); enquanto ela não é aplicada, o INSERT com tenant_id falharia
 * (PGRST204/42703). Detectamos isso e repetimos SEM o tenant_id — o log continua sendo gravado
 * (degrade honesto), nunca quebra o fluxo de aprovação.
 */
async function registrarDecisao(
  db: ReturnType<typeof supabase>,
  tenant: string,
  linha: Record<string, unknown>
): Promise<void> {
  const comTenant = { tenant_id: tenant, ...linha };
  const { error } = await db.from("hub_decision_logs").insert(comTenant);
  if (error && isMissingPgColumn(error, "tenant_id")) {
    await db.from("hub_decision_logs").insert(linha); // migração E7 ainda não aplicada
  }
}

/**
 * Postgres: a função/RPC ainda não existe no schema (migração E7b não aplicada). PostgREST devolve
 * 42883 (undefined_function) e/ou uma mensagem "function ... does not exist" / "could not find the
 * function". Detectamos pelos dois sinais para tolerar diferentes versões do PostgREST.
 */
function isMissingPgFunction(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === "42883" || err.code === "PGRST202") return true;
  const m = (err.message || "").toLowerCase();
  return (
    (m.includes("function") && (m.includes("does not exist") || m.includes("could not find"))) ||
    m.includes("schema cache")
  );
}

/**
 * AUT-1 / SEC-8 (integridade financeira): registra no log de decisões que o snapshot de custo
 * FALHOU por um erro REAL (não "função ausente"). Best-effort puro — nunca lança, nunca bloqueia.
 * Usa registrarDecisao (tenant SEMPRE; tolera a coluna tenant_id ausente). Sem isto, um custo
 * não-materializado some do radar (só ia para console.warn, invisível à reconciliação).
 */
async function logarFalhaSnapshot(
  db: ReturnType<typeof supabase>,
  tenant: string,
  obraId: string,
  frenteId: string | null,
  detalhe: string
): Promise<void> {
  try {
    await registrarDecisao(db, tenant, {
      agente_slug: "hub",
      tipo: "snapshot_custo_falhou",
      descricao: `Snapshot de custo da frente falhou (reconciliar): obra=${obraId} frente=${
        frenteId ?? "todas"
      } — ${detalhe}`.slice(0, 1000),
      aprovado_por: "sistema",
      resultado: "falha_snapshot_custo",
    });
  } catch {
    // O log de reconciliação é best-effort sobre best-effort — nunca afeta a aprovação.
  }
}

/**
 * E7c (Fase 3a — decisão #1): copia o snapshot de custo dos orçamentos APROVADOS da frente para o
 * item-mãe, via rpc_snapshot_custo_frente (E7b). TOLERANTE: se a função ainda não existe (migração
 * E7b pendente), ignora silenciosamente — a aprovação JAMAIS quebra por causa do snapshot de custo.
 * tenant_id é sempre o da sessão (já validado em aprovar()). Qualquer outro erro também é tolerado,
 * mas AGORA é REGISTRADO em hub_decision_logs (AUT-1/SEC-8): o snapshot é um efeito secundário do
 * gate, nunca um bloqueador do dinheiro — porém um custo que não materializou precisa de rastro para
 * reconciliação, não pode evaporar num console.warn.
 */
async function snapshotCustoFrenteTolerante(
  db: ReturnType<typeof supabase>,
  obraId: string,
  frenteId: string | null,
  tenant: string
): Promise<void> {
  try {
    const { error } = await db.rpc("rpc_snapshot_custo_frente", {
      p_obra_id: obraId,
      p_frente_id: frenteId,
      p_tenant_id: tenant,
    });
    // A ausência da FUNÇÃO (E7b não aplicada) continua silenciosa — é estado esperado, não falha.
    if (error && !isMissingPgFunction(error)) {
      console.warn("[APROVAÇÕES] snapshot de custo falhou (ignorado, não bloqueia):", error.message);
      await logarFalhaSnapshot(db, tenant, obraId, frenteId, error.message || "erro_desconhecido");
    }
  } catch (e) {
    // Falha de rede/qualquer exceção: o snapshot é best-effort. A aprovação já foi gravada.
    console.warn("[APROVAÇÕES] snapshot de custo lançou exceção (ignorado):", e);
    await logarFalhaSnapshot(
      db,
      tenant,
      obraId,
      frenteId,
      e instanceof Error ? e.message : "excecao_desconhecida"
    );
  }
}

export type TipoAprovacao =
  | "proposta"
  | "campanha"
  | "conteudo"
  | "site"
  | "ajuste_agente"
  | "trafego"
  | "contrato"
  | "financeiro"
  | "atendimento_critico"
  | "cotacao_fornecedor"
  // E6 (dinheiro) — gate dourado: orçamento da frente + as 2 chaves do pagamento.
  | "orcamento_frente"
  | "pagamento_obra_arq"
  | "pagamento_obra_hub";

export interface CardAprovacao {
  id: string;
  tipo: TipoAprovacao;
  titulo: string;
  descricao: string;
  agenteSlug: string;
  agenteNome: string;
  leadId?: string;
  clienteNome?: string;
  valorEnvolvido?: number;
  impacto: string;
  recomendacao: string;
  confiancaIA: number;
  prazo?: string;
  dados: Record<string, unknown>;
  status: "pendente" | "aprovado" | "rejeitado";
  criadoEm: string;
  acoes: AcaoCard[];
}

export interface AcaoCard {
  label: string;
  tipo: "aprovar" | "rejeitar" | "ver_mais" | "editar";
  estilo: "primario" | "secundario" | "perigo" | "neutro";
}

// ── BUSCAR APROVAÇÕES PENDENTES ───────────────────────────────
// SEGURANÇA (F0/E6): filtro de tenant OBRIGATÓRIO. supabase() usa service_role e BYPASSA RLS,
// então o `.eq("tenant_id")` no código é a ÚNICA barreira contra um tenant ver/aprovar a fila
// de outro. `tenantId` vem SEMPRE da sessão do chamador (nunca do body/header). Sem ele, a função
// recusa-se a vazar tudo: devolve [] (fail-closed), em vez de varrer a tabela inteira.
export async function buscarAprovacoesPendentes(
  tenantId?: string | null
): Promise<CardAprovacao[]> {
  const tenant = (tenantId ?? "").trim();
  if (!tenant) return []; // fail-closed: sem tenant, nada de fila global

  const db = supabase();

  const { data } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("tenant_id", tenant)
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  if (!data) return [];

  return data.map((item: Record<string, unknown>) => montarCard(item));
}

// ── MONTAR CARD DE APROVAÇÃO ──────────────────────────────────
function montarCard(item: Record<string, unknown>): CardAprovacao {
  const tipo = item.tipo as TipoAprovacao;
  const dados = item.dados as Record<string, unknown> || {};

  const ACOES_POR_TIPO: Record<TipoAprovacao, AcaoCard[]> = {
    proposta: [
      { label: "Aprovar proposta", tipo: "aprovar", estilo: "primario" },
      { label: "Ver proposta completa", tipo: "ver_mais", estilo: "neutro" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
    campanha: [
      { label: "Aprovar ação", tipo: "aprovar", estilo: "primario" },
      { label: "Ver análise", tipo: "ver_mais", estilo: "neutro" },
      { label: "Ignorar", tipo: "rejeitar", estilo: "secundario" },
    ],
    conteudo: [
      { label: "Aprovar", tipo: "aprovar", estilo: "primario" },
      { label: "Pedir ajuste", tipo: "rejeitar", estilo: "secundario" },
      { label: "Ver conteúdo", tipo: "ver_mais", estilo: "neutro" },
    ],
    site: [
      { label: "Aprovar publicação", tipo: "aprovar", estilo: "primario" },
      { label: "Pedir revisão", tipo: "rejeitar", estilo: "secundario" },
      { label: "Ver página", tipo: "ver_mais", estilo: "neutro" },
    ],
    ajuste_agente: [
      { label: "Aprovar ajuste", tipo: "aprovar", estilo: "primario" },
      { label: "Ver análise completa", tipo: "ver_mais", estilo: "neutro" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
    trafego: [
      { label: "Aprovar ação", tipo: "aprovar", estilo: "primario" },
      { label: "Ver dados", tipo: "ver_mais", estilo: "neutro" },
      { label: "Ignorar por agora", tipo: "rejeitar", estilo: "secundario" },
    ],
    contrato: [
      { label: "Assinar contrato", tipo: "aprovar", estilo: "primario" },
      { label: "Revisar termos", tipo: "editar", estilo: "secundario" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    financeiro: [
      { label: "Autorizar", tipo: "aprovar", estilo: "primario" },
      { label: "Ver detalhes", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    atendimento_critico: [
      { label: "Assumir atendimento", tipo: "aprovar", estilo: "primario" },
      { label: "Atribuir para equipe", tipo: "editar", estilo: "secundario" },
      { label: "Ver conversa", tipo: "ver_mais", estilo: "neutro" },
    ],
    cotacao_fornecedor: [
      { label: "Aprovar fornecedor sugerido", tipo: "aprovar", estilo: "primario" },
      { label: "Ver propostas", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    // E6 — gate dourado do dinheiro (humano aprova; a IA nunca chega aqui).
    orcamento_frente: [
      { label: "Aprovar orçamento", tipo: "aprovar", estilo: "primario" },
      { label: "Ver itens", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    pagamento_obra_arq: [
      { label: "Autorizar (Arquitetura)", tipo: "aprovar", estilo: "primario" },
      { label: "Ver pagamento", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
    pagamento_obra_hub: [
      { label: "Autorizar (Hub)", tipo: "aprovar", estilo: "primario" },
      { label: "Ver pagamento", tipo: "ver_mais", estilo: "neutro" },
      { label: "Recusar", tipo: "rejeitar", estilo: "perigo" },
    ],
  };

  return {
    id: item.id as string,
    tipo,
    titulo: item.descricao as string || "Aprovação pendente",
    descricao: item.motivo as string || "",
    agenteSlug: item.agente_slug as string || "",
    agenteNome: item.agente_nome as string || item.agente_slug as string || "",
    leadId: item.lead_id as string,
    clienteNome: dados.cliente_nome as string,
    valorEnvolvido: item.valor_envolvido as number || dados.valor as number,
    impacto: item.impacto as string || "",
    recomendacao: item.recomendacao as string || "IA recomenda aprovação",
    confiancaIA: item.confianca_ia as number || 85,
    prazo: item.prazo as string,
    dados,
    status: item.status as "pendente" | "aprovado" | "rejeitado",
    criadoEm: item.criado_em as string,
    acoes: ACOES_POR_TIPO[tipo] || [
      { label: "Aprovar", tipo: "aprovar", estilo: "primario" },
      { label: "Rejeitar", tipo: "rejeitar", estilo: "perigo" },
    ],
  };
}

// ── APROVAR ───────────────────────────────────────────────────
// SEGURANÇA (F0/E6): `tenantId` da sessão escopa a leitura E o update. O escrow leva DINHEIRO por
// este gate — sem o filtro, um tenant aprovaria a aprovação de outro (service_role bypassa RLS).
// Fail-closed: sem tenant → recusa. O update reaplica `.eq("tenant_id")` (defesa em profundidade:
// nunca confia só na leitura).
export async function aprovar(
  aprovacaoId: string,
  observacao?: string,
  tenantId?: string | null
): Promise<{ sucesso: boolean; erro?: string }> {
  const tenant = (tenantId ?? "").trim();
  if (!tenant) return { sucesso: false, erro: "Tenant ausente" };

  const db = supabase();

  const { data: aprovacao } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("id", aprovacaoId)
    .eq("tenant_id", tenant)
    .single();

  if (!aprovacao) return { sucesso: false, erro: "Aprovação não encontrada" };

  // F-B3 IDEMPOTÊNCIA: condiciona o UPDATE a status='pendente' E verifica linhas afetadas.
  // Sem esta guarda, dois operadores (ou duplo-clique/retry) passam pelo SELECT acima, ambos
  // encontram a aprovação e disparam a cascata do escrow duas vezes (pagamento duplicado).
  // Com .eq("status","pendente") + verificação de data retornada, apenas o PRIMEIRO UPDATE
  // tem efeito; o segundo recebe data=[] e retorna cedo — a cascata de dinheiro NÃO executa novamente.
  // Nota: Supabase JS v2 — .select("id") após .update() retorna as linhas afetadas.
  const { data: linhasAfetadas, error: errUpdate } = await db
    .from("hub_aprovacoes")
    .update({
      status: "aprovado",
      aprovado_por: "humano",
      aprovado_em: new Date().toISOString(),
      observacao,
    })
    .eq("id", aprovacaoId)
    .eq("tenant_id", tenant)
    .eq("status", "pendente")  // guarda de idempotência — só age se ainda pendente
    .select("id");

  if (errUpdate) return { sucesso: false, erro: errUpdate.message };

  // Nenhuma linha retornada = aprovação já foi processada (aprovada/rejeitada por outro operador).
  // Retornamos sucesso=true (não é erro do chamador — o estado desejado já foi atingido),
  // mas NÃO disparamos a cascata do escrow novamente.
  if (!linhasAfetadas || linhasAfetadas.length === 0) {
    return { sucesso: true }; // idempotente — já processada, sem cascata dupla
  }

  // Registra no log de decisões. SEGURANÇA (ESTRUTURA-UNIFICADA §7): grava `tenant_id` SEMPRE —
  // log de decisão de DINHEIRO (escrow/pagamento) não pode ficar fora do tenant. supabase() é
  // service_role e bypassa RLS; sem o tenant, o log nasce órfão (invisível/auditável por ninguém).
  await registrarDecisao(db, tenant, {
    agente_slug: aprovacao.agente_slug,
    tipo: "aprovacao_humana",
    descricao: `Aprovado: ${aprovacao.descricao}`,
    lead_id: aprovacao.lead_id,
    valor_envolvido: aprovacao.valor_envolvido || 0,
    aprovado_por: "humano",
    resultado: "aprovado",
  });

  // Executa a ação aprovada (cascata do gate dourado — escopada ao tenant da sessão)
  await executarAcaoAprovada(aprovacao, tenant);

  return { sucesso: true };
}

// ── REJEITAR ──────────────────────────────────────────────────
// SEGURANÇA (F0/E6): mesmo escopo de tenant da aprovação — leitura e update filtrados.
export async function rejeitar(
  aprovacaoId: string,
  motivo: string,
  tenantId?: string | null
): Promise<{ sucesso: boolean; erro?: string }> {
  const tenant = (tenantId ?? "").trim();
  if (!tenant) return { sucesso: false, erro: "Tenant ausente" };

  const db = supabase();

  const { data: aprovacao } = await db
    .from("hub_aprovacoes")
    .select("*")
    .eq("id", aprovacaoId)
    .eq("tenant_id", tenant)
    .single();

  if (!aprovacao) return { sucesso: false, erro: "Aprovação não encontrada" };

  // F-B3 IDEMPOTÊNCIA (rejeitar): mesma guarda do aprovar — só age se ainda pendente.
  const { data: linhasRejeitadas, error: errRejeitar } = await db
    .from("hub_aprovacoes")
    .update({
      status: "rejeitado",
      rejeitado_por: "humano",
      rejeitado_em: new Date().toISOString(),
      motivo_rejeicao: motivo,
    })
    .eq("id", aprovacaoId)
    .eq("tenant_id", tenant)
    .eq("status", "pendente")  // guarda de idempotência
    .select("id");

  if (errRejeitar) return { sucesso: false, erro: errRejeitar.message };

  if (!linhasRejeitadas || linhasRejeitadas.length === 0) {
    return { sucesso: true }; // já processada — retorno idempotente
  }

  const dados = (aprovacao.dados as Record<string, unknown>) || {};
  if (aprovacao.tipo === "cotacao_fornecedor" && dados.pedido_id) {
    await db
      .from("hub_cotacoes_pedidos")
      .update({ status: "rejeitado", atualizado_em: new Date().toISOString() })
      .eq("id", dados.pedido_id as string);
  }

  // Log de decisão com tenant_id SEMPRE (mesma regra do aprovar — nada de log de dinheiro órfão).
  await registrarDecisao(db, tenant, {
    agente_slug: aprovacao.agente_slug,
    tipo: "rejeicao_humana",
    descricao: `Rejeitado: ${aprovacao.descricao}`,
    lead_id: aprovacao.lead_id,
    valor_envolvido: aprovacao.valor_envolvido || 0,
    aprovado_por: "humano",
    resultado: `rejeitado: ${motivo}`,
  });

  // Notifica o agente que a ação foi rejeitada para refazer
  await db.from("hub_fila_mensagens").insert({
    lead_id: aprovacao.lead_id || "sistema",
    agente_id: aprovacao.agente_slug,
    canal: "interno",
    direcao: "entrada",
    conteudo: `AÇÃO REJEITADA: ${aprovacao.descricao}. Motivo: ${motivo}. Por favor, refaça com as correções necessárias.`,
    status: "pendente",
    metadata: { tipo: "rejeicao", aprovacao_id: aprovacaoId },
  });

  return { sucesso: true };
}

// ── CRIAR APROVAÇÃO ───────────────────────────────────────────
// SEGURANÇA/FILA (A1): grava SEMPRE `tenant_id`. A fila (buscarAprovacoesPendentes) filtra por tenant —
// sem ele, a aprovação criada pela IA (engine.ts/ml.ts) nasce INVISÍVEL ao humano. `tenantId` vem do
// caller; quando ausente (crons sem sessão) cai no defaultTenantId() — nunca grava sem tenant.
export async function criarAprovacao(dados: {
  tipo: TipoAprovacao;
  agenteSlug: string;
  descricao: string;
  motivo: string;
  impacto: string;
  recomendacao?: string;
  confiancaIA?: number;
  leadId?: string;
  valorEnvolvido?: number;
  prazo?: string;
  dados?: Record<string, unknown>;
  tenantId?: string | null;
}): Promise<string | null> {
  const db = supabase();
  const tenant = (dados.tenantId ?? "").trim() || defaultTenantId();

  const { data, error } = await db
    .from("hub_aprovacoes")
    .insert({
      tipo: dados.tipo,
      tenant_id: tenant,
      agente_slug: dados.agenteSlug,
      descricao: dados.descricao,
      motivo: dados.motivo,
      impacto: dados.impacto,
      recomendacao: dados.recomendacao || "IA recomenda aprovação",
      confianca_ia: dados.confiancaIA || 85,
      lead_id: dados.leadId,
      valor_envolvido: dados.valorEnvolvido,
      prazo: dados.prazo,
      dados: dados.dados || {},
      status: "pendente",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[APROVAÇÕES] Erro ao criar:", error);
    return null;
  }

  return data?.id || null;
}

// ── EXECUTAR AÇÃO APROVADA ────────────────────────────────────
// SEGURANÇA/DINHEIRO (C1/E6): a cascata do gate dourado (escrow) executa AQUI — este é o único ponto
// que o caminho real da UI percorre (page.tsx → /api/hub/aprovacoes/[id] → aprovar → aqui). As RPCs
// recebem o `tenantId` da SESSÃO (já validado em aprovar()) como guard explícito (service_role bypassa
// RLS). A IA nunca chega a aprovar dinheiro: estes branches só rodam quando um HUMANO aprovou o card.
async function executarAcaoAprovada(
  aprovacao: Record<string, unknown>,
  tenantId: string
): Promise<void> {
  const dados = aprovacao.dados as Record<string, unknown> || {};
  const tipo = aprovacao.tipo as string;

  console.log(`[APROVAÇÕES] Executando ação aprovada: ${tipo}`, dados);

  if (tipo === "cotacao_fornecedor" && dados.pedido_id) {
    const db = supabase();
    await db
      .from("hub_cotacoes_pedidos")
      .update({ status: "aprovado", atualizado_em: new Date().toISOString() })
      .eq("id", dados.pedido_id as string);
  }

  // ── E6: cascata do gate dourado (espelha /api/aprovacoes/[id]) — só com tenant da sessão ──
  // GATE 1: orçamento da frente aprovado → libera (bloqueado→liberado) os pagamentos vinculados.
  if (tipo === "orcamento_frente") {
    const orcamentoId = dados.orcamento_id as string | undefined;
    if (orcamentoId && tenantId) {
      const db = supabase();
      await db.rpc("rpc_aprovar_orcamento_frente", {
        p_orcamento_id: orcamentoId,
        p_aprovacao_id: aprovacao.id as string,
        p_tenant_id: tenantId,
      });

      // E7c (Fase 3a — decisão #1): DEPOIS de aprovar, COPIA o snapshot de custo da versão aprovada
      // para o item-mãe (hub_obra_itens), via a rpc_snapshot_custo_frente de E7b. Função SEPARADA da
      // de aprovação (não colide): a de E6 aprova+libera; esta só materializa o custo no item.
      // TOLERÂNCIA: a função só existe após a migração E7b → se "function does not exist", ignora
      // silenciosamente (a aprovação NÃO pode quebrar por causa do snapshot). tenant_id sempre.
      const obraId = dados.obra_id as string | undefined;
      const frenteId = (dados.frente_id as string | undefined) ?? null;
      if (obraId) {
        await snapshotCustoFrenteTolerante(db, obraId, frenteId, tenantId);
      }
    }
  }

  // GATE 2 (qualquer das 2 chaves aprovada): tenta liberar o escrow — a RPC só libera se AMBAS aprovadas
  // (fail-closed). Disparar nas duas chaves é seguro: a primeira não move o dinheiro, a segunda libera.
  if (tipo === "pagamento_obra_arq" || tipo === "pagamento_obra_hub") {
    const pagamentoId = dados.pagamento_id as string | undefined;
    if (pagamentoId && tenantId) {
      const db = supabase();
      await db.rpc("rpc_liberar_escrow", {
        p_pagamento_id: pagamentoId,
        p_tenant_id: tenantId,
      });
    }
  }

  // Aqui cada tipo de aprovação tem sua execução específica
  // Por enquanto registra no log — integração com APIs externas
  // (Meta Ads, WhatsApp Business, etc.) será adicionada por módulo
}
