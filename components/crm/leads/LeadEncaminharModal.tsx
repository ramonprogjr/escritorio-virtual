"use client";

import { useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { CandidatoParceiro } from "@/lib/crm/distribuir-lead";

type Props = {
  open: boolean;
  leadId: string;
  leadNome: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function LeadEncaminharModal({ open, leadId, leadNome, onClose, onSuccess }: Props) {
  const [destinatario, setDestinatario] = useState("");
  const [segmento, setSegmento] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [sugeridoIa, setSugeridoIa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const [candidatos, setCandidatos] = useState<CandidatoParceiro[]>([]);
  const [erro, setErro] = useState("");

  if (!open) return null;

  async function sugerirComIa() {
    setErro("");
    setSugerindo(true);
    try {
      const res = await fetch("/api/crm/distribuicao/sugerir", {
        method: "POST",
        credentials: "include",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        principal?: CandidatoParceiro;
        candidatos?: CandidatoParceiro[];
      };
      if (!res.ok) {
        setErro(json.error || "Não foi possível gerar sugestão.");
        return;
      }
      const lista = json.candidatos ?? (json.principal ? [json.principal] : []);
      setCandidatos(lista);
      if (json.principal) {
        setDestinatario(json.principal.nome);
        setSegmento(json.principal.mercado ?? "");
        setSugeridoIa(true);
      }
      onSuccess();
    } catch {
      setErro("Erro de rede ao sugerir parceiro.");
    } finally {
      setSugerindo(false);
    }
  }

  async function enviar() {
    setErro("");
    if (!destinatario.trim()) {
      setErro("Informe para quem foi encaminhado.");
      return;
    }
    setSalvando(true);
    const res = await fetch("/api/crm/encaminhamentos", {
      method: "POST",
      credentials: "include",
      headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        segmento: segmento.trim() || null,
        responsavel_envio: responsavel.trim() || "gestor",
        destinatario_pessoa_id: null,
        sugerido_ia: sugeridoIa,
        validado_humano: !sugeridoIa,
        status: sugeridoIa ? "aguardando_validacao" : "enviado",
        criterio_selecao: destinatario.trim(),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSalvando(false);
    if (!res.ok) {
      setErro(typeof json?.error === "string" ? json.error : "Não foi possível encaminhar.");
      return;
    }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#30363d] bg-[#161b22] p-5 shadow-xl">
        <h3 className="text-base font-bold text-[#e6edf3]">Encaminhar lead</h3>
        <p className="mt-1 text-sm text-[#8b949e]">{leadNome}</p>

        <div className="mt-3">
          <button
            type="button"
            disabled={sugerindo}
            onClick={() => void sugerirComIa()}
            className="w-full rounded-lg border border-[#c9a24a]/40 bg-[#c9a24a]/10 py-2 text-xs font-bold text-[#c9a24a] disabled:opacity-50"
          >
            {sugerindo ? "A gerar sugestão…" : "Sugerir parceiro com IA"}
          </button>
          {candidatos.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-[#8b949e]">
              {candidatos.slice(0, 3).map((c) => (
                <li key={c.parceiro_id}>
                  {c.nome} — score {c.score} ({c.motivo})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Para quem *</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={destinatario}
              onChange={(e) => setDestinatario(e.target.value)}
              placeholder="Corretor, arquiteto, fornecedor…"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Segmento</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#8b949e]">Autorizado por</label>
            <input
              className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3]"
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              placeholder="Seu nome ou e-mail"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#8b949e]">
            <input type="checkbox" checked={sugeridoIa} onChange={(e) => setSugeridoIa(e.target.checked)} />
            Sugestão da IA (exige validação humana)
          </label>
        </div>

        {erro ? <p className="mt-3 text-sm text-red-400">{erro}</p> : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-[#30363d] py-2 text-sm text-[#8b949e]"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={salvando}
            onClick={() => void enviar()}
            className="flex-1 rounded-lg bg-[#c9a24a] py-2 text-sm font-bold text-[#003b26] disabled:opacity-50"
          >
            {salvando ? "Enviando…" : "Encaminhar"}
          </button>
        </div>
      </div>
    </div>
  );
}
