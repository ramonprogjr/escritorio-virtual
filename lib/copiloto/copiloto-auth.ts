/**
 * Gate de autenticação do Copiloto: exige sessão CRM válida (cookie do access token Supabase).
 * tenantId resolvido em runtime — hoje single-tenant (defaultTenantId). Mapear user→tenant é
 * hardening multi-tenant marcado para quando houver mais de um escritório.
 */
import { cookies } from "next/headers";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { defaultTenantId } from "@/lib/tenant-default";

export type CopilotoAuthOk = { ok: true; tenantId: string; userId: string };
export type CopilotoAuthErro = { ok: false; status: number; erro: string };

export async function autenticarCopiloto(): Promise<CopilotoAuthOk | CopilotoAuthErro> {
  const jar = await cookies();
  const token = jar.get(CRM_ACCESS_COOKIE)?.value?.trim();
  if (!token) return { ok: false, status: 401, erro: "Faça login para usar o copiloto." };

  let user: { id: string; email?: string | null } | null;
  try {
    user = await fetchAuthUserFromAccessToken(token);
  } catch {
    return { ok: false, status: 502, erro: "Falha ao validar a sessão." };
  }
  if (!user) return { ok: false, status: 401, erro: "Sessão inválida. Entre de novo." };

  // TODO(multi-tenant): mapear user.id → tenant; hoje o sistema opera single-tenant.
  return { ok: true, tenantId: defaultTenantId(), userId: user.id };
}
