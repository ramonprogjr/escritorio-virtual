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
export function personaCockpitFromRole(role: string | null | undefined): PersonaCockpitTipo {
  const r = (role ?? "").trim().toLowerCase();
  switch (r) {
    case "operation":
    case "operacao":
    case "engenharia":
      return "engenharia";
    case "architect":
    case "arquiteto":
      return "arquiteto";
    case "client":
    case "cliente":
      return "cliente";
    case "supplier":
    case "fornecedor":
    case "parceiro":
      return "fornecedor";
    // HUB + comercial + papéis internos legados → dashboard comercial atual (preservado).
    case "owner":
    case "admin":
    case "admin_hub":
    case "gestor":
    case "commercial":
    case "comercial":
    case "vendedor":
    case "financeiro":
    case "finance":
    case "atendente":
    // Mercado imobiliário = comercial-adjacente (veem o funil de vendas).
    case "broker":
    case "real_estate":
    case "imobiliario":
    case "corretor":
      return "comercial";
    default:
      // Default seguro (fail-safe legado): o que já era servido hoje — não quebra.
      // R7 (follow-up Wave 2b): papel desconhecido/mal-configurado deveria cair num
      // cockpit RESTRITO/vazio (fail-closed), não no comercial completo. Hoje é
      // aceitável porque getCallerContext já exige sessão válida + conta ATIVA no
      // tenant, então o dado é sempre do próprio tenant (sem vazamento cross-tenant).
      return "comercial";
  }
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
