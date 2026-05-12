import { NextRequest, NextResponse } from "next/server";
import { aprovar, rejeitar } from "@/lib/ia/aprovacoes";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { status, observacao, motivo } = body as {
    status?: string;
    observacao?: string;
    motivo?: string;
  };

  if (status !== "aprovado" && status !== "rejeitado") {
    return NextResponse.json(
      { error: "status deve ser aprovado ou rejeitado" },
      { status: 400 }
    );
  }

  if (status === "aprovado") {
    const resultado = await aprovar(id, observacao);
    if (!resultado.sucesso) {
      return NextResponse.json({ error: resultado.erro ?? "Falha ao aprovar" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const resultado = await rejeitar(id, motivo?.trim() || "Rejeitado pelo operador");
  if (!resultado.sucesso) {
    return NextResponse.json({ error: resultado.erro ?? "Falha ao rejeitar" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
