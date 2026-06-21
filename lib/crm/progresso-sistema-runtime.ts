import artifact from "./progresso-verificacao.generated.json";
import {
  PROGRESSO_BLOCOS,
  allProgressoItens,
  DEPLOY_CHECKLIST,
  type ProgressoItem,
  type ProgressoStatus,
  type ProgressoFase,
  type ProgressoPrioridade,
} from "./progresso-sistema-data";
import type { ProgressoCheckResult, ProgressoVerificacaoArtifact } from "./progresso-checks-types";

export type ProgressoItemMerged = ProgressoItem & {
  verificacao?: ProgressoCheckResult[];
  statusFonte?: "deploy" | "manual";
};

const STATUS_SCORE: Record<ProgressoStatus, number> = {
  ok: 100,
  parcial: 50,
  gap: 0,
  legado: 100,
};

function getArtifact(): ProgressoVerificacaoArtifact | null {
  try {
    return artifact as ProgressoVerificacaoArtifact;
  } catch {
    return null;
  }
}

export function getProgressoVerificacaoMeta(): { geradoEm: string | null; ambiente: string | null } {
  const a = getArtifact();
  return { geradoEm: a?.geradoEm ?? null, ambiente: a?.ambiente ?? null };
}

/** Junta metadados estáticos com status verificado no último deploy. */
export function mergeProgressoItens(): ProgressoItemMerged[] {
  const a = getArtifact();
  return allProgressoItens().map((item) => {
    const v = a?.itens[item.id];
    if (!v) {
      return { ...item, statusFonte: "manual" as const };
    }
    return {
      ...item,
      status: v.status,
      oQueFalta: v.oQueFalta,
      verificacao: v.checks,
      statusFonte: "deploy" as const,
    };
  });
}

export function mergeProgressoBlocos() {
  const merged = mergeProgressoItens();
  const byId = Object.fromEntries(merged.map((i) => [i.id, i]));
  return PROGRESSO_BLOCOS.map((bloco) => ({
    ...bloco,
    itens: bloco.itens.map((i) => byId[i.id] ?? i),
  }));
}

export function computeProgressoStats(itens: ProgressoItem[] = mergeProgressoItens()) {
  const actionable = itens.filter((i) => i.status !== "legado");
  const total = actionable.length;
  const sum = actionable.reduce((acc, i) => acc + STATUS_SCORE[i.status], 0);
  const globalPct = total > 0 ? Math.round(sum / total) : 0;
  const ok = itens.filter((i) => i.status === "ok").length;
  const parcial = itens.filter((i) => i.status === "parcial").length;
  const gap = itens.filter((i) => i.status === "gap").length;
  const gapP0 = itens.filter((i) => i.status === "gap" && i.prioridade === "P0").length;
  const byFase = (["F0", "F1", "F2", "F3", "F4", "F5"] as ProgressoFase[]).map((f) => {
    const phaseItems = itens.filter((i) => i.fase === f && i.status !== "legado");
    const count = itens.filter((i) => i.fase === f).length;
    const okCount = phaseItems.filter((i) => i.status === "ok").length;
    const parcialCount = phaseItems.filter((i) => i.status === "parcial").length;
    const gapCount = phaseItems.filter((i) => i.status === "gap").length;
    const pct =
      phaseItems.length > 0
        ? Math.round(phaseItems.reduce((a, i) => a + STATUS_SCORE[i.status], 0) / phaseItems.length)
        : 0;
    const emAberto = parcialCount + gapCount;
    return { fase: f, count, pct, okCount, parcialCount, gapCount, emAberto, actionable: phaseItems.length };
  });
  const byBloco = PROGRESSO_BLOCOS.map((b) => {
    const bi = b.itens
      .map((i) => itens.find((x) => x.id === i.id) ?? i)
      .filter((i) => i.status !== "legado");
    const pct = bi.length > 0 ? Math.round(bi.reduce((a, i) => a + STATUS_SCORE[i.status], 0) / bi.length) : 0;
    return { id: b.id, titulo: b.titulo, pct, total: b.itens.length };
  });
  return { globalPct, ok, parcial, gap, gapP0, total: itens.length, actionableTotal: total, byFase, byBloco };
}

const FASE_ORDER: Record<ProgressoFase, number> = { F0: 0, F1: 1, F2: 2, F3: 3, F4: 4, F5: 5 };

export function getProximosPassos(itens: ProgressoItem[] = mergeProgressoItens()): ProgressoItem[] {
  return itens
    .filter((i) => i.prioridade === "P0" && (i.status === "gap" || i.status === "parcial"))
    .sort((a, b) => FASE_ORDER[a.fase] - FASE_ORDER[b.fase]);
}

const PRIORIDADE_ORDER: Record<ProgressoPrioridade, number> = { P0: 0, P1: 1, P2: 2 };
const STATUS_SORT_ORDER: Record<ProgressoStatus, number> = { gap: 0, parcial: 1, ok: 2, legado: 3 };

function sortItensFase(items: ProgressoItem[]): ProgressoItem[] {
  return [...items].sort((a, b) => {
    const pd = PRIORIDADE_ORDER[a.prioridade] - PRIORIDADE_ORDER[b.prioridade];
    if (pd !== 0) return pd;
    return STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status];
  });
}

export function getItensPorFase(fase: ProgressoFase, itens: ProgressoItem[] = mergeProgressoItens()): ProgressoItem[] {
  return sortItensFase(itens.filter((i) => i.fase === fase && i.status !== "legado"));
}

export function getItensAbertosPorFase(fase: ProgressoFase, itens: ProgressoItem[] = mergeProgressoItens()): ProgressoItem[] {
  return sortItensFase(itens.filter((i) => i.fase === fase && (i.status === "gap" || i.status === "parcial")));
}

export function getBlocoPct(blocoId: string, itens: ProgressoItem[] = mergeProgressoItens()): number {
  const bloco = PROGRESSO_BLOCOS.find((b) => b.id === blocoId);
  if (!bloco) return 0;
  const bi = bloco.itens
    .map((i) => itens.find((x) => x.id === i.id) ?? i)
    .filter((i) => i.status !== "legado");
  if (bi.length === 0) return 0;
  return Math.round(bi.reduce((a, i) => a + STATUS_SCORE[i.status], 0) / bi.length);
}

export function getFunilLeadViz(itens: ProgressoItem[] = mergeProgressoItens()) {
  const bloco = PROGRESSO_BLOCOS.find((b) => b.id === "funil-leads");
  const map: Record<string, string> = {
    "fl-novo": "Novo",
    "fl-em-atendimento": "Em atendimento",
    "fl-aguardando": "Aguardando resposta",
    "fl-qualificando": "Qualificando",
    "fl-encaminhado": "Encaminhado",
    "fl-convertido": "Convertido",
    "fl-perdido": "Perdido",
    "fl-spam": "Spam",
  };
  const byId = Object.fromEntries(itens.map((i) => [i.id, i]));
  return (bloco?.itens ?? [])
    .filter((i) => map[i.id])
    .map((i) => {
      const m = byId[i.id] ?? i;
      return { slug: i.id, label: map[i.id]!, status: m.status };
    });
}

export function getMercadosViz(itens: ProgressoItem[] = mergeProgressoItens()) {
  const bloco = PROGRESSO_BLOCOS.find((b) => b.id === "funil-negocios");
  const byId = Object.fromEntries(itens.map((i) => [i.id, i]));
  return (bloco?.itens ?? [])
    .filter((i) => i.id.startsWith("fn-") && i.id !== "fn-card" && i.id !== "fn-derivados")
    .map((i) => {
      const m = byId[i.id] ?? i;
      return {
        label: i.titulo.replace(/^Mercado\s+/i, "").replace(/\s*\(\d+.*\)$/, ""),
        status: m.status,
        pct: STATUS_SCORE[m.status],
      };
    });
}

export function getDeployStats() {
  const a = getArtifact();
  const total = DEPLOY_CHECKLIST.length;
  if (!a?.deploy) {
    const local = DEPLOY_CHECKLIST.filter((d) => d.local).length;
    const staging = DEPLOY_CHECKLIST.filter((d) => d.staging).length;
    const producao = DEPLOY_CHECKLIST.filter((d) => d.producao).length;
    const bloqueadores = DEPLOY_CHECKLIST.filter(
      (d) => (d.id.startsWith("mig-") || d.id.startsWith("smoke-")) && !d.producao
    );
    return {
      total,
      local,
      staging,
      producao,
      bloqueadoresPendentes: bloqueadores.length,
      bloqueadoresTotal: bloqueadores.length,
      verificado: false,
    };
  }
  const okIds = Object.values(a.deploy).filter((d) => d.ok).map((d) => d.id);
  const okSet = new Set(okIds);
  const local = DEPLOY_CHECKLIST.filter((d) => okSet.has(d.id)).length;
  const bloqueadores = DEPLOY_CHECKLIST.filter((d) => d.id.startsWith("mig-") || d.id.startsWith("smoke-"));
  const bloqueadoresPendentes = bloqueadores.filter((d) => !okSet.has(d.id)).length;
  return {
    total,
    local,
    staging: local,
    producao: local,
    bloqueadoresPendentes,
    bloqueadoresTotal: bloqueadores.length,
    verificado: true,
    deployDetalhe: a.deploy,
  };
}

const FASES_LIST: ProgressoFase[] = ["F0", "F1", "F2", "F3", "F4", "F5"];

export function countP0AbertoFase(fase: ProgressoFase, itens: ProgressoItem[] = mergeProgressoItens()): number {
  return itens.filter(
    (i) => i.fase === fase && i.prioridade === "P0" && (i.status === "gap" || i.status === "parcial")
  ).length;
}

export function faseAnteriorComP0Aberto(fase: ProgressoFase, itens: ProgressoItem[] = mergeProgressoItens()): ProgressoFase | null {
  const idx = FASE_ORDER[fase];
  for (let i = idx - 1; i >= 0; i--) {
    const prev = FASES_LIST[i]!;
    if (countP0AbertoFase(prev, itens) > 0) return prev;
  }
  return null;
}
