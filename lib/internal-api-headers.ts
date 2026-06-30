import { encodeHttpHeaderValue } from "@/lib/http-header-utf8";

/**
 * Cabeçalhos para chamadas internas ao proxy /api.
 *
 * BROWSER: não envia x-api-key nem x-tenant-id — autenticação feita exclusivamente
 * pelo cookie de sessão httpOnly (obra10_crm_access). Isso elimina a exposição de
 * NEXT_PUBLIC_INTERNAL_API_KEY no bundle e impede forja de x-tenant-id pelo cliente.
 *
 * SERVIDOR (SSR/cron/worker): envia INTERNAL_API_KEY + DEFAULT_TENANT_ID como antes
 * — chamadas server-to-server continuam funcionando normalmente.
 */
export function internalApiHeaders(): Record<string, string> {
  if (typeof window !== "undefined") {
    // Contexto browser: depende do cookie de sessão; não expõe chave nem tenant.
    return {};
  }
  // Contexto servidor: chave interna + tenant padrão para cron/worker/SSR.
  const key = process.env.INTERNAL_API_KEY;
  const tenantId = process.env.DEFAULT_TENANT_ID;
  const h: Record<string, string> = {};
  if (key) h["x-api-key"] = key;
  if (tenantId) h["x-tenant-id"] = tenantId;
  return h;
}

/** Inclui identidade do utilizador CRM para auditoria (exclusões, etc.). */
export function internalApiHeadersWithActor(actor?: {
  id?: string | null;
  email?: string | null;
  name?: string | null;
}): Record<string, string> {
  const h = internalApiHeaders();
  if (actor?.id) h["x-user-id"] = actor.id;
  if (actor?.email) h["x-user-email"] = actor.email;
  if (actor?.name) h["x-user-name"] = encodeHttpHeaderValue(actor.name);
  return h;
}
