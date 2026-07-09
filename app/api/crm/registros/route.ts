import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isCrmOwnerRole } from "@/lib/crm/crm-permissoes";
import { registrarAtividade } from "@/lib/crm/registrar-atividade";
import { classificarAtividade, type CategoriaAtividade } from "@/lib/crm/classificar-atividade";
import { podeAlterarRegistro, autorNomeRegistro } from "@/lib/crm/permissao-registro";
import { resolverNomesUsuarios } from "@/lib/crm/resolver-nomes-usuarios";

/**
 * Registros/timeline UNIVERSAL de qualquer entidade (hub_atividades via entity_type+entity_id).
 * GET = timeline VISÍVEL (comentário + atividade principal; LOG oculto) com flags de permissão calculadas
 * no servidor. POST = nota manual. PATCH = editar (autor/owner). DELETE = arquivar (autor/owner).
 * A trava REAL de imutabilidade/permissão é o trigger no banco; aqui é a camada de servidor + UX.
 */

const ENTIDADES = new Set(["lead", "pessoa", "empresa", "negocio", "fornecedor", "especialista", "obra"]);

/** entity_type → tabela dona (todas verificadas: têm id + tenant_id). Usado para provar posse no POST. */
const TABELA_DA_ENTIDADE: Record<string, string> = {
  lead: "hub_leads_crm",
  pessoa: "hub_pessoas",
  empresa: "hub_empresas",
  negocio: "hub_negocios",
  fornecedor: "hub_fornecedores",
  especialista: "hub_especialistas",
  obra: "hub_obras",
};

/** A entidade existe E é do tenant do chamador? Impede nota cega em id de outro tenant (sondagem/spam). */
async function entidadeDoTenant(
  supabase: ReturnType<typeof crmDb>,
  entityType: string,
  entityId: string,
  tenantId: string
): Promise<{ ok: true } | { resp: NextResponse }> {
  const tabela = TABELA_DA_ENTIDADE[entityType];
  if (!tabela) return { resp: NextResponse.json({ error: "entity_type inválido" }, { status: 400 }) };
  const { data, error } = await supabase.from(tabela).select("id, tenant_id").eq("id", entityId).maybeSingle();
  if (error) {
    console.error("[registros posse]", error.message);
    return { resp: NextResponse.json({ error: "erro_interno" }, { status: 500 }) };
  }
  const row = data as Record<string, unknown> | null;
  if (!row || String(row.tenant_id ?? "") !== tenantId) {
    return { resp: NextResponse.json({ error: "Registro não encontrado." }, { status: 404 }) };
  }
  return { ok: true };
}

function categoriaDaLinha(r: Record<string, unknown>): CategoriaAtividade {
  const c = r.categoria;
  if (c === "comentario" || c === "atividade_principal" || c === "log") return c;
  return classificarAtividade(r.tipo as string, r.feito_por_tipo as string, r.metadata);
}

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Piso de papel igual ao PATCH/DELETE (atendente+): papéis nível-null (parceiro/fornecedor/cliente)
  // NÃO leem os comentários internos da ficha.
  const g = await requireCrmSessao(request);
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
  if (error) {
    console.error("[registros GET]", error.message);
    return NextResponse.json({ error: "Não foi possível carregar o histórico." }, { status: 500 });
  }

  const isOwner = isCrmOwnerRole(g.ctx.role);
  // Defesa em profundidade: se o fallback classificar como 'log' (ex.: linha NULL num banco sem a
  // migração), ESCONDE — não basta calcular, tem que ocultar. A trava real é o trigger; isto é o cinto.
  const comCategoria = (data ?? [])
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      return { r, categoria: categoriaDaLinha(r) };
    })
    .filter((x) => x.categoria !== "log");
  // Resolve o feito_por (UUID) → nome real; a UI nunca vê o código cru de um colega.
  const nomes = await resolverNomesUsuarios(supabase, comCategoria.map((x) => x.r.feito_por as string));
  const linhas = comCategoria.map(({ r, categoria }) => {
    const pode = podeAlterarRegistro(categoria, r.feito_por as string, { userId: g.ctx.userId, isOwner });
    return {
      id: r.id,
      tipo: r.tipo,
      descricao: r.descricao,
      feito_por_tipo: r.feito_por_tipo,
      categoria,
      autor_nome: autorNomeRegistro(
        r.feito_por as string,
        r.feito_por_tipo as string,
        g.ctx.userId,
        nomes.get(String(r.feito_por ?? ""))
      ),
      editado_em: r.editado_em,
      criado_em: r.criado_em,
      pode_editar: pode,
      pode_arquivar: pode,
    };
  });
  // Honestidade: se bateu o teto da consulta, avisa que há histórico além do mostrado (sem silêncio).
  const truncado = (data?.length ?? 0) >= 100;
  return NextResponse.json({ data: linhas, is_owner: isOwner, truncado });
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
  // Allowlist de tipo: o POST cria APENAS nota humana (única combinação que o classificador manda p/
  // 'comentario'). Sem isto, um comercial forjaria atividade_principal (status_change/proposta/reuniao)
  // ou um log imutável (tipo='mensagem') via body.tipo.
  const tipo = body.tipo?.trim() || "nota";
  if (tipo !== "nota") {
    return NextResponse.json({ error: "Tipo de registro não permitido." }, { status: 400 });
  }

  const posse = await entidadeDoTenant(crmDb(), entity_type, entity_id, g.ctx.tenantId);
  if ("resp" in posse) return posse.resp;

  const r = await registrarAtividade(crmDb(), {
    entity_type,
    entity_id,
    tipo,
    descricao: body.descricao,
    feito_por: g.ctx.userId || "humano",
    feito_por_tipo: "humano",
    tenant_id: g.ctx.tenantId,
  });
  if (!r.ok) {
    // Nunca devolver a mensagem crua do Postgres (nome de coluna/constraint) ao cliente.
    console.error("[registros POST]", r.error);
    return NextResponse.json({ error: "Não foi possível registrar a nota." }, { status: 400 });
  }
  return NextResponse.json(r);
}

/** Carrega a linha (com tenant) e valida a permissão de alteração. Retorna {row} ou {resp}. */
async function carregarComPermissao(
  supabase: ReturnType<typeof crmDb>,
  id: string,
  ctx: { userId: string | null | undefined; role: string; tenantId: string }
): Promise<{ row: Record<string, unknown> } | { resp: NextResponse }> {
  const { data, error } = await supabase
    .from("hub_atividades")
    .select("id, tipo, feito_por, feito_por_tipo, categoria, metadata, tenant_id, arquivado_em")
    .eq("id", id)
    .maybeSingle();
  if (error) return { resp: NextResponse.json({ error: "erro_interno" }, { status: 500 }) };
  const row = data as Record<string, unknown> | null;
  if (!row || String(row.tenant_id ?? "") !== ctx.tenantId) {
    return { resp: NextResponse.json({ error: "Registro não encontrado." }, { status: 404 }) };
  }
  // Registro já arquivado é imutável pela UI: não reeditar texto nem reescrever quem/quando arquivou
  // (o relatório do owner mostra arquivado_por — não pode ser reatribuído por um DELETE repetido).
  if (row.arquivado_em != null) {
    return { resp: NextResponse.json({ error: "Registro arquivado — não pode ser alterado." }, { status: 409 }) };
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
