"use client";

/**
 * E2 — Aba "Itens & Avanço" da obra (Situação AUTO × Andamento MANUAL).
 *
 * Gramática de não-colisão (o insight da planilha em pixels):
 *  - SITUAÇÃO = canal COR: borda-esquerda + selo com 🔒 (readonly, calculada pelo prazo). CAPS.
 *  - ANDAMENTO = canal FORMA+TEXTO: chip contornado clicável à direita (o humano declara). Title Case.
 *  - SEMPRE lado a lado. A tensão "Atrasado × Iniciado" é um alarme visível, não um conflito a resolver.
 *
 * Click-and-Go: avanço por slider + botões 25/50/75/100; andamento por chips; bloqueios por toggles.
 * Mobile: alvos ≥44px; a ficha vira bottom-sheet (mesmo componente, largura total).
 * Tolerante: se a migração E2 não foi aplicada (migracao_pendente), mostra aviso honesto, não quebra.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  X,
  Lock,
  Mic,
  CalendarClock,
  Camera,
  Save,
  ChevronRight,
  AlertTriangle,
  Layers,
  Building2,
  DoorOpen,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { abrirCopilotoVoz } from "@/lib/crm/direcionamento-ui";
import {
  COR_SITUACAO,
  ROTULO_SITUACAO,
  COR_ANDAMENTO,
  ROTULO_ANDAMENTO,
  ANDAMENTOS,
  BLOQUEIOS,
  derivarSituacao,
  calcularKpisItens,
  type ItemObraRow,
  type AndamentoItem,
  type SituacaoItem,
} from "@/lib/obras/itens-situacao";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";

type Agrupar = "disciplina" | "andar" | "ambiente";

/** Rótulo legível de um código de ambiente (slug → Title Case com acento básico). */
function rotuloAmbiente(codigo: string): string {
  const base = codigo.replace(/_/g, " ").trim();
  if (!base) return "Sem ambiente definido";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** Situação efetiva: a da view, ou derivada localmente como fallback. */
function situacaoDe(it: ItemObraRow): SituacaoItem {
  return it.situacao ?? derivarSituacao(it);
}

function contarBloqueiosItem(it: ItemObraRow): number {
  return BLOQUEIOS.reduce((n, b) => (it[b.campo as keyof ItemObraRow] === true ? n + 1 : n), 0);
}

function fmtData(v: string | null): string {
  if (!v) return "—";
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}` : v;
}

// ── Selo de Situação (cor, readonly, 🔒) ──────────────────────────────────────
function SeloSituacao({ situacao, diasAtraso }: { situacao: SituacaoItem; diasAtraso?: number | null }) {
  const cor = COR_SITUACAO[situacao];
  const atrasado = situacao === "atrasado" && typeof diasAtraso === "number" && diasAtraso > 0;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
      style={{ background: `${cor}22`, color: cor, border: `1px solid ${cor}55` }}
      title="Situação calculada pelo prazo (automática)"
    >
      {ROTULO_SITUACAO[situacao]}
      {atrasado ? ` · ${diasAtraso}d` : ""}
      <Lock className="h-2.5 w-2.5 opacity-70" />
    </span>
  );
}

// ── Chip de Andamento (clicável; o humano declara) ────────────────────────────
function ChipAndamento({ andamento }: { andamento: AndamentoItem }) {
  const cor = COR_ANDAMENTO[andamento];
  const riscado = andamento === "cancelado";
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{
        color: cor,
        border: `1px solid ${cor}66`,
        background: "transparent",
        textDecoration: riscado ? "line-through" : "none",
      }}
    >
      {ROTULO_ANDAMENTO[andamento]}
    </span>
  );
}

// ── Card do item na lista ─────────────────────────────────────────────────────
function CardItem({
  it,
  nSubitens,
  onAbrir,
}: {
  it: ItemObraRow;
  nSubitens: number;
  onAbrir: () => void;
}) {
  const situacao = situacaoDe(it);
  const cor = COR_SITUACAO[situacao];
  const bloq = contarBloqueiosItem(it);
  const avanco = it.pct_avanco ?? 0;

  return (
    <button
      type="button"
      onClick={onAbrir}
      className="flex w-full flex-col gap-2 rounded-xl border p-3 text-left"
      style={{ borderColor: BORDA, background: BG_CARD, borderLeft: `4px solid ${cor}` }}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#e6edf3]">{it.nome}</p>
          <p className="truncate font-mono text-[11px] text-[#8b949e]">
            {it.codigo}
            {it.area_label ? ` · ${it.area_label}` : ""}
          </p>
          {/* E0.5: tag de ambiente (quando agrupado por outro eixo) + vínculo à taxonomia. */}
          {it.ambiente || it.taxonomia_id ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {it.ambiente ? (
                <span
                  className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${DOURADO}1a`, color: DOURADO, border: `1px solid ${DOURADO}33` }}
                >
                  <DoorOpen className="h-2.5 w-2.5" /> {rotuloAmbiente(it.ambiente)}
                </span>
              ) : null}
              {it.taxonomia_id ? (
                <span
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "#16271e", color: "#6e9e8a", border: `1px solid ${BORDA}` }}
                  title="Atividade vinculada ao descritivo padrão (taxonomia)"
                >
                  📐 padrão
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#5c6b62]" />
      </div>

      {/* Situação (cor, readonly) | Andamento (chip) — lado a lado, nunca colapsam */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeloSituacao situacao={situacao} diasAtraso={it.dias_atraso} />
        <ChipAndamento andamento={it.andamento} />
      </div>

      {/* Barra de avanço + meta */}
      <div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0a140f]">
          <div className="h-full rounded-full" style={{ width: `${avanco}%`, background: cor }} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#8b949e]">
          <span>{avanco}%</span>
          {it.data_termino ? (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" />
              {fmtData(it.data_termino)}
            </span>
          ) : null}
          {bloq > 0 ? <span style={{ color: "#F59E0B" }}>⛔ {bloq} bloqueio{bloq > 1 ? "s" : ""}</span> : null}
          {it.tem_evidencia ? <span>📷</span> : null}
          {nSubitens > 0 ? <span>{nSubitens} subitens ▸</span> : null}
        </div>
      </div>
    </button>
  );
}

// ── Ficha do item (drawer 440px / bottom-sheet mobile) ────────────────────────
function FichaItem({
  item,
  obraId,
  subitens,
  onFechar,
  onSalvo,
}: {
  item: ItemObraRow;
  obraId: string;
  subitens: ItemObraRow[];
  onFechar: () => void;
  onSalvo: (atualizado: ItemObraRow) => void;
}) {
  const [pct, setPct] = useState<number>(item.pct_avanco ?? 0);
  const [andamento, setAndamento] = useState<AndamentoItem>(item.andamento);
  const [dataInicio, setDataInicio] = useState<string>(item.data_inicio?.slice(0, 10) ?? "");
  const [dataTermino, setDataTermino] = useState<string>(item.data_termino?.slice(0, 10) ?? "");
  const [bloqueios, setBloqueios] = useState<Record<string, boolean>>(
    Object.fromEntries(BLOQUEIOS.map((b) => [b.campo, item[b.campo as keyof ItemObraRow] === true]))
  );
  const [observacoes, setObservacoes] = useState<string>(item.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const temSubitens = subitens.length > 0;
  // % derivado quando há subitens (read-only); folha = editável.
  const avancoExibido = useMemo(() => {
    if (!temSubitens) return pct;
    const elegiveis = subitens.filter((s) => s.andamento !== "cancelado");
    if (!elegiveis.length) return pct;
    const soma = elegiveis.reduce((a, s) => a + (s.pct_avanco ?? 0), 0);
    return Math.round(soma / elegiveis.length);
  }, [temSubitens, subitens, pct]);

  // Situação recalculada otimista enquanto o dono mexe (espelha a view).
  const situacaoPreview = derivarSituacao({
    andamento,
    pct_avanco: temSubitens ? avancoExibido : pct,
    situacao_override: item.situacao_override,
    data_inicio: dataInicio || null,
    data_termino: dataTermino || null,
  });

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/itens`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          id: item.id,
          ...(temSubitens ? {} : { pct_avanco: pct }), // só folha grava avanço próprio
          andamento,
          data_inicio: dataInicio || null,
          data_termino: dataTermino || null,
          observacoes,
          ...bloqueios,
        }),
      });
      const json = (await res.json()) as { data?: ItemObraRow; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível salvar.");
        return;
      }
      onSalvo(json.data);
    } catch {
      setErro("Falha de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }, [obraId, item.id, temSubitens, pct, andamento, dataInicio, dataTermino, observacoes, bloqueios, onSalvo]);

  return (
    <>
      <div onClick={onFechar} aria-hidden style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.45)" }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Item ${item.nome}`}
        className="fixed inset-y-0 right-0 z-[81] flex w-full max-w-[440px] flex-col gap-3 overflow-y-auto p-4"
        style={{ background: "rgba(10,20,15,0.98)", borderLeft: `1px solid ${BORDA}` }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-[#e6edf3]">{item.nome}</p>
            <p className="truncate font-mono text-[11px] text-[#8b949e]">
              {[item.disciplina_slug, item.codigo, item.area_label].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border text-[#cdd9d2]"
            style={{ borderColor: BORDA, background: "#16271e" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Situação (auto) × Andamento (manual) — colunas distintas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border p-2" style={{ borderColor: BORDA, background: BG_CARD }}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#6e9e8a]">Situação (automática)</p>
            <SeloSituacao situacao={situacaoPreview} diasAtraso={item.dias_atraso} />
          </div>
          <div className="rounded-lg border p-2" style={{ borderColor: BORDA, background: BG_CARD }}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#6e9e8a]">Andamento (você declara)</p>
            <div className="flex flex-wrap gap-1">
              {ANDAMENTOS.map((a) => {
                const ativo = andamento === a;
                const cor = COR_ANDAMENTO[a];
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAndamento(a)}
                    className="rounded-full px-2 py-1 text-[11px] font-semibold"
                    style={{
                      color: ativo ? "#0a140f" : cor,
                      background: ativo ? cor : "transparent",
                      border: `1px solid ${cor}66`,
                    }}
                  >
                    {ROTULO_ANDAMENTO[a]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Avanço */}
        <div className="rounded-lg border p-3" style={{ borderColor: BORDA, background: BG_CARD }}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-bold text-[#cdd9d2]">
              Avanço {temSubitens ? <span className="text-[10px] font-normal text-[#6e9e8a]">(calculado dos {subitens.length} subitens)</span> : null}
            </p>
            <button
              type="button"
              onClick={() => abrirCopilotoVoz()}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{ color: DOURADO, border: `1px solid ${DOURADO}44` }}
            >
              <Mic className="h-3 w-3" /> &quot;marca 75%&quot;
            </button>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={avancoExibido}
            disabled={temSubitens}
            onChange={(e) => setPct(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: DOURADO, height: 24 }}
            aria-label="Percentual de avanço"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-lg font-bold text-[#e6edf3]">{avancoExibido}%</span>
            {!temSubitens ? (
              <div className="flex gap-1">
                {[25, 50, 75, 100].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setPct(v)}
                    className="min-h-[36px] rounded-md px-2.5 text-[12px] font-semibold"
                    style={{
                      color: pct === v ? "#0a140f" : DOURADO,
                      background: pct === v ? DOURADO : "transparent",
                      border: `1px solid ${DOURADO}44`,
                    }}
                  >
                    {v === 100 ? "✓100" : v}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
            Início
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="min-h-[44px] rounded-lg border px-2 text-sm text-[#e6edf3]"
              style={{ borderColor: BORDA, background: BG_CARD }}
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
            Término
            <input
              type="date"
              value={dataTermino}
              onChange={(e) => setDataTermino(e.target.value)}
              className="min-h-[44px] rounded-lg border px-2 text-sm text-[#e6edf3]"
              style={{ borderColor: BORDA, background: BG_CARD }}
            />
          </label>
        </div>

        {/* Bloqueios (as 5 faltas) */}
        <div className="rounded-lg border p-3" style={{ borderColor: BORDA, background: BG_CARD }}>
          <p className="mb-2 text-[12px] font-bold text-[#cdd9d2]">Bloqueios</p>
          <div className="flex flex-wrap gap-1.5">
            {BLOQUEIOS.map((b) => {
              const ativo = !!bloqueios[b.campo];
              return (
                <button
                  key={b.campo}
                  type="button"
                  onClick={() => setBloqueios((s) => ({ ...s, [b.campo]: !s[b.campo] }))}
                  className="inline-flex min-h-[40px] items-center gap-1 rounded-lg px-2.5 text-[12px] font-semibold"
                  style={{
                    color: ativo ? "#F59E0B" : "#6e9e8a",
                    background: ativo ? "#F59E0B1a" : "transparent",
                    border: `1px solid ${ativo ? "#F59E0B66" : BORDA}`,
                  }}
                >
                  <span>{b.icone}</span>
                  {ativo ? `Falta ${b.label.toLowerCase()}!` : b.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subitens */}
        {temSubitens ? (
          <div className="rounded-lg border p-3" style={{ borderColor: BORDA, background: BG_CARD }}>
            <p className="mb-2 text-[12px] font-bold text-[#cdd9d2]">{subitens.length} subitens</p>
            <div className="flex flex-col gap-1.5">
              {subitens.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="min-w-0 flex-1 truncate text-[#cdd9d2]">
                    <span className="font-mono text-[10px] text-[#8b949e]">{s.codigo}</span> {s.nome}
                  </span>
                  <SeloSituacao situacao={situacaoDe(s)} diasAtraso={s.dias_atraso} />
                  <span className="text-[#8b949e]">{s.pct_avanco ?? 0}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Observações */}
        <label className="flex flex-col gap-1 text-[11px] text-[#8b949e]">
          Observações
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            className="rounded-lg border px-2 py-2 text-sm text-[#e6edf3]"
            style={{ borderColor: BORDA, background: BG_CARD }}
          />
        </label>

        {erro ? (
          <p className="flex items-center gap-1 text-[12px] text-[#f85149]">
            <AlertTriangle className="h-3.5 w-3.5" /> {erro}
          </p>
        ) : null}

        {/* Ações */}
        <div className="sticky bottom-0 -mx-4 mt-auto flex gap-2 border-t px-4 pt-3" style={{ borderColor: BORDA, background: "rgba(10,20,15,0.98)" }}>
          <button
            type="button"
            disabled
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-3 text-[12px] font-semibold opacity-50"
            style={{ color: DOURADO, border: `1px solid ${DOURADO}44` }}
            title="Em breve"
          >
            <Camera className="h-4 w-4" /> Evidência
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-3 text-[13px] font-bold"
            style={{ color: "#f0c869", background: "linear-gradient(180deg, #1d5c3c, #003b26)", border: `1px solid ${DOURADO}` }}
          >
            <Save className="h-4 w-4" /> {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Seção principal ───────────────────────────────────────────────────────────
export function ObraItensSecao({ obraId }: { obraId: string }) {
  const [itens, setItens] = useState<ItemObraRow[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [pendente, setPendente] = useState(false);
  const [agrupar, setAgrupar] = useState<Agrupar>("disciplina");
  const [aberto, setAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/itens`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as {
        data?: ItemObraRow[];
        migracao_pendente?: boolean;
      };
      setItens(json.data ?? []);
      setPendente(!!json.migracao_pendente);
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, [obraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nivel0 = useMemo(() => itens.filter((i) => i.parent_id == null), [itens]);
  const subitensPorPai = useMemo(() => {
    const m = new Map<string, ItemObraRow[]>();
    for (const i of itens) {
      if (!i.parent_id) continue;
      const arr = m.get(i.parent_id) ?? [];
      arr.push(i);
      m.set(i.parent_id, arr);
    }
    return m;
  }, [itens]);

  const kpis = useMemo(
    () =>
      calcularKpisItens(
        nivel0.map((i) => ({ andamento: i.andamento, situacao: situacaoDe(i), parent_id: i.parent_id }))
      ),
    [nivel0]
  );
  const totalBloqueios = useMemo(
    () => nivel0.reduce((n, i) => n + (contarBloqueiosItem(i) > 0 ? 1 : 0), 0),
    [nivel0]
  );

  // E0.5: o eixo "Ambiente" só faz sentido se algum item tiver `ambiente` preenchido.
  // Sem nenhum (legado ou migração E0.5 pendente), o eixo degrada: o botão mostra aviso e,
  // se selecionado, tudo cai em "Sem ambiente definido" (nunca tela morta).
  const temAmbiente = useMemo(
    () => nivel0.some((i) => typeof i.ambiente === "string" && i.ambiente.trim().length > 0),
    [nivel0]
  );

  // Agrupamento (disciplina / andar / ambiente) — mesmo dado, eixo diferente, sem recarregar.
  const grupos = useMemo(() => {
    const m = new Map<string, { label: string; itens: ItemObraRow[] }>();
    for (const i of nivel0) {
      let chave: string;
      let label: string;
      if (agrupar === "ambiente") {
        const amb = (i.ambiente || "").trim();
        chave = amb || "sem";
        label = amb ? rotuloAmbiente(amb) : "Sem ambiente definido";
      } else if (agrupar === "andar") {
        chave = i.area_codigo || "sem";
        label = i.area_label || "Sem andar";
      } else {
        chave = i.disciplina_slug || "sem";
        label = i.disciplina_slug || "Sem disciplina";
      }
      const g = m.get(chave) ?? { label, itens: [] };
      g.itens.push(i);
      m.set(chave, g);
    }
    return [...m.values()].sort((a, b) => b.itens.length - a.itens.length);
  }, [nivel0, agrupar]);

  const itemAberto = aberto ? itens.find((i) => i.id === aberto) ?? null : null;

  const aoSalvar = useCallback((atualizado: ItemObraRow) => {
    setItens((arr) => arr.map((i) => (i.id === atualizado.id ? { ...i, ...atualizado } : i)));
    setAberto(null);
  }, []);

  if (carregando) {
    return <p className="p-4 text-sm text-[#8b949e]">Carregando itens…</p>;
  }

  if (pendente) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={{ borderColor: BORDA, background: BG_CARD }}>
        <p className="font-semibold text-[#e3b341]">Itens &amp; avanço ainda não ativos</p>
        <p className="mt-1 text-[#8b949e]">
          A estrutura de itens por disciplina×andar (Situação automática × Andamento manual) será ativada
          quando a migração E2 for aplicada. Nada foi perdido — a obra segue funcionando.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Cabeçalho: KPIs + toggle de agrupamento + CTAs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#cdd9d2]">
          <span><strong className="text-[#e6edf3]">{kpis.total}</strong> itens</span>
          <span style={{ color: COR_ANDAMENTO.finalizado }}>✓ {kpis.finalizados} finalizados</span>
          <span style={{ color: COR_SITUACAO.atrasado }}>● {kpis.atrasados} atrasados</span>
          <span style={{ color: "#F59E0B" }}>⛔ {totalBloqueios} bloqueados</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5" style={{ borderColor: BORDA, background: BG_CARD }}>
            {([
              { id: "ambiente", rotulo: "Ambiente", Icone: DoorOpen },
              { id: "disciplina", rotulo: "Disciplina", Icone: Layers },
              { id: "andar", rotulo: "Andar", Icone: Building2 },
            ] as const).map(({ id, rotulo, Icone }) => {
              const ativo = agrupar === id;
              // Eixo Ambiente sem dados: clicável (degrada p/ "Sem ambiente"), mas sinalizado.
              const semDados = id === "ambiente" && !temAmbiente;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAgrupar(id)}
                  title={semDados ? "Defina o ambiente dos itens (ou use um preset por segmento)" : undefined}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-semibold"
                  style={{
                    color: ativo ? "#f0c869" : semDados ? "#5c6b62" : "#8aa99a",
                    background: ativo ? "linear-gradient(180deg, #1d5c3c, #003b26)" : "transparent",
                    border: ativo ? `1px solid ${DOURADO}` : "1px solid transparent",
                  }}
                >
                  <Icone className="h-3.5 w-3.5" /> {rotulo}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => abrirCopilotoVoz()}
            aria-label="Falar com o copiloto"
            className="flex h-9 w-9 items-center justify-center rounded-lg border"
            style={{ borderColor: `${DOURADO}44`, color: DOURADO }}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* E0.5: dica não-bloqueante quando o eixo Ambiente está ativo mas nenhum item tem ambiente. */}
      {agrupar === "ambiente" && !temAmbiente && nivel0.length > 0 ? (
        <div className="rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: `${DOURADO}44`, background: `${DOURADO}12` }}>
          <p style={{ color: "#f0c869" }}>
            Estes itens ainda não têm <strong>ambiente</strong> definido — aparecem em
            “Sem ambiente definido”.
          </p>
          <p className="mt-0.5 text-[#8aa99a]">
            Defina o ambiente na ficha de cada item, ou comece novas obras com um preset por
            segmento (a IA já distribui por ambiente).
          </p>
        </div>
      ) : null}

      {nivel0.length === 0 ? (
        <div className="rounded-xl border p-6 text-center" style={{ borderColor: BORDA, background: BG_CARD }}>
          <p className="text-sm text-[#cdd9d2]">Nenhum item ainda.</p>
          <p className="mt-1 text-[12px] text-[#6e9e8a]">
            Adicione itens de contrato por disciplina e andar — ou peça ao copiloto.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {grupos.map((g) => {
            // §177 / avancoDerivadoDeSubitens: a média do grupo IGNORA cancelados (não contam no avanço).
            const elegiveis = g.itens.filter((i) => i.andamento !== "cancelado");
            const avancoGrupo = Math.round(
              elegiveis.reduce((a, i) => a + (i.pct_avanco ?? 0), 0) / Math.max(1, elegiveis.length)
            );
            return (
              <section key={g.label}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#cdd9d2]">{g.label}</h3>
                  <span className="text-[11px] text-[#6e9e8a]">{g.itens.length} itens · {avancoGrupo}%</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.itens.map((it) => (
                    <CardItem
                      key={it.id}
                      it={it}
                      nSubitens={subitensPorPai.get(it.id)?.length ?? 0}
                      onAbrir={() => setAberto(it.id)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {itemAberto ? (
        <FichaItem
          item={itemAberto}
          obraId={obraId}
          subitens={subitensPorPai.get(itemAberto.id) ?? []}
          onFechar={() => setAberto(null)}
          onSalvo={aoSalvar}
        />
      ) : null}
    </div>
  );
}

export default ObraItensSecao;
