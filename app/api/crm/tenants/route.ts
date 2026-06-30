import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { convidarColaboradorCrm } from "@/lib/crm/convidar-colaborador";
import {
  crmApiConfigError,
  normalizeEquipaRole,
  requireCrmGestor,
  requireCrmOwner,
} from "@/lib/crm/crm-api-auth";
import { slugFromNomeExibicao } from "@/lib/crm/tenant-slug";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";

export type TenantRow = {
  id: string;
  slug: string;
  nome_exibicao: string;
  ativo: boolean | null;
};

export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;

  const gestor = await requireCrmGestor(request);
  if ("error" in gestor) return gestor.error;

  const supabase = crmDb();
  let query = supabase
    .from("hub_tenants")
    .select("id, slug, nome_exibicao, ativo")
    .order("nome_exibicao", { ascending: true });

  if (!isCrmOwnerRole(gestor.ctx.role)) {
    query = query.eq("id", gestor.ctx.tenantId);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: (data ?? []) as TenantRow[],
    currentTenantId: gestor.ctx.tenantId,
  });
}

export async function POST(request: NextRequest) {
  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const body = (await request.json().catch(() => ({}))) as {
    nome_exibicao?: string;
    slug?: string;
    admin_email?: string;
    admin_name?: string;
    admin_role?: string;
  };

  const nome = body.nome_exibicao?.trim();
  if (!nome) {
    return NextResponse.json({ error: "Nome da empresa é obrigatório." }, { status: 400 });
  }

  const slugBase = body.slug?.trim() || slugFromNomeExibicao(nome);
  const supabase = crmDb();

  let slug = slugBase;
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await supabase.from("hub_tenants").select("id").eq("slug", slug).maybeSingle();
    if (!clash) break;
    slug = `${slugBase}-${i + 2}`;
  }

  const { data: tenant, error: insertErr } = await supabase
    .from("hub_tenants")
    .insert({ slug, nome_exibicao: nome, ativo: true })
    .select("id, slug, nome_exibicao, ativo")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const adminEmail = body.admin_email?.trim().toLowerCase();
  let invitedAdmin = null;

  if (adminEmail) {
    const adminRole = normalizeEquipaRole(body.admin_role ?? "gestor") ?? "gestor";
    const invite = await convidarColaboradorCrm(supabase, {
      email: adminEmail,
      name: body.admin_name?.trim() || adminEmail.split("@")[0] || "Admin",
      role: adminRole,
      tenantId: String(tenant.id),
      actorRole: owner.ctx.role,
    });
    if (!invite.ok) {
      return NextResponse.json(
        { error: `Empresa criada, mas convite falhou: ${invite.error}`, tenant },
        { status: 502 }
      );
    }
    invitedAdmin = invite.data;
  }

  return NextResponse.json({ data: tenant, invitedAdmin }, { status: 201 });
}
