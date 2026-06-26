import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { tenantScopeOrFilter } from "@/lib/tenant-default";

type EventoRow = {
  event_type: string;
  fornecedor_id: string | null;
  payload: Record<string, unknown> | null;
};

type FornecedorMetricas = {
  fornecedor_id: string;
  nome: string | null;
  recebidos: number;
  recusados: number;
  bloqueios: number;
};

/**
 * Auditor da rede (C.1): agrega `hub_eventos` em KPIs por fornecedor e geral.
 * É a base do que a IA do Hub usa para cobrar SLA/KPI/pendência. Read-only.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const { data, error } = await crmDb()
    .from("hub_eventos")
    .select("event_type, fornecedor_id, payload")
    .or(tenantScopeOrFilter(g.ctx.tenantId))
    .order("ts", { ascending: false })
    .limit(2000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const eventos = (data ?? []) as EventoRow[];
  const geral = { distribuidos: 0, recusados: 0, recolocados: 0, entregas: 0, bloqueios: 0, liberacoes: 0, sem_proximo: 0 };
  const porForn = new Map<string, FornecedorMetricas>();

  const get = (id: string, nome: string | null): FornecedorMetricas => {
    let f = porForn.get(id);
    if (!f) {
      f = { fornecedor_id: id, nome, recebidos: 0, recusados: 0, bloqueios: 0 };
      porForn.set(id, f);
    }
    if (nome && !f.nome) f.nome = nome;
    return f;
  };

  for (const e of eventos) {
    const nome = (e.payload?.parceiro_nome as string | undefined) ?? null;
    const fid = e.fornecedor_id;
    switch (e.event_type) {
      case "lead_distribuido":
        geral.distribuidos++;
        if (fid) get(fid, nome).recebidos++;
        break;
      case "lead_recolocado":
        geral.recolocados++;
        if (fid) get(fid, nome).recebidos++;
        break;
      case "lead_recusado":
        geral.recusados++;
        if (fid) get(fid, nome).recusados++;
        break;
      case "entrega_gerada":
        geral.entregas++;
        break;
      case "gate_pendencia_bloqueio":
        geral.bloqueios++;
        if (fid) get(fid, nome).bloqueios++;
        break;
      case "gate_liberado":
        geral.liberacoes++;
        break;
      case "lead_sem_proximo":
        geral.sem_proximo++;
        break;
    }
  }

  const base = [...porForn.values()].sort((a, b) => b.recebidos - a.recebidos).slice(0, 8);

  // Enriquecimento C.1b: junta status financeiro do fornecedor + computa aderência (IAH)
  // e a cobrança sugerida. Aderência alta = mais leads (flywheel de mérito).
  const ids = base.map((f) => f.fornecedor_id);
  const parceirosById = new Map<string, { nome: string | null; status_financeiro: string }>();
  if (ids.length) {
    const { data: ps } = await crmDb()
      .from("hub_parceiros")
      .select("id, nome, status_financeiro")
      .in("id", ids);
    for (const p of ps ?? []) {
      parceirosById.set(p.id as string, {
        nome: (p.nome as string) ?? null,
        status_financeiro: (p.status_financeiro as string) ?? "em_dia",
      });
    }
  }
  const fornecedores = base.map((f) => {
    const p = parceirosById.get(f.fornecedor_id);
    const status = p?.status_financeiro ?? "em_dia";
    const aderencia = Math.max(
      0,
      Math.min(
        100,
        50 + f.recebidos * 8 - f.recusados * 15 - f.bloqueios * 20 -
          (status === "bloqueado" ? 25 : status === "pendente" ? 10 : 0)
      )
    );
    let cobranca: string | null = null;
    if (status === "bloqueado") cobranca = "Pendência financeira — bloqueado para receber leads";
    else if (status === "pendente") cobranca = "Pendência financeira em aberto";
    else if (f.recusados >= 2 && f.recusados >= f.recebidos) cobranca = "Alta taxa de recusa — avaliar aderência";
    return { ...f, nome: p?.nome ?? f.nome, status_financeiro: status, aderencia, cobranca };
  });

  // Alertas do auditor (regras simples sobre os KPIs).
  const alertas: string[] = [];
  if (geral.bloqueios > 0) alertas.push(`${geral.bloqueios} tentativa(s) de envio barradas por pendência financeira.`);
  if (geral.sem_proximo > 0) alertas.push(`${geral.sem_proximo} lead(s) sem fornecedor elegível — avaliar cobertura da rede.`);
  for (const f of fornecedores) {
    if (f.recusados >= 2 && f.recusados >= f.recebidos) {
      alertas.push(`${f.nome ?? "Fornecedor"} recusou ${f.recusados} lead(s) — avaliar aderência.`);
    }
  }

  return NextResponse.json({ geral, fornecedores, alertas });
}
