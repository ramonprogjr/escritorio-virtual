"use client";

/**
 * E4 (Fase 4) — <ObraCronogramaSecao>: a CURVA-S da obra (design §7 Fase 4). Pendura no PESO do
 * item de escopo: o EXECUTADO sai do avanço ponderado dos itens; o PLANEJADO da baseline (ou linear).
 *
 * NÃO é tabela (regra eterna: tabela = relatório). É um gráfico Curva-S em SVG manual (planejado
 * DOURADO × executado VERDE), 4 KPIs vivos (avanço físico, financeiro, desvio vs planejado, previsão)
 * e um toggle FÍSICO × FINANCEIRO. Mobile-first; tokens Obra10+ (verde+dourado dark).
 *
 * TOLERANTE: sem a migração E4 (baseline/append-only), mostra um aviso honesto e DEGRADA —
 *   planejado = linha linear das datas da obra; executado = 1 ponto ao vivo do avanço. Nunca quebra.
 *   Persona que não vê preço (arquiteto) não recebe o financeiro: o toggle fica só no físico.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Coins,
  TrendingUp,
  TrendingDown,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const DOURADO = "#c9a24a";
const VERDE = "#1d8a52";
const VERDE_CLARO = "#34d07f";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";
const VERMELHO = "#f0786a";

type PontoCurva = { semana: number; data: string | null; fisico: number; financeiro: number };
type Kpis = {
  fisicoAtual: number;
  financeiroAtual: number;
  planejadoHoje: number | null;
  desvioPct: number | null;
  statusPrazo: "adiantado" | "no_prazo" | "atrasado" | "indefinido";
  previsaoTermino: string | null;
};
type Resposta = {
  migracao_pendente?: boolean;
  migracao_e4_pendente?: boolean;
  aviso?: string | null;
  ver_financeiro?: boolean;
  baseline?: { data_inicio: string | null; data_fim: string | null };
  planejado?: PontoCurva[];
  executado?: PontoCurva[];
  hoje_index?: number;
  hoje?: string;
  kpis?: Kpis;
};

type Lente = "fisico" | "financeiro";

export function ObraCronogramaSecao({ obraId }: { obraId: string }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resp, setResp] = useState<Resposta | null>(null);
  const [lente, setLente] = useState<Lente>("fisico");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/cronograma`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as Resposta & { error?: string };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar o cronograma.");
        setResp(null);
        return;
      }
      setResp(json);
    } catch {
      setErro("Falha de rede ao carregar o cronograma.");
      setResp(null);
    } finally {
      setCarregando(false);
    }
  }, [obraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const verFinanceiro = resp?.ver_financeiro !== false;
  // Persona sem financeiro → trava no físico.
  useEffect(() => {
    if (!verFinanceiro && lente === "financeiro") setLente("fisico");
  }, [verFinanceiro, lente]);

  if (carregando) {
    return <p className="p-4 text-sm text-[#8b949e]">Carregando cronograma…</p>;
  }

  if (erro) {
    return (
      <div className="rounded-xl border p-5 text-center" style={{ borderColor: BORDA, background: BG_CARD }}>
        <AlertTriangle className="mx-auto h-5 w-5" style={{ color: DOURADO }} />
        <p className="mt-2 text-sm" style={{ color: "#cdd9d2" }}>{erro}</p>
        <button
          type="button"
          onClick={() => void carregar()}
          className="mt-3 rounded-md px-3 py-1.5 text-[12px] font-bold"
          style={{ color: "#f0c869", background: "linear-gradient(180deg, #1d5c3c, #003b26)", border: `1px solid ${DOURADO}` }}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const planejado = resp?.planejado ?? [];
  const executado = resp?.executado ?? [];
  const kpis = resp?.kpis ?? null;
  const pendenteE4 = !!resp?.migracao_e4_pendente;

  return (
    <div className="flex flex-col gap-3">
      <KpisCronograma kpis={kpis} lente={lente} verFinanceiro={verFinanceiro} />

      {/* Toggle FÍSICO × FINANCEIRO + legenda */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleLente lente={lente} onMudar={setLente} verFinanceiro={verFinanceiro} />
        <Legenda />
      </div>

      <CurvaSvg planejado={planejado} executado={executado} lente={lente} hojeIndex={resp?.hoje_index ?? -1} />

      {pendenteE4 ? <AvisoMigracao aviso={resp?.aviso ?? null} /> : null}
    </div>
  );
}

// ── KPIs (4 cards vivos) ──────────────────────────────────────────────────────
function KpisCronograma({
  kpis,
  lente,
  verFinanceiro,
}: {
  kpis: Kpis | null;
  lente: Lente;
  verFinanceiro: boolean;
}) {
  const fisico = kpis ? kpis.fisicoAtual : 0;
  const financeiro = kpis ? kpis.financeiroAtual : 0;
  const desvio = kpis?.desvioPct ?? null;
  const previsao = kpis?.previsaoTermino ?? null;

  const desvioStr = desvio == null ? "—" : `${desvio > 0 ? "+" : ""}${desvio}%`;
  const DesvioIcone = desvio == null ? Activity : desvio < 0 ? TrendingDown : TrendingUp;
  const corDesvio = desvio == null ? TXT_DIM : desvio < -2 ? VERMELHO : desvio > 2 ? VERDE_CLARO : "#f0c869";

  const cards: Array<{ rotulo: string; valor: string; Icone: typeof Activity; cor?: string; destaque?: boolean }> = [
    { rotulo: "Avanço físico", valor: `${fisico}%`, Icone: Activity, destaque: lente === "fisico" },
  ];
  if (verFinanceiro) {
    cards.push({ rotulo: "Avanço financeiro", valor: `${financeiro}%`, Icone: Coins, destaque: lente === "financeiro" });
  }
  cards.push({ rotulo: "Desvio vs planejado", valor: desvioStr, Icone: DesvioIcone, cor: corDesvio });
  cards.push({
    rotulo: "Previsão de término",
    valor: previsao ? fmtData(previsao) : "—",
    Icone: CalendarClock,
  });

  const cols = cards.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-2`}>
      {cards.map((c) => {
        const Icone = c.Icone;
        return (
          <div
            key={c.rotulo}
            className="rounded-xl border p-3"
            style={{
              borderColor: c.destaque ? DOURADO : BORDA,
              background: c.destaque ? "linear-gradient(180deg, #14301f, #0a140f)" : BG_CARD,
            }}
          >
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: c.destaque ? "#f0c869" : TXT_DIM }}
            >
              <Icone className="h-3 w-3" /> {c.rotulo}
            </div>
            <p className="mt-1 text-[15px] font-bold tabular-nums" style={{ color: c.cor ?? TXT }}>
              {c.valor}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ── Toggle FÍSICO × FINANCEIRO ────────────────────────────────────────────────
function ToggleLente({
  lente,
  onMudar,
  verFinanceiro,
}: {
  lente: Lente;
  onMudar: (l: Lente) => void;
  verFinanceiro: boolean;
}) {
  const opcoes: Array<{ id: Lente; rotulo: string }> = [{ id: "fisico", rotulo: "Físico" }];
  if (verFinanceiro) opcoes.push({ id: "financeiro", rotulo: "Financeiro" });
  return (
    <div
      className="flex rounded-lg border p-0.5"
      style={{ borderColor: BORDA, background: BG_CARD }}
      role="tablist"
      aria-label="Curva física ou financeira"
    >
      {opcoes.map((o) => {
        const ativo = lente === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onMudar(o.id)}
            className="rounded-md px-3 py-1.5 text-[12px] font-semibold"
            style={{
              color: ativo ? "#f0c869" : TXT_DIM,
              background: ativo ? "linear-gradient(180deg, #1d5c3c, #003b26)" : "transparent",
              border: ativo ? `1px solid ${DOURADO}` : "1px solid transparent",
            }}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex items-center gap-3 text-[11px]" style={{ color: TXT_DIM }}>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: DOURADO }} /> Planejado
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: VERDE_CLARO }} /> Executado
      </span>
    </div>
  );
}

// ── A CURVA-S em SVG manual ────────────────────────────────────────────────────
/**
 * viewBox 0 0 100 60 (responsivo via width=100%). Y = ALTURA − pct×escala (origem embaixo).
 * X distribui os pontos uniformemente no eixo ordinal (semana). Planejado DOURADO, executado VERDE.
 * Empty-state honesto quando não há curva nenhuma.
 */
function CurvaSvg({
  planejado,
  executado,
  lente,
  hojeIndex,
}: {
  planejado: PontoCurva[];
  executado: PontoCurva[];
  lente: Lente;
  hojeIndex: number;
}) {
  const W = 100;
  const H = 60;
  const PADX = 6; // margem p/ não cortar o 1º/último ponto
  const PADY = 5;

  const valLente = (p: PontoCurva) => (lente === "financeiro" ? p.financeiro : p.fisico);

  // X de um ponto pelo seu índice no eixo do PLANEJADO (a base temporal). O executado é mapeado
  // proporcionalmente ao mesmo span (0..1) — assim as duas curvas dividem o mesmo eixo X.
  const nPlan = Math.max(1, planejado.length - 1);
  const xDe = (frac: number) => PADX + frac * (W - 2 * PADX);
  const yDe = (pct: number) => H - PADY - (clamp(pct) / 100) * (H - 2 * PADY);

  const pontosPlan = useMemo(
    () =>
      planejado.map((p, i) => ({ x: xDe(planejado.length <= 1 ? 0 : i / nPlan), y: yDe(valLente(p)) })),
    [planejado, lente, nPlan]
  );
  const nExec = Math.max(1, executado.length - 1);
  const pontosExec = useMemo(
    () =>
      executado.map((p, i) => ({ x: xDe(executado.length <= 1 ? 0 : i / nExec), y: yDe(valLente(p)) })),
    [executado, lente, nExec]
  );

  const semCurva = planejado.length === 0 && executado.length === 0;
  if (semCurva) {
    return (
      <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDA, background: BG_CARD }}>
        <Activity className="mx-auto h-5 w-5" style={{ color: DOURADO }} />
        <p className="mt-2 text-sm font-semibold" style={{ color: TXT }}>Sem cronograma ainda</p>
        <p className="mt-1 text-[12px]" style={{ color: TXT_DIM }}>
          Defina o início/fim da obra e registre o avanço dos itens para a curva aparecer.
        </p>
      </div>
    );
  }

  const polyPlan = pontosPlan.map((p) => `${round2(p.x)},${round2(p.y)}`).join(" ");
  const polyExec = pontosExec.map((p) => `${round2(p.x)},${round2(p.y)}`).join(" ");

  // X da linha "hoje" (no eixo do planejado).
  const xHoje =
    hojeIndex >= 0 && planejado.length > 1 ? xDe(hojeIndex / nPlan) : null;

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: BORDA, background: BG_DEEP }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        preserveAspectRatio="none"
        role="img"
        aria-label="Curva-S: planejado versus executado"
        style={{ display: "block", maxHeight: 260 }}
      >
        {/* grade horizontal (0/25/50/75/100%) */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line
              x1={PADX}
              y1={yDe(g)}
              x2={W - PADX}
              y2={yDe(g)}
              stroke={BORDA}
              strokeWidth={0.3}
            />
            <text x={1} y={yDe(g) + 1.6} fontSize={3} fill={TXT_DIM}>
              {g}
            </text>
          </g>
        ))}

        {/* linha "hoje" (pontilhada dourada) */}
        {xHoje != null ? (
          <line
            x1={xHoje}
            y1={PADY}
            x2={xHoje}
            y2={H - PADY}
            stroke={DOURADO}
            strokeWidth={0.4}
            strokeDasharray="1.5 1.5"
            opacity={0.6}
          />
        ) : null}

        {/* planejado (dourado) */}
        {pontosPlan.length > 1 ? (
          <polyline points={polyPlan} fill="none" stroke={DOURADO} strokeWidth={0.9} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}

        {/* executado (verde) — área sutil + linha */}
        {pontosExec.length > 1 ? (
          <>
            <polyline
              points={`${PADX},${H - PADY} ${polyExec} ${pontosExec[pontosExec.length - 1].x},${H - PADY}`}
              fill={VERDE}
              opacity={0.12}
              stroke="none"
            />
            <polyline points={polyExec} fill="none" stroke={VERDE_CLARO} strokeWidth={1.1} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : null}

        {/* ponto atual do executado (bolinha) */}
        {pontosExec.length > 0 ? (
          <circle
            cx={pontosExec[pontosExec.length - 1].x}
            cy={pontosExec[pontosExec.length - 1].y}
            r={1.4}
            fill={VERDE_CLARO}
            stroke={BG_DEEP}
            strokeWidth={0.4}
          />
        ) : null}
      </svg>

      {/* eixo X legível: 1ª e última data (quando há calendário) */}
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: TXT_DIM }}>
        <span>{rotuloEixo(planejado[0])}</span>
        <span>{rotuloEixo(planejado[planejado.length - 1])}</span>
      </div>
    </div>
  );
}

// ── Aviso de migração (tolerância honesta) ────────────────────────────────────
function AvisoMigracao({ aviso }: { aviso: string | null }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: `${DOURADO}44`, background: `${DOURADO}12` }}>
      <p style={{ color: "#f0c869" }}>
        {aviso || "O cronograma planejado completo fica disponível após aplicar a migração E4."}
      </p>
      <p className="mt-0.5" style={{ color: TXT_DIM }}>
        Por enquanto: planejado linear pelas datas da obra e executado pelo avanço dos itens. Nada foi perdido.
      </p>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function clamp(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function rotuloEixo(p: PontoCurva | undefined): string {
  if (!p) return "";
  return p.data ? fmtData(p.data) : `Sem ${p.semana}`;
}

export default ObraCronogramaSecao;
