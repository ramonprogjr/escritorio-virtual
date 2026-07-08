"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Mic, Square, X, Loader2, Sparkles, Check, ChevronDown, AlertTriangle, Pencil, Send } from "lucide-react";
import { useCopilotoVoz } from "@/hooks/useCopilotoVoz";

const HINT_KEY = "copiloto-hint-visto";
const HINT_EXEMPLOS = [
  "resumo deste lead",
  "métricas do escritório",
  "adicionar nota ao lead",
];

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

// Campos que merecem label legível no resultado humanizado
const ROTULO_RESULTADO: Record<string, string> = {
  id: "ID",
  nome: "Nome",
  email: "E-mail",
  telefone: "Telefone",
  estagio: "Estágio",
  score: "Score",
  valor_estimado: "Valor estimado",
  interesse_principal: "Interesse",
  proxima_acao: "Próxima ação",
  data_proxima_acao: "Data",
  origem: "Origem",
  status: "Status",
  texto: "Nota",
  created_at: "Criado em",
  updated_at: "Atualizado em",
  tags: "Tags",
};

// Campos a ocultar na visão resumida (técnicos / redundantes)
const CAMPOS_OCULTOS = new Set(["tenant_id", "owner_id", "lead_id", "empresa_id", "pessoa_id"]);

// Formata um valor individual de forma legível
function formatarValor(chave: string, valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) return valor.join(", ") || "—";
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "string") {
    // Tenta formatar datas ISO
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(valor)) {
      try {
        return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(valor));
      } catch { /* ignore */ }
    }
    return valor;
  }
  if (typeof valor === "number") {
    if (chave.includes("valor") || chave.includes("preco") || chave.includes("price")) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
    }
    return String(valor);
  }
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}

// Detecta se um resultado é "escrita bem-sucedida" (tem action_taken/operacao/sucesso)
function detectarEscrita(resultado: unknown): { foi: boolean; descricao: string } {
  if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) {
    return { foi: false, descricao: "" };
  }
  const r = resultado as Record<string, unknown>;
  if (r.action_taken || r.operacao || r.sucesso === true || r.ok === true) {
    const desc =
      typeof r.mensagem === "string" ? r.mensagem :
      typeof r.action_taken === "string" ? r.action_taken :
      typeof r.operacao === "string" ? r.operacao : "";
    return { foi: true, descricao: desc };
  }
  return { foi: false, descricao: "" };
}

interface ResultadoHumanizadoProps {
  resultado: unknown;
  verJson: boolean;
  onToggleJson: () => void;
  escrita: boolean;
  mensagem: string;
}

function ResultadoHumanizado({ resultado, verJson, onToggleJson, mensagem }: ResultadoHumanizadoProps) {
  const escritaDetectada = detectarEscrita(resultado);

  // Resultado de ESCRITA bem-sucedida: mostra "Feito" grande
  if (escritaDetectada.foi) {
    return (
      <div style={{
        background: "#0a1f14", border: "1px solid #2f9e4a", borderRadius: 12,
        padding: "16px 14px", display: "flex", flexDirection: "column", gap: 6, alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "#1a4a28",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Check size={18} color="#3fb950" />
          </div>
          <strong style={{ color: "#3fb950", fontSize: 15 }}>Feito</strong>
        </div>
        {(escritaDetectada.descricao || mensagem) && (
          <p style={{ margin: 0, color: "#9fd3bf", fontSize: 12.5, textAlign: "center", lineHeight: 1.4 }}>
            {escritaDetectada.descricao || mensagem}
          </p>
        )}
      </div>
    );
  }

  // Resultado de LEITURA: tenta renderizar campos legíveis
  if (resultado && typeof resultado === "object" && !Array.isArray(resultado)) {
    const obj = resultado as Record<string, unknown>;
    const entradas = Object.entries(obj).filter(([k]) => !CAMPOS_OCULTOS.has(k));
    const visiveis = entradas.filter(([k]) => ROTULO_RESULTADO[k] !== undefined);
    const extras = entradas.filter(([k]) => ROTULO_RESULTADO[k] === undefined);
    const linhas = [...visiveis, ...extras].slice(0, 12); // no máximo 12 linhas

    return (
      <div style={{
        background: "#0a140f", border: "1px solid #1d3a2c", borderRadius: 12,
        overflow: "hidden",
      }}>
        {linhas.map(([k, v], i) => (
          <div
            key={k}
            style={{
              display: "flex", gap: 8, alignItems: "flex-start",
              padding: "7px 12px",
              borderBottom: i < linhas.length - 1 ? "1px solid #122218" : "none",
              background: i % 2 === 0 ? "transparent" : "#0c1a10",
            }}
          >
            <span style={{ color: "#c9a24a", fontSize: 11.5, fontWeight: 700, flexShrink: 0, minWidth: 100 }}>
              {ROTULO_RESULTADO[k] ?? k}
            </span>
            <span style={{ color: "#cdd9d2", fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}>
              {formatarValor(k, v)}
            </span>
          </div>
        ))}
        {/* Ver detalhes colapsável */}
        <div style={{ padding: "6px 12px", borderTop: "1px solid #1d3a2c" }}>
          <button
            type="button"
            onClick={onToggleJson}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              color: "#6e9e8a", fontSize: 11, padding: 0,
            }}
            aria-expanded={verJson}
          >
            <ChevronDown size={12} style={{ transform: verJson ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
            {verJson ? "Ocultar JSON" : "Ver JSON completo"}
          </button>
          {verJson && (
            <pre style={{
              margin: "8px 0 2px", maxHeight: 160, overflow: "auto",
              background: "#050d07", border: "1px solid #1d3a2c", borderRadius: 8,
              padding: 10, color: "#9fd3bf", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap",
            }}>
              {JSON.stringify(resultado, null, 2)}
            </pre>
          )}
        </div>
      </div>
    );
  }

  // Fallback: string simples ou array — mostra formatado minimamente
  return (
    <div style={{
      background: "#0a140f", border: "1px solid #1d3a2c", borderRadius: 10,
      padding: 12,
    }}>
      <pre style={{
        margin: 0, maxHeight: 180, overflow: "auto",
        color: "#9fd3bf", fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap",
      }}>
        {typeof resultado === "string" ? resultado : JSON.stringify(resultado, null, 2)}
      </pre>
    </div>
  );
}

/** Copiloto de Voz Global — FAB verde arrastável + painel de escuta/transcrição/resposta. */
export function CopilotoVoz() {
  const pathname = usePathname() || "/crm";
  const router = useRouter();
  const {
    estado,
    modo,
    setModo,
    enviarTexto,
    transcricaoLive,
    resultado,
    mensagem,
    resposta,
    navegarPara,
    consumirNavegacao,
    modeloUsado,
    acaoPendente,
    toggle,
    aoTocarFab,
    cancelar,
    confirmarAcao,
    cancelarAcao,
  } = useCopilotoVoz({ contexto: { rota: pathname, leadId: leadIdDaRota(pathname) } });

  // A IA "anda" pelo sistema: quando ela propõe uma rota (acao="navegar"), leva o dono
  // até a tela e fecha o painel. cancelar() reseta o estado (o push já foi disparado).
  useEffect(() => {
    if (!navegarPara) return;
    const destino = navegarPara;
    consumirNavegacao();
    cancelar();
    router.push(destino);
  }, [navegarPara, consumirNavegacao, cancelar, router]);

  const [verJson, setVerJson] = useState(false);
  const [verResultadoJson, setVerResultadoJson] = useState(false);

  // Modo texto: valor do campo + ref p/ foco automático ao entrar no modo.
  const [textoInput, setTextoInput] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Gesto de arrastar (touch + mouse) p/ alternar voz↔texto, no MESMO layout.
  const swipeRef = useRef<{ startX: number; startY: number; active: boolean } | null>(null);
  const [arrasto, setArrasto] = useState(0); // deslocamento visual durante o swipe (px)

  // Foco automático no campo ao entrar no modo texto com o painel aberto.
  useEffect(() => {
    if (modo === "texto" && estado !== "idle") {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [modo, estado]);

  // Ponto de entrada externo (Talk-and-Go): outros componentes podem abrir o
  // copiloto disparando `window.dispatchEvent(new Event("copiloto:abrir"))`.
  // Aditivo e seguro: só abre quando está fechado; não altera o resto do fluxo.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const abrir = () => {
      if (estado === "idle") aoTocarFab();
    };
    window.addEventListener("copiloto:abrir", abrir);
    return () => window.removeEventListener("copiloto:abrir", abrir);
  }, [estado, aoTocarFab]);

  const trocarModo = useCallback(
    (m: "voz" | "texto") => {
      setArrasto(0);
      setModo(m);
    },
    [setModo],
  );

  const submeterTexto = useCallback(() => {
    const v = textoInput.trim();
    if (!v) return;
    enviarTexto(v);
    setTextoInput("");
  }, [textoInput, enviarTexto]);

  // Swipe horizontal no conteúdo do painel: arrastar p/ a esquerda → texto; p/ a direita → voz.
  const onSwipeStart = useCallback((e: React.PointerEvent) => {
    // Não captura sobre o textarea/botões interativos (deixa selecionar/escrever).
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "TEXTAREA" || tag === "INPUT") return;
    swipeRef.current = { startX: e.clientX, startY: e.clientY, active: true };
  }, []);

  const onSwipeMove = useCallback((e: React.PointerEvent) => {
    const s = swipeRef.current;
    if (!s?.active) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    // Só trata como swipe horizontal se o movimento for predominante no eixo X.
    if (Math.abs(dx) < Math.abs(dy)) return;
    setArrasto(Math.max(-60, Math.min(60, dx)));
  }, []);

  const onSwipeEnd = useCallback(
    (e: React.PointerEvent) => {
      const s = swipeRef.current;
      swipeRef.current = null;
      if (!s?.active) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      setArrasto(0);
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return; // gesto curto/vertical = ignora
      if (dx < 0) trocarModo("texto"); // arrastou p/ a esquerda → escrever
      else trocarModo("voz"); // arrastou p/ a direita → falar
    },
    [trocarModo],
  );

  // Hint de descoberta do FAB
  const [mostrarHint, setMostrarHint] = useState(false);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Hint: mostra balão após 4s em idle se nunca foi visto antes
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (estado !== "idle") {
      setMostrarHint(false);
      if (hintTimerRef.current) { clearTimeout(hintTimerRef.current); hintTimerRef.current = null; }
      return;
    }
    const jaViu = localStorage.getItem(HINT_KEY);
    if (jaViu) return;
    hintTimerRef.current = setTimeout(() => setMostrarHint(true), 4000);
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [estado]);

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

  const dispensarHint = useCallback(() => {
    setMostrarHint(false);
    try { localStorage.setItem(HINT_KEY, "1"); } catch { /* ignore */ }
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
      dispensarHint();
      aoTocarFab();
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
  }, [aoTocarFab, dispensarHint]);

  if (!pos) return null;

  const ouvindo = estado === "listening";
  const processando = estado === "processing";
  const confirmando = estado === "confirming";
  const aberto = estado !== "idle";

  return (
    <>
      {/* Backdrop — tocar fora fecha o painel. No estado de confirmação, usa
          cancelarAcao (descarta a proposta pendente com aviso) e não cancelar,
          que faria um reset bruto perdendo o contexto da escrita pendente. */}
      {aberto && (
        <div
          onClick={confirmando ? cancelarAcao : cancelar}
          aria-hidden
          style={{ position: "fixed", inset: 0, zIndex: 89, background: "rgba(0,0,0,0.25)" }}
        />
      )}

      {/* Painel — animação de entrada via keyframe copilotoSlideIn */}
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
            animation: "copilotoSlideIn 220ms cubic-bezier(0.33,1,0.68,1) both",
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
            <button
              onClick={cancelar}
              aria-label="Fechar"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 36, height: 36, flexShrink: 0,
                background: "#16271e", border: "1px solid #1d3a2c", borderRadius: 10,
                cursor: "pointer", color: "#cdd9d2",
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Toggle Falar / Escrever — segmentado, na marca. Trocar de modo NÃO fecha o painel. */}
          <div
            role="tablist"
            aria-label="Modo de entrada do copiloto"
            style={{
              display: "flex", gap: 4, padding: 4,
              background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 12,
            }}
          >
            {([
              { id: "voz", rotulo: "Falar", Icone: Mic },
              { id: "texto", rotulo: "Escrever", Icone: Pencil },
            ] as const).map(({ id, rotulo, Icone }) => {
              const ativo = modo === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  aria-label={id === "voz" ? "Falar com o copiloto" : "Escrever para o copiloto"}
                  onClick={() => trocarModo(id)}
                  style={{
                    flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "10px 0", borderRadius: 9, cursor: "pointer",
                    border: ativo ? "1px solid #c9a24a" : "1px solid transparent",
                    background: ativo ? "linear-gradient(180deg, #1d5c3c, #003b26)" : "transparent",
                    color: ativo ? "#f0c869" : "#8aa99a",
                    fontWeight: 800, fontSize: 13.5,
                    transition: "background 180ms, color 180ms, border-color 180ms",
                  }}
                >
                  <Icone size={16} /> {rotulo}
                </button>
              );
            })}
          </div>

          {/* Zona 2 — conteúdo que alterna voz↔texto (arrastável). MESMO layout, transição suave. */}
          <div
            onPointerDown={onSwipeStart}
            onPointerMove={onSwipeMove}
            onPointerUp={onSwipeEnd}
            onPointerCancel={onSwipeEnd}
            style={{
              transform: arrasto ? `translateX(${arrasto}px)` : "none",
              opacity: arrasto ? 1 - Math.min(0.4, Math.abs(arrasto) / 150) : 1,
              transition: arrasto ? "none" : "transform 200ms cubic-bezier(0.33,1,0.68,1), opacity 200ms",
              touchAction: "pan-y",
            }}
          >
            {modo === "texto" ? (
              /* MODO TEXTO — campo no mesmo estilo verde/dourado. Enter envia, Shift+Enter quebra linha. */
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 8,
                background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 12,
                padding: 8,
              }}>
                <textarea
                  ref={inputRef}
                  value={textoInput}
                  onChange={(e) => setTextoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submeterTexto();
                    }
                  }}
                  rows={1}
                  aria-label="Escreva o que quer fazer"
                  placeholder="Escreva o que quer fazer… (ex.: 'resumo deste lead')"
                  disabled={processando}
                  style={{
                    flex: 1, resize: "none", minHeight: 44, maxHeight: 120,
                    background: "transparent", border: "none", outline: "none",
                    color: "#e6edf3", fontSize: 14, lineHeight: 1.5,
                    padding: "10px 8px", fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={submeterTexto}
                  disabled={!textoInput.trim() || processando}
                  aria-label="Enviar"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 44, height: 44, flexShrink: 0, borderRadius: 11,
                    border: "1px solid #c9a24a",
                    background: textoInput.trim() && !processando
                      ? "linear-gradient(180deg, #1d5c3c, #003b26)"
                      : "#16271e",
                    color: textoInput.trim() && !processando ? "#f0c869" : "#5c6b62",
                    cursor: textoInput.trim() && !processando ? "pointer" : "default",
                    transition: "background 180ms, color 180ms",
                  }}
                >
                  {processando ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            ) : (
              /* MODO VOZ — transcrição ao vivo (inalterado). */
              <div style={{
                minHeight: 64, maxHeight: 140, overflowY: "auto",
                background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 12,
                padding: 12, color: transcricaoLive ? "#e6edf3" : "#6e7681",
                fontSize: 14, lineHeight: 1.5,
              }}>
                {transcricaoLive || (ouvindo ? "Fale agora…" : "Toque no microfone e fale.")}
              </div>
            )}
          </div>

          {/* Zona 3 — resposta/resultado */}
          {/* Resposta ESCRITA da IA (linguagem natural) — a estrela: a IA "fala" o que achou. */}
          {resposta && estado === "done" && (
            <div style={{
              display: "flex", gap: 9, alignItems: "flex-start",
              background: "linear-gradient(180deg, #0f2419, #0b1a12)",
              border: "1px solid #1d5c3c", borderRadius: 14, padding: "13px 14px",
            }}>
              <Sparkles size={16} color="#3fb950" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
              <p style={{ margin: 0, color: "#e6edf3", fontSize: 14.5, lineHeight: 1.55, fontWeight: 500 }}>
                {resposta}
              </p>
            </div>
          )}
          {/* Pré-resposta ("Vou verificar…") ou erro — só quando NÃO há resposta escrita. */}
          {mensagem && !(resposta && estado === "done") && (
            <p style={{ margin: 0, color: estado === "erro" ? "#f85149" : "#cdd9d2", fontSize: 13, lineHeight: 1.55 }}>
              {mensagem}
            </p>
          )}
          {resultado != null && estado === "done" && (
            <ResultadoHumanizado
              resultado={resultado}
              verJson={verResultadoJson}
              onToggleJson={() => setVerResultadoJson((s) => !s)}
              escrita={!!mensagem && estado === "done" && !acaoPendente}
              mensagem={mensagem}
            />
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

              {/* Aviso de confiança baixa */}
              {typeof acaoPendente.confianca === "number" && acaoPendente.confianca < 0.7 && (
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: "#2a1a00", border: "1px solid #b87a1a", borderRadius: 10,
                  padding: "8px 11px",
                }}>
                  <AlertTriangle size={15} color="#f0a030" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: "#f0c869", fontSize: 12.5, lineHeight: 1.45 }}>
                    Não tenho certeza de que entendi — confira os dados antes de confirmar.
                  </span>
                </div>
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
              {modo === "texto" ? <Pencil size={15} /> : <Mic size={15} />}
              {modo === "texto" ? "Escrever de novo" : "Falar de novo"}
            </button>
          ) : null}
        </div>
      )}

      {/* Hint de descoberta — balão acima do FAB */}
      {mostrarHint && pos && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            zIndex: 95,
            left: Math.max(8, pos.x + FAB / 2 - 140),
            top: pos.y - 110,
            width: 280,
            background: "rgba(10,20,15,0.97)",
            border: "1px solid #2f9e8f",
            borderRadius: 14,
            padding: "12px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            animation: "copilotoFadeIn 200ms ease-out both",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <span style={{ color: "#2f9e8f", fontWeight: 700, fontSize: 11.5, letterSpacing: 0.3, textTransform: "uppercase" }}>
              Tente dizer / escrever...
            </span>
            <button
              type="button"
              aria-label="Fechar dica"
              onClick={dispensarHint}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6e9e8a", padding: 0, lineHeight: 1, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
          {HINT_EXEMPLOS.map((ex) => (
            <div
              key={ex}
              style={{
                padding: "5px 0",
                borderBottom: "1px solid #1d3a2c",
                color: "#cdd9d2",
                fontSize: 12.5,
                lineHeight: 1.4,
              }}
            >
              &ldquo;{ex}&rdquo;
            </div>
          ))}
          {/* seta apontando pro FAB */}
          <div style={{
            position: "absolute",
            bottom: -7,
            left: Math.min(260, Math.max(14, pos.x + FAB / 2 - Math.max(8, pos.x + FAB / 2 - 140) - 7)),
            width: 14, height: 14,
            background: "rgba(10,20,15,0.97)",
            border: "1px solid #2f9e8f",
            borderTop: "none", borderLeft: "none",
            transform: "rotate(45deg)",
          }} />
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
        @keyframes copilotoSlideIn { from{transform:translateX(-50%) translateY(100%);opacity:0} to{transform:translateX(-50%) translateY(0);opacity:1} }
        @keyframes copilotoFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </>
  );
}

export default CopilotoVoz;
