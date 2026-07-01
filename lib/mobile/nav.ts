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
  if (pathname.startsWith("/crm/lead/")) return "Lead";
  if (pathname === "/crm/agentes/novo") return "Novo agente IA";
  if (pathname.startsWith("/crm/agentes/")) return "Agente IA";
  if (pathname === "/crm/parceiros/novo") return "Convidar Parceiro";
  if (pathname.startsWith("/crm/parceiros/")) return "Parceiro";
  // /crm/empresas (Administração) = tenants/"Escritórios"; /crm/empresas/[id] é a FICHA
  // de empresa-cliente PJ (Cadastros) — rótulo diferente para não confundir os dois.
  if (pathname.startsWith("/crm/empresas/")) return "Empresa";
  if (pathname.startsWith("/crm/pessoas/duplicatas")) return "Duplicatas";
  if (pathname.startsWith("/crm/pessoas/")) return "Pessoa";
  if (pathname === "/crm/pessoas") return "Pessoas";

  // Rotas fora de CRM_NAV_GROUPS (saíram do menu ou são telas soltas) — sem override
  // aqui cairiam no fallback genérico "Obra10+".
  if (pathname === "/crm/analytics" || pathname === "/crm/kpis") return "Analytics";
  if (pathname === "/crm/relatorios") return "Relatórios";
  if (pathname === "/crm/conteudo") return "Conteúdo & Copy";
  if (pathname === "/crm/onboarding-tenant") return "Onboarding";
  if (pathname === "/crm/progresso-sistema") return "Progresso sistema";

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
