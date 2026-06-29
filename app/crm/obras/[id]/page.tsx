"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { ObraItensSecao } from "@/components/crm/obras/ObraItensSecao";
import { ObraComprasEstoqueSecao } from "@/components/crm/obras/ObraComprasEstoqueSecao";

type ObraPainel = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const DOURADO = "#c9a24a";

type Aba = "painel" | "itens" | "compras";

export default function ObraPainelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obra, setObra] = useState<ObraPainel | null>(null);
  const [pedidos, setPedidos] = useState<Record<string, unknown>[]>([]);
  const [checkins, setCheckins] = useState<Record<string, unknown>[]>([]);
  const [diario, setDiario] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<Aba>("itens"); // o JOB do gestor: itens & avanço primeiro

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/crm/obras/${encodeURIComponent(id)}`, {
      headers: internalApiHeaders(),
    });
    const json = (await res.json()) as {
      data?: ObraPainel;
      pedidos?: Record<string, unknown>[];
      checkins?: Record<string, unknown>[];
      diario?: Record<string, unknown>[];
    };
    setObra(json.data ?? null);
    setPedidos(json.pedidos ?? []);
    setCheckins(json.checkins ?? []);
    setDiario(json.diario ?? []);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!obra) {
    return <p style={{ padding: 24, color: "#8b949e" }}>Carregando painel da obra…</p>;
  }

  return (
    <div style={{ padding: 24, color: "#e6edf3", maxWidth: 960 }}>
      <button type="button" onClick={() => router.push("/crm/obras")} style={{ color: "#8b949e", marginBottom: 16 }}>
        ← Obras
      </button>
      <h1 style={{ margin: 0 }}>{obra.titulo}</h1>
      <p style={{ color: "#8b949e", fontFamily: "monospace" }}>{obra.codigo} · {obra.status}</p>
      <p style={{ marginTop: 8, fontSize: 14 }}>
        {[obra.endereco, obra.cidade, obra.estado].filter(Boolean).join(" — ") || "Endereço não informado"}
      </p>

      {/* Abas: Itens & Avanço (E2) | Painel (pedidos/check-ins/diário) */}
      <div
        role="tablist"
        aria-label="Seções da obra"
        style={{ display: "flex", gap: 4, marginTop: 24, marginBottom: 16, borderBottom: `1px solid ${BORDA}` }}
      >
        {([
          { id: "itens", rotulo: "Itens & Avanço" },
          { id: "compras", rotulo: "Compras & Estoque" },
          { id: "painel", rotulo: "Painel" },
        ] as const).map(({ id: tabId, rotulo }) => {
          const ativo = aba === tabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setAba(tabId)}
              style={{
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: ativo ? "#f0c869" : "#8aa99a",
                background: "transparent",
                border: "none",
                borderBottom: ativo ? `2px solid ${DOURADO}` : "2px solid transparent",
                cursor: "pointer",
              }}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {aba === "itens" ? (
        <ObraItensSecao obraId={id} />
      ) : aba === "compras" ? (
        <ObraComprasEstoqueSecao obraId={id} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <section style={{ background: BG_CARD, borderRadius: 10, padding: 16, border: `1px solid ${BORDA}` }}>
            <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Pedidos de material</h2>
            {pedidos.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8b949e" }}>Nenhum pedido.</p>
            ) : (
              pedidos.map((p) => (
                <p key={String(p.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                  {String(p.descricao)} — {String(p.status)}
                </p>
              ))
            )}
          </section>
          <section style={{ background: BG_CARD, borderRadius: 10, padding: 16, border: `1px solid ${BORDA}` }}>
            <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Check-ins</h2>
            {checkins.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8b949e" }}>Nenhum check-in.</p>
            ) : (
              checkins.map((c) => (
                <p key={String(c.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                  {String(c.tipo)} — {new Date(String(c.criado_em)).toLocaleString("pt-BR")}
                </p>
              ))
            )}
          </section>
          <section style={{ background: BG_CARD, borderRadius: 10, padding: 16, border: `1px solid ${BORDA}` }}>
            <h2 style={{ fontSize: 14, margin: "0 0 12px" }}>Diário de obra</h2>
            {diario.length === 0 ? (
              <p style={{ fontSize: 12, color: "#8b949e" }}>Sem registros.</p>
            ) : (
              diario.map((d) => (
                <p key={String(d.id)} style={{ fontSize: 12, margin: "6px 0" }}>
                  {String(d.resumo).slice(0, 80)}
                </p>
              ))
            )}
          </section>
        </div>
      )}
    </div>
  );
}
