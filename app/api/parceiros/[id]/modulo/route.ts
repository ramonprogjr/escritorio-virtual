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
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = db();
  const { id } = await params;
  const body = await request.json();
  const { modulo_numero, nota, feedback, feito_por } = body;

  if (!modulo_numero) {
    return NextResponse.json({ erro: "modulo_numero é obrigatório" }, { status: 400 });
  }

  const { data: parceiro, error: errFetch } = await supabase
    .from("hub_parceiros")
    .select("id, nome, status, modulo_atual, recebe_leads")
    .eq("id", id)
    .single();

  if (errFetch || !parceiro) return NextResponse.json({ erro: "Parceiro não encontrado" }, { status: 404 });

  // Upsert module record
  const { error: errMod } = await supabase.from("hub_parceiros_modulos").upsert({
    parceiro_id: id,
    modulo_numero,
    titulo: `Módulo ${modulo_numero}`,
    status: "concluido",
    nota: nota || null,
    feedback: feedback || null,
    concluido_em: new Date().toISOString(),
  }, { onConflict: "parceiro_id,modulo_numero" });

  if (errMod) return NextResponse.json({ erro: errMod.message }, { status: 500 });

  // Count total completed modules
  const { count } = await supabase
    .from("hub_parceiros_modulos")
    .select("id", { count: "exact" })
    .eq("parceiro_id", id)
    .eq("status", "concluido");

  const totalConcluidos = count || 0;
  const novoModuloAtual = Math.max(parceiro.modulo_atual, modulo_numero);

  const updates: Record<string, unknown> = {
    modulo_atual: novoModuloAtual,
    atualizado_em: new Date().toISOString(),
  };

  let evento = "modulo_concluido";
  let descricao = `Módulo ${modulo_numero} concluído`;

  // Module 5: unlock leads
  if (modulo_numero >= 5 && !parceiro.recebe_leads) {
    updates.recebe_leads = true;
    updates.status = "em_homologacao";
    evento = "leads_desbloqueados";
    descricao = `Módulo 5 concluído — parceiro habilitado a receber leads`;

    await supabase.from("hub_parceiros_homologacao").upsert({
      parceiro_id: id,
      estagio: `modulo_${modulo_numero}`,
      modulos_concluidos: totalConcluidos,
      data_inicio: new Date().toISOString(),
    }, { onConflict: "parceiro_id" });
  }

  // Module 8: homologate
  if (modulo_numero >= 8) {
    updates.status = "homologado";
    evento = "parceiro_homologado";
    descricao = `Todos os módulos concluídos — parceiro homologado`;

    await supabase.from("hub_parceiros_homologacao").upsert({
      parceiro_id: id,
      estagio: "concluida",
      modulos_concluidos: totalConcluidos,
      data_conclusao: new Date().toISOString(),
      avaliador: feito_por || "sistema",
    }, { onConflict: "parceiro_id" });
  } else if (modulo_numero >= 5) {
    await supabase.from("hub_parceiros_homologacao").upsert({
      parceiro_id: id,
      estagio: `modulo_${modulo_numero}`,
      modulos_concluidos: totalConcluidos,
    }, { onConflict: "parceiro_id" });
  }

  await supabase.from("hub_parceiros").update(updates).eq("id", id);

  // Immutable log
  await supabase.from("hub_parceiros_log").insert({
    parceiro_id: id,
    evento,
    descricao,
    feito_por: feito_por || "sistema",
    feito_por_tipo: feito_por ? "humano" : "sistema",
    dados: { modulo_numero, nota, totalConcluidos, novoStatus: updates.status },
  });

  return NextResponse.json({
    status: "ok",
    modulo_concluido: modulo_numero,
    modulo_atual: novoModuloAtual,
    total_concluidos: totalConcluidos,
    recebe_leads: updates.recebe_leads ?? parceiro.recebe_leads,
    parceiro_status: updates.status ?? parceiro.status,
  });
}
