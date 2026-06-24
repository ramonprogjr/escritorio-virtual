"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

type Col = { id: string; label: string };

/** Menu para mostrar/ocultar colunas da lista (preferência local). */
export function ColunasMenu({
  colunas,
  isVisivel,
  alternar,
  restaurar,
}: {
  colunas: Col[];
  isVisivel: (id: string) => boolean;
  alternar: (id: string) => void;
  restaurar: () => void;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        title="Colunas"
        aria-expanded={aberto}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8,
          border: "1px solid #30363d", background: "#21262d", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}
      >
        <SlidersHorizontal size={14} aria-hidden /> Colunas
      </button>

      {aberto && (
        <>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setAberto(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "transparent", border: "none", cursor: "default" }}
          />
          <div
            role="dialog"
            aria-label="Mostrar/ocultar colunas"
            style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, width: 240,
              maxHeight: "60vh", overflowY: "auto", borderRadius: 12, border: "1px solid #2b3544",
              background: "#0f1520", boxShadow: "0 16px 48px rgba(0,0,0,0.55)", padding: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#6e7681" }}>Colunas</span>
              <button type="button" onClick={restaurar} style={{ background: "none", border: "none", color: "#c9a24a", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Restaurar</button>
            </div>
            {colunas.map((c) => (
              <label
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#e6edf3" }}
              >
                <input type="checkbox" checked={isVisivel(c.id)} onChange={() => alternar(c.id)} />
                <span style={{ flex: 1, minWidth: 0 }}>{c.label}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
