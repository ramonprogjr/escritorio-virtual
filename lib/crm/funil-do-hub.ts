import { labelMercadoPrefixo } from "@/lib/crm/negocio-cadastro";

/**
 * FUNIL DO HUB — a leitura ESTRATÉGICA do lead na rede, não o funil de vendas de um tenant.
 * É uma COORTE de leads: cada elo é um subconjunto do anterior, então a conversão nunca passa
 * de 100% (mata o bug do "200%" do funil comercial genérico). Fatiável por MERCADO e por ORIGEM
 * — as duas etiquetas que todo lead carrega.
 *
 * Elos: Captada → Roteada → Aceita (virou negócio) → Em execução → Paga (ganho).
 * Fonte: hub_leads_crm (+ estagio/origem/mercado) · hub_negocio_vinculos(papel=lead_origem)
 * · hub_negocios(status) · hub_obras(negocio_id, status). Tudo WITHIN-TENANT (real hoje).
 *
 * Negócios SEM lead de origem (entrada direta/mercado) NÃO entram na coorte — o funil é
 * "o que aconteceu com os leads que captei". Esses aparecem à parte (negociosSemLead).
 */

export type FunilLeadRow = {
  id: string;
  estagio: string | null;
  valor_estimado: number | null;
  origem: string | null;
  metadata?: unknown;
};
export type FunilVinculoRow = { negocio_id: string | null; entidade_id: string | null };
export type FunilNegocioRow = { id: string; status: string | null; valor_estimado: number | null };
export type FunilObraRow = { negocio_id: string | null; status: string | null };

export type FunilHubFiltro = { mercado?: string; origem?: string };

export type FunilHubElo = {
  key: "captada" | "roteada" | "aceita" | "execucao" | "paga";
  label: string;
  sub: string;
  count: number;
  valor: number;
  /** % da captação que chegou até este elo (sempre ≤ 100). null no elo de captação. */
  pctDaCaptacao: number | null;
  cor: string;
};

export type FunilHubResultado = {
  elos: FunilHubElo[];
  mercados: { valor: string; label: string }[];
  origens: { valor: string; label: string }[];
  negociosSemLead: number;
};

const ROTEADO_OU_ALEM = new Set(["encaminhado", "convertido_negocio"]);
const NEGOCIO_ATIVO_OU_GANHO = new Set(["aberto", "em_negociacao", "fechado_ganho"]);
const OBRA_EM_EXECUCAO = new Set(["ativa", "planejamento", "atencao", "critica", "mobilizacao", "em_andamento"]);

export const ORIGEM_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
  linkedin: "LinkedIn",
  site: "Site",
  indicacao: "Indicação",
  trafego: "Tráfego",
  manual: "Cadastro manual",
  outro: "Outro",
};

function mercadoDoLead(lead: FunilLeadRow): string | null {
  const m = lead.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const obj = m as Record<string, unknown>;
    const mp = obj.mercado_principal;
    if (typeof mp === "string" && mp.trim()) return mp.trim().toUpperCase();
    if (Array.isArray(obj.mercados) && typeof obj.mercados[0] === "string") {
      return (obj.mercados[0] as string).trim().toUpperCase();
    }
  }
  return null;
}

export function montarFunilDoHub(input: {
  leads: FunilLeadRow[];
  vinculos: FunilVinculoRow[];
  negocios: FunilNegocioRow[];
  obras: FunilObraRow[];
  filtro?: FunilHubFiltro;
}): FunilHubResultado {
  const { leads, vinculos, negocios, obras, filtro = {} } = input;

  // Índices de negócio/obra
  const negocioPorId = new Map(negocios.map((n) => [n.id, n]));
  const obraPorNegocio = new Map<string, boolean>();
  for (const o of obras) {
    if (o.negocio_id && OBRA_EM_EXECUCAO.has(String(o.status ?? ""))) {
      obraPorNegocio.set(String(o.negocio_id), true);
    }
  }
  // lead → negócios de origem (via vínculo lead_origem)
  const negociosDoLead = new Map<string, string[]>();
  const negociosComLead = new Set<string>();
  for (const v of vinculos) {
    const leadId = v.entidade_id ? String(v.entidade_id) : null;
    const negId = v.negocio_id ? String(v.negocio_id) : null;
    if (!leadId || !negId) continue;
    negociosComLead.add(negId);
    const arr = negociosDoLead.get(leadId) ?? [];
    arr.push(negId);
    negociosDoLead.set(leadId, arr);
  }

  // Listas para os filtros (a partir de TODOS os leads, antes de filtrar)
  const mercadosSet = new Map<string, number>();
  const origensSet = new Map<string, number>();
  for (const l of leads) {
    const mkt = mercadoDoLead(l);
    if (mkt) mercadosSet.set(mkt, (mercadosSet.get(mkt) ?? 0) + 1);
    const org = l.origem ? String(l.origem) : null;
    if (org) origensSet.set(org, (origensSet.get(org) ?? 0) + 1);
  }

  const mercadoFiltro = filtro.mercado ? filtro.mercado.toUpperCase() : "";
  const origemFiltro = filtro.origem ?? "";

  const coorte = leads.filter((l) => {
    if (mercadoFiltro && mercadoDoLead(l) !== mercadoFiltro) return false;
    if (origemFiltro && String(l.origem ?? "") !== origemFiltro) return false;
    return true;
  });

  let captadaN = 0,
    roteadaN = 0,
    aceitaN = 0,
    execucaoN = 0,
    pagaN = 0;
  let captadaV = 0,
    roteadaV = 0,
    aceitaV = 0,
    execucaoV = 0,
    pagaV = 0;

  for (const l of coorte) {
    const valor = Number(l.valor_estimado ?? 0);
    const negs = (negociosDoLead.get(l.id) ?? [])
      .map((id) => negocioPorId.get(id))
      .filter((n): n is FunilNegocioRow => !!n);
    const temNegocio = negs.some((n) => NEGOCIO_ATIVO_OU_GANHO.has(String(n.status ?? "")));
    const temObra = negs.some((n) => obraPorNegocio.get(n.id) === true);
    const temGanho = negs.some((n) => String(n.status ?? "") === "fechado_ganho");
    const roteado = ROTEADO_OU_ALEM.has(String(l.estagio ?? "")) || temNegocio;

    captadaN++;
    captadaV += valor;
    if (roteado) {
      roteadaN++;
      roteadaV += valor;
    }
    if (temNegocio) {
      aceitaN++;
      aceitaV += valor;
    }
    if (temObra) {
      execucaoN++;
      execucaoV += valor;
    }
    if (temGanho) {
      pagaN++;
      pagaV += valor;
    }
  }

  const pct = (n: number) => (captadaN > 0 ? Math.round((n / captadaN) * 100) : null);

  const elos: FunilHubElo[] = [
    { key: "captada", label: "Captada", sub: "demanda que entrou", count: captadaN, valor: captadaV, pctDaCaptacao: null, cor: "#4db3c4" },
    { key: "roteada", label: "Roteada", sub: "direcionada ao parceiro", count: roteadaN, valor: roteadaV, pctDaCaptacao: pct(roteadaN), cor: "#c9a24a" },
    { key: "aceita", label: "Aceita", sub: "virou negócio", count: aceitaN, valor: aceitaV, pctDaCaptacao: pct(aceitaN), cor: "#8b7cf6" },
    { key: "execucao", label: "Em execução", sub: "obra rodando", count: execucaoN, valor: execucaoV, pctDaCaptacao: pct(execucaoN), cor: "#22c55e" },
    { key: "paga", label: "Ganha", sub: "negócio fechado", count: pagaN, valor: pagaV, pctDaCaptacao: pct(pagaN), cor: "#3fb950" },
  ];

  const mercados = [...mercadosSet.keys()]
    .sort()
    .map((v) => ({ valor: v, label: labelMercadoPrefixo(v) || v }));
  const origens = [...origensSet.keys()]
    .sort()
    .map((v) => ({ valor: v, label: ORIGEM_LABEL[v] || v }));

  const negociosSemLead = negocios.filter(
    (n) => NEGOCIO_ATIVO_OU_GANHO.has(String(n.status ?? "")) && !negociosComLead.has(n.id)
  ).length;

  return { elos, mercados, origens, negociosSemLead };
}
