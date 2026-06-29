import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial, requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";
import { gerarCodigoProjeto } from "@/lib/crm/projeto-codigo";
import { ESTAGIO_PROJETO_INICIAL } from "@/lib/crm/projeto-funil-defaults";

// Colunas A0 (existem só após a migração). O SELECT cai para o legado se faltarem.
const SELECT_A0 =
  "id, codigo, titulo, status, estagio, pipeline_id, responsavel_id, tipologia, area_m2, " +
  "cliente_pessoa_id, cliente_empresa_id, cliente_nome, proxima_entrega, proxima_entrega_em, " +
  "aprovacao_status, negocio_id, obra_id, criado_em, atualizado_em";
const SELECT_LEGADO = "id, codigo, titulo, status, negocio_id, obra_id, criado_em, atualizado_em";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const negocioId = request.nextUrl.searchParams.get("negocio_id");
  const estagio = request.nextUrl.searchParams.get("estagio");
  // pipeline_id: cada aba (pipeline) mostra só seus projetos (A0-DESIGN.md). Opcional.
  const pipelineId = request.nextUrl.searchParams.get("pipeline_id");

  function montar(select: string, comEstagio: boolean) {
    let q = crmDb()
      .from("hub_projetos")
      .select(select, { count: "exact" })
      // AUDITORIA-FIX (vazamento legado): SÓ o tenant do caller. O `,tenant_id.is.null`
      // anterior expunha projetos órfãos (causa-raiz fechada no backfill da migração A0).
      .eq("tenant_id", tenantId)
      .order("criado_em", { ascending: false })
      .limit(100);
    if (negocioId) q = q.eq("negocio_id", negocioId);
    if (pipelineId) q = q.eq("pipeline_id", pipelineId);
    if (comEstagio && estagio) q = q.eq("estagio", estagio);
    return q;
  }

  let { data, error, count } = await montar(SELECT_A0, true);

  // Tolerância: migração A0 não aplicada → cai no SELECT legado (sem filtro de estagio).
  let legado = false;
  if (error && isMissingPgColumn(error)) {
    legado = true;
    ({ data, error, count } = await montar(SELECT_LEGADO, false));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;

  // Contagem por estágio (todo o pipeline, não só os carregados): usa o estagio,
  // ou mapeia o status legado se a coluna estagio ainda não existir.
  const estagioCounts: Record<string, number> = {};
  for (const r of rows) {
    const key = legado
      ? mapearStatusLegadoParaEstagio(String(r.status ?? ""))
      : String(r.estagio ?? ESTAGIO_PROJETO_INICIAL);
    estagioCounts[key] = (estagioCounts[key] ?? 0) + 1;
  }

  return NextResponse.json({
    data: rows,
    total: count ?? rows.length,
    estagio_counts: estagioCounts,
    migracao_pendente: legado,
  });
}

/** status legado/relaxado → estagio do funil (espelha o backfill da migração A0). */
function mapearStatusLegadoParaEstagio(status: string): string {
  const s = status.trim().toLowerCase();
  const validos = ["briefing", "estudo", "anteprojeto", "executivo", "aprovacao", "entregue", "arquivado"];
  if (validos.includes(s)) return s;
  if (s === "desenvolvimento") return "estudo";
  if (s === "aprovacao_cliente") return "aprovacao";
  if (s === "concluido") return "entregue";
  if (s === "cancelado") return "arquivado";
  return ESTAGIO_PROJETO_INICIAL;
}

export async function POST(request: NextRequest) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  const tipologia =
    typeof body.tipologia === "string" && body.tipologia.trim() ? body.tipologia.trim() : null;
  const clienteNome =
    typeof body.cliente_nome === "string" && body.cliente_nome.trim() ? body.cliente_nome.trim() : null;

  // Título: explícito, ou auto "Projeto — <Cliente>" / "Projeto — <Tipologia>" (IA-first/Click-and-Go).
  let titulo = String(body.titulo || "").trim();
  if (!titulo) {
    titulo = clienteNome
      ? `Projeto — ${clienteNome}`
      : tipologia
        ? `Projeto — ${tipologia.charAt(0).toUpperCase()}${tipologia.slice(1)}`
        : "Projeto";
  }

  // Só tipologia OU título é necessário (tolerante). Sem nenhum dos dois ainda funciona ("Projeto").
  // Idempotência leve (anti double-tap): mesmo título+tenant nos últimos 60s.
  {
    const desde = new Date(Date.now() - 60_000).toISOString();
    const { data: recente } = await supabase
      .from("hub_projetos")
      .select("id, codigo, titulo")
      .eq("tenant_id", tenantId)
      .eq("titulo", titulo)
      .gte("criado_em", desde)
      .limit(1)
      .maybeSingle();
    if (recente?.id) {
      return NextResponse.json({ data: recente, idempotente: true }, { status: 200 });
    }
  }

  // Se vier de um negócio que JÁ tem projeto, devolve o existente (não duplica).
  const negocioId = typeof body.negocio_id === "string" && body.negocio_id ? body.negocio_id : null;
  if (negocioId) {
    const { data: existente } = await supabase
      .from("hub_projetos")
      .select("id, codigo, titulo")
      .eq("tenant_id", tenantId)
      .eq("negocio_id", negocioId)
      .limit(1)
      .maybeSingle();
    if (existente?.id) {
      return NextResponse.json({ data: existente, ja_existe: true }, { status: 200 });
    }
  }

  // AUDITORIA-FIX (P0): código ATÔMICO e POR TENANT (era COUNT(*) global → vazava entre tenants).
  const codigo = await gerarCodigoProjeto(supabase, tenantId);

  const estagio =
    typeof body.estagio === "string" && body.estagio.trim() ? body.estagio.trim() : ESTAGIO_PROJETO_INICIAL;

  const areaM2 =
    typeof body.area_m2 === "number" && Number.isFinite(body.area_m2)
      ? body.area_m2
      : typeof body.area_m2 === "string" && body.area_m2.trim() && !Number.isNaN(Number(body.area_m2))
        ? Number(body.area_m2)
        : null;

  // Linha A0 completa. Se a migração não foi aplicada, cai para a linha legada.
  const rowA0: Record<string, unknown> = {
    codigo,
    titulo,
    status: estagio, // compat: status espelha estagio até A1 remover a dualidade.
    estagio,
    pipeline_id: typeof body.pipeline_id === "string" && body.pipeline_id ? body.pipeline_id : null,
    responsavel_id:
      typeof body.responsavel_id === "string" && body.responsavel_id ? body.responsavel_id : null,
    tipologia,
    area_m2: areaM2,
    cliente_pessoa_id:
      typeof body.cliente_pessoa_id === "string" && body.cliente_pessoa_id ? body.cliente_pessoa_id : null,
    cliente_empresa_id:
      typeof body.cliente_empresa_id === "string" && body.cliente_empresa_id ? body.cliente_empresa_id : null,
    cliente_nome: clienteNome,
    proxima_entrega:
      typeof body.proxima_entrega === "string" && body.proxima_entrega.trim() ? body.proxima_entrega.trim() : null,
    proxima_entrega_em:
      typeof body.proxima_entrega_em === "string" && body.proxima_entrega_em.trim()
        ? body.proxima_entrega_em.trim()
        : null,
    aprovacao_status: "sem_aprovacao",
    negocio_id: negocioId,
    obra_id: typeof body.obra_id === "string" && body.obra_id ? body.obra_id : null,
    tenant_id: tenantId,
  };

  let projeto: Record<string, unknown> | null = null;
  let insErr: { message?: string } | null = null;

  {
    const { data, error } = await supabase.from("hub_projetos").insert(rowA0).select(SELECT_A0).single();
    projeto = data as Record<string, unknown> | null;
    insErr = error;
  }

  // Tolerância: colunas A0 ausentes → insere o subconjunto legado.
  let migracaoPendente = false;
  if (insErr && isMissingPgColumn(insErr)) {
    migracaoPendente = true;
    const rowLegado = {
      codigo,
      titulo,
      status: mapearEstagioParaStatusLegado(estagio),
      negocio_id: negocioId,
      obra_id: typeof body.obra_id === "string" && body.obra_id ? body.obra_id : null,
      tenant_id: tenantId,
    };
    const { data, error } = await supabase
      .from("hub_projetos")
      .insert(rowLegado)
      .select(SELECT_LEGADO)
      .single();
    projeto = data as Record<string, unknown> | null;
    insErr = error;
  }

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  if (!projeto?.id) return NextResponse.json({ error: "Falha ao criar projeto." }, { status: 500 });

  return NextResponse.json(
    { data: projeto, migracao_pendente: migracaoPendente },
    { status: 201 }
  );
}

/** estagio do funil → status que o CHECK legado aceita (tolerância pré-migração). */
function mapearEstagioParaStatusLegado(estagio: string): string {
  const e = estagio.trim().toLowerCase();
  if (e === "estudo" || e === "anteprojeto" || e === "executivo") return "desenvolvimento";
  if (e === "aprovacao") return "aprovacao_cliente";
  if (e === "entregue") return "concluido";
  if (e === "arquivado") return "cancelado";
  return "briefing";
}
