/** Columns from supabase/migrations/20260516120000_hub_agente_ferramentas_mistral.sql */

export const HUB_AGENTE_FERRAMENTAS_MIGRATION_KEYS = [
  "motor_ferramentas_habilitado",
  "mistral_agent_sync_habilitado",
  "uso_ferramentas_ia",
  "mistral_agent_id",
  "mistral_agent_sync_em",
  "mistral_agent_sync_erro",
] as const;

const FERRAMENTAS_COLUMN_MARKERS = HUB_AGENTE_FERRAMENTAS_MIGRATION_KEYS;

export function isHubAgenteFerramentasColumnsMissing(message?: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  if (!m.includes("hub_agente_identidade")) return false;
  if (!FERRAMENTAS_COLUMN_MARKERS.some((col) => m.includes(col.toLowerCase())))
    return false;
  return (
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find")
  );
}

export function omitHubAgenteFerramentasMigrationKeys(
  row: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...row };
  for (const k of HUB_AGENTE_FERRAMENTAS_MIGRATION_KEYS) {
    delete out[k];
  }
  return out;
}
