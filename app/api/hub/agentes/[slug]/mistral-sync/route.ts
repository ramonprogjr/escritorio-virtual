import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { syncHubAgenteParaMistral } from "@/lib/mistral/sync-hub-agent";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Reenvia o estado do agente Hub para a Mistral Agents API (útil após erros ou mudanças manuais).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);
  const supabase = db();

  const { data: row } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, mistral_agent_sync_habilitado")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "Agente não encontrado" }, { status: 404 });
  }

  if (row.mistral_agent_sync_habilitado !== true) {
    return NextResponse.json(
      {
        error:
          "Ative «Provisionar agente na Mistral» na ficha do agente antes de sincronizar.",
      },
      { status: 409 }
    );
  }

  const out = await syncHubAgenteParaMistral(supabase, slug);
  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    mistral_agent_id: out.mistral_agent_id,
    created: out.created,
  });
}
