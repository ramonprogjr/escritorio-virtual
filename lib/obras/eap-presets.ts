/**
 * Presets de EAP (frentes por disciplina) — espelho de lib/crm/pipeline-defaults.ts.
 *
 * A fonte canônica em runtime é o banco (hub_catalogo + hub_eap_presets). Este arquivo
 * é o ESPELHO in-code: serve de (a) tipo único, (b) fallback gracioso quando a migração
 * E0 ainda não foi aplicada (a obra nasce só com código+tipo+cliente e a UI avisa, nunca
 * quebra), e (c) seed de referência para a tela.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_OBRA10_TENANT_ID } from "@/lib/tenant-default";

// ── Tipos de obra (espelham o CHECK de hub_obras.tipo_obra) ──────────────────
export const TIPOS_OBRA = [
  { slug: "construcao", label: "Construção", icone: "🏗️", prefixo: "CON" },
  { slug: "reforma", label: "Reforma", icone: "🔨", prefixo: "REF" },
  { slug: "servico", label: "Serviço", icone: "🛠️", prefixo: "SRV" },
  { slug: "manutencao", label: "Manutenção", icone: "🧰", prefixo: "MAN" },
  { slug: "consultoria", label: "Consultoria", icone: "📐", prefixo: "CSL" },
  { slug: "projeto", label: "Projeto", icone: "✏️", prefixo: "PRJ" },
  { slug: "assistencia", label: "Assistência", icone: "🔧", prefixo: "AST" },
] as const;

export type TipoObraSlug = (typeof TIPOS_OBRA)[number]["slug"];

/** Os 3 tipos principais (chips grandes na tela; o resto fica em "outros tipos"). */
export const TIPOS_OBRA_PRINCIPAIS: TipoObraSlug[] = ["construcao", "reforma", "servico"];

export const PREFIXO_POR_TIPO_OBRA: Record<string, string> = Object.fromEntries(
  TIPOS_OBRA.map((t) => [t.slug, t.prefixo])
);

// ── Disciplinas padrão (as 15 reais da planilha do Consulado) ────────────────
export type Disciplina = {
  slug: string;
  codigo: string;
  label: string;
  cor: string;
};

export const DISCIPLINAS_PADRAO: Disciplina[] = [
  { slug: "preliminares", codigo: "PRELIM", label: "Preliminares", cor: "#9CA3AF" },
  { slug: "civil", codigo: "CIVIL", label: "Civil", cor: "#C9A24A" },
  { slug: "demolicoes", codigo: "DEMOL", label: "Demolições", cor: "#B45309" },
  { slug: "revestimento", codigo: "REVEST", label: "Revestimento", cor: "#D6A129" },
  { slug: "pintura", codigo: "PINT", label: "Pintura", cor: "#22C55E" },
  { slug: "eletrica", codigo: "ELET", label: "Elétrica", cor: "#EAB308" },
  { slug: "hidraulica", codigo: "HIDR", label: "Hidráulica", cor: "#3B82F6" },
  { slug: "instalacoes", codigo: "INST", label: "Instalações", cor: "#06B6D4" },
  { slug: "esquadrias", codigo: "ESQUA", label: "Esquadrias", cor: "#8B5CF6" },
  { slug: "serralheria", codigo: "SERR", label: "Serralheria", cor: "#6B7280" },
  { slug: "forro", codigo: "FORRO", label: "Forro", cor: "#A855F7" },
  { slug: "climatizacao", codigo: "CLIMA", label: "Climatização", cor: "#0EA5E9" },
  { slug: "impermeabilizacao", codigo: "IMPER", label: "Impermeabilização", cor: "#0891B2" },
  { slug: "elevadores", codigo: "ELEV", label: "Elevadores", cor: "#F97316" },
  { slug: "limpeza", codigo: "LIMP", label: "Limpeza", cor: "#10B981" },
];

const DISCIPLINA_POR_SLUG = new Map(DISCIPLINAS_PADRAO.map((d) => [d.slug, d]));

export function disciplinaPorSlug(slug: string): Disciplina | undefined {
  return DISCIPLINA_POR_SLUG.get(slug);
}

/** Gera o código técnico imutável da frente a partir do nome (Click-and-Go: não digita slug). */
export function codigoFrenteFromNome(nome: string, disciplinaSlug?: string): string {
  const disc = disciplinaSlug ? DISCIPLINA_POR_SLUG.get(disciplinaSlug) : undefined;
  if (disc) return disc.codigo;
  const base = (nome || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (combining diacritical marks)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return base || `FR${Date.now().toString(36).toUpperCase().slice(-4)}`;
}

// ── Frente de preset e presets de EAP ────────────────────────────────────────
export type FrentePreset = {
  disciplina_slug: string;
  nome: string;
  peso_fisico: number;
  peso_financeiro: number;
};

export type EapPreset = {
  slug: string;
  nome: string;
  tipo_obra: TipoObraSlug;
  sistema: boolean;
  ordem: number;
  frentes: FrentePreset[];
};

function frentesDe(slugs: Array<[string, number, number]>): FrentePreset[] {
  return slugs.map(([slug, pf, pfin]) => {
    const d = DISCIPLINA_POR_SLUG.get(slug);
    return {
      disciplina_slug: slug,
      nome: d?.label ?? slug,
      peso_fisico: pf,
      peso_financeiro: pfin,
    };
  });
}

/** Reforma Padrão = idêntico à planilha do Consulado (15 disciplinas). */
export const EAP_PRESETS: EapPreset[] = [
  {
    slug: "reforma-padrao",
    nome: "Reforma Padrão",
    tipo_obra: "reforma",
    sistema: true,
    ordem: 0,
    frentes: frentesDe([
      ["preliminares", 5, 3],
      ["demolicoes", 6, 4],
      ["civil", 14, 16],
      ["hidraulica", 8, 9],
      ["eletrica", 9, 11],
      ["instalacoes", 6, 7],
      ["revestimento", 10, 11],
      ["impermeabilizacao", 4, 4],
      ["forro", 5, 5],
      ["esquadrias", 6, 7],
      ["serralheria", 4, 4],
      ["climatizacao", 5, 4],
      ["pintura", 8, 3],
      ["elevadores", 2, 1],
      ["limpeza", 3, 0],
    ]),
  },
  {
    slug: "construcao-residencial",
    nome: "Construção Residencial",
    tipo_obra: "construcao",
    sistema: true,
    ordem: 1,
    frentes: [
      { disciplina_slug: "preliminares", nome: "Preliminares e canteiro", peso_fisico: 4, peso_financeiro: 3 },
      { disciplina_slug: "civil", nome: "Fundação e estrutura", peso_fisico: 20, peso_financeiro: 24 },
      { disciplina_slug: "civil", nome: "Alvenaria", peso_fisico: 10, peso_financeiro: 9 },
      { disciplina_slug: "hidraulica", nome: "Hidráulica", peso_fisico: 8, peso_financeiro: 8 },
      { disciplina_slug: "eletrica", nome: "Elétrica", peso_fisico: 8, peso_financeiro: 9 },
      { disciplina_slug: "revestimento", nome: "Revestimento", peso_fisico: 10, peso_financeiro: 10 },
      { disciplina_slug: "impermeabilizacao", nome: "Impermeabilização", peso_fisico: 4, peso_financeiro: 4 },
      { disciplina_slug: "forro", nome: "Forro e gesso", peso_fisico: 5, peso_financeiro: 5 },
      { disciplina_slug: "esquadrias", nome: "Esquadrias", peso_fisico: 7, peso_financeiro: 8 },
      { disciplina_slug: "climatizacao", nome: "Climatização", peso_fisico: 4, peso_financeiro: 4 },
      { disciplina_slug: "pintura", nome: "Pintura", peso_fisico: 7, peso_financeiro: 3 },
      { disciplina_slug: "limpeza", nome: "Limpeza final", peso_fisico: 3, peso_financeiro: 1 },
    ],
  },
  {
    slug: "servico-pontual",
    nome: "Serviço Pontual",
    tipo_obra: "servico",
    sistema: true,
    ordem: 2,
    frentes: [
      { disciplina_slug: "preliminares", nome: "Preparação", peso_fisico: 20, peso_financeiro: 15 },
      { disciplina_slug: "civil", nome: "Execução", peso_fisico: 60, peso_financeiro: 70 },
      { disciplina_slug: "limpeza", nome: "Limpeza e entrega", peso_fisico: 20, peso_financeiro: 15 },
    ],
  },
];

/** Retorna o preset adequado ao tipo de obra (ou undefined se for "outros" sem preset). */
export function getPresetPorTipo(tipoObra: string): EapPreset | undefined {
  return EAP_PRESETS.find((p) => p.tipo_obra === tipoObra);
}

/**
 * Mapa tipologia (Arquitetura, A0 — campo LIVRE, sem CHECK) → tipo_obra (Engenharia, E0 — CHECK de 7).
 * A2: usado ao gerar a obra a partir de um projeto. É HEURÍSTICA de produto (R1 do A2-DESIGN):
 * o resultado pré-marca o chip no sideover, mas o humano sempre pode trocar antes de confirmar.
 *
 * Decisão CEO (A2-DESIGN, validar com o dono): os 6 slugs canônicos de TIPOLOGIAS_PROJETO +
 * default seguro `reforma` para qualquer valor fora do mapa (a tipologia é texto livre).
 *   residencial → construcao    corporativo → construcao
 *   interiores  → reforma        reforma     → reforma
 *   comercial   → servico        paisagismo  → servico
 *   null/desconhecida → reforma (default seguro; humano troca o chip)
 */
const TIPOLOGIA_PARA_TIPO_OBRA: Record<string, TipoObraSlug> = {
  residencial: "construcao",
  corporativo: "construcao",
  interiores: "reforma",
  reforma: "reforma",
  comercial: "servico",
  paisagismo: "servico",
};

export function mapTipologiaParaTipoObra(tipologia: string | null | undefined): TipoObraSlug {
  const slug = (tipologia ?? "").trim().toLowerCase();
  return TIPOLOGIA_PARA_TIPO_OBRA[slug] ?? "reforma";
}

/**
 * Fallback de UI quando a migração E0 não foi aplicada (espelha ESTAGIOS_FALLBACK_UI).
 * Lista plana das frentes do preset Reforma — a tela mostra "personalização ainda não
 * ativa" mas já exibe a estrutura esperada, sem tela morta.
 */
export const EAP_PRESETS_FALLBACK = (getPresetPorTipo("reforma")?.frentes ?? []).map((f, i) => ({
  id: `fallback-${f.disciplina_slug}-${i}`,
  codigo: codigoFrenteFromNome(f.nome, f.disciplina_slug),
  nome: f.nome,
  disciplina_slug: f.disciplina_slug,
  cor: disciplinaPorSlug(f.disciplina_slug)?.cor ?? "#C9A24A",
  ativo: true,
  ordem: i,
}));

// ── Linha de frente persistida (o que a API devolve) ─────────────────────────
export type FrenteEapRow = {
  id: string;
  obra_id: string;
  codigo: string;
  nome: string;
  disciplina_slug: string | null;
  area_label: string | null;
  cor: string | null;
  peso_fisico: number;
  peso_financeiro: number;
  ativo: boolean;
  ordem: number;
  origem: "preset" | "manual" | "ia" | "aditivo";
};

/**
 * Gera o código legível da obra: ATÔMICO e POR TENANT.
 *
 * AUDITORIA-FIX (P0): o gerador antigo de obras (app/api/crm/obras/route.ts) usava
 * `COUNT(*)` GLOBAL — sem `.eq("tenant_id")` — vazando contagem entre empresas. Aqui:
 *  1) tenta a RPC `gerar_codigo_obra(tenant, tipo)` (contador por tenant+tipo+ano, sem corrida);
 *  2) se a RPC ainda não existe (migração não aplicada), o fallback faz `COUNT` FILTRADO
 *     por tenant_id — nunca global. Não vaza, mas pode ter corrida sob alta concorrência;
 *     o índice UNIQUE (tenant_id, codigo_legivel) é o guard final (o caller deve dar retry).
 */
export async function gerarCodigoObra(
  supabase: SupabaseClient,
  tenantId: string,
  tipoObra: string
): Promise<string> {
  const tenant = tenantId?.trim() || DEFAULT_OBRA10_TENANT_ID;
  const tipo = (tipoObra || "reforma").toLowerCase();

  try {
    const { data, error } = await supabase.rpc("gerar_codigo_obra", {
      p_tenant: tenant,
      p_tipo: tipo,
    });
    if (!error && typeof data === "string" && data) return data;
  } catch {
    /* cai no fallback abaixo */
  }

  // Fallback degradado — COUNT FILTRADO por tenant (nunca global).
  const prefixo = PREFIXO_POR_TIPO_OBRA[tipo] ?? "OBR";
  const year = new Date().getFullYear();

  // tipo_obra só existe após a migração E0. Se a coluna ainda não existe, o filtro por
  // tipo_obra faz o COUNT falhar → recai para COUNT só por tenant_id (degrada, não quebra).
  let count: number | null = null;
  {
    const comTipo = await supabase
      .from("hub_obras")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant)
      .eq("tipo_obra", tipo);
    if (comTipo.error) {
      const soTenant = await supabase
        .from("hub_obras")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant);
      count = soTenant.count;
    } else {
      count = comTipo.count;
    }
  }
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${prefixo}-${year}-${seq}`;
}

/**
 * Garante código único dentro do conjunto (a EAP da obra tem UNIQUE (obra_id, codigo)).
 * A mesma disciplina pode aparecer 2× num preset (ex.: Construção tem "Fundação" e
 * "Alvenaria", ambas civil → código CIVIL). Aqui o 2º vira CIVIL2, o 3º CIVIL3, etc.
 */
function codigoUnico(base: string, usados: Set<string>): string {
  let candidato = base;
  let n = 2;
  while (usados.has(candidato)) {
    candidato = `${base}${n}`;
    n += 1;
  }
  usados.add(candidato);
  return candidato;
}

/** Converte um preset em linhas prontas para inserir em hub_obra_frentes_eap. */
export function frentesDoPresetParaInsert(
  preset: EapPreset,
  obraId: string,
  tenantId: string
): Array<Record<string, unknown>> {
  const usados = new Set<string>();
  return preset.frentes.map((f, i) => {
    const disc = disciplinaPorSlug(f.disciplina_slug);
    const codigo = codigoUnico(codigoFrenteFromNome(f.nome, f.disciplina_slug), usados);
    return {
      obra_id: obraId,
      tenant_id: tenantId,
      codigo,
      nome: f.nome,
      disciplina_slug: f.disciplina_slug,
      cor: disc?.cor ?? null,
      peso_fisico: f.peso_fisico,
      peso_financeiro: f.peso_financeiro,
      ativo: true,
      ordem: i,
      origem: "preset",
    };
  });
}
