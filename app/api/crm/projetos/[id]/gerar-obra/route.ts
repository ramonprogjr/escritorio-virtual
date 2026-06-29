/**
 * A2 — Orquestrador fino do elo "Gerar obra" (projeto da Arquitetura → obra da Engenharia).
 *
 * Por que orquestrador (e não POST direto do cliente em /obras):
 *  - centraliza o GATE server-side (estágio entregue OU aprovação aprovada) — o cliente não
 *    pode pular o lock confiando só no `disabled` do botão;
 *  - centraliza a IDEMPOTÊNCIA por `hub_projetos.obra_id` (o elo é o lock real);
 *  - faz o PATCH de volta do `obra_id` numa transação lógica única;
 *  - deriva tudo do PROJETO server-side; só `tipo_obra`/`frentes_selecionadas` vêm como overrides.
 *
 * REGRA TENANT: projeto buscado com `.eq('tenant_id', tenantId)` puro + guard 404; o tenant da
 * obra é SEMPRE o do caller (sessão), nunca do body. Nunca cria 2 obras para o mesmo projeto.
 *
 * Reuso (A2-DESIGN): `criarObraComEAP()` (E0), `mapTipologiaParaTipoObra()` (in-code), o PATCH
 * de `obra_id` (já aceito por /api/crm/projetos/[id]). Nenhuma migração nova.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { TIPOS_OBRA, mapTipologiaParaTipoObra } from "@/lib/obras/eap-presets";
import { criarObraComEAP } from "@/lib/obras/criar-obra-com-eap";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TIPOS_VALIDOS = new Set<string>(TIPOS_OBRA.map((t) => t.slug));

// Campos do projeto que o orquestrador lê para mapear → obra (linhagem preservada).
const SELECT_PROJETO_A0 =
  "id, codigo, titulo, estagio, status, tipologia, area_m2, cliente_pessoa_id, cliente_empresa_id, cliente_nome, aprovacao_status, negocio_id, obra_id";
const SELECT_PROJETO_LEGADO = "id, codigo, titulo, status, negocio_id, obra_id";

/** Gate de habilitação (A2-DESIGN, decisão CEO): entregue OU aprovado destrava a geração. */
function podeGerar(proj: Record<string, unknown>): boolean {
  const estagio = String(proj.estagio ?? proj.status ?? "").trim();
  const aprov = String(proj.aprovacao_status ?? "").trim();
  return estagio === "entregue" || aprov === "aprovado";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  // 1) Busca o projeto SÓ do tenant do caller (guard 404 cross-tenant).
  async function buscar(select: string) {
    return supabase
      .from("hub_projetos")
      .select(select)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
  }
  let { data: projData, error: projErr } = await buscar(SELECT_PROJETO_A0);
  if (projErr && isMissingPgColumn(projErr)) {
    ({ data: projData, error: projErr } = await buscar(SELECT_PROJETO_LEGADO));
  }
  if (projErr) return NextResponse.json({ error: projErr.message }, { status: 500 });
  if (!projData) return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });

  const proj = projData as unknown as Record<string, unknown>;

  // 2) IDEMPOTÊNCIA (camada 1 — o lock real): já há obra vinculada → NÃO cria, devolve a obra.
  const obraIdExistente = typeof proj.obra_id === "string" && proj.obra_id ? proj.obra_id : null;
  if (obraIdExistente) {
    return NextResponse.json(
      { data: { id: obraIdExistente }, vinculada: true, idempotente: true },
      { status: 200 }
    );
  }

  // 3) GATE server-side (definitivo — não confia no `disabled` do botão).
  if (!podeGerar(proj)) {
    return NextResponse.json(
      {
        error: "Projeto ainda não está entregue nem aprovado.",
        codigo: "gate_nao_entregue",
        estagio: proj.estagio ?? proj.status ?? null,
        aprovacao_status: proj.aprovacao_status ?? null,
      },
      { status: 400 }
    );
  }

  // 4) Mapeia projeto → obra. tipo_obra: override do body (se válido) OU derivado da tipologia.
  const tipoOverride =
    typeof body.tipo_obra === "string" && TIPOS_VALIDOS.has(body.tipo_obra) ? body.tipo_obra : null;
  const tipoObra = tipoOverride ?? mapTipologiaParaTipoObra(proj.tipologia as string | null | undefined);
  const tituloOverride =
    typeof body.titulo === "string" && body.titulo.trim() ? body.titulo.trim() : null;
  const titulo = tituloOverride ?? String(proj.titulo ?? "").trim() ?? "";
  const areaM2 = typeof proj.area_m2 === "number" && Number.isFinite(proj.area_m2) ? proj.area_m2 : null;

  const res = await criarObraComEAP(supabase, tenantId, {
    titulo: titulo || `Obra — ${proj.codigo ?? "projeto"}`,
    tipo_obra: tipoObra,
    area_total_m2: areaM2,
    cliente_pessoa_id: (proj.cliente_pessoa_id as string | null) ?? null,
    cliente_empresa_id: (proj.cliente_empresa_id as string | null) ?? null,
    // Linhagem: a obra herda o mesmo negócio do projeto (negócio → projeto → obra).
    negocio_id: (proj.negocio_id as string | null) ?? null,
    frentes_selecionadas: body.frentes_selecionadas,
  });

  if (!res.ok) return NextResponse.json({ error: res.erro }, { status: 500 });

  const obra = res.obra;
  const obraId = String(obra.id);

  // 5) Grava o elo de volta (o lock). Tenant-scoped. R2 (A2-DESIGN): se o PATCH falhar a obra
  // já existe — devolvemos a obra + aviso; a re-tentativa reencontra-a pela dedup 60s/título.
  const { error: patchErr } = await supabase
    .from("hub_projetos")
    .update({ obra_id: obraId, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (patchErr) {
    return NextResponse.json(
      {
        data: obra,
        frentes_criadas: res.frentes_criadas,
        aviso: "Obra criada, mas o vínculo ao projeto falhou — tente novamente para revincular.",
        elo_ok: false,
        detalhe: patchErr.message,
      },
      { status: 201 }
    );
  }

  return NextResponse.json(
    {
      data: obra,
      frentes_criadas: res.frentes_criadas,
      aviso: res.aviso,
      tipo_obra: tipoObra,
      elo_ok: true,
    },
    { status: 201 }
  );
}
