"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Eye, RefreshCw, Settings } from "lucide-react";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { CrmCanalSideover, type CanalAgenteRow } from "@/components/crm/CrmCanalSideover";
import { EmptyState } from "@/components/crm/EmptyState";
import { FilterPills } from "@/components/crm/FilterPills";
import { SearchBar } from "@/components/crm/SearchBar";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { MODO_OPERACAO_LABEL, type ModoOperacaoAgente } from "@/lib/hub/agente-modo-operacao";

type ListMode = "todos" | "conectados" | "sem_instancia";

const FILTRO_PILLS = [
  { id: "todos", label: "Todos" },
  { id: "conectados", label: "Conectados" },
  { id: "sem_instancia", label: "Sem instância" },
] as const;

const SLUGS_CANAL_PADRAO = new Set(["atendente", "sdr", "gerente_atendimento", "diretor_geral_ia"]);

function ehCanalRelevante(a: CanalAgenteRow): boolean {
  if (a.arquivado_em) return false;
  if (a.ativo === false) return false;
  if (a.modo_operacao === "jobs_internos") return false;
  if (a.modo_operacao === "canal_whatsapp") return true;
  const id = typeof a.uazapi_instance_id === "string" ? a.uazapi_instance_id.trim() : "";
  if (id.length > 0) return true;
  // Sem coluna modo_operacao no banco: mostrar agentes de atendimento típicos
  if (a.modo_operacao == null || a.modo_operacao === "") {
    return SLUGS_CANAL_PADRAO.has(a.agente_slug);
  }
  return false;
}

function statusLabel(status?: string | null): string {
  const s = (status || "").toLowerCase();
  if (s === "connected") return "Conectado";
  if (s === "connecting") return "Conectando";
  if (s === "disconnected") return "Desconectado";
  return status?.trim() || "—";
}

function statusCores(
  status?: string | null,
  temInstancia?: boolean,
): { bg: string; fg: string; border: string } {
  if (temInstancia === false) return { bg: "#1d3a2c", fg: "#8b949e", border: "#484f58" };
  const s = (status || "").toLowerCase();
  if (s === "connected") return { bg: "#23863633", fg: "#3fb950", border: "#3fb95044" };
  if (s === "connecting") return { bg: "#bb800926", fg: "#e6c06a", border: "#bb800966" };
  // Caído / desconectado com instância: vermelho (na marca, alerta real)
  return { bg: "#f8514922", fg: "#f85149", border: "#f8514955" };
}

// Canal "caído": tem instância mas a conexão NÃO está ativa nem conectando.
function ehCanalCaido(a: CanalAgenteRow): boolean {
  const temInst = Boolean((a.uazapi_instance_id || "").trim());
  if (!temInst) return false;
  const s = (a.uazapi_connection_status || "").toLowerCase();
  return s !== "connected" && s !== "connecting";
}

export default function CanaisPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [agentes, setAgentes] = useState<CanalAgenteRow[]>([]);
  const [loadingInicial, setLoadingInicial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [modoLista, setModoLista] = useState<ListMode>("todos");
  const [sideover, setSideover] = useState<CanalAgenteRow | null>(null);

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    setErro(null);
    if (opts?.silent) setRefreshing(true);
    else setLoadingInicial(true);
    try {
      const r = await fetch("/api/hub/canais", { headers: internalApiHeaders() });
      const json: unknown = await r.json();
      if (!r.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as Record<string, unknown>).error === "string"
            ? String((json as Record<string, unknown>).error)
            : "Falha ao listar agentes.";
        throw new Error(msg);
      }
      const lista = Array.isArray(json) ? (json as CanalAgenteRow[]) : [];
      setAgentes(lista.filter(ehCanalRelevante));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar canais.");
      setAgentes([]);
    } finally {
      setLoadingInicial(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => void carregar({ silent: true })}
          disabled={refreshing || loadingInicial}
          className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold"
          style={{
            background: "#16271e",
            color: "#c9a24a",
            border: "1px solid #1d3a2c",
            cursor: refreshing || loadingInicial ? "wait" : "pointer",
          }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : undefined} />
          Atualizar
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, carregar, refreshing, loadingInicial]);

  const filtrados = useMemo(() => {
    let rows = agentes;
    if (modoLista === "conectados") {
      rows = rows.filter((a) => (a.uazapi_connection_status || "").toLowerCase() === "connected");
    } else if (modoLista === "sem_instancia") {
      rows = rows.filter((a) => !(a.uazapi_instance_id || "").trim());
    }
    const q = busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const nome = (a.nome || "").toLowerCase();
      const slug = (a.agente_slug || "").toLowerCase();
      const inst = (a.uazapi_instance_name || "").toLowerCase();
      return nome.includes(q) || slug.includes(q) || inst.includes(q);
    });
  }, [agentes, modoLista, busca]);

  const kpis = useMemo(() => {
    const conectados = agentes.filter((a) => (a.uazapi_connection_status || "").toLowerCase() === "connected").length;
    const comInstancia = agentes.filter((a) => (a.uazapi_instance_id || "").trim()).length;
    const caidos = agentes.filter(ehCanalCaido).length;
    return { total: agentes.length, conectados, comInstancia, caidos };
  }, [agentes]);

  const canaisCaidos = useMemo(() => filtrados.filter(ehCanalCaido), [filtrados]);
  const primeiroCaido = canaisCaidos[0] ?? null;

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0a140f", padding: 24 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Canais ativos", value: kpis.total, color: "#c9a24a" },
          { label: "Conectados", value: kpis.conectados, color: "#3fb950" },
          { label: "Com instância WhatsApp", value: kpis.comInstancia, color: "#93cdd4" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "#0f1d16",
              border: "1px solid #1d3a2c",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, color: "#8b949e", fontWeight: 600 }}>{k.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13, lineHeight: 1.5, maxWidth: 720 }}>
        Visão operacional: só estado da conexão. <strong style={{ color: "#c9a24a" }}>Cadastrar instância</strong> (nome,
        proxy, token WhatsApp) é na ficha do agente; <strong style={{ color: "#c9a24a" }}>QR / pareamento</strong> é um
        passo à parte, quando for ligar o WhatsApp ao telefone.
      </p>

      <div style={{ marginBottom: 12 }}>
        <SearchBar value={busca} onChange={setBusca} placeholder="Buscar por nome, slug ou instância…" />
      </div>

      <div style={{ marginBottom: 20 }}>
        <FilterPills
          pills={FILTRO_PILLS.map((p) => ({ id: p.id, label: p.label }))}
          active={modoLista}
          onChange={(id) => setModoLista(id as ListMode)}
        />
      </div>

      {erro ? (
        <div
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f8514922",
            border: "1px solid #f8514955",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={18} style={{ color: "#f85149", flexShrink: 0 }} />
          <span style={{ color: "#f85149", fontSize: 13, fontWeight: 600, flex: 1, minWidth: 180 }}>{erro}</span>
          <button
            type="button"
            onClick={() => void carregar({ silent: true })}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #f8514955",
              background: "#f8514922",
              color: "#f85149",
              fontSize: 12,
              fontWeight: 700,
              cursor: refreshing ? "wait" : "pointer",
            }}
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
            Tentar de novo
          </button>
        </div>
      ) : null}

      {!loadingInicial && !erro && primeiroCaido ? (
        <div
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: "#f8514922",
            border: "1px solid #f8514955",
            marginBottom: 16,
          }}
        >
          <AlertTriangle size={18} style={{ color: "#f85149", flexShrink: 0 }} />
          <span style={{ color: "#ffb3ad", fontSize: 13, fontWeight: 600, flex: 1, minWidth: 180 }}>
            {canaisCaidos.length === 1
              ? "1 canal desconectado — reconecte para não perder mensagens."
              : `${canaisCaidos.length} canais desconectados — reconecte para não perder mensagens.`}
          </span>
          <button
            type="button"
            onClick={() => setSideover(primeiroCaido)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #f85149",
              background: "#f85149",
              color: "#0a140f",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} />
            {canaisCaidos.length === 1 ? "Reconectar agora" : "Reconectar o 1º"}
          </button>
        </div>
      ) : null}

      {loadingInicial ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              aria-hidden
              style={{
                height: 168,
                borderRadius: 14,
                background: "#0f1d16",
                border: "1px solid #1d3a2c",
                opacity: 0.6,
                animation: "canalPulse 1.2s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <EmptyState
          message={
            modoLista === "sem_instancia"
              ? "Nenhum agente em modo WhatsApp sem instância."
              : modoLista === "conectados"
                ? "Nenhum canal conectado no momento."
                : "Nenhum canal configurado. Cadastre uma instância na ficha do agente para conectar o WhatsApp."
          }
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {filtrados.map((a) => {
            const temInst = Boolean((a.uazapi_instance_id || "").trim());
            const caido = ehCanalCaido(a);
            const st = statusCores(a.uazapi_connection_status, temInst);
            const modo =
              a.modo_operacao && a.modo_operacao in MODO_OPERACAO_LABEL
                ? MODO_OPERACAO_LABEL[a.modo_operacao as ModoOperacaoAgente]
                : a.modo_operacao || "—";
            const rotuloStatus = temInst ? statusLabel(a.uazapi_connection_status) : "Sem instância";
            const ctaReconectar = caido;
            return (
              <div
                key={a.agente_slug}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  padding: 16,
                  borderRadius: 14,
                  background: "#0f1d16",
                  border: `1px solid ${caido ? "#f8514955" : "#1d3a2c"}`,
                  boxShadow: caido ? "0 0 0 1px #f8514922" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#e6edf3",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.nome}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b949e" }}>
                      <code style={{ color: "#93cdd4", fontSize: 11 }}>{a.agente_slug}</code>
                    </p>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "4px 10px",
                      borderRadius: 20,
                      background: st.bg,
                      color: st.fg,
                      border: `1px solid ${st.border}`,
                      letterSpacing: 0.3,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.fg }} />
                    {rotuloStatus}
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <div style={{ display: "flex", gap: 8, color: "#8b949e" }}>
                    <span style={{ flexShrink: 0, minWidth: 72, fontWeight: 600 }}>Instância</span>
                    <span style={{ color: "#e6edf3", wordBreak: "break-word" }}>
                      {temInst ? a.uazapi_instance_name || a.uazapi_instance_id : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, color: "#8b949e" }}>
                    <span style={{ flexShrink: 0, minWidth: 72, fontWeight: 600 }}>Modo</span>
                    <span style={{ color: "#e6edf3", wordBreak: "break-word" }}>{modo}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                  <button
                    type="button"
                    aria-label={`${ctaReconectar ? "Reconectar" : "Configurar"} canal de ${a.nome}`}
                    onClick={() => setSideover(a)}
                    style={{
                      flex: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 7,
                      padding: "9px 12px",
                      borderRadius: 9,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: ctaReconectar ? "1px solid #f85149" : "1px solid #1d3a2c",
                      background: ctaReconectar ? "#f85149" : "#16271e",
                      color: ctaReconectar ? "#0a140f" : "#c9a24a",
                    }}
                  >
                    {ctaReconectar ? <RefreshCw size={14} /> : <Settings size={14} />}
                    {ctaReconectar ? "Reconectar" : "Configurar"}
                  </button>
                  <button
                    type="button"
                    aria-label={`Ver detalhes do canal de ${a.nome}`}
                    onClick={() => setSideover(a)}
                    style={{
                      flexShrink: 0,
                      width: 38,
                      borderRadius: 9,
                      border: "1px solid #1d3a2c",
                      background: "#16271e",
                      color: "#c9a24a",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Eye size={17} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes canalPulse {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>

      <CrmCanalSideover agente={sideover} onClose={() => setSideover(null)} />
    </div>
  );
}
