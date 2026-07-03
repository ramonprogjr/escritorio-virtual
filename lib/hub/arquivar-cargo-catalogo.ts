import type { SupabaseClient } from "@supabase/supabase-js";

export type ArquivarCargoResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; status: number };

/**
 * Princípio do dono (02/jul/2026): NENHUMA exclusão de usuário faz hard-delete — o Hub SÓ ARQUIVA.
 * Antes o endpoint chamava a RPC `hub_delete_cargo_catalogo` (SECURITY DEFINER + `SET LOCAL
 * app.delete_authorized` + `DELETE FROM`). Agora faz soft-archive (`ativo = false`): o cargo
 * PERMANECE no banco, então agentes que o referenciam por título continuam válidos.
 *
 * Mantém as MESMAS guardas da RPC:
 *  - 400 se o slug for inválido;
 *  - 404 se o cargo não existir;
 *  - 409 se houver agentes usando o cargo (mesma checagem por `hub_agente_identidade.cargo = titulo`).
 *
 * A lista GET /api/hub/cargos já esconde inativos por padrão (`if (!all) eq('ativo', true)`), então
 * o cargo arquivado some da tela sem precisar de mudança adicional.
 * Usado por: DELETE /api/hub/cargos e POST /api/hub/cargos/delete-batch.
 */
export async function arquivarCargoCatalogo(
  supabase: SupabaseClient,
  slugRaw: string
): Promise<ArquivarCargoResult> {
  const slug = String(slugRaw ?? "").trim();
  if (slug.length < 2) return { ok: false, error: "slug inválido", status: 400 };

  const { data: cargo, error: loadErr } = await supabase
    .from("hub_cargos_catalogo")
    .select("slug, titulo")
    .eq("slug", slug)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message, status: 500 };
  if (!cargo) return { ok: false, error: "Cargo não encontrado.", status: 404 };

  const titulo = String((cargo as { titulo?: string | null }).titulo ?? "").trim();
  if (titulo) {
    const { count, error: cntErr } = await supabase
      .from("hub_agente_identidade")
      .select("agente_slug", { count: "exact", head: true })
      .eq("cargo", titulo);
    if (cntErr) return { ok: false, error: cntErr.message, status: 500 };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        status: 409,
        error: `Não é possível arquivar: ${count} agente(s) usam o cargo «${titulo}». Atualize os agentes antes de arquivar.`,
      };
    }
  }

  const { error: updErr } = await supabase
    .from("hub_cargos_catalogo")
    .update({ ativo: false })
    .eq("slug", slug);
  if (updErr) return { ok: false, error: updErr.message, status: 500 };
  return { ok: true, slug };
}
