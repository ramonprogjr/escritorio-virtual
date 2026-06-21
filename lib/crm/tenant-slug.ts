/** Gera slug único para hub_tenants a partir do nome de exibição. */
export function slugFromNomeExibicao(nome: string): string {
  const base = nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "empresa";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTenantUuid(id: string | null | undefined): boolean {
  return Boolean(id?.trim() && UUID_RE.test(id.trim()));
}
