import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmOwner } from "@/lib/crm/crm-api-auth";

export type TenantUpdateRow = {
  id: string;
  slug: string;
  nome_exibicao: string;
  ativo: boolean | null;
};

/**
 * PATCH /api/crm/tenants/[id] — ativa/desativa um escritório (tenant).
 * Owner-only. Aditivo, reversivel (so alterna a flag `ativo`).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const config = crmApiConfigError();
  if (config) return config;

  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID do escritório ausente." }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    ativo?: boolean;
    nome_exibicao?: string;
  };

  const patch: { ativo?: boolean; nome_exibicao?: string } = {};
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;
  if (typeof body.nome_exibicao === "string" && body.nome_exibicao.trim()) {
    patch.nome_exibicao = body.nome_exibicao.trim();
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const supabase = crmDb();
  const { data, error } = await supabase
    .from("hub_tenants")
    .update(patch)
    .eq("id", id)
    .select("id, slug, nome_exibicao, ativo")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data as TenantUpdateRow });
}
