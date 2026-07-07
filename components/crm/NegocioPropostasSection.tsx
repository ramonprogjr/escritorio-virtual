"use client";

import { propostaStatusCor, propostaStatusLabel } from "@/lib/crm/proposta-status";

/**
 * Propostas ligadas ao NEGÓCIO (read-only). Já vêm no GET de /api/crm/negocios/[id]
 * (hub_propostas por negocio_id) — antes a ficha do negócio as DESCARTAVA (só o lead
 * mostrava proposta). Aqui é a visão consolidada na espinha. Criar proposta segue na
 * ficha do lead de origem (LeadPropostasPanel). Cor/rótulo do módulo compartilhado.
 */
export type NegocioProposta = {
  id: string;
  titulo: string;
  valor: number;
  status: string;
  criado_em: string;
};

export function NegocioPropostasSection({ propostas }: { propostas: NegocioProposta[] }) {
  const total = propostas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  return (
    <div
      style={{
        marginTop: 16,
        padding: 14,
        borderRadius: 10,
        border: "1px solid rgba(48,54,61,0.38)",
        background: "rgba(8,12,20,0.55)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7d8a99" }}>
          Propostas
        </p>
        {propostas.length > 0 ? (
          <span style={{ fontSize: 11, color: "#8b949e", fontVariantNumeric: "tabular-nums" }}>
            {propostas.length} · total R$ {total.toLocaleString("pt-BR")}
          </span>
        ) : null}
      </div>
      {propostas.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>
          Nenhuma proposta ligada a este negócio. A proposta é criada na ficha do lead de origem.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
          {propostas.map((p) => (
            <li
              key={p.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "#e6edf3" }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.titulo || "—"}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                <span style={{ color: "#c9a24a", fontWeight: 700 }}>R$ {Number(p.valor).toLocaleString("pt-BR")}</span>
                <span style={{ fontSize: 11, color: propostaStatusCor(p.status) }}>
                  {propostaStatusLabel(p.status)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
