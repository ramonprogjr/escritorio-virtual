import {
  DEPLOY_CHECKLIST,
  PROGRESSO_FASES,
  PROGRESSO_SISTEMA_REVISAO,
  type ProgressoFase,
  type ProgressoPrioridade,
} from "@/lib/crm/progresso-sistema-data";
import type { ProgressoItemMerged } from "@/lib/crm/progresso-sistema-runtime";

const FASE_ORDER: Record<ProgressoFase, number> = { F0: 0, F1: 1, F2: 2, F3: 3, F4: 4, F5: 5 };
const PRIO_ORDER: Record<ProgressoPrioridade, number> = { P0: 0, P1: 1, P2: 2 };

export type RelatorioDeployResumoItem = {
  titulo: string;
  fase: ProgressoFase;
  texto: string;
};

export type RelatorioDeployChecklist = {
  label: string;
  ok: boolean;
  situacao: string;
};

export type RelatorioDeployFaseResumo = {
  fase: ProgressoFase;
  label: string;
  pct: number;
  texto: string;
};

export type RelatorioDeployResumo = {
  revisaoMatriz: string;
  verificadoEm: string | null;
  ambiente: string | null;
  intro: string;
  situacaoGeral: string;
  concluido: RelatorioDeployResumoItem[];
  emAndamento: RelatorioDeployResumoItem[];
  proximasPrioridades: RelatorioDeployResumoItem[];
  checklistDeploy: RelatorioDeployChecklist[];
  fasesResumo: RelatorioDeployFaseResumo[];
};

function sortItens(items: ProgressoItemMerged[]): ProgressoItemMerged[] {
  return [...items].sort((a, b) => {
    const fd = FASE_ORDER[a.fase] - FASE_ORDER[b.fase];
    if (fd !== 0) return fd;
    return PRIO_ORDER[a.prioridade] - PRIO_ORDER[b.prioridade];
  });
}

function limpar(s: string | undefined | null): string {
  const t = String(s ?? "").trim();
  if (!t || t === "—" || t === "-") return "";
  return t;
}

function labelFase(fase: ProgressoFase): string {
  return PROGRESSO_FASES.find((f) => f.id === fase)?.label ?? fase;
}

export function buildResumoDeployLegivel(input: {
  merged: ProgressoItemMerged[];
  globalPct: number;
  ok: number;
  parcial: number;
  gap: number;
  gapP0: number;
  porFase: Array<{ fase: ProgressoFase; pct: number; ok: number; parcial: number; gap: number }>;
  verificacaoMeta: { geradoEm: string | null; ambiente: string | null };
  deployDetalhe?: Record<string, { ok: boolean; detail: string }> | null;
}): RelatorioDeployResumo {
  const { merged, globalPct, ok, parcial, gap, gapP0, porFase, verificacaoMeta, deployDetalhe } = input;

  const verificadoTxt = verificacaoMeta.geradoEm
    ? `A verificação automática do deploy correu em ${new Date(verificacaoMeta.geradoEm).toLocaleString("pt-BR")}${
        verificacaoMeta.ambiente ? ` (ambiente ${verificacaoMeta.ambiente})` : ""
      }.`
    : "Neste ambiente ainda não há verificação automática pós-deploy — os números abaixo vêm da matriz manual.";

  const intro =
    `Estado do sistema Obra10+ face ao plano dos PDFs Hub (matriz ${PROGRESSO_SISTEMA_REVISAO}). ${verificadoTxt}`;

  const situacaoGeral =
    `Progresso global: ${globalPct}% — ${ok} concluídos, ${parcial} em andamento, ${gap} em aberto` +
    (gapP0 > 0 ? ` (${gapP0} críticos P0).` : ".");

  const actionable = merged.filter((i) => i.status !== "legado");

  const concluido: RelatorioDeployResumoItem[] = [];

  const emAndamento = sortItens(actionable.filter((i) => i.status === "parcial"))
    .slice(0, 6)
    .map((item) => {
      const temos = limpar(item.oQueTemos) || "Base já existe no sistema.";
      const falta = limpar(item.oQueFalta) || "Completar conforme o PDF.";
      return {
        titulo: item.titulo,
        fase: item.fase,
        texto: `Já temos: ${temos} Falta: ${falta}`,
      };
    });

  const proximasPrioridades = sortItens(actionable.filter((i) => i.status === "gap"))
    .slice(0, 5)
    .map((item) => ({
      titulo: item.titulo,
      fase: item.fase,
      texto: limpar(item.oQueFalta) || "Ainda não implementado no sistema.",
    }));

  const checklistDeploy: RelatorioDeployChecklist[] = DEPLOY_CHECKLIST.map((row) => {
    const det = deployDetalhe?.[row.id];
    const okCheck = det?.ok === true;
    let situacao: string;
    if (okCheck) situacao = "OK no deploy";
    else if (det?.detail) situacao = `Pendente — ${det.detail}`;
    else if (row.producao) situacao = "Marcado OK na matriz";
    else situacao = "Pendente em produção";
    return { label: row.label, ok: okCheck || row.producao, situacao };
  });

  const fasesResumo: RelatorioDeployFaseResumo[] = porFase
    .filter((f) => f.ok + f.parcial + f.gap > 0)
    .map((f) => {
      const info = PROGRESSO_FASES.find((p) => p.id === f.fase);
      const texto =
        f.pct >= 80
          ? "Fase praticamente fechada."
          : f.pct >= 50
            ? "Metade do escopo desta fase já está no ar."
            : f.gap > f.ok
              ? "Ainda há bastante trabalho nesta fase."
              : "Em progresso.";
      return {
        fase: f.fase,
        label: labelFase(f.fase),
        pct: f.pct,
        texto: `${info?.escopo ?? ""} — ${texto} (${f.ok} OK, ${f.parcial} parciais, ${f.gap} gaps).`,
      };
    });

  return {
    revisaoMatriz: PROGRESSO_SISTEMA_REVISAO,
    verificadoEm: verificacaoMeta.geradoEm,
    ambiente: verificacaoMeta.ambiente,
    intro,
    situacaoGeral,
    concluido,
    emAndamento,
    proximasPrioridades,
    checklistDeploy,
    fasesResumo,
  };
}
