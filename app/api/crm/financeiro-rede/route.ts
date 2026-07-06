/**
 * Financeiro de REDE do tenant — o "Meu Dinheiro" do escritorio: TUDO que a rede tem a
 * receber e a pagar (comissoes/recebiveis/taxas), com totais e o extrato dos movimentos.
 * A pergunta nº1 de todo mundo ("quanto tenho pra receber e quando") respondida numa tela.
 *
 * SEGURANCA: crmDb() service_role (bypassa RLS) — isolamento por filtro .eq("tenant_id") puro.
 * TOLERANTE: sem as tabelas do motor (migracao pendente) -> retorna vazio + aviso, nao quebra.
 */
import { NextRequest, NextResponse } from "next/server";
import { crmConfigError, crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;
  const configErr = crmConfigError();
  if (configErr) return NextResponse.json({ error: configErr }, { status: 503 });

  const tenantId = g.ctx.tenantId;
  const db = crmDb();

  const { data: titulos, error } = await db
    .from("hub_negocio_titulos")
    .select("id, negocio_id, direcao, natureza, contraparte_tipo, contraparte_nome, valor_total, valor_exigivel, valor_pago, status, criado_em")
    .eq("tenant_id", tenantId)
    .not("status", "eq", "cancelado")
    .order("criado_em", { ascending: false })
    .limit(300);

  if (error) {
    if (ehTabelaAusente(error)) {
      return NextResponse.json({
        motor_pendente: true,
        aviso: "Financeiro de rede ainda não ativo (migração pendente).",
        totais: { a_receber: 0, a_pagar: 0, exigivel: 0, recebido: 0 },
        titulos: [], movimentos: [], negocios: {},
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const lista = titulos ?? [];
  // Titulos do cliente (recebivel) contam como "a receber do cliente"; comissao 'pagar' = a pagar aos
  // participantes; 'receber' (taxa do Hub) = receita do Hub. Somamos por direcao.
  const totais = lista.reduce(
    (acc, t) => {
      const total = Number(t.valor_total) || 0;
      const exig = Number(t.valor_exigivel) || 0;
      const pago = Number(t.valor_pago) || 0;
      if (t.direcao === "receber") acc.a_receber += total - pago;
      else acc.a_pagar += total - pago;
      acc.exigivel += t.direcao === "pagar" ? exig - pago : 0;
      acc.recebido += pago;
      return acc;
    },
    { a_receber: 0, a_pagar: 0, exigivel: 0, recebido: 0 }
  );
  (Object.keys(totais) as (keyof typeof totais)[]).forEach((k) => (totais[k] = Math.round(totais[k] * 100) / 100));

  // Contexto do negocio (titulo) para cada linha, sem N+1: um SELECT pelos ids distintos.
  const ids = [...new Set(lista.map((t) => String(t.negocio_id)))];
  const negocios: Record<string, string> = {};
  if (ids.length > 0) {
    const { data: negs } = await db.from("hub_negocios").select("id, titulo").in("id", ids).eq("tenant_id", tenantId);
    for (const n of negs ?? []) negocios[String(n.id)] = String(n.titulo ?? "");
  }

  // Extrato: movimentos recentes da rede.
  const { data: movimentos } = await db
    .from("hub_negocio_fin_movimentos")
    .select("id, negocio_id, tipo, valor, descricao, criado_em")
    .eq("tenant_id", tenantId)
    .order("criado_em", { ascending: false })
    .limit(60);

  return NextResponse.json({
    motor_pendente: false,
    totais,
    titulos: lista,
    negocios,
    movimentos: movimentos ?? [],
  });
}
