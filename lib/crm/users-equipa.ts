import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingPgColumn } from "@/lib/tenant-default";

export const USER_EQUIPA_SELECT =
  "id, auth_id, email, name, role, status, criado_em, atualizado_em, tenant_id";

export const USER_EQUIPA_SELECT_LEGACY =
  "id, auth_id, email, name, role, status, created_at, updated_at, tenant_id";

export type EquipaUserRow = Record<string, unknown>;

export type EquipaUserDto = {
  id: unknown;
  auth_id: unknown;
  email: unknown;
  name: unknown;
  role: unknown;
  status: unknown;
  tenant_id: unknown;
  empresa: string | null;
  criado_em: unknown;
  atualizado_em: unknown;
};

export function mapEquipaUserRow(row: EquipaUserRow, empresa: string | null): EquipaUserDto {
  return {
    id: row.id,
    auth_id: row.auth_id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    tenant_id: row.tenant_id ?? null,
    empresa,
    criado_em: row.criado_em ?? row.created_at ?? null,
    atualizado_em: row.atualizado_em ?? row.updated_at ?? null,
  };
}

export async function fetchTenantNomeExibicao(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("hub_tenants")
    .select("nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  return typeof data.nome_exibicao === "string" ? data.nome_exibicao : null;
}

export async function listEquipaUsersForTenant(
  supabase: SupabaseClient,
  tenantId: string,
  empresaDefault: string | null
): Promise<{ data: EquipaUserDto[]; error: { message?: string } | null }> {
  let rows: EquipaUserRow[] = [];
  let error: { message?: string } | null = null;

  const primary = await supabase
    .from("users")
    .select(USER_EQUIPA_SELECT)
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false });

  if (!primary.error) {
    rows = (primary.data ?? []) as EquipaUserRow[];
  } else if (
    isMissingPgColumn(primary.error, "criado_em") ||
    isMissingPgColumn(primary.error, "tenant_id")
  ) {
    let q = supabase.from("users").select(USER_EQUIPA_SELECT_LEGACY);
    if (!isMissingPgColumn(primary.error, "tenant_id")) {
      q = q.eq("tenant_id", tenantId);
    }
    const legacy = await q.order("created_at", { ascending: false });
    if (!legacy.error) {
      rows = (legacy.data ?? []) as EquipaUserRow[];
    } else if (isMissingPgColumn(legacy.error, "tenant_id")) {
      const bare = await supabase
        .from("users")
        .select("id, auth_id, email, name, role, status, created_at, updated_at")
        .order("created_at", { ascending: false });
      rows = (bare.data ?? []) as EquipaUserRow[];
      error = bare.error;
    } else {
      error = legacy.error;
    }
  } else {
    error = primary.error;
  }

  return {
    data: rows.map(r => mapEquipaUserRow(r, empresaDefault)),
    error,
  };
}
