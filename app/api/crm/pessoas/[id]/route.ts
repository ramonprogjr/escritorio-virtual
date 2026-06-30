import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  dadosExtrasEndereco,
  enriquecerPessoaDaDb,
  HUB_PESSOA_SELECT_CORE,
  HUB_PESSOA_SELECT_EXTENDED,
} from "@/lib/crm/hub-pessoas-compat";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { excluirPessoaCrm } from "@/lib/crm/excluir-cadastro-crm";
import {
  actorFromRequestHeaders,
  registrarAuditoriaCrm,
} from "@/lib/crm/registrar-auditoria-crm";
import { normalizarIdUuid } from "@/lib/crm/uuid-crm";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { validarDocumentoDisponivelPatch } from "@/lib/crm/validar-documento-server";
import { DEFAULT_OBRA10_TENANT_ID } from "@/lib/tenant-default";
import type { TipoPessoaCadastro } from "@/lib/crm/pessoa-cadastro";

/**
 * Confina o acesso ao tenant do caller. Busca o registo por id (service-role bypassa RLS)
 * e devolve 404 se ele pertencer a outro escritório. NULL/Obra10 padrão = legado partilhado
 * (acessível por todos, como nas listas via tenantScopeOrFilter).
 */
async function carregarPessoaDoTenant(
  supabase: ReturnType<typeof db>,
  id: string,
  tenantId: string
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from("hub_pessoas")
    .select("id, nome, codigo, telefone, email, tipo_pessoa, documento, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (error && !isMissingPgColumn(error, "tenant_id")) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data) {
    return { ok: false, status: 404, error: "Pessoa não encontrada." };
  }
  const row = data as Record<string, unknown> & { tenant_id?: string | null };
  const tid = row.tenant_id != null ? String(row.tenant_id).trim() : "";
  if (tid && tid !== tenantId && tid !== DEFAULT_OBRA10_TENANT_ID) {
    return { ok: false, status: 404, error: "Pessoa não encontrada." };
  }
  return { ok: true, row };
}

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function configError(): string | null {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_URL nao esta definida no servidor.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return "SUPABASE_SERVICE_ROLE_KEY nao esta definida no servidor.";
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  try {
    const err = configError();
    if (err) {
      return NextResponse.json(
        { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
        { status: 503 }
      );
    }

    const { id: rawId } = await params;
    const id = normalizarIdUuid(rawId);
    if (!id) {
      return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    }

    const supabase = db();

    // Guard de tenant: 404 se o registo for de outro escritório (service-role bypassa RLS).
    const posse = await carregarPessoaDoTenant(supabase, id, g.ctx.tenantId);
    if (!posse.ok) {
      return NextResponse.json({ error: posse.error }, { status: posse.status });
    }

    let res = await supabase
      .from("hub_pessoas")
      .select(HUB_PESSOA_SELECT_EXTENDED)
      .eq("id", id)
      .maybeSingle();

    if (res.error && isMissingPgColumn(res.error)) {
      res = await supabase
        .from("hub_pessoas")
        .select(HUB_PESSOA_SELECT_CORE)
        .eq("id", id)
        .maybeSingle();
    }

    if (res.error) {
      return NextResponse.json({ error: res.error.message }, { status: 500 });
    }
    if (!res.data) {
      return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ data: enriquecerPessoaDaDb(res.data as Record<string, unknown>) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro interno ao carregar contacto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const err = configError();
  if (err) {
    return NextResponse.json(
      { error: "CRM indisponivel: Supabase nao configurado no servidor.", detail: err },
      { status: 503 }
    );
  }

  const { id: rawId } = await params;
  const id = normalizarIdUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const allowed = [
    "nome",
    "telefone",
    "email",
    "documento",
    "tipo",
    "tipo_pessoa",
    "empresa",
    "origem",
    "area_atuacao",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
    "cidade",
    "estado",
  ] as const;

  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const supabase = db();

  // Guard de tenant: 404 se o registo for de outro escritório (service-role bypassa RLS).
  const posse = await carregarPessoaDoTenant(supabase, id, g.ctx.tenantId);
  if (!posse.ok) {
    return NextResponse.json({ error: posse.error }, { status: posse.status });
  }

  if ("documento" in body || "tipo_pessoa" in body) {
    const { data: atualDoc } = await supabase
      .from("hub_pessoas")
      .select("tipo_pessoa")
      .eq("id", id)
      .maybeSingle();
    const tipo = ((body.tipo_pessoa as string) || atualDoc?.tipo_pessoa || "PF") as TipoPessoaCadastro;
    if (tipo === "PF" || tipo === "PJ") {
      const docCheck = await validarDocumentoDisponivelPatch(
        supabase,
        tipo,
        body.documento as string | undefined,
        id,
        g.ctx.tenantId
      );
      if (!docCheck.ok) {
        return NextResponse.json({ error: docCheck.error }, { status: 409 });
      }
      if (docCheck.documento) updates.documento = docCheck.documento;
    }
  }

  const enderecoKeys = [
    "area_atuacao",
    "cep",
    "logradouro",
    "numero",
    "complemento",
    "bairro",
  ] as const;
  const temEndereco = enderecoKeys.some((k) => k in body);
  if (temEndereco) {
    const extrasPatch = dadosExtrasEndereco({
      area_atuacao: (body.area_atuacao as string) ?? null,
      cep: (body.cep as string) ?? null,
      logradouro: (body.logradouro as string) ?? null,
      numero: (body.numero as string) ?? null,
      complemento: (body.complemento as string) ?? null,
      bairro: (body.bairro as string) ?? null,
    });
    const { data: atual } = await db()
      .from("hub_pessoas")
      .select("dados_extras")
      .eq("id", id)
      .maybeSingle();
    const prev =
      atual?.dados_extras && typeof atual.dados_extras === "object" && !Array.isArray(atual.dados_extras)
        ? (atual.dados_extras as Record<string, unknown>)
        : {};
    updates.dados_extras = { ...prev, ...extrasPatch };
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json({ error: "Nenhum campo para atualizar." }, { status: 400 });
  }

  let result = await supabase
    .from("hub_pessoas")
    .update(updates)
    .eq("id", id)
    .select(HUB_PESSOA_SELECT_EXTENDED)
    .maybeSingle();

  if (result.error && isMissingPgColumn(result.error)) {
    const fallback = { ...updates };
    for (const k of enderecoKeys) delete fallback[k];
    result = await supabase
      .from("hub_pessoas")
      .update(fallback)
      .eq("id", id)
      .select(HUB_PESSOA_SELECT_CORE)
      .maybeSingle();
  }

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  if (!result.data) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });

  return NextResponse.json({
    data: enriquecerPessoaDaDb(result.data as Record<string, unknown>),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return NextResponse.json(
      { error: "Supabase não configurado no servidor." },
      { status: 503 }
    );
  }

  const { id: rawId } = await params;
  const id = normalizarIdUuid(rawId);
  if (!id) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const supabase = db();

  // Guard de tenant: 404 se o registo for de outro escritório (service-role bypassa RLS).
  const posse = await carregarPessoaDoTenant(supabase, id, g.ctx.tenantId);
  if (!posse.ok) {
    return NextResponse.json({ error: posse.error }, { status: posse.status });
  }
  const existente = posse.row as {
    id: string;
    nome?: string | null;
    codigo?: string | null;
    telefone?: string | null;
    email?: string | null;
    tipo_pessoa?: string | null;
    documento?: string | null;
  };

  const actor = actorFromRequestHeaders(request.headers);

  const { result, httpStatus } = await excluirPessoaCrm(supabase, id, g.ctx.tenantId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Falha ao excluir." },
      { status: httpStatus }
    );
  }

  await registrarAuditoriaCrm(supabase, {
    tabela: "hub_pessoas",
    operacao: "deletar",
    motivo: `Exclusão de contacto ${existente.codigo || id}`,
    actor,
    metadata: {
      registro_id: id,
      snapshot: existente,
    },
  });

  return NextResponse.json({
    ok: true,
    nome: existente.nome,
    codigo: existente.codigo,
  });
}
