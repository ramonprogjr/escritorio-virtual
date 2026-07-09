"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2, Check, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import { DirecionarLeadCard, type CandidatoCard } from "@/components/crm/DirecionarLeadCard";
import { abrirCopilotoVoz, type DestinoManual } from "@/lib/crm/direcionamento-ui";
import { carregarDestinosManual, gravarDestinoManual } from "@/lib/crm/encaminhamento-manual";
import type { CardResumoLead } from "@/lib/crm/gerar-card-lead";

type Candidato = CandidatoCard & { telefone?: string | null };

/**
 * Drawer CONTROLADO de direcionamento — o MESMO card único, com fluxo completo
 * /distribuicao/sugerir (cria o encaminhamento + recomendação do motor) →
 * /[id]/aprovar (avisa o fornecedor) + caminho recusa→próximo.
 *
 * É o coração reutilizável: tanto o painel da ficha (`DistribuirLeadPanel`) quanto
 * o quick-action "Direcionar" da lista de leads montam este drawer. Um verbo só.
 */
export function DirecionarLeadDrawer({
  open,
  leadId,
  leadNome,
  onClose,
  onDirecionado,
  onQualificar,
}: {
  open: boolean;
  leadId: string;
  leadNome?: string;
  onClose: () => void;
  /** Chamado após direcionar com sucesso (ex.: mover o estágio e recarregar). */
  onDirecionado?: () => void;
  /**
   * Sem precondição invisível: se o lead ainda não está qualificado, o motor
   * recusa. Quando fornecido, promove o lead a "qualificado" e re-roda /sugerir
   * num passo só ("Qualificar e direcionar"). Deve resolver true em sucesso.
   */
  onQualificar?: () => Promise<boolean>;
}) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [desligado, setDesligado] = useState(false);
  const [encId, setEncId] = useState<string | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cardResumo, setCardResumo] = useState<CardResumoLead | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviadoNome, setEnviadoNome] = useState<string | null>(null);
  const [recoloc, setRecoloc] = useState<string | null>(null);
  const [recolocando, setRecolocando] = useState(false);
  const [naoQualificado, setNaoQualificado] = useState(false);
  const [naoPronto, setNaoPronto] = useState(false);
  const [qualificando, setQualificando] = useState(false);
  const [liberando, setLiberando] = useState(false);
  const [enviandoDestino, setEnviandoDestino] = useState(false);

  const carregar = useCallback(async () => {
    setErro("");
    setDesligado(false);
    setNaoQualificado(false);
    setNaoPronto(false);
    setEnviadoNome(null);
    setRecoloc(null);
    setCandidatos([]);
    setEncId(null);
    setCardResumo(null);
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
        card_resumo?: CardResumoLead | null;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        const msg = (json.error || "").toLowerCase();
        if (msg.includes("autom")) setDesligado(true);
        // "pronto"/"interesse" = falta DADO (não resolvível por 1 clique) → aviso, sem botão.
        // "qualificad" (e não é falta de dado) = falta ESTÁGIO → oferece "Qualificar e direcionar".
        if (msg.includes("pronto") || msg.includes("interesse")) setNaoPronto(true);
        else if (msg.includes("qualificad")) setNaoQualificado(true);
        setErro(json.error || "Não foi possível recomendar fornecedores.");
        setCandidatos(json.candidatos ?? []);
        return;
      }
      setEncId(json.encaminhamento_id ?? null);
      setCandidatos(json.candidatos ?? []);
      setCardResumo(json.card_resumo ?? null);
    } catch {
      setErro("Erro de rede ao buscar fornecedores.");
    } finally {
      setCarregando(false);
    }
  }, [leadId]);

  // Sem precondição invisível: promove o lead e re-roda /sugerir num passo só.
  async function qualificarEDirecionar() {
    if (!onQualificar || qualificando) return;
    setQualificando(true);
    try {
      const ok = await onQualificar();
      if (ok) await carregar();
    } finally {
      setQualificando(false);
    }
  }

  // Roda /sugerir toda vez que o drawer abre.
  useEffect(() => {
    if (open) void carregar();
  }, [open, carregar]);

  async function direcionar(parceiroId: string) {
    if (!encId || enviando) return;
    const c = candidatos.find((x) => x.parceiro_id === parceiroId);
    setEnviando(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/distribuicao/${encodeURIComponent(encId)}/aprovar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ parceiro_id: parceiroId }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setErro(json.error || "Falha ao direcionar.");
        return;
      }
      setEnviadoNome(c?.nome ?? "fornecedor");
      onDirecionado?.();
    } catch {
      setErro("Erro de rede ao direcionar.");
    } finally {
      setEnviando(false);
    }
  }

  // Libera a pendência financeira do parceiro recomendado e re-roda /sugerir
  // (o motor deixa de penalizar → o candidato sobe e o "Direcionar" segue).
  async function liberarParceiro(parceiroId: string) {
    if (liberando) return;
    setLiberando(true);
    try {
      const res = await fetch(`/api/crm/parceiros/${encodeURIComponent(parceiroId)}/liberar`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error || "Não foi possível liberar o parceiro.");
        return;
      }
      toast.success("Parceiro liberado. Pode seguir o direcionamento.");
      await carregar();
    } catch {
      toast.error("Erro de rede ao liberar o parceiro.");
    } finally {
      setLiberando(false);
    }
  }

  // Direcionamento MANUAL a outro destino por perfil (válvula de escape).
  async function direcionarManual(destino: DestinoManual) {
    if (enviandoDestino) return;
    setEnviandoDestino(true);
    try {
      const r = await gravarDestinoManual(leadId, destino);
      if (!r.ok) {
        toast.error(r.error || "Não foi possível direcionar.");
        return;
      }
      setEnviadoNome(destino.destinoNome);
      toast.success(`Lead direcionado para ${destino.destinoNome}.`);
      onDirecionado?.();
    } finally {
      setEnviandoDestino(false);
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
        onDirecionado?.();
      }
    } finally {
      setRecolocando(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
          maxWidth: 560,
          background: "#0a140f",
          border: "1px solid #c9a24a44",
          borderRadius: 16,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
          <Share2 size={20} color="#c9a24a" aria-hidden />
          <h2 style={{ margin: 0, fontSize: 18, color: "#e6edf3", flex: 1 }}>Direcionar lead</h2>
          <button type="button" onClick={onClose} aria-label="Fechar"
            style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {carregando ? (
          <p style={{ color: "#8b949e", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
            Buscando os melhores fornecedores…
          </p>
        ) : enviadoNome ? (
          <div style={{ textAlign: "center", padding: "24px 8px" }}>
            <Check size={48} color="#34d399" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 16, color: "#e6edf3" }}>
              Lead direcionado para <strong style={{ color: "#c9a24a" }}>{enviadoNome}</strong>.
            </p>
            <p style={{ margin: "6px 0 0", color: "#8b949e", fontSize: 13 }}>
              O fornecedor foi avisado no WhatsApp. Você acompanha o avanço no painel do Hub.
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
              <button type="button" onClick={onClose}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Fechar
              </button>
            </div>
          </div>
        ) : naoPronto ? (
          <div style={{ padding: "8px 4px" }}>
            <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#e6edf3", lineHeight: 1.5 }}>
              {erro || "Este lead ainda não está pronto para direcionar — falta interesse e/ou valor."}
            </p>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#8b949e", lineHeight: 1.5 }}>
              Preencha <strong style={{ color: "#c9a24a" }}>interesse</strong> e{" "}
              <strong style={{ color: "#c9a24a" }}>valor</strong> na aba <strong>Dados</strong> da ficha. Quando o
              lead ficar pronto, a IA já sugere o direcionamento sozinha.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%", padding: "13px 18px", borderRadius: 11, border: "none",
                background: "#c9a24a", color: "#003b26", fontWeight: 800, fontSize: 14.5, cursor: "pointer",
              }}
            >
              Entendi
            </button>
          </div>
        ) : naoQualificado && onQualificar ? (
          <div style={{ padding: "8px 4px" }}>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "#e6edf3", lineHeight: 1.5 }}>
              Este lead ainda não está <strong style={{ color: "#c9a24a" }}>qualificado</strong>. O motor
              só recomenda fornecedores para leads qualificados — mas você resolve isso aqui mesmo,
              num passo só.
            </p>
            <button
              type="button"
              disabled={qualificando}
              onClick={() => void qualificarEDirecionar()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                width: "100%", padding: "13px 18px", borderRadius: 11, border: "none",
                background: "#c9a24a", color: "#003b26", fontWeight: 800, fontSize: 14.5,
                cursor: qualificando ? "default" : "pointer", opacity: qualificando ? 0.65 : 1,
              }}
            >
              {qualificando ? "Qualificando…" : "Qualificar e direcionar"}
            </button>
          </div>
        ) : (
          <>
            {erro && candidatos.length > 0 && (
              <p style={{ color: "#f85149", fontSize: 12, margin: "0 0 10px" }}>{erro}</p>
            )}
            {cardResumo && candidatos.length > 0 && (
              <div
                style={{
                  marginBottom: 14,
                  padding: "12px 14px",
                  borderRadius: 12,
                  background: "#07110c",
                  border: "1px solid #1d3a2c",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 11,
                    letterSpacing: 0.4,
                    textTransform: "uppercase",
                    color: "#8b949e",
                    fontWeight: 700,
                  }}
                >
                  📋 O parceiro vai receber
                </p>
                <p style={{ margin: "0 0 6px", fontSize: 13.5, color: "#e6edf3", lineHeight: 1.5 }}>
                  {cardResumo.pedido_resumo}
                </p>
                {(() => {
                  const ultima = [...cardResumo.ultimas_falas].reverse().find((f) => f.de === "cliente");
                  return ultima ? (
                    <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "#c9a24a", fontStyle: "italic" }}>
                      💬 &ldquo;{ultima.texto}&rdquo;
                    </p>
                  ) : null;
                })()}
                <p style={{ margin: "6px 0 0", fontSize: 11, color: "#6b7681" }}>
                  {cardResumo.fonte_resumo === "ia" ? "Resumo gerado pela IA" : "Resumo automático"} · enviado no
                  WhatsApp do parceiro
                </p>
              </div>
            )}
            <DirecionarLeadCard
              lead={{ nome: leadNome ?? "Lead" }}
              candidatos={candidatos}
              enviando={enviando}
              onDirecionar={(parceiroId) => void direcionar(parceiroId)}
              onVoz={abrirCopilotoVoz}
              onLiberar={(parceiroId) => void liberarParceiro(parceiroId)}
              liberando={liberando}
              desligado={desligado}
              enviandoDestino={enviandoDestino}
              vazio={{
                onDeixarNaFila: onClose,
                onOutroDestino: (destino) => void direcionarManual(destino),
                carregarDestinos: carregarDestinosManual,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
