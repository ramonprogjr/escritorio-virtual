/**
 * FASE 4 — Setor do agente (sem migração de banco).
 *
 * Deriva o "setor" de trabalho a partir do cargo escolhido no wizard (segmento +
 * especialidade do `hub_cargos_catalogo`). Com o setor, pré-seleccionamos as
 * ferramentas Hub recomendadas (Click-and-Go) e oferecemos tarefas típicas.
 *
 * Nada aqui toca o banco: é só mapeamento determinístico no cliente/servidor.
 * O vocabulário de palavras-chave segue o mesmo já usado nas migrations de
 * classificação de cargos (sdr/closer/vendas, suporte/atendimento, operaç/finance,
 * marketing/tráfego/conteúdo) para manter coerência.
 */

import {
  isHubAgenteFerramentaId,
  type HubAgenteFerramentaId,
} from "@/lib/hub/agente-ferramentas-registry";

export type SetorAgente =
  | "atendimento"
  | "comercial"
  | "financeiro"
  | "rh"
  | "engenharia"
  | "trafego"
  | "operacoes"
  | "marketing"
  | "conteudo";

export const SETOR_AGENTE_IDS: readonly SetorAgente[] = [
  "atendimento",
  "comercial",
  "financeiro",
  "rh",
  "engenharia",
  "trafego",
  "operacoes",
  "marketing",
  "conteudo",
] as const;

const ROTULO_SETOR: Record<SetorAgente, string> = {
  atendimento: "Atendimento",
  comercial: "Comercial",
  financeiro: "Financeiro",
  rh: "RH",
  engenharia: "Engenharia / Obras",
  trafego: "Tráfego pago",
  operacoes: "Operações",
  marketing: "Marketing",
  conteudo: "Conteúdo",
};

export function rotuloSetor(setor: SetorAgente): string {
  return ROTULO_SETOR[setor] ?? "Operações";
}

function normalizar(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    // remove acentos (combining marks U+0300–U+036F) para casar "operações" ~ "operacoes"
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Mapeia segmento + especialidade → setor.
 * Ordem importa: especialidades específicas (atendimento, tráfego, conteúdo,
 * financeiro, RH, engenharia) ganham do fallback genérico por segmento.
 */
export function setorDoCargo(input: {
  segmento?: string | null;
  especialidade?: string | null;
}): SetorAgente {
  const seg = normalizar(input.segmento);
  const esp = normalizar(input.especialidade);
  const both = `${seg} ${esp}`.trim();

  // 1) Especialidades inequívocas (vencem o segmento)
  if (/(trafego|midia paga|ads|google ads|meta ads|performance)/.test(both)) return "trafego";
  if (/(conteudo|copy|copywrit|social|redator|blog|seo)/.test(both)) return "conteudo";
  if (/(financ|cobran|contas a pagar|contas a receber|faturamento|fiscal|contabil)/.test(both))
    return "financeiro";
  if (/(rh|recursos humanos|recrut|people|gente e gestao|talento|departamento pessoal|dp)/.test(both))
    return "rh";
  if (/(engenh|obra|construc|reforma|medic|canteiro|projeto executivo)/.test(both))
    return "engenharia";
  if (/(suporte|support|atendimento|help|sac|pos-venda|pos venda)/.test(both)) return "atendimento";

  // 2) Comercial: SDR/closer/vendas/captação
  if (/(sdr|qualific|closer|vendas|comercial|inside sales|pre-venda|pre venda|capta|prospec)/.test(both))
    return "comercial";

  // 3) Marketing genérico
  if (/(marketing|growth|branding|marca)/.test(both)) return "marketing";

  // 4) Operações / backoffice / processos
  if (/(operac|analista|backoffice|processo|logist|admin)/.test(both)) return "operacoes";

  // 5) Fallback por segmento (segmentos reais do catálogo: Comercial / Marketing / Operações)
  if (seg.includes("comercial")) return "comercial";
  if (seg.includes("marketing")) return "marketing";
  if (seg.includes("operac")) return "operacoes";

  // 6) Último recurso
  return "operacoes";
}

/**
 * IDs de ferramentas Hub recomendadas por setor. Usa SÓ IDs que existem no
 * registry (`HubAgenteFerramentaId`). A base de leitura serve qualquer setor;
 * setores de relação com cliente (atendimento/comercial) recebem também escrita
 * no CRM. Filtramos por `isHubAgenteFerramentaId` para nunca devolver um ID morto.
 */
export function ferramentasRecomendadasPorSetor(setor: SetorAgente): HubAgenteFerramentaId[] {
  // Base comum: leitura de contexto do cliente + métricas (seguro, só leitura).
  const base: HubAgenteFerramentaId[] = [
    "hub_lead_resumo",
    "hub_lead_memorias",
    "hub_metricas_escritorio",
  ];

  const porSetor: Record<SetorAgente, HubAgenteFerramentaId[]> = {
    atendimento: [
      "hub_lead_resumo",
      "hub_lead_memorias",
      "hub_registar_nota_lead",
      "hub_atualizar_lead",
    ],
    comercial: [
      "hub_lead_resumo",
      "hub_lead_memorias",
      "hub_registar_nota_lead",
      "hub_atualizar_lead",
      "hub_metricas_escritorio",
    ],
    financeiro: ["hub_lead_resumo", "hub_metricas_escritorio", "hub_registar_nota_lead"],
    rh: ["hub_lead_resumo", "hub_registar_nota_lead"],
    engenharia: ["hub_lead_resumo", "hub_metricas_escritorio", "hub_registar_nota_lead"],
    trafego: ["hub_metricas_escritorio", "hub_lead_resumo", "hub_relatorio_html_simples"],
    operacoes: ["hub_lead_resumo", "hub_metricas_escritorio", "hub_registar_nota_lead"],
    marketing: ["hub_metricas_escritorio", "hub_lead_resumo", "hub_relatorio_html_simples"],
    conteudo: ["hub_lead_memorias", "hub_relatorio_html_simples"],
  };

  const escolhidos = porSetor[setor] ?? base;
  // Dedup + valida contra o registry (defensivo).
  const out: HubAgenteFerramentaId[] = [];
  for (const id of escolhidos) {
    if (isHubAgenteFerramentaId(id) && !out.includes(id)) out.push(id);
  }
  return out;
}
