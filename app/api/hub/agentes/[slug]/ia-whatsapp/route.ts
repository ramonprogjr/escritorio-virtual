import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  cancelarJobsIaPendentesGlobal,
  definirPausaGlobalAgente,
  lerPausaGlobalAgente,
} from "@/lib/whatsapp/ia-global-pause";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = db();
  const state = await lerPausaGlobalAgente(supabase, slug);
  return NextResponse.json({ agente_slug: slug, ...state });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    pausada?: boolean;
    por?: string;
  };

  if (typeof body.pausada !== "boolean") {
    return NextResponse.json({ error: "Campo pausada (boolean) obrigatório" }, { status: 400 });
  }

  const supabase = db();
  const r = await definirPausaGlobalAgente(supabase, slug, body.pausada, {
    por: body.por?.slice(0, 80) ?? "crm",
    motivo: body.pausada ? "crm_toggle" : undefined,
  });

  if (!r.ok) {
    return NextResponse.json({ error: r.erro ?? "Falha ao atualizar" }, { status: 400 });
  }

  let jobsCancelados = 0;
  if (body.pausada) {
    jobsCancelados = await cancelarJobsIaPendentesGlobal(supabase, slug);
  }

  const state = await lerPausaGlobalAgente(supabase, slug);
  return NextResponse.json({ ok: true, jobsCancelados, ...state });
}
