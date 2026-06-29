/**
 * Cockpit de Obras (E1) — agregador (gêmeo de dashboard-aggregate).
 *
 * Lê SÓ tabelas que JÁ EXISTEM (sem migração): hub_obras, hub_obras_cronograma,
 * hub_obras_ocorrencias, hub_pedidos_material. Monta:
 *   - carteira (cards com saúde/avanço/marco/pills),
 *   - fila "Hoje" (atrasados, próximos 15d, bloqueios proxy, pagamentos degrada),
 *   - contadores, resumo_ia e flags de degradação.
 *
 * SEGURANÇA (regra sistêmica E0/A0): TODA query filtra `.eq("tenant_id", tenantId)`
 * PURO — nunca `.or('...is.null')` (NULL = não pertence). `tenantId` vem SEMPRE da
 * sessão (caller), nunca do body/header. crmDb() é service-role e bypassa RLS, então o
 * filtro de tenant no código é a ÚNICA barreira — por isso é mandatório em cada bloco.
 *
 * TOLERÂNCIA: cada bloco é independente. Tabela/coluna AUSENTE (schema ainda não migrado) →
 * bloco vira []/0 e os demais seguem (degrada, não derruba). Já um erro REAL (rede/RLS/timeout)
 * NÃO é engolido: propaga, para não nascer um cockpit vazio mascarando bug. Distingue "tudo em
 * dia" de "fonte ausente" via flags.temCronograma.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { safeCount } from "@/lib/crm/metricas-safe";
import {
  type FaseCronograma,
  type ObraCard,
  type SaudeObra,
  type MarcoProximo,
  avancoMedio,
  proximoMarco,
  ehAtrasada,
  ehProxima15,
  derivarSaude,
  ordenarPorUrgencia,
  normalizarStatusObra,
  hojeISODate,
  soData,
  diasEntre,
} from "@/lib/crm/cockpit-classificar";
import { isMissingPgColumn } from "@/lib/tenant-default";

/** Status macro que entram na carteira (exclui canceladas). */
const STATUS_FORA = new Set(["cancelada"]);

/**
 * Pedido considerado "aberto"/pendente (proxy de bloqueio leve).
 * `aprovado` NÃO entra: já foi decidido — não trava decisão hoje (não infla bloqueios).
 */
const PEDIDO_ABERTO = ["rascunho", "cotando"];

/** Teto de itens na fila de bloqueios (evita estouro visual do cockpit). */
const MAX_BLOQUEIOS = 50;

/**
 * Erro de leitura que representa AUSÊNCIA de schema (coluna/tabela não existe) — degradação
 * ESPERADA: o bloco vira [] e o cockpit segue. Qualquer outro erro (rede, RLS, timeout) é um
 * sinal real e NÃO deve virar "vazio silencioso" — propagamos para não mascarar bug nascendo.
 */
function ehAusenciaDeSchema(error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation.*does not exist/i.test(error.message ?? "");
}

export type ItemAtrasado = {
  obra_id: string;
  obra_titulo: string;
  obra_codigo: string | null;
  fase: string;
  data_prevista: string;
  dias: number; // negativo (vencido)
  fase_id: string;
};

export type ItemProximo15 = {
  obra_id: string;
  obra_titulo: string;
  fase: string;
  data_prevista: string;
  dias: number; // 0..15
  fase_id: string;
};

export type ItemBloqueio = {
  obra_id: string;
  obra_titulo: string;
  descricao: string;
  tipo: "ocorrencia_critica" | "pedido_pendente";
  id: string;
};

export type CockpitContadores = {
  obras: number;
  pedemAtencao: number; // obras com saúde crítica/atrasada/atenção
  atrasados: number;
  proximos15: number;
  bloqueios: number;
  pagamentosAVencer: number | null; // null = financeiro não estruturado ("em breve")
};

export type CockpitResumoIa = {
  atrasados_ids: string[]; // ids de fase atrasada (top)
  bloqueios_ids: string[];
  total_decisoes: number; // quantas coisas pedem decisão hoje
  obras_criticas: number;
};

export type CockpitFlags = {
  temCronograma: boolean;
  temFinanceiro: boolean;
  temOcorrencias: boolean;
};

export type CockpitPayload = {
  carteira: ObraCard[];
  contadores: CockpitContadores;
  hoje: {
    atrasados: ItemAtrasado[];
    proximos15: ItemProximo15[];
    bloqueios: ItemBloqueio[];
  };
  resumo_ia: CockpitResumoIa;
  flags: CockpitFlags;
};

type ObraRow = {
  id: string;
  codigo: string | null;
  codigo_legivel?: string | null;
  titulo: string;
  tipo_obra?: string | null;
  status: string | null;
  cidade: string | null;
  estado: string | null;
};

type CronogramaRow = FaseCronograma & { id: string; obra_id: string };

/** Lê as obras-base do tenant (tolerante ao SELECT E0 vs legado). */
async function lerObras(
  supabase: SupabaseClient,
  tenantId: string,
  negocioId?: string | null
): Promise<ObraRow[]> {
  const SELECT_E0 =
    "id, codigo, codigo_legivel, titulo, tipo_obra, status, cidade, estado";
  const SELECT_LEGADO = "id, codigo, titulo, status, cidade, estado";

  function montar(select: string) {
    let q = supabase
      .from("hub_obras")
      .select(select)
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(200);
    if (negocioId) q = q.eq("negocio_id", negocioId);
    return q;
  }

  let { data, error } = await montar(SELECT_E0);
  if (error && isMissingPgColumn(error)) {
    ({ data, error } = await montar(SELECT_LEGADO));
  }
  if (error) return [];
  const rows = (data ?? []) as unknown as ObraRow[];
  return rows.filter((o) => !STATUS_FORA.has(normalizarStatusObra(o.status)));
}

/** Lê o cronograma de um conjunto de obras (1 query, filtrada por tenant + obra_id IN). */
async function lerCronograma(
  supabase: SupabaseClient,
  tenantId: string,
  obraIds: string[]
): Promise<CronogramaRow[]> {
  if (!obraIds.length) return [];
  const { data, error } = await supabase
    .from("hub_obras_cronograma")
    .select("id, obra_id, fase, percentual, data_prevista, concluida")
    .eq("tenant_id", tenantId) // mandatório: defesa de tenant (service-role bypassa RLS)
    .in("obra_id", obraIds)
    .limit(2000);
  if (error) {
    if (ehAusenciaDeSchema(error)) return []; // degradação esperada
    throw error; // erro transitório/real: não mascarar como "sem cronograma"
  }
  return (data ?? []) as CronogramaRow[];
}

/** Lê ocorrências críticas abertas (proxy de bloqueio) por obra. */
async function lerOcorrenciasCriticas(
  supabase: SupabaseClient,
  tenantId: string,
  obraIds: string[]
): Promise<{ id: string; obra_id: string; descricao: string }[]> {
  if (!obraIds.length) return [];
  const { data, error } = await supabase
    .from("hub_obras_ocorrencias")
    .select("id, obra_id, descricao, criado_em")
    .eq("tenant_id", tenantId)
    .eq("severidade", "critico")
    .in("obra_id", obraIds)
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) {
    if (ehAusenciaDeSchema(error)) return []; // degradação esperada
    throw error; // erro transitório/real: não mascarar como "sem ocorrências"
  }
  return (data ?? []) as { id: string; obra_id: string; descricao: string }[];
}

/** Lê pedidos abertos por obra (proxy de demanda/bloqueio). */
async function lerPedidosAbertos(
  supabase: SupabaseClient,
  tenantId: string,
  obraIds: string[]
): Promise<{ id: string; obra_id: string | null; descricao: string }[]> {
  if (!obraIds.length) return [];
  const { data, error } = await supabase
    .from("hub_pedidos_material")
    .select("id, obra_id, descricao, status")
    .eq("tenant_id", tenantId)
    .in("obra_id", obraIds)
    .in("status", PEDIDO_ABERTO)
    .limit(300);
  if (error) {
    if (ehAusenciaDeSchema(error)) return []; // degradação esperada
    throw error; // erro transitório/real: não mascarar como "sem pedidos"
  }
  return (data ?? []) as { id: string; obra_id: string | null; descricao: string }[];
}

export async function aggregateCockpit(
  supabase: SupabaseClient,
  tenantId: string,
  opts?: { negocioId?: string | null }
): Promise<CockpitPayload> {
  const hojeISO = hojeISODate();
  const obras = await lerObras(supabase, tenantId, opts?.negocioId);
  const obraIds = obras.map((o) => o.id);

  // Blocos independentes em paralelo — cada um degrada para []/0 isoladamente.
  const [cronograma, ocorrencias, pedidos] = await Promise.all([
    lerCronograma(supabase, tenantId, obraIds),
    lerOcorrenciasCriticas(supabase, tenantId, obraIds),
    lerPedidosAbertos(supabase, tenantId, obraIds),
  ]);

  // Indexa por obra.
  const cronoPorObra = new Map<string, CronogramaRow[]>();
  for (const f of cronograma) {
    const arr = cronoPorObra.get(f.obra_id) ?? [];
    arr.push(f);
    cronoPorObra.set(f.obra_id, arr);
  }
  const ocorrPorObra = new Map<string, typeof ocorrencias>();
  for (const o of ocorrencias) {
    const arr = ocorrPorObra.get(o.obra_id) ?? [];
    arr.push(o);
    ocorrPorObra.set(o.obra_id, arr);
  }
  const pedidosPorObra = new Map<string, number>();
  for (const p of pedidos) {
    if (!p.obra_id) continue;
    pedidosPorObra.set(p.obra_id, (pedidosPorObra.get(p.obra_id) ?? 0) + 1);
  }

  const tituloPorObra = new Map(obras.map((o) => [o.id, o.titulo] as const));
  const codigoPorObra = new Map(
    obras.map((o) => [o.id, o.codigo_legivel || o.codigo || null] as const)
  );

  // ── Carteira ───────────────────────────────────────────────────────────────
  const cards: ObraCard[] = obras.map((o) => {
    const fases = cronoPorObra.get(o.id) ?? [];
    const atrasados = fases.filter((f) => ehAtrasada(f, hojeISO)).length;
    const marco = proximoMarco(fases, hojeISO);
    const ocorr = ocorrPorObra.get(o.id)?.length ?? 0;
    const ped = pedidosPorObra.get(o.id) ?? 0;
    const saude: SaudeObra = derivarSaude({
      status: o.status,
      atrasados,
      ocorrenciasCriticas: ocorr,
      pedidosAbertos: ped,
      diasProximoMarco: marco?.dias ?? null,
      temCronograma: fases.length > 0,
    });
    return {
      id: o.id,
      titulo: o.titulo,
      codigo: codigoPorObra.get(o.id) ?? null,
      tipo_obra: o.tipo_obra ?? null,
      status: o.status,
      cidade: o.cidade,
      estado: o.estado,
      saude,
      avanco: avancoMedio(fases),
      proximoMarco: marco,
      atrasados,
      ocorrenciasCriticas: ocorr,
      pedidosAbertos: ped,
      temCronograma: fases.length > 0,
    };
  });
  const carteira = ordenarPorUrgencia(cards);

  // ── Fila "Hoje" ──────────────────────────────────────────────────────────────
  const atrasados: ItemAtrasado[] = [];
  const proximos15: ItemProximo15[] = [];
  for (const f of cronograma) {
    const data = soData(f.data_prevista);
    if (!data) continue;
    if (ehAtrasada(f, hojeISO)) {
      atrasados.push({
        obra_id: f.obra_id,
        obra_titulo: tituloPorObra.get(f.obra_id) ?? "Obra",
        obra_codigo: codigoPorObra.get(f.obra_id) ?? null,
        fase: String(f.fase ?? "Fase"),
        data_prevista: data,
        dias: diasEntre(hojeISO, data),
        fase_id: f.id,
      });
    } else if (ehProxima15(f, hojeISO)) {
      proximos15.push({
        obra_id: f.obra_id,
        obra_titulo: tituloPorObra.get(f.obra_id) ?? "Obra",
        fase: String(f.fase ?? "Fase"),
        data_prevista: data,
        dias: diasEntre(hojeISO, data),
        fase_id: f.id,
      });
    }
  }
  // Mais vencidos primeiro (dias mais negativo); próximos por data ascendente.
  atrasados.sort((a, b) => a.dias - b.dias || a.data_prevista.localeCompare(b.data_prevista));
  proximos15.sort((a, b) => a.dias - b.dias);

  const bloqueios: ItemBloqueio[] = [];
  for (const o of ocorrencias) {
    bloqueios.push({
      obra_id: o.obra_id,
      obra_titulo: tituloPorObra.get(o.obra_id) ?? "Obra",
      descricao: o.descricao,
      tipo: "ocorrencia_critica",
      id: o.id,
    });
  }
  // Pedidos em rascunho/cotando como bloqueio leve (proxy secundário).
  for (const p of pedidos) {
    if (!p.obra_id) continue;
    bloqueios.push({
      obra_id: p.obra_id,
      obra_titulo: tituloPorObra.get(p.obra_id) ?? "Obra",
      descricao: p.descricao,
      tipo: "pedido_pendente",
      id: p.id,
    });
  }
  // Cap final (ocorrências + pedidos): protege a UI de estouro visual, como em proximos15.
  const bloqueiosTop = bloqueios.slice(0, MAX_BLOQUEIOS);

  // ── Contadores + resumo IA + flags ──────────────────────────────────────────
  const pedemAtencao = carteira.filter(
    (c) =>
      c.saude === "critica" ||
      c.saude === "atrasada" ||
      c.saude === "urgente" ||
      c.saude === "atencao"
  ).length;
  const obrasCriticas = carteira.filter((c) => c.saude === "critica").length;

  const contadores: CockpitContadores = {
    obras: carteira.length,
    pedemAtencao,
    atrasados: atrasados.length,
    proximos15: proximos15.length,
    bloqueios: bloqueiosTop.length,
    pagamentosAVencer: null, // financeiro estruturado não existe → "chega em breve"
  };

  // Tudo que pede decisão HOJE: vencidos + bloqueios + marcos chegando (próximos 15d).
  // Sem o último termo, o banner "A IA preparou N recomendações" some quando só há marcos próximos.
  const totalDecisoes = atrasados.length + bloqueiosTop.length + proximos15.length;
  const resumo_ia: CockpitResumoIa = {
    atrasados_ids: atrasados.slice(0, 10).map((a) => a.fase_id),
    bloqueios_ids: bloqueiosTop.slice(0, 10).map((b) => b.id),
    total_decisoes: totalDecisoes,
    obras_criticas: obrasCriticas,
  };

  const flags: CockpitFlags = {
    temCronograma: cronograma.length > 0,
    temFinanceiro: false, // sem tabela financeira estruturada hoje
    temOcorrencias: ocorrencias.length > 0,
  };

  return {
    carteira,
    contadores,
    hoje: { atrasados, proximos15, bloqueios: bloqueiosTop },
    resumo_ia,
    flags,
  };
}

/**
 * Conta obras ativas do tenant de forma barata (reuso de safeCount) — usado por chamadores
 * que só querem o número (ex.: badge de menu). Mantém o padrão `.eq("tenant_id")` puro.
 */
export async function contarObrasAtivas(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  return safeCount(
    supabase
      .from("hub_obras")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      // inclui o status novo pós-E0 ("ativa") + o legado, p/ não subcontar após a migração
      .in("status", ["ativa", "em_andamento", "planejamento", "pausada", "mobilizacao"])
  );
}
