import { NextRequest, NextResponse } from "next/server";
import { aprovar, rejeitar } from "@/lib/ia/aprovacoes";
import { requireCrmAprovador } from "@/lib/crm/crm-api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // SEGURANÇA (F-B2/E6 + Onda 1): gate de papel SERVER-SIDE. requireCrmAprovador admite gestor/
  // owner (aprovações gerais) OU portador de capacidade de escrow (architect/operation → Chave
  // Técnica) — SEM elevar o nível CRM desses papéis. Dentro de aprovar(): tipos não-escrow exigem
  // gestor+, e a chave em si é fail-closed por capability + humano-distinto. tenant vem da SESSÃO.
  const g = await requireCrmAprovador(request);
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
    // Onda 1b: passa papel + IDENTIDADE HUMANA (pessoa física + flag de cookie) p/ o gate
    // das 2 chaves do escrow (capability + duas autoridades distintas + só humano assina).
    const resultado = await aprovar(id, observacao, tenantId, g.ctx.role, {
      userId: g.ctx.userId,
      ehHumano: g.ctx.ehHumano,
    });
    if (!resultado.sucesso) {
      return NextResponse.json({ error: resultado.erro ?? "Falha ao aprovar" }, { status: 400 });
    }
    // Contrato aditivo: o efeito FIEL da cascata (escrow liberado / aguardando 2ª chave / etc.)
    // flui até a UI. O endpoint responde 200 mesmo em dupla_incompleta — o texto deriva de `efeito`.
    return NextResponse.json({ ok: true, efeito: resultado.efeito });
  }

  const resultado = await rejeitar(id, motivo?.trim() || "Rejeitado pelo operador", tenantId, g.ctx.role);
  if (!resultado.sucesso) {
    return NextResponse.json({ error: resultado.erro ?? "Falha ao rejeitar" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
