/**
 * Frescor (indicador de RESPOSTA) de um lead — verde/amarelo/vermelho pelo tempo desde a
 * última atualização. É um indicador de FRESCOR, **não** o engine de SLA real (relógio por
 * lead, marcos configuráveis, redistribuição) — isso é o Bloco 5. Pure/testável.
 *
 * Obs.: faz sentido para LEAD (minutos, lead quente). NÃO usar a mesma escala em negócio
 * (que evolui em dias) — lá precisa de semântica própria (Bloco 5).
 */
export type FrescorNivel = "novo" | "atencao" | "atrasado";
export type Frescor = { nivel: FrescorNivel; cor: string; label: string };

/** `agoraMs` injetável para testes determinísticos (default = agora). */
export function frescorLead(iso: string | null | undefined, agoraMs: number = Date.now()): Frescor | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { nivel: "atrasado", cor: "#EF4444", label: "Atrasado" };
  const min = Math.floor((agoraMs - t) / 60000);
  if (min < 5) return { nivel: "novo", cor: "#22C55E", label: "No prazo" };
  if (min < 15) return { nivel: "atencao", cor: "#EAB308", label: "Atenção" };
  return { nivel: "atrasado", cor: "#EF4444", label: "Atrasado" };
}
