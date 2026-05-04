import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, aprovado_por, observacao } = body as {
    status: string;
    aprovado_por?: string;
    observacao?: string;
  };

  const updates: Record<string, unknown> = {
    status,
    atualizado_em: new Date().toISOString(),
  };

  if (status === "aprovado") {
    updates.aprovado_por = aprovado_por || "wendel";
    updates.aprovado_em = new Date().toISOString();
  } else if (status === "rejeitado" || status === "ignorado") {
    updates.rejeitado_por = aprovado_por || "wendel";
    updates.rejeitado_em = new Date().toISOString();
    if (observacao) updates.observacao = observacao;
  }

  const { error } = await db().from("hub_aprovacoes").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
