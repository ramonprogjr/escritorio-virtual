/**
 * E3 — Restrições/Bloqueios de 1ª classe da obra (dossiê de resolução).
 *
 * SEGURANÇA (regra sistêmica E0/E1/E2/A0): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (nunca `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por posse (404 se
 * o tenant_id não bate). tenant_id vem SEMPRE da sessão (requireCrm*), nunca do body.
 *
 * RECONCILIAÇÃO COM E2 (não-duplicação — 1 dado, 1 dono):
 *  - Os booleans falta_* de hub_obra_itens são a verdade do "bloqueado agora".
 *  - Ao RESOLVER (ou virar pendência) uma restrição ligada a um item, LIMPAMOS o boolean
 *    correspondente em E2 (sync EXPLÍCITO, não trigger). Falha ao limpar o boolean NÃO
 *    derruba a resolução (a view retorna o boolean órfão de novo; o gestor resolve outra vez).
 *
 * TOLERÂNCIA: se a tabela/view ainda não existe (migração E3 pendente), GET devolve
 * { data: [], migracao_pendente: true } e POST/PATCH respondem 503 com aviso honesto — nunca quebra.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import {
  isTipoRestricao,
  isImpactoRestricao,
  isAcaoSugerida,
  acaoSugeridaPadrao,
  booleanDoTipo,
  ehSstReadonly,
  type TipoRestricao,
} from "@/lib/obras/restricoes";

type Params = { params: Promise<{ id: string }> };

const SELECT_RESTRICAO =
  "id, obra_id, item_id, frente_id, tipo, status, titulo, descricao, responsavel_id, responsavel_nome, prazo_resolucao, impacto, impacto_dias, impacto_frente_id, acao_sugerida, pedido_material_id, pendencia_id, sst, origem, resolvido_em, resolvido_por, resolucao_obs, criado_em";

const AVISO_PENDENTE =
  "Restrições & bloqueios ainda não ativos (migração E3 pendente — janela do dono).";

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

/**
 * Confirma que a obra pertence ao tenant do caller. crmDb() é service-role (RLS bypassada),
 * então a checagem explícita é a única proteção. tenant_id NULL não pertence a ninguém → 404.
 */
async function assertObraDoTenant(
  obraId: string,
  tenantId: string
): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}

/** GET = lista as restrições da obra (todas, ou só ativas com ?ativas=1). */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const url = new URL(request.url);
  const soAtivas = url.searchParams.get("ativas") === "1";

  let q = crmDb()
    .from("hub_obra_restricoes")
    .select(SELECT_RESTRICAO)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId) // defesa em profundidade (restrições nunca são globais)
    .order("criado_em", { ascending: false })
    .limit(500);
  if (soAtivas) q = q.in("status", ["aberta", "em_resolucao", "reaberta"]);

  const { data, error } = await q;
  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ data: [], migracao_pendente: true, aviso: AVISO_PENDENTE });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: data ?? [], migracao_pendente: false });
}

/**
 * POST = criar restrição. Se vier item_id+tipo, usa a RPC `promover` (idempotente) para
 * não duplicar com um dossiê já aberto; senão, INSERT direto (bloqueio de frente/obra).
 * Quando ligada a um item, também garante o boolean correspondente em E2 (sync explícito).
 */
export async function POST(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tipoRaw = String(body.tipo || "").trim();
  if (!isTipoRestricao(tipoRaw)) {
    return NextResponse.json({ error: "Tipo de restrição inválido." }, { status: 400 });
  }
  const tipo: TipoRestricao = tipoRaw;

  const itemId =
    typeof body.item_id === "string" && body.item_id.trim() ? body.item_id.trim() : null;
  const frenteId =
    typeof body.frente_id === "string" && body.frente_id.trim() ? body.frente_id.trim() : null;

  const supabase = crmDb();

  // Se ligada a um item, confirma que o item é da obra/tenant (posse).
  if (itemId) {
    const { data: item } = await supabase
      .from("hub_obra_itens")
      .select("id, obra_id, tenant_id")
      .eq("id", itemId)
      .maybeSingle();
    if (!item || item.obra_id !== obraId || item.tenant_id !== g.ctx.tenantId) {
      return NextResponse.json({ error: "Item não encontrado nesta obra." }, { status: 404 });
    }

    // Caminho idempotente: promove o (item,tipo). A RPC resolve obra/tenant/frente do item.
    const { data: promovidoId, error: rpcErr } = await supabase.rpc("hub_obra_restricao_promover", {
      p_item_id: itemId,
      p_tipo: tipo,
      p_origem: origemDoBody(body.origem),
    });
    if (rpcErr) {
      if (ehTabelaAusente(rpcErr)) {
        return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
      }
      return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    }

    // Sync explícito E2: garante o boolean correspondente ligado (a verdade do "bloqueado agora").
    const campo = booleanDoTipo(tipo);
    if (campo) {
      await supabase
        .from("hub_obra_itens")
        .update({ [campo]: true, atualizado_em: new Date().toISOString() })
        .eq("id", itemId)
        .eq("obra_id", obraId)
        .eq("tenant_id", g.ctx.tenantId);
    }

    // Enriquece o dossiê recém-promovido com os campos opcionais do body, se vierem.
    const patch = montarPatchEnriquecimento(body, tipo);
    if (promovidoId && Object.keys(patch).length > 0) {
      await supabase
        .from("hub_obra_restricoes")
        .update(patch)
        .eq("id", String(promovidoId))
        .eq("tenant_id", g.ctx.tenantId);
    }

    const { data } = await supabase
      .from("hub_obra_restricoes")
      .select(SELECT_RESTRICAO)
      .eq("id", String(promovidoId))
      .eq("tenant_id", g.ctx.tenantId)
      .maybeSingle();
    return NextResponse.json({ data, idempotente: true }, { status: 201 });
  }

  // Bloqueio de frente/obra (sem item): INSERT direto.
  const insert: Record<string, unknown> = {
    obra_id: obraId,
    tenant_id: g.ctx.tenantId,
    item_id: null,
    frente_id: frenteId,
    tipo,
    status: "aberta",
    origem: origemDoBody(body.origem),
    acao_sugerida: acaoSugeridaPadrao(tipo),
    ...montarPatchEnriquecimento(body, tipo),
  };

  const { data, error } = await supabase
    .from("hub_obra_restricoes")
    .insert(insert)
    .select(SELECT_RESTRICAO)
    .single();

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data }, { status: 201 });
}

/**
 * PATCH = resolver / reabrir / virar pendência / editar (responsável, prazo, impacto, ação).
 * Ao RESOLVER ou VIRAR PENDÊNCIA uma restrição ligada a item, limpa o boolean E2 (sync explícito).
 * SST (documento) NÃO pode ser resolvida por aqui (regularização auditada).
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const restricaoId = String(body.id || "").trim();
  if (!restricaoId) {
    return NextResponse.json({ error: "id da restrição é obrigatório" }, { status: 400 });
  }

  const supabase = crmDb();

  // Carrega a restrição (posse: obra + tenant) antes de mutar.
  const { data: atual, error: errGet } = await supabase
    .from("hub_obra_restricoes")
    .select("id, obra_id, tenant_id, item_id, tipo, status, sst, origem")
    .eq("id", restricaoId)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .maybeSingle();
  if (errGet) {
    if (ehTabelaAusente(errGet)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errGet.message }, { status: 500 });
  }
  if (!atual) return NextResponse.json({ error: "Restrição não encontrada" }, { status: 404 });

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  // Mudança de status (resolver/reabrir/em_resolucao/virar pendência).
  const novoStatus = typeof body.status === "string" ? body.status.trim() : "";
  const ehResolver = novoStatus === "resolvida";
  const ehVirarPendencia = novoStatus === "virou_pendencia";

  if (novoStatus) {
    if (!["aberta", "em_resolucao", "resolvida", "reaberta", "virou_pendencia"].includes(novoStatus)) {
      return NextResponse.json({ error: "Status inválido." }, { status: 400 });
    }
    // §19: SST (documento) não resolve por 1 toque — só regularização auditada.
    if (ehResolver && ehSstReadonly(atual)) {
      return NextResponse.json(
        { error: "Documento de SST: resolução só por regularização auditada." },
        { status: 409 }
      );
    }
    patch.status = novoStatus;
    if (ehResolver) {
      patch.resolvido_em = new Date().toISOString();
      patch.resolvido_por =
        typeof body.resolvido_por === "string" ? body.resolvido_por.trim() : g.ctx.userId ?? "humano";
      if (typeof body.resolucao_obs === "string") patch.resolucao_obs = body.resolucao_obs.trim() || null;
    }
    if (ehVirarPendencia && typeof body.pendencia_id === "string") {
      patch.pendencia_id = body.pendencia_id.trim() || null;
    }
  }

  // Campos editáveis (enriquecimento).
  Object.assign(patch, montarPatchEnriquecimento(body, atual.tipo as TipoRestricao));

  const { data, error } = await supabase
    .from("hub_obra_restricoes")
    .update(patch)
    .eq("id", restricaoId)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId)
    .select(SELECT_RESTRICAO)
    .maybeSingle();

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({ error: AVISO_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Restrição não encontrada" }, { status: 404 });

  // Sync explícito E2: ao RESOLVER ou VIRAR PENDÊNCIA, limpa o boolean falta_* do item.
  // (Falha aqui NÃO derruba a resolução — a view retorna o boolean órfão e o gestor resolve de novo.)
  if ((ehResolver || ehVirarPendencia) && atual.item_id) {
    const campo = booleanDoTipo(atual.tipo as TipoRestricao);
    if (campo) {
      await supabase
        .from("hub_obra_itens")
        .update({ [campo]: false, atualizado_em: new Date().toISOString() })
        .eq("id", String(atual.item_id))
        .eq("obra_id", obraId)
        .eq("tenant_id", g.ctx.tenantId);
    }
  }

  return NextResponse.json({ data });
}

/**
 * Sanitiza `origem` vinda do body. SEGURANÇA: NUNCA aceita `'sst'` do caller — uma
 * restrição SST (readonly-resolver, nunca desbloqueável por 1 toque) só pode NASCER do
 * flag `sst=true` em `montarPatchEnriquecimento` (que então grava origem='sst'). Aceitar
 * 'sst' aqui deixaria o caller forjar um bloqueio indestrutível sem o flag real.
 */
function origemDoBody(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  return v === "manual" || v === "ia" || v === "e3_restricao" ? v : "manual";
}

/** Monta o patch dos campos opcionais (responsável/prazo/impacto/ação/título/descrição). */
function montarPatchEnriquecimento(
  body: Record<string, unknown>,
  tipo: TipoRestricao
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (typeof body.titulo === "string") patch.titulo = body.titulo.trim() || null;
  if (typeof body.descricao === "string") patch.descricao = body.descricao.trim() || null;
  if (typeof body.responsavel_nome === "string") {
    patch.responsavel_nome = body.responsavel_nome.trim() || null;
  }
  if (typeof body.responsavel_id === "string") {
    patch.responsavel_id = body.responsavel_id.trim() || null;
  }
  if ("prazo_resolucao" in body) {
    patch.prazo_resolucao =
      typeof body.prazo_resolucao === "string" && body.prazo_resolucao.trim()
        ? body.prazo_resolucao.trim()
        : null;
  }
  if (typeof body.impacto === "string" && isImpactoRestricao(body.impacto)) {
    patch.impacto = body.impacto;
  }
  if (typeof body.impacto_dias === "number" && Number.isFinite(body.impacto_dias)) {
    patch.impacto_dias = Math.max(0, Math.round(body.impacto_dias));
  }
  if (typeof body.acao_sugerida === "string" && isAcaoSugerida(body.acao_sugerida)) {
    patch.acao_sugerida = body.acao_sugerida;
  }
  if (typeof body.pedido_material_id === "string" && body.pedido_material_id.trim()) {
    patch.pedido_material_id = body.pedido_material_id.trim();
  }
  if (typeof body.sst === "boolean" && tipo === "documento") {
    patch.sst = body.sst;
    if (body.sst) patch.origem = "sst";
  }
  return patch;
}
