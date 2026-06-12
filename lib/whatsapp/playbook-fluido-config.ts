/** Configuração do modo conversacional (menos fluxo rígido, mais IA). */

function parseBoolEnvOnByDefault(value: string | undefined): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return true;
  return !(raw === "0" || raw === "false" || raw === "off");
}

/** Após a escolha no menu de triagem inicial, a IA conduz o restante (em vez de sub-fluxos determinísticos). */
export function playbookIaAposTriagemEnabled(): boolean {
  return parseBoolEnvOnByDefault(process.env.PLAYBOOK_IA_APOS_TRIAGEM);
}

export function isTriagemInicialMenuStep(stepId: string, field?: string): boolean {
  const id = stepId.trim().toLowerCase();
  if (
    id === "triagem_inicial_menu" ||
    id === "menu_inicial" ||
    id.includes("triagem_inicial") ||
    id.includes("menu_inicial")
  ) {
    return true;
  }
  const f = (field || "").trim().toLowerCase();
  return f === "triagem" || f === "triagem_inicial" || f === "objetivo";
}
