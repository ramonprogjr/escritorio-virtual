import { CRM_NAV_GROUPS, isCrmNavPathActive } from "@/lib/crm-nav-groups";

const SHEET_PREFIXES = [
  "/crm/cadastro",
  "/crm/leads",
  "/crm/aprovacoes",
  "/crm/agentes",
  "/crm/analytics",
  "/crm/kpis",
  "/crm/negocios",
  "/crm/parceiros",
  "/crm/financeiro",
  "/crm/relatorios",
  "/crm/configuracoes",
  "/crm/progresso-sistema",
  "/crm/integracoes",
  "/crm/pessoas",
  "/crm/empresas",
  "/crm/imoveis",
  "/crm/obras",
  "/crm/pedidos",
  "/crm/projetos",
  "/crm/ciclos",
  "/crm/canais",
  "/crm/ferramentas",
  "/crm/contatos",
  "/crm/usuarios",
  // G-D2: /crm/conteudo é stub "Em breve" — escondido do menu até existir de verdade (decisão do dono).
  "/crm/agentes-reais",
];

export function isMobileShellRoute(pathname: string): boolean {
  if (pathname === "/" || pathname.startsWith("/cadastre-se")) return false;
  if (pathname.startsWith("/parceiro/")) return false;
  if (pathname === "/login" || pathname.startsWith("/login/")) return false;
  return true;
}

/**
 * Deriva o título da página no mobile a partir de `CRM_NAV_GROUPS` (mesma fonte do menu).
 * Primeiro aplica overrides para rotas de detalhe (sub-páginas) onde o label do item
 * pai não é suficiente (ex.: "/crm/leads/123" → "Lead").
 * Depois percorre CRM_NAV_GROUPS procurando o item com href ativo.
 * Fallback final: "Obra10+".
 */
export function mobilePageTitle(pathname: string): string {
  if (pathname === "/office") return "Escritório";

  // Overrides de detalhe — sub-rotas onde o label do item pai não é o ideal
  if (pathname.startsWith("/crm/leads/")) return "Lead";
  if (pathname.startsWith("/crm/agentes/")) return "Agente IA";

  // Deriva a partir de CRM_NAV_GROUPS (mesma fonte do menu lateral/drawer)
  for (const group of CRM_NAV_GROUPS) {
    for (const item of group.items) {
      if (isCrmNavPathActive(pathname, item.href)) {
        return item.label;
      }
    }
  }

  return "Obra10+";
}

/** Rotas secundárias (sheet): exibir header com voltar. */
export function needsMobileSubHeader(pathname: string): boolean {
  return SHEET_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
