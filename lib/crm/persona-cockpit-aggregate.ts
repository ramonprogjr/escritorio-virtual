/**
 * COCKPIT PERSONA-AWARE (v1) — agregadores SERVER-SIDE por persona (engenharia/arquiteto/
 * cliente/fornecedor). Gêmeo persona-aware do aggregateDashboard (comercial). Reusa peças que
 * JÁ existem: aggregateCockpit (obras) e leituras diretas escopadas por tenant.
 *
 * SEGURANÇA (regra sistêmica E0): crmDb()/service-role BYPASSA RLS → o filtro no código é a
 * ÚNICA barreira. TODA query nova filtra `.eq("tenant_id", tenantId)` PURO (nunca `.or(...is.null)`).
 * tenantId/userId vêm SEMPRE da sessão (route → getCallerContext), NUNCA do body/header.
 *
 * HONESTIDADE (mandato do dono — curar "não saber"/"ser enganado"): fonte VAZIA (medições/escrow/
 * cronograma ainda não migrados ou sem dados) vira AVISO explícito ("sem medições ainda"), nunca um
 * zero mudo nem quebra. Cada bloco degrada isolado (safeCount devolve 0 em tabela/coluna ausente).
 *
 * Sem código de IDENTIDADE na tela (regra do dono): cards usam NOME/rótulo, nunca códigos internos.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateCockpit } from "@/lib/crm/cockpit-aggregate";
import { safeCount } from "@/lib/crm/metricas-safe";
import { TIPOS_ESCROW_CHAVE_TECNICA } from "@/lib/crm/aprovacoes-tipos";
import {
  PERSONA_CABECALHO,
  type PersonaAcao,
  type PersonaCard,
  type PersonaCockpitPayload,
  type PersonaNaoComercial,
} from "@/lib/crm/persona-cockpit";

export type BuildPersonaOpts = {
  /** users.id da sessão (não auth_id) — usado p/ resolver a pessoa do cliente. */
  userId?: string | null;
};

/**
 * Chaves de escrow AGUARDANDO a assinatura desta persona técnica (arquiteto/engenharia).
 * Conta hub_aprovacoes pendentes nos tipos de chave técnica, escopado por tenant. safeCount
 * degrada p/ 0 quando a tabela/coluna ainda não existe (nunca quebra o cockpit). O portador
 * assina de fato pela fila (validarChaveEscrow inalterado) — aqui é só o contador da ação.
 */
async function contarChavesEscrowPendentes(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  return safeCount(
    supabase
      .from("hub_aprovacoes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pendente")
      .in("tipo", TIPOS_ESCROW_CHAVE_TECNICA)
  );
}

/** Ação "Chaves a assinar" p/ o topo do cockpit — só quando há chave pendente (count>0). */
function acaoChavesEscrow(chaves: number): PersonaAcao {
  return {
    id: "chaves-escrow",
    label: `${chaves} chave${chaves === 1 ? "" : "s"} de pagamento aguardando sua assinatura`,
    valor: chaves,
    href: "/crm/aprovacoes",
    cta: "Assinar",
    cor: "#c9a24a",
    prioridade: "alta",
    icone: "key",
  };
}

/** Média simples dos avanços definidos (ignora null = sem cronograma). null se nenhum. */
function avancoMedioCarteira(carteira: { avanco: number | null }[]): number | null {
  const vals = carteira.map((c) => c.avanco).filter((v): v is number => typeof v === "number");
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/** Dispatcher: monta o cockpit da persona não-comercial. */
export async function buildPersonaCockpit(
  supabase: SupabaseClient,
  tenantId: string,
  persona: PersonaNaoComercial,
  opts?: BuildPersonaOpts
): Promise<PersonaCockpitPayload> {
  switch (persona) {
    case "engenharia":
      return buildEngenharia(supabase, tenantId);
    case "arquiteto":
      return buildArquiteto(supabase, tenantId);
    case "cliente":
      return buildCliente(supabase, tenantId, opts?.userId ?? null);
    case "fornecedor":
      return buildFornecedor(supabase, tenantId);
  }
}

// ── ENGENHARIA (operation) ─────────────────────────────────────────────────────
async function buildEngenharia(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PersonaCockpitPayload> {
  const cab = PERSONA_CABECALHO.engenharia;

  // aggregateCockpit já degrada sozinho (cronograma/ocorrências ausentes → []/flags=false).
  const c = await aggregateCockpit(supabase, tenantId);
  // Medições: fonte própria (pode estar vazia — mostrar honesto, não zero mudo).
  const medicoes = await safeCount(
    supabase
      .from("hub_obra_medicoes")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
  );
  // Chave técnica do escrow (engenharia aprova prestadores → escrow:chave_tecnica).
  const chaves = await contarChavesEscrowPendentes(supabase, tenantId);

  const ocorrN = c.hoje.bloqueios.filter((b) => b.tipo === "ocorrencia_critica").length;
  const pedidosN = c.hoje.bloqueios.filter((b) => b.tipo === "pedido_pendente").length;

  const acoes: PersonaAcao[] = [];
  // Dinheiro em custódia primeiro — a assinatura da chave destrava pagamento (prioridade máxima).
  if (chaves > 0) acoes.push(acaoChavesEscrow(chaves));
  if (c.contadores.atrasados > 0) {
    acoes.push({
      id: "atrasados",
      label: `${c.contadores.atrasados} fase${c.contadores.atrasados === 1 ? "" : "s"} atrasada${c.contadores.atrasados === 1 ? "" : "s"}`,
      valor: c.contadores.atrasados,
      href: "/crm/obras?aba=hoje",
      cta: "Resolver",
      cor: "#f85149",
      prioridade: "alta",
      icone: "alert-triangle",
    });
  }
  if (ocorrN > 0) {
    acoes.push({
      id: "ocorrencias",
      label: `${ocorrN} ocorrência${ocorrN === 1 ? "" : "s"} crítica${ocorrN === 1 ? "" : "s"}`,
      valor: ocorrN,
      href: "/crm/obras?aba=hoje",
      cta: "Ver",
      cor: "#f85149",
      prioridade: "alta",
      icone: "alert-octagon",
    });
  }
  if (pedidosN > 0) {
    acoes.push({
      id: "pedidos",
      label: `${pedidosN} pedido${pedidosN === 1 ? "" : "s"} de material a resolver`,
      valor: pedidosN,
      href: "/crm/obras?aba=hoje",
      cta: "Abrir",
      cor: "#c9a24a",
      prioridade: "media",
      icone: "package",
    });
  }
  if (c.contadores.proximos15 > 0) {
    acoes.push({
      id: "proximos15",
      label: `${c.contadores.proximos15} marco${c.contadores.proximos15 === 1 ? "" : "s"} nos próximos 15 dias`,
      valor: c.contadores.proximos15,
      href: "/crm/obras?aba=hoje",
      cta: "Planejar",
      cor: "#d29922",
      prioridade: "media",
      icone: "calendar-clock",
    });
  }

  const avanco = avancoMedioCarteira(c.carteira);
  const cards: PersonaCard[] = [
    {
      id: "obras",
      label: "Obras ativas",
      valor: String(c.contadores.obras),
      sub: "na sua carteira",
      cor: "#c9a24a",
      href: "/crm/obras",
    },
    {
      id: "atencao",
      label: "Pedem atenção",
      valor: String(c.contadores.pedemAtencao),
      sub: "saúde crítica ou em risco",
      cor: c.contadores.pedemAtencao > 0 ? "#f85149" : "#34d399",
      href: "/crm/obras",
    },
    {
      id: "avanco",
      label: "Avanço físico",
      valor: avanco == null ? "—" : `${avanco}%`,
      sub: avanco == null ? "sem cronograma ainda" : "média das obras",
      cor: "#34d399",
      href: "/crm/obras",
    },
    {
      id: "medicoes",
      label: "Medições",
      valor: String(medicoes),
      sub: medicoes === 0 ? "nenhuma registrada ainda" : "registradas",
      cor: "#4db3c4",
      href: "/crm/obras",
    },
  ];

  const avisos: string[] = [];
  if (!c.flags.temCronograma) {
    avisos.push(
      "Cronograma ainda não definido nas obras — o avanço físico e os prazos aparecem quando a EAP tiver datas."
    );
  }
  if (medicoes === 0) {
    avisos.push("Nenhuma medição registrada ainda — o histórico de avanço aparece assim que a primeira medição for lançada.");
  }

  return { persona: "engenharia", titulo: cab.titulo, subtitulo: cab.subtitulo, acoes: ordenar(acoes), cards, avisos };
}

// ── ARQUITETO (architect) ───────────────────────────────────────────────────────
async function buildArquiteto(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PersonaCockpitPayload> {
  const cab = PERSONA_CABECALHO.arquiteto;

  // Fila "em aprovação" (entregáveis enviados) + total de projetos. safeCount degrada p/ 0
  // quando as colunas tipo/aprovacao_status ainda não existem (pré-A0).
  const [fila, projetos, chaves] = await Promise.all([
    safeCount(
      supabase
        .from("hub_projetos_fases")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("tipo", "fase")
        .eq("aprovacao_status", "enviado")
    ),
    safeCount(
      supabase
        .from("hub_projetos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
    ),
    // Chave técnica do escrow (arquiteto aprova entregáveis → escrow:chave_tecnica).
    contarChavesEscrowPendentes(supabase, tenantId),
  ]);

  const acoes: PersonaAcao[] = [];
  // Dinheiro em custódia primeiro — a assinatura da chave destrava pagamento (prioridade máxima).
  if (chaves > 0) acoes.push(acaoChavesEscrow(chaves));
  if (fila > 0) {
    acoes.push({
      id: "fila",
      label: `${fila} entregável${fila === 1 ? "" : "eis"} aguardando aprovação`,
      valor: fila,
      href: "/crm/arquitetura",
      cta: "Revisar",
      cor: "#f85149",
      prioridade: "alta",
      icone: "file-check",
    });
  }

  const cards: PersonaCard[] = [
    {
      id: "projetos",
      label: "Projetos",
      valor: String(projetos),
      sub: "na sua fila",
      cor: "#c9a24a",
      href: "/crm/arquitetura",
    },
    {
      id: "aprovacao",
      label: "Em aprovação",
      valor: String(fila),
      sub: fila === 0 ? "nada aguardando" : "entregáveis enviados",
      cor: fila > 0 ? "#f85149" : "#34d399",
      href: "/crm/arquitetura",
    },
    {
      id: "disparidade",
      label: "Disparidade de orçamento",
      valor: "—",
      sub: "chega em breve",
      cor: "#6e9e8a",
      href: "/crm/arquitetura",
    },
  ];

  const avisos: string[] = [];
  if (projetos === 0) {
    avisos.push("Nenhum projeto na fila ainda — os briefings aparecem aqui assim que forem criados.");
  }
  if (fila === 0) {
    avisos.push("Nenhum entregável aguardando aprovação no momento.");
  }
  avisos.push("A checagem de disparidade orçamento × projeto chega em breve.");

  return { persona: "arquiteto", titulo: cab.titulo, subtitulo: cab.subtitulo, acoes: ordenar(acoes), cards, avisos };
}

// ── CLIENTE (client) ─────────────────────────────────────────────────────────────
async function buildCliente(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null
): Promise<PersonaCockpitPayload> {
  const cab = PERSONA_CABECALHO.cliente;

  // Resolve a pessoa do cliente a partir do usuário da sessão (nunca do body).
  let pessoaId: string | null = null;
  if (userId) {
    const { data } = await supabase
      .from("users")
      .select("pessoa_id")
      .eq("id", userId)
      .maybeSingle();
    pessoaId = (data as { pessoa_id?: string | null } | null)?.pessoa_id ?? null;
  }

  // Obras DO cliente: escopo por tenant + cliente_pessoa_id (o cliente NUNCA vê obras de terceiros).
  // .eq puro (service-role bypassa RLS); pessoa ausente → lista vazia → estado-vazio honesto.
  let obras: { id: string; titulo: string; status: string | null }[] = [];
  if (pessoaId) {
    const { data } = await supabase
      .from("hub_obras")
      .select("id, titulo, status")
      .eq("tenant_id", tenantId)
      .eq("cliente_pessoa_id", pessoaId)
      .limit(50);
    obras = (data ?? []) as { id: string; titulo: string; status: string | null }[];
  }
  const temObra = obras.length > 0;

  // Medições/escrow do cliente — fonte pode estar vazia (ecossistema em construção): honesto.
  const cards: PersonaCard[] = [
    {
      id: "minha-obra",
      label: "Minha obra",
      valor: temObra ? String(obras.length) : "—",
      sub: temObra ? "vinculada ao seu acesso" : "aguardando vínculo",
      cor: "#c9a24a",
      href: "/crm/obras",
    },
    {
      id: "avanco",
      label: "Avanço",
      valor: "—",
      sub: temObra ? "acompanhe o andamento" : "aparece com a obra vinculada",
      cor: "#34d399",
      href: "/crm/obras",
    },
    {
      id: "escrow",
      label: "Em custódia (escrow)",
      valor: "—",
      sub: "pagamentos protegidos pelo Hub",
      cor: "#4db3c4",
      href: "/crm/obras",
    },
  ];

  const avisos: string[] = [];
  if (!temObra) {
    avisos.push(
      "Assim que sua obra for vinculada ao seu acesso, você verá aqui o avanço, as medições para aprovar e o dinheiro em custódia (escrow)."
    );
  } else {
    avisos.push("Medições e pagamentos aparecem aqui assim que a obra começar a registrá-los.");
  }

  // v1: sem ações automáticas (medições/aprovações ainda vazias) — estado honesto no topo.
  return { persona: "cliente", titulo: cab.titulo, subtitulo: cab.subtitulo, acoes: [], cards, avisos };
}

// ── FORNECEDOR / SERVIÇOS (supplier) ─────────────────────────────────────────────
async function buildFornecedor(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PersonaCockpitPayload> {
  const cab = PERSONA_CABECALHO.fornecedor;

  // Encaminhamentos existentes no tenant (proxy leve de "direcionados"); direcionamento fino
  // por fornecedor entra numa próxima fase. safeCount degrada p/ 0.
  const encaminhamentos = await safeCount(
    supabase
      .from("hub_encaminhamentos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
  );

  const cards: PersonaCard[] = [
    {
      id: "cotacoes",
      label: "Cotações",
      valor: "—",
      sub: "direcionadas a você",
      cor: "#c9a24a",
      href: "/crm/distribuicao",
    },
    {
      id: "ordens",
      label: "Ordens de serviço",
      valor: "—",
      sub: "em andamento",
      cor: "#4db3c4",
      href: "/crm/distribuicao",
    },
    {
      id: "encaminhamentos",
      label: "Encaminhamentos",
      valor: String(encaminhamentos),
      sub: "na rede",
      cor: "#34d399",
      href: "/crm/distribuicao",
    },
  ];

  const avisos: string[] = [
    "Cotações e ordens de serviço direcionadas a você aparecerão aqui assim que a rede começar a encaminhar demandas ao seu perfil.",
  ];

  return { persona: "fornecedor", titulo: cab.titulo, subtitulo: cab.subtitulo, acoes: [], cards, avisos };
}

/** Ordena as ações por prioridade (alta → baixa). */
function ordenar(acoes: PersonaAcao[]): PersonaAcao[] {
  const peso = { alta: 0, media: 1, baixa: 2 } as const;
  return [...acoes].sort((a, b) => peso[a.prioridade] - peso[b.prioridade]);
}
