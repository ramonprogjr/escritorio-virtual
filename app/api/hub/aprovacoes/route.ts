import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCallerContext } from "@/lib/crm/crm-api-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível" }, { status: 503 });
  }

  // SEGURANÇA (F0/E6): a fila de aprovações é SEMPRE do tenant da sessão. service_role bypassa RLS,
  // então o `.eq("tenant_id")` no código é a única barreira contra ler a fila de outro tenant.
  const g = await getCallerContext(request);
  if ("error" in g) return g.error;
  const tenantId = g.ctx.tenantId;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pendente";

  const query = db()
    .from("hub_aprovacoes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", status)
    .order("criado_em", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const aprovacoes = (data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    descricao: row.descricao ?? row.titulo ?? "Aprovação",
    motivo: row.motivo ?? row.descricao ?? "",
    agente_slug: row.agente_slug ?? row.solicitado_por ?? "sdr",
    agente_nome: row.agente_nome ?? row.agente_slug ?? "IA",
    // Sem default fabricado: só mostra confiança quando a IA realmente computou (a UI esconde se ausente).
    confianca_ia: row.confianca_ia ?? null,
    valor_envolvido: row.valor_envolvido ?? row.valor ?? 0,
  }));

  return NextResponse.json({ aprovacoes });
}
