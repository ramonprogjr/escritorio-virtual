import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

type Params = { params: Promise<{ id: string }> };

const FULL =
  "id, codigo, nome, telefone, email, cidade, uf, especialidades, especialidade_principal, bio, disponibilidade, experiencia, tem_equipe, tamanho_equipe, observacoes, verificado, destaque, criado_em, atualizado_em";

const EDITAVEIS = [
  "nome",
  "telefone",
  "email",
  "cidade",
  "uf",
  "especialidades",
  "especialidade_principal",
  "bio",
  "disponibilidade",
  "experiencia",
  "tem_equipe",
  "tamanho_equipe",
  "observacoes",
  "verificado",
  "destaque",
] as const;

export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { data, error } = await crmDb()
    .from("hub_especialistas")
    .select(`${FULL}, tenant_id`)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Especialista não encontrado" }, { status: 404 });
  if (data.tenant_id && data.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Especialista não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;

  // Isolamento de tenant: o especialista precisa pertencer ao tenant do chamador (null-safe).
  const { data: existente } = await crmDb()
    .from("hub_especialistas")
    .select("tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!existente) return NextResponse.json({ error: "Especialista não encontrado" }, { status: 404 });
  if (existente.tenant_id && existente.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Especialista não encontrado" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.nome === "string" && !body.nome.trim()) {
    return NextResponse.json({ error: "Nome não pode ficar vazio" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "especialidades") {
        patch.especialidades = Array.isArray(body.especialidades) ? body.especialidades : null;
        if (Array.isArray(body.especialidades) && body.especialidades.length) {
          patch.especialidade_principal = String(body.especialidades[0]);
        }
      } else if (k === "tamanho_equipe") {
        patch.tamanho_equipe = body.tamanho_equipe ? Number(body.tamanho_equipe) : null;
      } else {
        patch[k] = body[k];
      }
    }
  }

  const { data, error } = await crmDb()
    .from("hub_especialistas")
    .update(patch)
    .eq("id", id)
    .select(FULL)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
