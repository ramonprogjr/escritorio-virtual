import type { PlaybookFlowMenuFormat } from "./flow-definition-types";

/** Lista UAZAPI só quando há 9 ou mais opções; até 8 use botões na conversa. */
export const UAZAPI_MENU_LIST_MIN_OPCOES = 9;

/** @deprecated Use UAZAPI_MENU_LIST_MIN_OPCOES — mantido para imports legados. */
export const UAZAPI_MENU_BUTTON_MAX_OPCOES = UAZAPI_MENU_LIST_MIN_OPCOES - 1;

/**
 * Sugere tipo de menu UAZAPI conforme quantidade de opções.
 * - 1–8: button (botões visíveis no chat)
 * - ≥9: list (botão «Ver opções»)
 * - text: só simulação CRM / fallback sem UAZAPI
 */
export function sugerirMenuTypeUazapi(
  optionCount: number,
  prefer?: PlaybookFlowMenuFormat
): PlaybookFlowMenuFormat {
  if (prefer === "text") return "text";
  if (optionCount <= 0) return "button";
  if (optionCount >= UAZAPI_MENU_LIST_MIN_OPCOES) return "list";
  return "button";
}

export function choicesUazapiFromLabels(
  options: Array<{ id: string; label: string }>
): string[] {
  return options.map((o) => `${o.label.trim()}|${o.id.trim()}`);
}
