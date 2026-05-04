"use client";
import { useState } from "react";

// ─── Brand palette ────────────────────────────────────────────────────────────
const C = {
  bg:        "#f7f4ec",
  green:     "#003b26",
  greenSoft: "#12382b",
  gold:      "#c9a24a",
  goldSoft:  "rgba(201,162,74,0.14)",
  goldBg:    "rgba(201,162,74,0.08)",
  red:       "#b3261e",
  redSoft:   "rgba(179,38,30,0.10)",
  text:      "#1a1a1a",
  muted:     "#7a786c",
  line:      "#e0ddd6",
  white:     "#ffffff",
  greenMoney:"#16a34a",
};

// ─── Data ────────────────────────────────────────────────────────────────────

type Tab = "decisoes" | "crm" | "aprovacoes" | "gargalos" | "alertas";

interface DecisaoItem {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "urgente" | "normal" | "info";
  agente?: string;
  valor?: number;
  tempo: string;
}

const DECISOES: DecisaoItem[] = [
  { id: "d1", titulo: "Aprovar proposta #312", descricao: "Reforma alto padrão R$280k — cliente aguarda 2h", tipo: "urgente", agente: "Ariane", valor: 280000, tempo: "2h" },
  { id: "d2", titulo: "Pausar conjunto Meta B", descricao: "CPL 65% acima da meta — ROAS caindo", tipo: "urgente", agente: "IA Tráfego", tempo: "1h 10min" },
  { id: "d3", titulo: "Validar copy Instagram", descricao: "Copy Alpha gerou peça para campanha verão", tipo: "normal", agente: "Copy Alpha", tempo: "30min" },
  { id: "d4", titulo: "Aprovar budget extra", descricao: "SDR solicita R$2.000 para Google Ads esta semana", tipo: "normal", agente: "SDR IA", valor: 2000, tempo: "45min" },
];

const CRM_ITEMS = [
  { id: "l1", nome: "Carlos Mendes", fase: "Qualificação", valor: 120000, tempo: "8min", status: "quente" as const, origem: "WhatsApp" },
  { id: "l2", nome: "Ana Ferreira", fase: "Proposta", valor: 280000, tempo: "2h", status: "normal" as const, origem: "Indicação" },
  { id: "l3", nome: "Roberto Silva", fase: "Entrada", valor: 45000, tempo: "22min", status: "frio" as const, origem: "Meta Ads" },
  { id: "l4", nome: "Marina Costa", fase: "Negociação", valor: 650000, tempo: "5min", status: "quente" as const, origem: "Google" },
];

const APROVACOES = [
  { id: "a1", item: "Copy campanha verão", solicitante: "Copy Alpha", tipo: "Conteúdo", tempo: "10min" },
  { id: "a2", item: "Landing page reforma", solicitante: "Dev IA", tipo: "Site", tempo: "1h" },
  { id: "a3", item: "Script follow-up D+3", solicitante: "SDR IA", tipo: "Atendimento", tempo: "25min" },
];

const GARGALOS = [
  { id: "g1", titulo: "Aprovação manual bloqueando", descricao: "3 peças aguardando há mais de 1h", area: "Conteúdo", impacto: "alto" as const },
  { id: "g2", titulo: "Budget esgotando", descricao: "Campanha Google com 90% do budget consumido", area: "Tráfego", impacto: "medio" as const },
];

const ALERTAS = [
  { id: "al1", msg: "Lead #247 sem resposta há 22min — SLA estourado", tipo: "critico" as const },
  { id: "al2", msg: "ROAS Meta Ads caiu para 2.8x (meta: 3.5x)", tipo: "atencao" as const },
  { id: "al3", msg: "Ariane processou 340 msgs hoje — recorde", tipo: "info" as const },
  { id: "al4", msg: "Novo lead alto valor: Construtora ABC R$1.2M", tipo: "info" as const },
];

const ORIGEM_COR: Record<string, string> = {
  "WhatsApp": "#22c55e",
  "Indicação": C.gold,
  "Meta Ads":  "#818cf8",
  "Google":    "#f59e0b",
};

// ─── Component ────────────────────────────────────────────────────────────────

export function DecisionPanel() {
  const [tab, setTab]         = useState<Tab>("decisoes");
  const [ignorados, setIgnorados] = useState<Set<string>>(new Set());

  const TABS: { id: Tab; label: string; count: number; hasUrgent?: boolean }[] = [
    { id: "decisoes",  label: "Decisões",  count: DECISOES.length,   hasUrgent: DECISOES.some(d => d.tipo === "urgente") },
    { id: "crm",       label: "CRM",       count: CRM_ITEMS.length },
    { id: "aprovacoes",label: "Aprovações",count: APROVACOES.length },
    { id: "gargalos",  label: "Gargalos",  count: GARGALOS.length,   hasUrgent: GARGALOS.some(g => g.impacto === "alto") },
    { id: "alertas",   label: "Alertas",   count: ALERTAS.length,    hasUrgent: ALERTAS.some(a => a.tipo === "critico") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>

      {/* ── Tab bar (verde escuro, sem scrollbar) ─── */}
      <div style={{ display: "flex", background: C.green, flexShrink: 0, overflow: "hidden" }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const badgeBg = active ? C.gold : t.hasUrgent ? C.red : "rgba(255,255,255,0.14)";
          const badgeColor = active ? C.green : "#fff";
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, padding: "8px 2px 6px",
                background: "transparent", border: "none",
                borderBottom: `2px solid ${active ? C.gold : "transparent"}`,
                cursor: "pointer", transition: "border-color 150ms", minWidth: 0,
              }}
            >
              <span style={{
                fontSize: 8.5, fontWeight: active ? 700 : 500,
                color: active ? C.gold : "rgba(255,255,255,0.55)",
                lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden",
                textOverflow: "ellipsis", maxWidth: "100%", padding: "0 3px",
                letterSpacing: "0.01em",
              }}>
                {t.label}
              </span>
              {t.count > 0 && (
                <span style={{
                  fontSize: 8, fontWeight: 700, minWidth: 14, textAlign: "center",
                  padding: "1px 4px", borderRadius: 10,
                  background: badgeBg, color: badgeColor, lineHeight: 1.5,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ─── */}
      <div className="scrollbar-soft" style={{ flex: 1, overflowY: "auto" }}>

        {/* DECISÕES */}
        {tab === "decisoes" && (
          <div>
            {DECISOES.filter(d => !ignorados.has(d.id)).map(d => {
              const borderCol = d.tipo === "urgente" ? C.red : d.tipo === "normal" ? C.gold : C.greenMoney;
              return (
                <div key={d.id} style={{
                  margin: "10px 10px 0",
                  background: C.white,
                  borderRadius: 10,
                  borderLeft: `3px solid ${borderCol}`,
                  boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
                  overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div style={{ padding: "10px 12px 6px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
                      {d.tipo === "urgente" && (
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                          background: C.redSoft, color: C.red, flexShrink: 0, marginTop: 2, letterSpacing: "0.04em",
                        }}>
                          URGENTE
                        </span>
                      )}
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green, lineHeight: 1.3 }}>
                        {d.titulo}
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: C.muted, margin: 0, lineHeight: 1.5 }}>
                      {d.descricao}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                      {d.agente && (
                        <span style={{ fontSize: 9.5, color: C.muted }}>{d.agente}</span>
                      )}
                      <span style={{ fontSize: 9, color: C.line }}>·</span>
                      <span style={{ fontSize: 9.5, color: C.muted }}>{d.tempo}</span>
                      {d.valor && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: C.gold,
                          marginLeft: "auto", letterSpacing: "-0.01em",
                        }}>
                          R${d.valor >= 1000 ? `${(d.valor / 1000).toFixed(0)}k` : d.valor.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{
                    display: "flex", gap: 6, padding: "8px 10px",
                    borderTop: `1px solid ${C.line}`, background: "rgba(247,244,236,0.6)",
                  }}>
                    <button style={{
                      flex: 1, padding: "5px 0", borderRadius: 6,
                      background: C.green, border: "none", color: "#fff",
                      fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "opacity 150ms",
                    }}
                    onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
                    onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                    >
                      Aprovar
                    </button>
                    <button style={{
                      flex: 1, padding: "5px 0", borderRadius: 6,
                      background: "transparent", border: `1px solid ${C.line}`,
                      color: C.muted, fontSize: 10, fontWeight: 600, cursor: "pointer",
                      transition: "border-color 150ms",
                    }}
                    onMouseOver={e => (e.currentTarget.style.borderColor = C.gold)}
                    onMouseOut={e => (e.currentTarget.style.borderColor = C.line)}
                    >
                      Ver análise
                    </button>
                    <button
                      onClick={() => setIgnorados(s => new Set([...s, d.id]))}
                      style={{
                        padding: "5px 8px", borderRadius: 6,
                        background: "transparent", border: "none",
                        color: C.muted, fontSize: 10, cursor: "pointer", opacity: 0.7,
                        transition: "opacity 150ms",
                      }}
                      onMouseOver={e => (e.currentTarget.style.opacity = "1")}
                      onMouseOut={e => (e.currentTarget.style.opacity = "0.7")}
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              );
            })}
            {DECISOES.filter(d => !ignorados.has(d.id)).length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Tudo resolvido</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>Operação saudável</div>
              </div>
            )}
            <div style={{ height: 10 }} />
          </div>
        )}

        {/* CRM */}
        {tab === "crm" && (
          <div>
            {CRM_ITEMS.map(l => {
              const isCritico = l.status === "quente" && l.tempo.includes("min") && parseInt(l.tempo) < 10;
              const tempoColor = l.status === "quente" && !l.tempo.includes("h") && parseInt(l.tempo) < 10
                ? C.red : C.muted;
              return (
                <div key={l.id} style={{
                  margin: "10px 10px 0",
                  background: C.white,
                  borderRadius: 10,
                  borderLeft: `3px solid ${l.status === "quente" ? C.red : l.status === "normal" ? C.gold : C.line}`,
                  boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
                  padding: "10px 12px",
                  cursor: "pointer",
                  transition: "box-shadow 150ms",
                }}
                onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,40,26,0.13)")}
                onMouseOut={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,40,26,0.07)")}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: C.green }}>{l.nome}</span>
                    <span style={{
                      fontSize: 12, fontWeight: 800, color: C.greenMoney, letterSpacing: "-0.01em",
                    }}>
                      R${(l.valor / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                      background: `${ORIGEM_COR[l.origem] ?? C.gold}18`,
                      color: ORIGEM_COR[l.origem] ?? C.gold, flexShrink: 0,
                    }}>
                      {l.origem}
                    </span>
                    <span style={{ fontSize: 9.5, color: C.muted }}>{l.fase}</span>
                    <span style={{ fontSize: 9.5, color: tempoColor, marginLeft: "auto", fontWeight: isCritico ? 700 : 400 }}>
                      {isCritico ? "⚠ " : ""}{l.tempo}
                    </span>
                  </div>
                </div>
              );
            })}
            <div style={{ height: 10 }} />
          </div>
        )}

        {/* APROVAÇÕES */}
        {tab === "aprovacoes" && (
          <div>
            {APROVACOES.map(a => (
              <div key={a.id} style={{
                margin: "10px 10px 0",
                background: C.white,
                borderRadius: 10,
                borderLeft: `3px solid ${C.gold}`,
                boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
                overflow: "hidden",
              }}>
                <div style={{ padding: "10px 12px 8px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 4 }}>{a.item}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9.5, color: C.muted }}>{a.solicitante}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                      background: C.goldBg, color: C.gold,
                    }}>
                      {a.tipo}
                    </span>
                    <span style={{ fontSize: 9.5, color: C.muted, marginLeft: "auto" }}>{a.tempo}</span>
                  </div>
                </div>
                <div style={{
                  display: "flex", gap: 6, padding: "8px 10px",
                  borderTop: `1px solid ${C.line}`, background: "rgba(247,244,236,0.6)",
                }}>
                  <button style={{
                    flex: 1, padding: "5px 0", borderRadius: 6,
                    background: C.green, border: "none", color: "#fff",
                    fontSize: 10, fontWeight: 700, cursor: "pointer", transition: "opacity 150ms",
                  }}
                  onMouseOver={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Aprovar
                  </button>
                  <button style={{
                    flex: 1, padding: "5px 0", borderRadius: 6,
                    background: "transparent", border: `1px solid ${C.line}`,
                    color: C.red, fontSize: 10, fontWeight: 600, cursor: "pointer",
                    transition: "border-color 150ms",
                  }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = C.red)}
                  onMouseOut={e => (e.currentTarget.style.borderColor = C.line)}
                  >
                    Reprovar
                  </button>
                </div>
              </div>
            ))}
            <div style={{ height: 10 }} />
          </div>
        )}

        {/* GARGALOS */}
        {tab === "gargalos" && (
          <div>
            {GARGALOS.map(g => (
              <div key={g.id} style={{
                margin: "10px 10px 0",
                background: C.white,
                borderRadius: 10,
                borderLeft: `3px solid ${g.impacto === "alto" ? C.red : C.gold}`,
                boxShadow: "0 1px 4px rgba(0,40,26,0.07)",
                padding: "10px 12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                    background: g.impacto === "alto" ? C.redSoft : C.goldBg,
                    color: g.impacto === "alto" ? C.red : C.gold,
                  }}>
                    {g.impacto === "alto" ? "ALTO" : "MÉDIO"}
                  </span>
                  <span style={{ fontSize: 9.5, color: C.muted }}>{g.area}</span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, marginBottom: 3 }}>{g.titulo}</div>
                <div style={{ fontSize: 10.5, color: C.muted, lineHeight: 1.5 }}>{g.descricao}</div>
              </div>
            ))}
            <div style={{ height: 10 }} />
          </div>
        )}

        {/* ALERTAS */}
        {tab === "alertas" && (
          <div>
            {ALERTAS.map(a => {
              const dotColor = a.tipo === "critico" ? C.red : a.tipo === "atencao" ? C.gold : C.green;
              const bgColor  = a.tipo === "critico" ? C.redSoft : a.tipo === "atencao" ? C.goldBg : "rgba(22,163,74,0.08)";
              return (
                <div key={a.id} style={{
                  margin: "10px 10px 0",
                  background: bgColor,
                  borderRadius: 10,
                  borderLeft: `3px solid ${dotColor}`,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: dotColor, flexShrink: 0, marginTop: 3,
                    ...(a.tipo === "critico" ? { animation: "pulse 1.4s ease-in-out infinite" } : {}),
                  }} />
                  <span style={{ fontSize: 11, color: C.text, lineHeight: 1.55 }}>{a.msg}</span>
                </div>
              );
            })}
            <div style={{ height: 10 }} />
          </div>
        )}

      </div>
    </div>
  );
}
