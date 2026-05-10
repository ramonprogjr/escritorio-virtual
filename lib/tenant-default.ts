/** UUID fixo do tenant legado Obra10+ em `hub_tenants` (ver migrações Supabase). */
export const DEFAULT_OBRA10_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/** Tenant usado por rotas server quando não há resolução por host/JWT. */
export function defaultTenantId(): string {
  const fromEnv = process.env.DEFAULT_TENANT_ID?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_OBRA10_TENANT_ID;
}
