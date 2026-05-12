"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { AgenteNovoWizard } from "@/components/crm/AgenteNovoWizard";

const SEGMENTO_COR: Record<string, string> = {
  Marketing: "#3b82f6",
  Comercial: "#10b981",
  Operações: "#f59e0b",
};

const NIVEL_COR: Record<string, string> = {
  N2: "#a855f7",
  N3: "#2dd4bf",
  N4: "#fbbf24",
};

function iniciais(nome: string): string {
  return (nome || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

type Agente = {
  agente_slug: string;
  nome: string;
  cargo: string;
  segmento?: string;
  nivel?: string;
  ativo?: boolean;
  arquivado_em?: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

type ListMode = "ativos" | "inativos" | "arquivados";

function urlParaModo(modo: ListMode): string {
  if (modo === "arquivados") return "/api/hub/agentes?arquivados=somente";
  if (modo === "inativos") return "/api/hub/agentes?ativo=false";
  return "/api/hub/agentes?ativo=true";
}

function AgentesView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const openedFromQuery = useRef(false);

  const { setSlot } = useCrmHeaderSlot();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  /** Uma lista por vez: ativos (produção), só inativos (pausados), ou só arquivados. */
  const [modoLista, setModoLista] = useState<ListMode>("ativos");
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [drawerNovoOpen, setDrawerNovoOpen] = useState(false);
  const [alternandoAtivoSlug, setAlternandoAtivoSlug] = useState<string | null>(null);

  const carregarAgentes = useCallback(() => {
    setErroLista(null);
    setCarregando(true);
    fetch(urlParaModo(modoLista), { headers: internalApiHeaders() })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          const msg =
            typeof data?.error === "string" ? data.error : `Erro ${r.status} ao carregar agentes.`;
          setErroLista(msg);
          setAgentes([]);
          return;
        }
        if (Array.isArray(data)) setAgentes(data);
        else if (Array.isArray(data?.agentes)) setAgentes(data.agentes);
        else {
          setAgentes([]);
          setErroLista("Resposta inesperada do servidor.");
        }
      })
      .catch((e: Error) => {
        setErroLista(e?.message || "Falha de rede ao carregar agentes.");
        setAgentes([]);
      })
      .finally(() => setCarregando(false));
  }, [modoLista]);

  useEffect(() => {
    carregarAgentes();
  }, [carregarAgentes]);

  useEffect(() => {
    if (openedFromQuery.current) return;
    if (searchParams.get("novo") === "1") {
      openedFromQuery.current = true;
      setDrawerNovoOpen(true);
      router.replace("/crm/agentes", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!drawerNovoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerNovoOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerNovoOpen]);

  async function alternarAtivo(agente: Agente, e: React.MouseEvent) {
    e.stopPropagation();
    if (agente.arquivado_em) return;
    const atual = agente.ativo !== false;
    const proximo = !atual;
    setAlternandoAtivoSlug(agente.agente_slug);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agente.agente_slug)}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: proximo }),
      });
      if (res.ok) {
        if (modoLista === "ativos" && proximo === false) {
          setAgentes((prev) => prev.filter((a) => a.agente_slug !== agente.agente_slug));
        } else if (modoLista === "inativos" && proximo === true) {
          setAgentes((prev) => prev.filter((a) => a.agente_slug !== agente.agente_slug));
        } else {
          setAgentes((prev) =>
            prev.map((a) =>
              a.agente_slug === agente.agente_slug ? { ...a, ativo: proximo } : a
            )
          );
        }
      }
    } finally {
      setAlternandoAtivoSlug(null);
    }
  }

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => setDrawerNovoOpen(true)}
          style={{
            background: "#003b26",
            color: "#c9a24a",
            border: "none",
            borderRadius: 8,
            padding: "10px 20px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + Novo agente
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot]);

  return (
    <>
      <div style={{ minHeight: "100vh", background: "#0d1117", padding: "24px" }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#8b949e", margin: "0 0 10px", letterSpacing: 0.5 }}>
            LISTA
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {(
              [
                { id: "ativos" as const, label: "Ativos" },
                { id: "inativos" as const, label: "Inativos" },
                { id: "arquivados" as const, label: "Arquivados" },
              ] as const
            ).map((opt) => {
              const sel = modoLista === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModoLista(opt.id)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    border: `1px solid ${sel ? "#c9a24a" : "#30363d"}`,
                    background: sel ? "#c9a24a22" : "#161b22",
                    color: sel ? "#c9a24a" : "#8b949e",
                    transition: "all 150ms",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            {!carregando && !erroLista && (
              <span style={{ fontSize: 12, color: "#6e7681", marginLeft: 8 }}>
                {agentes.length} agente{agentes.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#6e7681", margin: "12px 0 0", maxWidth: 640, lineHeight: 1.5 }}>
            <strong style={{ color: "#8b949e" }}>Inativo</strong> pausa o agente (continua no sistema).{" "}
            <strong style={{ color: "#8b949e" }}>Arquivado</strong> é para registros retirados do dia a dia após o fluxo
            de arquivamento (motivo no servidor). São estados diferentes: arquivado implica sair da operação normal;
            inativo pode voltar com um clique em Ativar.
          </p>
        </div>

        {erroLista && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "#3d1414",
              border: "1px solid #f8514966",
              color: "#f85149",
              fontSize: 13,
              whiteSpace: "pre-wrap",
            }}
          >
            {erroLista}
          </div>
        )}
        {carregando ? (
          <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
        ) : agentes.length === 0 && !erroLista ? (
          <p style={{ color: "#8b949e", fontSize: 13 }}>Nenhum agente encontrado.</p>
        ) : agentes.length === 0 ? null : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 16,
            }}
          >
            {agentes.map((agente) => {
              const arquivado = !!agente.arquivado_em;
              const segCor = SEGMENTO_COR[agente.segmento || ""] || "#8b949e";
              const nivelCor = NIVEL_COR[agente.nivel || ""] || "#8b949e";
              const nivelBg = nivelCor + "22";
              const segBg = segCor + "22";
              const ativo = agente.ativo !== false;
              const avatarUrl =
                typeof agente.avatar_url === "string" && agente.avatar_url.trim()
                  ? agente.avatar_url.trim()
                  : null;

              return (
                <div
                  key={agente.agente_slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/crm/agentes/${agente.agente_slug}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/crm/agentes/${agente.agente_slug}`);
                    }
                  }}
                  style={{
                    background: "#161b22",
                    border: "1px solid #30363d",
                    borderRadius: 12,
                    padding: 16,
                    cursor: "pointer",
                    opacity: arquivado ? 0.4 : 1,
                    transition: "border-color 150ms",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    if (!arquivado) (e.currentTarget as HTMLDivElement).style.borderColor = "#c9a24a";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLDivElement).style.borderColor = "#30363d";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: segCor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "white",
                        flexShrink: 0,
                        letterSpacing: 0.5,
                        overflow: "hidden",
                      }}
                    >
                      {avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        iniciais(agente.nome)
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          color: "#e6edf3",
                          fontWeight: 700,
                          fontSize: 14,
                          margin: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agente.nome}
                      </p>
                      <p
                        style={{
                          color: "#8b949e",
                          fontSize: 11,
                          margin: "2px 0 0",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {agente.cargo}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    {agente.segmento && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: segBg,
                          color: segCor,
                          border: `1px solid ${segCor}44`,
                        }}
                      >
                        {agente.segmento}
                      </span>
                    )}
                    {agente.nivel && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: nivelBg,
                          color: nivelCor,
                          border: `1px solid ${nivelCor}44`,
                        }}
                      >
                        {agente.nivel}
                      </span>
                    )}
                    {modoLista === "arquivados" && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 20,
                          background: "#6366f122",
                          color: "#a5b4fc",
                          border: "1px solid #6366f144",
                        }}
                      >
                        Arquivado
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: ativo ? "#003b2620" : "#b3261e20",
                        color: ativo ? "#22c55e" : "#ef4444",
                        border: `1px solid ${ativo ? "#22c55e44" : "#ef444444"}`,
                      }}
                    >
                      {ativo ? "Ativo" : "Inativo"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => alternarAtivo(agente, e)}
                      disabled={!!arquivado || alternandoAtivoSlug === agente.agente_slug}
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid #30363d",
                        background: "#21262d",
                        color: "#8b949e",
                        cursor: arquivado ? "not-allowed" : "pointer",
                        opacity: arquivado ? 0.5 : 1,
                      }}
                    >
                      {alternandoAtivoSlug === agente.agente_slug
                        ? "…"
                        : ativo
                          ? "Desativar"
                          : "Ativar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {drawerNovoOpen && (
        <>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => setDrawerNovoOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "rgba(0,0,0,0.55)",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(560px, 100vw)",
              zIndex: 50,
              background: "#0d1117",
              borderLeft: "1px solid #30363d",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <AgenteNovoWizard
              variant="drawer"
              onClose={() => setDrawerNovoOpen(false)}
              onCreated={() => carregarAgentes()}
            />
          </aside>
        </>
      )}
    </>
  );
}

export default function AgentesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", background: "#0d1117", padding: 24, color: "#8b949e" }}>
          Carregando...
        </div>
      }
    >
      <AgentesView />
    </Suspense>
  );
}
