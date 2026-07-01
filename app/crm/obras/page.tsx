"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  HardHat,
  Layers,
  Plus,
  Sparkles,
  CalendarClock,
  AlertOctagon,
  CreditCard,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  PackageOpen,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";
import { NovaObraSideover } from "@/components/crm/obras/NovaObraSideover";
import { EapEditorSideover } from "@/components/crm/obras/EapEditorSideover";
import { TIPOS_OBRA, TIPOS_OBRA_PRINCIPAIS } from "@/lib/obras/eap-presets";
import { abrirCopilotoVoz } from "@/lib/crm/direcionamento-ui";
import {
  COR_SAUDE,
  ROTULO_SAUDE,
  rotuloPrazo,
  passaFiltroSaude,
  type ObraCard as ObraCardT,
  type SaudeObra,
  type FiltroSaude,
} from "@/lib/crm/cockpit-classificar";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";

const TIPO_META = new Map<string, (typeof TIPOS_OBRA)[number]>(
  TIPOS_OBRA.map((t) => [t.slug, t])
);

// ── Tipos do payload do cockpit ──────────────────────────────────────────────
type ItemAtrasado = {
  obra_id: string;
  obra_titulo: string;
  obra_codigo: string | null;
  fase: string;
  data_prevista: string;
  dias: number;
  fase_id: string;
};
type ItemProximo15 = {
  obra_id: string;
  obra_titulo: string;
  fase: string;
  data_prevista: string;
  dias: number;
  fase_id: string;
};
type ItemBloqueio = {
  obra_id: string;
  obra_titulo: string;
  descricao: string;
  tipo: "ocorrencia_critica" | "pedido_pendente";
  id: string;
};
type CockpitPayload = {
  carteira: ObraCardT[];
  contadores: {
    obras: number;
    pedemAtencao: number;
    atrasados: number;
    proximos15: number;
    bloqueios: number;
    pagamentosAVencer: number | null;
  };
  hoje: { atrasados: ItemAtrasado[]; proximos15: ItemProximo15[]; bloqueios: ItemBloqueio[] };
  resumo_ia: {
    atrasados_ids: string[];
    bloqueios_ids: string[];
    total_decisoes: number;
    obras_criticas: number;
  };
  flags: { temCronograma: boolean; temFinanceiro: boolean; temOcorrencias: boolean };
};

type Aba = "carteira" | "hoje";

function dataCurta(): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).format(
      new Date()
    );
  } catch {
    return "";
  }
}

// ── Carteira: card de obra enriquecido ───────────────────────────────────────
function BarraAvanco({ valor }: { valor: number | null }) {
  if (valor == null) {
    return (
      <div className="mt-2">
        <div className="h-1.5 w-full rounded-full border border-dashed border-[#2a4636] bg-transparent" />
        <p className="mt-1 text-[11px] text-[#6e9e8a]">Sem cronograma ainda</p>
      </div>
    );
  }
  const cor = valor >= 67 ? "#3fb950" : valor >= 34 ? DOURADO : "#e3b341";
  return (
    <div className="mt-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0a140f]">
        <div className="h-full rounded-full" style={{ width: `${valor}%`, background: cor }} />
      </div>
      <p className="mt-1 text-[11px] text-[#8b949e]">{valor}% · média das fases</p>
    </div>
  );
}

function PillAlerta({
  icone,
  label,
  cor,
  onClick,
}: {
  icone: React.ReactNode;
  label: string;
  cor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold"
      style={{ borderColor: `${cor}66`, background: `${cor}1a`, color: cor }}
    >
      {icone}
      {label}
    </button>
  );
}

function CardObra({
  obra,
  onEap,
  onPillToHoje,
}: {
  obra: ObraCardT;
  onEap: () => void;
  onPillToHoje: (obraId: string) => void;
}) {
  const meta = obra.tipo_obra ? TIPO_META.get(obra.tipo_obra) : undefined;
  const corSaude = COR_SAUDE[obra.saude];
  const marco = obra.proximoMarco;
  const corMarco = marco ? (marco.dias <= 2 ? "#f85149" : marco.dias <= 7 ? "#e3b341" : "#8b949e") : "#8b949e";

  return (
    <div
      className="flex flex-col rounded-xl border bg-[#0f1d16] p-4"
      style={{ borderColor: BORDA, borderLeft: `3px solid ${corSaude}` }}
    >
      <Link href={`/crm/obras/${obra.id}`} className="block">
        <div className="flex items-center gap-2">
          {meta ? (
            <span aria-hidden className="text-base">
              {meta.icone}
            </span>
          ) : null}
          <strong className="flex-1 text-sm text-[#e6edf3]">{obra.titulo}</strong>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: `${corSaude}1f`, color: corSaude }}
          >
            {ROTULO_SAUDE[obra.saude]}
          </span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-[#8b949e]">
          {obra.codigo || "—"}
          {obra.cidade ? ` · ${[obra.cidade, obra.estado].filter(Boolean).join("/")}` : ""}
        </p>
        <BarraAvanco valor={obra.avanco} />
        {marco ? (
          <p className="mt-2 flex items-center gap-1 text-[11px]" style={{ color: corMarco }}>
            <CalendarClock className="h-3.5 w-3.5" />
            Próx.: {marco.fase} · {rotuloPrazo(marco.dias)}
          </p>
        ) : null}
      </Link>

      {/* Pills de alerta tocáveis → Hoje filtrado pela obra */}
      {obra.atrasados > 0 || obra.ocorrenciasCriticas > 0 || obra.pedidosAbertos > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {obra.atrasados > 0 ? (
            <PillAlerta
              icone={<CircleAlert className="h-3 w-3" />}
              label={`${obra.atrasados} atrasado${obra.atrasados > 1 ? "s" : ""}`}
              cor="#f85149"
              onClick={() => onPillToHoje(obra.id)}
            />
          ) : null}
          {obra.ocorrenciasCriticas > 0 ? (
            <PillAlerta
              icone={<AlertOctagon className="h-3 w-3" />}
              label={`${obra.ocorrenciasCriticas} ocorrência${obra.ocorrenciasCriticas > 1 ? "s" : ""}`}
              cor="#e3b341"
              onClick={() => onPillToHoje(obra.id)}
            />
          ) : null}
          {obra.pedidosAbertos > 0 ? (
            <PillAlerta
              icone={<PackageOpen className="h-3 w-3" />}
              label={`${obra.pedidosAbertos} pedido${obra.pedidosAbertos > 1 ? "s" : ""}`}
              cor={DOURADO}
              onClick={() => onPillToHoje(obra.id)}
            />
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onEap}
        className="mt-3 inline-flex items-center gap-1 self-start rounded-lg border px-2.5 py-1.5 text-[11px] font-bold text-[#c9a24a]"
        style={{ borderColor: BORDA }}
      >
        <Layers className="h-3.5 w-3.5" />
        EAP (frentes)
      </button>
    </div>
  );
}

// ── Hoje: contador grande ────────────────────────────────────────────────────
function Contador({
  icone,
  valor,
  label,
  cor,
  onClick,
  esmaecido,
}: {
  icone: React.ReactNode;
  valor: string;
  label: string;
  cor: string;
  onClick?: () => void;
  esmaecido?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className="flex flex-col items-start rounded-xl border p-3 text-left"
      style={{
        borderColor: BORDA,
        background: BG_CARD,
        opacity: esmaecido ? 0.6 : 1,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <span style={{ color: cor }}>{icone}</span>
      <strong className="mt-1 text-2xl font-extrabold" style={{ color: esmaecido ? "#8aa99a" : "#e6edf3" }}>
        {valor}
      </strong>
      {/* A6: cinza de TEXTO subido de #8b949e p/ #8aa99a (contraste ≥4.5:1 sobre o fundo escuro). */}
      <span className="text-[11px] text-[#8aa99a]">{label}</span>
    </Comp>
  );
}

// ── Hoje: seção colapsável ───────────────────────────────────────────────────
function SecaoHoje({
  titulo,
  n,
  cor,
  children,
  vazioOk,
}: {
  titulo: string;
  n: number;
  cor: string;
  children: React.ReactNode;
  vazioOk?: string;
}) {
  if (n === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#1d3a2c] bg-[#0c1a10] px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 text-[#3fb950]" />
        <span className="text-xs text-[#6e9e8a]">{vazioOk ?? `${titulo}: nada aqui`}</span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#1d3a2c] bg-[#0c1a10]">
      <div className="flex items-center gap-2 border-b border-[#1d3a2c] px-3 py-2">
        <span className="h-2 w-2 rounded-full" style={{ background: cor }} />
        <strong className="text-xs font-bold uppercase tracking-wide text-[#cdd9d2]">{titulo}</strong>
        <span className="rounded-full bg-[#16271e] px-2 py-0.5 text-[11px] font-bold" style={{ color: cor }}>
          {n}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-[#122218]">{children}</div>
    </div>
  );
}

function ObrasPageInner() {
  const searchParams = useSearchParams();
  const negocioId = searchParams.get("negocio_id");
  const abaParam = (searchParams.get("aba") as Aba) || "carteira";

  const [aba, setAba] = useState<Aba>(abaParam === "hoje" ? "hoje" : "carteira");
  const [payload, setPayload] = useState<CockpitPayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtroSaude, setFiltroSaude] = useState<FiltroSaude>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("");
  const [obraFoco, setObraFoco] = useState<string | null>(null); // deep-link pill → Hoje filtrado
  const [novaAberta, setNovaAberta] = useState(false);
  const [eapObra, setEapObra] = useState<ObraCardT | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState<Set<string>>(new Set());

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (negocioId) params.set("negocio_id", negocioId);
    const url = `/api/crm/obras/cockpit${params.toString() ? `?${params.toString()}` : ""}`;
    try {
      const res = await fetch(url, { headers: internalApiHeaders() });
      const json = (await res.json()) as CockpitPayload;
      setPayload(json);
    } catch {
      setPayload(null);
    }
    setCarregando(false);
  }, [negocioId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Mantém ?aba= em sincronia (sem recarregar a página — replaceState).
  const trocarAba = useCallback((a: Aba) => {
    setAba(a);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("aba", a);
      window.history.replaceState(null, "", u.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const irParaHojeObra = useCallback(
    (obraId: string) => {
      setObraFoco(obraId);
      trocarAba("hoje");
    },
    [trocarAba]
  );

  const concluirFase = useCallback(
    async (faseId: string) => {
      setConcluindo((s) => new Set(s).add(faseId));
      // Otimismo de UI: remove o item da fila imediatamente.
      setPayload((p) =>
        p
          ? {
              ...p,
              hoje: { ...p.hoje, atrasados: p.hoje.atrasados.filter((a) => a.fase_id !== faseId) },
            }
          : p
      );
      try {
        const res = await fetch("/api/crm/obras/cockpit", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({ acao: "concluir_fase", fase_id: faseId }),
        });
        if (res.ok) {
          setToast("Fase concluída.");
          void carregar();
        } else {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          setToast(j.error || "Não consegui concluir a fase.");
          void carregar(); // reidrata (desfaz o otimismo se falhou)
        }
      } catch {
        setToast("Falha de rede ao concluir.");
        void carregar();
      } finally {
        setConcluindo((s) => {
          const n = new Set(s);
          n.delete(faseId);
          return n;
        });
      }
    },
    [carregar]
  );

  const contadores = payload?.contadores;
  const flags = payload?.flags;
  const resumoIa = payload?.resumo_ia;

  // Carteira filtrada por saúde + tipo, já vem ordenada por urgência do servidor.
  const carteiraVisivel = useMemo(() => {
    const base = payload?.carteira ?? [];
    return base.filter(
      (c) => passaFiltroSaude(c, filtroSaude) && (!filtroTipo || c.tipo_obra === filtroTipo)
    );
  }, [payload?.carteira, filtroSaude, filtroTipo]);

  // Hoje filtrado pela obra em foco (deep-link da pill).
  const hojeFiltrado = useMemo(() => {
    const h = payload?.hoje ?? { atrasados: [], proximos15: [], bloqueios: [] };
    if (!obraFoco) return h;
    return {
      atrasados: h.atrasados.filter((a) => a.obra_id === obraFoco),
      proximos15: h.proximos15.filter((a) => a.obra_id === obraFoco),
      bloqueios: h.bloqueios.filter((a) => a.obra_id === obraFoco),
    };
  }, [payload?.hoje, obraFoco]);

  const obraFocoNome = obraFoco
    ? payload?.carteira.find((c) => c.id === obraFoco)?.titulo ?? "obra"
    : null;

  const chipsSaude: { value: FiltroSaude; label: string }[] = [
    { value: "", label: "Todas" },
    { value: "atencao", label: "⚠ Atenção" },
    { value: "critica", label: "🔴 Crítica" },
    { value: "ativas", label: "Ativas" },
    { value: "planejamento", label: "Planejamento" },
  ];
  const chipsTipo = useMemo(
    () => TIPOS_OBRA.filter((t) => TIPOS_OBRA_PRINCIPAIS.includes(t.slug)),
    []
  );

  const subtitulo = contadores
    ? `${contadores.obras} obra${contadores.obras === 1 ? "" : "s"}${
        contadores.pedemAtencao > 0 ? ` · ${contadores.pedemAtencao} pedem atenção` : ""
      }`
    : "Carteira de obras · EAP por disciplina";

  return (
    <div className="min-h-full bg-[#0a140f] p-4 sm:p-6">
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h1 className="hidden items-center gap-2 text-lg font-bold text-[#e6edf3] md:flex">
            <HardHat className="h-5 w-5" style={{ color: DOURADO }} />
            Obras
          </h1>
          <p className="text-xs text-[#8b949e]">{subtitulo}</p>
        </div>
        <button
          type="button"
          onClick={() => setNovaAberta(true)}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#003b26]"
          style={{ background: DOURADO }}
        >
          <Plus className="h-4 w-4" />
          Nova obra
        </button>
      </div>

      {/* Seg-control Carteira / Hoje */}
      <div
        role="tablist"
        aria-label="Visão das obras"
        className="mb-4 flex gap-1 rounded-xl border p-1"
        style={{ borderColor: BORDA, background: BG_CARD, maxWidth: 320 }}
      >
        {([
          { id: "carteira", label: "Carteira", icone: <Layers className="h-4 w-4" /> },
          { id: "hoje", label: "Hoje", icone: <Sparkles className="h-4 w-4" /> },
        ] as const).map(({ id, label, icone }) => {
          const ativo = aba === id;
          const badge = id === "hoje" && contadores ? contadores.atrasados + contadores.bloqueios : 0;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => trocarAba(id)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold"
              style={{
                background: ativo ? "linear-gradient(180deg, #1d5c3c, #003b26)" : "transparent",
                color: ativo ? "#f0c869" : "#8aa99a",
                border: ativo ? `1px solid ${DOURADO}` : "1px solid transparent",
              }}
            >
              {icone}
              {label}
              {badge > 0 ? (
                <span className="ml-0.5 rounded-full bg-[#f8514922] px-1.5 text-[10px] font-bold text-[#f85149]">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {negocioId ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-2">
          <span className="text-xs text-[#e6edf3]">Obras a partir de um negócio.</span>
          <Link href={`/crm/negocios/${negocioId}`} className="text-xs font-bold text-[#c9a24a]">
            ← Voltar ao negócio
          </Link>
        </div>
      ) : null}

      {toast ? (
        <div className="mb-4 rounded-lg border border-[#23863655] bg-[#23863618] px-3 py-2 text-xs font-bold text-[#3fb950]">
          {toast}
        </div>
      ) : null}

      {carregando ? (
        <p className="text-sm text-[#8b949e]">Carregando…</p>
      ) : aba === "carteira" ? (
        <Carteira
          carteira={carteiraVisivel}
          total={payload?.carteira.length ?? 0}
          negocioId={negocioId}
          chipsSaude={chipsSaude}
          chipsTipo={chipsTipo}
          filtroSaude={filtroSaude}
          filtroTipo={filtroTipo}
          onFiltroSaude={setFiltroSaude}
          onFiltroTipo={setFiltroTipo}
          onEap={setEapObra}
          onPillToHoje={irParaHojeObra}
        />
      ) : (
        <PainelHoje
          hoje={hojeFiltrado}
          contadores={contadores}
          flags={flags}
          resumoIa={resumoIa}
          obraFocoNome={obraFocoNome}
          onLimparFoco={() => setObraFoco(null)}
          onConcluir={concluirFase}
          concluindo={concluindo}
        />
      )}

      <NovaObraSideover
        open={novaAberta}
        onClose={() => setNovaAberta(false)}
        negocioId={negocioId}
        onCreated={(obra, frentes) => {
          const cod = obra.codigo_legivel || obra.codigo || "obra";
          setToast(`Obra ${cod} criada${frentes ? ` · ${frentes} frentes` : ""}.`);
          void carregar();
        }}
      />

      {eapObra ? (
        <EapEditorSideover
          open={Boolean(eapObra)}
          onClose={() => setEapObra(null)}
          obraId={eapObra.id}
          obraTitulo={eapObra.titulo}
          onUpdated={() => void carregar()}
        />
      ) : null}
    </div>
  );
}

// ── Aba CARTEIRA ─────────────────────────────────────────────────────────────
function Carteira({
  carteira,
  total,
  negocioId,
  chipsSaude,
  chipsTipo,
  filtroSaude,
  filtroTipo,
  onFiltroSaude,
  onFiltroTipo,
  onEap,
  onPillToHoje,
}: {
  carteira: ObraCardT[];
  total: number;
  negocioId: string | null;
  chipsSaude: { value: FiltroSaude; label: string }[];
  chipsTipo: (typeof TIPOS_OBRA)[number][];
  filtroSaude: FiltroSaude;
  filtroTipo: string;
  onFiltroSaude: (f: FiltroSaude) => void;
  onFiltroTipo: (t: string) => void;
  onEap: (o: ObraCardT) => void;
  onPillToHoje: (obraId: string) => void;
}) {
  if (total === 0) {
    return (
      <EmptyState
        message={
          negocioId
            ? "Nenhuma obra para este negócio ainda. Crie a primeira."
            : "Nenhuma obra na carteira. Crie a primeira obra."
        }
      />
    );
  }
  return (
    <>
      {/* Filtros: saúde + tipo */}
      <div className="mb-3 flex flex-wrap gap-2">
        {chipsSaude.map((c) => {
          const ativo = filtroSaude === c.value;
          return (
            <button
              key={c.value || "todas"}
              type="button"
              onClick={() => onFiltroSaude(c.value)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{
                borderColor: ativo ? DOURADO : BORDA,
                background: ativo ? "rgba(201,162,74,0.12)" : "#0a140f",
                color: ativo ? "#e6edf3" : "#8b949e",
              }}
            >
              {c.label}
            </button>
          );
        })}
        <span className="mx-1 self-center text-[#2a4636]">·</span>
        {chipsTipo.map((t) => {
          const ativo = filtroTipo === t.slug;
          return (
            <button
              key={t.slug}
              type="button"
              onClick={() => onFiltroTipo(ativo ? "" : t.slug)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{
                borderColor: ativo ? DOURADO : BORDA,
                background: ativo ? "rgba(201,162,74,0.12)" : "#0a140f",
                color: ativo ? "#e6edf3" : "#8b949e",
              }}
            >
              {t.icone} {t.label}
            </button>
          );
        })}
      </div>

      {carteira.length === 0 ? (
        <p className="rounded-xl border border-[#1d3a2c] bg-[#0c1a10] px-3 py-4 text-sm text-[#8b949e]">
          Nenhuma obra com esse filtro.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {carteira.map((o) => (
            <CardObra
              key={o.id}
              obra={o}
              onEap={() => onEap(o)}
              onPillToHoje={onPillToHoje}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ── Aba HOJE ─────────────────────────────────────────────────────────────────
function PainelHoje({
  hoje,
  contadores,
  flags,
  resumoIa,
  obraFocoNome,
  onLimparFoco,
  onConcluir,
  concluindo,
}: {
  hoje: { atrasados: ItemAtrasado[]; proximos15: ItemProximo15[]; bloqueios: ItemBloqueio[] };
  contadores: CockpitPayload["contadores"] | undefined;
  flags: CockpitPayload["flags"] | undefined;
  resumoIa: CockpitPayload["resumo_ia"] | undefined;
  obraFocoNome: string | null;
  onLimparFoco: () => void;
  onConcluir: (faseId: string) => void;
  concluindo: Set<string>;
}) {
  const totalDecisoes = hoje.atrasados.length + hoje.bloqueios.length;
  const calmo = totalDecisoes === 0 && hoje.proximos15.length === 0;
  const temRecsIa = (resumoIa?.total_decisoes ?? 0) > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Cabeçalho do dia + filtro de obra (deep-link) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#8b949e]">Hoje · {dataCurta()}</p>
        {obraFocoNome ? (
          <button
            type="button"
            onClick={onLimparFoco}
            className="inline-flex items-center gap-1 rounded-full border border-[#c9a24a55] bg-[#c9a24a14] px-2.5 py-1 text-[11px] font-bold text-[#c9a24a]"
          >
            {obraFocoNome} · remover filtro ✕
          </button>
        ) : null}
      </div>

      {/* Contadores grandes */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Contador
          icone={<CircleAlert className="h-5 w-5" />}
          valor={String(contadores?.atrasados ?? 0)}
          label="Atrasados"
          cor="#f85149"
        />
        <Contador
          icone={<CalendarClock className="h-5 w-5" />}
          valor={String(contadores?.proximos15 ?? 0)}
          label="Próx. 15 dias"
          cor={DOURADO}
        />
        <Contador
          icone={<AlertOctagon className="h-5 w-5" />}
          valor={String(contadores?.bloqueios ?? 0)}
          label="Bloqueios"
          cor="#e3b341"
        />
        <Contador
          icone={<CreditCard className="h-5 w-5" />}
          valor="—"
          label="A vencer (em breve)"
          cor="#6e9e8a"
          esmaecido
        />
      </div>

      {/* Banner copiloto IA — some quando não há recomendação */}
      {temRecsIa ? (
        <button
          type="button"
          onClick={abrirCopilotoVoz}
          className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left"
          style={{ borderColor: "#c9a24a55", background: "linear-gradient(180deg, #1a1405, #0c1a10)" }}
        >
          <Sparkles className="h-4 w-4 text-[#f0c869]" />
          <span className="flex-1 text-xs font-bold text-[#f3e6c4]">
            A IA preparou {resumoIa?.total_decisoes} recomendaç{resumoIa?.total_decisoes === 1 ? "ão" : "ões"}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#c9a24a]">
            Ver <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : null}

      {/* Estado de calma */}
      {calmo ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[#23863633] bg-[#0c1a10] px-4 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-[#3fb950]" />
          <strong className="text-sm text-[#e6edf3]">Nada pede decisão agora</strong>
          <p className="max-w-sm text-xs text-[#8b949e]">
            Sem atrasos nem bloqueios nas obras. Quer que eu prepare um resumo da carteira ou planeje a
            próxima semana? Toque no copiloto.
          </p>
          <button
            type="button"
            onClick={abrirCopilotoVoz}
            className="mt-1 inline-flex items-center gap-1 rounded-lg border border-[#c9a24a55] bg-[#c9a24a14] px-3 py-1.5 text-xs font-bold text-[#c9a24a]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pedir ajuda à IA
          </button>
        </div>
      ) : null}

      {/* §1 ATRASADOS */}
      {!calmo ? (
        <SecaoHoje
          titulo="Atrasados"
          n={hoje.atrasados.length}
          cor="#f85149"
          vazioOk="Atrasados: nenhuma fase vencida ✓"
        >
          {hoje.atrasados.map((a) => (
            <div key={a.fase_id} className="flex flex-col gap-1.5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#f85149]" />
                <div className="flex-1">
                  <p className="text-sm text-[#e6edf3]">{a.fase}</p>
                  <p className="text-[11px] text-[#8b949e]">
                    {a.obra_titulo} · {rotuloPrazo(a.dias)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-3.5">
                <button
                  type="button"
                  onClick={abrirCopilotoVoz}
                  className="rounded-lg border border-[#c9a24a55] bg-[#c9a24a14] px-2.5 py-1 text-[11px] font-bold text-[#c9a24a]"
                  title="Ação de prazo crítica — confirme no copiloto"
                >
                  Reprogramar
                </button>
                <button
                  type="button"
                  disabled={concluindo.has(a.fase_id)}
                  onClick={() => onConcluir(a.fase_id)}
                  className="rounded-lg border border-[#23863655] bg-[#23863618] px-2.5 py-1 text-[11px] font-bold text-[#3fb950] disabled:opacity-50"
                >
                  {concluindo.has(a.fase_id) ? "…" : "✓ Concluído"}
                </button>
                <Link
                  href={`/crm/obras/${a.obra_id}`}
                  className="rounded-lg border border-[#1d3a2c] px-2.5 py-1 text-[11px] font-bold text-[#8aa99a]"
                >
                  Abrir
                </Link>
              </div>
            </div>
          ))}
        </SecaoHoje>
      ) : null}

      {/* §2 PRÓXIMOS 15 DIAS */}
      {!calmo ? (
        <SecaoHoje
          titulo="Próximos 15 dias"
          n={hoje.proximos15.length}
          cor={DOURADO}
          vazioOk="Próximos 15 dias: agenda livre ✓"
        >
          {hoje.proximos15.slice(0, 5).map((p) => (
            <div key={p.fase_id} className="flex items-center gap-2 px-3 py-2.5">
              <span
                className="rounded-full bg-[#16271e] px-2 py-0.5 text-[10px] font-bold text-[#c9a24a]"
              >
                {rotuloPrazo(p.dias)}
              </span>
              <div className="flex-1">
                <p className="text-sm text-[#e6edf3]">{p.fase}</p>
                <p className="text-[11px] text-[#8b949e]">{p.obra_titulo}</p>
              </div>
              <button
                type="button"
                onClick={abrirCopilotoVoz}
                className="rounded-lg border border-[#1d3a2c] px-2.5 py-1 text-[11px] font-bold text-[#8aa99a]"
              >
                Avisar
              </button>
            </div>
          ))}
          {hoje.proximos15.length > 5 ? (
            <p className="px-3 py-2 text-[11px] text-[#6e9e8a]">
              + {hoje.proximos15.length - 5} mais nos próximos 15 dias
            </p>
          ) : null}
        </SecaoHoje>
      ) : null}

      {/* §3 BLOQUEIOS (proxy) */}
      {!calmo ? (
        <SecaoHoje
          titulo="Bloqueios"
          n={hoje.bloqueios.length}
          cor="#e3b341"
          vazioOk="Bloqueios: nada travando ✓"
        >
          {hoje.bloqueios.map((b) => (
            <div key={b.id} className="flex flex-col gap-1.5 px-3 py-2.5">
              <div className="flex items-start gap-2">
                <AlertOctagon className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#e3b341]" />
                <div className="flex-1">
                  <p className="text-sm text-[#e6edf3]">
                    {b.tipo === "ocorrencia_critica" ? "Ocorrência crítica: " : "Pedido pendente: "}
                    {b.descricao}
                  </p>
                  <p className="text-[11px] text-[#8b949e]">{b.obra_titulo}</p>
                </div>
              </div>
              <div className="flex gap-1.5 pl-6">
                <Link
                  href={`/crm/obras/${b.obra_id}`}
                  className="rounded-lg border border-[#1d3a2c] px-2.5 py-1 text-[11px] font-bold text-[#8aa99a]"
                >
                  Abrir obra
                </Link>
              </div>
            </div>
          ))}
        </SecaoHoje>
      ) : null}

      {/* §4 PAGAMENTOS — o Financeiro POR OBRA já existe (deploy #9); o que falta é o agregado
          cross-obra de "a vencer" no cockpit. Copy honesta: não subestima o que já está pronto. */}
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-[#2a4636] bg-[#0c1a10] px-3 py-2.5">
        <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#8aa99a]" />
        <span className="text-xs text-[#8aa99a]">
          O agregado de pagamentos a vencer (todas as obras) chega em breve. O Financeiro por obra
          já está disponível — abra uma obra na aba <strong className="text-[#c8d6cd]">Financeiro</strong>.
        </span>
      </div>

      {!flags?.temCronograma ? (
        <p className="text-[11px] text-[#6e9e8a]">
          Dica: defina datas na EAP das obras para o cockpit acompanhar atrasos e marcos automaticamente.
        </p>
      ) : null}
    </div>
  );
}

export default function ObrasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">Carregando…</div>
      }
    >
      <ObrasPageInner />
    </Suspense>
  );
}
