import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve pipeline de leads por mercado (fallback: pipeline global sem mercado_sigla). */
export async function resolverPipelineLeadPorMercado(
  supabase: SupabaseClient,
  mercado: string
): Promise<string | null> {
  const m = mercado.trim().toUpperCase();
  if (!m) return resolverPipelineLeadGlobal(supabase);

  const { data: porMercado } = await supabase
    .from("hub_pipelines")
    .select("id")
    .eq("tipo", "lead")
    .eq("ativo", true)
    .eq("mercado_sigla", m)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (porMercado?.id) return String(porMercado.id);
  return resolverPipelineLeadGlobal(supabase);
}

async function resolverPipelineLeadGlobal(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("hub_pipelines")
    .select("id")
    .eq("tipo", "lead")
    .eq("ativo", true)
    .is("mercado_sigla", null)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

/** Resolve pipeline de NEGÓCIO por mercado (fallback: pipeline global). Espelha o de leads. */
export async function resolverPipelineNegocioPorMercado(
  supabase: SupabaseClient,
  mercado: string
): Promise<string | null> {
  const m = mercado.trim().toUpperCase();
  if (m) {
    const { data: porMercado } = await supabase
      .from("hub_pipelines")
      .select("id")
      .eq("tipo", "negocio")
      .eq("ativo", true)
      .eq("mercado_sigla", m)
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (porMercado?.id) return String(porMercado.id);
  }
  const { data } = await supabase
    .from("hub_pipelines")
    .select("id")
    .eq("tipo", "negocio")
    .eq("ativo", true)
    .is("mercado_sigla", null)
    .order("ordem", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

/** Enriquece row de insert/update de lead com pipeline e estagio funil. */
export async function enriquecerLeadComPipeline(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
  mercado: string
): Promise<Record<string, unknown>> {
  const pipelineId = await resolverPipelineLeadPorMercado(supabase, mercado);
  const out = { ...row };
  if (pipelineId) out.pipeline_id = pipelineId;
  if (!out.estagio_funil) out.estagio_funil = out.estagio ?? "novo";
  return out;
}
