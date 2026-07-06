import { crmDb as db } from "@/lib/crm/supabase-server";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

/**
 * POST /api/hub/ciclos/executar
 *
 * Endpoint server-side para "Executar agora" de um ciclo.
 * E-B10: substitui o disparo direto do browser que expunha o CRON_SECRET hardcoded
 * como query param no bundle client. Aqui o CRON_SECRET é lido do ENV server-side
 * e nunca viaja ao browser.
 *
 * Body: { ciclo_id: string }
 * Resolve agente_slug + nome do runner a partir do ciclo_id (tabela hub_ciclos_ia).
 * Chama internamente /api/ciclos/{agente}?ciclo=...&hub_ciclo_id=... com Bearer do ENV.
 *
 * NOTA PARA O DONO: o CRON_SECRET deve ser configurado no Render como variável de
 * ambiente (ex.: CRON_SECRET=<string aleatória segura>). Não use o literal
 * "obra10plus_cron_2026" — rotacione para um valor que só o ambiente conhece.
 */

/** Mapeia agente_slug para o segmento do runner (espelha slugParaApiCiclos do client). */
function slugParaRunner(agenteSlug: string): string {
  if (
    agenteSlug === "diretor" ||
    agenteSlug === "diretor_geral_ia" ||
    agenteSlug === "diretor_operacoes"
  ) {
    return "diretor";
  }
  if (agenteSlug === "gerente_atendimento") return "gerente";
  return "atendente";
}

/** Deriva o nomeCiclo a partir do nome do ciclo (espelha lógica do client). */
function nomeCicloDaNome(nome: string, agenteSlug: string): string {
  const n = nome.toLowerCase();
  if (n.includes("follow")) return "followup";
  if (n.includes("sla")) return "sla";
  if (n.includes("manha") || n.includes("matinal")) {
    return agenteSlug === "gerente_atendimento" ? "relatorio_manha" : "analise_manha";
  }
  if (n.includes("noite")) return "analise_noite";
  if (n.includes("tráfego") || n.includes("trafego")) return "trafego";
  if (n.includes("supervis")) return "supervisao";
  return "followup";
}

/**
 * Verifica que o ciclo pertence ao tenant da sessão.
 * Tolerante: se tenant_id for null (base antiga) passa — sem coluna não há isolamento mas
 * também não há leak de outro tenant.
 */
function cicloForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B10: guard de gestor — "Executar agora" dispara runner que chama LLM (custo real).
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const cicloId = typeof body.ciclo_id === "string" ? body.ciclo_id.trim() : "";
  if (!cicloId) {
    return NextResponse.json({ error: "ciclo_id é obrigatório." }, { status: 400 });
  }

  const supabase = db();

  // Resolver o ciclo pelo id, verificando que pertence ao tenant da sessão.
  const { data: ciclo, error: cicloErr } = await supabase
    .from("hub_ciclos_ia")
    .select("id, nome, agente_slug, ativo, tenant_id")
    .eq("id", cicloId)
    .maybeSingle();

  if (cicloErr) {
    return NextResponse.json({ error: cicloErr.message }, { status: 500 });
  }
  if (!ciclo || cicloForaDoTenant(ciclo as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Ciclo não encontrado." }, { status: 404 });
  }

  const cicloRow = ciclo as {
    id: string;
    nome: string;
    agente_slug: string;
    ativo: boolean;
    tenant_id?: string | null;
  };

  // E-B10: CRON_SECRET lido do ENV server-side — NUNCA exposto ao browser.
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET não configurado no ambiente. Configure a variável no Render antes de usar 'Executar agora'.",
      },
      { status: 503 }
    );
  }

  const runner = slugParaRunner(cicloRow.agente_slug);
  const nomeCiclo = nomeCicloDaNome(cicloRow.nome, cicloRow.agente_slug);

  // Chamar o runner internamente com Authorization Bearer (server-side).
  // A URL base é construída a partir das variáveis de ambiente do servidor.
  // Precedência correta: usa NEXT_PUBLIC_APP_URL quando presente (caso do Render),
  // senão VERCEL_URL, senão localhost. (Espelha publicBaseUrl() de dispatch-ciclos.)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const baseUrl = appUrl
    ? appUrl.replace(/\/$/, "")
    : process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : "http://localhost:3000";

  const runnerUrl = `${baseUrl}/api/ciclos/${encodeURIComponent(runner)}?ciclo=${encodeURIComponent(nomeCiclo)}&hub_ciclo_id=${encodeURIComponent(cicloRow.id)}`;

  try {
    const res = await fetch(runnerUrl, {
      method: "GET",
      headers: {
        // E-B10: segredo no header Authorization server-side — nunca no bundle client.
        Authorization: `Bearer ${cronSecret}`,
        "x-internal-source": "executar-agora",
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Runner respondeu ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, runner, nomeCiclo, ciclo_id: cicloRow.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao chamar runner.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
