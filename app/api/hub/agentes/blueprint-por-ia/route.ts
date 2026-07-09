import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";
import { registrarConsumoIA, assertSaldoAntesDoLLM } from "@/lib/ia/metering";
import { gerarBlueprintAgente } from "@/lib/ia/gerar-blueprint-agente";

/**
 * F6 — "criar agente com IA": o dono descreve (texto), a IA devolve um BLUEPRINT validado contra os
 * catálogos reais (ferramenta/cargo alucinado descartado). SÓ gera — não cria o agente (o cliente aplica
 * depois pelo caminho do wizard). requireCrmGestor + rate-limit + gate de saldo + metering.
 */
export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "servico_indisponivel" }, { status: 503 });
  }

  const g = await requireCrmGestor(req);
  if ("error" in g) return g.error;

  const limite = requireIaRateLimit(`blueprint-agente:${g.ctx.tenantId}`, 5);
  if (limite) return limite;

  const gate = await assertSaldoAntesDoLLM(g.ctx.tenantId);
  if (!gate.permitido) return NextResponse.json({ error: "sem_creditos" }, { status: 402 });

  let body: { descricao?: string };
  try {
    body = (await req.json()) as { descricao?: string };
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }
  const descricao = String(body.descricao ?? "").trim();
  if (descricao.length < 8) {
    return NextResponse.json({ error: "descricao_curta" }, { status: 400 });
  }

  const supabase = db();
  // Cargos são catálogo/master-data (global, sem tenant). Só os ativos.
  const { data: cargosRows } = await supabase
    .from("hub_cargos_catalogo")
    .select("slug, descricao_curta")
    .eq("ativo", true)
    .limit(200);
  const cargos = (cargosRows ?? [])
    .map((c) => ({ slug: String((c as Record<string, unknown>).slug ?? ""), desc: String((c as Record<string, unknown>).descricao_curta ?? "") }))
    .filter((c) => c.slug);

  const r = await gerarBlueprintAgente({ descricao: descricao.slice(0, 4000), cargos });

  if (r.ok) {
    void registrarConsumoIA({
      tenantId: g.ctx.tenantId,
      usuarioId: g.ctx.userId ?? null,
      origem: "blueprint_agente_ia",
      modelo: r.modelo,
      tokensEntrada: r.inputTokens,
      tokensSaida: r.outputTokens,
      refTipo: "agente_blueprint",
    });
    return NextResponse.json({ ok: true, blueprint: r.blueprint, avisos: r.avisos });
  }

  if (r.error === "descricao_vazia") {
    return NextResponse.json({ error: "descricao_curta" }, { status: 400 });
  }
  console.error("[blueprint-por-ia] IA:", r.error);
  return NextResponse.json({ error: "ia_indisponivel" }, { status: 502 });
}
