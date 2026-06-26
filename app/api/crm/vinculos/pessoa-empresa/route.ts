import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  criarVinculoPessoaEmpresa,
  removerVinculoPessoaEmpresa,
} from "@/lib/crm/pessoa-empresa-vinculo";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: {
    pessoa_id?: string;
    empresa_id?: string;
    cargo?: string;
    principal?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.pessoa_id?.trim() || !body.empresa_id?.trim()) {
    return NextResponse.json({ error: "pessoa_id e empresa_id são obrigatórios." }, { status: 400 });
  }

  const result = await criarVinculoPessoaEmpresa(db(), {
    pessoa_id: body.pessoa_id.trim(),
    empresa_id: body.empresa_id.trim(),
    cargo: body.cargo,
    principal: body.principal,
    tenant_id: g.ctx.tenantId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const supabase = db();
  // Isolamento de tenant null-safe (mesmo padrão dos fixes do auditor): só bloqueia
  // em divergência explícita, preserva vínculos legados com tenant null.
  const { data: existente } = await supabase
    .from("hub_pessoas_empresas")
    .select("tenant_id")
    .eq("id", id.trim())
    .maybeSingle();
  if (!existente) return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  if (existente.tenant_id && existente.tenant_id !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Vínculo não encontrado" }, { status: 404 });
  }

  const result = await removerVinculoPessoaEmpresa(supabase, id.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
