"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Send, User, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  formatarFontesConhecimentoLinha,
  type PromptFonteConhecimento,
} from "@/lib/ia/prompt-builder";
import {
  BRIEFING_FLOW_SIM_STATE_KEY,
  emptyBriefingFlowSimState,
  parseBriefingFlowSimState,
  type BriefingFlowSimState,
} from "@/lib/playbook/briefing-flow-sim-shared";
import {
  BriefingWhatsappBubble,
  BriefingWhatsappUserBubble,
  parseSimPartFromMetadata,
} from "@/components/crm/BriefingWhatsappBubble";

function fontesConhecimentoFromMetadata(
  metadata: Record<string, unknown> | undefined
): PromptFonteConhecimento[] {
  const raw = metadata?.fontes_conhecimento;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (f): f is PromptFonteConhecimento =>
        !!f &&
        typeof f === "object" &&
        typeof (f as PromptFonteConhecimento).label === "string"
    )
    .map((f) => ({
      id: String((f as PromptFonteConhecimento).id || ""),
      label: String((f as PromptFonteConhecimento).label),
      detalhe: (f as PromptFonteConhecimento).detalhe
        ? String((f as PromptFonteConhecimento).detalhe)
        : undefined,
    }));
}

type Msg = {
  id: string;
  papel: string;
  conteudo: string;
  criado_em: string;
  metadata?: Record<string, unknown>;
};

const OPTIMISTIC_USER_PREFIX = "optimistic-user-";

function isOptimisticUserMessage(m: Msg): boolean {
  return m.papel === "user" && m.id.startsWith(OPTIMISTIC_USER_PREFIX);
}

export type ModoBriefingChat = "briefing_interno" | "simulacao_canal" | "simulacao_whatsapp";

export type AgenteBriefingDrawerProps = {
  open: boolean;
  onClose: () => void;
  agenteSlug: string;
  agenteNome: string;
};

export function AgenteBriefingDrawer({ open, onClose, agenteSlug, agenteNome }: AgenteBriefingDrawerProps) {
  const [modoChat, setModoChat] = useState<ModoBriefingChat>("briefing_interno");
  const [sessaoId, setSessaoId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Msg[]>([]);
  const [flowState, setFlowState] = useState<BriefingFlowSimState>(emptyBriefingFlowSimState());
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const fimRef = useRef<HTMLDivElement>(null);

  const isWhatsappSim = modoChat === "simulacao_whatsapp";

  const base = `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/briefing-chat`;

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  /** Conversa única por abertura do painel — foco em testar playbook / prompt sem lista de sessões. */
  useEffect(() => {
    if (!open || !agenteSlug) return;
    setSessaoId(null);
    setMensagens([]);
    setFlowState(emptyBriefingFlowSimState());
    setErro("");
    setInput("");
  }, [open, agenteSlug, modoChat]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, enviando, open]);

  async function enviar(extra?: { menuChoiceId?: string; texto?: string }) {
    const t = (extra?.texto ?? input).trim();
    if (!t || enviando) return;
    const tempId = `${OPTIMISTIC_USER_PREFIX}${Date.now()}`;
    const now = new Date().toISOString();
    setMensagens((prev) => [...prev, { id: tempId, papel: "user", conteudo: t, criado_em: now }]);
    setEnviando(true);
    setErro("");
    if (!extra?.texto) setInput("");
    try {
      const body: Record<string, unknown> = {
        sessao_id: sessaoId,
        mensagem: t,
        modo: modoChat,
      };
      if (isWhatsappSim) {
        body.flow_state = flowState;
        if (extra?.menuChoiceId) body.menu_choice_id = extra.menuChoiceId;
      }
      const res = await fetch(base, {
        method: "POST",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        sessao_id?: string;
        mensagens?: Msg[];
        flow_state?: BriefingFlowSimState;
      };
      if (!res.ok) {
        setMensagens((prev) => prev.filter((m) => m.id !== tempId));
        setErro(typeof data?.error === "string" ? data.error : `Erro ${res.status}`);
        if (!extra?.texto) setInput(t);
        if (res.status === 409) setSessaoId(null);
        return;
      }
      if (data.sessao_id) setSessaoId(data.sessao_id);
      if (data.flow_state) setFlowState(data.flow_state);
      else if (Array.isArray(data.mensagens)) {
        const lastAssistant = [...data.mensagens].reverse().find((m) => m.papel === "assistant");
        const st = parseBriefingFlowSimState(lastAssistant?.metadata?.[BRIEFING_FLOW_SIM_STATE_KEY]);
        if (st) setFlowState(st);
      }
      if (Array.isArray(data.mensagens)) setMensagens(data.mensagens);
    } catch {
      setMensagens((prev) => prev.filter((m) => m.id !== tempId));
      setErro("Falha de rede ao enviar.");
      if (!extra?.texto) setInput(t);
    } finally {
      setEnviando(false);
    }
  }

  function iniciarWhatsappSim() {
    void enviar({ texto: "Olá" });
  }

  if (!agenteSlug) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s ease",
        }}
      />
      <aside
        aria-hidden={!open}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          zIndex: 201,
          height: "100vh",
          width: "min(100vw, 820px)",
          maxWidth: "100%",
          background: "#0d1117",
          borderLeft: "1px solid #30363d",
          boxShadow: open ? "-12px 0 40px rgba(0,0,0,0.45)" : "none",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            padding: "14px 16px",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            background: "linear-gradient(180deg, #161b22 0%, #0d1117 100%)",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ color: "#e6edf3", fontSize: 15, fontWeight: 700, margin: 0 }}>Copiloto IA</h2>
            <p
              style={{
                color: "#8b949e",
                fontSize: 12,
                fontWeight: 600,
                margin: "4px 0 0",
                lineHeight: 1.35,
              }}
            >
              {agenteNome}
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
              role="group"
              aria-label="Modo de teste do funcionário IA"
            >
              <button
                type="button"
                onClick={() => setModoChat("briefing_interno")}
                disabled={enviando}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${modoChat === "briefing_interno" ? "#c9a24a88" : "#30363d"}`,
                  background: modoChat === "briefing_interno" ? "#c9a24a22" : "#21262d",
                  color: modoChat === "briefing_interno" ? "#d6b976" : "#8b949e",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                Revisão operacional
              </button>
              <button
                type="button"
                onClick={() => setModoChat("simulacao_whatsapp")}
                disabled={enviando}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${modoChat === "simulacao_whatsapp" ? "#00a88488" : "#30363d"}`,
                  background: modoChat === "simulacao_whatsapp" ? "#00a88418" : "#21262d",
                  color: modoChat === "simulacao_whatsapp" ? "#5eead4" : "#8b949e",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <MessageCircle size={14} />
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setModoChat("simulacao_canal")}
                disabled={enviando}
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: `1px solid ${modoChat === "simulacao_canal" ? "#c9a24a88" : "#30363d"}`,
                  background: modoChat === "simulacao_canal" ? "#c9a24a22" : "#21262d",
                  color: modoChat === "simulacao_canal" ? "#d6b976" : "#8b949e",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: enviando ? "not-allowed" : "pointer",
                }}
              >
                Só IA (texto)
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#6e7681", margin: "8px 0 0", lineHeight: 1.45 }}>
              {modoChat === "briefing_interno"
                ? "Visão de operação: extractos reais (ciclos, logs, acções). Sem invocar ferramentas Hub — isso só na conversa ao vivo com lead em sessão."
                : modoChat === "simulacao_whatsapp"
                  ? "Simula o WhatsApp com fluxo do playbook (menus, botões, listas) e depois IA pós-qualificação — igual ao canal ao vivo, sem gravar lead."
                  : "Só prompt de produção em texto livre; sem motor de fluxo. Útil para testar tom após qualificação."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{
              flexShrink: 0,
              width: 40,
              height: 40,
              borderRadius: 10,
              border: "1px solid #30363d",
              background: "#21262d",
              color: "#c9d1d9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
            background: isWhatsappSim
              ? "linear-gradient(180deg, #0b141a 0%, #111b21 100%)"
              : "#0d1117",
          }}
        >
          {isWhatsappSim && (
            <div
              style={{
                flexShrink: 0,
                padding: "10px 14px",
                background: "#202c33",
                borderBottom: "1px solid #2a3942",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "linear-gradient(145deg, #003b26, #14532d)",
                  border: "1px solid #22c55e55",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: "#e9edef", fontSize: 14, fontWeight: 600 }}>{agenteNome}</div>
                <div style={{ color: "#8696a0", fontSize: 11 }}>HUB Obra 10+ · simulação</div>
              </div>
            </div>
          )}
          <div style={{ flex: 1, overflowY: "auto", padding: isWhatsappSim ? "14px 12px 20px" : "16px 18px 20px" }}>
            {erro && (
              <div
                style={{
                  background: "#3d1414",
                  border: "1px solid #f8514966",
                  borderRadius: 10,
                  padding: 12,
                  color: "#f85149",
                  fontSize: 12,
                  marginBottom: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {erro}
              </div>
            )}
            {mensagens.length === 0 && !erro && !enviando && (
              <p style={{ color: isWhatsappSim ? "#8696a0" : "#8b949e", fontSize: 13, lineHeight: 1.55, maxWidth: 640 }}>
                {modoChat === "briefing_interno" ? (
                  <>
                    Envie uma mensagem: o <strong style={{ color: "#aebccf" }}>funcionário IA</strong> interpreta{" "}
                    <strong style={{ color: "#aebccf" }}>ciclos, logs e ações</strong> já registados no hub. Estas respostas
                    <strong style={{ color: "#aebccf" }}> não usam</strong> as ferramentas Mistral (resumo de lead, notas,
                    etc.) — essas só na <strong style={{ color: "#aebccf" }}>engine com lead</strong> no canal.
                  </>
                ) : isWhatsappSim ? (
                  <>
                    Teste o playbook como no WhatsApp: menus numerados, listas e botões.{" "}
                    <button
                      type="button"
                      onClick={iniciarWhatsappSim}
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid #00a88455",
                        background: "#005c4b33",
                        color: "#5eead4",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <MessageCircle size={14} />
                      Iniciar com &quot;Olá&quot;
                    </button>
                  </>
                ) : (
                  <>
                    Simule conversa com cliente usando identity + conhecimento + regras. É <strong style={{ color: "#aebccf" }}>só texto</strong> — sem fluxo nem ferramentas.
                  </>
                )}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: isWhatsappSim ? 10 : 16 }}>
              {(() => {
                const lastInteractiveMenuId = (() => {
                  if (!isWhatsappSim || (flowState.complete && flowState.handoff_ia)) return null;
                  const lastAssistant = [...mensagens].reverse().find((m) => m.papel === "assistant");
                  if (!lastAssistant) return null;
                  const part = parseSimPartFromMetadata(lastAssistant.metadata);
                  return part?.kind === "menu" ? lastAssistant.id : null;
                })();

                return mensagens.map((m) => {
                const isUser = m.papel === "user";
                const simPart = !isUser ? parseSimPartFromMetadata(m.metadata) : null;

                if (isWhatsappSim) {
                  if (isUser) {
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: "flex-end" }}>
                        <BriefingWhatsappUserBubble text={m.conteudo} />
                      </div>
                    );
                  }
                  if (simPart) {
                    const menuAtivo = m.id === lastInteractiveMenuId;
                    return (
                      <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <BriefingWhatsappBubble
                          part={simPart}
                          disabled={enviando || !menuAtivo}
                          onSelectOption={
                            simPart.kind === "menu" && menuAtivo
                              ? (choice, index) => {
                                  void enviar({
                                    texto: String(index + 1),
                                    menuChoiceId: choice.id,
                                  });
                                }
                              : undefined
                          }
                        />
                        {m.metadata && typeof m.metadata === "object" && m.metadata.modelo ? (
                          <div style={{ paddingLeft: 4, fontSize: 10, color: "#8696a0" }}>
                            {String(m.metadata.modelo)}
                            {m.metadata.fase === "ia_pos_fluxo" ? " · pós-fluxo IA" : " · fluxo playbook"}
                          </div>
                        ) : null}
                      </div>
                    );
                  }
                  return (
                    <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <BriefingWhatsappBubble part={{ kind: "text", text: m.conteudo }} />
                      {m.metadata && typeof m.metadata === "object" && m.metadata.modelo ? (
                        <div style={{ paddingLeft: 4, fontSize: 10, color: "#8696a0" }}>
                          {String(m.metadata.modelo)} · {String(m.metadata.tokens_input ?? "—")}/
                          {String(m.metadata.tokens_output ?? "—")} tok
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: 10,
                      alignItems: "flex-start",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                    }}
                  >
                    {!isUser && (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "linear-gradient(145deg, #003b26, #14532d)",
                          border: "1px solid #22c55e55",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Bot size={20} color="#86efac" strokeWidth={2} aria-hidden />
                      </div>
                    )}
                    <div
                      style={{
                        maxWidth: "min(94%, 680px)",
                        order: isUser ? 1 : 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 6,
                          flexDirection: isUser ? "row-reverse" : "row",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: isUser ? "#79c0ff" : "#86efac",
                          }}
                        >
                          {isUser ? (
                            "Você"
                          ) : (
                            <>
                              Funcionário IA{" "}
                              <span style={{ fontWeight: 600, color: "#7f90a8" }}>· {agenteNome}</span>
                            </>
                          )}
                        </span>
                        <span style={{ fontSize: 10, color: "#6e7681" }}>
                          {new Date(m.criado_em).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>
                      <div
                        style={{
                          background: isUser ? "#1c2a3a" : "#161b22",
                          border: `1px solid ${isUser ? "#388bfd44" : "#30363d"}`,
                          borderRadius: isUser ? "16px 16px 6px 16px" : "16px 16px 16px 6px",
                          padding: "12px 14px",
                          fontSize: 13,
                          color: "#e6edf3",
                          lineHeight: 1.55,
                          whiteSpace: "pre-wrap",
                          ...(isOptimisticUserMessage(m) ? { animation: "bubbleIn 0.28s ease-out" } : {}),
                        }}
                      >
                        {m.conteudo}
                      </div>
                      {!isUser && m.metadata && typeof m.metadata === "object" && m.metadata.modelo ? (
                        <div style={{ marginTop: 6, paddingLeft: 2 }}>
                          <div style={{ fontSize: 10, color: "#484f58" }}>
                            {String(m.metadata.modelo)} · {String(m.metadata.tokens_input ?? "—")}/
                            {String(m.metadata.tokens_output ?? "—")} tok · ~ R${" "}
                            {Number(m.metadata.custo_brl ?? 0).toFixed(4)}
                          </div>
                          {(() => {
                            const fontes = fontesConhecimentoFromMetadata(m.metadata);
                            const linha = formatarFontesConhecimentoLinha(fontes);
                            if (!linha) return null;
                            return (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: "#6e7681",
                                  marginTop: 4,
                                  lineHeight: 1.45,
                                }}
                                title={linha}
                              >
                                <span style={{ color: "#484f58" }}>Fontes: </span>
                                {linha}
                              </div>
                            );
                          })()}
                        </div>
                      ) : null}
                    </div>
                    {isUser && (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "#1c2a3a",
                          border: "1px solid #388bfd55",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <User size={18} color="#79c0ff" strokeWidth={2} aria-hidden />
                      </div>
                    )}
                  </div>
                );
              });
              })()}
              {enviando && isWhatsappSim && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: "#005c4b",
                      borderRadius: "8px 8px 8px 2px",
                      padding: "12px 16px",
                      display: "flex",
                      gap: 6,
                    }}
                  >
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#ffffff99",
                          animation: `dotBlink ${0.55 + i * 0.12}s ease-in-out infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {enviando && !isWhatsappSim && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: 10,
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "linear-gradient(145deg, #003b26, #14532d)",
                      border: "1px solid #22c55e55",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={20} color="#86efac" strokeWidth={2} aria-hidden />
                  </div>
                  <div style={{ maxWidth: "min(94%, 680px)" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#86efac" }}>
                        Funcionário IA <span style={{ fontWeight: 600, color: "#7f90a8" }}>· {agenteNome}</span>
                      </span>
                      <span style={{ fontSize: 10, color: "#6e7681" }}>a gerar resposta…</span>
                    </div>
                    <div
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                      style={{
                        background: "#161b22",
                        border: "1px solid #30363d",
                        borderRadius: "16px 16px 16px 6px",
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        animation: "bubbleIn 0.25s ease-out",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: "50%",
                              background: "#7f90a8",
                              animation: `dotBlink ${0.55 + i * 0.12}s ease-in-out infinite`,
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ fontSize: 12, color: "#8b949e" }}>Funcionário IA a responder…</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div ref={fimRef} />
          </div>

          <div
            style={{
              flexShrink: 0,
              padding: "12px 16px 16px",
              borderTop: "1px solid #30363d",
              background: "#161b22",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: 10,
                background: "#0d1117",
                border: "1px solid #30363d",
                borderRadius: 14,
                padding: "8px 10px 8px 14px",
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isWhatsappSim
                    ? "Mensagem como no WhatsApp…"
                    : "Mensagem para o funcionário IA (revisão ou simulação interna)…"
                }
                rows={2}
                disabled={enviando}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                style={{
                  flex: 1,
                  minHeight: 44,
                  maxHeight: 120,
                  resize: "none",
                  border: "none",
                  background: "transparent",
                  color: "#e6edf3",
                  fontSize: 13,
                  lineHeight: 1.45,
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={enviando || !input.trim()}
                onClick={() => void enviar()}
                aria-label="Enviar"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  border: "none",
                  background:
                    enviando || !input.trim()
                      ? "#30363d"
                      : isWhatsappSim
                        ? "#00a884"
                        : "linear-gradient(145deg, #003b26, #14532d)",
                  color: isWhatsappSim ? "#fff" : "#c9a24a",
                  cursor: enviando || !input.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Send size={20} />
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#484f58", margin: "8px 0 0", textAlign: "center" }}>
              Enter envia · Shift+Enter nova linha · ao fechar e reabrir, conversa nova com este funcionário IA
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
