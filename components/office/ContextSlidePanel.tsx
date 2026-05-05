"use client";

import { useEffect } from "react";

interface ContextSlidePanelProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  subtitulo?: string;
  cor?: string;
  children?: React.ReactNode;
}

export default function ContextSlidePanel({
  aberto,
  onFechar,
  titulo,
  subtitulo,
  cor = "#c9a24a",
  children,
}: ContextSlidePanelProps) {
  useEffect(() => {
    if (!aberto) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <>
      <div
        onClick={onFechar}
        style={{
          position: "fixed", inset: 0, zIndex: 800,
          background: "rgba(0,0,0,0.45)",
          animation: "fadeIn 180ms ease",
        }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 801,
        width: 360,
        background: "var(--obra-dark-2, #161b22)",
        borderLeft: `2px solid ${cor}30`,
        display: "flex", flexDirection: "column",
        animation: "slideInRight 240ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 3, height: 32, borderRadius: 2,
            background: cor, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--obra-texto, #e6edf3)" }}>{titulo}</div>
            {subtitulo && (
              <div style={{ fontSize: 10, color: "var(--obra-texto-2, #8b949e)", marginTop: 1 }}>{subtitulo}</div>
            )}
          </div>
          <button
            onClick={onFechar}
            style={{
              width: 28, height: 28, borderRadius: 6,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)", fontSize: 13, cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="panel-scroll" style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {children}
        </div>
      </div>
    </>
  );
}
