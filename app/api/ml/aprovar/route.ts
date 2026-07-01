import { NextRequest, NextResponse } from "next/server";
import { aplicarMudancaConfirmada } from "@/lib/ia/ml";
import { createClient } from "@supabase/supabase-js";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

/** Aprova/rejeita/aplica mudanças propostas pelo ML — só owner/gestor (Batch 5). */
export async function POST(request: NextRequest) {
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  try {
    const { sugestaoId, acao, motivo, confirmacao } = await request.json();

    if (!sugestaoId || !acao) {
      return NextResponse.json({ erro: "sugestaoId e acao são obrigatórios" }, { status: 400 });
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // PASSO 1 — humano aprova pela primeira vez → retorna preview detalhado
    if (acao === "aprovar_primeira_vez") {
      const resultado = await aplicarMudancaConfirmada(sugestaoId, "primeira_aprovacao");
      return NextResponse.json({
        ...resultado,
        instrucao: 'Para confirmar, chame novamente com acao="confirmar_aplicar" e confirmacao="CONFIRMO_A_ALTERACAO"',
      });
    }

    // PASSO 2 — humano confirma com token explícito → executa a mudança
    if (acao === "confirmar_aplicar") {
      if (confirmacao !== "CONFIRMO_A_ALTERACAO") {
        return NextResponse.json(
          { erro: 'Token de confirmação inválido. Use confirmacao="CONFIRMO_A_ALTERACAO"' },
          { status: 400 }
        );
      }
      const resultado = await aplicarMudancaConfirmada(sugestaoId, "confirmacao_final");
      return NextResponse.json(resultado);
    }

    // REJEITAR — apenas atualiza status, sem executar nada
    if (acao === "rejeitar") {
      await db
        .from("hub_ml_sugestoes")
        .update({
          status: "rejeitado",
          motivo_rejeicao: motivo || "Rejeitado pelo usuário",
        })
        .eq("id", sugestaoId);
      return NextResponse.json({ sucesso: true, status: "rejeitado" });
    }

    return NextResponse.json({ erro: "acao inválida. Use: aprovar_primeira_vez | confirmar_aplicar | rejeitar" }, { status: 400 });
  } catch (erro) {
    const errMsg = erro instanceof Error ? erro.message : "Erro desconhecido";
    return NextResponse.json({ sucesso: false, erro: errMsg }, { status: 500 });
  }
}
