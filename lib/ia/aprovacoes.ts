// ============================================================
// APROVAÇÕES — Sistema Universal de Aprovação Humana
// Tudo que precisa de humano chega aqui como card completo
// ============================================================
import { createClient } from "@supabase/supabase-js";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { roleTemCapacidade } from "@/lib/rbac/role-map";
import { isCrmGestorRole } from "@/lib/crm/crm-permissoes";
import { registrarEvento } from "@/lib/crm/registrar-evento";
import type { EfeitoAprovacao } from "./efeito-aprovacao";
import { derivarEstadoDupla } from "@/lib/obras/financeiro";

function supabase() {
  // fail-closed: sem fallback para a anon key — client de service_role nunca deve
  // silenciosamente rodar com privilégio anon divergente (Batch 3).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key?.trim()) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente — serviço indisponível.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
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
/**
 * Identidade do aprovador HUMANO — usada SÓ pelo gate de escrow (Onda 1b).
 * `userId` = pessoa física (users.id), grava em `aprovado_por` p/ a checagem de
 * autoridades distintas. `ehHumano` = veio de cookie de sessão humano (não da chave
 * interna de API). Ambos vêm de `getCallerContext` na rota.
 */
export type AprovadorHumano = {
  userId?: string | null;
  ehHumano?: boolean;
};

/**
 * GATE DAS DUAS CHAVES DO ESCROW (Onda 1b — DESIGN-RBAC-MULTITENANT.md §6, D5/D6/D7).
 * Substitui o antigo check RANK-BASED por CAPABILITY explícita da fonte única, mantendo
 * TODAS as invariantes de dinheiro:
 *   (c) fail-closed — sem capacidade válida NÃO libera;
 *   (d) NUNCA o mesmo humano nas 2 chaves — compara `aprovado_por` da chave IRMÃ do mesmo
 *       pagamento (pessoa física distinta);
 *   (e) SÓ cookie humano segura chave — o caminho INTERNAL_API_KEY / x-caller-auth-id
 *       (ehHumano=false) e o ai_agent NUNCA liberam escrow;
 *   (g) ai_agent nunca aprova dinheiro (não tem capability + não é humano — duplo bloqueio).
 *
 * Chaves:
 *   • pagamento_obra_hub  → capacidade `escrow:chave_hub`      (owner = Chave Hub);
 *   • pagamento_obra_arq  → capacidade `escrow:chave_tecnica`  (architect OU operation —
 *                            a CHAVE TÉCNICA do responsável: arquiteto em projeto,
 *                            engenharia em obra/prestadores — ressalva do dono 03/jul).
 *
 * TODO(ABAC de linha — Onda 1b completa / Onda 3): amarrar a chave_tecnica ao RESPONSÁVEL
 * daquela linha, não só ao papel:
 *   • architect → `hub_projetos.responsavel_id` do projeto do pagamento (coluna EXISTE);
 *   • operation → `hub_obras.engenheiro_responsavel_id` — coluna NÃO EXISTE hoje (Onda 0),
 *     precisa de migração aditiva. Por ora a chave_tecnica de obra é PAPEL (operation) +
 *     humano-distinto + humano-only. NÃO inventar coluna inexistente.
 */
async function validarChaveEscrow(
  db: ReturnType<typeof supabase>,
  aprovacao: Record<string, unknown>,
  tenant: string,
  aprovadorRole: string | null | undefined,
  aprovador: AprovadorHumano | null | undefined
): Promise<{ ok: true } | { ok: false; erro: string }> {
  // (e) só HUMANO com cookie de sessão — nunca a chave interna de API nem o ai_agent.
  if (!aprovador?.ehHumano) {
    return {
      ok: false,
      erro: "Apenas uma sessão humana pode autorizar uma chave do escrow (caminho de serviço bloqueado).",
    };
  }
  const humano = (aprovador.userId ?? "").trim();
  if (!humano) {
    return {
      ok: false,
      erro: "Identidade humana ausente — a chave do escrow não pode ser assinada sem pessoa física.",
    };
  }

  const tipo = aprovacao.tipo as string;
  const ehChaveHub = tipo === "pagamento_obra_hub";
  const capacidade = ehChaveHub ? "escrow:chave_hub" : "escrow:chave_tecnica";

  // (c) fail-closed por CAPABILITY (não por rank).
  if (!roleTemCapacidade(aprovadorRole, capacidade)) {
    return {
      ok: false,
      erro: ehChaveHub
        ? "A chave do Hub exige a capacidade escrow:chave_hub (owner)."
        : "A chave técnica exige o responsável técnico (arquitetura ou engenharia) — capacidade escrow:chave_tecnica.",
    };
  }

  // (d) DUAS autoridades HUMANAS distintas — a chave IRMÃ do MESMO pagamento não pode
  // ter sido assinada pela MESMA pessoa física. Busca a irmã já aprovada e compara.
  const dados = (aprovacao.dados as Record<string, unknown>) || {};
  const pagamentoId = String(dados.pagamento_id ?? "").trim();
  // Fail-closed (defesa em profundidade): uma chave de escrow SEM pagamento vinculado não pode
  // ser assinada — a RPC de liberação exige o pagamento_id, e sem ele a checagem de "duas pessoas
  // distintas" viraria no-op. Recusa em vez de assinar às cegas.
  if (!pagamentoId) {
    return { ok: false, erro: "Chave de escrow sem pagamento vinculado — não pode ser assinada." };
  }
  {
    const tipoIrma = ehChaveHub ? "pagamento_obra_arq" : "pagamento_obra_hub";
    const { data: irmas } = await db
      .from("hub_aprovacoes")
      .select("aprovado_por")
      .eq("tenant_id", tenant)
      .eq("tipo", tipoIrma)
      .eq("status", "aprovado")
      .eq("dados->>pagamento_id", pagamentoId)
      .limit(1);
    const irma =
      Array.isArray(irmas) && irmas.length
        ? (irmas[0] as { aprovado_por?: string | null })
        : null;
    if (irma && String(irma.aprovado_por ?? "").trim() === humano) {
      return {
        ok: false,
        erro: "As duas chaves do escrow exigem pessoas distintas — você já assinou a chave irmã deste pagamento.",
      };
    }
  }

  return { ok: true };
}

export async function aprovar(
  aprovacaoId: string,
  observacao?: string,
  tenantId?: string | null,
  aprovadorRole?: string | null,
  aprovador?: AprovadorHumano | null
): Promise<{ sucesso: boolean; erro?: string; efeito?: EfeitoAprovacao }> {
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

  // Onda 1 (aperto do over-grant apontado na verificação): pela rota, architect/operation
  // chegam por CAPACIDADE de escrow (requireCrmAprovador) sem serem gestor. Esse portador-de-
  // capacidade SÓ pode assinar as CHAVES de escrow — nunca aprova cotação/orçamento/genérico.
  // Precisão: só barra quem TEM capacidade de escrow E não é gestor (não afeta gestor+ nem
  // chamadas internas/IA que passam role vazio, que têm a própria autenticação).
  const ehChaveEscrow =
    aprovacao.tipo === "pagamento_obra_hub" || aprovacao.tipo === "pagamento_obra_arq";
  const soAssinaChave =
    !isCrmGestorRole(aprovadorRole) &&
    (roleTemCapacidade(aprovadorRole, "escrow:chave_tecnica") ||
      roleTemCapacidade(aprovadorRole, "escrow:chave_hub"));
  if (!ehChaveEscrow && soAssinaChave) {
    return { sucesso: false, erro: "Sem permissão para aprovar este tipo de item." };
  }

  // ── ESCROW (Onda 1b): gate por CAPABILITY (não mais por rank) ──────────────────
  // A 2ª chave deixou de ser "nível gestor ≠ owner" (furo: qualquer papel que ganhasse
  // rank owner/gestor reabria o cofre). Agora cada chave é uma CAPABILITY explícita da
  // fonte única + DUAS autoridades HUMANAS distintas + só sessão humana. Fail-closed:
  // sem capacidade válida NÃO libera (e a cascata do escrow nem chega a rodar).
  if (aprovacao.tipo === "pagamento_obra_hub" || aprovacao.tipo === "pagamento_obra_arq") {
    const gate = await validarChaveEscrow(
      db,
      aprovacao as Record<string, unknown>,
      tenant,
      aprovadorRole,
      aprovador
    );
    if (!gate.ok) return { sucesso: false, erro: gate.erro };
  }

  // Pessoa física que assina (p/ auditoria + checagem de autoridades distintas do escrow).
  const aprovadoPor = (aprovador?.userId ?? "").trim() || "humano";

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
      // Onda 1b: grava a PESSOA FÍSICA (users.id) quando disponível — é o que a chave
      // irmã do escrow compara p/ exigir DUAS autoridades distintas. Sem humano → "humano".
      aprovado_por: aprovadoPor,
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
    // idempotente — já processada, sem cascata dupla. NÃO chamamos RPC de dinheiro aqui
    // (0 linhas afetadas => sem novo movimento); o efeito reflete apenas o estado já atingido.
    return { sucesso: true, efeito: { kind: "ja_processada" } };
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

  // Keystone F4 (hub_eventos): instrumentação best-effort — nunca bloqueia a aprovação.
  await registrarEvento(db, {
    event_type: "aprovacao_decidida",
    entity_type: "aprovacao",
    entity_id: aprovacaoId,
    lead_id: (aprovacao.lead_id as string) ?? null,
    ator: "humano",
    payload: { tipo: aprovacao.tipo, resultado: "aprovado" },
    tenant_id: tenant,
  });

  // Executa a ação aprovada (cascata do gate dourado — escopada ao tenant da sessão).
  // PÓS-COMMIT NÃO REGRIDE: o UPDATE de aprovação (acima) já foi commitado; uma falha/exceção na
  // captura do efeito degrada para {kind:'indisponivel'} com sucesso:true — nunca vira erro 400/500.
  let efeito: EfeitoAprovacao;
  try {
    efeito = await executarAcaoAprovada(aprovacao, tenant);
  } catch {
    efeito = { kind: "indisponivel" };
  }

  return { sucesso: true, efeito };
}

// ── REJEITAR ──────────────────────────────────────────────────
// SEGURANÇA (F0/E6): mesmo escopo de tenant da aprovação — leitura e update filtrados.
export async function rejeitar(
  aprovacaoId: string,
  motivo: string,
  tenantId?: string | null,
  aprovadorRole?: string | null
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

  // Onda 1 (simétrico ao guard de aprovar()): o portador de escrow-capability que NÃO é
  // gestor (architect/operation, admitidos na rota por requireCrmAprovador) só decide as
  // CHAVES de escrow — não pode REJEITAR cotação/orçamento/genérico (alçada comercial).
  const ehChaveEscrow =
    aprovacao.tipo === "pagamento_obra_hub" || aprovacao.tipo === "pagamento_obra_arq";
  const soAssinaChave =
    !isCrmGestorRole(aprovadorRole) &&
    (roleTemCapacidade(aprovadorRole, "escrow:chave_tecnica") ||
      roleTemCapacidade(aprovadorRole, "escrow:chave_hub"));
  if (!ehChaveEscrow && soAssinaChave) {
    return { sucesso: false, erro: "Sem permissão para decidir este tipo de item." };
  }

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
      .eq("id", dados.pedido_id as string)
      .eq("tenant_id", tenant); // defesa em profundidade: pedido_id vem do jsonb da aprovação
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

  // Keystone F4 (hub_eventos): instrumentação best-effort — nunca bloqueia a rejeição.
  await registrarEvento(db, {
    event_type: "aprovacao_decidida",
    entity_type: "aprovacao",
    entity_id: aprovacaoId,
    lead_id: (aprovacao.lead_id as string) ?? null,
    ator: "humano",
    payload: { tipo: aprovacao.tipo, resultado: "rejeitado", motivo },
    tenant_id: tenant,
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
): Promise<EfeitoAprovacao> {
  const dados = aprovacao.dados as Record<string, unknown> || {};
  const tipo = aprovacao.tipo as string;

  console.log(`[APROVAÇÕES] Executando ação aprovada: ${tipo}`, dados);

  // db.rpc() devolve `data` como any/unknown — este type-guard fecha a leitura do jsonb da RPC
  // (a VERDADE do efeito vem de `data`, não de `error`: dupla_incompleta chega com error=null).
  const isRecord = (x: unknown): x is Record<string, unknown> =>
    typeof x === "object" && x !== null;

  if (tipo === "cotacao_fornecedor" && dados.pedido_id) {
    const db = supabase();
    await db
      .from("hub_cotacoes_pedidos")
      .update({ status: "aprovado", atualizado_em: new Date().toISOString() })
      .eq("id", dados.pedido_id as string)
      .eq("tenant_id", tenantId); // defesa em profundidade: pedido_id vem do jsonb da aprovação
    // O efeito NÃO depende do resultado desse UPDATE não-verificado (fora de escopo).
    return { kind: "cotacao_aprovada" };
  }

  // ── E6: cascata do gate dourado (espelha /api/aprovacoes/[id]) — só com tenant da sessão ──
  // GATE 1: orçamento da frente aprovado → libera (bloqueado→liberado) os pagamentos vinculados.
  if (tipo === "orcamento_frente") {
    const orcamentoId = dados.orcamento_id as string | undefined;
    if (!(orcamentoId && tenantId)) return { kind: "indisponivel" };

    const db = supabase();
    const { data, error } = await db.rpc("rpc_aprovar_orcamento_frente", {
      p_orcamento_id: orcamentoId,
      p_aprovacao_id: aprovacao.id as string,
      p_tenant_id: tenantId,
    });

    // Traduz o jsonb REAL em efeito ANTES do snapshot (best-effort/void) — a verdade vem de `data`.
    // indisponivel = RPC ausente/dormente (migração pendente); falhou = erro real (não fingir sucesso).
    let efeito: EfeitoAprovacao;
    if (isMissingPgFunction(error)) {
      efeito = { kind: "indisponivel" };
    } else if (error) {
      console.warn("[APROVAÇÕES] rpc_aprovar_orcamento_frente erro:", error);
      efeito = { kind: "falhou" }; // não vaza mensagem crua de DB p/ a UI
    } else if (!isRecord(data)) {
      efeito = { kind: "indisponivel" };
    } else if (data.ok === true && data.idempotente === true) {
      efeito = { kind: "orcamento_ja_aprovado" };
    } else if (data.ok === true) {
      efeito = { kind: "orcamento_aprovado", pagamentosLiberados: Number(data.pagamentos_liberados ?? 0) };
    } else {
      efeito = { kind: "falhou", motivo: typeof data.erro === "string" ? data.erro : undefined };
    }

    // E7c (Fase 3a — decisão #1): DEPOIS de calcular o efeito, COPIA o snapshot de custo da versão
    // aprovada para o item-mãe (hub_obra_itens), via a rpc_snapshot_custo_frente de E7b. Função
    // SEPARADA da de aprovação: a de E6 aprova+libera; esta só materializa o custo no item.
    // SNAPSHOT ISOLADO: best-effort/void — sua falha JAMAIS entra no efeito de orçamento.
    const obraId = dados.obra_id as string | undefined;
    const frenteId = (dados.frente_id as string | undefined) ?? null;
    if (obraId) {
      await snapshotCustoFrenteTolerante(db, obraId, frenteId, tenantId);
    }

    return efeito;
  }

  // GATE 2 (qualquer das 2 chaves aprovada): tenta liberar o escrow — a RPC só libera se AMBAS aprovadas
  // (fail-closed). Disparar nas duas chaves é seguro: a primeira não move o dinheiro, a segunda libera.
  if (tipo === "pagamento_obra_arq" || tipo === "pagamento_obra_hub") {
    const pagamentoId = dados.pagamento_id as string | undefined;
    if (!(pagamentoId && tenantId)) return { kind: "indisponivel" };

    const db = supabase();
    const { data, error } = await db.rpc("rpc_liberar_escrow", {
      p_pagamento_id: pagamentoId,
      p_tenant_id: tenantId,
    });

    // FAIL-CLOSED das 2 chaves: discriminamos pelo JSONB `data` (NUNCA por `error` —
    // dupla_incompleta chega com error=null e data.ok=false). Só afirmamos "liberado" com data.ok=true.
    // indisponivel = RPC ausente/dormente; falhou = erro real (não fingir que seguiu).
    if (isMissingPgFunction(error)) {
      return { kind: "indisponivel" };
    }
    if (error) {
      console.warn("[APROVAÇÕES] rpc_liberar_escrow erro:", error);
      return { kind: "falhou" }; // não vaza mensagem crua de DB p/ a UI
    }
    if (!isRecord(data)) {
      return { kind: "indisponivel" };
    }
    if (data.ok === true && data.idempotente === true) {
      return { kind: "escrow_ja_liberado" };
    }
    if (data.ok === true) {
      return { kind: "escrow_liberado", valorLiberado: Number(data.valor_liberado ?? 0) };
    }
    if (data.ok === false && data.erro === "aprovacao_dupla_incompleta") {
      return {
        kind: "escrow_aguardando",
        faltam: derivarEstadoDupla(
          data.arq as string | undefined,
          data.hub as string | undefined
        ).faltam,
      };
    }
    // Qualquer outro ok:false — falha real (não é 'aguardando' nem 'liberado'): honesto, não fingir.
    return { kind: "falhou", motivo: typeof data.erro === "string" ? data.erro : undefined };
  }

  // Tipos sem cascata de dinheiro: registro honesto (integração com APIs externas por módulo depois).
  return { kind: "registrado" };
}
