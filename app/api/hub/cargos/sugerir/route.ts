import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import {
  sugerirCargoCatalogoComMistral,
  type CargoCatalogoContextRow,
  type MercadoContextRow,
} from "@/lib/hub/sugerir-cargo-catalogo";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { titulo: string }
 * Devolve campos sugeridos para `hub_cargos_catalogo` com base nos cargos e mercados activos no Hub.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const titulo = String(body.titulo || "").trim();
  if (!titulo) {
    return NextResponse.json({ error: "titulo é obrigatório." }, { status: 400 });
  }

  const supabase = db();

  const [{ data: cargosData, error: cErr }, mercadosQuery] = await Promise.all([
    supabase
      .from("hub_cargos_catalogo")
      .select("slug,titulo,segmento,especialidade,nivel")
      .eq("ativo", true)
      .order("segmento")
      .limit(48),
    supabase.from("hub_mercados").select("sigla,nome").eq("ativo", true).order("sigla").limit(40),
  ]);

  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 });
  }

  const cargosExistentes: CargoCatalogoContextRow[] = (cargosData || []).map((r) => ({
    slug: String((r as { slug?: string }).slug ?? ""),
    titulo: (r as { titulo?: string }).titulo ?? null,
    segmento: (r as { segmento?: string }).segmento ?? null,
    especialidade: (r as { especialidade?: string }).especialidade ?? null,
    nivel: (r as { nivel?: number }).nivel ?? null,
  }));

  let mercados: MercadoContextRow[] | undefined;
  const { data: mercadosData, error: mErr } = mercadosQuery;
  if (!mErr && mercadosData?.length) {
    mercados = mercadosData.map((r) => ({
      sigla: String((r as { sigla?: string }).sigla ?? ""),
      nome: (r as { nome?: string }).nome ?? null,
    }));
  }

  const out = await sugerirCargoCatalogoComMistral({
    tituloPedido: titulo,
    cargosExistentes,
    mercados,
  });

  if (!out.ok) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  return NextResponse.json({ sugestao: out.sugestao });
}
