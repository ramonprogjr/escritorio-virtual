import type { SupabaseClient } from "@supabase/supabase-js";
import { crmPodeAtribuirRole, type CrmNivel } from "@/lib/crm/crm-permissoes";
import {
  fetchTenantNomeExibicao,
  mapEquipaUserRow,
  USER_EQUIPA_SELECT,
  USER_EQUIPA_SELECT_LEGACY,
  type EquipaUserRow,
} from "@/lib/crm/users-equipa";
import { isMissingPgColumn } from "@/lib/tenant-default";

export type ConvidarColaboradorInput = {
  email: string;
  name: string;
  role: CrmNivel;
  tenantId: string;
  actorRole: string;
};

export type ConvidarColaboradorResult =
  | { ok: true; data: ReturnType<typeof mapEquipaUserRow>; invited: true }
  | { ok: false; error: string; status: number };

export async function convidarColaboradorCrm(
  supabase: SupabaseClient,
  input: ConvidarColaboradorInput
): Promise<ConvidarColaboradorResult> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email.split("@")[0] || "Utilizador";
  const { role, tenantId, actorRole } = input;

  if (!email) return { ok: false, error: "E-mail obrigatório", status: 400 };
  if (!role || role === "owner") {
    return { ok: false, error: "Permissão obrigatória e inválida.", status: 400 };
  }
  if (!crmPodeAtribuirRole(actorRole, role)) {
    return { ok: false, error: "Sem permissão para atribuir este nível.", status: 403 };
  }

  const { data: existing } = await supabase
    .from("users")
    .select("id, tenant_id")
    .eq("email", email)
    .maybeSingle();

  if (existing) {
    if (existing.tenant_id && String(existing.tenant_id) !== tenantId) {
      return { ok: false, error: "E-mail já utilizado noutra empresa.", status: 409 };
    }
    return { ok: false, error: "Já existe utilizador com este e-mail.", status: 409 };
  }

  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || ""}/login`,
  });

  if (inviteError) return { ok: false, error: inviteError.message, status: 500 };

  const authId = inviteData.user?.id;
  if (!authId) {
    return { ok: false, error: "Convite enviado mas sem ID de utilizador.", status: 500 };
  }

  const empresaDefault = await fetchTenantNomeExibicao(supabase, tenantId);
  const upsertPayload: Record<string, unknown> = {
    auth_id: authId,
    email,
    name,
    role,
    status: "Ativo",
    tenant_id: tenantId,
    atualizado_em: new Date().toISOString(),
  };

  let { data: row, error: upsertError } = await supabase
    .from("users")
    .upsert(upsertPayload, { onConflict: "auth_id" })
    .select(USER_EQUIPA_SELECT)
    .single();

  if (upsertError && isMissingPgColumn(upsertError, "tenant_id")) {
    delete upsertPayload.tenant_id;
    upsertPayload.updated_at = upsertPayload.atualizado_em;
    delete upsertPayload.atualizado_em;
    ({ data: row, error: upsertError } = await supabase
      .from("users")
      .upsert(upsertPayload, { onConflict: "auth_id" })
      .select(USER_EQUIPA_SELECT_LEGACY)
      .single());
  }

  if (upsertError) return { ok: false, error: upsertError.message, status: 500 };

  return {
    ok: true,
    data: mapEquipaUserRow(row as EquipaUserRow, empresaDefault),
    invited: true,
  };
}
