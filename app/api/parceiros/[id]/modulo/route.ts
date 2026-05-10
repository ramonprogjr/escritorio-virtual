import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: parceiroId } = await ctx.params;
  const supabase = db();

  let body: { modulo_numero?: number; feito_por?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "JSON inválido" }, { status: 400 });
  }

  const moduloNumero = body.modulo_numero;
  if (typeof moduloNumero !== "number" || moduloNumero < 1 || moduloNumero > 24) {
    return NextResponse.json({ erro: "modulo_numero inválido" }, { status: 400 });
  }

  const { data: parceiro, error: errP } = await supabase
    .from("hub_parceiros")
    .select("id, modulo_atual, status")
    .eq("id", parceiroId)
    .single();

  if (errP || !parceiro) {
    return NextResponse.json({ erro: "Parceiro não encontrado" }, { status: 404 });
  }

  const { data: tpl } = await supabase
    .from("hub_modulos_template")
    .select("numero, titulo")
    .eq("numero", moduloNumero)
    .maybeSingle();

  const titulo = tpl?.titulo || `Módulo ${moduloNumero}`;

  const { data: existente } = await supabase
    .from("hub_parceiros_modulos")
    .select("id")
    .eq("parceiro_id", parceiroId)
    .eq("modulo_numero", moduloNumero)
    .maybeSingle();

  const agora = new Date().toISOString();

  if (existente?.id) {
    await supabase
      .from("hub_parceiros_modulos")
      .update({
        status: "concluido",
        concluido_em: agora,
        titulo,
      })
      .eq("id", existente.id);
  } else {
    await supabase.from("hub_parceiros_modulos").insert({
      parceiro_id: parceiroId,
      modulo_numero: moduloNumero,
      titulo,
      status: "concluido",
      concluido_em: agora,
      tentativas: 1,
    });
  }

  const novoModuloAtual = Math.max(parceiro.modulo_atual || 0, moduloNumero);

  const { count } = await supabase
    .from("hub_parceiros_modulos")
    .select("id", { count: "exact", head: true })
    .eq("parceiro_id", parceiroId)
    .eq("status", "concluido");

  const concluidos = count ?? 0;
  const totalModulos = 8;

  await supabase
    .from("hub_parceiros")
    .update({
      modulo_atual: novoModuloAtual,
      status: parceiro.status === "captacao" ? "em_homologacao" : parceiro.status,
    })
    .eq("id", parceiroId);

  const { data: homoRow } = await supabase
    .from("hub_parceiros_homologacao")
    .select("id")
    .eq("parceiro_id", parceiroId)
    .maybeSingle();

  const homoPayload = {
    parceiro_id: parceiroId,
    modulos_concluidos: concluidos,
    estagio: concluidos >= totalModulos ? "concluido" : "em_andamento",
    data_conclusao: concluidos >= totalModulos ? agora : null,
  };

  if (homoRow?.id) {
    await supabase.from("hub_parceiros_homologacao").update(homoPayload).eq("id", homoRow.id);
  } else {
    await supabase.from("hub_parceiros_homologacao").insert(homoPayload);
  }

  await supabase.from("hub_parceiros_log").insert({
    parceiro_id: parceiroId,
    evento: "modulo_concluido",
    descricao: `Módulo ${moduloNumero} (${titulo}) marcado como concluído`,
    feito_por: body.feito_por || "gestor",
    feito_por_tipo: "humano",
    dados: { modulo_numero: moduloNumero },
  });

  return NextResponse.json({ ok: true, modulo_numero: moduloNumero, modulos_concluidos: concluidos });
}
