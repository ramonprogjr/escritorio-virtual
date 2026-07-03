import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { arquivarCargoCatalogo } from "@/lib/hub/arquivar-cargo-catalogo";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** POST { slugs: string[] } — arquiva cada slug (soft-delete via ativo=false; "só arquiva"). */
export async function POST(request: NextRequest) {
  // Exclusão em lote de cargos — destrutivo, exige gestor ou owner.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

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

  // "Só arquiva": cada slug vira ativo=false (soft), preservando o 409 quando há agentes usando
  // o cargo. `deleted` mantém o nome do campo por compat com a UI (semântica agora = arquivados).
  for (const slug of slugs) {
    const r = await arquivarCargoCatalogo(supabase, slug);
    if (r.ok) deleted.push(r.slug);
    else blocked.push({ slug, error: r.error });
  }

  return NextResponse.json({
    ok: blocked.length === 0,
    deleted,
    blocked,
    counts: { deleted: deleted.length, blocked: blocked.length },
  });
}
