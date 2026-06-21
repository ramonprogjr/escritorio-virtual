import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import {
  crmNivelFromRole,
  isCrmGestorRole,
  isCrmOwnerRole,
  crmPodeAtribuirRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { NextResponse } from "next/server";

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

  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) {
    return {
      error: NextResponse.json(
        { error: "Cabeçalho x-caller-auth-id obrigatório para esta operação." },
        { status: 403 }
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
