import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { crmApiConfigError, requireCrmOwner } from "@/lib/crm/crm-api-auth";

export type IaPrecoRow = {
  modelo: string;
  input_usd_milhao: number;
  output_usd_milhao: number;
  ativo: boolean;
};

/** GET /api/crm/ia/precos — tabela de preços por modelo (owner-only). */
export async function GET(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const { data, error } = await crmDb()
    .from("hub_ia_precos")
    .select("modelo, input_usd_milhao, output_usd_milhao, ativo")
    .order("modelo", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? []) as IaPrecoRow[] });
}

/** PUT /api/crm/ia/precos — atualiza um modelo (owner-only). Body: { modelo, input_usd_milhao?, output_usd_milhao?, ativo? }. */
export async function PUT(request: NextRequest) {
  const config = crmApiConfigError();
  if (config) return config;
  const owner = await requireCrmOwner(request);
  if ("error" in owner) return owner.error;

  const body = (await request.json().catch(() => ({}))) as Partial<IaPrecoRow>;
  const modelo = String(body.modelo ?? "").trim();
  if (!modelo) return NextResponse.json({ error: "Modelo obrigatório." }, { status: 400 });

  const patch: Partial<IaPrecoRow> = {};
  if (Number.isFinite(Number(body.input_usd_milhao))) patch.input_usd_milhao = Number(body.input_usd_milhao);
  if (Number.isFinite(Number(body.output_usd_milhao))) patch.output_usd_milhao = Number(body.output_usd_milhao);
  if (typeof body.ativo === "boolean") patch.ativo = body.ativo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const { data, error } = await crmDb()
    .from("hub_ia_precos")
    .update(patch)
    .eq("modelo", modelo)
    .select("modelo, input_usd_milhao, output_usd_milhao, ativo")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: (data ?? null) as IaPrecoRow | null });
}
