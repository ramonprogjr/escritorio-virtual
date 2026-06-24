import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";

/** Regras de roteamento automático de leads (configuráveis). */
const SELECT =
  "id, prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor, rotulo, criado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { data, error } = await crmDb()
    .from("hub_lead_routing_regras")
    .select(SELECT)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("prioridade", { ascending: true })
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const destino_valor = String(body.destino_valor || "").trim();
  if (!destino_valor) return NextResponse.json({ error: "Destino obrigatório" }, { status: 400 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const norm = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s ? s : null;
  };

  const row = {
    prioridade: body.prioridade != null ? Number(body.prioridade) : 100,
    ativo: body.ativo !== false,
    origem: norm(body.origem),
    mercado: body.mercado ? String(body.mercado).toUpperCase() : null,
    uf: body.uf ? String(body.uf).toUpperCase() : null,
    destino_tipo: ["agente", "atendente", "parceiro"].includes(String(body.destino_tipo))
      ? String(body.destino_tipo)
      : "agente",
    destino_valor,
    rotulo: norm(body.rotulo),
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_lead_routing_regras").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
