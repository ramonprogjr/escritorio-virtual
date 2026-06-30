import { NextRequest, NextResponse } from "next/server";
import { aprovar, rejeitar } from "@/lib/ia/aprovacoes";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // SEGURANÇA (F-B2/E6): gate de papel SERVER-SIDE — apenas gestor ou owner podem aprovar/rejeitar.
  // getCallerContext (antigo) admitia qualquer atendente; requireCrmGestor fecha a escalada de privilégio
  // sobre o gate do dinheiro (escrow). O guard client-side no layout não é suficiente: um atendente
  // autenticado com a INTERNAL_API_KEY do front poderia chamar PATCH diretamente.
  // tenant vem da SESSÃO (cookie httpOnly), nunca do body/header.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;
  const tenantId = g.ctx.tenantId;

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
    const resultado = await aprovar(id, observacao, tenantId);
    if (!resultado.sucesso) {
      return NextResponse.json({ error: resultado.erro ?? "Falha ao aprovar" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const resultado = await rejeitar(id, motivo?.trim() || "Rejeitado pelo operador", tenantId);
  if (!resultado.sucesso) {
    return NextResponse.json({ error: resultado.erro ?? "Falha ao rejeitar" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
