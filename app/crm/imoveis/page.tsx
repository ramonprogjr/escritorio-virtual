"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Building2, MapPin, BedDouble, Maximize2, LayoutGrid, Table2, Check, ChevronDown } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { KpiBar } from "@/components/crm/KpiBar";
import { SearchBar } from "@/components/crm/SearchBar";
import { FilterPills } from "@/components/crm/FilterPills";
import { EmptyState } from "@/components/crm/EmptyState";
import { ImovelFormDrawer } from "@/components/crm/ImovelFormDrawer";

const LIMIT = 20;

type Imovel = {
  id: string;
  codigo: string | null;
  titulo: string | null;
  tipo: string | null;
  finalidade: string | null;
  status: string | null;
  valor: number | null;
  cidade: string | null;
  estado: string | null;
  bairro: string | null;
  dormitorios: number | null;
  banheiros: number | null;
  vagas: number | null;
  area_total_m2: number | null;
  metadata: Record<string, unknown> | null;
  ativo: boolean | null;
  criado_em: string | null;
};

const FINALIDADE_PILLS = [
  { id: "", label: "Todos" },
  { id: "venda", label: "Venda" },
  { id: "locacao", label: "Locação" },
];

function formatCurrency(val: number | null): string {
  if (val === null || val === undefined) return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}

/** Cor de status na marca (verde/dourado/âmbar/neutro) — NUNCA azul. */
const STATUS_COR: Record<string, { bg: string; color: string; border: string }> = {
  captacao: { bg: "#c9a24a22", color: "#c9a24a", border: "#c9a24a55" },
  disponivel: { bg: "#22c55e22", color: "#4ade80", border: "#22c55e55" },
  reservado: { bg: "#f59e0b22", color: "#fbbf24", border: "#f59e0b55" },
  vendido: { bg: "#2f9e8f22", color: "#2f9e8f", border: "#2f9e8f55" },
  alugado: { bg: "#b58a6322", color: "#c9a98a", border: "#b58a6355" },
  inativo: { bg: "#8b949e22", color: "#8b949e", border: "#8b949e55" },
};

const STATUS_LABEL: Record<string, string> = {
  captacao: "Captação",
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  inativo: "Inativo",
};

/** Status editáveis inline — restritos ao CHECK do schema (hub_imoveis). */
const STATUS_EDITAVEIS = ["captacao", "disponivel", "reservado", "vendido", "inativo"];

function statusStyle(status: string | null) {
  return STATUS_COR[status || ""] ?? { bg: "#8b949e22", color: "#8b949e", border: "#8b949e55" };
}

/** Foto de capa vinda de metadata (read-only; schema inalterado). */
function fotoCapa(im: Imovel): string | null {
  const m = im.metadata;
  if (!m || typeof m !== "object") return null;
  for (const k of ["foto_capa", "foto_url", "imagem_capa", "foto", "imagem", "capa"]) {
    const v = (m as Record<string, unknown>)[k];
    if (typeof v === "string" && v.trim().startsWith("http")) return v.trim();
  }
  const fotos = (m as Record<string, unknown>).fotos;
  if (Array.isArray(fotos) && typeof fotos[0] === "string" && fotos[0].startsWith("http")) return fotos[0];
  return null;
}

const TH: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  color: "#8b949e",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
  borderBottom: "1px solid #1d3a2c",
};

const TD: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  color: "#e6edf3",
  whiteSpace: "nowrap",
};

export default function ImoveisPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [total, setTotal] = useState(0);
  const [finCounts, setFinCounts] = useState<{ venda: number; locacao: number }>({ venda: 0, locacao: 0 });
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [finalidade, setFinalidade] = useState("");
  const [offset, setOffset] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [editImovel, setEditImovel] = useState<Imovel | null>(null);
  const [vista, setVista] = useState<"cards" | "tabela">("cards");
  const [statusEditId, setStatusEditId] = useState<string | null>(null);
  const [salvandoStatus, setSalvandoStatus] = useState<string | null>(null);

  function buscarLista() {
    setCarregando(true);
    setErro(null);
    const p = new URLSearchParams({ offset: "0", ativo: String(ativo) });
    if (busca) p.set("busca", busca);
    if (finalidade) p.set("finalidade", finalidade);

    fetch(`/api/crm/imoveis?${p}`, { headers: internalApiHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d?.error || `Erro ${r.status}`);
        return d;
      })
      .then((d) => {
        setImoveis(d.data ?? []);
        setTotal(d.total ?? 0);
        setFinCounts(d.finalidade_counts ?? { venda: 0, locacao: 0 });
        setOffset(LIMIT);
      })
      .catch((e: Error) => setErro(e?.message || "Falha ao carregar imóveis."))
      .finally(() => setCarregando(false));
  }

  useEffect(() => {
    buscarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, ativo, finalidade]);

  function carregarMais() {
    setCarregandoMais(true);
    const p = new URLSearchParams({ offset: String(offset), ativo: String(ativo) });
    if (busca) p.set("busca", busca);
    if (finalidade) p.set("finalidade", finalidade);

    fetch(`/api/crm/imoveis?${p}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d) => {
        setImoveis((prev) => [...prev, ...(d.data ?? [])]);
        setOffset((prev) => prev + LIMIT);
      })
      .catch(() => {})
      .finally(() => setCarregandoMais(false));
  }

  async function alterarStatus(im: Imovel, novo: string) {
    setStatusEditId(null);
    if (novo === im.status) return;
    setSalvandoStatus(im.id);
    const anterior = im.status;
    setImoveis((prev) => prev.map((x) => (x.id === im.id ? { ...x, status: novo } : x)));
    try {
      const res = await fetch(`/api/crm/imoveis/${im.id}`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) {
        setImoveis((prev) => prev.map((x) => (x.id === im.id ? { ...x, status: anterior } : x)));
      }
    } catch {
      setImoveis((prev) => prev.map((x) => (x.id === im.id ? { ...x, status: anterior } : x)));
    } finally {
      setSalvandoStatus(null);
    }
  }

  const vendaCount = finCounts.venda;
  const locacaoCount = finCounts.locacao;
  const temMais = imoveis.length < total;

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: (
        <button
          type="button"
          onClick={() => setDrawerAberto(true)}
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
          + Novo
        </button>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot]);

  function recarregar() {
    setOffset(0);
    buscarLista();
  }

  function abrirEdicao(im: Imovel) {
    setEditImovel(im);
    setDrawerAberto(true);
  }

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "#0a140f", padding: "24px" }}>
      <ImovelFormDrawer
        open={drawerAberto}
        onClose={() => { setDrawerAberto(false); setEditImovel(null); }}
        onSaved={recarregar}
        initial={
          editImovel
            ? {
                id: editImovel.id,
                titulo: editImovel.titulo ?? "",
                cidade: editImovel.cidade,
                estado: editImovel.estado,
                valor: editImovel.valor,
                tipo: editImovel.tipo ?? undefined,
                finalidade: editImovel.finalidade ?? undefined,
                ativo: editImovel.ativo !== false,
              }
            : null
        }
      />
      {/* KPI Bar */}
      <KpiBar kpis={[
        { label: "Total", value: total, color: "#c9a24a" },
        { label: "Venda", value: vendaCount, color: "#2f9e8f" },
        { label: "Locação", value: locacaoCount, color: "#b58a63" },
      ]} />

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <SearchBar
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por título, cidade ou bairro..."
        />
      </div>

      {/* Ativos / Arquivados tab + toggle de vista */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottom: "1px solid #1d3a2c", marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex" }}>
          {[
            { id: true, label: "Ativos" },
            { id: false, label: "Arquivados" },
          ].map((tab) => (
            <button
              key={String(tab.id)}
              onClick={() => setAtivo(tab.id)}
              style={{
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: "none",
                border: "none",
                borderBottom: ativo === tab.id ? "2px solid #c9a24a" : "2px solid transparent",
                color: ativo === tab.id ? "#c9a24a" : "#8b949e",
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 4, paddingBottom: 6 }} role="group" aria-label="Modo de exibição">
          {([
            { id: "cards" as const, label: "Cards", Icon: LayoutGrid },
            { id: "tabela" as const, label: "Tabela", Icon: Table2 },
          ]).map((v) => {
            const sel = vista === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                aria-pressed={sel}
                title={`Ver em ${v.label.toLowerCase()}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  border: `1px solid ${sel ? "#c9a24a66" : "#1d3a2c"}`,
                  background: sel ? "#c9a24a1f" : "#0f1d16",
                  color: sel ? "#d6b976" : "#8b949e",
                }}
              >
                <v.Icon size={14} strokeWidth={2.25} aria-hidden />
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Pills */}
      <div style={{ marginBottom: 20 }}>
        <FilterPills pills={FINALIDADE_PILLS} active={finalidade} onChange={setFinalidade} />
      </div>

      {/* Content */}
      {erro ? (
        <div style={{ padding: 14, borderRadius: 10, background: "#3d1414", border: "1px solid #f8514966", color: "#f85149", fontSize: 13 }}>
          {erro}
          <button
            onClick={recarregar}
            style={{ marginLeft: 12, padding: "4px 12px", borderRadius: 6, background: "#0f1d16", border: "1px solid #1d3a2c", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </div>
      ) : carregando ? (
        vista === "cards" ? <CardsSkeleton /> : <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando...</p>
      ) : imoveis.length === 0 ? (
        <EmptyState message={ativo ? "Nenhum imóvel cadastrado." : "Nenhum imóvel arquivado."} />
      ) : vista === "cards" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {imoveis.map((im) => {
              const st = statusStyle(im.status);
              const foto = fotoCapa(im);
              const editandoStatus = statusEditId === im.id;
              const finVenda = im.finalidade === "venda";
              const finLoc = im.finalidade === "locacao";
              return (
                <article
                  key={im.id}
                  style={{
                    background: "rgba(17, 28, 22, 0.82)",
                    border: "1px solid rgba(201, 162, 74, 0.22)",
                    borderRadius: 16,
                    overflow: "hidden",
                    boxShadow: "0 0 20px rgba(201, 162, 74, 0.08), 0 8px 24px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Foto de capa */}
                  <button
                    type="button"
                    onClick={() => abrirEdicao(im)}
                    title="Abrir imóvel"
                    style={{
                      position: "relative",
                      height: 160,
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      background: foto
                        ? `center/cover no-repeat url("${foto}")`
                        : "linear-gradient(135deg, #0d2419 0%, #103024 60%, #0a1c14 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {!foto && (
                      <Building2 size={40} strokeWidth={1.5} color="#c9a24a55" aria-hidden />
                    )}
                    {/* Finalidade pill (sobre a foto) */}
                    {im.finalidade && (
                      <span
                        style={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.4,
                          padding: "3px 10px",
                          borderRadius: 999,
                          textTransform: "uppercase",
                          background: finVenda ? "#2f9e8fdd" : finLoc ? "#b58a63dd" : "#0a140fcc",
                          color: "#fff",
                          backdropFilter: "blur(4px)",
                        }}
                      >
                        {finVenda ? "Venda" : finLoc ? "Locação" : "Ambos"}
                      </span>
                    )}
                    {/* Preço sobre a foto */}
                    <span
                      style={{
                        position: "absolute",
                        bottom: 10,
                        left: 10,
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#f5e6c0",
                        textShadow: "0 1px 6px rgba(0,0,0,0.85)",
                      }}
                    >
                      {formatCurrency(im.valor)}
                    </span>
                  </button>

                  {/* Corpo */}
                  <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    <button
                      type="button"
                      onClick={() => abrirEdicao(im)}
                      style={{
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                        color: "#f8fafc",
                        fontWeight: 700,
                        fontSize: 15,
                        lineHeight: 1.3,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {im.titulo || "Sem título"}
                    </button>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#8b949e", fontSize: 12 }}>
                      <MapPin size={13} strokeWidth={2} aria-hidden style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {im.cidade
                          ? `${im.cidade}${im.estado ? `/${im.estado}` : ""}${im.bairro ? ` · ${im.bairro}` : ""}`
                          : "Localização não informada"}
                      </span>
                    </div>

                    {/* Atributos */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, color: "#7d8a82", fontSize: 12 }}>
                      {im.tipo && <span style={{ textTransform: "capitalize", color: "#c9a98a" }}>{im.tipo}</span>}
                      {im.dormitorios != null && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <BedDouble size={13} aria-hidden /> {im.dormitorios}
                        </span>
                      )}
                      {im.area_total_m2 != null && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Maximize2 size={12} aria-hidden /> {im.area_total_m2}m²
                        </span>
                      )}
                    </div>

                    {/* Status editável inline */}
                    <div style={{ marginTop: "auto", paddingTop: 8, position: "relative" }}>
                      {ativo ? (
                        <button
                          type="button"
                          onClick={() => setStatusEditId(editandoStatus ? null : im.id)}
                          disabled={salvandoStatus === im.id}
                          aria-haspopup="listbox"
                          aria-expanded={editandoStatus}
                          title="Alterar status"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                            cursor: salvandoStatus === im.id ? "wait" : "pointer",
                          }}
                        >
                          {salvandoStatus === im.id ? "Salvando…" : STATUS_LABEL[im.status || ""] ?? im.status ?? "Sem status"}
                          <ChevronDown size={12} strokeWidth={2.5} aria-hidden />
                        </button>
                      ) : (
                        <span
                          style={{
                            display: "inline-flex",
                            fontSize: 11,
                            fontWeight: 700,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          {STATUS_LABEL[im.status || ""] ?? im.status ?? "Sem status"}
                        </span>
                      )}

                      {editandoStatus && (
                        <>
                          <button
                            type="button"
                            aria-label="Fechar menu de status"
                            onClick={() => setStatusEditId(null)}
                            style={{ position: "fixed", inset: 0, zIndex: 20, background: "transparent", border: "none", cursor: "default" }}
                          />
                          <ul
                            role="listbox"
                            style={{
                              position: "absolute",
                              bottom: "calc(100% + 6px)",
                              left: 0,
                              zIndex: 21,
                              listStyle: "none",
                              margin: 0,
                              padding: 4,
                              minWidth: 160,
                              background: "#0f1d16",
                              border: "1px solid #1d3a2c",
                              borderRadius: 10,
                              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                            }}
                          >
                            {STATUS_EDITAVEIS.map((s) => {
                              const ss = statusStyle(s);
                              const atual = s === im.status;
                              return (
                                <li key={s}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={atual}
                                    onClick={() => alterarStatus(im, s)}
                                    style={{
                                      width: "100%",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 8,
                                      padding: "7px 10px",
                                      borderRadius: 7,
                                      border: "none",
                                      background: atual ? "#16271e" : "transparent",
                                      color: "#e6edf3",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "#16271e"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = atual ? "#16271e" : "transparent"; }}
                                  >
                                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: ss.color, flexShrink: 0 }} aria-hidden />
                                    <span style={{ flex: 1 }}>{STATUS_LABEL[s]}</span>
                                    {atual && <Check size={13} color="#c9a24a" aria-hidden />}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {temMais && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={carregarMais}
                disabled={carregandoMais}
                style={{ padding: "10px 24px", borderRadius: 8, background: "#0f1d16", border: "1px solid #1d3a2c", color: "#8b949e", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - imoveis.length} restantes)`}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 740 }}>
              <thead>
                <tr>
                  <th style={TH}>Título</th>
                  <th style={TH}>Tipo</th>
                  <th style={TH}>Finalidade</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Valor</th>
                  <th style={TH}>Cidade/UF</th>
                  <th style={TH}>Dorms</th>
                </tr>
              </thead>
              <tbody>
                {imoveis.map((im) => {
                  const st = statusStyle(im.status);
                  return (
                    <tr
                      key={im.id}
                      onClick={() => abrirEdicao(im)}
                      style={{ borderBottom: "1px solid #16271e", cursor: "pointer" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#0f1d16"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                    >
                      <td style={{ ...TD, fontWeight: 600, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {im.titulo || "Sem título"}
                      </td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12, textTransform: "capitalize" }}>{im.tipo || "—"}</td>
                      <td style={TD}>
                        {im.finalidade ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: im.finalidade === "venda" ? "#2f9e8f22" : "#b58a6322",
                            color: im.finalidade === "venda" ? "#2f9e8f" : "#b58a63",
                            border: `1px solid ${im.finalidade === "venda" ? "#2f9e8f44" : "#b58a6344"}`,
                          }}>
                            {im.finalidade === "locacao" ? "Locação" : im.finalidade === "venda" ? "Venda" : "Ambos"}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={TD}>
                        {im.status ? (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                          }}>
                            {STATUS_LABEL[im.status] ?? im.status}
                          </span>
                        ) : "—"}
                      </td>
                      <td style={{ ...TD, color: "#c9a24a", fontSize: 12, fontWeight: 700 }}>{formatCurrency(im.valor)}</td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                        {im.cidade ? `${im.cidade}${im.estado ? `/${im.estado}` : ""}` : "—"}
                      </td>
                      <td style={{ ...TD, color: "#8b949e", fontSize: 12 }}>
                        {im.dormitorios !== null ? `${im.dormitorios}q` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {temMais && (
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button
                onClick={carregarMais}
                disabled={carregandoMais}
                style={{ padding: "10px 24px", borderRadius: 8, background: "#0f1d16", border: "1px solid #1d3a2c", color: "#8b949e", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                {carregandoMais ? "Carregando..." : `Carregar mais (${total - imoveis.length} restantes)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Skeleton de cards (estado de carregamento honesto). */
function CardsSkeleton() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            background: "rgba(17, 28, 22, 0.6)",
            border: "1px solid rgba(201, 162, 74, 0.12)",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ height: 160, background: "#0f1d16", animation: "imovelPulse 1.4s ease-in-out infinite" }} />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ height: 14, width: "80%", borderRadius: 6, background: "#16271e", animation: "imovelPulse 1.4s ease-in-out infinite" }} />
            <div style={{ height: 12, width: "55%", borderRadius: 6, background: "#16271e", animation: "imovelPulse 1.4s ease-in-out infinite" }} />
            <div style={{ height: 20, width: 90, borderRadius: 999, background: "#16271e", marginTop: 6, animation: "imovelPulse 1.4s ease-in-out infinite" }} />
          </div>
        </div>
      ))}
      <style>{`@keyframes imovelPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }`}</style>
    </div>
  );
}
