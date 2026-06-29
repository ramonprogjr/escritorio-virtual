/**
 * Tradução HONESTA do motor de aderência → linguagem de negócio (Click-and-Go).
 *
 * NÃO é "IA": o motor (`lib/crm/distribuir-lead.ts` → `scoreParceiro`) é uma regra
 * DETERMINÍSTICA. Estas funções só REINTERPRETAM o que o motor já devolve
 * (`score` + `motivo`) para texto legível e chips de fatores reais — sem novo
 * cálculo, sem schema, sem LLM.
 *
 * `motivo` é uma string montada pelo motor com tokens separados por " · ", ex.:
 *   "mercado IMB · mesma cidade · carga 3 · homologado"
 *   "especialidade compatível · mesmo UF · carga 12 · pendência −15"
 * Os chips abaixo derivam EXCLUSIVAMENTE desses tokens (mais a carga numérica).
 */

/** Mínimo que precisamos de um candidato para traduzir (sub-tipo de CandidatoParceiro). */
export type CandidatoLike = {
  score: number;
  motivo?: string | null;
  status_financeiro?: string | null;
};

export type NivelConfianca = "forte" | "boa" | "baixa";

export type Confianca = {
  nivel: NivelConfianca;
  /** Texto pronto p/ a UI: "Forte recomendação". */
  rotulo: string;
  /** Cor da marca p/ o nível (verde alto · dourado médio · âmbar baixo). */
  cor: string;
  /** O número cru, exibido junto ao rótulo p/ transparência ("Forte recomendação · 82"). */
  score: number;
};

const COR_FORTE = "#3fb950"; // verde — alta aderência
const COR_BOA = "#c9a24a"; // dourado da marca — opção média
const COR_BAIXA = "#e3b341"; // âmbar — aderência baixa

/**
 * Traduz score cru → confiança legível. Limiares:
 *  - ≥ 70  → Forte recomendação (verde)
 *  - 40-69 → Boa opção (dourado)
 *  - < 40  → Aderência baixa (âmbar)
 * Pendência/bloqueio financeiro NUNCA "promove" — o motor já penaliza o score,
 * então o número rebaixado leva naturalmente ao nível mais baixo.
 */
export function traduzirConfianca(c: CandidatoLike): Confianca {
  const score = Math.round(c.score ?? 0);
  if (score >= 70) {
    return { nivel: "forte", rotulo: "Forte recomendação", cor: COR_FORTE, score };
  }
  if (score >= 40) {
    return { nivel: "boa", rotulo: "Boa opção", cor: COR_BOA, score };
  }
  return { nivel: "baixa", rotulo: "Aderência baixa", cor: COR_BAIXA, score };
}

export type ChipNegocio = {
  /** Texto curto e humano do fator. */
  label: string;
  /** Positivo (verde/dourado) ou alerta (âmbar) — afeta a cor do chip. */
  tom: "bom" | "alerta";
};

/**
 * Deriva os chips de negócio a partir do `motivo` REAL do motor.
 * Cada chip mapeia 1:1 a um fator que o `scoreParceiro` de fato considerou.
 */
export function chipsDoMotivo(c: CandidatoLike): ChipNegocio[] {
  const motivo = (c.motivo ?? "").toLowerCase();
  const chips: ChipNegocio[] = [];

  // Mercado (40 pts no motor) ou especialidade compatível (25 pts)
  if (motivo.startsWith("mercado ") || motivo.includes("· mercado ")) {
    chips.push({ label: "Mesmo mercado", tom: "bom" });
  } else if (motivo.includes("especialidade compatível")) {
    chips.push({ label: "Especialidade combina", tom: "bom" });
  }

  // Geografia: mesma cidade (30 pts) tem prioridade sobre mesmo UF (15 pts)
  if (motivo.includes("mesma cidade")) {
    chips.push({ label: "Mesma cidade", tom: "bom" });
  } else if (motivo.includes("mesmo uf")) {
    chips.push({ label: "Mesma região", tom: "bom" });
  }

  // Carga: o motor soma "carga N". Pouca carga = mais disponível.
  const cargaMatch = motivo.match(/carga (\d+)/);
  if (cargaMatch) {
    const carga = parseInt(cargaMatch[1], 10);
    if (carga <= 3) chips.push({ label: "Pouca carga", tom: "bom" });
    else if (carga >= 15) chips.push({ label: "Carga alta", tom: "alerta" });
  }

  // Homologado (10 pts) → "Em dia" na rede
  if (motivo.includes("homologado")) {
    chips.push({ label: "Homologado", tom: "bom" });
  }

  // Financeiro: o motor penaliza; aqui só sinalizamos como alerta humano.
  const fin = (c.status_financeiro ?? "em_dia").toLowerCase();
  if (fin === "bloqueado") {
    chips.push({ label: "Bloqueado", tom: "alerta" });
  } else if (fin === "pendente") {
    chips.push({ label: "Pendência financeira", tom: "alerta" });
  } else {
    chips.push({ label: "Em dia", tom: "bom" });
  }

  return chips;
}

/**
 * Talk-and-Go: abre o Copiloto de Voz global (FAB) sem acoplamento.
 * O CopilotoVoz escuta `copiloto:abrir` e abre o painel se estiver fechado.
 * Não quebra nada se o copiloto não estiver montado — o evento simplesmente
 * não tem ouvinte.
 */
export function abrirCopilotoVoz(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("copiloto:abrir"));
}

/**
 * Perfis/destinos para o direcionamento MANUAL (válvula de escape) — quando o
 * motor de score não rankeia ninguém OU nenhum fornecedor homologado combina.
 * Diferente do fluxo automático: aqui o gestor ESCOLHE o perfil + o destino
 * (Click-and-Go, sem digitação solta) e o registro vai para `/encaminhamentos`.
 *
 * O `segmento` é o token gravado em `hub_encaminhamentos.segmento`.
 */
export type PerfilDestino = {
  /** Chave estável usada como `segmento` no registro. */
  slug: string;
  /** Rótulo humano do chip. */
  label: string;
};

export const PERFIS_DESTINO: PerfilDestino[] = [
  { slug: "arquiteto", label: "Arquiteto" },
  { slug: "engenharia", label: "Engenharia" },
  { slug: "servicos", label: "Serviços" },
  { slug: "corretor", label: "Corretor" },
  { slug: "fornecedor", label: "Fornecedor" },
];

/** Payload do direcionamento manual a um destino (Click-and-Go). */
export type DestinoManual = {
  /** Slug do perfil escolhido (vira `segmento`). */
  perfil: string;
  /** Rótulo do perfil (para o critério/preview legível). */
  perfilLabel: string;
  /** Id do destino escolhido (fornecedor), quando há lista. */
  destinoId: string | null;
  /** Nome do destino escolhido (vira `criterio_selecao`). */
  destinoNome: string;
};
