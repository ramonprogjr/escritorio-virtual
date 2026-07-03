"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import type { RastreioCadeia } from "@/lib/crm/resolver-rastreio-codigo";
import type { RastreioBuscaResultado } from "@/lib/crm/rastreio-busca";
import { CrmRastreioCadeia } from "@/components/crm/CrmRastreioCadeia";

export function CrmRastreioBusca() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [cadeia, setCadeia] = useState<RastreioCadeia | null>(null);
  const [resultados, setResultados] = useState<RastreioBuscaResultado[] | null>(null);

  function fechar() {
    setErro("");
    setCadeia(null);
    setResultados(null);
  }

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    const termo = q.trim();
    if (!termo) return;
    setLoading(true);
    fechar();
    try {
      // Busca por NOME (o usuário chama tudo pelo nome). Se for um código, o backend
      // resolve a cadeia mesmo assim e devolve `data`.
      const res = await fetch(`/api/crm/rastreio?q=${encodeURIComponent(termo)}`, {
        credentials: "include",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: RastreioCadeia;
        resultados?: RastreioBuscaResultado[];
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Nada encontrado.");
        return;
      }
      if (json.data) {
        setCadeia(json.data);
      } else if (json.resultados && json.resultados.length > 0) {
        setResultados(json.resultados);
      } else {
        setErro("Nenhum resultado para essa busca.");
      }
    } catch {
      setErro("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  function abrir(href: string) {
    fechar();
    setQ("");
    router.push(href);
  }

  const aberto = Boolean(erro || cadeia || resultados);

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
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, empresa…"
            aria-label="Buscar por nome ou empresa"
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
      {aberto && (
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
                onClick={() => abrir(cadeia.principal.href)}
                style={botaoOuro}
              >
                Abrir registo
              </button>
            </>
          ) : null}

          {resultados ? (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
              {resultados.map((r) => (
                <li key={`${r.tipo}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => abrir(r.href)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid transparent",
                      background: "transparent",
                      color: "#e6edf3",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.background = "#0f1d16")}
                    onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{r.titulo}</span>
                    <span style={{ display: "block", fontSize: 11, color: "#8b949e" }}>{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {loading ? <p style={{ margin: "6px 0 0", fontSize: 11, color: "#8b949e" }}>Buscando…</p> : null}
        </div>
      )}
    </div>
  );
}

const botaoOuro: React.CSSProperties = {
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
};
