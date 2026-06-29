/**
 * E0.5 — Taxonomia de atividades (descritivo padrão) + Segmentos + Ambientes.
 *
 * A fonte canônica em runtime é o banco (hub_obra_taxonomia, seed global). Este arquivo
 * é o ESPELHO in-code, no MESMO padrão de lib/obras/eap-presets.ts:
 *   (a) tipo único (`TaxonomiaAtividade`);
 *   (b) FALLBACK gracioso quando a migração E0.5 ainda não foi aplicada (a UI lê do fallback,
 *       avisa "padrão local", nunca quebra);
 *   (c) seed de referência para a tela e para a futura IA do Orçamento.
 *
 * MODELAGEM (decisão do EAP-REFINADA-DESIGN.md): a taxonomia NÃO é chaveada por
 * segmento/ambiente. Uma "Tomada 1,10m" é a MESMA atividade em qualquer contexto — o que varia
 * (onde aparece, quanto) vive em `ambiente_tipico[]`/`segmento_tipico[]` (guias) e o `qtd` por
 * contexto vai no PRESET (`atividades_default`), não aqui. Mantém a taxonomia enxuta e auditável.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

// ── Segmentos (espelham o CHECK de hub_obras.segmento) ───────────────────────
export const SEGMENTOS = [
  { slug: "residencial", label: "Residencial", icone: "🏠" },
  { slug: "comercial", label: "Comercial", icone: "🏢" },
  { slug: "corporativo", label: "Corporativo", icone: "🏬" },
  { slug: "clinicas", label: "Clínicas", icone: "🩺" },
  { slug: "pdv", label: "PDV", icone: "🛒" },
] as const;

export type SegmentoSlug = (typeof SEGMENTOS)[number]["slug"];

const SEGMENTO_SLUGS = new Set<string>(SEGMENTOS.map((s) => s.slug));

export function isSegmentoValido(v: string | null | undefined): v is SegmentoSlug {
  return typeof v === "string" && SEGMENTO_SLUGS.has(v);
}

// ── Tipo de atividade da taxonomia (espelha a tabela hub_obra_taxonomia) ──────
export type TaxonomiaAtividade = {
  /** Estável; alvo da classificação da IA. Ex.: "ELET-TOMADA-110". */
  codigo: string;
  disciplina_slug: string;
  /** Rótulo curto exibido no card. Ex.: "Tomada 1,10m". */
  nome: string;
  /** Memorial pronto (NBR, altura, bitola) — editável por obra. */
  descricao_padrao: string;
  /** Vocabulário para a IA classificar texto livre. Ex.: ["tomada alta","TUG"]. */
  sinonimos: string[];
  unidade: string;
  /** Sugestão; o humano confirma (v1 do dono). null = sem sugestão. */
  qtd_padrao: number | null;
  ambiente_tipico: string[];
  segmento_tipico: string[];
  /** Liga ao marketplace E5 depois. null = sem referência ainda. */
  valor_ref_unitario: number | null;
  ordem: number;
};

/**
 * Linha persistida (o que a API devolve da tabela). Inclui os campos de controle
 * que o fallback in-code não tem (id/tenant_id/ativo/origem).
 */
export type TaxonomiaRow = TaxonomiaAtividade & {
  id: string;
  tenant_id: string | null;
  ativo: boolean;
  origem: "sistema" | "tenant" | "ia";
};

// ── SEED in-code (espelho do seed global da migração) ─────────────────────────
// Elétrica COMPLETA (o exemplo literal do dono) + um conjunto básico das outras 4
// disciplinas-núcleo (Civil, Hidráulica, Revestimentos, Pintura). O seed da migração
// é a fonte canônica; este array deve permanecer idêntico ao bloco SQL.

function atv(
  codigo: string,
  disciplina_slug: string,
  nome: string,
  descricao_padrao: string,
  sinonimos: string[],
  unidade: string,
  qtd_padrao: number | null,
  ambiente_tipico: string[],
  ordem: number
): TaxonomiaAtividade {
  return {
    codigo,
    disciplina_slug,
    nome,
    descricao_padrao,
    sinonimos,
    unidade,
    qtd_padrao,
    ambiente_tipico,
    segmento_tipico: [],
    valor_ref_unitario: null,
    ordem,
  };
}

export const TAXONOMIA_FALLBACK: TaxonomiaAtividade[] = [
  // ── Elétrica (completa — referência do dono) ──
  atv(
    "ELET-DADOS-VOZ",
    "eletrica",
    "Dados e voz",
    "Ponto de dados/voz com cabo de rede UTP cat.6, terminado em conector RJ45 keystone, conforme NBR 14565.",
    ["ponto de rede", "rj45", "cabo de rede", "ponto de dados", "rede"],
    "pt",
    null,
    ["recepcao", "sala", "escritorio"],
    0
  ),
  atv(
    "ELET-TOMADA-110",
    "eletrica",
    "Tomada 1,10m",
    "Tomada de uso geral (TUG) 2P+T 10A/20A instalada a 1,10m do piso acabado, padrão NBR 5410.",
    ["tomada alta", "tomada uso geral", "tug", "tomada 1,10", "tomada media"],
    "pt",
    null,
    ["sala", "recepcao", "quarto", "escritorio"],
    1
  ),
  atv(
    "ELET-TOMADA-030",
    "eletrica",
    "Tomada 0,30m",
    "Tomada de uso geral (TUG) 2P+T instalada a 0,30m do piso acabado (baixa), padrão NBR 5410.",
    ["tomada baixa", "tomada fogao", "tomada 0,30", "tomada rodape"],
    "pt",
    null,
    ["sala", "quarto", "cozinha"],
    2
  ),
  atv(
    "ELET-ILUM-LED",
    "eletrica",
    "Iluminação LED",
    "Ponto de iluminação com luminária LED embutida (spot/plafon), incluindo infraestrutura e comando.",
    ["spot", "ponto de luz", "luminaria embutida", "led", "iluminacao"],
    "pt",
    null,
    ["sala", "recepcao", "cozinha", "banheiro"],
    3
  ),
  atv(
    "ELET-ILUM-PLAFON",
    "eletrica",
    "Iluminação plafon",
    "Ponto de iluminação com luminária de sobrepor (plafon), incluindo infraestrutura e comando.",
    ["plafon", "luminaria sobrepor", "luminaria teto"],
    "pt",
    null,
    ["banheiro", "area_servico", "corredor"],
    4
  ),
  atv(
    "ELET-QDL",
    "eletrica",
    "Quadro de luz (QDL)",
    "Quadro de distribuição de luz com disjuntores DR e DPS, barramento e identificação de circuitos, NBR 5410.",
    ["qdl", "disjuntor", "quadro eletrico", "quadro de distribuicao", "quadro de luz"],
    "un",
    1,
    ["area_tecnica", "hall", "area_servico"],
    5
  ),

  // ── Civil (básico) ──
  atv(
    "CIVIL-ALVENARIA",
    "civil",
    "Alvenaria de vedação",
    "Parede de alvenaria de vedação em bloco cerâmico/concreto, assentada com argamassa, prumo e nível.",
    ["parede", "bloco", "tijolo", "vedacao", "alvenaria"],
    "m²",
    null,
    ["sala", "quarto", "area_servico"],
    0
  ),
  atv(
    "CIVIL-CONTRAPISO",
    "civil",
    "Contrapiso",
    "Contrapiso de regularização em argamassa de cimento e areia, nivelado e desempenado para receber revestimento.",
    ["regularizacao", "contra piso", "piso bruto", "lastro"],
    "m²",
    null,
    ["sala", "cozinha", "area_servico"],
    1
  ),
  atv(
    "CIVIL-DRYWALL",
    "civil",
    "Parede em drywall",
    "Parede em chapas de gesso acartonado (drywall) sobre estrutura metálica, com lã mineral quando especificado.",
    ["gesso acartonado", "divisoria", "parede seca", "drywall"],
    "m²",
    null,
    ["escritorio", "sala", "recepcao"],
    2
  ),

  // ── Hidráulica (básico) ──
  atv(
    "HIDR-PONTO-AGUA",
    "hidraulica",
    "Ponto de água fria",
    "Ponto de água fria em tubo PVC soldável, com registro e teste de estanqueidade, conforme NBR 5626.",
    ["agua fria", "ponto de agua", "tubulacao agua", "hidraulica"],
    "pt",
    null,
    ["banheiro", "cozinha", "area_servico"],
    0
  ),
  atv(
    "HIDR-PONTO-ESGOTO",
    "hidraulica",
    "Ponto de esgoto",
    "Ponto de esgoto sanitário em tubo PVC série normal, com caimento e ventilação, conforme NBR 8160.",
    ["esgoto", "ponto de esgoto", "ralo", "sanitario"],
    "pt",
    null,
    ["banheiro", "cozinha", "area_servico"],
    1
  ),
  atv(
    "HIDR-LOUCA-METAL",
    "hidraulica",
    "Louças e metais",
    "Instalação de louça sanitária e metais (bacia, lavatório, torneira, registro), com vedação e fixação.",
    ["bacia", "vaso", "louca", "metais", "torneira", "lavatorio"],
    "cj",
    null,
    ["banheiro", "cozinha"],
    2
  ),

  // ── Revestimentos (básico) ──
  atv(
    "REVEST-PISO-PORC",
    "revestimento",
    "Piso porcelanato",
    "Revestimento de piso em porcelanato assentado com argamassa colável AC-III, rejunte epóxi/flexível, juntas niveladas.",
    ["porcelanato", "piso ceramico", "ceramica de piso", "revestimento de piso"],
    "m²",
    null,
    ["sala", "cozinha", "recepcao"],
    0
  ),
  atv(
    "REVEST-PAREDE-AZUL",
    "revestimento",
    "Revestimento de parede",
    "Revestimento cerâmico/porcelanato de parede assentado com argamassa colável, rejuntado e nivelado.",
    ["azulejo", "revestimento parede", "ceramica parede", "pastilha"],
    "m²",
    null,
    ["banheiro", "cozinha"],
    1
  ),

  // ── Pintura (básico) ──
  atv(
    "PINT-PAREDE-ACRIL",
    "pintura",
    "Pintura acrílica de parede",
    "Pintura em tinta acrílica sobre massa corrida/PVA, com selador, duas demãos e acabamento uniforme.",
    ["pintura", "tinta acrilica", "pintura parede", "acabamento parede"],
    "m²",
    null,
    ["sala", "quarto", "recepcao", "escritorio"],
    0
  ),
  atv(
    "PINT-TETO",
    "pintura",
    "Pintura de teto",
    "Pintura de teto em tinta acrílica/látex sobre massa, com selador e duas demãos, acabamento fosco.",
    ["teto", "pintura teto", "forro pintado"],
    "m²",
    null,
    ["sala", "quarto", "cozinha"],
    1
  ),
];

const TAX_POR_CODIGO = new Map(TAXONOMIA_FALLBACK.map((a) => [a.codigo, a]));

/** Atividade da taxonomia pelo código (do fallback in-code). */
export function taxonomiaPorCodigo(codigo: string): TaxonomiaAtividade | undefined {
  return TAX_POR_CODIGO.get(codigo);
}

/** Atividades de uma disciplina (do fallback in-code), ordenadas. */
export function taxonomiaPorDisciplina(disciplinaSlug: string): TaxonomiaAtividade[] {
  return TAXONOMIA_FALLBACK.filter((a) => a.disciplina_slug === disciplinaSlug).sort(
    (a, b) => a.ordem - b.ordem
  );
}

/**
 * Converte a atividade in-code no formato de "linha persistida" (com id sintético e
 * origem='sistema'), para a UI/endpoint poderem usar o mesmo shape no fallback.
 */
export function fallbackComoRows(): TaxonomiaRow[] {
  return TAXONOMIA_FALLBACK.map((a) => ({
    ...a,
    id: `fallback-${a.codigo}`,
    tenant_id: null,
    ativo: true,
    origem: "sistema",
  }));
}

// ── Ambientes típicos por segmento (guia de UI/preset; NÃO é CHECK no banco) ──
// O `hub_obra_itens.ambiente` é texto livre (chips + "+ Outro"); esta lista só
// alimenta os chips sugeridos por segmento. Mantida enxuta (5–8 por segmento).
export type AmbienteSugerido = { codigo: string; label: string };

export const AMBIENTES_POR_SEGMENTO: Record<SegmentoSlug, AmbienteSugerido[]> = {
  residencial: [
    { codigo: "sala", label: "Sala" },
    { codigo: "cozinha", label: "Cozinha" },
    { codigo: "quarto", label: "Quarto" },
    { codigo: "suite", label: "Suíte" },
    { codigo: "banheiro", label: "Banheiro" },
    { codigo: "area_servico", label: "Área de serviço" },
    { codigo: "varanda", label: "Varanda" },
  ],
  comercial: [
    { codigo: "loja", label: "Loja" },
    { codigo: "vitrine", label: "Vitrine" },
    { codigo: "estoque", label: "Estoque" },
    { codigo: "caixa", label: "Caixa" },
    { codigo: "banheiro", label: "Banheiro" },
    { codigo: "deposito", label: "Depósito" },
  ],
  corporativo: [
    { codigo: "recepcao", label: "Recepção" },
    { codigo: "sala_reuniao", label: "Sala de reunião" },
    { codigo: "escritorio", label: "Escritório / Open space" },
    { codigo: "copa", label: "Copa" },
    { codigo: "banheiro", label: "Banheiro" },
    { codigo: "area_tecnica", label: "Área técnica" },
    { codigo: "hall", label: "Hall" },
  ],
  clinicas: [
    { codigo: "recepcao", label: "Recepção" },
    { codigo: "consultorio", label: "Consultório" },
    { codigo: "sala_procedimento", label: "Sala de procedimento" },
    { codigo: "espera", label: "Sala de espera" },
    { codigo: "esterilizacao", label: "Esterilização" },
    { codigo: "banheiro", label: "Banheiro" },
  ],
  pdv: [
    { codigo: "frente_loja", label: "Frente de loja" },
    { codigo: "checkout", label: "Checkout" },
    { codigo: "exposicao", label: "Área de exposição" },
    { codigo: "estoque", label: "Estoque" },
    { codigo: "banheiro", label: "Banheiro" },
  ],
};

export function ambientesDoSegmento(segmento: string | null | undefined): AmbienteSugerido[] {
  if (isSegmentoValido(segmento)) return AMBIENTES_POR_SEGMENTO[segmento];
  return [];
}

// ── Leitura do banco com fallback gracioso ───────────────────────────────────
const SELECT_TAXONOMIA =
  "id, tenant_id, disciplina_slug, codigo, nome, descricao_padrao, sinonimos, unidade, qtd_padrao, ambiente_tipico, segmento_tipico, valor_ref_unitario, ativo, origem, ordem";

/**
 * Carrega a taxonomia ativa (global + do tenant) do banco. Tolerante: se a tabela
 * ainda não existe (migração E0.5 pendente), devolve o fallback in-code marcado.
 * NÃO lança — sempre devolve um array utilizável (Click-and-Go nunca trava).
 */
export async function carregarTaxonomia(
  supabase: SupabaseClient,
  tenantId: string,
  disciplinaSlug?: string
): Promise<{ data: TaxonomiaRow[]; migracaoPendente: boolean }> {
  let query = supabase
    .from("hub_obra_taxonomia")
    .select(SELECT_TAXONOMIA)
    .or(tenantScopeOrFilter(tenantId))
    .eq("ativo", true)
    .order("disciplina_slug", { ascending: true })
    .order("ordem", { ascending: true });

  if (disciplinaSlug) query = query.eq("disciplina_slug", disciplinaSlug);

  const { data, error } = await query;

  if (error || !data) {
    const fb = fallbackComoRows();
    return {
      data: disciplinaSlug ? fb.filter((a) => a.disciplina_slug === disciplinaSlug) : fb,
      migracaoPendente: true,
    };
  }

  return { data: data as unknown as TaxonomiaRow[], migracaoPendente: false };
}
