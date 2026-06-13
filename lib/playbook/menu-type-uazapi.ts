import type { PlaybookFlowMenuFormat } from "./flow-definition-types";

/** WhatsApp: até 3 botões de resposta por mensagem — acima disso use list. */
export const UAZAPI_MENU_BUTTON_MAX_OPCOES = 3;

/**
 * Sugere tipo de menu UAZAPI conforme quantidade de opções.
 * - ≤3: button (como na imagem Telecom)
 * - ≥4: list (abre "Ver opções")
 * - text: só simulação CRM / fallback sem UAZAPI
 */
export function sugerirMenuTypeUazapi(
  optionCount: number,
  prefer?: PlaybookFlowMenuFormat
): PlaybookFlowMenuFormat {
  if (prefer === "text") return "text";
  if (prefer === "button" || prefer === "list") {
    if (prefer === "button" && optionCount > UAZAPI_MENU_BUTTON_MAX_OPCOES) return "list";
    return prefer;
  }
  if (optionCount <= 0) return "list";
  if (optionCount <= UAZAPI_MENU_BUTTON_MAX_OPCOES) return "button";
  return "list";
}

export function choicesUazapiFromLabels(
  options: Array<{ id: string; label: string }>
): string[] {
  return options.map((o) => `${o.label.trim()}|${o.id.trim()}`);
}
