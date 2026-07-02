import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getCallerContext } from "@/lib/crm/crm-api-auth";
import { isMissingPgColumn } from "@/lib/tenant-default";

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

  let { data, error } = await db()
    .from("hub_aprovacoes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", status)
    .order("criado_em", { ascending: false });

  // AP1: hub_aprovacoes ainda sem a coluna tenant_id (migração multi-tenant não aplicada) → 42703.
  // Sem a coluna não há como escopar; com 1 tenant hoje é seguro. Some quando a migração criar a coluna.
  if (error && isMissingPgColumn(error, "tenant_id")) {
    ({ data, error } = await db()
      .from("hub_aprovacoes")
      .select("*")
      .eq("status", status)
      .order("criado_em", { ascending: false }));
  }

  if (error) {
    console.error("[aprovacoes] GET falhou:", error.message); // não expõe SQL cru (AP2)
    return NextResponse.json({ error: "Não foi possível carregar as aprovações." }, { status: 500 });
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
