/**
 * E7c (Fase 3a) — MEDIÇÃO honesta (append-only com evidência) + avanço POR ITEM (decisão #4).
 *
 * POST = registra UMA medição (append-only em hub_obra_medicoes) E atualiza o pct_avanco vivo do
 *   item (hub_obra_itens.pct_avanco — caminho E2, sempre existe) + quantidade_realizada se a coluna
 *   existir. O pct gravado é DERIVADO da quantidade física quando o item tem quantidade planejada
 *   (medicao.ts), senão usa o pct informado. A escrita do item-mãe é NO ENDPOINT (não trigger).
 * GET  = lista o HISTÓRICO de medições do item/obra (auditoria — nada-se-perde).
 *
 * SEGURANÇA (regra sistêmica E0/E2/E6): crmDb() é service-role e BYPASSA RLS — o isolamento
 * depende 100% do filtro no código. Toda query filtra `.eq("tenant_id", g.ctx.tenantId)` PURO
 * (nunca `.or('...is.null')`) E `.eq("obra_id", obraId)`. A obra é validada por posse (404 se o
 * tenant_id não bate). tenant_id/obra_id vêm SEMPRE da sessão/rota, NUNCA do body.
 *
 * TOLERÂNCIA (sem a migração E7c): a tabela hub_obra_medicoes não existe → grava SÓ o pct_avanco
 * no item (caminho E2) e responde { migracao_pendente: true, aviso } — nunca quebra. O avanço por
 * item já funciona; o registro formal/append-only entra quando a migração for aplicada.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { derivarPctAvanco, clampPct } from "@/lib/obras/medicao";
import { urlAssinadaMidia } from "@/lib/obras/storage-obra-midia";

type Params = { params: Promise<{ id: string }> };

const AVISO_PENDENTE =
  "Medição formal ainda não ativa (migração E7c pendente — janela do dono). O avanço do item foi salvo.";
const AVISO_ITENS_PENDENTE =
  "Itens & avanço ainda não ativos (migração E2 pendente — janela do dono).";

/** Colunas devolvidas de uma medição (auditoria). */
const SELECT_MEDICAO =
  "id, obra_id, item_id, data, quantidade_realizada, pct_avanco_resultante, foto_url, video_url, observacao, responsavel_id, responsavel_nome, criado_por, criado_em";

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

/**
 * GET = histórico de medições (auditoria), paginado por cursor.
 *
 * Query params:
 *   ?item_id=<uuid>   — filtra um item específico (omitir = obra inteira)
 *   ?limit=<n>        — itens por página (padrão 30, máx 100)
 *   ?cursor=<valor>   — cursor opaco (criado_em|id da última linha retornada); omitir = primeira página
 *
 * Resposta: { data, next_cursor, has_more, migracao_pendente }
 * next_cursor é null quando não há mais páginas.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id: obraId } = await params;
  const tenantErr = await assertObraDoTenant(obraId, g.ctx.tenantId);
  if (tenantErr) return tenantErr;

  const url = new URL(request.url);
  const itemId = url.searchParams.get("item_id")?.trim() || "";

  // ── Paginação por cursor (AUT-4: remove .limit(500) fixo) ──────────────────
  // O cursor é opaco para o cliente: codifica criado_em + id para evitar
  // duplicatas em registros com o mesmo timestamp.
  const PAGE_SIZE = Math.min(
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "30", 10) || 30),
    100
  );
  const cursorRaw = url.searchParams.get("cursor")?.trim() || "";
  let cursorCriadoEm: string | null = null;
  let cursorId: string | null = null;
  if (cursorRaw) {
    try {
      const decoded = Buffer.from(cursorRaw, "base64url").toString("utf-8");
      const sep = decoded.indexOf("|");
      if (sep > 0) {
        cursorCriadoEm = decoded.slice(0, sep);
        cursorId = decoded.slice(sep + 1);
      }
    } catch {
      // cursor corrompido → ignora, começa da primeira página
    }
  }

  // Pedimos PAGE_SIZE + 1 para saber se há próxima página sem query extra.
  let q = crmDb()
    .from("hub_obra_medicoes")
    .select(SELECT_MEDICAO)
    .eq("obra_id", obraId)
    .eq("tenant_id", g.ctx.tenantId) // defesa em profundidade (medições nunca são globais)
    .order("criado_em", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (itemId) q = q.eq("item_id", itemId);

  // Aplica o filtro do cursor: linhas ANTERIORES ao ponto de corte (ordem DESC).
  // Usa "lt" em criado_em; desempate por id "lt" quando criado_em igual.
  if (cursorCriadoEm) {
    // Supabase não suporta OR em .filter() diretamente via SDK tipado →
    // usamos o método .or() que aceita sintaxe de filtro de query string.
    q = q.or(
      `criado_em.lt.${cursorCriadoEm},and(criado_em.eq.${cursorCriadoEm},id.lt.${cursorId ?? ""})`
    );
  }

  const { data, error } = await q;
  if (error) {
    // Sem a migração E7c, a tabela não existe → histórico vazio + aviso honesto (não quebra).
    if (ehTabelaAusente(error)) {
      return NextResponse.json({
        data: [],
        next_cursor: null,
        has_more: false,
        migracao_pendente: true,
        aviso: AVISO_PENDENTE,
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const has_more = rows.length > PAGE_SIZE;
  const pageRows = has_more ? rows.slice(0, PAGE_SIZE) : rows;

  // Gera o cursor para a próxima página a partir da última linha desta.
  let next_cursor: string | null = null;
  if (has_more && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1] as Record<string, unknown>;
    const raw = `${String(last.criado_em ?? "")}|${String(last.id ?? "")}`;
    next_cursor = Buffer.from(raw).toString("base64url");
  }

  // Evidência em bucket PRIVADO: troca o PATH gravado pela URL ASSINADA (expira ~1h) para exibição.
  // Rows antigas (nenhuma, pois a foto nunca persistiu antes) ou já-URL são preservadas.
  const dataAssinada = await Promise.all(
    pageRows.map(async (row) => {
      const r = { ...(row as Record<string, unknown>) };
      const fotoPath = typeof r.foto_url === "string" ? r.foto_url : "";
      if (fotoPath && !/^https?:\/\//i.test(fotoPath)) {
        r.foto_url = await urlAssinadaMidia("foto", fotoPath);
      }
      const videoPath = typeof r.video_url === "string" ? r.video_url : "";
      if (videoPath && !/^https?:\/\//i.test(videoPath)) {
        r.video_url = await urlAssinadaMidia("video", videoPath);
      }
      return r;
    })
  );

  return NextResponse.json({
    data: dataAssinada,
    next_cursor,
    has_more,
    migracao_pendente: false,
  });
}

/**
 * POST = registra uma medição (append-only) + atualiza o avanço POR ITEM (decisão #4).
 * Fluxo:
 *   1) valida posse do item (mesma obra/tenant);
 *   2) deriva o pct_avanco resultante (da quantidade física se houver planejada, senão do pct informado);
 *   3) atualiza hub_obra_itens.pct_avanco (E2, sempre existe) + quantidade_realizada (se a coluna existir);
 *   4) insere a linha imutável em hub_obra_medicoes (se a migração E7c estiver aplicada).
 * NUNCA aceita tenant_id/obra_id do body (vêm da sessão/rota).
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

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  const itemId = String(body.item_id || "").trim();
  if (!itemId) {
    return NextResponse.json({ error: "item_id é obrigatório" }, { status: 400 });
  }

  // Posse do item: tem de ser da MESMA obra/tenant (service-role bypassa RLS → guard explícito).
  // Lê a quantidade planejada do item (base p/ derivar o pct físico).
  const { data: item, error: errItem } = await supabase
    .from("hub_obra_itens")
    .select("id, obra_id, tenant_id, quantidade, pct_avanco")
    .eq("id", itemId)
    .maybeSingle();
  if (errItem && ehTabelaAusente(errItem)) {
    return NextResponse.json({ error: AVISO_ITENS_PENDENTE, migracao_pendente: true }, { status: 503 });
  }
  if (!item || item.obra_id !== obraId || item.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Item não encontrado nesta obra." }, { status: 404 });
  }

  // Entradas (sanitizadas; nunca confiamos no body p/ tenant/obra).
  const quantidadeRealizada =
    typeof body.quantidade_realizada === "number" && Number.isFinite(body.quantidade_realizada)
      ? Math.max(0, body.quantidade_realizada)
      : null;
  const pctInformado =
    typeof body.pct_avanco_resultante === "number"
      ? body.pct_avanco_resultante
      : typeof body.pct_avanco === "number"
        ? body.pct_avanco
        : null;
  const fotoUrl = typeof body.foto_url === "string" ? body.foto_url.trim() || null : null;
  const videoUrl = typeof body.video_url === "string" ? body.video_url.trim() || null : null;
  const observacao = typeof body.observacao === "string" ? body.observacao.trim() || null : null;
  const responsavelNome =
    typeof body.responsavel_nome === "string" ? body.responsavel_nome.trim() || null : null;
  const dataMedicao =
    typeof body.data === "string" && body.data.trim() ? body.data.trim() : null;

  // Deriva o pct resultante: quantidade física × planejada quando dá; senão o pct informado.
  // null = nada utilizável → preserva o pct atual do item (não zera enganosamente).
  const quantidadePlanejada =
    typeof item.quantidade === "number" ? item.quantidade : Number(item.quantidade ?? NaN);
  const pctDerivado = derivarPctAvanco(
    quantidadeRealizada,
    Number.isFinite(quantidadePlanejada) ? quantidadePlanejada : null,
    pctInformado
  );
  const pctAtual = clampPct(typeof item.pct_avanco === "number" ? item.pct_avanco : Number(item.pct_avanco ?? 0));
  const pctResultante = pctDerivado == null ? pctAtual : pctDerivado;

  // ── 3) ATUALIZA o avanço POR ITEM (E2 — pct_avanco sempre existe) ──
  // quantidade_realizada NÃO é coluna de hub_obra_itens (E2); só atualizamos o pct vivo aqui.
  // O filtro .eq(id/obra/tenant) é a ÚNICA proteção (service-role bypassa RLS).
  const { error: errUpdate } = await supabase
    .from("hub_obra_itens")
    .update({ pct_avanco: pctResultante, atualizado_em: new Date().toISOString() })
    .eq("id", itemId)
    .eq("obra_id", obraId)
    .eq("tenant_id", tenantId);
  if (errUpdate) {
    if (ehTabelaAusente(errUpdate)) {
      return NextResponse.json({ error: AVISO_ITENS_PENDENTE, migracao_pendente: true }, { status: 503 });
    }
    return NextResponse.json({ error: errUpdate.message }, { status: 500 });
  }

  // ── 4) INSERE a medição imutável (append-only). Sem a migração E7c, degrada honestamente. ──
  const linha: Record<string, unknown> = {
    obra_id: obraId,
    item_id: itemId,
    tenant_id: tenantId,
    quantidade_realizada: quantidadeRealizada,
    pct_avanco_resultante: pctResultante,
    foto_url: fotoUrl,
    video_url: videoUrl,
    observacao,
    responsavel_nome: responsavelNome,
    // AUDITORIA (Fase 3a — nada-se-perde): registra QUEM mediu (usuário real), não só o papel.
    // g.ctx tem userId/authId/role (não há userEmail no contexto CRM). Fallback p/ role e, em último
    // caso, "humano" — nunca null. A trilha append-only precisa do autor real.
    criado_por: g.ctx.userId ?? g.ctx.role ?? "humano",
  };
  if (dataMedicao) linha.data = dataMedicao;

  const { data: medicao, error: errMedicao } = await supabase
    .from("hub_obra_medicoes")
    .insert(linha)
    .select(SELECT_MEDICAO)
    .single();

  if (errMedicao) {
    // Tabela ausente (migração E7c pendente): o pct do item JÁ foi salvo (passo 3). Resposta honesta:
    // o avanço entrou, o registro formal/append-only entra após a migração.
    if (ehTabelaAusente(errMedicao)) {
      // HONESTIDADE (Fase 3a): sem a tabela, foto_url/observacao foram DESCARTADOS. Não mentir que
      // "tudo foi salvo" — avisar EXPLICITAMENTE que só o avanço entrou e a evidência ainda NÃO ficou
      // registrada (até aplicar a migração E7c). Só alertamos sobre a perda quando houve o que perder.
      const evidenciaDescartada = Boolean(fotoUrl || videoUrl || observacao);
      const aviso = evidenciaDescartada
        ? "Só o AVANÇO do item foi salvo. A foto/vídeo e/ou observação NÃO foram registradas " +
          "(medição formal pendente da migração E7c — janela do dono). Reenvie a evidência após a migração."
        : AVISO_PENDENTE;
      return NextResponse.json(
        {
          data: null,
          pct_avanco_resultante: pctResultante,
          medicao_registrada: false,
          evidencia_descartada: evidenciaDescartada,
          migracao_pendente: true,
          aviso,
        },
        { status: 200 }
      );
    }
    return NextResponse.json({ error: errMedicao.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      data: medicao,
      pct_avanco_resultante: pctResultante,
      medicao_registrada: true,
      migracao_pendente: false,
    },
    { status: 201 }
  );
}
