import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import {
  crmNivelFromRole,
  isCrmGestorRole,
  isCrmOwnerRole,
  crmPodeAtribuirRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { CRM_ACCESS_COOKIE } from "@/lib/auth/crm-session";
import { NextResponse } from "next/server";

/** `sub` do JWT de sessão = auth.users.id. O proxy já validou assinatura/expiração;
 *  aqui só decodificamos localmente para derivar a identidade do token (não de header). */
function decodeJwtSub(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const sub = JSON.parse(json)?.sub;
    return typeof sub === "string" && sub.trim() ? sub.trim() : null;
  } catch {
    return null;
  }
}

/** Identidade autoritativa = cookie de sessão httpOnly (`obra10_crm_access`), não header arbitrário. */
function authIdFromSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp("(?:^|;\\s*)" + CRM_ACCESS_COOKIE + "=([^;]+)"));
  if (!m) return null;
  let token: string;
  try {
    token = decodeURIComponent(m[1]);
  } catch {
    return null; // cookie percent-encoding inválido → trata como ausente (evita 500)
  }
  return decodeJwtSub(token);
}

/**
 * Identidade do chamador para rotas CRM: a sessão (cookie httpOnly validado pelo proxy)
 * tem PRIORIDADE; o header `x-caller-auth-id` (forjável) só vale para chamador interno
 * SEM cookie (já gated por `x-api-key` no proxy). Use em qualquer rota que precise saber
 * "quem é o operador" — nunca confie no header diretamente.
 */
export function resolveCallerAuthId(request: Request): string | null {
  return authIdFromSessionCookie(request) ?? (request.headers.get("x-caller-auth-id")?.trim() || null);
}

export function crmApiConfigError(): NextResponse | null {
  const err = crmConfigError();
  if (err) return NextResponse.json({ error: err }, { status: 503 });
  return null;
}

/** Rotas CRM server: exige chave interna (mesmo critério que proxy). */
export function requireInternalApiKey(request: Request): NextResponse | null {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  if (!expected) return null;
  const got = request.headers.get("x-api-key")?.trim();
  if (got !== expected) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return null;
}

export type CrmCallerContext = {
  authId: string;
  userId: string;
  role: string;
  status: string;
  tenantId: string;
};

export async function getCallerContext(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  const config = crmApiConfigError();
  if (config) return { error: config };
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return { error: keyErr };

  // Identidade vem do token de sessão validado pelo proxy (cookie httpOnly).
  // O header `x-caller-auth-id` (forjável pelo cliente) só é fallback para chamador
  // interno SEM cookie — que já passou pelo gate `x-api-key` do proxy. Com cookie
  // presente, o header é IGNORADO (fecha escalada por auth_id de outro usuário).
  const authId = resolveCallerAuthId(request);
  if (!authId) {
    return {
      error: NextResponse.json(
        { error: "Sessão inválida ou identidade ausente." },
        { status: 401 }
      ),
    };
  }

  let select = "id, role, status, tenant_id";
  let { data, error } = await crmDb()
    .from("users")
    .select(select)
    .eq("auth_id", authId)
    .maybeSingle();

  if (error && isMissingPgColumn(error, "tenant_id")) {
    select = "id, role, status";
    ({ data, error } = await crmDb().from("users").select(select).eq("auth_id", authId).maybeSingle());
  }

  if (error) return { error: NextResponse.json({ error: error.message }, { status: 500 }) };
  if (!data || typeof data !== "object" || !("id" in data)) {
    return { error: NextResponse.json({ error: "Utilizador não encontrado." }, { status: 403 }) };
  }

  const row = data as {
    id: string;
    role?: string | null;
    status?: string | null;
    tenant_id?: string | null;
  };

  const status = String(row.status ?? "").trim().toLowerCase();
  if (status && status !== "ativo") {
    return { error: NextResponse.json({ error: "Conta inativa." }, { status: 403 }) };
  }

  const tenantId =
    row.tenant_id != null && String(row.tenant_id).trim()
      ? String(row.tenant_id)
      : defaultTenantId();

  return {
    ctx: {
      authId,
      userId: String(row.id),
      role: String(row.role ?? ""),
      status: String(row.status ?? "Ativo"),
      tenantId,
    },
  };
}

async function requireCallerWith(
  request: Request,
  check: (role: string) => boolean,
  message: string
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  const result = await getCallerContext(request);
  if ("error" in result) return result;
  if (!check(result.ctx.role)) {
    return { error: NextResponse.json({ error: message }, { status: 403 }) };
  }
  return result;
}

/** Owner ou Gestor — gestão de equipa e configurações operacionais. */
export async function requireCrmGestor(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  return requireCallerWith(
    request,
    isCrmGestorRole,
    "Apenas owner ou gestor podem executar esta ação."
  );
}

/** @deprecated use requireCrmGestor */
export async function requireCrmAdmin(request: Request): Promise<NextResponse | null> {
  const result = await requireCrmGestor(request);
  if ("error" in result) return result.error;
  return null;
}

/** Apenas Owner — integrações, onboarding, progresso sistema. */
export async function requireCrmOwner(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  return requireCallerWith(request, isCrmOwnerRole, "Apenas owners podem executar esta ação.");
}

/** Financeiro, Gestor ou Owner. */
export async function requireCrmFinanceiro(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  return requireCallerWith(
    request,
    role => {
      const n = crmNivelFromRole(role);
      return n === "owner" || n === "gestor" || n === "financeiro";
    },
    "Sem permissão para o módulo financeiro."
  );
}

export const APP_ROLES = [
  "owner",
  "gestor",
  "comercial",
  "financeiro",
  "atendente",
  "parceiro",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, CrmNivel> = {
  admin: "gestor",
  vendedor: "comercial",
};

export function normalizeAppRole(role: string): AppRole | null {
  const r = role.trim().toLowerCase();
  const mapped = LEGACY_ROLE_MAP[r] ?? r;
  return (APP_ROLES as readonly string[]).includes(mapped) ? (mapped as AppRole) : null;
}

export function normalizeEquipaRole(role: string): CrmNivel | null {
  const normalized = normalizeAppRole(role);
  if (!normalized || normalized === "parceiro") return null;
  return normalized;
}

export { crmPodeAtribuirRole };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gestor: sempre o tenant do caller. Owner: pode indicar outro tenant_id válido. */
export function resolveInviteTenantId(
  ctx: CrmCallerContext,
  requestedTenantId?: string | null
): { tenantId: string } | { error: string } {
  const req = requestedTenantId?.trim();
  if (isCrmOwnerRole(ctx.role) && req && UUID_RE.test(req)) {
    return { tenantId: req };
  }
  return { tenantId: ctx.tenantId };
}
