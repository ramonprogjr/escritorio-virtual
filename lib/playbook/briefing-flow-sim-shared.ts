/** Tipos e helpers seguros para o browser (sem motor de fluxo / node:fs). */

export type BriefingSimMenuChoice = {
  id: string;
  label: string;
};

export type BriefingSimOutboundPart =
  | { kind: "text"; text: string }
  | {
      kind: "menu";
      text: string;
      menu_type: "list" | "button" | "text";
      choices: BriefingSimMenuChoice[];
      list_button?: string;
    };

export type BriefingFlowSimState = {
  step: string | null;
  answers: Record<string, string>;
  active: boolean;
  complete: boolean;
  handoff_ia: boolean;
};

export const BRIEFING_FLOW_SIM_STATE_KEY = "wa_sim_flow_state";

export function emptyBriefingFlowSimState(): BriefingFlowSimState {
  return {
    step: null,
    answers: {},
    active: false,
    complete: false,
    handoff_ia: false,
  };
}

export function parseBriefingFlowSimState(raw: unknown): BriefingFlowSimState | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    step: typeof o.step === "string" ? o.step : o.step === null ? null : null,
    answers:
      o.answers && typeof o.answers === "object"
        ? Object.fromEntries(
            Object.entries(o.answers as Record<string, unknown>).map(([k, v]) => [k, String(v)])
          )
        : {},
    active: o.active === true,
    complete: o.complete === true,
    handoff_ia: o.handoff_ia === true,
  };
}

export function resolverFlowStateParaSimulacao(
  bodyRaw: unknown,
  historicoComMetadata: Array<{ papel: string; metadata?: unknown }>
): BriefingFlowSimState {
  const fromBody = parseBriefingFlowSimState(bodyRaw) ?? emptyBriefingFlowSimState();
  if (fromBody.step || fromBody.complete) return fromBody;

  for (let i = historicoComMetadata.length - 1; i >= 0; i -= 1) {
    const row = historicoComMetadata[i];
    if (row.papel !== "assistant") continue;
    const meta =
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null;
    const recovered = parseBriefingFlowSimState(meta?.[BRIEFING_FLOW_SIM_STATE_KEY]);
    if (recovered && (recovered.step || recovered.complete)) return recovered;
  }

  return fromBody;
}

export function partToDisplayText(part: BriefingSimOutboundPart): string {
  if (part.kind === "text") return part.text;
  if (part.kind === "menu") {
    if (part.menu_type === "text") {
      const lines = part.choices.map((c, i) => `${i + 1}. ${c.label.trim()}`);
      return [part.text.trim(), ...lines].filter(Boolean).join("\n");
    }
    return part.text.trim();
  }
  return "";
}
