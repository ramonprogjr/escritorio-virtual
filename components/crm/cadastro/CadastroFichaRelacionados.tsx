"use client";

import Link from "next/link";

/**
 * Item de relacionamento exibido SOMENTE por nome (código NUNCA aparece — regra do dono:
 * códigos de IDENTIDADE são internos). Aceita `nome` OU `titulo` como rótulo e `sub` OU
 * `estagio` como legenda secundária, mantendo compat com os chamadores antigos que passavam
 * `{ id, titulo }` (negócios) e `{ id, nome, estagio }` (leads).
 */
type RelItem = {
  id: string;
  nome?: string | null;
  titulo?: string | null;
  sub?: string | null;
  estagio?: string | null;
  // aceito na entrada por compat, mas DELIBERADAMENTE nunca renderizado.
  codigo?: string | null;
};

type Props = {
  pessoas?: RelItem[];
  empresas?: RelItem[];
  leads?: RelItem[];
  negocios?: RelItem[];
  obras?: RelItem[];
  projetos?: RelItem[];
  variant?: "sideover" | "page";
};

function nomeDe(item: RelItem): string {
  return (item.nome ?? item.titulo ?? "—") || "—";
}

function subDe(item: RelItem): string | null {
  return item.sub ?? item.estagio ?? null;
}

/** Uma seção (título + lista de itens name-only). Reaproveitada por todos os grupos. */
function Secao({
  titulo,
  itens,
  hrefFn,
  linkProps,
}: {
  titulo: string;
  itens: RelItem[];
  hrefFn: (id: string) => string;
  linkProps: Record<string, unknown>;
}) {
  return (
    <div>
      <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#8b949e" }}>{titulo}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {itens.map((item) => {
          const sub = subDe(item);
          return (
            <li key={item.id} style={{ padding: "8px 0", borderBottom: "1px solid #1d3a2c" }}>
              <Link
                href={hrefFn(item.id)}
                style={{ color: "#c9a24a", textDecoration: "none", fontWeight: 600 }}
                {...linkProps}
              >
                {nomeDe(item)}
              </Link>
              {sub ? (
                <span style={{ marginLeft: 8, fontSize: 11, color: "#8b949e" }}>{sub}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CadastroFichaRelacionados({
  pessoas = [],
  empresas = [],
  leads = [],
  negocios = [],
  obras = [],
  projetos = [],
  variant = "page",
}: Props) {
  const linkProps =
    variant === "sideover" ? { target: "_blank" as const, rel: "noopener noreferrer" } : {};

  // Ordem canônica: Pessoas · Empresas · Leads · Negócios · Obras · Projetos.
  const grupos: Array<{ titulo: string; itens: RelItem[]; hrefFn: (id: string) => string }> = [
    { titulo: "PESSOAS", itens: pessoas, hrefFn: (id) => `/crm/pessoas/${id}` },
    { titulo: "EMPRESAS", itens: empresas, hrefFn: (id) => `/crm/empresas/${id}` },
    { titulo: "LEADS", itens: leads, hrefFn: (id) => `/crm/leads/${id}` },
    { titulo: "NEGÓCIOS", itens: negocios, hrefFn: (id) => `/crm/negocios/${id}` },
    { titulo: "OBRAS", itens: obras, hrefFn: (id) => `/crm/obras/${id}` },
    { titulo: "PROJETOS", itens: projetos, hrefFn: (id) => `/crm/arquitetura/${id}` },
  ];

  const visiveis = grupos.filter((g) => g.itens.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {visiveis.length === 0 ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum relacionamento encontrado.</p>
      ) : (
        visiveis.map((g) => (
          <Secao
            key={g.titulo}
            titulo={g.titulo}
            itens={g.itens}
            hrefFn={g.hrefFn}
            linkProps={linkProps}
          />
        ))
      )}
    </div>
  );
}
