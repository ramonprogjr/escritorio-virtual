/**
 * Documento conceito do Hub — taxonomia oficial de **setores** (`segmento`) e referência das **secções**
 * de playbook (`hub_agente_conhecimento`). Mantém-se aqui como código para:
 * - prompts de IA usarem sempre o mesmo texto canónico (menos alucinação em nomes de setor/secção);
 * - UI sugerir valores alinhados ao conceito antes de gravar em `hub_cargos_catalogo`.
 *
 * Ao criar um **novo setor** ou alterar secções do playbook: actualizar este ficheiro primeiro,
 * depois cargos/agentes que dependam da taxonomia.
 */

import {
  CONHECIMENTO_SECAO_ORDER,
  CONHECIMENTO_TITULO_INSERT,
} from "@/lib/hub/conhecimento-secoes";

export type SegmentoConceitoHub = {
  nome: string;
  papel: string;
  especialidades_exemplo: readonly string[];
};

/** Setores principais Obra10+ / CRM Hub — ortografia fixa para relatórios e filtros. */
export const SEGMENTOS_CONCEITO_HUB = [
  {
    nome: "Marketing",
    papel:
      "Demanda, marca, conteúdo orgânico/pago, performance de mídia e nutrição até MQL — sem fecho comercial.",
    especialidades_exemplo: ["Performance", "Conteúdo", "Social", "SEO", "CRM marketing", "Brand"],
  },
  {
    nome: "Comercial",
    papel:
      "Pipeline, diagnóstico, proposta, negociação, fecho e continuidade comercial (CS orientado a receita quando aplicável).",
    especialidades_exemplo: ["SDR", "Closer", "Inside sales", "Customer success", "Parcerias", "CRM vendas"],
  },
  {
    nome: "Operações",
    papel:
      "Entrega, obra/reforma em campo, compras operacionais, qualidade e processos que não são vendas nem marketing.",
    especialidades_exemplo: ["Planeamento obra", "Compras", "QS", "Obra", "Logística interna"],
  },
] as const satisfies readonly SegmentoConceitoHub[];

export function nomesSegmentosConceito(): string[] {
  return SEGMENTOS_CONCEITO_HUB.map((s) => s.nome);
}

export function segmentoNoConceito(segmento: string): boolean {
  const t = segmento.trim().toLowerCase();
  return SEGMENTOS_CONCEITO_HUB.some((s) => s.nome.toLowerCase() === t);
}

export function especialidadesExemploParaSegmento(segmento: string): string[] {
  const t = segmento.trim().toLowerCase();
  const hit = SEGMENTOS_CONCEITO_HUB.find((s) => s.nome.toLowerCase() === t);
  return hit ? [...hit.especialidades_exemplo] : [];
}

/** Texto compacto injectado nos modelos (cargo / conhecimento). */
export function documentoConceitoTaxonomiaParaIa(): string {
  const linhasSeg = SEGMENTOS_CONCEITO_HUB.map(
    (s) =>
      `- **${s.nome}**: ${s.papel} Exemplos de especialidade: ${s.especialidades_exemplo.join(", ")}.`
  ).join("\n");

  return `## Documento conceito — setores (segmento)
Usa **exactamente** um destes valores literais em \`segmento\` (capitalize como abaixo — mesmo texto):
${SEGMENTOS_CONCEITO_HUB.map((s) => `- ${s.nome}`).join("\n")}

Detalhe por setor:
${linhasSeg}

**Regras para IA:** não inventes outros nomes de setor em inglês nem sinónimos novos ("Sales", "Growth", etc.).
Se o cargo não encaixar claramente, escolhe o setor mais próximo da lista e uma \`especialidade\` específica que discrimine o papel.
Qualquer **novo setor** só depois de actualização humana deste documento conceito — até lá, usa apenas os três acima.`;
}

/** Secções fixas do playbook — IDs técnicos não devem ser inventados pela IA em metadata. */
export function documentoConceitoPlaybookSecoesParaIa(): string {
  const linhas = CONHECIMENTO_SECAO_ORDER.map(
    (id) => `- \`${id}\` → ${CONHECIMENTO_TITULO_INSERT[id]}`
  ).join("\n");
  return `## Documento conceito — secções de conhecimento/playbook (IDs fixos)
Ordem e significado — não criar IDs novos nem renomear chaves:
${linhas}

Conteúdo gerado deve respeitar o papel da secção; não misturar POP inteiro dentro de "objeccoes".`;
}
