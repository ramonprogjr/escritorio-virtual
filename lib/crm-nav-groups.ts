import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  ClipboardList,
  Wallet,
  Users,
  Briefcase,
  User,
  Building2,
  Handshake,
  Package,
  Home,
  HardHat,
  Truck,
  MessageSquare,
  MessageCircle,
  ClipboardCheck,
  Radio,
  Route,
  LayoutTemplate,
  Zap,
  Wrench,
  Sparkles,
  Settings,
  Plug,
  Bell,
  UserCog,
} from "lucide-react";
import {
  crmPodeVerRota,
  isCrmGestorRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";

export type { CrmNivel };

export type CrmNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  extra?: { href: string; label: string };
  /** Badge opcional ao lado do rótulo (ex.: Copiloto em breve). */
  navBadge?: string;
  /** Papel mínimo para ver o item (default: comercial). */
  minRole?: CrmNivel;
  /** @deprecated use minRole: "owner" */
  adminOnly?: boolean;
};

export type CrmNavGroup = {
  id: string;
  label: string;
  sectionIcon: LucideIcon;
  items: CrmNavItem[];
};

/**
 * Fonte de verdade do menu lateral — reagrupado no MODELO DE PLATAFORMA do doc
 * INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md §8 (Bloco 1 / Onda U1), usando APENAS rotas que
 * já existem (zero "menu morto"). Grupos do §8 ainda sem tela (Central IA, Comunidade)
 * ficam de fora até existirem. Ordem: Visão → Aprovações → Comercial → Operações →
 * Fornecedores → Financeiro → Marketing → IA → Administração.
 * Ver docs/PLANO-EXECUTIVO-BLOCOS.md e docs/menu-navegacao-consolidado.md.
 * Permissões (minRole) preservadas item a item — guard de rota é a fonte real (crmPodeVerRota).
 */
export const CRM_NAV_GROUPS: CrmNavGroup[] = [
  {
    id: "visao",
    label: "Visão Geral",
    sectionIcon: LayoutDashboard,
    items: [
      { href: "/crm", label: "Dashboard", icon: LayoutDashboard, minRole: "financeiro" },
      { href: "/crm/analytics", label: "Analytics", icon: LineChart, minRole: "financeiro" },
      { href: "/crm/relatorios", label: "Relatórios", icon: ClipboardList, minRole: "financeiro" },
    ],
  },
  {
    // §8: Comercial / CRM — funde Vendas + Atendimento. O lado "vender" da plataforma.
    // Tarefas + Aprovações ficam juntas no fim: são as "filas de ação" do dia a dia.
    // Aprovações é Pilar 2 (mestre §8.4) — minRole gestor; comercial só vê Tarefas.
    id: "comercial",
    label: "Comercial / CRM",
    sectionIcon: Briefcase,
    items: [
      { href: "/crm/leads", label: "Leads", icon: Users, minRole: "atendente" },
      { href: "/crm/negocios", label: "Negócios", icon: Briefcase, minRole: "comercial" },
      { href: "/crm/cadastro", label: "Cadastros", icon: User, minRole: "comercial" },
      { href: "/crm/atendimento", label: "Atendimento", icon: MessageSquare, minRole: "atendente" },
      { href: "/crm/canais", label: "Canais", icon: MessageCircle, minRole: "atendente" },
      { href: "/crm/tarefas", label: "Tarefas", icon: ClipboardList, minRole: "comercial" },
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck, minRole: "gestor" },
    ],
  },
  {
    // §8: Operações / Obras — o lado "executar". Funde Projetos + Obras + Pedidos.
    // Escopo/Cronograma/Medição/Compras entram no Bloco 6 quando as telas existirem.
    id: "operacoes",
    label: "Operações / Obras",
    sectionIcon: HardHat,
    items: [
      { href: "/crm/projetos", label: "Projetos", icon: LayoutTemplate, minRole: "comercial" },
      { href: "/crm/obras", label: "Obras", icon: HardHat, minRole: "comercial" },
      { href: "/crm/imoveis", label: "Imóveis", icon: Home, minRole: "comercial" },
      { href: "/crm/pedidos", label: "Pedidos", icon: Truck, minRole: "comercial" },
    ],
  },
  {
    // §8: Fornecedores — motor da rede / governança do Hub. Hoje: cadastro da rede +
    // distribuição de leads. Performance/Ranking/SLA/Homologação entram no Bloco 4.
    id: "fornecedores",
    label: "Fornecedores",
    sectionIcon: Handshake,
    items: [
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake, minRole: "comercial" },
      { href: "/crm/fornecedores", label: "Fornecedores", icon: Truck, minRole: "comercial" },
      { href: "/crm/especialistas", label: "Especialistas", icon: HardHat, minRole: "comercial" },
      { href: "/crm/distribuicao", label: "Distribuição de leads", icon: Route, minRole: "gestor" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sectionIcon: Wallet,
    items: [
      { href: "/crm/financeiro/receber", label: "Contas a receber", icon: LineChart, minRole: "financeiro" },
      { href: "/crm/financeiro/pagar", label: "Contas a pagar", icon: ClipboardList, minRole: "financeiro" },
      { href: "/crm/financeiro", label: "Visão financeira", icon: Wallet, minRole: "financeiro" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    sectionIcon: Radio,
    items: [
      { href: "/crm/trafego", label: "Campanhas", icon: Radio, minRole: "gestor" },
      { href: "/crm/canais-entrada", label: "Canais de entrada", icon: Radio, minRole: "gestor" },
    ],
  },
  {
    id: "ia",
    label: "IA e Agentes",
    sectionIcon: Sparkles,
    items: [
      {
        href: "/crm/agentes",
        label: "Agentes IA",
        icon: LayoutTemplate,
        minRole: "gestor",
        extra: { href: "/crm/agentes/novo", label: "Novo agente" },
      },
      { href: "/crm/ciclos", label: "Automações", icon: Zap, minRole: "gestor" },
      { href: "/crm/ferramentas", label: "Ferramentas", icon: Wrench, minRole: "gestor" },
      // Integrações vive aqui (API-first liga IA/automações a sistemas externos), não em Admin.
      { href: "/crm/integracoes", label: "Integrações", icon: Plug, minRole: "owner" },
      {
        href: "/crm/agentes-reais",
        label: "Copiloto",
        icon: Sparkles,
        navBadge: "Em breve",
        minRole: "gestor",
      },
    ],
  },
  // RESERVADO — grupo "Comunidade" (ponte Membros, Bloco 7): hierarquia-alvo no menu
  // principal é Comunidade > Homologação > Onboarding. Essas telas vêm do sistema
  // Membros (separado) e ainda NÃO existem aqui — por isso não há itens (evita 404 /
  // "menu morto"). Entram quando importadas. O /crm/onboarding-tenant abaixo é uma
  // tela SOLTA de setup do tenant (admin), NÃO o onboarding do membro.
  {
    // §8: Administração (ex-"Sistema").
    id: "administracao",
    label: "Administração",
    sectionIcon: Settings,
    items: [
      { href: "/crm/configuracoes", label: "Configurações", icon: Settings, minRole: "gestor" },
      // "Progresso sistema" (/crm/progresso-sistema) é tracker interno de build — fora do
      // menu do produto. Rota segue acessível por URL (owner) p/ diagnóstico.
      // Integrações migrou p/ "IA e Agentes". Onboarding (/crm/onboarding-tenant) saiu do
      // menu (tela solta de setup do tenant); rota segue acessível por URL (owner).
      { href: "/crm/contatos", label: "Contatos de notificação", icon: Bell, minRole: "owner" },
      { href: "/crm/usuarios", label: "Usuários & Permissões", icon: UserCog, minRole: "gestor" },
      // "Escritórios" = admin multi-tenant (/api/crm/tenants): cada escritório/instalação
      // Obra10+ com seus admins. NÃO confundir com o cadastro de empresa-cliente PJ
      // (hub_empresas), que vive em Cadastros (unificado PF/PJ — Bloco 1.5/2).
      { href: "/crm/empresas", label: "Escritórios", icon: Building2, minRole: "owner" },
    ],
  },
];

/** @deprecated import from @/lib/crm/crm-permissoes */
export function isCrmAdminRole(role: string): boolean {
  return isCrmGestorRole(role);
}

/**
 * Filtra grupos/itens pelo MESMO predicado do guard de rota (`crmPodeVerRota`),
 * para o menu mostrar exatamente o que o papel pode aceder — sem drift menu↔rota.
 * Honra automaticamente as rotas de papel-exato (ex.: Financeiro fora de `comercial`).
 * `minRole`/`adminOnly` ficam como documentação do intent por item.
 */
export function filterCrmNavGroupsForRole(groups: CrmNavGroup[], role: string): CrmNavGroup[] {
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => crmPodeVerRota(role, item.href)),
    }))
    .filter(g => g.items.length > 0);
}

export function findCrmNavGroupIdForPath(groups: CrmNavGroup[], pathname: string): string {
  for (const g of groups) {
    if (g.items.some(item => isCrmNavPathActive(pathname, item.href))) return g.id;
  }
  return groups[0]?.id ?? "visao";
}

export function isCrmNavPathActive(pathname: string, href: string): boolean {
  if (href === "/crm") return pathname === "/crm";
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}
