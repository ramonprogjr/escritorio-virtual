"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { crmApiHeadersWithActor } from "@/lib/internal-api-headers-client";

type Actor = { id?: string; email?: string; name?: string };

type VinculoEmpresa = {
  vinculo_id: string;
  empresa_id: string;
  cargo: string | null;
  principal: boolean | null;
  codigo: string | null;
  razao_social: string;
  nome_fantasia: string | null;
};

type VinculoPessoa = {
  vinculo_id: string;
  pessoa_id: string;
  cargo: string | null;
  principal: boolean | null;
  codigo: string | null;
  nome: string;
};

type BuscaItem = { id: string; codigo: string | null; label: string };

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #1d3a2c",
  background: "#0f1d16",
  color: "#e6edf3",
  fontSize: 13,
  boxSizing: "border-box",
};

type Props = {
  entityType: "pessoa" | "empresa";
  entityId: string;
  actor?: Actor;
  /** sideover: links abrem em nova rota; page: navegação normal */
  variant?: "sideover" | "page";
  onVinculosChange?: () => void;
};

export function CadastroVinculosPessoaEmpresa({
  entityType,
  entityId,
  actor = {},
  variant = "page",
  onVinculosChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [empresas, setEmpresas] = useState<VinculoEmpresa[]>([]);
  const [pessoas, setPessoas] = useState<VinculoPessoa[]>([]);
  const [adicionando, setAdicionando] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<BuscaItem[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [cargo, setCargo] = useState("Representante");
  const [principal, setPrincipal] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const vinculosUrl =
    entityType === "pessoa"
      ? `/api/crm/pessoas/${encodeURIComponent(entityId)}/vinculos`
      : `/api/crm/empresas/${encodeURIComponent(entityId)}/vinculos`;

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch(vinculosUrl, { credentials: "include" });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { empresas?: VinculoEmpresa[]; pessoas?: VinculoPessoa[] };
        error?: string;
      };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar vínculos.");
        return;
      }
      if (entityType === "pessoa") {
        setEmpresas(json.data?.empresas ?? []);
      } else {
        setPessoas(json.data?.pessoas ?? []);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede.");
    } finally {
      setLoading(false);
    }
  }, [vinculosUrl, entityType]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!adicionando || busca.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        setBuscando(true);
        try {
          const q = encodeURIComponent(busca.trim());
          const endpoint =
            entityType === "pessoa"
              ? `/api/crm/empresas?q=${q}&limit=8`
              : `/api/crm/pessoas?q=${q}&limit=8`;
          const res = await fetch(endpoint, { credentials: "include" });
          const json = (await res.json().catch(() => ({}))) as {
            data?: Array<Record<string, unknown>>;
          };
          const items = (json.data ?? []).map((row) => ({
            id: String(row.id),
            codigo: row.codigo != null ? String(row.codigo) : null,
            label:
              entityType === "pessoa"
                ? String(row.razao_social ?? row.nome_fantasia ?? "—")
                : String(row.nome ?? "—"),
          }));
          setResultados(items);
        } finally {
          setBuscando(false);
        }
      })();
    }, 300);
    return () => clearTimeout(t);
  }, [busca, adicionando, entityType]);

  async function adicionarVinculo(targetId: string) {
    setSalvando(true);
    setErro("");
    try {
      const body =
        entityType === "pessoa"
          ? { pessoa_id: entityId, empresa_id: targetId, cargo, principal }
          : { pessoa_id: targetId, empresa_id: entityId, cargo, principal };
      const res = await fetch("/api/crm/vinculos/pessoa-empresa", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(await crmApiHeadersWithActor(actor)),
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao criar vínculo.");
        return;
      }
      setAdicionando(false);
      setBusca("");
      setResultados([]);
      await carregar();
      onVinculosChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(vinculoId: string) {
    if (!confirm("Remover este vínculo?")) return;
    setErro("");
    try {
      const res = await fetch(
        `/api/crm/vinculos/pessoa-empresa?id=${encodeURIComponent(vinculoId)}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: await crmApiHeadersWithActor(actor),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao remover vínculo.");
        return;
      }
      await carregar();
      onVinculosChange?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro de rede.");
    }
  }

  function linkHref(tipo: "pessoa" | "empresa", id: string) {
    return tipo === "pessoa" ? `/crm/pessoas/${id}` : `/crm/empresas/${id}`;
  }

  const lista =
    entityType === "pessoa"
      ? empresas.map((e) => ({
          vinculo_id: e.vinculo_id,
          targetId: e.empresa_id,
          targetTipo: "empresa" as const,
          codigo: e.codigo,
          titulo: e.razao_social,
          subtitulo: e.cargo,
          principal: e.principal,
        }))
      : pessoas.map((p) => ({
          vinculo_id: p.vinculo_id,
          targetId: p.pessoa_id,
          targetTipo: "pessoa" as const,
          codigo: p.codigo,
          titulo: p.nome,
          subtitulo: p.cargo,
          principal: p.principal,
        }));

  return (
    <div>
      {erro ? (
        <p style={{ color: "#f87171", fontSize: 13, margin: "0 0 12px" }} role="alert">
          {erro}
        </p>
      ) : null}

      {loading ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando vínculos…</p>
      ) : lista.length === 0 && !adicionando ? (
        <p style={{ color: "#8b949e", fontSize: 13, margin: "0 0 12px" }}>
          {entityType === "pessoa"
            ? "Nenhum vínculo com empresa."
            : "Nenhuma pessoa vinculada."}
        </p>
      ) : (
        <ul style={{ margin: "0 0 16px", padding: 0, listStyle: "none" }}>
          {lista.map((item) => (
            <li
              key={item.vinculo_id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid #1d3a2c",
              }}
            >
              <div>
                <Link
                  href={linkHref(item.targetTipo, item.targetId)}
                  style={{ color: "#c9a24a", fontWeight: 600, textDecoration: "none" }}
                  {...(variant === "sideover" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                >
                  {item.titulo}
                </Link>
                {item.subtitulo ? (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b949e" }}>{item.subtitulo}</p>
                ) : null}
                {item.principal ? (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 4,
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#c9a24a",
                      textTransform: "uppercase",
                    }}
                  >
                    Principal
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                title="Remover vínculo"
                onClick={() => void remover(item.vinculo_id)}
                style={{
                  border: "1px solid #f8514966",
                  background: "transparent",
                  color: "#f85149",
                  borderRadius: 8,
                  padding: 6,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!adicionando ? (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 8,
            border: "1px solid #1d3a2c",
            background: "#16271e",
            color: "#c9a24a",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          {entityType === "pessoa" ? "Vincular empresa" : "Vincular pessoa"}
        </button>
      ) : (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: "1px solid #1d3a2c",
            background: "#0f1d16",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <input
            style={INPUT}
            placeholder={entityType === "pessoa" ? "Buscar empresa…" : "Buscar pessoa…"}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
            <input
              style={INPUT}
              placeholder="Cargo / função"
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
            />
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                color: "#8b949e",
                whiteSpace: "nowrap",
              }}
            >
              <input
                type="checkbox"
                checked={principal}
                onChange={(e) => setPrincipal(e.target.checked)}
              />
              Principal
            </label>
          </div>
          {buscando ? (
            <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>Buscando…</p>
          ) : null}
          {resultados.length > 0 ? (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void adicionarVinculo(r.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: "transparent",
                      color: "#e6edf3",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {r.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setAdicionando(false);
              setBusca("");
              setResultados([]);
            }}
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid #1d3a2c",
              background: "transparent",
              color: "#8b949e",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
