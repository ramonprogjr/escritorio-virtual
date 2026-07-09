"use client";

import type { ReactNode } from "react";

export type CadastroFichaTabId = "resumo" | "dados" | "vinculos" | "relacionados" | "registros";

const TAB_LABELS: Record<CadastroFichaTabId, string> = {
  resumo: "Resumo",
  dados: "Dados",
  vinculos: "Vínculos",
  relacionados: "Leads e negócios",
  registros: "Registros",
};

type Props = {
  active: CadastroFichaTabId;
  onChange: (tab: CadastroFichaTabId) => void;
  children: ReactNode;
  /** Abas exibidas (ordem preservada). Default = as 4 base; fichas com timeline passam "registros". */
  tabs?: CadastroFichaTabId[];
};

export function CadastroFichaTabs({ active, onChange, children, tabs }: Props) {
  // "registros" (timeline) é OPT-IN: só as fichas que renderizam o painel EntidadeTimeline o incluem,
  // para não deixar aba vazia nos sideovers. Default segue as 4 base.
  const tabsToRender: CadastroFichaTabId[] = tabs ?? ["resumo", "dados", "vinculos", "relacionados"];

  return (
    <div>
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          flexWrap: "wrap",
          marginBottom: 20,
          borderBottom: "1px solid #1d3a2c",
          paddingBottom: 0,
        }}
      >
        {tabsToRender.map((id) => {
          const selected = active === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              style={{
                padding: "10px 14px",
                fontSize: 13,
                fontWeight: selected ? 700 : 500,
                color: selected ? "#e6edf3" : "#8b949e",
                background: "transparent",
                border: "none",
                borderBottom: selected ? "2px solid #c9a24a" : "2px solid transparent",
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {TAB_LABELS[id]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  );
}
