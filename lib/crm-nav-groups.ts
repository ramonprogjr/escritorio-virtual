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
  LayoutTemplate,
  Zap,
  Wrench,
  Sparkles,
  Settings,
  Plug,
  Bell,
  UserCog,
  Shield,
} from "lucide-react";
import {
  crmNivelAtLeast,
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

/** Fonte de verdade do menu lateral — ver docs/menu-navegacao-consolidado.md */
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
    id: "vendas",
    label: "Vendas",
    sectionIcon: Briefcase,
    items: [
      { href: "/crm/cadastro", label: "Cadastros", icon: User, minRole: "comercial" },
      { href: "/crm/leads", label: "Leads", icon: Users, minRole: "atendente" },
      { href: "/crm/negocios", label: "Negócios", icon: Briefcase, minRole: "comercial" },
      { href: "/crm/tarefas", label: "Tarefas", icon: ClipboardList, minRole: "comercial" },
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake, minRole: "comercial" },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    sectionIcon: Package,
    items: [{ href: "/crm/imoveis", label: "Imóveis", icon: Home, minRole: "comercial" }],
  },
  {
    id: "obras",
    label: "Obras",
    sectionIcon: HardHat,
    items: [
      { href: "/crm/obras", label: "Obras", icon: HardHat, minRole: "comercial" },
      { href: "/crm/pedidos", label: "Pedidos", icon: Truck, minRole: "comercial" },
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sectionIcon: ClipboardList,
    items: [
      { href: "/crm/financeiro", label: "Visão financeira", icon: Wallet, minRole: "financeiro" },
      { href: "/crm/financeiro/pagar", label: "Contas a pagar", icon: ClipboardList, minRole: "financeiro" },
      { href: "/crm/financeiro/receber", label: "Contas a receber", icon: LineChart, minRole: "financeiro" },
    ],
  },
  {
    id: "projetos",
    label: "Projetos",
    sectionIcon: Package,
    items: [{ href: "/crm/projetos", label: "Projetos", icon: LayoutTemplate, minRole: "comercial" }],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/atendimento", label: "Inbox", icon: MessageSquare, minRole: "atendente" },
      { href: "/crm/canais", label: "Canais", icon: MessageCircle, minRole: "atendente" },
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck, minRole: "gestor" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    sectionIcon: Radio,
    items: [{ href: "/crm/trafego", label: "Campanhas", icon: Radio, minRole: "gestor" }],
  },
  {
    id: "ia",
    label: "IA & Automação",
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
      {
        href: "/crm/agentes-reais",
        label: "Copiloto",
        icon: Sparkles,
        navBadge: "Em breve",
        minRole: "gestor",
      },
    ],
  },
  {
    id: "sistema",
    label: "Sistema",
    sectionIcon: Settings,
    items: [
      { href: "/crm/configuracoes", label: "Configurações", icon: Settings, minRole: "gestor" },
      { href: "/crm/progresso-sistema", label: "Progresso sistema", icon: LineChart, minRole: "owner" },
      { href: "/crm/integracoes", label: "Integrações", icon: Plug, minRole: "owner" },
      { href: "/crm/contatos", label: "Contatos de notificação", icon: Bell, minRole: "owner" },
      { href: "/crm/usuarios", label: "Usuários & Permissões", icon: UserCog, minRole: "gestor" },
      { href: "/crm/empresas", label: "Empresas", icon: Building2, minRole: "owner" },
      {
        href: "/crm/onboarding-tenant",
        label: "Onboarding",
        icon: Shield,
        minRole: "owner",
      },
    ],
  },
];

/** @deprecated import from @/lib/crm/crm-permissoes */
export function isCrmAdminRole(role: string): boolean {
  return isCrmGestorRole(role);
}

function itemMinRole(item: CrmNavItem): CrmNivel {
  if (item.minRole) return item.minRole;
  if (item.adminOnly) return "owner";
  return "comercial";
}

export function filterCrmNavGroupsForRole(groups: CrmNavGroup[], role: string): CrmNavGroup[] {
  return groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => crmNivelAtLeast(role, itemMinRole(item))),
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
