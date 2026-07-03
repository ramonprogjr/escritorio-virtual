/**
 * FONTE ÚNICA DE PAPEL (Onda 1 — DESIGN-RBAC-MULTITENANT.md).
 * ────────────────────────────────────────────────────────────────────────────
 * Dono único da verdade dos 13 valores canônicos do enum `app_role` (inglês).
 * Cada papel carrega 4 EIXOS ORTOGONAIS — não confundir um com o outro:
 *
 *   • nivel         — o que a pessoa pode COMMITAR (escada LINEAR só p/ papéis
 *                     INTERNOS do Hub: owner > gestor > operar > ler). Papéis
 *                     EXTERNOS (fornecedor/parceiro/cliente) e o ai_agent têm
 *                     conjunto próprio → `null` na escada.
 *   • persona       — qual COCKPIT / JOB de UI a pessoa vê.
 *   • escopo_tenant — onde ela enxerga (hub | guest | proprio-ao-licenciar | plataforma).
 *   • capacidades[] — ações discretas (lista FECHADA), inclui as chaves do escrow
 *                     `escrow:chave_hub` e `escrow:chave_tecnica`.
 *
 * PT/legado (gestor/comercial/financeiro/atendente/admin/vendedor/…) são
 * SINÔNIMOS depreciados que dobram para o mesmo destino — nunca quebrar quem já usa.
 *
 * DEFAULT FAIL-CLOSED: papel não mapeado → nível null, persona "restrito",
 * escopo nenhum, capacidades []. Nunca o dashboard do Hub.
 *
 * Os dois mapeamentos de hoje (`crmNivelFromRole` e `personaCockpitFromRole`) passam
 * a LER deste mapa — elimina a duplicidade e destrava o 403 dos papéis em inglês.
 *
 * NOTA (sem ciclo de runtime): `CrmNivel` é importado só como TIPO (apagado na
 * compilação). O runtime flui num sentido só: crm-permissoes → role-map.
 */
import type { CrmNivel } from "@/lib/crm/crm-permissoes";

// ── Os 4 eixos ortogonais ────────────────────────────────────────────────────

/** Escada LINEAR de autoridade — SÓ para papéis internos do Hub. Externos = null. */
export type RbacNivel = "owner" | "gestor" | "operar" | "ler";

/** Cockpit / JOB de UI. `restrito` é o fail-closed (sem acesso configurado). */
export type RbacPersona =
  | "hub-auditor"
  | "comercial"
  | "financeiro"
  | "engenharia"
  | "arquiteto"
  | "fornecedor"
  | "parceiro"
  | "cliente"
  | "restrito";

/** Onde a pessoa enxerga. */
export type RbacEscopoTenant = "hub" | "guest" | "proprio-ao-licenciar" | "plataforma";

/**
 * Ações discretas (lista FECHADA). As duas chaves do escrow são capabilities
 * explícitas — NUNCA deduzidas de rank (fecha o furo do modelo A).
 */
export type RbacCapacidade =
  | "crm:operar" // funil/leads/negócios/cadastro do próprio tenant
  | "financeiro:ler" // vê ledger/contas/custódia — SOMENTE leitura (não é chave)
  | "obra:operar" // lançar medição, avanço, pedido-SC (engenharia)
  | "obra:aprovar" // aprovar fase/medição de obra (engenharia responsável)
  | "projeto:aprovar" // aprovar entregável/fase de projeto (arquiteto responsável)
  | "hub:gerir" // gerir equipe/config operacional do tenant Hub
  | "plataforma:ler_cross_tenant" // leitura cross-tenant (staff-plataforma)
  | "ia:executar" // ações pré-aprovadas do ai_agent (server-to-server)
  | "escrow:chave_hub" // 1ª chave do escrow (Hub = juiz) — owner
  | "escrow:chave_tecnica"; // 2ª chave do escrow (responsável técnico) — architect OU operation

/** Os 13 valores canônicos do enum `app_role` (inglês). */
export const APP_ROLES = [
  "super_admin",
  "admin_hub",
  "commercial",
  "financial",
  "operation",
  "architect",
  "supplier",
  "broker",
  "real_estate",
  "client",
  "ai_agent",
  "owner",
  "admin",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export interface RoleDef {
  readonly nivel: RbacNivel | null;
  readonly persona: RbacPersona;
  readonly escopo_tenant: RbacEscopoTenant;
  readonly capacidades: readonly RbacCapacidade[];
}

// ── O MAPA (decisões do dono, DESIGN-RBAC-MULTITENANT.md §3 + ressalva 03/jul) ──
export const ROLE_MAP: Readonly<Record<AppRole, RoleDef>> = {
  // Cluster Hub (staff — os únicos que veem o conceito de "tenant").
  owner: {
    nivel: "owner",
    persona: "hub-auditor",
    escopo_tenant: "hub",
    // owner = Chave Hub do escrow + opera as bancadas do dia a dia (D1).
    capacidades: ["escrow:chave_hub", "hub:gerir", "crm:operar", "financeiro:ler"],
  },
  admin: {
    // Gestor TÉCNICO do tenant Hub (Ramon/dev) — rank de gestor, SEM poder de negócio.
    // NÃO é chave de escrow (bloqueio explícito — rank "gestor" não qualifica).
    nivel: "gestor",
    persona: "hub-auditor",
    escopo_tenant: "hub",
    capacidades: ["hub:gerir", "crm:operar"],
  },
  super_admin: {
    // D4: fundido com admin_hub (staff-plataforma, leitura cross-tenant).
    nivel: "gestor",
    persona: "hub-auditor",
    escopo_tenant: "plataforma",
    capacidades: ["plataforma:ler_cross_tenant", "hub:gerir", "crm:operar"],
  },
  admin_hub: {
    // D4: mesma banda de super_admin enquanto não houver staff-plataforma real.
    nivel: "gestor",
    persona: "hub-auditor",
    escopo_tenant: "plataforma",
    capacidades: ["plataforma:ler_cross_tenant", "hub:gerir", "crm:operar"],
  },

  // Cluster operacional interno (tenant Hub).
  commercial: {
    nivel: "operar",
    persona: "comercial",
    escopo_tenant: "hub",
    capacidades: ["crm:operar"],
  },
  financial: {
    // D6: vê ledger/escrow SOMENTE leitura — NÃO é chave por padrão.
    nivel: "operar",
    persona: "financeiro",
    escopo_tenant: "hub",
    capacidades: ["financeiro:ler"],
  },
  operation: {
    // ENGENHARIA. RESSALVA DO DONO (03/jul): engenharia aprova prestadores → Chave Técnica.
    nivel: "operar",
    persona: "engenharia",
    escopo_tenant: "hub",
    capacidades: ["obra:operar", "obra:aprovar", "escrow:chave_tecnica"],
  },
  architect: {
    // ARQUITETO — aprovar (gestor-equivalente NÃO-owner) + Chave Técnica em projetos.
    nivel: "gestor",
    persona: "arquiteto",
    escopo_tenant: "hub",
    capacidades: ["projeto:aprovar", "escrow:chave_tecnica"],
  },

  // Cluster externo (hoje modelo B; escopo por LINHA/ABAC, nível null — invariante (b)).
  supplier: {
    nivel: null,
    persona: "fornecedor",
    escopo_tenant: "hub",
    capacidades: [],
  },
  broker: {
    // D3: fundido com real_estate na persona "parceiro" (PF/PJ = atributo do cadastro).
    nivel: null,
    persona: "parceiro",
    escopo_tenant: "hub",
    capacidades: [],
  },
  real_estate: {
    // D3: mesmo tratamento de broker.
    nivel: null,
    persona: "parceiro",
    escopo_tenant: "hub",
    capacidades: [],
  },
  client: {
    // GUEST — nunca membro de tenant; ABAC por cliente_pessoa_id.
    nivel: null,
    persona: "cliente",
    escopo_tenant: "guest",
    capacidades: [],
  },

  // Não-humano.
  ai_agent: {
    // Assento de serviço — allowlist fixa, NENHUM rank humano, NUNCA chave de escrow (invariante (g)).
    nivel: null,
    persona: "restrito",
    escopo_tenant: "hub",
    capacidades: ["ia:executar"],
  },
};

/** Fail-closed universal: papel não mapeado nasce sem nada. */
export const ROLE_DEF_RESTRITO: RoleDef = {
  nivel: null,
  persona: "restrito",
  escopo_tenant: "hub",
  capacidades: [],
};

// ── Camada de sinônimos PT/legado (dobra UMA vez, na borda) ───────────────────
// Valores especiais fora do enum de 13: "atendente" é um nível CRM legado sem par
// em inglês (mantido p/ não quebrar quem já usa).
type CanonicalRole = AppRole | "atendente";

const LEGACY_SYNONYMS: Readonly<Record<string, CanonicalRole>> = {
  // internos PT → canônico inglês
  gestor: "admin", // gestor PT = gestor local do Hub
  comercial: "commercial",
  vendedor: "commercial",
  financeiro: "financial",
  finance: "financial",
  atendente: "atendente", // nível CRM legado (sem par no enum de 13)
  operacao: "operation",
  engenharia: "operation",
  arquiteto: "architect",
  // externos PT → canônico inglês
  parceiro: "broker",
  imobiliario: "real_estate",
  corretor: "broker",
  cliente: "client",
  fornecedor: "supplier",
};

const APP_ROLE_SET: ReadonlySet<string> = new Set(APP_ROLES);

/**
 * Normaliza um `users.role` cru (inglês, PT ou legado) para o papel CANÔNICO.
 * Retorna `null` para papel desconhecido/ausente (fail-closed na borda).
 */
export function normalizeRole(role: string | null | undefined): CanonicalRole | null {
  const r = (role ?? "").trim().toLowerCase();
  if (!r) return null;
  if (APP_ROLE_SET.has(r)) return r as AppRole;
  return LEGACY_SYNONYMS[r] ?? null;
}

/** Definição canônica (4 eixos) de um papel cru — fail-closed p/ desconhecido. */
export function roleDef(role: string | null | undefined): RoleDef {
  const canonical = normalizeRole(role);
  if (!canonical) return ROLE_DEF_RESTRITO;
  if (canonical === "atendente") {
    // Nível CRM legado: opera (ler+atendimento), persona comercial (dashboard atual).
    return { nivel: "ler", persona: "comercial", escopo_tenant: "hub", capacidades: ["crm:operar"] };
  }
  return ROLE_MAP[canonical];
}

/** A persona (cockpit/JOB) de um papel cru. Desconhecido → "restrito". */
export function rbacPersonaForRole(role: string | null | undefined): RbacPersona {
  return roleDef(role).persona;
}

/** O papel cru TEM a capacidade discreta? Fail-closed: papel inválido → false. */
export function roleTemCapacidade(role: string | null | undefined, cap: RbacCapacidade): boolean {
  return roleDef(role).capacidades.includes(cap);
}

// ── Ponte para a escala CRM legada (5 níveis) — invariantes (a),(b),(f) ───────
// A escala CrmNivel (owner|gestor|comercial|financeiro|atendente) é MAIS GROSSA que
// os 4 eixos. Este bridge é a fonte única do `crmNivelFromRole`: papéis internos
// ganham um nível (destrava o 403); EXTERNOS + ai_agent = null (invariante (b)).
//
// operation/architect → "comercial" (NÃO gestor): acesso básico ao CRM (fecha o 403) SEM
// ganhar as ~40 rotas de admin/financeiro do gestor (over-grant que a verificação pegou —
// o dono é o único gestor). Eles alcançam a fila de aprovação por CAPABILITY, não por nível:
// a rota usa requireCrmAprovador (gestor+ OU escrow:chave_*), e a Chave Técnica é assinada
// por escrow:chave_tecnica em validarChaveEscrow. A faixa-dinheiro do escopo é ocultada por
// PERSONA (persona-escopo trata architect→prestador), não por este nível.
const APP_ROLE_CRM_NIVEL: Readonly<Record<AppRole, CrmNivel | null>> = {
  owner: "owner",
  admin: "gestor",
  super_admin: "gestor",
  admin_hub: "gestor",
  commercial: "comercial",
  financial: "financeiro",
  operation: "comercial",
  architect: "comercial",
  supplier: null,
  broker: null,
  real_estate: null,
  client: null,
  ai_agent: null,
};

/**
 * Papel cru → nível CRM (escala legada). Fonte única do `crmNivelFromRole`.
 * PT/legado preservado 1:1 (owner/gestor/comercial/financeiro/atendente/parceiro);
 * papéis em inglês PARAM de retornar null (fecha o 403 vivo da Ariane=commercial).
 */
export function crmNivelForRole(role: string | null | undefined): CrmNivel | null {
  const canonical = normalizeRole(role);
  if (!canonical) return null;
  if (canonical === "atendente") return "atendente";
  return APP_ROLE_CRM_NIVEL[canonical];
}
