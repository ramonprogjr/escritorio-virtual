/** Normaliza respostas UAZAPI (/instance/connect, /instance/status, etc.) para hub_agente_identidade.uazapi_connection_status */

export type UazapiConnectionStatus = "disconnected" | "connecting" | "connected";

const VALID: ReadonlySet<string> = new Set(["disconnected", "connecting", "connected"]);

export function pickInstanceFromResponse(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const inst = p.instance;
  if (inst && typeof inst === "object" && !Array.isArray(inst)) return inst as Record<string, unknown>;
  return null;
}

function normStatusString(raw: string): UazapiConnectionStatus | null {
  const s = raw.trim().toLowerCase();
  if (VALID.has(s)) return s as UazapiConnectionStatus;
  if (s === "open" || s === "online" || s === "ready") return "connected";
  return null;
}

/**
 * Prioridade (OpenAPI /instance/status):
 * 1. `status.connected === true` (ou loggedIn + connected implícito)
 * 2. `instance.status`
 * 3. `connected` boolean na raiz
 */
export function statusFromPayloadUazapi(payload: unknown): UazapiConnectionStatus {
  if (!payload || typeof payload !== "object") return "disconnected";
  const p = payload as Record<string, unknown>;

  const statusBlock = p.status;
  if (statusBlock && typeof statusBlock === "object" && !Array.isArray(statusBlock)) {
    const so = statusBlock as Record<string, unknown>;
    if (so.connected === true) return "connected";
    if (so.loggedIn === true && so.connected !== false) return "connected";
  }

  if (p.connected === true) return "connected";

  const inst = pickInstanceFromResponse(payload);
  if (inst) {
    const fromInst =
      typeof inst.status === "string" ? normStatusString(inst.status) : null;
    if (fromInst === "connected") return "connected";
    if (fromInst) {
      const blockConnected =
        statusBlock &&
        typeof statusBlock === "object" &&
        !Array.isArray(statusBlock) &&
        (statusBlock as Record<string, unknown>).connected === true;
      if (blockConnected) return "connected";
      return fromInst;
    }
  }

  const rootStatus = typeof p.status === "string" ? normStatusString(p.status) : null;
  if (rootStatus) return rootStatus;

  return "disconnected";
}
