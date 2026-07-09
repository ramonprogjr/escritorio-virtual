"use client";

import { useState } from "react";
import { X, ClipboardList } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * Modal enxuto para criar uma tarefa vinculada a um lead direto da conversa/ficha.
 * Reaproveita POST /api/crm/tarefas (gerenciador de tarefas universal) e o CrmButton base.
 */
export function CriarTarefaModal({
  open,
  leadId,
  leadNome,
  onClose,
  onCriada,
}: {
  open: boolean;
  leadId: string;
  leadNome?: string;
  onClose: () => void;
  onCriada?: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [prazo, setPrazo] = useState("");
  const [prioridade, setPrioridade] = useState<"baixa" | "media" | "alta">("media");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  if (!open) return null;

  async function criar() {
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/tarefas", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          titulo: titulo.trim(),
          lead_id: leadId,
          prioridade,
          vencimento_em: prazo ? new Date(prazo).toISOString() : undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) {
        setErro(j.error || "Não foi possível criar a tarefa.");
        return;
      }
      setTitulo("");
      setPrazo("");
      onCriada?.();
      onClose();
    } catch {
      setErro("Erro de rede ao criar a tarefa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 240,
        background: "rgba(1,4,9,0.7)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "56px 16px",
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-obra-borda bg-obra-dark-2 p-5"
      >
        <div className="mb-4 flex items-start gap-2.5">
          <ClipboardList size={20} className="text-obra-dourado" aria-hidden />
          <div className="flex-1">
            <h2 className="m-0 text-base font-semibold text-obra-texto">Nova tarefa</h2>
            {leadNome && <p className="m-0 mt-0.5 text-xs text-obra-texto-2">para {leadNome}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-obra-texto-2 hover:text-obra-texto">
            <X size={18} />
          </button>
        </div>

        {erro && (
          <p role="alert" className="mb-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
            {erro}
          </p>
        )}

        <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-obra-texto-2">O que fazer</label>
        <input
          autoFocus
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void criar(); }}
          placeholder="Ex.: Ligar para confirmar a visita"
          className="mb-3 w-full rounded-lg border border-obra-borda bg-obra-dark px-3 py-2.5 text-sm text-obra-texto outline-none placeholder:text-obra-texto-3 focus:border-obra-dourado"
        />

        <div className="mb-4 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-obra-texto-2">Prazo (opcional)</label>
            <input
              type="datetime-local"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded-lg border border-obra-borda bg-obra-dark px-3 py-2 text-sm text-obra-texto outline-none focus:border-obra-dourado"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-obra-texto-2">Prioridade</label>
            <select
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value as "baixa" | "media" | "alta")}
              className="rounded-lg border border-obra-borda bg-obra-dark px-3 py-2 text-sm text-obra-texto outline-none focus:border-obra-dourado"
            >
              <option value="baixa">Baixa</option>
              <option value="media">Média</option>
              <option value="alta">Alta</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <CrmButton variant="ghost" size="sm" onClick={onClose}>Cancelar</CrmButton>
          <CrmButton size="sm" loading={salvando} disabled={!titulo.trim()} onClick={() => void criar()}>
            Criar tarefa
          </CrmButton>
        </div>
      </div>
    </div>
  );
}
