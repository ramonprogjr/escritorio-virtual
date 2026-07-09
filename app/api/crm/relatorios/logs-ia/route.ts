import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmOwner } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";

/**
 * Relatório dos LOGS da IA — SÓ o owner extrai (spec do dono). Read-only. Junta, por entidade e tenant:
 * (a) hub_atividades ocultos/arquivados (categoria='log' OU arquivado), (b) hub_eventos, (c) hub_acoes_ia
 * (IA, com tokens/custo) quando a entidade é um lead — via lead_id→tenant (fail-closed). A própria extração
 * é AUDITADA (hub_eventos 'relatorio_logs_extraido'). Rate-limited (regra da casa).
 */

const ENTIDADES = new Set(["lead", "pessoa", "empresa", "negocio", "fornecedor", "especialista", "obra"]);

type LinhaRelatorio = {
  quando: string | null;
  fonte: string;
  quem: string;
  o_que: string;
  detalhe: string | null;
};

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // SÓ owner.
  const g = await requireCrmOwner(request);
  if ("error" in g) return g.error;

  const limite = requireIaRateLimit(`relatorio-logs:${g.ctx.tenantId}`, 10);
  if (limite) return limite;

  const url = new URL(request.url);
  const entity_type = (url.searchParams.get("entity_type") || "").trim();
  const entity_id = (url.searchParams.get("entity_id") || "").trim();
  if (!ENTIDADES.has(entity_type) || !entity_id) {
    return NextResponse.json({ error: "entity_type/entity_id inválidos" }, { status: 400 });
  }

  const supabase = crmDb();
  const linhas: LinhaRelatorio[] = [];

  // (a) hub_atividades: logs + arquivados desta entidade (o que some da timeline).
  const { data: ativs } = await supabase
    .from("hub_atividades")
    .select("tipo, descricao, feito_por, feito_por_tipo, categoria, arquivado_em, arquivado_por, criado_em")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .or("categoria.eq.log,arquivado_em.not.is.null")
    .order("criado_em", { ascending: false })
    .limit(500);
  for (const a of (ativs ?? []) as Record<string, unknown>[]) {
    linhas.push({
      quando: (a.criado_em as string) ?? null,
      fonte: a.arquivado_em ? "registro arquivado" : "log",
      quem: String(a.feito_por_tipo ?? "") === "ia" ? "IA" : String(a.feito_por ?? "—"),
      o_que: String(a.tipo ?? ""),
      detalhe: a.arquivado_em
        ? `arquivado por ${String(a.arquivado_por ?? "—")}: ${String(a.descricao ?? "")}`.slice(0, 500)
        : String(a.descricao ?? "").slice(0, 500),
    });
  }

  // (b) hub_eventos desta entidade (keystone/auditoria).
  const { data: eventos } = await supabase
    .from("hub_eventos")
    .select("event_type, ator, payload, ts")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .order("ts", { ascending: false })
    .limit(500);
  for (const e of (eventos ?? []) as Record<string, unknown>[]) {
    linhas.push({
      quando: (e.ts as string) ?? null,
      fonte: "evento",
      quem: String(e.ator ?? "—"),
      o_que: String(e.event_type ?? ""),
      detalhe: (() => {
        try {
          return JSON.stringify(e.payload).slice(0, 500);
        } catch {
          return null;
        }
      })(),
    });
  }

  // (c) hub_acoes_ia (tokens/custo) — só p/ lead, via lead_id, com prova de tenant (fail-closed).
  if (entity_type === "lead") {
    const { data: lead } = await supabase
      .from("hub_leads_crm")
      .select("id, tenant_id")
      .eq("id", entity_id)
      .maybeSingle();
    if (lead && String((lead as Record<string, unknown>).tenant_id ?? "") === g.ctx.tenantId) {
      const { data: acoes } = await supabase
        .from("hub_acoes_ia")
        .select("agente_slug, tipo, descricao, tokens_usados, custo_brl, sucesso, erro, criado_em")
        .eq("lead_id", entity_id)
        .order("criado_em", { ascending: false })
        .limit(500);
      for (const ac of (acoes ?? []) as Record<string, unknown>[]) {
        linhas.push({
          quando: (ac.criado_em as string) ?? null,
          fonte: "IA (execução)",
          quem: String(ac.agente_slug ?? "IA"),
          o_que: String(ac.tipo ?? ""),
          detalhe: `${String(ac.descricao ?? "")} · tokens ${ac.tokens_usados ?? "—"} · R$ ${ac.custo_brl ?? "—"}${ac.sucesso === false ? ` · ERRO: ${String(ac.erro ?? "")}` : ""}`.slice(0, 500),
        });
      }
    }
  }

  linhas.sort((a, b) => String(b.quando ?? "").localeCompare(String(a.quando ?? "")));

  // Auditoria da própria extração (imutável — quem olhou os logs também deixa trilha).
  try {
    await supabase.from("hub_eventos").insert({
      event_type: "relatorio_logs_extraido",
      entity_type,
      entity_id,
      ator: "owner",
      ator_id: g.ctx.userId ?? null,
      payload: { total: linhas.length },
      tenant_id: g.ctx.tenantId,
    });
  } catch {
    /* best-effort */
  }

  return NextResponse.json({ data: linhas.slice(0, 800) });
}
