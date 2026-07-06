"use client";

import { useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * RDO básico — cria um registro de diário de obra (resumo + clima). Antes a aba "Diário
 * de obra" só LIA (ninguém escrevia). Campos ricos (efetivo/atividades/fotos/ficha) vêm
 * com a janela do dono (docs/JANELA-STORAGE-LOGS-NF.md).
 */
export function ObraDiarioForm({ obraId }: { obraId: string }) {
  const [aberto, setAberto] = useState(false);
  const [resumo, setResumo] = useState("");
  const [clima, setClima] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!resumo.trim()) return;
    setSalvando(true);
    setErro("");
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/diario`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ resumo: resumo.trim(), clima: clima.trim() || null }),
      });
      if (res.ok) {
        // Recarrega p/ a lista do diário refletir o novo registro.
        window.location.reload();
        return;
      }
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErro(j.error || "Não foi possível salvar.");
    } catch {
      setErro("Erro de rede.");
    }
    setSalvando(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mb-3 rounded px-3 py-1.5 text-xs font-bold"
        style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
      >
        + Novo registro
      </button>
    );
  }

  return (
    <div className="mb-3 flex flex-col gap-2">
      <textarea
        value={resumo}
        onChange={(e) => setResumo(e.target.value)}
        rows={3}
        autoFocus
        placeholder="Resumo do dia — o que foi feito, quem esteve, ocorrências…"
        className="rounded px-2 py-1.5 text-xs"
        style={{ border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", resize: "vertical" }}
      />
      <input
        value={clima}
        onChange={(e) => setClima(e.target.value)}
        placeholder="Clima (opcional): sol, chuva, garoa…"
        className="rounded px-2 py-1.5 text-xs"
        style={{ border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3" }}
      />
      {erro ? <p className="text-[11px]" style={{ color: "#f87171" }}>{erro}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={salvando || !resumo.trim()}
          onClick={() => void salvar()}
          className="rounded px-3 py-1.5 text-xs font-bold"
          style={{ background: "#c9a24a", color: "#003b26", border: "none", cursor: "pointer", opacity: salvando || !resumo.trim() ? 0.6 : 1 }}
        >
          {salvando ? "Salvando…" : "Salvar registro"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded px-3 py-1.5 text-xs"
          style={{ background: "transparent", color: "#8b949e", border: "1px solid #1d3a2c", cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
