import type { SupabaseClient } from "@supabase/supabase-js";

export type HubFerramentaCustomRow = {
  id: string;
  tenant_id: string;
  ferramenta_key: string;
  titulo: string;
  /** Resumo para administradores na UI (opcional). */
  descricao_curta?: string | null;
  descricao_modelo: string;
  builtin_impl: string;
  parametros_schema: unknown;
  smart_provider: string;
  smart_model: string | null;
  smart_prompt: string | null;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
};

export type FerramentaCustomParaMistral = {
  ferramenta_key: string;
  descricao_modelo: string;
  parametros_schema: Record<string, unknown>;
};

export function rowParaMistralDef(row: HubFerramentaCustomRow): FerramentaCustomParaMistral {
  const schema =
    row.parametros_schema && typeof row.parametros_schema === "object" && !Array.isArray(row.parametros_schema)
      ? (row.parametros_schema as Record<string, unknown>)
      : { type: "object", properties: {}, additionalProperties: false };
  return {
    ferramenta_key: row.ferramenta_key,
    descricao_modelo: row.descricao_modelo,
    parametros_schema: schema,
  };
}

export async function fetchFerramentasCustomAtivas(
  supabase: SupabaseClient,
  tenantId: string
): Promise<HubFerramentaCustomRow[]> {
  const { data, error } = await supabase
    .from("hub_ferramentas_custom")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ativo", true);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []) as HubFerramentaCustomRow[];
}

export async function fetchFerramentaCustomPorKey(
  supabase: SupabaseClient,
  tenantId: string,
  ferramentaKey: string
): Promise<HubFerramentaCustomRow | null> {
  const { data, error } = await supabase
    .from("hub_ferramentas_custom")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("ferramenta_key", ferramentaKey)
    .eq("ativo", true)
    .maybeSingle();
  if (error) {
    return null;
  }
  return data as HubFerramentaCustomRow | null;
}

export function slugifyFerramentaCustomSlug(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return s;
}

export function ferramentaKeyAPartirDeSlugCurto(slugCurto: string): string {
  const s = slugifyFerramentaCustomSlug(slugCurto);
  if (s.length < 2) return "";
  return `hub_custom_${s}`;
}

export function smartProviderValido(v: string): v is "none" | "mistral" | "gemini" {
  return v === "none" || v === "mistral" || v === "gemini";
}
