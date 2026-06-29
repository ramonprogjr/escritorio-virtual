import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

/**
 * GET /api/crm/arquitetura/fila — a FILA "Em aprovação" do cockpit do arquiteto.
 *
 * Entregáveis enviados ao cliente e ainda sem resposta (tipo='fase' AND
 * aprovacao_status='enviado'), do tenant do caller, ordenados por tempo de espera
 * (pior no topo). O tempo usa aprovacao_enviado_em (A1) e cai em atualizado_em
 * quando a coluna SLA ainda não existe (degrada, nunca quebra).
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;

  const SELECT_SLA =
    "id, projeto_id, nome, aprovacao_status, entregavel_url, aprovacao_enviado_em, atualizado_em";
  const SELECT_BASE = "id, projeto_id, nome, aprovacao_status, entregavel_url, atualizado_em";

  async function buscar(select: string, comSla: boolean) {
    let q = supabase
      .from("hub_projetos_fases")
      .select(select)
      // tenant SEMPRE da sessão; .eq puro (nunca OR is.null).
      .eq("tenant_id", tenantId)
      .eq("tipo", "fase")
      .eq("aprovacao_status", "enviado");
    q = comSla
      ? q.order("aprovacao_enviado_em", { ascending: true, nullsFirst: true })
      : q.order("atualizado_em", { ascending: true });
    return q.limit(100);
  }

  let comSla = true;
  let { data, error } = await buscar(SELECT_SLA, true);
  if (error && isMissingPgColumn(error)) {
    comSla = false;
    ({ data, error } = await buscar(SELECT_BASE, false));
  }

  // Pré-A0 (sem coluna tipo/aprovacao_status) → fila vazia, sem erro.
  if (error) {
    if (isMissingPgColumn(error)) {
      return NextResponse.json({ data: [], total: 0, migracao_pendente: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fases = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (fases.length === 0) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Enriquecimento: título/código/cliente do projeto (join leve, escopado por tenant).
  const projetoIds = Array.from(new Set(fases.map((f) => String(f.projeto_id)).filter(Boolean)));
  const projMap = new Map<string, { titulo: string; codigo: string | null; cliente_nome: string | null }>();
  if (projetoIds.length > 0) {
    const { data: projs } = await supabase
      .from("hub_projetos")
      .select("id, titulo, codigo, cliente_nome")
      .eq("tenant_id", tenantId)
      .in("id", projetoIds);
    for (const p of projs ?? []) {
      projMap.set(String(p.id), {
        titulo: String(p.titulo ?? "Projeto"),
        codigo: (p.codigo as string) ?? null,
        cliente_nome: (p.cliente_nome as string) ?? null,
      });
    }
  }

  const itens = fases.map((f) => {
    const enviadoEm =
      comSla && f.aprovacao_enviado_em ? String(f.aprovacao_enviado_em) : String(f.atualizado_em ?? "");
    const proj = projMap.get(String(f.projeto_id));
    return {
      fase_id: String(f.id),
      projeto_id: String(f.projeto_id),
      entregavel: String(f.nome ?? "Entregável"),
      entregavel_url: (f.entregavel_url as string) ?? null,
      projeto_titulo: proj?.titulo ?? "Projeto",
      projeto_codigo: proj?.codigo ?? null,
      cliente_nome: proj?.cliente_nome ?? null,
      enviado_em: enviadoEm || null,
      dias_esperando: enviadoEm ? diasDesde(enviadoEm) : null,
    };
  });

  return NextResponse.json({ data: itens, total: itens.length });
}

/** Dias inteiros (>=0) desde uma data ISO até hoje. null se inválida. */
function diasDesde(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const base = new Date();
  const ms = base.getTime() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
