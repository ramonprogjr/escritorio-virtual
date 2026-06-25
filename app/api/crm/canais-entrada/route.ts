import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { defaultTenantId, tenantIdFromRequest } from "@/lib/tenant-default";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

/** Registro de canais de entrada (fontes de lead). NÃO guarda tokens/segredos aqui. */
const SELECT = "id, tipo, nome, identificador, origem_slug, ativo, observacao, criado_em";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = tenantIdFromRequest(request.headers) || defaultTenantId();
  const { data, error } = await crmDb()
    .from("hub_canais_entrada")
    .select(SELECT)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .order("criado_em", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(body.nome || "").trim();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const tipos = ["whatsapp", "meta_ads", "google_ads", "site", "indicacao", "manual"];
  const tipo = tipos.includes(String(body.tipo)) ? String(body.tipo) : "manual";
  const tenantId = g.ctx.tenantId;
  const norm = (v: unknown) => {
    const s = String(v ?? "").trim();
    return s ? s : null;
  };

  const row = {
    tipo,
    nome,
    identificador: norm(body.identificador),
    origem_slug: norm(body.origem_slug) ?? tipo,
    ativo: body.ativo !== false,
    observacao: norm(body.observacao),
    tenant_id: tenantId,
  };

  const { data, error } = await crmDb().from("hub_canais_entrada").insert(row).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
