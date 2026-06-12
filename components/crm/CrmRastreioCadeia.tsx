"use client";

import Link from "next/link";
import type { RastreioCadeia } from "@/lib/crm/resolver-rastreio-codigo";

type Props = {
  cadeia: RastreioCadeia;
  compact?: boolean;
};

function NoRow({ node }: { node: RastreioCadeia["principal"] }) {
  return (
    <li style={{ padding: "8px 0", borderBottom: "1px solid #30363d" }}>
      <Link href={node.href} style={{ color: "#c9a24a", fontWeight: 600, textDecoration: "none" }}>
        {node.codigo ? `${node.codigo} · ` : ""}
        {node.titulo}
      </Link>
      <span style={{ marginLeft: 8, fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>
        {node.tipo}
      </span>
    </li>
  );
}

export function CrmRastreioCadeia({ cadeia, compact }: Props) {
  return (
    <div
      style={{
        padding: compact ? 0 : 14,
        borderRadius: compact ? 0 : 10,
        border: compact ? "none" : "1px solid #30363d",
        background: compact ? "transparent" : "#161b22",
      }}
    >
      {!compact ? (
        <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>
          RASTREIO · {cadeia.codigo}
        </p>
      ) : null}
      <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8b949e" }}>Principal</p>
      <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
        <NoRow node={cadeia.principal} />
      </ul>
      {cadeia.vinculos.length > 0 ? (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8b949e" }}>Vínculos</p>
          <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
            {cadeia.vinculos.map((n) => (
              <NoRow key={`${n.tipo}-${n.id}`} node={n} />
            ))}
          </ul>
        </>
      ) : null}
      {cadeia.negocios.length > 0 ? (
        <>
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 700, color: "#8b949e" }}>Negócios</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {cadeia.negocios.map((n) => (
              <NoRow key={`neg-${n.id}`} node={n} />
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
