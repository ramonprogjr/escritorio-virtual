import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { requireCrmAprovador } from "@/lib/crm/crm-api-auth";
import { isCrmGestorRole } from "@/lib/crm/crm-permissoes";
import { roleTemCapacidade } from "@/lib/rbac/role-map";
import { TIPOS_ESCROW_CHAVE_TECNICA } from "@/lib/crm/aprovacoes-tipos";
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
  //
  // GUARD (Onda 2): mesmo gate do PATCH (requireCrmAprovador) — gestor/owner OU portador de
  // uma chave de escrow. Antes o GET aceitava QUALQUER sessão do tenant e devolvia TODAS as
  // aprovações (cotação/orçamento/genéricas incluídas); alinha a API ao gate da tela.
  const g = await requireCrmAprovador(request);
  if ("error" in g) return g.error;
  const tenantId = g.ctx.tenantId;
  const role = g.ctx.role;

  // FILTRO SERVER-SIDE (Onda 2, invariante a): o portador de escrow-capability que NÃO é gestor
  // (architect/operation) só pode DECIDIR as CHAVES de escrow — logo só pode LER esses tipos.
  // Nunca recebe cotação/orçamento/genéricas (alçada comercial). Gestor/owner (isCrmGestorRole)
  // caem fora deste flag e veem TUDO (invariante c). Espelha o predicado `soAssinaChave` de
  // aprovar()/rejeitar() (fonte única do comportamento fila↔gate).
  const soAssinaChave =
    !isCrmGestorRole(role) &&
    (roleTemCapacidade(role, "escrow:chave_tecnica") ||
      roleTemCapacidade(role, "escrow:chave_hub"));

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pendente";

  let query = db()
    .from("hub_aprovacoes")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", status);
  if (soAssinaChave) query = query.in("tipo", TIPOS_ESCROW_CHAVE_TECNICA);

  let { data, error } = await query.order("criado_em", { ascending: false });

  // AP1: hub_aprovacoes ainda sem a coluna tenant_id (migração multi-tenant não aplicada) → 42703.
  // Sem a coluna não há como escopar; com 1 tenant hoje é seguro. Some quando a migração criar a coluna.
  // O filtro de tipo de escrow é reaplicado AQUI TAMBÉM — senão o caminho legado vazaria todos os
  // tipos ao portador de chave (fail-closed nas DUAS ramificações).
  if (error && isMissingPgColumn(error, "tenant_id")) {
    let fallback = db().from("hub_aprovacoes").select("*").eq("status", status);
    if (soAssinaChave) fallback = fallback.in("tipo", TIPOS_ESCROW_CHAVE_TECNICA);
    ({ data, error } = await fallback.order("criado_em", { ascending: false }));
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
