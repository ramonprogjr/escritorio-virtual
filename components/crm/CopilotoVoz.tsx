"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Mic, Square, X, Loader2, Sparkles, Check, ChevronDown, AlertTriangle } from "lucide-react";
import { useCopilotoVoz } from "@/hooks/useCopilotoVoz";

/** Rótulos amigáveis para os params mostrados nos chips de confirmação. */
const ROTULO_PARAM: Record<string, string> = {
  texto: "Nota",
  estagio: "Estágio",
  score: "Score",
  valor_estimado: "Valor estimado",
  nome: "Nome",
  email: "E-mail",
  interesse_principal: "Interesse",
  proxima_acao: "Próxima ação",
  data_proxima_acao: "Data",
  tags_adicionar: "Tags",
};

function rotuloFerramenta(t: string): string {
  if (t === "hub_registar_nota_lead") return "Adicionar nota ao lead";
  if (t === "hub_atualizar_lead") return "Atualizar o lead";
  return t;
}

function valorChip(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "string") return v;
  return String(v ?? "");
}

const FAB = 60;
const POS_KEY = "copiloto-fab-pos";

function leadIdDaRota(pathname: string): string | undefined {
  const m = pathname.match(/\/crm\/leads\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : undefined;
}

/** Copiloto de Voz Global — FAB verde arrastável + painel de escuta/transcrição/resposta. */
export function CopilotoVoz() {
  const pathname = usePathname() || "/crm";
  const {
    estado,
    transcricaoLive,
    resultado,
    mensagem,
    modeloUsado,
    acaoPendente,
    toggle,
    cancelar,
    confirmarAcao,
    cancelarAcao,
  } = useCopilotoVoz({ contexto: { rota: pathname, leadId: leadIdDaRota(pathname) } });

  const [verJson, setVerJson] = useState(false);

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragInfo = useRef<{ startX: number; startY: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Posição inicial: canto inferior direito (mobile) / inferior esquerdo (desktop).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(POS_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") {
          setPos(clamp(p.x, p.y));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    // Canto inferior direito; no desktop sobe pra não colidir com o QuickAdd.
    const desktop = window.innerWidth >= 768;
    setPos({
      x: window.innerWidth - FAB - 16,
      y: window.innerHeight - FAB - (desktop ? 160 : 92),
    });
  }, []);

  function clamp(x: number, y: number) {
    if (typeof window === "undefined") return { x, y };
    return {
      x: Math.max(8, Math.min(x, window.innerWidth - FAB - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - FAB - 8)),
    };
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!pos) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragInfo.current = { startX: e.clientX, startY: e.clientY, ox: pos.x, oy: pos.y, moved: false };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragInfo.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < 8) return; // threshold: <8px = clique
    d.moved = true;
    setPos(clamp(d.ox + dx, d.oy + dy));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragInfo.current;
    dragInfo.current = null;
    if (!d) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (!d.moved) {
      toggle();
      return;
    }
    // snap à borda horizontal mais próxima
    setPos((p) => {
      if (!p || typeof window === "undefined") return p;
      const snapX = p.x + FAB / 2 < window.innerWidth / 2 ? 16 : window.innerWidth - FAB - 16;
      const next = clamp(snapX, p.y);
      try {
        localStorage.setItem(POS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [toggle]);

  if (!pos) return null;

  const ouvindo = estado === "listening";
  const processando = estado === "processing";
  const confirmando = estado === "confirming";
  const aberto = estado !== "idle";

  return (
    <>
      {/* Painel */}
      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Copiloto de voz"
          style={{
            position: "fixed",
            zIndex: 91,
            left: "50%",
            transform: "translateX(-50%)",
            bottom: 0,
            width: "min(440px, 100%)",
            maxHeight: "70dvh",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 16,
            paddingBottom: "max(16px, env(safe-area-inset-bottom))",
            background: "rgba(10,20,15,0.97)",
            backdropFilter: "blur(10px)",
            border: "1px solid #1d3a2c",
            borderBottom: "none",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            boxShadow: "0 -12px 40px rgba(0,0,0,0.5)",
          }}
        >
          {/* Zona 1 — status */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: ouvindo ? "#2f9e8f" : processando ? "#e3b341" : "#3fb950",
                boxShadow: ouvindo ? "0 0 0 4px #2f9e8f33" : "none",
                animation: ouvindo ? "copilotoPulse 1.2s ease-in-out infinite" : "none",
              }}
            />
            <strong style={{ color: "#e6edf3", fontSize: 13, flex: 1 }}>
              {ouvindo
                ? "Ouvindo…"
                : processando
                  ? "Processando…"
                  : confirmando
                    ? "Confirme para eu fazer"
                    : estado === "erro"
                      ? "Ops"
                      : "Copiloto"}
            </strong>
            {modeloUsado && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                background: /claude/i.test(modeloUsado) ? "#e3b34122" : "#2f9e8f22",
                color: /claude/i.test(modeloUsado) ? "#e3b341" : "#2f9e8f",
              }}>
                {/claude/i.test(modeloUsado) ? "Claude" : "Mistral"}
              </span>
            )}
            <button onClick={cancelar} aria-label="Fechar" style={{ background: "none", border: "none", cursor: "pointer", color: "#8b949e", padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Zona 2 — transcrição ao vivo */}
          <div style={{
            minHeight: 64, maxHeight: 140, overflowY: "auto",
            background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 12,
            padding: 12, color: transcricaoLive ? "#e6edf3" : "#6e7681",
            fontSize: 14, lineHeight: 1.5,
          }}>
            {transcricaoLive || (ouvindo ? "Fale agora…" : "Toque no microfone e fale.")}
          </div>

          {/* Zona 3 — resposta/resultado */}
          {mensagem && (
            <p style={{ margin: 0, color: estado === "erro" ? "#f85149" : "#cdd9d2", fontSize: 13, lineHeight: 1.55 }}>
              {mensagem}
            </p>
          )}
          {resultado != null && (
            <pre style={{
              margin: 0, maxHeight: 180, overflow: "auto",
              background: "#0a140f", border: "1px solid #1d3a2c", borderRadius: 10,
              padding: 12, color: "#9fd3bf", fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>
              {typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2)}
            </pre>
          )}

          {/* Zona 4 — confirmação de ESCRITA (dourado). Nada executa sem clicar Confirmar. */}
          {confirmando && acaoPendente && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#1a1405",
                border: "1px solid #c9a24a",
                borderRadius: 14,
                padding: 14,
                boxShadow: "0 0 0 3px #c9a24a18",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} color="#f0c869" />
                <strong style={{ color: "#f0c869", fontSize: 12.5, letterSpacing: 0.2 }}>
                  Vou fazer: {rotuloFerramenta(acaoPendente.ferramenta)}
                </strong>
              </div>

              {acaoPendente.descricao && (
                <p style={{ margin: 0, color: "#f3e6c4", fontSize: 13.5, lineHeight: 1.5 }}>
                  {acaoPendente.descricao}
                </p>
              )}

              {/* Chips dos campos que vão mudar */}
              {Object.keys(acaoPendente.params).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {Object.entries(acaoPendente.params).map(([k, v]) => (
                    <span
                      key={k}
                      style={{
                        display: "inline-flex",
                        gap: 5,
                        alignItems: "baseline",
                        maxWidth: "100%",
                        padding: "4px 9px",
                        borderRadius: 999,
                        background: "#241b06",
                        border: "1px solid #5c4a1d",
                        color: "#e8d49a",
                        fontSize: 11.5,
                      }}
                    >
                      <span style={{ color: "#c9a24a", fontWeight: 700 }}>
                        {ROTULO_PARAM[k] ?? k}:
                      </span>
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 220,
                        }}
                        title={valorChip(v)}
                      >
                        {valorChip(v)}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Detalhes (JSON exato) — colapsável */}
              <button
                type="button"
                onClick={() => setVerJson((s) => !s)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  alignSelf: "flex-start",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#b89a52",
                  fontSize: 11.5,
                  padding: 0,
                }}
                aria-expanded={verJson}
              >
                <ChevronDown
                  size={13}
                  style={{ transform: verJson ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                />
                Ver detalhes (JSON)
              </button>
              {verJson && (
                <pre
                  style={{
                    margin: 0,
                    maxHeight: 160,
                    overflow: "auto",
                    background: "#0f0c03",
                    border: "1px solid #5c4a1d",
                    borderRadius: 10,
                    padding: 10,
                    color: "#e8d49a",
                    fontSize: 11,
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {JSON.stringify(acaoPendente.params, null, 2)}
                </pre>
              )}

              {/* Botões grandes: Confirmar (verde/dourado) + Cancelar (vermelho) */}
              <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                <button
                  onClick={confirmarAcao}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "13px 0",
                    borderRadius: 12,
                    border: "1px solid #c9a24a",
                    background: "linear-gradient(180deg, #1d5c3c, #003b26)",
                    color: "#f0c869",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <Check size={17} /> Confirmar
                </button>
                <button
                  onClick={cancelarAcao}
                  style={{
                    flex: 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    padding: "13px 0",
                    borderRadius: 12,
                    border: "1px solid #5c1d1d",
                    background: "#2a0f0f",
                    color: "#f3a0a0",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  <X size={17} /> Cancelar
                </button>
              </div>
            </div>
          )}

          {estado === "done" || estado === "erro" ? (
            <button
              onClick={toggle}
              style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                padding: "11px 0", borderRadius: 10, border: "none",
                background: "#003b26", color: "#c9a24a", fontWeight: 800, fontSize: 13, cursor: "pointer",
              }}
            >
              <Mic size={15} /> Falar de novo
            </button>
          ) : null}
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        aria-label={ouvindo ? "Parar de ouvir" : "Falar com o copiloto"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          width: FAB,
          height: FAB,
          zIndex: 90,
          borderRadius: "50%",
          border: "2px solid #c9a24a",
          background: ouvindo
            ? "linear-gradient(180deg, #2f9e8f, #1d5c3c)"
            : "linear-gradient(180deg, #003b26, #1d5c3c)",
          boxShadow: ouvindo ? "0 0 0 6px #2f9e8f22, 0 8px 24px rgba(0,0,0,0.45)" : "0 6px 20px rgba(0,0,0,0.45)",
          color: "#f0c869",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "grab",
          touchAction: "none",
          animation: estado === "idle" ? "copilotoFabPulse 2.4s ease-in-out infinite" : "none",
        }}
      >
        {processando ? <Loader2 size={24} className="animate-spin" /> : ouvindo ? <Square size={22} fill="#f0c869" /> : <Mic size={24} />}
        {estado === "idle" && (
          <span style={{ position: "absolute", top: -2, right: -2, color: "#c9a24a" }}>
            <Sparkles size={14} />
          </span>
        )}
      </button>

      <style>{`
        @keyframes copilotoPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes copilotoFabPulse { 0%,100%{box-shadow:0 6px 20px rgba(0,0,0,.45)} 50%{box-shadow:0 6px 20px rgba(0,0,0,.45),0 0 0 7px #c9a24a14} }
      `}</style>
    </>
  );
}

export default CopilotoVoz;
