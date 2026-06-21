/**
 * RBAC CRM — 5 níveis + mapeamento de papéis legados (PDF Pt.19).
 * Fonte única para menu, rotas e ações API.
 */

export type CrmNivel = "owner" | "gestor" | "comercial" | "financeiro" | "atendente";

export const CRM_NIVEIS: CrmNivel[] = ["owner", "gestor", "comercial", "financeiro", "atendente"];

export const CRM_NIVEL_LABEL: Record<CrmNivel, string> = {
  owner: "Owner",
  gestor: "Gestor / Admin",
  comercial: "Comercial",
  financeiro: "Financeiro",
  atendente: "Atendente",
};

/** Descrição curta para UI de convite / permissão. */
export const CRM_PERMISSAO_DESCRICAO: Record<Exclude<CrmNivel, "owner">, string> = {
  gestor: "Admin da empresa — gere equipa, operação e aprovações.",
  comercial: "Funil de vendas, cadastros, negócios e tarefas.",
  financeiro: "Módulo financeiro e relatórios; leitura comercial.",
  atendente: "Inbox, canais e leads; qualifica e atende.",
};

const NIVEL_RANK: Record<CrmNivel, number> = {
  owner: 50,
  gestor: 40,
  comercial: 30,
  financeiro: 20,
  atendente: 10,
};

/** Papéis atribuíveis na UI de equipa (sem parceiro). Owner não é atribuível — ver CRM_OWNER_EMAILS. */
export const CRM_EQUIPA_ROLES: CrmNivel[] = ["gestor", "comercial", "financeiro", "atendente"];

/** Únicos owners da plataforma Obra10+ (fixos — não promovíveis pela UI). */
export const CRM_OWNER_EMAILS = [
  "ramonexercito@gmail.com",
  "nice.engemp@gmail.com",
  "ariane.ot@gmail.com",
] as const;

export function normalizeCrmEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function isCrmOwnerAllowlistedEmail(email: string | null | undefined): boolean {
  const e = normalizeCrmEmail(email);
  return (CRM_OWNER_EMAILS as readonly string[]).includes(e);
}

/** Owner fixo (Ramon, Nice, Ariane) — papel não editável na UI. */
export function isCrmOwnerFixo(email: string | null | undefined, role: string | null | undefined): boolean {
  return isCrmOwnerAllowlistedEmail(email) && crmNivelFromRole(role) === "owner";
}

export type CrmPapelOperacional = CrmNivel | "leitura";

const PERMISSOES: Record<CrmPapelOperacional, string[]> = {
  owner: ["*"],
  gestor: [
    "crm:ler",
    "crm:editar",
    "crm:encaminhar",
    "crm:aprovar_encaminhamento",
    "crm:converter_negocio",
    "crm:gerir_equipa",
  ],
  comercial: ["crm:ler", "crm:editar", "crm:converter_negocio"],
  financeiro: ["crm:ler", "crm:financeiro"],
  atendente: ["crm:ler", "crm:atendimento"],
  leitura: ["crm:ler"],
};

/** Normaliza app_role (inclui legado) para nível CRM. */
export function crmNivelFromRole(role: string | null | undefined): CrmNivel | null {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "owner") return "owner";
  if (r === "gestor" || r === "admin") return "gestor";
  if (r === "comercial" || r === "vendedor") return "comercial";
  if (r === "financeiro" || r === "finance") return "financeiro";
  if (r === "atendente") return "atendente";
  if (r === "parceiro") return null;
  return null;
}

export function crmPapelFromAppRole(role: string | null | undefined): CrmPapelOperacional {
  return crmNivelFromRole(role) ?? "leitura";
}

export function crmNivelRank(nivel: CrmNivel): number {
  return NIVEL_RANK[nivel];
}

export function crmNivelAtLeast(role: string | null | undefined, min: CrmNivel): boolean {
  const n = crmNivelFromRole(role);
  if (!n) return false;
  return NIVEL_RANK[n] >= NIVEL_RANK[min];
}

export function isCrmOwnerRole(role: string | null | undefined): boolean {
  return crmNivelFromRole(role) === "owner";
}

export function isCrmGestorRole(role: string | null | undefined): boolean {
  const n = crmNivelFromRole(role);
  return n === "owner" || n === "gestor";
}

/** @deprecated use isCrmGestorRole */
export function isCrmAdminRole(role: string): boolean {
  return isCrmGestorRole(role);
}

export function crmPode(appRole: string | null | undefined, acao: string): boolean {
  const papel = crmPapelFromAppRole(appRole);
  const lista = PERMISSOES[papel];
  return lista.includes("*") || lista.includes(acao);
}

/** Papéis que o convidador pode atribuir (convites e alterações). Nunca inclui owner. */
export function crmRolesAtribuiveisPor(role: string | null | undefined): CrmNivel[] {
  const n = crmNivelFromRole(role);
  if (n === "owner") return ["gestor", "comercial", "financeiro", "atendente"];
  if (n === "gestor") return ["gestor", "comercial", "financeiro", "atendente"];
  return [];
}

export function crmPodeAtribuirRole(convidador: string | null | undefined, alvo: string): boolean {
  const alvoNivel = crmNivelFromRole(alvo);
  if (!alvoNivel || alvoNivel === "owner") return false;
  return crmRolesAtribuiveisPor(convidador).includes(alvoNivel);
}

/** Gestor edita gestor↓; owner edita gestor↓ (owners fixos são intocáveis). */
export function crmPodeEditarPapelUtilizador(
  actorRole: string | null | undefined,
  targetEmail: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  if (isCrmOwnerFixo(targetEmail, targetRole)) return false;
  const actor = crmNivelFromRole(actorRole);
  const target = crmNivelFromRole(targetRole);
  if (!actor || !target) return false;
  if (actor === "gestor" && target === "owner") return false;
  if (actor === "owner" && target === "owner") return false;
  return crmRolesAtribuiveisPor(actorRole).length > 0;
}

/** Gestor não desativa owners; owners fixos não são desativados pela UI. */
export function crmPodeAlterarStatusUtilizador(
  actorRole: string | null | undefined,
  targetEmail: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  if (isCrmOwnerFixo(targetEmail, targetRole)) return false;
  const actor = crmNivelFromRole(actorRole);
  const target = crmNivelFromRole(targetRole);
  if (!actor) return false;
  if (actor === "gestor" && target === "owner") return false;
  return isCrmGestorRole(actorRole);
}

/** minRole por prefixo de rota (mais específico primeiro). */
const ROTA_MIN_NIVEL: { prefix: string; min: CrmNivel }[] = [
  { prefix: "/crm/onboarding-tenant", min: "owner" },
  { prefix: "/crm/empresas", min: "owner" },
  { prefix: "/crm/integracoes", min: "owner" },
  { prefix: "/crm/progresso-sistema", min: "owner" },
  { prefix: "/crm/usuarios", min: "gestor" },
  { prefix: "/crm/contatos", min: "owner" },
  { prefix: "/crm/configuracoes", min: "gestor" },
  { prefix: "/crm/financeiro", min: "financeiro" },
  { prefix: "/crm/aprovacoes", min: "gestor" },
  { prefix: "/crm/trafego", min: "gestor" },
  { prefix: "/crm/agentes", min: "gestor" },
  { prefix: "/crm/ciclos", min: "gestor" },
  { prefix: "/crm/ferramentas", min: "gestor" },
  { prefix: "/crm/agentes-reais", min: "gestor" },
  { prefix: "/crm/atendimento", min: "atendente" },
  { prefix: "/crm/canais", min: "atendente" },
  { prefix: "/crm/leads", min: "atendente" },
  { prefix: "/crm/relatorios", min: "financeiro" },
  { prefix: "/crm/analytics", min: "financeiro" },
  { prefix: "/crm", min: "financeiro" },
];

export function crmMinNivelParaRota(pathname: string): CrmNivel {
  const path = pathname.split("?")[0] ?? pathname;
  for (const { prefix, min } of ROTA_MIN_NIVEL) {
    if (prefix === "/crm" && path === "/crm") return min;
    if (prefix !== "/crm" && (path === prefix || path.startsWith(`${prefix}/`))) return min;
  }
  return "comercial";
}

export function crmPodeVerRota(role: string | null | undefined, pathname: string): boolean {
  const nivel = crmNivelFromRole(role);
  if (!nivel) return false;
  const min = crmMinNivelParaRota(pathname);
  return NIVEL_RANK[nivel] >= NIVEL_RANK[min];
}

/** Rota inicial após login conforme papel. */
export function crmRotaInicial(role: string | null | undefined): string {
  const n = crmNivelFromRole(role);
  if (n === "atendente") return "/crm/atendimento";
  return "/crm";
}
