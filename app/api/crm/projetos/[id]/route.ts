import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { PIPELINE_PROJETO_SLUG, SLUGS_PROJETO_PADRAO } from "@/lib/crm/projeto-funil-defaults";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SELECT_A0 =
  "id, codigo, titulo, status, estagio, pipeline_id, responsavel_id, tipologia, area_m2, " +
  "cliente_pessoa_id, cliente_empresa_id, cliente_nome, proxima_entrega, proxima_entrega_em, " +
  "aprovacao_status, negocio_id, obra_id, criado_em, atualizado_em";
const SELECT_LEGADO = "id, codigo, titulo, status, negocio_id, obra_id, criado_em, atualizado_em";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tenantId = g.ctx.tenantId;

  async function buscar(select: string) {
    return crmDb()
      .from("hub_projetos")
      .select(select)
      .eq("id", id)
      // AUDITORIA-FIX (vazamento legado): só o projeto do tenant do caller. O
      // `,tenant_id.is.null` anterior expunha projeto órfão de qualquer empresa.
      .eq("tenant_id", tenantId)
      .maybeSingle();
  }

  let { data, error } = await buscar(SELECT_A0);
  if (error && isMissingPgColumn(error)) ({ data, error } = await buscar(SELECT_LEGADO));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // AUDITORIA-FIX: PATCH sem auth nem tenant-scope no update → update cross-tenant.
  // Agora exige comercial+ e escopa o UPDATE por tenant (id + tenant_id).
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.titulo != null) updates.titulo = String(body.titulo).trim();

  // Mover de estágio: valida o slug contra os estágios do pipeline do projeto
  // (evita etapa-fantasma). Slug default sempre passa; custom valida no banco.
  if (typeof body.estagio === "string" && body.estagio.trim()) {
    const novoEstagio = body.estagio.trim();
    const valido = await estagioValidoParaProjeto(supabase, id, tenantId, novoEstagio);
    if (!valido) {
      return NextResponse.json(
        { error: `Estágio "${novoEstagio}" não existe neste funil.` },
        { status: 400 }
      );
    }
    updates.estagio = novoEstagio;
    updates.status = novoEstagio; // compat: status espelha estagio até A1.
  } else if (body.status != null) {
    updates.status = body.status;
  }

  if (typeof body.aprovacao_status === "string" && body.aprovacao_status.trim()) {
    updates.aprovacao_status = body.aprovacao_status.trim();
  }
  if (typeof body.tipologia === "string") updates.tipologia = body.tipologia.trim() || null;
  if ("area_m2" in body) {
    const v = body.area_m2;
    updates.area_m2 =
      typeof v === "number" && Number.isFinite(v)
        ? v
        : typeof v === "string" && v.trim() && !Number.isNaN(Number(v))
          ? Number(v)
          : null;
  }
  if ("responsavel_id" in body) updates.responsavel_id = body.responsavel_id || null;
  if ("cliente_nome" in body) updates.cliente_nome = body.cliente_nome ? String(body.cliente_nome).trim() : null;
  if ("proxima_entrega" in body) updates.proxima_entrega = body.proxima_entrega ? String(body.proxima_entrega).trim() : null;
  if ("proxima_entrega_em" in body) updates.proxima_entrega_em = body.proxima_entrega_em || null;
  if ("negocio_id" in body) updates.negocio_id = body.negocio_id || null;
  if ("obra_id" in body) updates.obra_id = body.obra_id || null;

  async function aplicar(select: string, payload: Record<string, unknown>) {
    return supabase
      .from("hub_projetos")
      .update(payload)
      .eq("id", id)
      .eq("tenant_id", tenantId) // tenant-scope no UPDATE: impede update cross-tenant.
      .select(select)
      .maybeSingle();
  }

  let { data, error } = await aplicar(SELECT_A0, updates);

  // Tolerância: colunas A0 ausentes → tenta o subconjunto que o banco aceita.
  if (error && isMissingPgColumn(error)) {
    const legado: Record<string, unknown> = { atualizado_em: updates.atualizado_em };
    if ("titulo" in updates) legado.titulo = updates.titulo;
    if ("status" in updates) legado.status = updates.status;
    if ("negocio_id" in updates) legado.negocio_id = updates.negocio_id;
    if ("obra_id" in updates) legado.obra_id = updates.obra_id;
    ({ data, error } = await aplicar(SELECT_LEGADO, legado));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

/**
 * Slug de estágio é válido se: (a) é um dos defaults do funil de projeto, OU
 * (b) existe em hub_pipeline_estagios do pipeline_id do projeto (custom do dono).
 * Tolerante: se a tabela/coluna não existe ainda, aceita o slug (degrada sem travar).
 */
async function estagioValidoParaProjeto(
  supabase: ReturnType<typeof crmDb>,
  projetoId: string,
  tenantId: string,
  slug: string
): Promise<boolean> {
  if (SLUGS_PROJETO_PADRAO.has(slug)) return true;

  // Descobre o pipeline do projeto (ou o global de projeto como fallback).
  const { data: proj, error: ePr } = await supabase
    .from("hub_projetos")
    .select("pipeline_id")
    .eq("id", projetoId)
    // AUDITORIA-FIX (vazamento legado): só o projeto do tenant do caller.
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (ePr && isMissingPgColumn(ePr)) return true; // sem coluna pipeline_id ainda → não bloqueia.

  let pipelineId = proj?.pipeline_id as string | null | undefined;
  if (!pipelineId) {
    const { data: pg } = await supabase
      .from("hub_pipelines")
      .select("id")
      .eq("slug", PIPELINE_PROJETO_SLUG)
      .is("tenant_id", null)
      .maybeSingle();
    pipelineId = pg?.id as string | undefined;
  }
  if (!pipelineId) return true; // pipeline não seedado ainda → não bloqueia (fallback UI).

  const { data: est, error: eEst } = await supabase
    .from("hub_pipeline_estagios")
    .select("slug")
    .eq("pipeline_id", pipelineId)
    .eq("slug", slug)
    .maybeSingle();
  if (eEst && isMissingPgColumn(eEst)) return true;
  return Boolean(est);
}
