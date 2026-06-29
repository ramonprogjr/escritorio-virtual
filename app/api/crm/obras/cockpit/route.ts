/**
 * GET /api/crm/obras/cockpit — agregação do cockpit "Hoje" + carteira (E1).
 * POST /api/crm/obras/cockpit — ação direta de baixo risco: concluir uma fase do
 *   cronograma (`concluida=true`). Demais ações de prazo (reprogramar) passam pelo
 *   gate dourado do copiloto, não por aqui.
 *
 * Auth: requireCrmSessao + g.ctx.tenantId (SEMPRE da sessão; nunca body/header).
 * Tenant: filtro `.eq("tenant_id")` PURO em toda query; guarda de posse 404 (NULL =
 * não pertence) na escrita. Tolerante: configErr → 503; tabela ausente → degrada.
 */

import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { aggregateCockpit } from "@/lib/crm/cockpit-aggregate";

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const negocioId = request.nextUrl.searchParams.get("negocio_id") || null;

  try {
    const payload = await aggregateCockpit(crmDb(), tenantId, { negocioId });
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (e) {
    // Falha-segura: o cockpit nunca derruba a tela — devolve estrutura vazia coerente.
    const msg = e instanceof Error ? e.message : "Falha ao montar o cockpit.";
    return NextResponse.json(
      {
        carteira: [],
        contadores: {
          obras: 0,
          pedemAtencao: 0,
          atrasados: 0,
          proximos15: 0,
          bloqueios: 0,
          pagamentosAVencer: null,
        },
        hoje: { atrasados: [], proximos15: [], bloqueios: [] },
        resumo_ia: { atrasados_ids: [], bloqueios_ids: [], total_decisoes: 0, obras_criticas: 0 },
        flags: { temCronograma: false, temFinanceiro: false, temOcorrencias: false },
        aviso: msg,
      },
      { status: 200 }
    );
  }
}

/**
 * Ação direta: marcar fase do cronograma como concluída.
 * Body: { acao: "concluir_fase", fase_id: string }
 * Guarda de posse: a fase só é escrita se pertencer ao tenant da sessão (404 caso NULL/outro).
 */
export async function POST(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const acao = String(body.acao || "").trim();
  if (acao !== "concluir_fase") {
    return NextResponse.json({ error: "Ação não suportada." }, { status: 400 });
  }

  const faseId = typeof body.fase_id === "string" ? body.fase_id.trim() : "";
  if (!faseId) return NextResponse.json({ error: "fase_id obrigatório." }, { status: 400 });

  const tenantId = g.ctx.tenantId;
  const supabase = crmDb();

  // Guarda de posse: confirma que a fase é deste tenant antes de escrever.
  // crmDb() é service-role e bypassa RLS → o filtro de tenant é a única barreira.
  const { data: fase, error: lerErr } = await supabase
    .from("hub_obras_cronograma")
    .select("id, tenant_id, concluida, fase")
    .eq("id", faseId)
    .maybeSingle();

  if (lerErr) return NextResponse.json({ error: lerErr.message }, { status: 500 });
  // tenant_id NULL não pertence a ninguém → 404 (não vaza existência cross-tenant).
  if (!fase || fase.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Fase não encontrada." }, { status: 404 });
  }

  const { error: upErr } = await supabase
    .from("hub_obras_cronograma")
    .update({ concluida: true })
    .eq("id", faseId)
    .eq("tenant_id", tenantId); // defesa em profundidade na escrita

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, fase_id: faseId, fase: fase.fase, concluida: true });
}
