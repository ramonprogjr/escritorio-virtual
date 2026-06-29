/**
 * E7 (Fase 2) — Árvore de ESCOPO unificada: lógica PURA (sem I/O). A "planilha viva".
 *
 * Fonte única em runtime = o endpoint /api/crm/obras/[id]/escopo, que lê das views E7
 * (vw_hub_obra_item_margem / vw_hub_obra_item_peso) com fallback a hub_obra_itens. Este
 * módulo é o espelho in-code das REGRAS materializadas no SQL (E7 + E7b), para:
 *   - a UI <ArvoreEscopo> agregar/recalcular AO VIVO (custo×BDI×qtd, subtotais, peso) sem ir ao servidor;
 *   - o endpoint montar a árvore (ambiente → disciplina → item) + subtotais + cockpit;
 *   - os testes travarem a regra (custo_total, BDI 3 camadas, peso só-raiz, normalização) em TS.
 *
 * DECISÕES TRAVADAS pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9):
 *   #1 hub_obra_itens = o ÚNICO item de escopo (carrega custo+preço+avanço+datas).
 *   #3 BDI = fator único por empresa (hub_obras.bdi_fator), override por item; leitura 3 camadas: item→obra→1.0.
 *   #4 Avanço POR ITEM; ambiente/disciplina = AGREGAÇÃO ponderada bottom-up pelo peso financeiro (só raiz).
 *
 * ⚠️ Espelha o SQL E7: custo_total = soma_inline × quantidade (NÃO custo_unitario × quantidade —
 *    Postgres não encadeia GENERATED). custo NULL conta como 0; quantidade NULL → custo_total NULL.
 */

import { disciplinaPorSlug } from "@/lib/obras/eap-presets";

// ── LENTES (faixa-dinheiro/avanço — uma por vez) ──────────────────────────────
export const LENTES = ["preco", "custo", "margem", "avanco"] as const;
export type LenteEscopo = (typeof LENTES)[number];

export function isLenteEscopo(v: string): v is LenteEscopo {
  return (LENTES as readonly string[]).includes(v);
}

export const ROTULO_LENTE: Record<LenteEscopo, string> = {
  preco: "Preço",
  custo: "Custo",
  margem: "Margem",
  avanco: "Avanço",
};

// ── PERSONA (quem vê o quê — decisão 3b / design §3) ──────────────────────────
export const PERSONAS = ["executor", "arquiteto", "hub", "prestador"] as const;
export type PersonaEscopo = (typeof PERSONAS)[number];

export function isPersonaEscopo(v: string): v is PersonaEscopo {
  return (PERSONAS as readonly string[]).includes(v);
}

/**
 * Decisão 3b: custo e margem só p/ executor|hub. Arquiteto não vê a faixa-dinheiro;
 * prestador vê só o preço do que executa, nunca a margem. (Bifurcação na APRESENTAÇÃO.)
 */
export function personaPodeVerCusto(p: PersonaEscopo): boolean {
  return p === "executor" || p === "hub";
}
export function personaPodeVerMargem(p: PersonaEscopo): boolean {
  return p === "executor" || p === "hub";
}
export function personaPodeVerPreco(p: PersonaEscopo): boolean {
  return p !== "arquiteto";
}

/** Lentes disponíveis para a persona (avanço sempre; dinheiro conforme o papel). */
export function lentesDaPersona(p: PersonaEscopo): LenteEscopo[] {
  const out: LenteEscopo[] = [];
  if (personaPodeVerPreco(p)) out.push("preco");
  if (personaPodeVerCusto(p)) out.push("custo");
  if (personaPodeVerMargem(p)) out.push("margem");
  out.push("avanco");
  return out;
}

// ── BDI 3 camadas (item → obra → 1.0 neutro) ──────────────────────────────────
/** Espelha COALESCE(i.bdi_fator, o.bdi_fator, 1.0) das views E7. NULL/<=0 cai p/ a próxima camada. */
export function bdiEfetivo(itemBdi: number | null | undefined, obraBdi: number | null | undefined): number {
  const i = Number(itemBdi);
  if (Number.isFinite(i) && i > 0) return i;
  const o = Number(obraBdi);
  if (Number.isFinite(o) && o > 0) return o;
  return 1.0;
}

// ── Custo do item (espelha as GENERATED de E7) ────────────────────────────────
/** custo_unitario = locação/frete + material + mão de obra (cada NULL = 0). */
export function custoUnitario(it: {
  custo_locacao_frete?: number | null;
  custo_material?: number | null;
  custo_mao_obra?: number | null;
}): number {
  const n = (v: number | null | undefined) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  return round2(n(it.custo_locacao_frete) + n(it.custo_material) + n(it.custo_mao_obra));
}

/**
 * custo_total = ROUND( (locacao+material+mao_obra) × quantidade, 2 ). quantidade NULL → null.
 * ⚠️ Espelha EXATAMENTE a coluna GENERATED do E7: usa a SOMA INLINE crua × qtd (NÃO o
 * custo_unitario já arredondado — senão divergiria do banco em centavos). Arredonda UMA vez no fim.
 */
export function custoTotal(it: {
  custo_locacao_frete?: number | null;
  custo_material?: number | null;
  custo_mao_obra?: number | null;
  quantidade?: number | null;
}): number | null {
  const q = Number(it.quantidade);
  if (it.quantidade == null || !Number.isFinite(q)) return null;
  const n = (v: number | null | undefined) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const somaInline = n(it.custo_locacao_frete) + n(it.custo_material) + n(it.custo_mao_obra);
  return round2(somaInline * q);
}

// ── Preço (custo × BDI) e margem — espelha vw_hub_obra_item_margem ─────────────
export function precoUnitario(custoUnit: number, bdi: number): number {
  return round2(custoUnit * bdi);
}

/** preço_total = custo_total × BDI. custo_total NULL → null. */
export function precoTotal(custoTot: number | null, bdi: number): number | null {
  if (custoTot == null) return null;
  return round2(custoTot * bdi);
}

/** margem% = (preço − custo) / preço × 100. Sem preço (custo 0/NULL) → null (UI: "—"). */
export function margemPct(custoTot: number | null, bdi: number): number | null {
  if (custoTot == null) return null;
  const preco = custoTot * bdi;
  if (!(preco > 0)) return null;
  return round2(((preco - custoTot) / preco) * 100);
}

/**
 * Fórmula EXPOSTA (o dono é engenheiro: confia em ver a conta). Ex.: "R$ 50 × 1.06 × 17 = R$ 901".
 * qtd=0 é uma quantidade VÁLIDA (item zerado): mostra "× 0 = R$ 0,00", NÃO cai p/ "× 1". Só
 * quantidade ausente (null/NaN) usa 1 como preview. (Bug do "× 1": o caller passava `qtd || null`.)
 */
export function formulaPreco(custoUnit: number, bdi: number, quantidade: number | null): string {
  const n = Number(quantidade);
  const q = quantidade == null || !Number.isFinite(n) ? 1 : n; // 0 é finito → permanece 0
  const total = round2(custoUnit * bdi * q);
  return `${fmtMoeda(custoUnit)} × ${fmtFator(bdi)} × ${q} = ${fmtMoeda(total)}`;
}

// ── Item da árvore (subconjunto consumido pela UI/agg) ────────────────────────
export type ItemEscopoInput = {
  id: string;
  parent_id: string | null;
  ambiente?: string | null;
  disciplina_slug?: string | null;
  nome?: string | null;
  codigo?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
  pct_avanco?: number | null;
  custo_locacao_frete?: number | null;
  custo_material?: number | null;
  custo_mao_obra?: number | null;
  bdi_fator?: number | null;
};

/** Item enriquecido com os derivados (o que o endpoint devolve por linha). */
export type ItemEscopoCalc = ItemEscopoInput & {
  custo_unitario: number;
  custo_total: number | null;
  preco_unitario: number;
  preco_total: number | null;
  margem_pct: number | null;
  bdi_efetivo: number;
};

/** Calcula os derivados de UM item (in-code; usado no fallback sem as views E7). */
export function calcularItem(it: ItemEscopoInput, obraBdi: number | null | undefined): ItemEscopoCalc {
  const bdi = bdiEfetivo(it.bdi_fator, obraBdi);
  const cu = custoUnitario(it);
  const ct = custoTotal(it);
  return {
    ...it,
    custo_unitario: cu,
    custo_total: ct,
    preco_unitario: precoUnitario(cu, bdi),
    preco_total: precoTotal(ct, bdi),
    margem_pct: margemPct(ct, bdi),
    bdi_efetivo: bdi,
  };
}

// ── Peso financeiro normalizado (só itens-raiz) — espelha vw_hub_obra_item_peso ──
/**
 * peso de cada raiz = preço_total / Σ(preço_total das raízes). parent_id != null não entra
 * (não conta pai + subitem em dobro). Σ = 0 (sem custo) → todos null (degrada p/ média simples).
 * Devolve um Map item_id → peso (0..1) ou null.
 */
export function pesosNormalizados(
  itens: ItemEscopoCalc[]
): Map<string, number | null> {
  const raizes = itens.filter((i) => i.parent_id == null);
  const total = raizes.reduce((acc, i) => acc + (i.preco_total ?? 0), 0);
  const m = new Map<string, number | null>();
  for (const i of raizes) {
    if (total > 0) m.set(i.id, round6((i.preco_total ?? 0) / total));
    else m.set(i.id, null);
  }
  return m;
}

/**
 * Avanço físico PONDERADO pelo peso financeiro (só raízes). Quando há custo, pondera por
 * preço_total; sem custo (peso null), cai p/ média simples do pct_avanco — honesto, como o design.
 * Itens cancelados não são filtrados aqui (o caller já entrega a árvore relevante).
 */
export function avancoPonderado(itens: ItemEscopoCalc[]): number {
  const raizes = itens.filter((i) => i.parent_id == null);
  if (raizes.length === 0) return 0;
  const total = raizes.reduce((acc, i) => acc + (i.preco_total ?? 0), 0);
  if (total > 0) {
    const soma = raizes.reduce((acc, i) => acc + clampPct(i.pct_avanco) * (i.preco_total ?? 0), 0);
    return Math.round(soma / total);
  }
  // sem base de custo → média simples
  const soma = raizes.reduce((acc, i) => acc + clampPct(i.pct_avanco), 0);
  return Math.round(soma / raizes.length);
}

// ── Subtotais de um grupo (ambiente ou disciplina) ────────────────────────────
export type SubtotalGrupo = {
  custo: number; // soma custo_total (NULL=0)
  preco: number; // soma preço_total (NULL=0)
  margem_pct: number | null; // (preco−custo)/preco; null se preco<=0
  avanco: number; // avanço ponderado pelo preço dos itens-raiz do grupo
  itens_raiz: number;
};

/** Subtotal de uma lista de itens já-calculados (considera só raízes p/ peso/avanço; soma todos p/ dinheiro). */
export function subtotalGrupo(itens: ItemEscopoCalc[]): SubtotalGrupo {
  const raizes = itens.filter((i) => i.parent_id == null);
  // Dinheiro: soma os itens-raiz (o subitem já está embutido no pai na planilha do dono;
  // somar todos contaria em dobro). Mantém coerência com o peso (que é só-raiz).
  const custo = round2(raizes.reduce((acc, i) => acc + (i.custo_total ?? 0), 0));
  const preco = round2(raizes.reduce((acc, i) => acc + (i.preco_total ?? 0), 0));
  return {
    custo,
    preco,
    margem_pct: preco > 0 ? round2(((preco - custo) / preco) * 100) : null,
    avanco: avancoPonderado(itens),
    itens_raiz: raizes.length,
  };
}

// ── Árvore: ambiente → disciplina → item ──────────────────────────────────────
export type NoDisciplina = {
  slug: string;
  label: string;
  cor: string;
  itens: ItemEscopoCalc[];
  subtotal: SubtotalGrupo;
};
export type NoAmbiente = {
  chave: string;
  label: string;
  disciplinas: NoDisciplina[];
  subtotal: SubtotalGrupo;
};
export type CockpitEscopo = {
  total_orcado: number; // Σ preço_total das raízes
  custo: number; // Σ custo_total das raízes
  margem_pct: number | null;
  avanco: number; // avanço físico ponderado
  itens: number; // nº de itens-raiz
};

/** Rótulo legível de um código de ambiente (slug → Title Case). Espelha rotuloAmbiente da UI E2. */
export function rotuloAmbiente(codigo: string | null | undefined): string {
  const base = (codigo || "").replace(/_/g, " ").trim();
  if (!base) return "Sem ambiente definido";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Rótulo + cor da disciplina (reusa a taxonomia EAP; fallback neutro p/ slug desconhecido). */
export function rotuloDisciplina(slug: string | null | undefined): { label: string; cor: string } {
  const s = (slug || "").trim();
  if (!s) return { label: "Sem disciplina", cor: "#6B7280" };
  const d = disciplinaPorSlug(s);
  return d ? { label: d.label, cor: d.cor } : { label: s, cor: "#6B7280" };
}

/**
 * Monta a árvore agrupada ambiente → disciplina → item, com subtotais por nível e o cockpit.
 * `itens` já vêm calculados (com os derivados). Ordena ambientes por preço desc, disciplinas idem.
 */
export function montarArvore(itens: ItemEscopoCalc[]): {
  ambientes: NoAmbiente[];
  cockpit: CockpitEscopo;
} {
  // 1) agrupa por ambiente (canonical = trim/lowercase já feito no write; aqui só agrupa).
  const porAmbiente = new Map<string, ItemEscopoCalc[]>();
  for (const it of itens) {
    const chave = (it.ambiente || "").trim().toLowerCase() || "__sem__";
    const arr = porAmbiente.get(chave) ?? [];
    arr.push(it);
    porAmbiente.set(chave, arr);
  }

  const ambientes: NoAmbiente[] = [];
  for (const [chave, itensAmb] of porAmbiente) {
    // 2) dentro do ambiente, agrupa por disciplina.
    const porDisc = new Map<string, ItemEscopoCalc[]>();
    for (const it of itensAmb) {
      const slug = (it.disciplina_slug || "").trim() || "__sem__";
      const arr = porDisc.get(slug) ?? [];
      arr.push(it);
      porDisc.set(slug, arr);
    }
    const disciplinas: NoDisciplina[] = [];
    for (const [slug, itensDisc] of porDisc) {
      const meta = rotuloDisciplina(slug === "__sem__" ? null : slug);
      disciplinas.push({
        slug,
        label: meta.label,
        cor: meta.cor,
        itens: itensDisc,
        subtotal: subtotalGrupo(itensDisc),
      });
    }
    disciplinas.sort((a, b) => b.subtotal.preco - a.subtotal.preco || b.itens.length - a.itens.length);

    ambientes.push({
      chave,
      label: rotuloAmbiente(chave === "__sem__" ? null : chave),
      disciplinas,
      subtotal: subtotalGrupo(itensAmb),
    });
  }
  ambientes.sort((a, b) => b.subtotal.preco - a.subtotal.preco || b.subtotal.itens_raiz - a.subtotal.itens_raiz);

  return { ambientes, cockpit: cockpitDe(itens) };
}

/** Cockpit (4 KPIs) — Σ sobre os itens-raiz. */
export function cockpitDe(itens: ItemEscopoCalc[]): CockpitEscopo {
  const raizes = itens.filter((i) => i.parent_id == null);
  const custo = round2(raizes.reduce((acc, i) => acc + (i.custo_total ?? 0), 0));
  const preco = round2(raizes.reduce((acc, i) => acc + (i.preco_total ?? 0), 0));
  return {
    total_orcado: preco,
    custo,
    margem_pct: preco > 0 ? round2(((preco - custo) / preco) * 100) : null,
    avanco: avancoPonderado(itens),
    itens: raizes.length,
  };
}

// ── Helpers numéricos / formatação ────────────────────────────────────────────
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
export function round6(n: number): number {
  return Math.round((n + Number.EPSILON) * 1e6) / 1e6;
}
function clampPct(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** R$ pt-BR sem depender de Intl em todo lugar (estável p/ teste). */
export function fmtMoeda(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `R$ ${Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/** Fator de BDI: até 4 casas, sem zeros à direita inúteis (1.06, 1, 1.155). */
export function fmtFator(n: number): string {
  return Number(n.toFixed(4)).toString();
}
