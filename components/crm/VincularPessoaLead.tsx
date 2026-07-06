"use client";

import { useCallback, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type PessoaBusca = { id: string; nome: string };

/**
 * A4 (auditoria whole-system): a ficha do lead SEM pessoa era beco sem saída — dizia
 * "vincule um contato existente" mas NÃO tinha botão. Este picker busca uma pessoa e
 * grava `pessoa_id` no lead (PATCH /api/crm/leads/[id], que já aceita pessoa_id).
 * Espelha o "Vincular" da ficha do negócio.
 */
export function VincularPessoaLead({ leadId }: { leadId: string }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<PessoaBusca[]>([]);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(async (q: string) => {
    setBusca(q);
    if (q.trim().length < 2) {
      setResultados([]);
      return;
    }
    try {
      const res = await fetch(`/api/crm/pessoas?busca=${encodeURIComponent(q.trim())}&limit=8`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: PessoaBusca[] };
      setResultados(Array.isArray(json.data) ? json.data : []);
    } catch {
      setResultados([]);
    }
  }, []);

  async function vincular(pessoaId: string) {
    setSalvando(true);
    try {
      const res = await fetch(`/api/crm/leads/${encodeURIComponent(leadId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ pessoa_id: pessoaId }),
      });
      if (res.ok) {
        // Vínculo é ação rara; recarrega p/ a ficha refletir a pessoa em toda a tela.
        window.location.reload();
        return;
      }
    } catch {
      /* mantém o picker aberto p/ nova tentativa */
    }
    setSalvando(false);
  }

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="mt-2 rounded px-3 py-1.5 text-xs font-bold"
        style={{ background: "#003b26", color: "#c9a24a", border: "none", cursor: "pointer" }}
      >
        + Vincular contato
      </button>
    );
  }

  return (
    <div className="mt-2 max-w-sm">
      <input
        value={busca}
        onChange={(e) => void buscar(e.target.value)}
        placeholder="Buscar pessoa por nome ou telefone…"
        autoFocus
        disabled={salvando}
        className="w-full rounded px-2 py-1.5 text-xs"
        style={{ border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3" }}
      />
      {resultados.length > 0 ? (
        <div className="mt-1 overflow-hidden rounded" style={{ border: "1px solid #1d3a2c" }}>
          {resultados.map((p, i) => (
            <button
              key={p.id}
              type="button"
              disabled={salvando}
              onClick={() => void vincular(p.id)}
              className="block w-full px-2.5 py-2 text-left text-xs"
              style={{
                border: "none",
                borderTop: i ? "1px solid #16271e" : "none",
                background: "transparent",
                color: "#e6edf3",
                cursor: salvando ? "default" : "pointer",
              }}
            >
              {p.nome}
            </button>
          ))}
        </div>
      ) : busca.trim().length >= 2 ? (
        <p className="mt-1 text-[11px]" style={{ color: "#8b949e" }}>Nenhuma pessoa encontrada.</p>
      ) : null}
    </div>
  );
}
