import { NextRequest, NextResponse } from "next/server";
import {
  criarVinculoPessoaEmpresa,
  removerVinculoPessoaEmpresa,
} from "@/lib/crm/pessoa-empresa-vinculo";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { crmDb as db } from "@/lib/crm/supabase-server";
import { gerarCodigoEmpresa } from "@/lib/crm/empresa-cadastro";
import { gerarCodigoPessoa } from "@/lib/crm/pessoa-cadastro";

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: {
    pessoa_id?: string;
    empresa_id?: string;
    /** Criar-e-vincular: nome p/ criar um RASCUNHO quando o alvo ainda não existe. */
    criar_pessoa_nome?: string;
    criar_empresa_nome?: string;
    cargo?: string;
    principal?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const supabase = db();
  const tenantId = g.ctx.tenantId;
  const now = new Date().toISOString();

  // CRIAR-E-VINCULAR (Click-and-Go / "nada se perde"): se o alvo ainda não existe (cadastrando a
  // pessoa antes da empresa, ou a empresa antes da pessoa), cria um RASCUNHO só com o nome — CNPJ/
  // documento e demais dados vêm depois — e vincula, para o cadastro fechar NA SESSÃO.
  let empresaId = body.empresa_id?.trim() || "";
  let pessoaId = body.pessoa_id?.trim() || "";
  let criouEmpresa = false;
  let criouPessoa = false;

  if (!empresaId && body.criar_empresa_nome?.trim()) {
    const codigo = await gerarCodigoEmpresa(supabase);
    const { data, error } = await supabase
      .from("hub_empresas")
      .insert({ codigo, razao_social: body.criar_empresa_nome.trim().slice(0, 200), ativo: true, tenant_id: tenantId, criado_em: now, atualizado_em: now })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Falha ao criar a empresa." }, { status: 500 });
    empresaId = String(data.id);
    criouEmpresa = true;
  }

  if (!pessoaId && body.criar_pessoa_nome?.trim()) {
    const codigo = await gerarCodigoPessoa(supabase);
    const { data, error } = await supabase
      .from("hub_pessoas")
      .insert({ codigo, nome: body.criar_pessoa_nome.trim().slice(0, 200), tenant_id: tenantId })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Falha ao criar a pessoa." }, { status: 500 });
    pessoaId = String(data.id);
    criouPessoa = true;
  }

  if (!pessoaId || !empresaId) {
    return NextResponse.json({ error: "Informe a pessoa e a empresa (ou um nome para criar)." }, { status: 400 });
  }

  const result = await criarVinculoPessoaEmpresa(supabase, {
    pessoa_id: pessoaId,
    empresa_id: empresaId,
    cargo: body.cargo,
    principal: body.principal,
    tenant_id: tenantId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, id: result.id, empresa_id: empresaId, pessoa_id: pessoaId, criou_empresa: criouEmpresa, criou_pessoa: criouPessoa },
    { status: 201 }
  );
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
