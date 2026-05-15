import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RpcRow = { ok?: boolean; error?: string; slug?: string };

/** POST { slugs: string[] } — elimina cada slug via RPC (delete_authorized). */
export async function POST(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const raw = body.slugs;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: "slugs deve ser um array não vazio." }, { status: 400 });
  }

  const slugs = [...new Set(raw.map((s) => String(s).trim()).filter((s) => s.length >= 2))];
  if (slugs.length === 0) {
    return NextResponse.json({ error: "Nenhum slug válido." }, { status: 400 });
  }

  const deleted: string[] = [];
  const blocked: { slug: string; error: string }[] = [];

  for (const slug of slugs) {
    const { data, error } = await supabase.rpc("hub_delete_cargo_catalogo", { p_slug: slug });
    if (error) {
      blocked.push({ slug, error: error.message });
      continue;
    }
    const row = data as RpcRow | null;
    if (row?.ok) {
      deleted.push(String(row.slug ?? slug));
      continue;
    }
    blocked.push({ slug, error: typeof row?.error === "string" ? row.error : "Falha ao eliminar." });
  }

  return NextResponse.json({
    ok: blocked.length === 0,
    deleted,
    blocked,
    counts: { deleted: deleted.length, blocked: blocked.length },
  });
}
