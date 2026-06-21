import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  APP_ROLES,
  crmPodeAtribuirRole,
  normalizeEquipaRole,
  requireCrmGestor,
} from "@/lib/crm/crm-api-auth";
import {
  crmPodeAlterarStatusUtilizador,
  crmPodeEditarPapelUtilizador,
  isCrmOwnerFixo,
} from "@/lib/crm/crm-permissoes";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  fetchTenantNomeExibicao,
  mapEquipaUserRow,
  USER_EQUIPA_SELECT,
  type EquipaUserRow,
} from "@/lib/crm/users-equipa";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RECORD_STATUSES = ["Ativo", "Inativo"] as const;

type UserCurrentRow = {
  id: string;
  email: string | null;
  role: string;
  status: string;
  tenant_id?: string | null;
};

function mapUserRow(row: Record<string, unknown>, empresa: string | null) {
  return mapEquipaUserRow(row, empresa);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gestor = await requireCrmGestor(request);
  if ("error" in gestor) return gestor.error;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    role?: string;
    status?: string;
    name?: string;
  };

  const supabase = crmDb();
  const empresaDefault = await fetchTenantNomeExibicao(supabase, gestor.ctx.tenantId);
  let current: UserCurrentRow | null = null;
  let fetchErr: { message?: string } | null = null;

  const first = await supabase
    .from("users")
    .select("id, email, role, status, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!first.error && first.data) {
    current = first.data as UserCurrentRow;
  } else if (first.error && isMissingPgColumn(first.error, "tenant_id")) {
    const second = await supabase.from("users").select("id, email, role, status").eq("id", id).maybeSingle();
    fetchErr = second.error;
    current = (second.data as UserCurrentRow | null) ?? null;
  } else {
    fetchErr = first.error;
    current = (first.data as UserCurrentRow | null) ?? null;
  }

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Utilizador não encontrado" }, { status: 404 });

  if (
    current.tenant_id &&
    String(current.tenant_id) !== gestor.ctx.tenantId
  ) {
    return NextResponse.json({ error: "Utilizador de outra empresa." }, { status: 403 });
  }

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.name != null) updates.name = String(body.name).trim();

  if (body.status != null) {
    const status = String(body.status).trim();
    if (!(RECORD_STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Status inválido. Use: Ativo, Inativo" }, { status: 400 });
    }
    if (!crmPodeAlterarStatusUtilizador(gestor.ctx.role, current.email, current.role)) {
      return NextResponse.json({ error: "Sem permissão para alterar o status deste utilizador." }, { status: 403 });
    }
    updates.status = status;
  }

  if (body.role != null) {
    const role = normalizeEquipaRole(body.role);
    if (!role) {
      return NextResponse.json(
        { error: `Papel inválido. Use: ${APP_ROLES.filter(r => r !== "parceiro" && r !== "owner").join(", ")}` },
        { status: 400 }
      );
    }
    if (!crmPodeEditarPapelUtilizador(gestor.ctx.role, current.email, current.role)) {
      return NextResponse.json({ error: "Sem permissão para alterar o papel deste utilizador." }, { status: 403 });
    }
    if (!crmPodeAtribuirRole(gestor.ctx.role, role)) {
      return NextResponse.json({ error: "Sem permissão para atribuir este papel." }, { status: 403 });
    }
    if (isCrmOwnerFixo(current.email, current.role)) {
      return NextResponse.json(
        { error: "Owners da plataforma (Ramon, Nice, Ariane) têm papel fixo." },
        { status: 403 }
      );
    }
    if (String(current.role).toLowerCase() === "owner" && role !== "owner") {
      const ownerQuery = supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner")
        .neq("id", id);
      if (current.tenant_id) {
        ownerQuery.eq("tenant_id", gestor.ctx.tenantId);
      }
      const { count } = await ownerQuery;
      if ((count ?? 0) === 0) {
        return NextResponse.json(
          { error: "Não é possível remover o último owner da equipa." },
          { status: 409 }
        );
      }
    }
    updates.role = role;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar" }, { status: 400 });
  }

  if (updates.status === "Inativo" && String(current.role).toLowerCase() === "owner") {
    if (isCrmOwnerFixo(current.email, current.role)) {
      return NextResponse.json(
        { error: "Não é possível desativar um owner fixo da plataforma." },
        { status: 409 }
      );
    }
    const ownerQuery = supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .eq("status", "Ativo")
      .neq("id", id);
    if (current.tenant_id) {
      ownerQuery.eq("tenant_id", gestor.ctx.tenantId);
    }
    const { count } = await ownerQuery;
    if ((count ?? 0) === 0) {
      return NextResponse.json(
        { error: "Não é possível desativar o último owner ativo da equipa." },
        { status: 409 }
      );
    }
  }

  let patchQuery = supabase.from("users").update(updates).eq("id", id);
  if (current.tenant_id) {
    patchQuery = patchQuery.eq("tenant_id", gestor.ctx.tenantId);
  }

  let { data, error } = await patchQuery.select(USER_EQUIPA_SELECT).single();

  if (error && isMissingPgColumn(error, "atualizado_em")) {
    updates.updated_at = updates.atualizado_em;
    delete updates.atualizado_em;
    ({ data, error } = await supabase.from("users").update(updates).eq("id", id).select("*").single());
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: mapUserRow(data as Record<string, unknown>, empresaDefault) });
}
