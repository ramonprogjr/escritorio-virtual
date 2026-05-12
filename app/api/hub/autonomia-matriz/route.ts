import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CANAIS = new Set(["whatsapp", "instagram", "email", "interno", "site", "*"]);

function validarCanal(c: string | null | undefined): string | null {
  if (c == null || c === "") return null;
  if (!CANAIS.has(c)) return "__invalid__";
  return c;
}

/** GET ?agente_slug= — lista regras da matriz do agente (ordem: prioridade DESC). */
export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const agente_slug = request.nextUrl.searchParams.get("agente_slug")?.trim();
  if (!agente_slug) {
    return NextResponse.json({ error: "Query agente_slug é obrigatória" }, { status: 400 });
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_autonomia_matriz")
    .select("*")
    .eq("agente_slug", agente_slug)
    .order("prioridade", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ regras: data ?? [] });
}

type BodyPost = {
  agente_slug: string;
  canal?: string | null;
  nome: string;
  prioridade?: number;
  ativo?: boolean;
  exige_aprovacao?: boolean;
  limite_autonomia_brl?: number | null;
  palavras_chave?: string[];
  regex_opcional?: string | null;
  observacao?: string | null;
};

/** POST — cria linha da matriz (service role). */
export async function POST(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  let body: BodyPost;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.agente_slug?.trim() || !body.nome?.trim()) {
    return NextResponse.json({ error: "agente_slug e nome são obrigatórios" }, { status: 400 });
  }

  const canal = validarCanal(body.canal ?? null);
  if (canal === "__invalid__") {
    return NextResponse.json(
      { error: "canal inválido (use whatsapp, instagram, email, interno, site, * ou omita)" },
      { status: 400 }
    );
  }

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_autonomia_matriz")
    .insert({
      agente_slug: body.agente_slug.trim(),
      canal,
      nome: body.nome.trim(),
      prioridade: body.prioridade ?? 0,
      ativo: body.ativo ?? true,
      exige_aprovacao: body.exige_aprovacao ?? false,
      limite_autonomia_brl: body.limite_autonomia_brl ?? null,
      palavras_chave: body.palavras_chave ?? [],
      regex_opcional: body.regex_opcional ?? null,
      observacao: body.observacao ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ regra: data });
}
