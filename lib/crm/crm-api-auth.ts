import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import {
  crmNivelFromRole,
  crmNivelAtLeast,
  isCrmGestorRole,
  isCrmOwnerRole,
  crmPodeAtribuirRole,
  type CrmNivel,
} from "@/lib/crm/crm-permissoes";
import { defaultTenantId, isMissingPgColumn } from "@/lib/tenant-default";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { NextResponse } from "next/server";

/** Extrai o access token CRU do cookie de sessão httpOnly (sem decodificar/validar). */
function accessTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(new RegExp("(?:^|;\\s*)" + CRM_ACCESS_COOKIE + "=([^;]+)"));
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null; // percent-encoding inválido → trata como ausente (evita 500)
  }
}

/**
 * Identidade do chamador = cookie de sessão VALIDADO no Supabase (`/auth/v1/user` confere
 * assinatura + expiração). ANTES o `sub` era só decodificado localmente (base64) confiando
 * que o middleware validava — mas `proxy.ts` é o middleware do Next 16 (renomeação
 * middleware->proxy), VIVO porém só faz auth GROSSA ("tem sessão?"); os guards por-rota são
 * a autz real. Confiar no `sub` só-decodificado deixava um cookie FORJADO com `sub` arbitrário
 * passar como se fosse aquele usuário (bypass de auth). Agora validamos de fato na fonte.
 *
 * O header `x-caller-auth-id` NÃO é mais fallback aqui — era um valor vindo do cliente,
 * forjável e sem gate. O caminho interno server-to-server (cron/worker) é tratado só em
 * `getCallerContext`, gated por `requireInternalApiKey`. Fail-closed: token
 * ausente/inválido/expirado → null.
 */
export async function resolveCallerAuthId(request: Request): Promise<string | null> {
  const token = accessTokenFromCookie(request);
  if (!token) return null;
  const user = await fetchAuthUserFromAccessToken(token);
  return user?.id ?? null;
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

  // H-SEC-1: o browser autentica EXCLUSIVAMENTE pelo cookie de sessão (não envia mais
  // x-api-key — a chave saiu do bundle). A chave interna só é exigida no caminho SEM
  // cookie (cron/worker/server-to-server), onde a identidade vem do header forjável
  // `x-caller-auth-id` — por isso esse caminho continua gated pela chave. Com cookie de
  // sessão presente (já validado pelo proxy), NÃO exigimos a chave; senão o browser
  // (sem x-api-key) tomaria 401 em toda chamada.
  // Cookie de sessão VALIDADO na fonte (Supabase) — prioridade absoluta.
  const cookieAuthId = await resolveCallerAuthId(request);

  // Sem cookie válido → caminho interno server-to-server. Exige INTERNAL_API_KEY CONFIGURADA
  // E x-api-key correta. Fail-closed: se a chave não está definida no ambiente, o header é
  // REJEITADO — senão um `x-caller-auth-id` forjado (valor vindo do cliente) passaria sem gate
  // (requireInternalApiKey é leniente quando a env está vazia). Nunca confiar no header sem a chave.
  let authId = cookieAuthId;
  if (!authId) {
    const expected = process.env.INTERNAL_API_KEY?.trim();
    const got = request.headers.get("x-api-key")?.trim();
    if (!expected || got !== expected) {
      return {
        error: NextResponse.json(
          { error: "Sessão inválida ou identidade ausente." },
          { status: 401 }
        ),
      };
    }
    authId = request.headers.get("x-caller-auth-id")?.trim() || null;
  }

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

/** Comercial, Gestor ou Owner — funil de vendas, cadastros e negócios. */
export async function requireCrmComercial(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  return requireCallerWith(
    request,
    role => crmNivelAtLeast(role, "comercial"),
    "Sem permissão para esta ação comercial."
  );
}

/** Qualquer sessão CRM ativa (atendente ou acima) — ações operacionais básicas. */
export async function requireCrmSessao(
  request: Request
): Promise<{ ctx: CrmCallerContext } | { error: NextResponse }> {
  return requireCallerWith(
    request,
    role => crmNivelAtLeast(role, "atendente"),
    "Sessão CRM necessária para esta ação."
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
