"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { RastreioCadeia } from "@/lib/crm/resolver-rastreio-codigo";
import { CrmRastreioCadeia } from "@/components/crm/CrmRastreioCadeia";

export function CrmRastreioBusca() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [cadeia, setCadeia] = useState<RastreioCadeia | null>(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const codigo = q.trim();
    if (!codigo) return;
    setLoading(true);
    setErro("");
    setCadeia(null);
    try {
      const res = await fetch(`/api/crm/rastreio?codigo=${encodeURIComponent(codigo)}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: RastreioCadeia;
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Código não encontrado.");
        return;
      }
      if (json.data) setCadeia(json.data);
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative", minWidth: 200, maxWidth: 320 }}>
      <form onSubmit={(e) => void buscar(e)} style={{ display: "flex", gap: 6 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={14}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#8b949e" }}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value.toUpperCase())}
            placeholder="Buscar por nome, empresa…"
            style={{
              width: "100%",
              padding: "7px 10px 7px 30px",
              borderRadius: 8,
              border: "1px solid #1d3a2c",
              background: "#0f1d16",
              color: "#e6edf3",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </div>
      </form>
      {(erro || cadeia) && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            width: 320,
            maxHeight: 360,
            overflow: "auto",
            padding: 12,
            borderRadius: 10,
            border: "1px solid #1d3a2c",
            background: "#0a140f",
            boxShadow: "0 8px 24px #0008",
          }}
        >
          {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>{erro}</p> : null}
          {cadeia ? (
            <>
              <CrmRastreioCadeia cadeia={cadeia} compact />
              <button
                type="button"
                onClick={() => router.push(cadeia.principal.href)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "none",
                  background: "#c9a24a",
                  color: "#003b26",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Abrir registo
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
