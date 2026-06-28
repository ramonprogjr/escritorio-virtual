"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";

export type EntitySelectOption = {
  /** Valor salvo por baixo (id/slug). Nunca exibido cru ao usuário. */
  value: string;
  /** Rótulo principal exibido (nome/título). */
  label: string;
  /** Linha secundária opcional (código, status, cliente…). */
  sub?: string;
};

type Props = {
  /** Valor atualmente selecionado (id/slug salvo). */
  value: string;
  onChange: (value: string) => void;
  options: EntitySelectOption[];
  /** Texto do botão quando nada está selecionado. */
  placeholder?: string;
  /** Texto do campo de busca dentro do dropdown. */
  searchPlaceholder?: string;
  /** Mensagem quando não há nenhuma opção carregada. */
  emptyLabel?: string;
  loading?: boolean;
  erro?: string | null;
  /** Permite limpar a seleção (volta para vazio). */
  clearable?: boolean;
  disabled?: boolean;
  id?: string;
};

const BTN: React.CSSProperties = {
  width: "100%",
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #1d3a2c",
  background: "#0f1d16",
  color: "#e6edf3",
  fontSize: 14,
  textAlign: "left",
  cursor: "pointer",
  boxSizing: "border-box",
};

/**
 * Seletor de UMA entidade com busca (combobox). Substitui inputs onde o usuário
 * digitava id/uuid/slug cru: aqui ele ESCOLHE por nome e o id fica salvo por baixo.
 * Acessível (role=combobox/listbox), teclado completo, mobile-first, na marca.
 */
export function EntitySelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar…",
  searchPlaceholder = "Buscar…",
  emptyLabel = "Nenhuma opção disponível ainda.",
  loading = false,
  erro = null,
  clearable = false,
  disabled = false,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value]
  );

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options
      .filter((o) => `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(q))
      .slice(0, 80);
  }, [options, query]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Foca a busca ao abrir.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      const t = window.setTimeout(() => inputRef.current?.focus(), 10);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  function commit(idx: number) {
    const opt = resultados[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  }

  const desabilitado = disabled || loading;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={desabilitado}
        onClick={() => !desabilitado && setOpen((v) => !v)}
        style={{
          ...BTN,
          borderColor: open ? "#c9a24a" : "#1d3a2c",
          opacity: desabilitado ? 0.6 : 1,
          cursor: desabilitado ? "not-allowed" : "pointer",
        }}
      >
        <span
          style={{
            minWidth: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1,
          }}
        >
          {loading ? (
            <span style={{ color: "#8b949e", fontSize: 13 }}>Carregando opções…</span>
          ) : selected ? (
            <>
              <span
                style={{
                  color: "#e6edf3",
                  fontSize: 14,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selected.label}
              </span>
              {selected.sub ? (
                <span style={{ color: "#8b949e", fontSize: 11 }}>{selected.sub}</span>
              ) : null}
            </>
          ) : (
            <span style={{ color: "#6e7681", fontSize: 14 }}>{placeholder}</span>
          )}
        </span>
        {clearable && selected && !loading ? (
          <span
            role="button"
            aria-label="Limpar seleção"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              padding: 2,
              borderRadius: 6,
              color: "#8b949e",
            }}
          >
            <X size={15} aria-hidden />
          </span>
        ) : (
          <ChevronDown size={16} aria-hidden style={{ flexShrink: 0, color: "#8b949e" }} />
        )}
      </button>

      {open && !loading && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 50,
            background: "#0a140f",
            border: "1px solid #1d3a2c",
            borderRadius: 12,
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", padding: 8, borderBottom: "1px solid #1d3a2c" }}>
            <Search
              size={14}
              aria-hidden
              style={{ position: "absolute", left: 18, top: 18, color: "#6e7681", pointerEvents: "none" }}
            />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls="entity-select-listbox"
              aria-autocomplete="list"
              value={query}
              placeholder={searchPlaceholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIdx(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.min(i + 1, Math.max(resultados.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  commit(activeIdx);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
              style={{
                width: "100%",
                padding: "9px 12px 9px 34px",
                borderRadius: 8,
                border: "1px solid #1d3a2c",
                background: "#0f1d16",
                color: "#e6edf3",
                fontSize: 14,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <ul
            id="entity-select-listbox"
            role="listbox"
            style={{
              margin: 0,
              padding: 4,
              listStyle: "none",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {options.length === 0 ? (
              <li style={{ padding: "12px 10px", color: "#6e8099", fontSize: 12 }}>{emptyLabel}</li>
            ) : resultados.length === 0 ? (
              <li style={{ padding: "12px 10px", color: "#6e8099", fontSize: 12 }}>
                Nenhum resultado para “{query.trim()}”.
              </li>
            ) : (
              resultados.map((o, idx) => {
                const active = idx === activeIdx;
                const isSel = o.value === value;
                return (
                  <li
                    key={o.value}
                    role="option"
                    aria-selected={isSel}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(idx);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "9px 10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      background: active ? "rgba(201,162,74,0.12)" : "transparent",
                      border: `1px solid ${active ? "rgba(201,162,74,0.4)" : "transparent"}`,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          color: "#e6edf3",
                          fontSize: 13,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {o.label}
                      </span>
                      {o.sub ? (
                        <span style={{ display: "block", color: "#8b949e", fontSize: 11 }}>{o.sub}</span>
                      ) : null}
                    </span>
                    {isSel ? (
                      <Check size={15} aria-hidden style={{ flexShrink: 0, color: "#c9a24a" }} />
                    ) : null}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {erro ? (
        <p
          style={{
            margin: "6px 0 0",
            color: "#fca5a5",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {erro}
        </p>
      ) : null}
    </div>
  );
}
