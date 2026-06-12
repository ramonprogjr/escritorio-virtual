import { NextRequest, NextResponse } from "next/server";
import { resolverRastreioCodigo } from "@/lib/crm/resolver-rastreio-codigo";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const codigo = new URL(request.url).searchParams.get("codigo");
  if (!codigo?.trim()) {
    return NextResponse.json({ error: "Parâmetro codigo é obrigatório." }, { status: 400 });
  }

  const supabase = crmDb();
  const cadeia = await resolverRastreioCodigo(supabase, codigo);
  if (!cadeia) {
    return NextResponse.json({ error: "Código não encontrado ou formato inválido." }, { status: 404 });
  }

  return NextResponse.json({ data: cadeia });
}
