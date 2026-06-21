import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { buildRelatorioDesenvolvimentoEstruturado, type RelatorioDesenvolvimentoEstruturado } from "@/lib/crm/relatorio-desenvolvimento-estruturado";
import { allProgressoItens, type ProgressoItem } from "@/lib/crm/progresso-sistema-data";

export type RelatorioGitEntrega = {
  hash: string;
  hashCurto: string;
  mensagem: string;
  /** Mensagem original do Git (com prefixo conventional commit, se existir). */
  mensagemRaw?: string;
  autor: string;
  dataIso: string;
  hora: string;
  arquivos: string[];
  areas: Record<string, number>;
};

export type RelatorioEntregaRelacionada = {
  id: string;
  titulo: string;
  ficheirosCoincidentes: string[];
};

export type RelatorioDesenvolvimento = {
  entregas: RelatorioGitEntrega[];
  resumo: string;
  estruturado: RelatorioDesenvolvimentoEstruturado;
  entregasRelacionadas: RelatorioEntregaRelacionada[];
  fonte: "git-live" | "artefato" | "vazio";
  totais: {
    commits: number;
    ficheiros: number;
    areas: Record<string, number>;
  };
};

export type RelatorioEntregasArtifact = {
  geradoEm: string;
  dias: number;
  commits: RelatorioGitEntrega[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dayBoundsUtc(dateStr: string): { start: string; end: string } {
  if (!DATE_RE.test(dateStr)) {
    const today = new Date().toISOString().slice(0, 10);
    return dayBoundsUtc(today);
  }
  const [y, m, d] = dateStr.split("-").map(Number);
  /** Meia-noite em America/Sao_Paulo (UTC−3) — alinhado ao dia de trabalho local. */
  const start = new Date(Date.UTC(y!, m! - 1, d!, 3, 0, 0, 0));
  const end = new Date(Date.UTC(y!, m! - 1, d! + 1, 3, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function commitDateKeyLocal(dataIso: string): string {
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const AREA_LABELS: Record<string, string> = {
  "app/crm": "CRM (páginas)",
  "app/hub": "Hub público (páginas)",
  "app/api": "APIs",
  "lib/crm": "Biblioteca CRM",
  "lib/hub": "Biblioteca Hub",
  "components/crm": "Componentes CRM",
  "components/hub": "Componentes Hub",
  "supabase/migrations": "Migrations BD",
  outros: "Outros",
};

const ARQUIVO_RELATORIO_EXCLUIR_PREFIXOS = [
  ".cursor/",
  ".ai-skills/",
  ".next/",
  ".next-dev/",
  "node_modules/",
];

const ARQUIVO_RELATORIO_EXCLUIR_NOMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);

/** Exclui ruído (IDE, cache, locks) dos ficheiros listados no relatório. */
export function filtrarArquivoRelatorio(filePath: string): boolean {
  const p = filePath.replace(/\\/g, "/").trim();
  if (!p) return false;
  const base = p.split("/").pop() ?? p;
  if (ARQUIVO_RELATORIO_EXCLUIR_NOMES.has(base)) return false;
  if (p.endsWith(".generated.json") || p.endsWith(".tsbuildinfo")) return false;
  if (ARQUIVO_RELATORIO_EXCLUIR_PREFIXOS.some((prefix) => p.startsWith(prefix))) return false;
  return true;
}

function filtrarArquivosRelatorio(arquivos: string[]): string[] {
  return arquivos.filter(filtrarArquivoRelatorio);
}

function repoRoot(): string {
  return process.cwd();
}

function gitAvailable(): boolean {
  return existsSync(path.join(repoRoot(), ".git"));
}

function runGit(args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot(),
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

export function classificarArea(filePath: string): string {
  const p = filePath.replace(/\\/g, "/");
  if (p.startsWith("app/crm/")) return "app/crm";
  if (p.startsWith("app/cadastre-se/") || p.startsWith("app/login/") || p === "app/page.tsx") {
    return "app/hub";
  }
  if (p.startsWith("app/api/")) return "app/api";
  if (p.startsWith("lib/crm/")) return "lib/crm";
  if (p.startsWith("lib/hub/")) return "lib/hub";
  if (p.startsWith("components/crm/")) return "components/crm";
  if (p.startsWith("components/hub/")) return "components/hub";
  if (p.startsWith("supabase/migrations/")) return "supabase/migrations";
  return "outros";
}

function contarAreas(arquivos: string[]): Record<string, number> {
  const areas: Record<string, number> = {};
  for (const f of arquivos) {
    const a = classificarArea(f);
    areas[a] = (areas[a] ?? 0) + 1;
  }
  return areas;
}

export function normalizarMensagemCommit(msg: string): string {
  const t = msg.trim();
  const conv = t.match(/^(feat|fix|chore|docs|refactor|style|test)(\([^)]+\))?!?:\s*(.+)$/i);
  if (conv?.[3]) return conv[3].trim();
  return t;
}

function parseCommitLine(line: string): { hash: string; mensagem: string; autor: string; dataIso: string } | null {
  const parts = line.split("|");
  if (parts.length < 4) return null;
  const [hash, mensagem, autor, dataIso] = parts;
  if (!hash || !dataIso) return null;
  return { hash, mensagem: mensagem ?? "", autor: autor ?? "", dataIso };
}

function arquivosDoCommit(hash: string): string[] {
  try {
    const out = runGit(["show", "--name-only", "--pretty=format:", hash]);
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function formatHora(dataIso: string): string {
  try {
    return new Date(dataIso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function normalizarEntrega(entrega: RelatorioGitEntrega): RelatorioGitEntrega {
  const arquivos = filtrarArquivosRelatorio(entrega.arquivos);
  return { ...entrega, arquivos, areas: contarAreas(arquivos) };
}

function toEntrega(raw: { hash: string; mensagem: string; autor: string; dataIso: string }): RelatorioGitEntrega {
  const arquivos = filtrarArquivosRelatorio(arquivosDoCommit(raw.hash));
  const parsed = new Date(raw.dataIso);
  const dataIsoNorm = Number.isNaN(parsed.getTime()) ? raw.dataIso : parsed.toISOString();
  return {
    hash: raw.hash,
    hashCurto: raw.hash.slice(0, 7),
    mensagem: normalizarMensagemCommit(raw.mensagem),
    mensagemRaw: raw.mensagem,
    autor: raw.autor,
    dataIso: dataIsoNorm,
    hora: formatHora(dataIsoNorm),
    arquivos,
    areas: contarAreas(arquivos),
  };
}

/** Coleta commits entre duas datas ISO (since/until). */
export function collectGitEntregasBetween(sinceIso: string, untilIso: string): RelatorioGitEntrega[] {
  if (!gitAvailable()) return [];
  try {
    const log = runGit([
      "log",
      `--since=${sinceIso}`,
      `--until=${untilIso}`,
      "--pretty=format:%H|%s|%an|%ai",
    ]);
    if (!log) return [];
    return log
      .split(/\r?\n/)
      .map(parseCommitLine)
      .filter((r): r is NonNullable<typeof r> => r != null)
      .map(toEntrega);
  } catch {
    return [];
  }
}

/** Últimos N dias — usado no build para gerar artefacto. */
export function collectGitEntregasUltimosDias(dias: number): RelatorioGitEntrega[] {
  const until = new Date();
  const since = new Date(until.getTime() - dias * 24 * 60 * 60 * 1000);
  return collectGitEntregasBetween(since.toISOString(), until.toISOString());
}

export function getGitEntregasNoDia(dateStr: string): RelatorioGitEntrega[] {
  const { start, end } = dayBoundsUtc(dateStr);
  return collectGitEntregasBetween(start, end);
}

function loadArtifact(): RelatorioEntregasArtifact | null {
  try {
    const p = path.join(process.cwd(), "lib/crm/relatorio-entregas.generated.json");
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf8")) as RelatorioEntregasArtifact;
  } catch {
    return null;
  }
}

function filterEntregasFromArtifact(dateStr: string): RelatorioGitEntrega[] {
  const art = loadArtifact();
  if (!art?.commits?.length) return [];
  return art.commits
    .filter((c) => commitDateKeyLocal(c.dataIso) === dateStr)
    .map(normalizarEntrega);
}

function pathsProgressoItem(item: ProgressoItem): string[] {
  const paths: string[] = [];
  if (item.codigo) paths.push(item.codigo.replace(/\\/g, "/"));
  if (item.rota) {
    const seg = item.rota.replace(/^\/crm\/?/, "").split("/").filter(Boolean);
    paths.push(seg.length ? `app/crm/${seg.join("/")}` : "app/crm/page.tsx");
  }
  if (item.migration) paths.push(`supabase/migrations/${item.migration}`);
  return paths;
}

function itemMatchesFile(item: ProgressoItem, filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  for (const p of pathsProgressoItem(item)) {
    if (norm === p || norm.startsWith(`${p}/`) || p.startsWith(norm) || norm.includes(p)) return true;
  }
  return false;
}

export function relacionarEntregasComMatriz(entregas: RelatorioGitEntrega[]): RelatorioEntregaRelacionada[] {
  const allFiles = new Set(entregas.flatMap((e) => e.arquivos));
  const related: RelatorioEntregaRelacionada[] = [];
  for (const item of allProgressoItens()) {
    const hits = [...allFiles].filter((f) => itemMatchesFile(item, f));
    if (hits.length > 0) {
      related.push({
        id: item.id,
        titulo: item.titulo,
        ficheirosCoincidentes: hits.slice(0, 5),
      });
    }
  }
  return related.slice(0, 8);
}

function somarAreas(entregas: RelatorioGitEntrega[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const e of entregas) {
    for (const [k, v] of Object.entries(e.areas)) {
      total[k] = (total[k] ?? 0) + v;
    }
  }
  return total;
}

function formatAreasLegivel(areas: Record<string, number>): string {
  return Object.entries(areas)
    .filter(([, n]) => n > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([k, n]) => `${AREA_LABELS[k] ?? k} (${n})`)
    .join(", ");
}

/** Resumo narrativo estilo “o que fizemos hoje” para o PDF. */
export function buildResumoDesenvolvimentoNarrativo(
  dateLabel: string,
  entregas: RelatorioGitEntrega[],
  entregasRelacionadas: RelatorioEntregaRelacionada[]
): string {
  if (entregas.length === 0) {
    return (
      `Em ${dateLabel} não há commits Git registados neste repositório. ` +
      `Se trabalhou sem commit, faça push antes de gerar o relatório ou escolha outro dia.`
    );
  }

  const ficheiros = new Set(entregas.flatMap((e) => e.arquivos)).size;
  const areas = somarAreas(entregas);
  const areasTxt = formatAreasLegivel(areas);
  const partes: string[] = [];

  if (entregas.length === 1) {
    const e = entregas[0]!;
    partes.push(
      `Em ${dateLabel} foi feito 1 commit (${e.hora}): ${e.mensagem}. ` +
        `Foram alterados ${ficheiros} ficheiro(s) relevante(s)` +
        (areasTxt ? `, sobretudo em ${areasTxt}.` : ".")
    );
  } else {
    partes.push(
      `Em ${dateLabel} foram feitos ${entregas.length} commits, com ${ficheiros} ficheiro(s) relevante(s) alterado(s)` +
        (areasTxt ? ` nas áreas: ${areasTxt}.` : ".")
    );
    const destaques = entregas.slice(0, 4).map((e) => `${e.hora} — ${e.mensagem}`);
    partes.push(`Principais entregas: ${destaques.join("; ")}${entregas.length > 4 ? "…" : "."}`);
  }

  if (entregasRelacionadas.length > 0) {
    const titulos = entregasRelacionadas.slice(0, 4).map((r) => r.titulo);
    partes.push(
      `Estas alterações ligam-se ao plano Obra10+: ${titulos.join(", ")}` +
        (entregasRelacionadas.length > 4 ? " e outras funcionalidades da matriz." : ".")
    );
  }

  return partes.join(" ");
}

/** @deprecated Use buildResumoDesenvolvimentoNarrativo */
export function buildResumoEntregasLegivel(dateLabel: string, entregas: RelatorioGitEntrega[]): string {
  return buildResumoDesenvolvimentoNarrativo(dateLabel, entregas, []);
}

export function buildDesenvolvimentoDoDia(dateStr: string, dateLabel: string): RelatorioDesenvolvimento {
  let entregas = getGitEntregasNoDia(dateStr);
  let fonte: RelatorioDesenvolvimento["fonte"] = entregas.length > 0 ? "git-live" : "vazio";

  if (entregas.length === 0) {
    entregas = filterEntregasFromArtifact(dateStr);
    if (entregas.length > 0) fonte = "artefato";
  }

  entregas = entregas.map(normalizarEntrega);
  const entregasRelacionadas = relacionarEntregasComMatriz(entregas);
  const ficheiros = new Set(entregas.flatMap((e) => e.arquivos)).size;
  const estruturado = buildRelatorioDesenvolvimentoEstruturado(dateLabel, entregas, entregasRelacionadas);

  return {
    entregas,
    resumo: estruturado.intro,
    estruturado,
    entregasRelacionadas,
    fonte,
    totais: {
      commits: entregas.length,
      ficheiros,
      areas: somarAreas(entregas),
    },
  };
}
