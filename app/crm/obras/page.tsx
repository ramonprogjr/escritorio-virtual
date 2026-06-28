"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";

type Obra = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  cidade: string | null;
  estado: string | null;
};

function ObrasPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const negocioId = searchParams.get("negocio_id");
  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [titulo, setTitulo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const res = await fetch("/api/crm/obras", { headers: internalApiHeaders() });
    const json = (await res.json()) as { data?: Obra[] };
    setObras(json.data ?? []);
    setCarregando(false);
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function criar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    await fetch("/api/crm/obras", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ titulo: titulo.trim() }),
    });
    setTitulo("");
    setSalvando(false);
    void carregar();
  }

  return (
    <div style={{ padding: 24, background: "#0a140f", minHeight: "100%" }}>
      <h1 style={{ margin: "0 0 16px", color: "#e6edf3" }}>Obras</h1>

      {negocioId ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #c9a24a44",
            background: "#003b2622",
          }}
        >
          <span style={{ fontSize: 13, color: "#e6edf3" }}>
            Obras a partir de um negócio.
          </span>
          <Link
            href={`/crm/negocios/${negocioId}`}
            style={{ fontSize: 12, fontWeight: 700, color: "#c9a24a" }}
          >
            ← Voltar ao negócio
          </Link>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título da obra"
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #1d3a2c",
            background: "#0f1d16",
            color: "#e6edf3",
          }}
        />
        <button
          type="button"
          onClick={() => void criar()}
          disabled={salvando}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "#003b26",
            color: "#c9a24a",
            border: "none",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Nova obra
        </button>
      </div>

      {carregando ? (
        <p style={{ color: "#8b949e" }}>Carregando...</p>
      ) : obras.length === 0 ? (
        <EmptyState message="Nenhuma obra cadastrada." />
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {obras.map((o) => (
            <Link
              key={o.id}
              href={`/crm/obras/${o.id}`}
              style={{
                display: "block",
                padding: 14,
                borderRadius: 10,
                border: "1px solid #1d3a2c",
                background: "#0f1d16",
                textDecoration: "none",
                color: "#e6edf3",
              }}
            >
              <strong>{o.titulo}</strong>
              <span style={{ marginLeft: 8, fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
                {o.codigo}
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#8b949e" }}>
                {o.status} · {[o.cidade, o.estado].filter(Boolean).join(" / ") || "—"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ObrasPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, background: "#0a140f", minHeight: "100%", color: "#8b949e" }}>
          Carregando...
        </div>
      }
    >
      <ObrasPageInner />
    </Suspense>
  );
}
