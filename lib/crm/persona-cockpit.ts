/**
 * COCKPIT PERSONA-AWARE (v1) — camada PURA (sem I/O). Mapeia o `role` do ECOSSISTEMA
 * (users.role, em inglês) para a persona de cockpit e define os tipos do payload por persona.
 *
 * MOTIVO (auditoria QA — docs/AUDITORIA-QA-SINTESE-CEO.md): o /crm hoje monta UMA tela única
 * de funil comercial (aggregateDashboard só filtra por tenant, ZERO noção de papel). HUB,
 * engenharia, arquiteto, serviços e cliente veem a MESMA tela. Esta camada carve-out é ADITIVA:
 *   - HUB + comercial + papéis internos → "comercial" = o dashboard ATUAL, preservado (instrução c).
 *   - operation → "engenharia" | architect → "arquiteto" | client → "cliente" | supplier → "fornecedor".
 *
 * PURA e sem dependências de servidor → pode ser importada no cliente (app/crm/page.tsx decide
 * qual componente montar) e no servidor (route deriva a persona da SESSÃO, autoridade final).
 *
 * DEFAULT SEGURO: role desconhecido → "comercial" (o que já era servido hoje — não quebra).
 * Ver pendência R7: endurecer o default p/ um cockpit restrito quando o papel não é interno.
 */

import { rbacPersonaForRole, type RbacPersona } from "@/lib/rbac/role-map";

export type PersonaCockpitTipo =
  | "comercial"
  | "engenharia"
  | "arquiteto"
  | "cliente"
  | "fornecedor";

/** Personas com cockpit próprio (todas menos o comercial, que reusa o dashboard atual). */
export type PersonaNaoComercial = Exclude<PersonaCockpitTipo, "comercial">;

/**
 * Deriva a persona de cockpit a partir do `role` da sessão (users.role — ecossistema em inglês,
 * com tolerância aos sinônimos pt/legado). HUB (owner/admin) cai em "comercial" por decisão do
 * dono: o dashboard atual JÁ é a saúde do ecossistema (rede/receita/encaminhamentos/obras).
 */
/**
 * Mapeia a persona RICA da fonte única (`role-map`, 9 valores) para o cockpit de UI
 * (5 tipos que o cliente sabe renderizar hoje). Colapso ADITIVO:
 *   • hub-auditor / comercial / financeiro → "comercial" (dashboard atual, preservado);
 *   • engenharia → "engenharia"; arquiteto → "arquiteto"; cliente → "cliente";
 *   • fornecedor → "fornecedor"; PARCEIRO → "fornecedor" (cockpit externo restrito —
 *     CORRIGE o vazamento em que broker/real_estate caíam no dashboard COMPLETO do Hub);
 *   • restrito → "comercial" por ora (Onda 1c endurece p/ tela neutra quando a UI
 *     ganhar o cockpit "sem acesso configurado"; o role-map já classifica como restrito).
 */
const RBAC_PERSONA_TO_COCKPIT: Record<RbacPersona, PersonaCockpitTipo> = {
  "hub-auditor": "comercial",
  comercial: "comercial",
  financeiro: "comercial",
  engenharia: "engenharia",
  arquiteto: "arquiteto",
  fornecedor: "fornecedor",
  parceiro: "fornecedor",
  cliente: "cliente",
  restrito: "comercial",
};

/**
 * Deriva a persona de cockpit a partir do `role` da sessão, LENDO a fonte única
 * (`lib/rbac/role-map.ts`) — elimina a tabela de papéis duplicada que existia aqui.
 * Comercial (e todos os papéis internos do Hub) preservados no dashboard atual.
 */
export function personaCockpitFromRole(role: string | null | undefined): PersonaCockpitTipo {
  return RBAC_PERSONA_TO_COCKPIT[rbacPersonaForRole(role)];
}

export type PersonaAcaoPrioridade = "alta" | "media" | "baixa";

/** Item do painel "O que precisa de você" por persona (100% por regra, contagem real). */
export type PersonaAcao = {
  id: string;
  label: string;
  valor: number;
  href: string;
  cta: string;
  cor: string;
  prioridade: PersonaAcaoPrioridade;
  /** chave de ícone resolvida no cliente (lucide) — ver CrmPersonaCockpit. */
  icone: string;
};

/** Card acionável (3–5 por persona). `valor` já vem formatado (string) p/ o cliente só exibir. */
export type PersonaCard = {
  id: string;
  label: string;
  valor: string;
  sub: string;
  cor: string;
  href: string;
};

/**
 * Payload do cockpit de uma persona NÃO-comercial. Discriminado por `persona` — o cliente
 * distingue deste do payload comercial (DashboardPayload) pela presença do campo `persona`
 * com valor != "comercial".
 */
export type PersonaCockpitPayload = {
  persona: PersonaNaoComercial;
  titulo: string;
  subtitulo: string;
  /** "O que precisa de você" — topo de toda persona (por regra própria). */
  acoes: PersonaAcao[];
  /** 3–5 cards acionáveis do recorte da persona. */
  cards: PersonaCard[];
  /**
   * Estados-vazios HONESTOS (fonte ausente, não "tudo em dia"): ex.: "sem medições ainda".
   * NUNCA mascarar fonte ausente como zero mudo (mandato do dono — cura o medo "não saber").
   */
  avisos: string[];
};

export const PESO_ACAO: Record<PersonaAcaoPrioridade, number> = {
  alta: 0,
  media: 1,
  baixa: 2,
};

/** Título/subtítulo padrão de cada persona (o servidor pode sobrescrever). */
export const PERSONA_CABECALHO: Record<PersonaNaoComercial, { titulo: string; subtitulo: string }> = {
  engenharia: { titulo: "Obras", subtitulo: "Andamento, medições e pedidos das suas obras" },
  arquiteto: { titulo: "Arquitetura", subtitulo: "Projetos, aprovações e briefings" },
  cliente: { titulo: "Minha obra", subtitulo: "Avanço, aprovações e pagamentos" },
  fornecedor: { titulo: "Meu painel", subtitulo: "Cotações e ordens direcionadas a você" },
};
