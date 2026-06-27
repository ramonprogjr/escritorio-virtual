"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";

export type ParticipanteTipo = "lead" | "pessoa" | "empresa" | "parceiro";

export type ParticipanteOpt = {
  /** Chave única global: `${tipo}:${id}` (evita colisão de id entre tabelas). */
  uid: string;
  id: string;
  tipo: ParticipanteTipo;
  nome: string;
  /** Linha secundária: telefone ou código. */
  sub?: string;
  /** nome+sub lowercased, pré-computado para filtro O(1). */
  busca: string;
};

export const PARTICIPANTE_TIPO_META: Record<
  ParticipanteTipo,
  { label: string; plural: string; cor: string; bg: string; borda: string }
> = {
  lead: { label: "Lead", plural: "Leads", cor: "#9ecbff", bg: "rgba(47,129,247,0.13)", borda: "rgba(47,129,247,0.45)" },
  pessoa: { label: "Pessoa", plural: "Pessoas", cor: "#c4b5fd", bg: "rgba(139,92,246,0.13)", borda: "rgba(139,92,246,0.45)" },
  empresa: { label: "Empresa", plural: "Empresas", cor: "#86efac", bg: "rgba(34,197,94,0.13)", borda: "rgba(34,197,94,0.45)" },
  parceiro: { label: "Parceiro", plural: "Parceiros", cor: "#fcd34d", bg: "rgba(245,158,11,0.13)", borda: "rgba(245,158,11,0.45)" },
};

const ORDEM: ParticipanteTipo[] = ["lead", "pessoa", "empresa", "parceiro"];

type Props = {
  opcoes: ParticipanteOpt[];
  /** uids já vinculados. */
  selecionados: string[];
  onAdd: (opt: ParticipanteOpt) => void;
  onRemove: (uid: string) => void;
  loading?: boolean;
  erro?: string;
};

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px 11px 38px",
  borderRadius: 10,
  border: "1px solid #1d3a2c",
  background: "#0f1d16",
  color: "#e6edf3",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
};

/**
 * Combobox unificado de busca + multi-seleção para vincular participantes
 * (lead/pessoa/empresa/parceiro) a um negócio. Um campo só: digita o nome e o
 * sistema acha onde estiver; o tipo é metadado do resultado, não escolha prévia.
 */
export function ParticipantePicker({ opcoes, selecionados, onAdd, onRemove, loading, erro }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const blurTimer = useRef<number | null>(null);

  const selSet = useMemo(() => new Set(selecionados), [selecionados]);

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = opcoes.filter((o) => !selSet.has(o.uid));
    if (!q) return base.slice(0, 8);
    return base.filter((o) => o.busca.includes(q)).slice(0, 50);
  }, [opcoes, query, selSet]);

  const chips = useMemo(() => opcoes.filter((o) => selSet.has(o.uid)), [opcoes, selSet]);

  function commit(idx: number) {
    const opt = resultados[idx];
    if (!opt) return;
    onAdd(opt);
    setQuery("");
    setActiveIdx(0);
    setOpen(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ position: "relative" }}>
        <Search
          size={15}
          aria-hidden
          style={{ position: "absolute", left: 13, top: 13, color: "#6e7681", pointerEvents: "none" }}
        />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls="participante-listbox"
          aria-autocomplete="list"
          value={query}
          disabled={loading}
          placeholder={
            loading ? "Carregando participantes…" : `Buscar entre ${opcoes.length} participantes…`
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActiveIdx((i) => Math.min(i + 1, Math.max(resultados.length - 1, 0)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              commit(activeIdx);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === "Backspace" && !query && chips.length) {
              onRemove(chips[chips.length - 1].uid);
            }
          }}
          style={{ ...INPUT, borderColor: open ? "#c9a24a" : "#1d3a2c" }}
        />

        {open && !loading && (
          <ul
            id="participante-listbox"
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 20,
              margin: 0,
              padding: 4,
              listStyle: "none",
              maxHeight: 320,
              overflowY: "auto",
              background: "#0a140f",
              border: "1px solid #2c384b",
              borderRadius: 12,
              boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            }}
          >
            {resultados.length === 0 ? (
              <li style={{ padding: "12px 10px", color: "#6e8099", fontSize: 12 }}>
                {query.trim() ? "Nenhum participante encontrado." : "Comece a digitar para buscar."}
              </li>
            ) : (
              resultados.map((o, idx) => {
                const meta = PARTICIPANTE_TIPO_META[o.tipo];
                const active = idx === activeIdx;
                return (
                  <li
                    key={o.uid}
                    role="option"
                    aria-selected={active}
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
                        {o.nome}
                      </span>
                      {o.sub ? (
                        <span style={{ display: "block", color: "#8b949e", fontSize: 11 }}>{o.sub}</span>
                      ) : null}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: 0.04,
                        color: meta.cor,
                        background: meta.bg,
                        border: `1px solid ${meta.borda}`,
                        borderRadius: 4,
                        padding: "2px 6px",
                      }}
                    >
                      {meta.label}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {erro ? (
        <p
          style={{
            margin: 0,
            color: "#fca5a5",
            fontSize: 12,
            lineHeight: 1.5,
            border: "1px solid rgba(239,68,68,0.25)",
            background: "rgba(127,29,29,0.18)",
            borderRadius: 10,
            padding: "8px 10px",
          }}
        >
          Algumas listas não carregaram totalmente: {erro}
        </p>
      ) : null}

      {chips.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ORDEM.map((tipo) => {
            const grupo = chips.filter((c) => c.tipo === tipo);
            if (!grupo.length) return null;
            const meta = PARTICIPANTE_TIPO_META[tipo];
            return (
              <div key={tipo}>
                <p
                  style={{
                    margin: "0 0 5px",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.04,
                    textTransform: "uppercase",
                    color: "#8b949e",
                  }}
                >
                  {meta.plural}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {grupo.map((c) => (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => onRemove(c.uid)}
                      title="Remover vínculo"
                      style={{
                        borderRadius: 999,
                        border: `1px solid ${meta.borda}`,
                        background: meta.bg,
                        color: meta.cor,
                        padding: "6px 10px",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {c.nome} ×
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p style={{ margin: 0, color: "#6e8099", fontSize: 11, lineHeight: 1.45 }}>
            O 1º de cada grupo vira o vínculo principal; os demais ficam rastreados no negócio.
          </p>
        </div>
      ) : null}
    </div>
  );
}
