import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const CANAIS = new Set(["whatsapp", "instagram", "email", "interno", "site", "*"]);

function validarCanal(c: string | null | undefined): string | null | undefined {
  if (c === undefined) return undefined;
  if (c == null || c === "") return null;
  if (!CANAIS.has(c)) return "__invalid__";
  return c;
}

type BodyPatch = {
  canal?: string | null;
  nome?: string;
  prioridade?: number;
  ativo?: boolean;
  exige_aprovacao?: boolean;
  limite_autonomia_brl?: number | null;
  palavras_chave?: string[];
  regex_opcional?: string | null;
  observacao?: string | null;
};

/** PATCH — atualiza regra por id. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  let body: BodyPatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { atualizado_em: new Date().toISOString() };

  if (body.canal !== undefined) {
    const canal = validarCanal(body.canal);
    if (canal === "__invalid__") {
      return NextResponse.json(
        { error: "canal inválido (whatsapp, instagram, email, interno, site, * ou null)" },
        { status: 400 }
      );
    }
    patch.canal = canal;
  }
  if (body.nome !== undefined) patch.nome = body.nome.trim();
  if (body.prioridade !== undefined) patch.prioridade = body.prioridade;
  if (body.ativo !== undefined) patch.ativo = body.ativo;
  if (body.exige_aprovacao !== undefined) patch.exige_aprovacao = body.exige_aprovacao;
  if (body.limite_autonomia_brl !== undefined) patch.limite_autonomia_brl = body.limite_autonomia_brl;
  if (body.palavras_chave !== undefined) patch.palavras_chave = body.palavras_chave;
  if (body.regex_opcional !== undefined) patch.regex_opcional = body.regex_opcional;
  if (body.observacao !== undefined) patch.observacao = body.observacao;

  const supabase = db();
  const { data, error } = await supabase
    .from("hub_autonomia_matriz")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });
  return NextResponse.json({ regra: data });
}

/** DELETE — remove regra. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const supabase = db();
  const { data: existing } = await supabase.from("hub_autonomia_matriz").select("id").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Regra não encontrada" }, { status: 404 });

  const { error } = await supabase.from("hub_autonomia_matriz").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
