"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlotConfig } from "@/hooks/useCrmHeaderSlotConfig";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { FilaDistribuicao } from "@/components/crm/FilaDistribuicao";
import { toast } from "@/components/crm/toast";

type Regra = {
  id: string;
  prioridade: number;
  ativo: boolean;
  origem: string | null;
  mercado: string | null;
  uf: string | null;
  destino_tipo: string;
  destino_valor: string | null;
  rotulo: string | null;
};

type EventoRede = {
  id: string;
  event_type: string;
  entity_type: string | null;
  ator: string | null;
  payload: Record<string, unknown> | null;
  ts: string;
};

type Metricas = {
  geral: {
    distribuidos: number;
    recusados: number;
    recolocados: number;
    entregas: number;
    bloqueios: number;
    liberacoes: number;
    sem_proximo: number;
  };
  fornecedores: Array<{
    fornecedor_id: string;
    nome: string | null;
    recebidos: number;
    recusados: number;
    bloqueios: number;
    status_financeiro: string;
    aderencia: number;
    cobranca: string | null;
  }>;
  alertas: string[];
};

function descreverEvento(e: EventoRede): string {
  const p = e.payload ?? {};
  if (e.event_type === "lead_distribuido") {
    return `Lead distribuído para ${p.parceiro_nome ?? "fornecedor"}${p.score != null ? ` · aderência ${p.score}` : ""}`;
  }
  if (e.event_type === "entrega_gerada") {
    return `Entrega ${p.codigo ?? ""} gerada · ${p.tipo ?? "obra"}${p.origem === "automatica" ? " (automática ao fechar)" : ""}`;
  }
  if (e.event_type === "gate_pendencia_bloqueio") {
    return `Bloqueado por pendência financeira: ${p.parceiro_nome ?? "fornecedor"} não recebeu o lead`;
  }
  if (e.event_type === "gate_liberado") {
    return `Fornecedor liberado pelo Hub: ${p.parceiro_nome ?? "fornecedor"}`;
  }
  if (e.event_type === "lead_recusado") {
    return `Fornecedor recusou${p.parceiro_nome ? `: ${p.parceiro_nome}` : ""} — oferecendo ao próximo`;
  }
  if (e.event_type === "lead_recolocado") {
    return `Lead recolocado para ${p.parceiro_nome ?? "próximo fornecedor"}`;
  }
  if (e.event_type === "lead_sem_proximo") {
    return "Sem próximo fornecedor elegível — lead voltou à fila";
  }
  if (e.event_type === "fornecedor_cobrado") {
    return `Cobrança enviada a ${p.parceiro_nome ?? "fornecedor"}${p.motivo ? ` · ${p.motivo}` : ""}`;
  }
  return e.event_type.replace(/_/g, " ");
}

const ORIGENS = ["", "whatsapp", "meta", "google", "indicacao", "manual", "super_cadastro"];
const MERCADOS = ["", "IMB", "ARQ", "ENG", "SRV", "RFM", "MRC", "PRO", "FOR"];
const inputStyle: React.CSSProperties = {
  padding: 9, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", fontSize: 13,
};
const label = (s: string | null) => (s && s.trim() ? s : "qualquer");

export default function DistribuicaoPage() {
  const [lista, setLista] = useState<Regra[]>([]);
  const [eventos, setEventos] = useState<EventoRede[]>([]);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [acaoForn, setAcaoForn] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<
    { tipo: "liberar" | "cobrar"; id: string; nome: string; motivo: string | null } | null
  >(null);
  const [confirmarExcluir, setConfirmarExcluir] = useState<Regra | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [auditorMsg, setAuditorMsg] = useState<string | null>(null);
  const [auditorRodando, setAuditorRodando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    origem: "", mercado: "", uf: "", destino_tipo: "agente", destino_valor: "", prioridade: "100",
  });
  const [regrasAbertas, setRegrasAbertas] = useState(false);
  const [destinos, setDestinos] = useState<{
    agentes: { value: string; label: string }[];
    parceiros: { value: string; label: string }[];
  }>({ agentes: [], parceiros: [] });

  const pathname = usePathname();
  useCrmHeaderSlotConfig({
    path: pathname,
    title: "Distribuição de leads",
    subtitle: "Quem recebe cada lead — atividade da rede e regras de roteamento",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [resRegras, resEv, resMet] = await Promise.all([
        fetch("/api/crm/distribuicao/regras", { headers: internalApiHeaders() }),
        fetch("/api/crm/eventos?limite=20", { headers: internalApiHeaders() }),
        fetch("/api/crm/distribuicao/metricas", { headers: internalApiHeaders() }),
      ]);
      const json = (await resRegras.json().catch(() => ({}))) as { data?: Regra[] };
      if (resRegras.ok) setLista(json.data ?? []);
      const jEv = (await resEv.json().catch(() => ({}))) as { data?: EventoRede[] };
      if (resEv.ok) setEventos(jEv.data ?? []);
      const jMet = (await resMet.json().catch(() => ({}))) as Metricas | { error: string };
      if (resMet.ok && "geral" in jMet) setMetricas(jMet);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/crm/distribuicao/destinos", { headers: internalApiHeaders() });
        const json = (await res.json().catch(() => ({}))) as {
          agentes?: { value: string; label: string }[];
          parceiros?: { value: string; label: string }[];
        };
        if (res.ok) {
          setDestinos({ agentes: json.agentes ?? [], parceiros: json.parceiros ?? [] });
        }
      } catch {
        /* lista vazia: o select fica sem opções, mas não quebra */
      }
    })();
  }, []);

  async function adicionar() {
    setErro("");
    if (!form.destino_valor.trim()) { setErro("Escolha o destino (agente/atendente ou parceiro)."); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/distribuicao/regras", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ ...form, prioridade: Number(form.prioridade) || 100 }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErro(json.error || "Falha ao salvar."); return; }
      setForm({ origem: "", mercado: "", uf: "", destino_tipo: "agente", destino_valor: "", prioridade: "100" });
      void carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggle(r: Regra) {
    try {
      const res = await fetch(`/api/crm/distribuicao/regras/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ ativo: !r.ativo }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error || "Não foi possível alterar a regra.");
        return;
      }
      toast.success(r.ativo ? "Regra desativada." : "Regra ativada.");
      void carregar();
    } catch {
      toast.error("Falha de rede ao alterar a regra.");
    }
  }

  async function excluir(id: string) {
    setExcluindo(true);
    try {
      const res = await fetch(`/api/crm/distribuicao/regras/${id}`, { method: "DELETE", headers: internalApiHeaders() });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error || "Não foi possível excluir a regra.");
        return;
      }
      setConfirmarExcluir(null);
      toast.success("Regra excluída.");
      void carregar();
    } catch {
      toast.error("Falha de rede ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  async function liberarFornecedor(fornecedorId: string, nome: string) {
    setAcaoForn(fornecedorId);
    try {
      const res = await fetch(`/api/crm/parceiros/${encodeURIComponent(fornecedorId)}/liberar`, {
        method: "POST",
        headers: internalApiHeaders(),
      });
      if (!res.ok) {
        toast.error(`Não foi possível liberar ${nome}.`);
        return;
      }
      await carregar();
      toast.success(`${nome} liberado para receber leads.`);
    } catch {
      toast.error("Falha de rede ao liberar.");
    } finally {
      setAcaoForn(null);
    }
  }

  async function cobrarFornecedor(fornecedorId: string, motivo: string | null, nome: string) {
    setAcaoForn(fornecedorId);
    try {
      const res = await fetch("/api/crm/distribuicao/cobrar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ fornecedor_id: fornecedorId, motivo: motivo ?? undefined }),
      });
      if (!res.ok) {
        toast.error(`Não foi possível enviar a cobrança a ${nome}.`);
        return;
      }
      await carregar();
      toast.success(`Cobrança enviada a ${nome}.`);
    } catch {
      toast.error("Falha de rede ao cobrar.");
    } finally {
      setAcaoForn(null);
    }
  }

  async function rodarAuditor() {
    setAuditorRodando(true);
    setAuditorMsg(null);
    try {
      const res = await fetch("/api/crm/distribuicao/auditor", {
        method: "POST",
        headers: internalApiHeaders(),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; cobrancas?: unknown[]; avaliados?: number };
      if (res.ok && j.ok) {
        const n = j.cobrancas?.length ?? 0;
        setAuditorMsg(
          n > 0
            ? `${n} cobrança(s) emitida(s) automaticamente.`
            : `Rede auditada — nada a cobrar agora (${j.avaliados ?? 0} fornecedores).`
        );
        await carregar();
      } else {
        setAuditorMsg("Falha ao rodar o auditor.");
      }
    } finally {
      setAuditorRodando(false);
    }
  }

  const botaoAcao = (cor: string): React.CSSProperties => ({
    padding: "4px 10px", borderRadius: 6, border: `1px solid ${cor}55`,
    background: `${cor}18`, color: cor, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  });

  return (
    <div style={{ padding: 24, maxWidth: 1000, color: "#e6edf3" }}>
      {/* Fila de distribuição — JOB da tela: distribuir leads com a sugestão do motor (ADITIVO no topo) */}
      <FilaDistribuicao onDistribuido={() => void carregar()} />

      {/* Auditoria da rede — KPIs do hub_eventos (C.1, base da cobrança IA) */}
      {metricas && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #1d3a2c", background: "#0a140f" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 0 12px", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>
              Auditoria da rede <span style={{ color: "#6e7681", fontWeight: 400 }}>· KPIs em tempo real</span>
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {auditorMsg && <span style={{ fontSize: 11, color: "#3fb950" }}>{auditorMsg}</span>}
              <button
                type="button"
                onClick={rodarAuditor}
                disabled={auditorRodando}
                style={{ padding: "5px 12px", borderRadius: 7, border: "1px solid #c9a24a55", background: "#c9a24a18", color: "#c9a24a", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {auditorRodando ? "Auditando…" : "Rodar auditor agora"}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginBottom: metricas.alertas.length ? 14 : 0 }}>
            {[
              { n: metricas.geral.distribuidos, l: "distribuídos" },
              { n: metricas.geral.entregas, l: "entregas" },
              { n: metricas.geral.recusados, l: "recusas" },
              { n: metricas.geral.recolocados, l: "recolocados" },
              { n: metricas.geral.bloqueios, l: "bloqueios", red: true },
            ].map((s) => (
              <div key={s.l} style={{ minWidth: 70 }}>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: s.red && s.n > 0 ? "#f85149" : "#e6edf3" }}>{s.n}</p>
                <p style={{ margin: 0, fontSize: 11, color: "#8b949e" }}>{s.l}</p>
              </div>
            ))}
          </div>
          {metricas.alertas.length > 0 && (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {metricas.alertas.map((a, i) => (
                <li key={i} style={{ fontSize: 12, color: "#e3b341", display: "flex", gap: 6 }}>
                  <span aria-hidden>⚠</span> {a}
                </li>
              ))}
            </ul>
          )}
          {metricas.fornecedores.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid #16271e", paddingTop: 14 }}>
              <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Desempenho por fornecedor{" "}
                <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>· aderência decide quem recebe mais leads</span>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {metricas.fornecedores.map((f) => {
                  const corA = f.aderencia >= 60 ? "#3fb950" : f.aderencia >= 35 ? "#e3b341" : "#f85149";
                  const stLabel = f.status_financeiro === "bloqueado" ? "bloqueado" : f.status_financeiro === "pendente" ? "pendente" : "em dia";
                  const stCor = f.status_financeiro === "bloqueado" ? "#f85149" : f.status_financeiro === "pendente" ? "#e3b341" : "#3fb950";
                  return (
                    <div key={f.fornecedor_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "1px solid #16271e", background: "#0b0f14" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e6edf3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.nome ?? "Fornecedor"}
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: stCor }}>● {stLabel}</span>
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8b949e" }}>
                          {f.recebidos} recebidos · {f.recusados} recusas{f.bloqueios ? ` · ${f.bloqueios} bloqueios` : ""}
                        </p>
                        {f.cobranca && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#e3b341" }}>⚠ {f.cobranca}</p>}
                      </div>
                      <div style={{ width: 88, textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: corA, lineHeight: 1 }}>{f.aderencia}</p>
                        <div style={{ height: 4, borderRadius: 2, background: "#16271e", overflow: "hidden", marginTop: 3 }}>
                          <div style={{ width: `${f.aderencia}%`, height: "100%", background: corA }} />
                        </div>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#8b949e", textTransform: "uppercase" }}>aderência</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 70 }}>
                        {f.status_financeiro === "bloqueado" && (
                          <button type="button" onClick={() => setConfirmar({ tipo: "liberar", id: f.fornecedor_id, nome: f.nome ?? "Fornecedor", motivo: null })} disabled={acaoForn === f.fornecedor_id} style={botaoAcao("#3fb950")}>
                            {acaoForn === f.fornecedor_id ? "..." : "Liberar"}
                          </button>
                        )}
                        {f.cobranca && (
                          <button type="button" onClick={() => setConfirmar({ tipo: "cobrar", id: f.fornecedor_id, nome: f.nome ?? "Fornecedor", motivo: f.cobranca })} disabled={acaoForn === f.fornecedor_id} style={botaoAcao("#c9a24a")}>
                            {acaoForn === f.fornecedor_id ? "..." : "Cobrar"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Atividade da rede — gestão completa do Hub (lê hub_eventos) */}
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #1d3a2c", background: "#0a140f" }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>
          Atividade da rede <span style={{ color: "#6e7681", fontWeight: 400 }}>· controle total do Hub</span>
        </p>
        {eventos.length === 0 ? (
          <p style={{ margin: 0, color: "#8b949e", fontSize: 13 }}>
            Sem eventos ainda. Distribua um lead ou feche um negócio para ver a rede em movimento.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {eventos.map((e) => (
              <li key={e.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span
                  aria-hidden
                  style={{
                    width: 8, height: 8, borderRadius: 999, flexShrink: 0,
                    background:
                      e.event_type === "gate_pendencia_bloqueio"
                        ? "#f85149"
                        : e.event_type === "lead_distribuido"
                          ? "#c9a24a"
                          : "#34d399",
                  }}
                />
                <span style={{ flex: 1, color: "#e6edf3" }}>{descreverEvento(e)}</span>
                <span style={{ fontSize: 11, color: "#6e7681", flexShrink: 0 }}>{e.ator ?? ""}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Regras de roteamento (config avançada) */}
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
        <button type="button" onClick={() => setRegrasAbertas((v) => !v)} style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>⚙ Regras de roteamento automático</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8b949e" }}>{regrasAbertas ? "▲ fechar" : "▼ configurar"}</span>
        </button>
        {regrasAbertas && (
          <>
        <p style={{ margin: "12px 0 12px", fontSize: 12, color: "#8b949e", lineHeight: 1.5 }}>
          O lead que casa com a 1ª regra ativa (por prioridade) vai direto ao destino. Sem regra, vale a heurística padrão.
          Deixe um campo em <strong style={{ color: "#c9a24a" }}>branco (qualquer)</strong> para não filtrar por ele.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, alignItems: "center" }}>
          <select style={inputStyle} value={form.origem} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}>
            {ORIGENS.map((o) => <option key={o} value={o}>{o || "origem: qualquer"}</option>)}
          </select>
          <select style={inputStyle} value={form.mercado} onChange={(e) => setForm((f) => ({ ...f, mercado: e.target.value }))}>
            {MERCADOS.map((m) => <option key={m} value={m}>{m || "mercado: qualquer"}</option>)}
          </select>
          <input style={inputStyle} placeholder="UF (qualquer)" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} />
          <select style={inputStyle} value={form.destino_tipo} onChange={(e) => setForm((f) => ({ ...f, destino_tipo: e.target.value, destino_valor: "" }))}>
            <option value="agente">→ Agente IA</option>
            <option value="atendente">→ Atendente</option>
            <option value="parceiro">→ Parceiro</option>
          </select>
          {(() => {
            const opcoes = form.destino_tipo === "parceiro" ? destinos.parceiros : destinos.agentes;
            return (
              <select
                style={inputStyle}
                value={form.destino_valor}
                onChange={(e) => setForm((f) => ({ ...f, destino_valor: e.target.value }))}
              >
                <option value="">
                  {opcoes.length === 0
                    ? form.destino_tipo === "parceiro" ? "nenhum parceiro" : "nenhum agente"
                    : form.destino_tipo === "parceiro" ? "escolha o parceiro" : "escolha o agente/atendente"}
                </option>
                {opcoes.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            );
          })()}
          <input style={inputStyle} type="number" placeholder="prioridade" value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))} />
        </div>
        {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
        <button type="button" disabled={salvando} onClick={() => void adicionar()}
          style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
          <Plus size={14} strokeWidth={2.5} /> {salvando ? "Salvando…" : "Adicionar regra"}
        </button>
          </>
        )}
      </div>

      {/* Lista */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #1d3a2c", borderRadius: 12 }}>
          Nenhuma regra ainda — o roteamento usa a heurística padrão. Adicione a 1ª regra acima.
        </div>
      ) : (
        <div style={{ border: "1px solid #1d3a2c", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #16271e" : "none", opacity: r.ativo ? 1 : 0.5 }}>
              <span style={{ fontSize: 11, color: "#6e7681", width: 28 }}>#{r.prioridade}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <span style={{ color: "#8b949e" }}>se </span>
                <strong>{label(r.origem)}</strong>
                <span style={{ color: "#8b949e" }}> · </span><strong>{label(r.mercado)}</strong>
                <span style={{ color: "#8b949e" }}> · </span><strong>{label(r.uf)}</strong>
                <span style={{ color: "#c9a24a" }}> → {r.destino_tipo}: {r.destino_valor}</span>
              </div>
              <button type="button" onClick={() => void toggle(r)}
                style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #1d3a2c", background: "transparent", color: r.ativo ? "#34d399" : "#8b949e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {r.ativo ? "ativa" : "inativa"}
              </button>
              <button type="button" onClick={() => setConfirmarExcluir(r)} title="Excluir"
                style={{ padding: 6, borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <CrmConfirmDialog
        open={confirmar !== null}
        title={confirmar?.tipo === "cobrar" ? "Enviar cobrança?" : "Liberar fornecedor?"}
        confirmLabel={confirmar?.tipo === "cobrar" ? "Enviar cobrança" : "Liberar"}
        loading={acaoForn !== null}
        onCancel={() => setConfirmar(null)}
        onConfirm={() => {
          const c = confirmar;
          if (!c) return;
          setConfirmar(null);
          if (c.tipo === "cobrar") void cobrarFornecedor(c.id, c.motivo, c.nome);
          else void liberarFornecedor(c.id, c.nome);
        }}
      >
        {confirmar?.tipo === "cobrar" ? (
          <>
            Enviar uma cobrança a <strong style={{ color: "#e6edf3" }}>{confirmar?.nome}</strong>
            {confirmar?.motivo ? <> pelo motivo: {confirmar.motivo}</> : null}?
          </>
        ) : (
          <>
            Liberar <strong style={{ color: "#e6edf3" }}>{confirmar?.nome}</strong> para voltar a
            receber leads?
          </>
        )}
      </CrmConfirmDialog>

      <CrmConfirmDialog
        open={confirmarExcluir !== null}
        title="Excluir regra de distribuição?"
        confirmLabel="Excluir"
        danger
        loading={excluindo}
        onCancel={() => setConfirmarExcluir(null)}
        onConfirm={() => {
          if (confirmarExcluir) void excluir(confirmarExcluir.id);
        }}
      >
        {confirmarExcluir ? (
          <>
            Remover a regra{" "}
            <strong style={{ color: "#e6edf3" }}>
              {label(confirmarExcluir.origem)} · {label(confirmarExcluir.mercado)} · {label(confirmarExcluir.uf)}
            </strong>{" "}
            → {confirmarExcluir.destino_tipo}
            {confirmarExcluir.destino_valor ? `: ${confirmarExcluir.destino_valor}` : ""}? O roteamento
            volta a usar as demais regras (ou a heurística padrão).
          </>
        ) : null}
      </CrmConfirmDialog>
    </div>
  );
}
