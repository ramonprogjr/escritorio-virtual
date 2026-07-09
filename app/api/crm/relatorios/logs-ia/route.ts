import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmOwner } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";
import { resolverNomesUsuarios } from "@/lib/crm/resolver-nomes-usuarios";
import { ehUuid } from "@/lib/crm/permissao-registro";

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
  const fontesFalhas: string[] = []; // honestidade: quais fontes não puderam ser lidas (relatório parcial)

  // (a) hub_atividades: logs + arquivados desta entidade (o que some da timeline).
  const { data: ativs, error: errAtivs } = await supabase
    .from("hub_atividades")
    .select("tipo, descricao, feito_por, feito_por_tipo, categoria, arquivado_em, arquivado_por, criado_em")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .or("categoria.eq.log,arquivado_em.not.is.null")
    .order("criado_em", { ascending: false })
    .limit(500);
  if (errAtivs) {
    console.error("[relatorio-logs ativs]", errAtivs.message);
    fontesFalhas.push("registros");
  }
  const ativRows = (ativs ?? []) as Record<string, unknown>[];
  // Nomes (feito_por + arquivado_por são UUID) → nome real; nunca expor o código cru, nem ao owner.
  const nomes = await resolverNomesUsuarios(supabase, [
    ...ativRows.map((a) => a.feito_por as string),
    ...ativRows.map((a) => a.arquivado_por as string),
  ]);
  /**
   * UUID → nome resolvido (ou "Equipe" — nunca o código cru, nem para o owner).
   * Não-UUID é rótulo legível (nome legado "Ana Silva", ou ator "owner"/"ia") e passa direto.
   */
  const nomeDe = (v: unknown): string => {
    const s = String(v ?? "").trim();
    if (!s) return "—";
    if (ehUuid(s)) return nomes.get(s) || "Equipe";
    return s;
  };
  for (const a of ativRows) {
    linhas.push({
      quando: (a.criado_em as string) ?? null,
      fonte: a.arquivado_em ? "registro arquivado" : "log",
      quem: String(a.feito_por_tipo ?? "") === "ia" ? "IA" : nomeDe(a.feito_por),
      o_que: String(a.tipo ?? ""),
      detalhe: a.arquivado_em
        ? `arquivado por ${nomeDe(a.arquivado_por)}: ${String(a.descricao ?? "")}`.slice(0, 500)
        : String(a.descricao ?? "").slice(0, 500),
    });
  }

  // (b) hub_eventos desta entidade (keystone/auditoria).
  const { data: eventos, error: errEventos } = await supabase
    .from("hub_eventos")
    .select("event_type, ator, payload, ts")
    .eq("entity_type", entity_type)
    .eq("entity_id", entity_id)
    .eq("tenant_id", g.ctx.tenantId)
    .order("ts", { ascending: false })
    .limit(500);
  if (errEventos) {
    console.error("[relatorio-logs eventos]", errEventos.message);
    fontesFalhas.push("eventos");
  }
  const eventoRows = (eventos ?? []) as Record<string, unknown>[];
  // hub_eventos.ator às vezes guarda o userId cru (ex.: rotas de tarefas) — resolve antes de exibir.
  const nomesAtor = await resolverNomesUsuarios(supabase, eventoRows.map((e) => e.ator as string));
  for (const [k, v] of nomesAtor) nomes.set(k, v);
  for (const e of eventoRows) {
    linhas.push({
      quando: (e.ts as string) ?? null,
      fonte: "evento",
      quem: nomeDe(e.ator),
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
    const { data: lead, error: errLead } = await supabase
      .from("hub_leads_crm")
      .select("id, tenant_id")
      .eq("id", entity_id)
      .maybeSingle();
    if (errLead) {
      console.error("[relatorio-logs lead]", errLead.message);
      fontesFalhas.push("acoes_ia");
    }
    if (lead && String((lead as Record<string, unknown>).tenant_id ?? "") === g.ctx.tenantId) {
      const { data: acoes, error: errAcoes } = await supabase
        .from("hub_acoes_ia")
        .select("agente_slug, tipo, descricao, tokens_usados, custo_brl, sucesso, erro, criado_em")
        .eq("lead_id", entity_id)
        .order("criado_em", { ascending: false })
        .limit(500);
      if (errAcoes) {
        console.error("[relatorio-logs acoes]", errAcoes.message);
        fontesFalhas.push("acoes_ia");
      }
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

  // Auditoria da própria extração (imutável — quem olhou os logs também deixa trilha). Não engole falha
  // em silêncio: a UI promete que a extração fica auditada, então uma falha aqui PRECISA aparecer no log.
  const { error: errAudit } = await supabase.from("hub_eventos").insert({
    event_type: "relatorio_logs_extraido",
    entity_type,
    entity_id,
    ator: "owner",
    ator_id: g.ctx.userId ?? null,
    payload: { total: linhas.length, fontes_falhas: fontesFalhas },
    tenant_id: g.ctx.tenantId,
  });
  if (errAudit) console.error("[relatorio-logs auditoria]", errAudit.message);

  return NextResponse.json({
    data: linhas.slice(0, 800),
    parcial: fontesFalhas.length > 0,
    ...(fontesFalhas.length > 0 ? { fontes_falhas: fontesFalhas } : {}),
  });
}
