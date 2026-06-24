import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

type Params = { params: Promise<{ id: string }> };

const FULL =
  "id, codigo, nome, tipo_pessoa, cnpj, cpf, email, telefone, area_atuacao, especialidade, mercados, mercado_principal, regiao, cidade, estado, status_acesso, recebe_leads, bio, instagram, site, comissao_pct, criado_em, atualizado_em";

const EDITAVEIS = [
  "nome",
  "tipo_pessoa",
  "cnpj",
  "cpf",
  "email",
  "telefone",
  "area_atuacao",
  "especialidade",
  "mercados",
  "regiao",
  "cidade",
  "estado",
  "status_acesso",
  "recebe_leads",
  "bio",
  "instagram",
  "site",
  "comissao_pct",
] as const;

export async function GET(_request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const { data, error } = await crmDb().from("hub_fornecedores").select(FULL).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Fornecedor não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  if (typeof body.nome === "string" && !body.nome.trim()) {
    return NextResponse.json({ error: "Nome não pode ficar vazio" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const k of EDITAVEIS) {
    if (k in body) {
      if (k === "mercados") {
        const arr = Array.isArray(body.mercados) ? body.mercados : null;
        patch.mercados = arr;
        if (arr && arr.length) patch.mercado_principal = String(arr[0]);
      } else {
        patch[k] = body[k];
      }
    }
  }

  const { data, error } = await crmDb()
    .from("hub_fornecedores")
    .update(patch)
    .eq("id", id)
    .select(FULL)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
