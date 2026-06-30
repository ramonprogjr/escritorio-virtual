"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, usePathname } from "next/navigation";
import { Suspense } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { supabase } from "@/lib/supabase/client";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";

// ─── Brand palette — dark verde+dourado (padrão do CRM) ──────────────────────
// F-A6: alinhado ao design-system travado em memória (dark #0a140f + tokens --obra-*).
// Não mais a ilha clara (#f7f4ec) divergente do restante do app.
const C = {
  bg:       "#0a140f",      // dark base — igual ao restante do CRM
  surface:  "#0f1d16",      // cards
  surface2: "#16271e",      // hover / nested
  green:    "#065535",      // verde escuro
  greenMid: "#003b26",      // verde médio (títulos)
  gold:     "#c9a24a",      // dourado — brand
  goldBg:   "rgba(201,162,74,0.09)",
  goldBorder:"rgba(201,162,74,0.35)",
  red:      "#b3261e",
  redSoft:  "rgba(179,38,30,0.09)",
  redBorder:"rgba(179,38,30,0.44)",
  text:     "#e6edf3",      // texto principal
  muted:    "#8b949e",      // texto secundário
  line:     "#1d3a2c",      // separadores
  white:    "#ffffff",
  // Gate do dinheiro — destaque extra
  moneyBg:  "rgba(201,162,74,0.14)",
  moneyBorder: "#c9a24a",
};

// ─── Tipos E6 do gate do dinheiro ─────────────────────────────────────────────
// F-A2: lista canônica dos tipos que movem dinheiro (escrow). Usada para:
//   • ícone/cor distintos (não o fallback genérico 📌)
//   • badge "Gate de pagamento"
//   • modal de confirmação obrigatório (F-A3)
const TIPOS_DINHEIRO = new Set([
  "orcamento_frente",
  "pagamento_obra_arq",
  "pagamento_obra_hub",
  "cotacao_fornecedor",
]);

// F-A2: rótulos humanos para os tipos E6
const TIPO_LABEL_DINHEIRO: Record<string, string> = {
  orcamento_frente:    "Orçamento da frente",
  pagamento_obra_arq:  "Pagamento — Chave 1 (Arquitetura)",
  pagamento_obra_hub:  "Pagamento — Chave 2 (Hub)",
  cotacao_fornecedor:  "Cotação de fornecedor",
};

// F-A2: ícone claro para gate do dinheiro (não o fallback 📌 genérico)
const TIPO_ICON: Record<string, string> = {
  proposta:            "📋",
  campanha:            "📊",
  conteudo:            "✏️",
  site:                "🌐",
  ajuste_agente:       "🤖",
  trafego:             "📈",
  contrato:            "📜",
  financeiro:          "💰",
  atendimento_critico: "🚨",
  atendimento:         "💬",
  // Gate do dinheiro — ícone inconfundível
  orcamento_frente:    "🔐",
  pagamento_obra_arq:  "🔑",
  pagamento_obra_hub:  "🔑",
  cotacao_fornecedor:  "🏷️",
};

const TIPO_BORDER: Record<string, string> = {
  proposta:            "#2f9e8f",
  campanha:            C.gold,
  conteudo:            "#b58a63",
  site:                "#34d399",
  ajuste_agente:       "#b58a63",
  trafego:             C.red,
  contrato:            C.greenMid,
  financeiro:          "#16a34a",
  atendimento_critico: C.red,
  atendimento:         C.gold,
  // Gate do dinheiro — borda dourada forte
  orcamento_frente:    C.gold,
  pagamento_obra_arq:  C.gold,
  pagamento_obra_hub:  C.gold,
  cotacao_fornecedor:  C.gold,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Aprovacao {
  id: string;
  tipo: string;
  agente_slug: string;
  agente_nome?: string;
  descricao: string;
  motivo: string;
  impacto?: string;
  recomendacao?: string;
  confianca_ia?: number;
  valor_envolvido?: number | null;
  status: string;
  criado_em: string;
}

function rel(d: string) {
  const m = (Date.now() - new Date(d).getTime()) / 60000;
  return m < 1 ? "agora" : m < 60 ? `${Math.round(m)}min` : `${Math.round(m / 60)}h`;
}

// F-A5: valor financeiro honesto — nunca esconde zero
function formatarValor(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return "Sem valor informado";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

// ─── Toast — F-A11y: aria-live para leitores de tela ─────────────────────────
function Toast({ msg, tipo }: { msg: string; tipo: "ok" | "erro" }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 9999,
        background: tipo === "ok" ? C.greenMid : C.red,
        color: "#fff", padding: "10px 18px", borderRadius: 10,
        fontSize: 13, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,40,26,0.4)",
        animation: "fadeInUp 0.25s ease",
      }}
    >
      {tipo === "ok" ? "✓ " : "✕ "}{msg}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function AprovacoesInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const tipoParam = searchParams.get("tipo") ?? "todos";

  const [aprovacoes, setAprovacoes] = useState<Aprovacao[]>([]);
  const [filtro, setFiltro]         = useState(tipoParam);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro]             = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; tipo: "ok" | "erro" } | null>(null);

  // F-A3: estado do modal de confirmação para o gate do dinheiro
  const [confirmPendente, setConfirmPendente] = useState<{
    id: string;
    tipo: string;
    descricao: string;
    valor: number | null | undefined;
    acao: "aprovar" | "rejeitar";
  } | null>(null);

  // F-A4: debounce do realtime (não refaz fetch a cada evento sem pausa)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string, tipo: "ok" | "erro" = "ok") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    setFiltro(tipoParam);
  }, [tipoParam]);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const res = await fetch("/api/hub/aprovacoes?status=pendente", {
        headers: internalApiHeaders(),
        cache: "no-store",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(typeof payload.error === "string" ? payload.error : `Erro ao carregar (${res.status})`);
        setAprovacoes([]);
        return;
      }
      const list = Array.isArray(payload.aprovacoes) ? payload.aprovacoes : [];
      setAprovacoes(list as Aprovacao[]);
    } catch {
      setErro("Falha de rede ao carregar aprovações");
      setAprovacoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    // F-A4: debounce ~400ms no realtime handler — evita refetch sem pausa em pico
    const sub = supabase.channel("aprovacoes_page")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { carregar(); }, 400);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [carregar]);

  // Ação efetiva (chamada após confirmação ou direto para não-dinheiro)
  async function executarAcao(id: string, acao: "aprovar" | "rejeitar") {
    setProcessando(id);
    try {
      const res = await fetch(`/api/hub/aprovacoes/${id}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: acao === "aprovar" ? "aprovado" : "rejeitado" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setAprovacoes(prev => prev.filter(a => a.id !== id));
        showToast(acao === "aprovar" ? "Aprovado com sucesso" : "Reprovado");
      } else {
        showToast(typeof payload.error === "string" ? payload.error : `Erro ao ${acao === "aprovar" ? "aprovar" : "rejeitar"}`, "erro");
      }
    } catch {
      showToast(`Falha de rede ao ${acao === "aprovar" ? "aprovar" : "rejeitar"}`, "erro");
    }
    setProcessando(null);
    setConfirmPendente(null);
  }

  // F-A3: gate dourado — tipos de dinheiro pedem confirmação modal antes de agir
  function solicitarAcao(ap: Aprovacao, acao: "aprovar" | "rejeitar") {
    if (TIPOS_DINHEIRO.has(ap.tipo)) {
      setConfirmPendente({
        id: ap.id,
        tipo: ap.tipo,
        descricao: ap.descricao,
        valor: ap.valor_envolvido,
        acao,
      });
    } else {
      executarAcao(ap.id, acao);
    }
  }

  const tipos = ["todos", ...Array.from(new Set(aprovacoes.map(a => a.tipo)))];
  const filtradas = filtro === "todos" ? aprovacoes : aprovacoes.filter(a => a.tipo === filtro);

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      subtitle: `${aprovacoes.length} pendente${aprovacoes.length !== 1 ? "s" : ""} — tudo que precisa da sua decisão`,
      actions:
        aprovacoes.length > 0 ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: C.redSoft,
            border: `1px solid ${C.redBorder}`,
            borderRadius: 20, padding: "4px 12px",
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: "50%",
              background: C.red, animation: "pulse 1.4s ease-in-out infinite",
            }} />
            <span style={{ color: C.red, fontSize: 11, fontWeight: 700 }}>{aprovacoes.length} aguardando</span>
          </div>
        ) : undefined,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, aprovacoes.length, isMobile]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column" }}>

      {isMobile && (
        <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, background: C.surface, flexShrink: 0 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: C.gold }}>Aprovações</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: C.muted }}>
            {aprovacoes.length} pendente{aprovacoes.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── Filters ─── */}
      <div style={{
        display: "flex", gap: 8, padding: `12px ${isMobile ? 16 : 24}px`,
        background: C.surface, borderBottom: `1px solid ${C.line}`,
        overflowX: "auto", flexShrink: 0,
      }}>
        {tipos.map(t => {
          const active = filtro === t;
          const count = t === "todos" ? aprovacoes.length : aprovacoes.filter(a => a.tipo === t).length;
          const isDinheiro = TIPOS_DINHEIRO.has(t);
          return (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              aria-pressed={active}
              style={{
                minHeight: 44, padding: "8px 14px", borderRadius: 20, whiteSpace: "nowrap", cursor: "pointer",
                background: active ? (isDinheiro ? C.goldBg : C.green) : "transparent",
                border: `1px solid ${active ? (isDinheiro ? C.goldBorder : C.greenMid) : C.line}`,
                color: active ? (isDinheiro ? C.gold : "#fff") : C.muted,
                fontSize: 12, fontWeight: active ? 700 : 500,
                transition: "all 150ms", flexShrink: 0,
              }}
            >
              {t === "todos"
                ? `Todos (${count})`
                : `${TIPO_ICON[t] ?? "•"} ${TIPO_LABEL_DINHEIRO[t] ?? t} (${count})`}
            </button>
          );
        })}
      </div>

      {/* ── Content ─── */}
      <div style={{ flex: 1, padding: isMobile ? "16px" : "24px" }}>
        {erro && !carregando && (
          <div role="alert" style={{
            marginBottom: 16, padding: "12px 16px", borderRadius: 10,
            background: C.redSoft, border: `1px solid ${C.redBorder}`,
            color: C.red, fontSize: 13, display: "flex",
            alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span>{erro}</span>
            <button
              type="button"
              onClick={() => { setCarregando(true); carregar(); }}
              style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${C.redBorder}`,
                background: C.surface, color: C.red,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {carregando ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p style={{ color: C.muted, fontSize: 14 }}>Carregando aprovações...</p>
          </div>
        ) : erro ? null : filtradas.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <div aria-hidden="true" style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <p style={{ color: C.gold, fontWeight: 700, fontSize: 16, margin: 0 }}>Nenhuma aprovação pendente</p>
            <p style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>O sistema está operando normalmente</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}>
            {filtradas.map(ap => {
              const isDinheiro = TIPOS_DINHEIRO.has(ap.tipo);
              const borderCol = TIPO_BORDER[ap.tipo] ?? C.gold;
              const isProcessing = processando === ap.id;
              const valorFormatado = formatarValor(ap.valor_envolvido);
              const mostrarValor = isDinheiro || ap.valor_envolvido != null;

              return (
                <div
                  key={ap.id}
                  style={{
                    background: isDinheiro ? C.moneyBg : C.surface,
                    borderRadius: 14,
                    borderTop: `3px solid ${borderCol}`,
                    boxShadow: isDinheiro
                      ? `0 2px 16px rgba(201,162,74,0.12)`
                      : "0 2px 12px rgba(0,0,0,0.25)",
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {/* F-A2: badge "Gate de pagamento" visível para tipos E6 */}
                  {isDinheiro && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: C.goldBg,
                      border: `1px solid ${C.goldBorder}`,
                      borderRadius: 6, padding: "4px 10px",
                      alignSelf: "flex-start",
                    }}>
                      <span aria-hidden="true" style={{ fontSize: 11 }}>🔐</span>
                      <span style={{ color: C.gold, fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                        Gate de pagamento
                      </span>
                    </div>
                  )}

                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <span aria-hidden="true" style={{ fontSize: 22, flexShrink: 0 }}>
                      {TIPO_ICON[ap.tipo] ?? "📌"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: isDinheiro ? C.gold : C.text, fontWeight: 700, fontSize: 13, margin: 0, lineHeight: 1.3, wordBreak: "break-word" }}>
                        {ap.descricao}
                      </p>
                      <p style={{ color: C.muted, fontSize: 11, margin: "4px 0 0", wordBreak: "break-word" }}>
                        {TIPO_LABEL_DINHEIRO[ap.tipo] ?? ap.tipo} · {ap.agente_nome || ap.agente_slug} · {rel(ap.criado_em)}
                      </p>
                    </div>
                  </div>

                  {/* Motivo */}
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
                      O que observou:
                    </p>
                    <p style={{ color: C.text, fontSize: 12, margin: 0, lineHeight: 1.6 }}>{ap.motivo}</p>
                  </div>

                  {/* Impacto */}
                  {ap.impacto && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
                        Impacto:
                      </p>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                        background: ap.impacto === "alto" || ap.impacto === "critico" ? C.redSoft : C.goldBg,
                        color: ap.impacto === "alto" || ap.impacto === "critico" ? C.red : C.gold,
                      }}>
                        {ap.impacto.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Recomendação */}
                  {ap.recomendacao && (
                    <div style={{ background: C.goldBg, borderRadius: 8, padding: "10px 12px", borderLeft: `2px solid ${C.gold}` }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 4px" }}>
                        Recomendação da IA:
                      </p>
                      <p style={{ color: C.text, fontSize: 12, margin: 0, lineHeight: 1.5 }}>{ap.recomendacao}</p>
                    </div>
                  )}

                  {/* F-A5: valor financeiro honesto — nunca esconde zero ou ausente */}
                  {mostrarValor && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontSize: ap.valor_envolvido != null ? 14 : 12,
                        fontWeight: ap.valor_envolvido != null ? 800 : 500,
                        color: ap.valor_envolvido != null ? C.gold : C.muted,
                      }}>
                        {valorFormatado}
                      </span>
                      {ap.confianca_ia != null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div
                            role="progressbar"
                            aria-label={`IA ${ap.confianca_ia}% de confiança`}
                            aria-valuenow={ap.confianca_ia}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            style={{ width: 60, height: 5, background: C.line, borderRadius: 3, overflow: "hidden" }}
                          >
                            <div style={{ height: "100%", width: `${ap.confianca_ia}%`, background: C.gold, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.gold }}>IA {ap.confianca_ia}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action buttons — F-A11y: aria-label explícito em cada botão */}
                  <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                    <button
                      type="button"
                      aria-label={`Aprovar: ${ap.descricao}`}
                      onClick={() => solicitarAcao(ap, "aprovar")}
                      disabled={isProcessing}
                      style={{
                        flex: 1, minHeight: 44, padding: "12px 0", borderRadius: 8,
                        background: isProcessing ? C.line : (isDinheiro ? C.goldBg : C.greenMid),
                        border: isDinheiro ? `1px solid ${C.goldBorder}` : "none",
                        color: isProcessing ? C.muted : (isDinheiro ? C.gold : "#fff"),
                        fontSize: 12, fontWeight: 700,
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        transition: "opacity 150ms",
                      }}
                      onMouseOver={e => !isProcessing && (e.currentTarget.style.opacity = "0.85")}
                      onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                    >
                      {isProcessing ? "..." : isDinheiro ? "🔑 Autorizar" : "✓ Aprovar"}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rejeitar: ${ap.descricao}`}
                      onClick={() => solicitarAcao(ap, "rejeitar")}
                      disabled={isProcessing}
                      style={{
                        flex: 1, minHeight: 44, padding: "12px 0", borderRadius: 8,
                        background: "transparent",
                        border: `1px solid ${isProcessing ? C.line : C.redBorder}`,
                        color: isProcessing ? C.muted : C.red,
                        fontSize: 12, fontWeight: 600,
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        transition: "border-color 150ms",
                      }}
                      onMouseOver={e => !isProcessing && (e.currentTarget.style.borderColor = C.red)}
                      onMouseOut={e => !isProcessing && (e.currentTarget.style.borderColor = C.redBorder)}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* F-A3: modal de confirmação para gate do dinheiro (E6) */}
      {confirmPendente && (
        <CrmConfirmDialog
          open={!!confirmPendente}
          title={
            confirmPendente.acao === "aprovar"
              ? "Confirmar liberação de pagamento"
              : "Confirmar rejeição de pagamento"
          }
          confirmLabel={
            confirmPendente.acao === "aprovar"
              ? "Sim, autorizar"
              : "Sim, rejeitar"
          }
          cancelLabel="Voltar"
          danger={confirmPendente.acao === "rejeitar"}
          loading={processando === confirmPendente.id}
          onCancel={() => setConfirmPendente(null)}
          onConfirm={() => executarAcao(confirmPendente.id, confirmPendente.acao)}
        >
          <p style={{ margin: "0 0 8px" }}>
            <strong style={{ color: "#e6edf3" }}>{TIPO_LABEL_DINHEIRO[confirmPendente.tipo] ?? confirmPendente.tipo}</strong>
          </p>
          <p style={{ margin: "0 0 8px" }}>{confirmPendente.descricao}</p>
          {confirmPendente.valor != null && (
            <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#c9a24a" }}>
              {formatarValor(confirmPendente.valor)}
            </p>
          )}
          {confirmPendente.acao === "aprovar" && (
            <p style={{ margin: "12px 0 0", fontSize: 11, color: "#8b949e" }}>
              Esta ação move dinheiro. Confirme apenas se tiver certeza.
            </p>
          )}
        </CrmConfirmDialog>
      )}

      {toast && <Toast msg={toast.msg} tipo={toast.tipo} />}
    </div>
  );
}

export default function AprovacoesPage() {
  return (
    <Suspense fallback={
      <div style={{
        background: "#0a140f", minHeight: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#8b949e",
      }}>
        Carregando...
      </div>
    }>
      <AprovacoesInner />
    </Suspense>
  );
}
