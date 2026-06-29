import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmComercial } from "@/lib/crm/crm-api-auth";
import {
  carregarFaseDoProjetoTenant,
  projetoDoTenant,
  recalcularAgregadoProjeto,
  SELECT_FASE_BASE,
} from "@/lib/crm/aprovacao-projeto-db";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; faseId: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id, faseId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(faseId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  if (!(await projetoDoTenant(supabase, id, tenantId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const fase = await carregarFaseDoProjetoTenant(supabase, faseId, id, tenantId);
  if (fase === "sem_tenant") {
    return NextResponse.json({ error: "Programa indisponível neste ambiente (migração pendente)." }, { status: 409 });
  }
  if (!fase) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const updates: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (typeof body.nome === "string" && body.nome.trim()) {
    updates.nome = body.nome.trim().slice(0, 200);
  }
  if ("metragem_m2" in body) {
    const v = body.metragem_m2;
    updates.metragem_m2 =
      typeof v === "number" && Number.isFinite(v)
        ? v
        : typeof v === "string" && v.trim() && !Number.isNaN(Number(v))
          ? Number(v)
          : null;
  }
  if ("observacao" in body) {
    updates.observacao =
      typeof body.observacao === "string" && body.observacao.trim()
        ? body.observacao.trim().slice(0, 2000)
        : null;
  }
  if (typeof body.categoria === "string" && body.categoria.trim()) {
    updates.categoria = body.categoria.trim();
  }
  // entregavel_url editável aqui (anexar entregável por URL — fluxo MVP do design).
  if ("entregavel_url" in body) {
    updates.entregavel_url =
      typeof body.entregavel_url === "string" && body.entregavel_url.trim()
        ? body.entregavel_url.trim().slice(0, 2000)
        : null;
  }

  if (Object.keys(updates).length === 1) {
    // só atualizado_em → nada a mudar; devolve a fase atual (idempotente).
    return NextResponse.json({ data: fase.row });
  }

  const { data, error } = await supabase
    .from("hub_projetos_fases")
    .update(updates)
    .eq("id", faseId)
    .eq("projeto_id", id)
    .eq("tenant_id", tenantId)
    .select(SELECT_FASE_BASE)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; faseId: string }> }
) {
  const g = await requireCrmComercial(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const { id, faseId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(faseId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const supabase = crmDb();
  const tenantId = g.ctx.tenantId;
  if (!(await projetoDoTenant(supabase, id, tenantId))) {
    return NextResponse.json({ error: "Projeto não encontrado" }, { status: 404 });
  }

  const fase = await carregarFaseDoProjetoTenant(supabase, faseId, id, tenantId);
  if (fase === "sem_tenant") {
    return NextResponse.json({ error: "Programa indisponível neste ambiente (migração pendente)." }, { status: 409 });
  }
  if (!fase) return NextResponse.json({ error: "Item não encontrado" }, { status: 404 });

  // DELETE de fase 'enviada' (em voo) é bloqueado (409) — design A1 edge case.
  // Cômodo (tipo='comodo') é sempre livre.
  const ehFase = (fase.row.tipo ?? "comodo") === "fase";
  if (ehFase && fase.row.aprovacao_status === "enviado") {
    return NextResponse.json(
      { error: "Entregável em aprovação — registre a resposta ou cancele o envio antes de remover." },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("hub_projetos_fases")
    .delete()
    .eq("id", faseId)
    .eq("projeto_id", id)
    .eq("tenant_id", tenantId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // DELETE de fase recalcula o agregado (uma fase aprovada/rejeitada a menos muda o chip).
  if (ehFase) await recalcularAgregadoProjeto(supabase, id, tenantId);

  return NextResponse.json({ ok: true });
}
