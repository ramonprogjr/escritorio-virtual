import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateAndNormalizeCicloConfiguracoes } from "@/lib/hub-ciclos-configuracoes";
import { requireCrmGestor, requireCrmSessao } from "@/lib/crm/crm-api-auth";

type CicloTipo = "continuo" | "programado" | "gatilho";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isCicloTipo(v: unknown): v is CicloTipo {
  return v === "continuo" || v === "programado" || v === "gatilho";
}

/**
 * Verifica se o ciclo pertence ao tenant da sessão.
 * Tolerante: se tenant_id for null (base antiga sem migração) passa — sem coluna não há leak.
 */
function cicloForaDoTenant(
  row: { tenant_id?: string | null } | null | undefined,
  tenantId: string
): boolean {
  if (!row) return false;
  return row.tenant_id != null && String(row.tenant_id) !== tenantId;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B7 (GET): guard de sessão + isolamento de tenant.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  const supabase = db();
  const { data, error } = await supabase
    .from("hub_ciclos_ia")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || cicloForaDoTenant(data as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B7 (PATCH): editar ciclo exige gestor + pertencer ao tenant.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("agente_slug" in body) patch.agente_slug = String(body.agente_slug || "").trim();
  if ("nome" in body) patch.nome = String(body.nome || "").trim();
  if ("descricao" in body) {
    const descricao = String(body.descricao || "").trim();
    patch.descricao = descricao.length > 0 ? descricao : null;
  }
  if ("tipo" in body) {
    if (!isCicloTipo(body.tipo)) {
      return NextResponse.json({ error: "tipo inválido." }, { status: 400 });
    }
    patch.tipo = body.tipo;
  }
  if ("cron_expressao" in body) {
    const cron = String(body.cron_expressao || "").trim();
    patch.cron_expressao = cron.length > 0 ? cron : null;
  }
  if ("intervalo_minutos" in body) {
    if (body.intervalo_minutos == null || body.intervalo_minutos === "") {
      patch.intervalo_minutos = null;
    } else {
      const intervalo = Number.parseInt(String(body.intervalo_minutos), 10);
      if (!Number.isFinite(intervalo) || intervalo <= 0) {
        return NextResponse.json({ error: "intervalo_minutos inválido." }, { status: 400 });
      }
      patch.intervalo_minutos = intervalo;
    }
  }
  if ("ativo" in body) patch.ativo = body.ativo === true;
  if ("configuracoes" in body) {
    const parsed = validateAndNormalizeCicloConfiguracoes(body.configuracoes);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    patch.configuracoes = parsed.value;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }
  if ("agente_slug" in patch && !String(patch.agente_slug).trim()) {
    return NextResponse.json({ error: "agente_slug inválido." }, { status: 400 });
  }
  if ("nome" in patch && !String(patch.nome).trim()) {
    return NextResponse.json({ error: "nome inválido." }, { status: 400 });
  }

  const supabase = db();

  // E-B7 (PATCH): verificar tenant antes de atualizar.
  const { data: atual } = await supabase
    .from("hub_ciclos_ia")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!atual || cicloForaDoTenant(atual as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("hub_ciclos_ia")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // E-B7 (DELETE): excluir ciclo exige gestor + pertencer ao tenant.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const { id } = await params;
  const supabase = db();

  // Verificar tenant antes do delete em cascata (irreversível).
  const { data: alvo } = await supabase
    .from("hub_ciclos_ia")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!alvo || cicloForaDoTenant(alvo as { tenant_id?: string | null }, g.ctx.tenantId)) {
    return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });
  }

  // Princípio "só arquiva": antes a RPC hub_delete_ciclo_cascade fazia DELETE do ciclo + dos
  // hub_ciclos_log (histórico de execução). Agora faz soft-archive (ativo=false): o ciclo E seus
  // logs PERMANECEM no banco. A lista GET esconde inativos por padrão.
  const { data: updated, error: updErr } = await supabase
    .from("hub_ciclos_ia")
    .update({ ativo: false })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Ciclo não encontrado" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
