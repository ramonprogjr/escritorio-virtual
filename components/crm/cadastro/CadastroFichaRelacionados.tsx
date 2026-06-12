"use client";

import Link from "next/link";

type LeadRef = { id: string; nome: string; estagio?: string | null };
type NegocioRef = { id: string; codigo?: string | null; titulo: string };

type Props = {
  leads?: LeadRef[];
  negocios?: NegocioRef[];
  variant?: "sideover" | "page";
};

export function CadastroFichaRelacionados({ leads = [], negocios = [], variant = "page" }: Props) {
  const linkProps =
    variant === "sideover" ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>LEADS</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {leads.length === 0 ? (
            <li style={{ color: "#8b949e", fontSize: 13 }}>Nenhum lead vinculado.</li>
          ) : (
            leads.map((l) => (
              <li key={l.id} style={{ padding: "8px 0", borderBottom: "1px solid #30363d" }}>
                <Link
                  href={`/crm/leads/${l.id}`}
                  style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                  {...linkProps}
                >
                  {l.nome}
                </Link>
                {l.estagio ? (
                  <span style={{ marginLeft: 8, fontSize: 11, color: "#8b949e" }}>{l.estagio}</span>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>NEGÓCIOS</p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {negocios.length === 0 ? (
            <li style={{ color: "#8b949e", fontSize: 13 }}>Nenhum negócio vinculado.</li>
          ) : (
            negocios.map((n) => (
              <li key={n.id} style={{ padding: "8px 0", borderBottom: "1px solid #30363d" }}>
                <Link
                  href={`/crm/negocios?destaque=${n.id}`}
                  style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                  {...linkProps}
                >
                  {n.codigo ? `${n.codigo} · ` : ""}
                  {n.titulo}
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
