import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  LineChart,
  ClipboardList,
  Wallet,
  HandCoins,
  Users,
  UserPlus,
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
  KeyRound,
} from "lucide-react";
import {
  crmPodeVerRota,
  isCrmGestorRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";
import { rbacPersonaForRole, type RbacPersona } from "@/lib/rbac/role-map";

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
      // Analytics e Relatórios saíram do menu — agora são botões dentro do Dashboard
      // (Dashboard vira o hub de informação; menu lateral mais enxuto).
      { href: "/crm", label: "Dashboard", icon: LayoutDashboard, minRole: "financeiro" },
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
      { href: "/crm/indicacoes", label: "Indicações", icon: UserPlus, minRole: "atendente" },
      { href: "/crm/distribuicao", label: "Distribuição de leads", icon: Route, minRole: "gestor" },
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
    label: "Operações",
    sectionIcon: HardHat,
    items: [
      // Renomeado a pedido do dono (Jun/2026): Projetos→Arquitetura, Obras→Engenharia.
      // Sub-itens futuros (Arquitetura>Projetos; Engenharia>Construção+Reforma) entram quando
      // as telas separadas existirem — evita "menu morto". Ver [[navegacao-renomear-...]].
      // B1 (E2E DOMÍNIO C): aponta para o MÓDULO REAL (kanban funil, KPIs, fila de aprovação,
      // "Gerar obra"); /crm/projetos era o STUB e agora redireciona p/ cá.
      { href: "/crm/arquitetura", label: "Arquitetura", icon: LayoutTemplate, minRole: "comercial" },
      { href: "/crm/obras", label: "Engenharia", icon: HardHat, minRole: "comercial" },
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
    ],
  },
  {
    id: "financeiro",
    label: "Financeiro",
    sectionIcon: Wallet,
    items: [
      { href: "/crm/financeiro/rede", label: "Meu Dinheiro (rede)", icon: HandCoins, minRole: "financeiro" },
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
      { href: "/crm/creditos", label: "Carteira de Tijolos", icon: Wallet, minRole: "gestor" },
      { href: "/crm/precificacao", label: "Precificação & IA", icon: Settings, minRole: "owner" },
      // Integrações vive aqui (API-first liga IA/automações a sistemas externos), não em Admin.
      { href: "/crm/integracoes", label: "Integrações", icon: Plug, minRole: "owner" },
      {
        href: "/crm/agentes-reais",
        label: "Copiloto",
        icon: Sparkles,
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
 * Item sintético "Chaves a assinar" (Onda 2) — só para personas TÉCNICAS (arquiteto/
 * engenharia). Aponta para a fila /crm/aprovacoes, que se AUTO-FILTRA por capability no
 * servidor (só tipos de escrow). NÃO reusa o item "Aprovações" (minRole gestor, exclusivo do
 * Hub): a persona técnica vê uma entrada dedicada, não o item comercial genérico.
 */
const CHAVES_NAV_ITEM: CrmNavItem = {
  href: "/crm/aprovacoes",
  label: "Chaves a assinar",
  icon: KeyRound,
};

type PersonaNavAllow = {
  /** Por grupo: "*" (todos os itens) ou allowlist de hrefs. Grupo ausente = escondido. */
  grupos: Record<string, "*" | readonly string[]>;
  /** Acrescenta "Chaves a assinar" (no grupo Visão) para o portador de chave de escrow. */
  chaves: boolean;
};

/**
 * Allowlist de NAV por PERSONA (Onda 2, item 3). Personas INTERNAS (hub-auditor/comercial/
 * financeiro) NÃO entram aqui (undefined = no-op): mantêm o filtro por NÍVEL atual, byte-a-byte
 * igual — ZERO regressão (invariante c). Personas TÉCNICAS/EXTERNAS recebem só o que usam:
 *   • arquiteto → Visão + Operações(só Arquitetura) + Chaves a assinar;
 *   • engenharia → Visão + Operações(Engenharia+Pedidos) + Chaves a assinar;
 *   • fornecedor/parceiro/cliente/restrito → nada de /crm (fail-closed explícito — o nível null
 *     já zerava o menu; aqui deixamos a intenção EXPLÍCITA).
 * Esconder no cliente é UX; o corte de dados é server-side (GET filtra por capability).
 */
const PERSONA_NAV_ALLOW: Partial<Record<RbacPersona, PersonaNavAllow>> = {
  arquiteto: { grupos: { visao: "*", operacoes: ["/crm/arquitetura"] }, chaves: true },
  engenharia: { grupos: { visao: "*", operacoes: ["/crm/obras", "/crm/pedidos"] }, chaves: true },
  fornecedor: { grupos: {}, chaves: false },
  parceiro: { grupos: {}, chaves: false },
  cliente: { grupos: {}, chaves: false },
  restrito: { grupos: {}, chaves: false },
};

/**
 * Filtra grupos/itens pelo MESMO predicado do guard de rota (`crmPodeVerRota`),
 * para o menu mostrar exatamente o que o papel pode aceder — sem drift menu↔rota.
 * Honra automaticamente as rotas de papel-exato (ex.: Financeiro fora de `comercial`).
 * `minRole`/`adminOnly` ficam como documentação do intent por item.
 *
 * Onda 2: para personas técnicas/externas (arquiteto/engenharia/fornecedor/parceiro/cliente/
 * restrito) aplica uma allowlist PERSONA-aware POR CIMA do filtro de nível — assim o arquiteto/
 * engenharia deixa de ver os grupos Comercial/Operações(integral)/Fornecedores (vazamento do E2E)
 * e ganha só o seu módulo + "Chaves a assinar". Personas internas seguem 100% pelo nível.
 */
export function filterCrmNavGroupsForRole(groups: CrmNavGroup[], role: string): CrmNavGroup[] {
  const base = groups
    .map(g => ({
      ...g,
      items: g.items.filter(item => crmPodeVerRota(role, item.href)),
    }))
    .filter(g => g.items.length > 0);

  const allow = PERSONA_NAV_ALLOW[rbacPersonaForRole(role)];
  if (!allow) return base; // personas internas: filtro por nível, sem alteração

  const restrito: CrmNavGroup[] = [];
  for (const g of base) {
    const regra = allow.grupos[g.id];
    let items: CrmNavItem[];
    if (regra === "*") items = g.items;
    else if (Array.isArray(regra)) items = g.items.filter(i => regra.includes(i.href));
    else items = [];
    // "Chaves a assinar" entra no grupo Visão (casa da persona técnica).
    if (g.id === "visao" && allow.chaves) items = [...items, CHAVES_NAV_ITEM];
    if (items.length > 0) restrito.push({ ...g, items });
  }
  return restrito;
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
