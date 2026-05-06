import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function slugify(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export async function GET(request: NextRequest) {
  const supabase = db();
  const { searchParams } = new URL(request.url);
  const ativo = searchParams.get("ativo");

  let query = supabase
    .from("hub_agente_identidade")
    .select("*")
    .is("arquivado_em", null)
    .order("nivel")
    .order("nome");

  if (ativo === "true") {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = db();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body JSON inválido." }, { status: 400 });
  }

  const {
    cargo_slug,
    nome,
    personalidade,
    prefixo_mercado,
    bio,
    horario_inicio,
    horario_fim,
    dias_semana,
    system_prompt_base,
  } = body as {
    cargo_slug?: string;
    nome?: string;
    personalidade?: string;
    prefixo_mercado?: string;
    bio?: string;
    horario_inicio?: string;
    horario_fim?: string;
    dias_semana?: unknown;
    system_prompt_base?: string;
  };

  if (!cargo_slug || !nome) {
    return NextResponse.json(
      { error: "cargo_slug e nome são obrigatórios." },
      { status: 400 }
    );
  }

  // Gerar slug único
  const baseSlug = slugify(nome);
  let agente_slug = baseSlug;
  let sufixo = 2;

  while (true) {
    const { data: existing } = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug")
      .eq("agente_slug", agente_slug)
      .maybeSingle();

    if (!existing) break;

    agente_slug = `${baseSlug.slice(0, 37)}_${sufixo}`;
    sufixo++;
  }

  const { data, error } = await supabase
    .from("hub_agente_identidade")
    .insert({
      agente_slug,
      cargo_slug,
      nome,
      personalidade,
      prefixo_mercado,
      bio,
      horario_inicio,
      horario_fim,
      dias_semana,
      system_prompt_base,
      ativo: true,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
