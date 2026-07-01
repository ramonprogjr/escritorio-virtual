/**
 * Guard server-side para páginas owner-only (Server Components Next.js).
 *
 * Uso:
 *   const ok = await verifyServerOwner();
 *   if (!ok) notFound(); // ou redirect("/crm")
 *
 * Fluxo: lê cookie httpOnly → decodifica sub do JWT → consulta papel no DB.
 * Mesmo critério de `requireCrmOwner` nas rotas de API, mas para Server Components
 * que não têm acesso ao objeto `Request` e usam `cookies()` de `next/headers`.
 */
import { cookies } from "next/headers";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { crmDb } from "@/lib/crm/supabase-server";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";

/**
 * Retorna `true` apenas quando há sessão válida com papel `owner`.
 * Qualquer falha (sem cookie, token inválido, papel insuficiente, erro DB) → `false`.
 * Nunca lança exceção — fail-closed.
 */
export async function verifyServerOwner(): Promise<boolean> {
  try {
    const jar = await cookies();
    const token = jar.get(CRM_ACCESS_COOKIE)?.value?.trim();
    if (!token) return false;

    // Valida o token na fonte (Supabase) — assinatura + expiração. Antes só decodificava o
    // `sub` local, confiando no proxy morto → cookie forjado passava como owner.
    const authUser = await fetchAuthUserFromAccessToken(token);
    const authId = authUser?.id;
    if (!authId) return false;

    const { data, error } = await crmDb()
      .from("users")
      .select("role, status")
      .eq("auth_id", authId)
      .maybeSingle();

    if (error || !data) return false;

    const status = String(data.status ?? "").trim().toLowerCase();
    if (status && status !== "ativo") return false;

    return isCrmOwnerRole(String(data.role ?? ""));
  } catch {
    return false;
  }
}
