import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmOwner } from "@/lib/crm/crm-api-auth";

export type IaConfigRow = {
  markup: number;
  fx_usd_brl: number;
  valor_credito_brl: number;
  nome_moeda: string;
  modo: string;
  alerta_saldo_baixo: number;
};

/** GET /api/crm/ia/config — config global de precificação (owner-only). */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const { data, error } = await crmDb()
    .from("hub_ia_config")
    .select("markup, fx_usd_brl, valor_credito_brl, nome_moeda, modo, alerta_saldo_baixo")
    .eq("escopo", "global")
    .is("tenant_id", null)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? null) as IaConfigRow | null });
}

/** PUT /api/crm/ia/config — atualiza a config global (owner-only). */
export async function PUT(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const body = (await request.json().catch(() => ({}))) as Partial<IaConfigRow>;
  const patch: Partial<IaConfigRow> = {};
  if (Number.isFinite(Number(body.markup))) {
    const mk = Number(body.markup);
    // MET-01: markup < 1 = vender IA abaixo do custo (furo direto na margem). Fail-closed.
    // (O CHECK equivalente no banco — ALTER ... CHECK (markup >= 1) — vai na janela do dono.)
    if (mk < 1) {
      return NextResponse.json(
        { error: "Markup deve ser ≥ 1 — nunca vender IA abaixo do custo." },
        { status: 400 }
      );
    }
    patch.markup = mk;
  }
  if (Number.isFinite(Number(body.fx_usd_brl))) patch.fx_usd_brl = Number(body.fx_usd_brl);
  if (Number.isFinite(Number(body.valor_credito_brl))) patch.valor_credito_brl = Number(body.valor_credito_brl);
  if (typeof body.nome_moeda === "string" && body.nome_moeda.trim()) patch.nome_moeda = body.nome_moeda.trim();
  if (body.modo === "prepago" || body.modo === "pospago") patch.modo = body.modo;
  if (Number.isFinite(Number(body.alerta_saldo_baixo))) patch.alerta_saldo_baixo = Math.round(Number(body.alerta_saldo_baixo));

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_ia_config")
    .update(patch)
    .eq("escopo", "global")
    .is("tenant_id", null)
    .select("markup, fx_usd_brl, valor_credito_brl, nome_moeda, modo, alerta_saldo_baixo")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? null) as IaConfigRow | null });
}
