"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";

const selectCls =
  "min-h-11 min-w-0 flex-1 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none focus:border-[#c9a24a] sm:min-h-10 sm:flex-none sm:min-w-[9rem]";

const inputCls =
  "min-h-11 w-full min-w-0 flex-1 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-2 text-sm text-[#e6edf3] outline-none placeholder:text-[#6e7681] focus:border-[#c9a24a] sm:min-h-10 sm:min-w-[12rem]";

type SelectOpt = { value: string; label: string };

type SelectConfig = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: SelectOpt[];
  minWidth?: string;
};

type Props = {
  busca: string;
  onBuscaChange: (v: string) => void;
  buscaPlaceholder: string;
  selects: SelectConfig[];
  onLimpar: () => void;
  trailing?: ReactNode;
};

function SelectField({ s, fullWidth }: { s: SelectConfig; fullWidth?: boolean }) {
  return (
    <select
      value={s.value}
      onChange={(e) => s.onChange(e.target.value)}
      className={fullWidth ? `${selectCls} w-full !flex-none` : selectCls}
      style={s.minWidth && !fullWidth ? { minWidth: s.minWidth } : undefined}
      aria-label={s.label}
    >
      {s.options.map((o) => (
        <option key={o.value || "__all"} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CadastroFiltrosBar({
  busca,
  onBuscaChange,
  buscaPlaceholder,
  selects,
  onLimpar,
  trailing,
}: Props) {
  const [mobileFiltrosAbertos, setMobileFiltrosAbertos] = useState(false);

  // O seletor de "Lista" (Contatos/Empresas) é a troca de aba principal — fica
  // SEMPRE visível. Os demais são filtros que podem colapsar no mobile.
  const listaSelect = selects.find((s) => s.id === "lista");
  const filtroSelects = selects.filter((s) => s.id !== "lista");

  // Quantos filtros (fora "Lista" e a busca) estão ativos — alimenta o badge mobile.
  const filtrosAtivos = filtroSelects.filter((s) => s.value !== "").length;
  const buscaAtiva = busca.trim() !== "";
  const temAlgumFiltro = filtrosAtivos > 0 || buscaAtiva;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      {/* ── MOBILE (< sm): busca em linha + Lista + botão Filtros ── */}
      <div className="flex items-center gap-2 sm:hidden">
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder={buscaPlaceholder}
          className={inputCls}
          aria-label="Buscar"
        />
        {filtroSelects.length > 0 && (
          <button
            type="button"
            onClick={() => setMobileFiltrosAbertos((v) => !v)}
            aria-expanded={mobileFiltrosAbertos}
            aria-label="Filtros"
            className={`relative flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              mobileFiltrosAbertos || filtrosAtivos > 0
                ? "border-[#c9a24a]/60 bg-[#c9a24a]/12 text-[#c9a24a]"
                : "border-[#1d3a2c] text-[#8b949e]"
            }`}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {filtrosAtivos > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c9a24a] px-1 text-[10px] font-bold text-[#003b26]">
                {filtrosAtivos}
              </span>
            )}
          </button>
        )}
      </div>

      {listaSelect && (
        <div className="sm:hidden">
          <SelectField s={listaSelect} fullWidth />
        </div>
      )}

      {/* Painel colapsável de filtros (mobile) */}
      {mobileFiltrosAbertos && filtroSelects.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3 sm:hidden">
          {filtroSelects.map((s) => (
            <div key={s.id} className="flex flex-col gap-1">
              <label className="text-[10px] font-bold uppercase tracking-wide text-[#8b949e]">
                {s.label}
              </label>
              <SelectField s={s} fullWidth />
            </div>
          ))}
          <div className="mt-1 flex items-center gap-2">
            {temAlgumFiltro && (
              <button
                type="button"
                onClick={onLimpar}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#1d3a2c] px-3 text-xs font-semibold text-[#8b949e] transition-colors hover:border-[#484f58] hover:text-white"
              >
                <X className="h-3.5 w-3.5" /> Limpar filtros
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileFiltrosAbertos(false)}
              className="min-h-11 flex-1 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
            >
              Aplicar
            </button>
          </div>
        </div>
      )}

      {/* ── DESKTOP (sm+): barra inline original (sem regressão) ── */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <input
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder={buscaPlaceholder}
          className={inputCls}
          aria-label="Buscar"
        />
        {selects.map((s) => (
          <SelectField key={s.id} s={s} />
        ))}
        <button
          type="button"
          onClick={onLimpar}
          className="min-h-10 shrink-0 rounded-lg border border-[#1d3a2c] px-3 py-2 text-xs font-semibold text-[#8b949e] transition-colors hover:border-[#484f58] hover:text-white"
        >
          Limpar filtros
        </button>
        {trailing}
      </div>

      {/* trailing no mobile (ações extras), se houver */}
      {trailing && <div className="sm:hidden">{trailing}</div>}
    </div>
  );
}
