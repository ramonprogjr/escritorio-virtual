import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { aprovarEEnviarEncaminhamento } from "@/lib/crm/notificar-parceiro-lead";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: { parceiro_id?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await aprovarEEnviarEncaminhamento(db(), id, {
    parceiro_id: body.parceiro_id,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, telefone: result.telefone });
}
