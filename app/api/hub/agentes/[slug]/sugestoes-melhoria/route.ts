import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";
import { registrarConsumoIA, assertSaldoAntesDoLLM } from "@/lib/ia/metering";
import { sugerirMelhoriasAgente } from "@/lib/hub/sugerir-melhorias-agente";

/**
 * IA VIVA — POST: a IA do sistema analisa o agente e devolve sugestões priorizadas de melhoria.
 * requireCrmSessao + isolamento de tenant + rate-limit + gate de saldo (hard-cap) + metering.
 * Só leitura do agente; nunca altera nada nem expõe segredos (o lib usa um SELECT sem tokens uazapi).
 * Erros internos são logados no servidor e respondidos com códigos estáveis (sem vazar detalhe cru).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "servico_indisponivel" }, { status: 503 });
  }

  const g = await requireCrmSessao(req);
  if ("error" in g) return g.error;

  const limite = requireIaRateLimit(`sugestoes-agente:${g.ctx.tenantId}`, 6);
  if (limite) return limite;

  // Gate de saldo (chokepoint LLM — regra da casa). Modo sombra por padrão (fail-open); bloqueia só com IA_HARD_CAP=on.
  const gate = await assertSaldoAntesDoLLM(g.ctx.tenantId);
  if (!gate.permitido) return NextResponse.json({ error: "sem_creditos" }, { status: 402 });

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  // Isolamento: só analisa agente do tenant do caller (service-role bypassa RLS → checagem explícita).
  const { data: alvo, error: alvoErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, tenant_id")
    .eq("agente_slug", slug)
    .maybeSingle();
  if (alvoErr) {
    console.error("[sugestoes-melhoria] load agente:", alvoErr.message);
    return NextResponse.json({ error: "erro_interno" }, { status: 500 });
  }
  // Fail-closed: tenant NULL = não encontrado (não é master-data global; todos os agentes têm tenant_id).
  const t = (alvo as { tenant_id?: string | null } | null)?.tenant_id;
  if (!alvo || String(t ?? "") !== g.ctx.tenantId) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  const r = await sugerirMelhoriasAgente(supabase, slug, g.ctx.tenantId);

  // Metering best-effort SEMPRE que houve chamada paga ao LLM (mesmo com parse falho) — espelha o custo real.
  if (typeof r.inputTokens === "number" && typeof r.outputTokens === "number" && r.modelo) {
    void registrarConsumoIA({
      tenantId: g.ctx.tenantId,
      usuarioId: g.ctx.userId ?? null,
      origem: "sugestoes_melhoria_agente",
      modelo: r.modelo,
      tokensEntrada: r.inputTokens,
      tokensSaida: r.outputTokens,
      refTipo: "agente",
      refId: slug,
    });
  }

  if (!r.ok) {
    if (r.error === "agente_nao_encontrado") {
      return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
    }
    if (r.error === "sem_sugestoes") {
      return NextResponse.json({ error: "sem_sugestoes" }, { status: 200 });
    }
    console.error("[sugestoes-melhoria] IA:", r.error);
    return NextResponse.json({ error: "ia_indisponivel" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, sugestoes: r.sugestoes });
}
