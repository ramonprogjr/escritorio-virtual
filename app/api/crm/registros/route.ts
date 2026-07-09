import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { getCallerContext, requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";
import { registrarAtividade } from "@/lib/crm/registrar-atividade";
import { classificarAtividade, type CategoriaAtividade } from "@/lib/crm/classificar-atividade";
import { podeAlterarRegistro, autorNomeRegistro } from "@/lib/crm/permissao-registro";

/**
 * Registros/timeline UNIVERSAL de qualquer entidade (hub_atividades via entity_type+entity_id).
 * GET = timeline VISÍVEL (comentário + atividade principal; LOG oculto) com flags de permissão calculadas
 * no servidor. POST = nota manual. PATCH = editar (autor/owner). DELETE = arquivar (autor/owner).
 * A trava REAL de imutabilidade/permissão é o trigger no banco; aqui é a camada de servidor + UX.
 */

const ENTIDADES = new Set(["lead", "pessoa", "empresa", "negocio", "fornecedor", "especialista", "obra"]);

function categoriaDaLinha(r: Record<string, unknown>): CategoriaAtividade {
  const c = r.categoria;
  if (c === "comentario" || c === "atividade_principal" || c === "log") return c;
  return classificarAtividade(r.tipo as string, r.feito_por_tipo as string, r.metadata);
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const g = await getCallerContext(request);
  if ("error" in g) return g.error;

  const url = new URL(request.url);
  const entity_type = (url.searchParams.get("entity_type") || "").trim();
  const entity_id = (url.searchParams.get("entity_id") || "").trim();
  if (!ENTIDADES.has(entity_type) || !entity_id) {
    return NextResponse.json({ error: "entity_type/entity_id inválidos" }, { status: 400 });
  }

  const supabase = crmDb();
  // Visibilidade no SERVIDOR: só não-arquivados e categoria <> 'log' (NULL-safe: NULL é visível — fail-safe).
  const { data, error } = await supabase
    .from("hub_atividades")
    .select("id, tipo, descricao, feito_por, feito_por_tipo, categoria, arquivado_em, editado_em, metadata, criado_em")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .is("arquivado_em", null)
    .or("categoria.is.null,categoria.neq.log")
    .order("criado_em", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const isOwner = isCrmOwnerRole(g.ctx.role);
  const linhas = (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const categoria = categoriaDaLinha(r);
    const pode = podeAlterarRegistro(categoria, r.feito_por as string, { userId: g.ctx.userId, isOwner });
    return {
      id: r.id,
      tipo: r.tipo,
      descricao: r.descricao,
      feito_por_tipo: r.feito_por_tipo,
      categoria,
      autor_nome: autorNomeRegistro(r.feito_por as string, r.feito_por_tipo as string, g.ctx.userId),
      editado_em: r.editado_em,
      criado_em: r.criado_em,
      pode_editar: pode,
      pode_arquivar: pode,
    };
  });
  return NextResponse.json({ data: linhas, is_owner: isOwner });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  let body: { entity_type?: string; entity_id?: string; descricao?: string; tipo?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const entity_type = (body.entity_type || "").trim();
  const entity_id = (body.entity_id || "").trim();
  if (!ENTIDADES.has(entity_type) || !entity_id) {
    return NextResponse.json({ error: "entity_type/entity_id inválidos" }, { status: 400 });
  }
  if (!body.descricao?.trim()) {
    return NextResponse.json({ error: "Informe o texto da nota." }, { status: 400 });
  }

  const r = await registrarAtividade(crmDb(), {
    entity_type,
    entity_id,
    tipo: body.tipo?.trim() || "nota",
    descricao: body.descricao,
    feito_por: g.ctx.userId || "humano",
    feito_por_tipo: "humano",
    tenant_id: g.ctx.tenantId,
  });
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

/** Carrega a linha (com tenant) e valida a permissão de alteração. Retorna {row} ou {resp}. */
async function carregarComPermissao(
  supabase: ReturnType<typeof crmDb>,
  id: string,
  ctx: { userId: string | null | undefined; role: string; tenantId: string }
): Promise<{ row: Record<string, unknown> } | { resp: NextResponse }> {
  const { data, error } = await supabase
    .from("hub_atividades")
    .select("id, tipo, feito_por, feito_por_tipo, categoria, metadata, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return { resp: NextResponse.json({ error: "erro_interno" }, { status: 500 }) };
  const row = data as Record<string, unknown> | null;
  if (!row || String(row.tenant_id ?? "") !== ctx.tenantId) {
    return { resp: NextResponse.json({ error: "Registro não encontrado." }, { status: 404 }) };
  }
  const categoria = categoriaDaLinha(row);
  const pode = podeAlterarRegistro(categoria, row.feito_por as string, {
    userId: ctx.userId,
    isOwner: isCrmOwnerRole(ctx.role),
  });
  if (!pode) {
    return {
      resp: NextResponse.json(
        { error: categoria === "log" ? "Logs da IA não podem ser alterados." : "Sem permissão para alterar este registro." },
        { status: 403 }
      ),
    };
  }
  return { row };
}

/** Editar a descrição de um comentário (autor/owner) ou atividade principal (owner). */
export async function PATCH(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  let body: { id?: string; descricao?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const id = (body.id || "").trim();
  const descricao = (body.descricao || "").trim();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  if (!descricao) return NextResponse.json({ error: "Informe o novo texto." }, { status: 400 });

  const supabase = crmDb();
  const alvo = await carregarComPermissao(supabase, id, g.ctx);
  if ("resp" in alvo) return alvo.resp;

  // O trigger carimba editado_em e espelha o antes/depois em hub_eventos (trilha imutável).
  const { error } = await supabase.from("hub_atividades").update({ descricao }).eq("id", id);
  if (error) {
    console.error("[registros PATCH]", error.message);
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Arquivar (o "apagar" soft — o Hub nunca apaga de verdade). */
export async function DELETE(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const id = (new URL(request.url).searchParams.get("id") || "").trim();
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const supabase = crmDb();
  const alvo = await carregarComPermissao(supabase, id, g.ctx);
  if ("resp" in alvo) return alvo.resp;

  const { error } = await supabase
    .from("hub_atividades")
    .update({ arquivado_em: new Date().toISOString(), arquivado_por: g.ctx.userId || "humano" })
    .eq("id", id);
  if (error) {
    console.error("[registros DELETE/arquivar]", error.message);
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
