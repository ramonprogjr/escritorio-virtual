import { NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { isMissingPgColumn } from "@/lib/tenant-default";

/**
 * Helpers compartilhados das rotas de obra (E5+). Ficam AQUI, não em route.ts — o Next 16
 * só permite exportar handlers HTTP + config de um route.ts (exportar helper quebra o typecheck
 * dos tipos gerados). Reusado por sc/estoque/inventario/gerar-sc/financeiro.
 */

/** true quando a tabela/coluna ainda não existe (migração pendente) — degrada, não quebra. */
export function ehTabelaAusente(error: { message?: string } | null): boolean {
  if (!error) return false;
  return isMissingPgColumn(error) || /relation .*does not exist/i.test(error.message ?? "");
}

/**
 * Confirma posse da obra (crmDb é service-role → RLS bypassada; a checagem explícita é a proteção).
 * tenant_id NULL não pertence a ninguém → 404.
 */
export async function assertObraDoTenant(obraId: string, tenantId: string): Promise<NextResponse | null> {
  const { data } = await crmDb()
    .from("hub_obras")
    .select("id, tenant_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) {
    return NextResponse.json({ error: "Obra não encontrada" }, { status: 404 });
  }
  return null;
}
