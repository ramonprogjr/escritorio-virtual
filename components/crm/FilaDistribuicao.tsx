"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, MapPin, RefreshCw, Send, Users } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";

type Candidato = {
  parceiro_id: string;
  nome: string;
  score: number;
  motivo: string | null;
  mercado: string | null;
  cidade: string | null;
  estado: string | null;
  status_financeiro: string | null;
};

type FilaItem = {
  lead_id: string;
  nome: string;
  telefone: string | null;
  mercado: string;
  cidade: string | null;
  estado: string | null;
  criado_em: string | null;
  candidatos: Candidato[];
};

const GEO = (c: Candidato | FilaItem) =>
  [c.cidade, c.estado].filter(Boolean).join("/") || null;

/**
 * Fila de distribuição (topo da tela de Distribuição).
 * Lista os leads aguardando distribuição com a sugestão do motor de score
 * (top-1 + alternativas). Confirmar em 1 toque encaminha pro escolhido — reusa
 * o fluxo /sugerir (cria o encaminhamento) → /[id]/aprovar (envia ao fornecedor),
 * o mesmo do DistribuirLeadPanel. Motor é regra (sem LLM / sem chave Mistral).
 */
export function FilaDistribuicao({ onDistribuido }: { onDistribuido?: () => void }) {
  const [itens, setItens] = useState<FilaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  // lead_id -> parceiro_id escolhido (default = top-1)
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [enviandoLead, setEnviandoLead] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/distribuicao/fila", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: FilaItem[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Não foi possível carregar a fila.");
        setItens([]);
        return;
      }
      const data = json.data ?? [];
      setItens(data);
      setEscolha((prev) => {
        const next = { ...prev };
        for (const it of data) {
          if (!next[it.lead_id] && it.candidatos[0]) next[it.lead_id] = it.candidatos[0].parceiro_id;
        }
        return next;
      });
    } catch {
      setErro("Erro de rede ao carregar a fila.");
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmar(item: FilaItem) {
    if (enviandoLead) return;
    const parceiroId = escolha[item.lead_id] || item.candidatos[0]?.parceiro_id;
    if (!parceiroId) return;
    const alvo = item.candidatos.find((c) => c.parceiro_id === parceiroId);
    setEnviandoLead(item.lead_id);
    setErro("");
    try {
      // 1) cria o encaminhamento sugerido (motor) para este lead
      const resSug = await fetch("/api/crm/distribuicao/sugerir", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ lead_id: item.lead_id }),
      });
      const jSug = (await resSug.json().catch(() => ({}))) as {
        ok?: boolean;
        encaminhamento_id?: string;
        error?: string;
      };
      if (!resSug.ok || !jSug.ok || !jSug.encaminhamento_id) {
        toast.error(jSug.error || "Não foi possível preparar o encaminhamento.");
        return;
      }
      // 2) aprova/envia ao fornecedor escolhido (top-1 ou alternativa)
      const resApr = await fetch(
        `/api/crm/distribuicao/${encodeURIComponent(jSug.encaminhamento_id)}/aprovar`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({ parceiro_id: parceiroId }),
        }
      );
      const jApr = (await resApr.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!resApr.ok || !jApr.ok) {
        toast.error(jApr.error || "Falha ao encaminhar o lead.");
        return;
      }
      toast.success(`Lead encaminhado para ${alvo?.nome ?? "fornecedor"}.`);
      // some da fila localmente (já distribuído) e avisa o painel
      setItens((prev) => prev.filter((x) => x.lead_id !== item.lead_id));
      onDistribuido?.();
    } catch {
      toast.error("Erro de rede ao encaminhar.");
    } finally {
      setEnviandoLead(null);
    }
  }

  const corScore = (s: number) => (s >= 70 ? "#3fb950" : s >= 40 ? "#e3b341" : "#f0883e");

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 16,
        borderRadius: 12,
        border: "1px solid #c9a24a44",
        background: "linear-gradient(180deg, #00261a 0%, #0a140f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: itens.length || carregando || erro ? 14 : 0,
          flexWrap: "wrap",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#c9a24a", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={15} aria-hidden /> Fila de distribuição
          <span style={{ color: "#6e7681", fontWeight: 400 }}>
            · leads aguardando · a IA já sugeriu quem recebe
          </span>
        </p>
        <button
          type="button"
          onClick={() => void carregar()}
          disabled={carregando}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px",
            borderRadius: 7, border: "1px solid #1d3a2c", background: "transparent",
            color: "#8b949e", fontSize: 12, fontWeight: 700, cursor: carregando ? "default" : "pointer",
          }}
        >
          <RefreshCw size={13} aria-hidden style={carregando ? { animation: "spin 1s linear infinite" } : undefined} />
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {carregando ? (
        <p style={{ margin: 0, color: "#8b949e", fontSize: 13 }}>Carregando os leads e as sugestões do motor…</p>
      ) : erro ? (
        <p style={{ margin: 0, color: "#f85149", fontSize: 13 }}>{erro}</p>
      ) : itens.length === 0 ? (
        <div style={{ padding: "18px 8px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>
          <Check size={24} color="#3fb950" style={{ margin: "0 auto 8px", display: "block" }} aria-hidden />
          Nenhum lead aguardando distribuição. Tudo encaminhado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {itens.map((item) => {
            const sel = escolha[item.lead_id] || item.candidatos[0]?.parceiro_id || "";
            const semCandidato = item.candidatos.length === 0;
            const enviando = enviandoLead === item.lead_id;
            const geoLead = GEO(item);
            return (
              <div
                key={item.lead_id}
                style={{
                  border: "1px solid #1d3a2c",
                  borderRadius: 12,
                  background: "#0b0f14",
                  padding: 14,
                }}
              >
                {/* Cabeçalho do lead */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: semCandidato ? 0 : 12 }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#e6edf3" }}>{item.nome}</p>
                    <p style={{ margin: "3px 0 0", fontSize: 11.5, color: "#8b949e", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, color: "#c9a24a" }}>{item.mercado}</span>
                      {geoLead && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                          <MapPin size={11} aria-hidden /> {geoLead}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {semCandidato ? (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#f0883e" }}>
                    Nenhum fornecedor homologado combina com este mercado/região ainda.
                  </p>
                ) : (
                  <>
                    {/* Sugestões: top-1 + alternativas, selecionáveis */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      {item.candidatos.map((c, i) => {
                        const escolhido = sel === c.parceiro_id;
                        return (
                          <button
                            key={c.parceiro_id}
                            type="button"
                            onClick={() => setEscolha((p) => ({ ...p, [item.lead_id]: c.parceiro_id }))}
                            style={{
                              display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                              padding: "9px 11px", borderRadius: 10, cursor: "pointer",
                              border: `1px solid ${escolhido ? "#c9a24a" : "#16271e"}`,
                              background: escolhido ? "rgba(201,162,74,0.10)" : "transparent",
                            }}
                          >
                            <span
                              aria-hidden
                              style={{
                                width: 15, height: 15, borderRadius: 999, flexShrink: 0, marginTop: 1,
                                border: `2px solid ${escolhido ? "#c9a24a" : "#3a4a40"}`,
                                background: escolhido ? "#c9a24a" : "transparent",
                                boxShadow: escolhido ? "inset 0 0 0 2px #0b0f14" : "none",
                              }}
                            />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#e6edf3" }}>{c.nome}</span>
                                {i === 0 && (
                                  <span style={{ fontSize: 9, fontWeight: 800, color: "#003b26", background: "#c9a24a", borderRadius: 4, padding: "1px 6px" }}>
                                    RECOMENDADO
                                  </span>
                                )}
                                {c.status_financeiro && c.status_financeiro !== "em_dia" && (
                                  <span style={{ fontSize: 9, fontWeight: 700, color: c.status_financeiro === "bloqueado" ? "#f85149" : "#e3b341" }}>
                                    ● {c.status_financeiro}
                                  </span>
                                )}
                              </span>
                              <span style={{ display: "block", margin: "2px 0 0", fontSize: 11, color: "#7d8a99", lineHeight: 1.4 }}>
                                aderência {c.score}{c.motivo ? ` · ${c.motivo}` : ""}
                              </span>
                            </span>
                            <span style={{ width: 40, textAlign: "right", flexShrink: 0 }}>
                              <span style={{ fontSize: 17, fontWeight: 800, color: corScore(c.score), lineHeight: 1 }}>{c.score}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Confirmar em 1 toque (top-1 por padrão, ou a alternativa escolhida) */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                      <button
                        type="button"
                        disabled={enviando || !sel}
                        onClick={() => void confirmar(item)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 7,
                          padding: "9px 18px", borderRadius: 9, border: "none",
                          background: "#c9a24a", color: "#003b26", fontWeight: 800, fontSize: 13,
                          cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.65 : 1,
                        }}
                      >
                        <Send size={14} strokeWidth={2.5} aria-hidden />
                        {enviando ? "Encaminhando…" : "Confirmar e encaminhar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
