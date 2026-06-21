import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeProgressoStats,
  getDeployStats,
  getProgressoVerificacaoMeta,
  getProximosPassos,
  mergeProgressoItens,
  type ProgressoItemMerged,
} from "@/lib/crm/progresso-sistema-runtime";
import type { ProgressoFase } from "@/lib/crm/progresso-sistema-data";
import { buildResumoDeployLegivel, type RelatorioDeployResumo } from "@/lib/crm/relatorio-deploy-resumo";
import { buildDesenvolvimentoDoDia, type RelatorioDesenvolvimento } from "@/lib/crm/relatorio-git-entregas";
import artifact from "@/lib/crm/progresso-verificacao.generated.json";
import type { ProgressoVerificacaoArtifact } from "@/lib/crm/progresso-checks-types";

export type RelatorioDiarioMeta = {
  date: string;
  dateLabel: string;
  generatedAt: string;
  appUrl: string;
  tenant: { id: string; nome: string | null };
  geradoPor: { email: string | null; name: string | null };
};

export type RelatorioDiarioProgresso = {
  verificacaoMeta: { geradoEm: string | null; ambiente: string | null };
  stats: ReturnType<typeof computeProgressoStats>;
  gapsP0: ProgressoItemMerged[];
  porFase: Array<{
    fase: ProgressoFase;
    pct: number;
    ok: number;
    parcial: number;
    gap: number;
  }>;
  deployStats: ReturnType<typeof getDeployStats>;
  resumoDeploy: RelatorioDeployResumo;
};

export type RelatorioDiarioPayload = {
  meta: RelatorioDiarioMeta;
  desenvolvimento: RelatorioDesenvolvimento;
  progresso: RelatorioDiarioProgresso;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseRelatorioDate(dateParam: string | null | undefined): string {
  const today = new Date();
  const fallback = today.toISOString().slice(0, 10);
  if (!dateParam?.trim()) return fallback;
  const d = dateParam.trim();
  if (!DATE_RE.test(d)) return fallback;
  return d;
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

async function fetchTenantNome(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("hub_tenants")
    .select("nome_exibicao")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.nome_exibicao != null ? String(data.nome_exibicao) : null;
}

async function fetchGeradoPor(
  supabase: SupabaseClient,
  userId: string
): Promise<{ email: string | null; name: string | null }> {
  const { data } = await supabase.from("users").select("email, name").eq("id", userId).maybeSingle();
  return {
    email: data?.email != null ? String(data.email) : null,
    name: data?.name != null ? String(data.name) : null,
  };
}

export async function aggregateRelatorioDiario(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    userId: string;
    date: string;
  }
): Promise<RelatorioDiarioPayload> {
  const [tenantNome, geradoPor] = await Promise.all([
    fetchTenantNome(supabase, opts.tenantId),
    fetchGeradoPor(supabase, opts.userId),
  ]);

  const merged = mergeProgressoItens();
  const stats = computeProgressoStats(merged);
  const gapsP0 = getProximosPassos(merged).slice(0, 8);
  const deployStats = getDeployStats();
  const verificacaoMeta = getProgressoVerificacaoMeta();
  const porFase = stats.byFase.map((f) => ({
    fase: f.fase,
    pct: f.pct,
    ok: f.okCount,
    parcial: f.parcialCount,
    gap: f.gapCount,
  }));
  const art = artifact as ProgressoVerificacaoArtifact;
  const resumoDeploy = buildResumoDeployLegivel({
    merged,
    globalPct: stats.globalPct,
    ok: stats.ok,
    parcial: stats.parcial,
    gap: stats.gap,
    gapP0: stats.gapP0,
    porFase,
    verificacaoMeta,
    deployDetalhe: art?.deploy ?? null,
  });
  const dateLabel = formatDateLabel(opts.date);
  const desenvolvimento = buildDesenvolvimentoDoDia(opts.date, dateLabel);

  return {
    meta: {
      date: opts.date,
      dateLabel,
      generatedAt: new Date().toISOString(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://escritorio-virtual-xi.vercel.app",
      tenant: { id: opts.tenantId, nome: tenantNome },
      geradoPor,
    },
    desenvolvimento,
    progresso: {
      verificacaoMeta,
      stats,
      gapsP0,
      porFase,
      deployStats,
      resumoDeploy,
    },
  };
}
