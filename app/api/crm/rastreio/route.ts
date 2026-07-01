import { NextRequest, NextResponse } from "next/server";
import { resolverRastreioCodigo } from "@/lib/crm/resolver-rastreio-codigo";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Os códigos de rastreio são
  // sequenciais/enumeráveis (ex. PS2026001) — sem sessão + filtro de tenant, qualquer
  // request anônima varria PII/dados de negócio de qualquer tenant incrementando o número.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const codigo = new URL(request.url).searchParams.get("codigo");
  if (!codigo?.trim()) {
    return NextResponse.json({ error: "Parâmetro codigo é obrigatório." }, { status: 400 });
  }

  const supabase = crmDb();
  const cadeia = await resolverRastreioCodigo(supabase, codigo, g.ctx.tenantId);
  if (!cadeia) {
    return NextResponse.json({ error: "Código não encontrado ou formato inválido." }, { status: 404 });
  }

  return NextResponse.json({ data: cadeia });
}
