import type { crmDb } from "@/lib/crm/supabase-server";
import { ehUuid } from "@/lib/crm/permissao-registro";

/**
 * Resolve UUIDs de usuário → nome humano (name, com fallback e-mail), em LOTE. Só consulta valores que
 * parecem UUID — feito_por/arquivado_por podem ser sentinelas ("humano"/"ia") ou nomes legados, que não
 * viram lookup. Serve à regra da casa "chama pelo NOME" (nunca expor o userId cru de um colega na UI).
 */
export async function resolverNomesUsuarios(
  supabase: ReturnType<typeof crmDb>,
  ids: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(ids.map((v) => String(v ?? "").trim()).filter(ehUuid))];
  if (unicos.length === 0) return mapa;
  const { data, error } = await supabase.from("users").select("id, name, email").in("id", unicos);
  // Falha aqui é segura (todos caem para "Equipe"), mas NUNCA silenciosa — senão some sem sinal.
  if (error) console.error("[resolver-nomes]", error.message);
  for (const u of (data ?? []) as Array<Record<string, unknown>>) {
    const nome = String(u.name ?? "").trim() || String(u.email ?? "").trim();
    if (nome) mapa.set(String(u.id), nome);
  }
  return mapa;
}
