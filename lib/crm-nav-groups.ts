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
 * Fonte de verdade do menu lateral — ordenado pelo CAMINHO DE VALOR do doc mestre §4.2
 * (Lead → Atendimento → Negócio → Projeto → Obra → Pedidos → Financeiro). Aprovações é
 * destaque (Pilar 2, §8.4). Ver docs/menu-navegacao-consolidado.md.
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
    // Pilar 2 do produto (mestre §8.4): toda decisão de dinheiro/comissão/material passa aqui.
    id: "aprovacoes",
    label: "Aprovações",
    sectionIcon: ClipboardCheck,
    items: [
      { href: "/crm/aprovacoes", label: "Aprovações", icon: ClipboardCheck, minRole: "gestor" },
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
    ],
  },
  {
    id: "atendimento",
    label: "Atendimento",
    sectionIcon: MessageSquare,
    items: [
      { href: "/crm/atendimento", label: "Inbox", icon: MessageSquare, minRole: "atendente" },
      { href: "/crm/canais", label: "Canais", icon: MessageCircle, minRole: "atendente" },
    ],
  },
  {
    // Rede de captação/execução (mestre §4.1): parceiros (imobiliária/corretor),
    // fornecedores (PJ por área) e especialistas (mão de obra). Fornecedores/Especialistas
    // entram quando as telas existirem (formato em memória membros-cadastro-formato).
    id: "rede",
    label: "Rede",
    sectionIcon: Handshake,
    items: [
      { href: "/crm/parceiros", label: "Parceiros", icon: Handshake, minRole: "comercial" },
      { href: "/crm/fornecedores", label: "Fornecedores", icon: Truck, minRole: "comercial" },
      { href: "/crm/especialistas", label: "Especialistas", icon: HardHat, minRole: "comercial" },
    ],
  },
  {
    id: "produtos",
    label: "Produtos",
    sectionIcon: Package,
    items: [{ href: "/crm/imoveis", label: "Imóveis", icon: Home, minRole: "comercial" }],
  },
  {
    id: "projetos",
    label: "Projetos",
    sectionIcon: Package,
    items: [{ href: "/crm/projetos", label: "Projetos", icon: LayoutTemplate, minRole: "comercial" }],
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
      // "Progresso sistema" (/crm/progresso-sistema) é tracker interno de build — fora do
      // menu do produto. Rota segue acessível por URL (owner) p/ diagnóstico.
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
