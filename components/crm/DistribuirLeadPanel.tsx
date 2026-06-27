"use client";

import { useState } from "react";
import { Share2, Check, MapPin, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Candidato = {
  parceiro_id: string;
  nome: string;
  telefone?: string | null;
  score: number;
  motivo?: string | null;
  mercado?: string | null;
  cidade?: string | null;
  estado?: string | null;
  status_financeiro?: string | null;
};

/**
 * Fatia 1 do motor de distribuição: "Quem deve receber este lead?".
 * Chama /distribuicao/sugerir (top-5 determinístico) e deixa o gestor encaminhar 1 a 1 toque.
 * Reusa o backend já testado (scoreParceiro / aprovarEEnviarEncaminhamento).
 */
export function DistribuirLeadPanel({
  leadId,
  onDone,
}: {
  leadId: string;
  onDone?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [encId, setEncId] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const [enviadoNome, setEnviadoNome] = useState<string | null>(null);
  const [recoloc, setRecoloc] = useState<string | null>(null);
  const [recolocando, setRecolocando] = useState(false);

  async function abrir() {
    setAberto(true);
    setErro("");
    setEnviadoNome(null);
    setRecoloc(null);
    setCandidatos([]);
    setEncId(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/distribuicao/sugerir", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        encaminhamento_id?: string;
        candidatos?: Candidato[];
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setErro(json.error || "Não foi possível sugerir fornecedores.");
        setCandidatos(json.candidatos ?? []);
        return;
      }
      setEncId(json.encaminhamento_id ?? null);
      setCandidatos(json.candidatos ?? []);
    } catch {
      setErro("Erro de rede ao buscar fornecedores.");
    } finally {
      setCarregando(false);
    }
  }

  async function encaminhar(c: Candidato) {
    if (!encId || enviandoId) return;
    setEnviandoId(c.parceiro_id);
    setErro("");
    try {
      const res = await fetch(`/api/crm/distribuicao/${encodeURIComponent(encId)}/aprovar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ parceiro_id: c.parceiro_id }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErro(json.error || "Falha ao encaminhar.");
        return;
      }
      setEnviadoNome(c.nome);
      onDone?.();
    } catch {
      setErro("Erro de rede ao encaminhar.");
    } finally {
      setEnviandoId(null);
    }
  }

  async function liberar(c: Candidato) {
    try {
      const res = await fetch(`/api/crm/parceiros/${encodeURIComponent(c.parceiro_id)}/liberar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      });
      if (res.ok) {
        setCandidatos((prev) =>
          prev.map((x) => (x.parceiro_id === c.parceiro_id ? { ...x, status_financeiro: "em_dia" } : x))
        );
      }
    } catch {
      /* silencioso — o badge permanece se falhar */
    }
  }

  async function recusarEOfertarProximo() {
    if (!encId || recolocando) return;
    setRecolocando(true);
    try {
      const res = await fetch(`/api/crm/encaminhamentos/${encodeURIComponent(encId)}/recusar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        proximo?: { nome?: string } | null;
      };
      if (res.ok && json.ok) {
        setRecoloc(
          json.proximo?.nome
            ? `Recolocado para ${json.proximo.nome}.`
            : "Sem próximo elegível — lead voltou à fila."
        );
        onDone?.();
      }
    } finally {
      setRecolocando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void abrir()}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors md:text-sm"
        style={{ borderColor: "#1d3a2c", color: "#c9a24a", background: "#003b2622" }}
      >
        <Share2 className="h-4 w-4" strokeWidth={2} />
        Distribuir
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setAberto(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 230,
            background: "rgba(1,4,9,0.7)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "48px 16px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 620,
              background: "#0a140f",
              border: "1px solid #c9a24a44",
              borderRadius: 16,
              padding: 22,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
              <Share2 size={20} color="#c9a24a" aria-hidden />
              <h2 style={{ margin: 0, fontSize: 19, color: "#e6edf3", flex: 1 }}>
                Quem deve receber este lead?
              </h2>
              <button type="button" onClick={() => setAberto(false)} aria-label="Fechar"
                style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13, lineHeight: 1.5 }}>
              Os fornecedores abaixo são os que <strong style={{ color: "#e0b86a" }}>mais combinam</strong> com
              este lead — por mercado, região e desempenho. Encaminhe a quem fizer mais sentido.
            </p>

            {carregando ? (
              <p style={{ color: "#8b949e", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
                Buscando os melhores fornecedores…
              </p>
            ) : enviadoNome ? (
              <div style={{ textAlign: "center", padding: "24px 8px" }}>
                <Check size={48} color="#34d399" style={{ margin: "0 auto 12px" }} />
                <p style={{ margin: 0, fontSize: 16, color: "#e6edf3" }}>
                  Lead encaminhado para <strong style={{ color: "#c9a24a" }}>{enviadoNome}</strong>.
                </p>
                <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: 13 }}>
                  O fornecedor foi notificado. Você acompanha o avanço no painel do Hub.
                </p>
                {recoloc ? (
                  <p style={{ margin: "12px 0 0", fontSize: 13, color: "#e0b86a", fontWeight: 600 }}>{recoloc}</p>
                ) : null}
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                  {!recoloc && (
                    <button
                      type="button"
                      disabled={recolocando}
                      onClick={() => void recusarEOfertarProximo()}
                      style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", fontWeight: 700, fontSize: 12, cursor: recolocando ? "default" : "pointer" }}
                    >
                      {recolocando ? "Recolocando…" : "Fornecedor recusou? → oferecer ao próximo"}
                    </button>
                  )}
                  <button type="button" onClick={() => setAberto(false)}
                    style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                    Fechar
                  </button>
                </div>
              </div>
            ) : candidatos.length === 0 ? (
              <p style={{ color: "#f0883e", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                {erro || "Nenhum fornecedor disponível para este mercado/região."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {erro && <p style={{ color: "#f85149", fontSize: 12, margin: 0 }}>{erro}</p>}
                {candidatos.map((c, i) => (
                  <div
                    key={c.parceiro_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      border: `1px solid ${i === 0 ? "#c9a24a55" : "#1d3a2c"}`,
                      background: i === 0 ? "rgba(201,162,74,0.06)" : "#0f1d16",
                      borderRadius: 12,
                      padding: "12px 14px",
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 10,
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(201,162,74,0.12)",
                        color: "#e0b86a",
                        fontWeight: 800,
                      }}
                    >
                      <span style={{ fontSize: 15, lineHeight: 1 }}>{c.score}</span>
                      <span style={{ fontSize: 8, opacity: 0.8 }}>match</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e6edf3", display: "flex", alignItems: "center", gap: 6 }}>
                        {c.nome}
                        {i === 0 && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: "#003b26", background: "#c9a24a", borderRadius: 4, padding: "1px 6px" }}>
                            TOP
                          </span>
                        )}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: 12, color: "#8b949e", display: "flex", alignItems: "center", gap: 5 }}>
                        {(c.cidade || c.estado) && <MapPin size={12} aria-hidden />}
                        {[c.cidade, c.estado].filter(Boolean).join("/")}
                        {c.mercado ? `${c.cidade || c.estado ? " · " : ""}${c.mercado}` : ""}
                      </p>
                      {c.motivo && (
                        <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#7d8a99", lineHeight: 1.4 }}>
                          {c.motivo}
                        </p>
                      )}
                      {c.status_financeiro && c.status_financeiro !== "em_dia" && (
                        <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 999,
                              color: c.status_financeiro === "bloqueado" ? "#f85149" : "#e3b341",
                              background:
                                c.status_financeiro === "bloqueado" ? "rgba(248,81,73,0.12)" : "rgba(227,179,65,0.12)",
                              border: `1px solid ${
                                c.status_financeiro === "bloqueado" ? "rgba(248,81,73,0.35)" : "rgba(227,179,65,0.35)"
                              }`,
                            }}
                          >
                            {c.status_financeiro === "bloqueado"
                              ? "⛔ Bloqueado · pendência financeira"
                              : "⚠ Pendência financeira"}
                          </span>
                          <button
                            type="button"
                            onClick={() => void liberar(c)}
                            title="Liberar este fornecedor (Hub regulariza a pendência)"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 9px",
                              borderRadius: 999,
                              border: "1px solid #1d3a2c",
                              background: "transparent",
                              color: "#8b949e",
                              cursor: "pointer",
                            }}
                          >
                            Liberar
                          </button>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!!enviandoId}
                      onClick={() => void encaminhar(c)}
                      style={{
                        flexShrink: 0,
                        padding: "9px 14px",
                        borderRadius: 8,
                        border: "none",
                        background: "#c9a24a",
                        color: "#003b26",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: enviandoId ? "default" : "pointer",
                        opacity: enviandoId && enviandoId !== c.parceiro_id ? 0.5 : 1,
                      }}
                    >
                      {enviandoId === c.parceiro_id ? "Enviando…" : "Encaminhar"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
