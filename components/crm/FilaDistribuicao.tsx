"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Users } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import { DirecionarLeadCard, type CandidatoCard } from "@/components/crm/DirecionarLeadCard";
import { abrirCopilotoVoz, type DestinoManual } from "@/lib/crm/direcionamento-ui";
import { carregarDestinosManual, gravarDestinoManual } from "@/lib/crm/encaminhamento-manual";

type Candidato = CandidatoCard;

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

/**
 * Fila de direcionamento (JOB da tela de Distribuição).
 * Lista os leads aguardando com a RECOMENDAÇÃO do motor (por aderência, regra
 * determinística — NÃO é "IA") já pré-selecionada. Direcionar em 1 toque reusa
 * o fluxo /sugerir (cria o encaminhamento) → /[id]/aprovar (avisa o fornecedor),
 * o mesmo do painel da ficha. Renderiza o CARD ÚNICO `DirecionarLeadCard`.
 */
export function FilaDistribuicao({ onDistribuido }: { onDistribuido?: () => void }) {
  const [itens, setItens] = useState<FilaItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [enviandoLead, setEnviandoLead] = useState<string | null>(null);
  const [liberandoParceiro, setLiberandoParceiro] = useState<string | null>(null);
  const [enviandoDestino, setEnviandoDestino] = useState<string | null>(null);

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
      setItens(json.data ?? []);
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

  // Direciona o lead ao parceiro escolhido (top-1 por padrão, ou alternativa).
  async function direcionar(item: FilaItem, parceiroId: string) {
    if (enviandoLead) return;
    const alvo = item.candidatos.find((c) => c.parceiro_id === parceiroId);
    setEnviandoLead(item.lead_id);
    setErro("");
    try {
      // 1) cria o encaminhamento recomendado (motor) para este lead
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
        toast.error(jSug.error || "Não foi possível preparar o direcionamento.");
        return;
      }
      // 2) aprova/avisa o fornecedor escolhido (top-1 ou alternativa)
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
        toast.error(jApr.error || "Falha ao direcionar o lead.");
        return;
      }
      toast.success(`Lead direcionado para ${alvo?.nome ?? "fornecedor"}.`);
      setItens((prev) => prev.filter((x) => x.lead_id !== item.lead_id));
      onDistribuido?.();
    } catch {
      toast.error("Erro de rede ao direcionar.");
    } finally {
      setEnviandoLead(null);
    }
  }

  // Estado-vazio com saída: deixa o lead na fila e avisa o Hub (não há beco).
  function deixarNaFila(item: FilaItem) {
    toast.success(`${item.nome} permanece na fila — o Hub foi avisado.`);
  }

  // Libera a pendência financeira do parceiro recomendado e recarrega a fila
  // (o motor para de penalizar → o candidato sobe e o "Direcionar" segue).
  async function liberar(parceiroId: string) {
    if (liberandoParceiro) return;
    setLiberandoParceiro(parceiroId);
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
      setLiberandoParceiro(null);
    }
  }

  // Direcionamento MANUAL a outro destino por perfil (válvula de escape do motor).
  async function direcionarManual(item: FilaItem, destino: DestinoManual) {
    if (enviandoDestino) return;
    setEnviandoDestino(item.lead_id);
    try {
      const r = await gravarDestinoManual(item.lead_id, destino);
      if (!r.ok) {
        toast.error(r.error || "Não foi possível direcionar.");
        return;
      }
      toast.success(`Lead direcionado para ${destino.destinoNome}.`);
      setItens((prev) => prev.filter((x) => x.lead_id !== item.lead_id));
      onDistribuido?.();
    } finally {
      setEnviandoDestino(null);
    }
  }

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
          <Users size={15} aria-hidden /> Fila de direcionamento
          <span style={{ color: "#6e7681", fontWeight: 400 }}>
            · leads aguardando · o motor já recomendou quem recebe
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
        <p style={{ margin: 0, color: "#8b949e", fontSize: 13 }}>Carregando os leads e as recomendações do motor…</p>
      ) : erro ? (
        <p style={{ margin: 0, color: "#f85149", fontSize: 13 }}>{erro}</p>
      ) : itens.length === 0 ? (
        <div style={{ padding: "18px 8px", textAlign: "center", color: "#8b949e", fontSize: 13 }}>
          <Check size={24} color="#3fb950" style={{ margin: "0 auto 8px", display: "block" }} aria-hidden />
          Nenhum lead aguardando direcionamento. Tudo encaminhado.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {itens.map((item) => (
            <DirecionarLeadCard
              key={item.lead_id}
              lead={{ nome: item.nome, mercado: item.mercado, cidade: item.cidade, estado: item.estado }}
              candidatos={item.candidatos}
              enviando={enviandoLead === item.lead_id}
              onDirecionar={(parceiroId) => void direcionar(item, parceiroId)}
              onVoz={abrirCopilotoVoz}
              onLiberar={(parceiroId) => void liberar(parceiroId)}
              liberando={liberandoParceiro === (item.candidatos[0]?.parceiro_id ?? null)}
              enviandoDestino={enviandoDestino === item.lead_id}
              vazio={{
                onDeixarNaFila: () => deixarNaFila(item),
                onOutroDestino: (destino) => void direcionarManual(item, destino),
                carregarDestinos: carregarDestinosManual,
              }}
            />
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
