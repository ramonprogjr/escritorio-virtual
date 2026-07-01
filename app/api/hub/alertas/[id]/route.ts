import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Guard (middleware é morto → cada rota se protege). hub_alertas é recurso global
  // do Hub (sem tenant_id) — gate por nível (gestor/owner), sem filtro de tenant.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("resolvido" in body) patch.resolvido = body.resolvido === true;
  if ("resolvido_em" in body) {
    const v = String(body.resolvido_em || "").trim();
    patch.resolvido_em = v.length > 0 ? v : null;
  }
  if ("titulo" in body) patch.titulo = String(body.titulo || "").trim();
  if ("mensagem" in body) patch.mensagem = String(body.mensagem || "").trim();
  if ("tipo" in body) patch.tipo = String(body.tipo || "").trim();

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar." }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_alertas")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Alerta não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}
