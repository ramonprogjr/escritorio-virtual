"use client";

import { useCallback, useEffect, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Props = {
  agenteSlug: string;
};

export function AgenteIaWhatsappPauseToggle({ agenteSlug }: Props) {
  const [pausada, setPausada] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    if (!agenteSlug) return;
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/ia-whatsapp`, {
        headers: internalApiHeaders(),
      });
      const d = (await r.json().catch(() => ({}))) as { pausada?: boolean; error?: string };
      if (!r.ok) {
        setErro(d.error ?? "Não foi possível carregar estado da IA");
        return;
      }
      setPausada(d.pausada === true);
    } finally {
      setCarregando(false);
    }
  }, [agenteSlug]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function toggle() {
    setSalvando(true);
    setErro("");
    try {
      const r = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/ia-whatsapp`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ pausada: !pausada, por: "crm" }),
      });
      const d = (await r.json().catch(() => ({}))) as { pausada?: boolean; error?: string };
      if (!r.ok) {
        setErro(d.error ?? "Falha ao atualizar");
        return;
      }
      setPausada(d.pausada === true);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        borderRadius: 10,
        border: "1px solid #30363d",
        background: pausada ? "#451a0322" : "#161b22",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ margin: 0, color: "#e6edf3", fontSize: 13, fontWeight: 700 }}>
            {pausada ? "Linha em modo manual" : "IA WhatsApp ativa"}
          </p>
          <p style={{ margin: "4px 0 0", color: "#8b949e", fontSize: 11, lineHeight: 1.45 }}>
            Equivalente a <code style={{ fontSize: 10 }}>/ia-off</code> e <code style={{ fontSize: 10 }}>/ia-on</code>.
            Operadores também podem controlar pelo WhatsApp — ver docs/comandos-whatsapp-ia.md
          </p>
        </div>
        <button
          type="button"
          onClick={() => void toggle()}
          disabled={carregando || salvando}
          style={{
            padding: "8px 14px",
            borderRadius: 8,
            border: "none",
            cursor: carregando || salvando ? "not-allowed" : "pointer",
            background: pausada ? "#22c55e" : "#ef4444",
            color: "#0d1117",
            fontWeight: 700,
            fontSize: 12,
            opacity: carregando || salvando ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {salvando ? "…" : pausada ? "Reativar IA" : "Pausar linha"}
        </button>
      </div>
      {erro ? (
        <p style={{ margin: "8px 0 0", color: "#f87171", fontSize: 11 }}>{erro}</p>
      ) : null}
    </div>
  );
}
