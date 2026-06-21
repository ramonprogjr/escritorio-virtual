import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  crmApiConfigError,
  normalizeEquipaRole,
  requireCrmGestor,
  requireInternalApiKey,
  resolveInviteTenantId,
} from "@/lib/crm/crm-api-auth";
import { convidarColaboradorCrm } from "@/lib/crm/convidar-colaborador";
import {
  fetchTenantNomeExibicao,
  listEquipaUsersForTenant,
} from "@/lib/crm/users-equipa";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const gestor = await requireCrmGestor(request);
  if ("error" in gestor) return gestor.error;

  const supabase = crmDb();
  const empresaDefault = await fetchTenantNomeExibicao(supabase, gestor.ctx.tenantId);
  const { data, error } = await listEquipaUsersForTenant(
    supabase,
    gestor.ctx.tenantId,
    empresaDefault
  );

  if (error) {
    const msg = error.message ?? String(error);
    if (msg.includes("criado_em") || msg.includes("tenant_id")) {
      return NextResponse.json(
        {
          error:
            "Esquema de utilizadores desatualizado. Aplique a migração users_rbac_tenant no Supabase.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ data, tenantId: gestor.ctx.tenantId });
}

export async function POST(request: NextRequest) {
  const gestor = await requireCrmGestor(request);
  if ("error" in gestor) return gestor.error;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: string;
    tenant_id?: string;
  };

  const email = body.email?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "E-mail obrigatório" }, { status: 400 });

  const roleRaw = body.role?.trim();
  if (!roleRaw) {
    return NextResponse.json({ error: "Permissão obrigatória." }, { status: 400 });
  }

  const role = normalizeEquipaRole(roleRaw);
  if (!role) {
    return NextResponse.json({ error: "Permissão inválida." }, { status: 400 });
  }

  if (body.tenant_id && !isCrmOwnerRole(gestor.ctx.role)) {
    return NextResponse.json({ error: "Apenas owners podem convidar noutra empresa." }, { status: 403 });
  }

  const resolved = resolveInviteTenantId(gestor.ctx, body.tenant_id);
  if ("error" in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }

  const supabase = crmDb();

  if (isCrmOwnerRole(gestor.ctx.role) && body.tenant_id) {
    const { data: tenantRow } = await supabase
      .from("hub_tenants")
      .select("id")
      .eq("id", resolved.tenantId)
      .maybeSingle();
    if (!tenantRow) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
  }

  const result = await convidarColaboradorCrm(supabase, {
    email,
    name: body.name?.trim() || email.split("@")[0] || "Utilizador",
    role,
    tenantId: resolved.tenantId,
    actorRole: gestor.ctx.role,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ data: result.data, invited: true }, { status: 201 });
}
