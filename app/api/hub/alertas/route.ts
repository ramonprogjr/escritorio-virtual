import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Guard (middleware é morto → cada rota se protege). hub_alertas é recurso global
  // do Hub (sem tenant_id) — gate por nível (gestor/owner), sem filtro de tenant.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const resolvido = searchParams.get("resolvido");
  const agenteSlug = searchParams.get("agente_slug");
  const tipo = searchParams.get("tipo");
  const limitRaw = Number.parseInt(searchParams.get("limit") || "30", 10);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 30;

  const supabase = db();
  let query = supabase
    .from("hub_alertas")
    .select("*")
    .order("criado_em", { ascending: false })
    .limit(limit);

  if (resolvido === "true") query = query.eq("resolvido", true);
  if (resolvido === "false") query = query.eq("resolvido", false);
  if (agenteSlug) query = query.eq("agente_slug", agenteSlug);
  if (tipo) query = query.eq("tipo", tipo);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alertas: data || [] });
}
