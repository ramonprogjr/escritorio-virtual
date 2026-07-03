import { NextRequest, NextResponse } from "next/server";
import {
  normalizarCodigoRastreio,
  resolverRastreioCodigo,
} from "@/lib/crm/resolver-rastreio-codigo";
import { buscarPorNome } from "@/lib/crm/rastreio-busca";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

export async function GET(request: NextRequest) {
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  // Guard (middleware é morto → cada rota se protege). Os códigos de rastreio são
  // sequenciais/enumeráveis (ex. PS2026001) e a busca por nome varre PII/negócio —
  // sem sessão + filtro de tenant, qualquer request anônima leria dados de outro tenant.
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const params = new URL(request.url).searchParams;
  const codigo = params.get("codigo")?.trim();
  const q = params.get("q")?.trim();
  const supabase = crmDb();

  // Caminho 1 (compat): resolução por CÓDIGO explícito → cadeia de rastreio.
  if (codigo) {
    const cadeia = await resolverRastreioCodigo(supabase, codigo, g.ctx.tenantId);
    if (!cadeia) {
      return NextResponse.json({ error: "Código não encontrado ou formato inválido." }, { status: 404 });
    }
    return NextResponse.json({ data: cadeia });
  }

  // Caminho 2 (novo): busca genérica do cabeçalho por texto.
  if (q) {
    // Se o texto digitado FOR um código (ex. o admin colou um), ainda resolve a cadeia.
    if (normalizarCodigoRastreio(q)) {
      const cadeia = await resolverRastreioCodigo(supabase, q, g.ctx.tenantId);
      if (cadeia) return NextResponse.json({ data: cadeia });
      // não é um código válido no tenant → cai para busca por nome
    }
    const resultados = await buscarPorNome(supabase, q, g.ctx.tenantId);
    return NextResponse.json({ resultados });
  }

  return NextResponse.json({ error: "Informe 'q' (nome) ou 'codigo'." }, { status: 400 });
}
