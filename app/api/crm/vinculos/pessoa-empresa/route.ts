import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  criarVinculoPessoaEmpresa,
  removerVinculoPessoaEmpresa,
} from "@/lib/crm/pessoa-empresa-vinculo";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
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

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const result = await criarVinculoPessoaEmpresa(db(), {
    pessoa_id: body.pessoa_id.trim(),
    empresa_id: body.empresa_id.trim(),
    cargo: body.cargo,
    principal: body.principal,
    tenant_id: tenantId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: result.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const result = await removerVinculoPessoaEmpresa(db(), id.trim());
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
