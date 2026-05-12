// Avaliação da matriz hub_autonomia_matriz (complementa hub_hierarquia no router).

export type CanalAutonomia = "whatsapp" | "instagram" | "email" | "interno" | "site";

export interface HubAutonomiaMatrizRow {
  id: string;
  agente_slug: string;
  canal: string | null;
  nome: string;
  prioridade: number;
  ativo: boolean;
  exige_aprovacao: boolean;
  limite_autonomia_brl: number | string | null;
  palavras_chave: string[] | null;
  regex_opcional: string | null;
  observacao?: string | null;
}

function regraCorrespondeMensagem(
  mensagemLower: string,
  palavras: string[] | null | undefined,
  regex: string | null | undefined
): boolean {
  const lista = palavras?.filter((p) => p && p.trim().length > 0) ?? [];
  const temRegex = Boolean(regex?.trim());
  if (lista.length === 0 && !temRegex) return true;

  if (lista.length > 0) {
    const matchPalavra = lista.some((p) => mensagemLower.includes(p.toLowerCase().trim()));
    if (matchPalavra) return true;
  }
  if (temRegex) {
    try {
      return new RegExp(regex!.trim(), "i").test(mensagemLower);
    } catch {
      return false;
    }
  }
  return false;
}

/** Primeira regra aplicável em ordem de prioridade (maior primeiro) bloqueia. */
export function avaliarRegrasMatriz(
  regras: HubAutonomiaMatrizRow[],
  mensagem: string,
  valorEnvolvido: number
): { bloqueado: boolean; motivo: string } | null {
  const m = mensagem.toLowerCase();
  const ordenadas = [...regras].sort((a, b) => (b.prioridade ?? 0) - (a.prioridade ?? 0));
  for (const r of ordenadas) {
    if (!regraCorrespondeMensagem(m, r.palavras_chave, r.regex_opcional)) continue;
    if (r.exige_aprovacao) {
      return { bloqueado: true, motivo: `Política "${r.nome}": exige aprovação humana.` };
    }
    if (r.limite_autonomia_brl != null && r.limite_autonomia_brl !== "") {
      const lim = Number(r.limite_autonomia_brl);
      if (!Number.isNaN(lim) && valorEnvolvido > lim) {
        return {
          bloqueado: true,
          motivo: `Política "${r.nome}": valor acima do limite da matriz (R$ ${lim.toLocaleString("pt-BR")}).`,
        };
      }
    }
  }
  return null;
}

/** Filtro em memória por canal (PostgREST or() com NULL é verboso). */
export function filtrarRegrasPorCanal<T extends { canal: string | null }>(
  regras: T[],
  canal: CanalAutonomia | undefined
): T[] {
  return regras.filter((r) => {
    const c = r.canal;
    if (c == null || c === "*") return true;
    if (!canal) return c === "*" || c === null;
    return c === canal;
  });
}
