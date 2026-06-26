"use client";

import { useCallback, useEffect, useState } from "react";
import { Route, Plus, Trash2 } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

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
  return e.event_type.replace(/_/g, " ");
}

const ORIGENS = ["", "whatsapp", "meta", "google", "indicacao", "manual", "super_cadastro"];
const MERCADOS = ["", "IMB", "ARQ", "ENG", "SRV", "RFM", "MRC", "PRO", "FOR"];
const inputStyle: React.CSSProperties = {
  padding: 9, borderRadius: 8, border: "1px solid #30363d", background: "#0d1117", color: "#e6edf3", fontSize: 13,
};
const label = (s: string | null) => (s && s.trim() ? s : "qualquer");

export default function DistribuicaoPage() {
  const [lista, setLista] = useState<Regra[]>([]);
  const [eventos, setEventos] = useState<EventoRede[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    origem: "", mercado: "", uf: "", destino_tipo: "agente", destino_valor: "", prioridade: "100",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [resRegras, resEv] = await Promise.all([
        fetch("/api/crm/distribuicao/regras", { headers: internalApiHeaders() }),
        fetch("/api/crm/eventos?limite=20", { headers: internalApiHeaders() }),
      ]);
      const json = (await resRegras.json().catch(() => ({}))) as { data?: Regra[] };
      if (resRegras.ok) setLista(json.data ?? []);
      const jEv = (await resEv.json().catch(() => ({}))) as { data?: EventoRede[] };
      if (resEv.ok) setEventos(jEv.data ?? []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function adicionar() {
    setErro("");
    if (!form.destino_valor.trim()) { setErro("Informe o destino (slug do agente/atendente ou id do parceiro)."); return; }
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
    await fetch(`/api/crm/distribuicao/regras/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ ativo: !r.ativo }),
    });
    void carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta regra de distribuição?")) return;
    await fetch(`/api/crm/distribuicao/regras/${id}`, { method: "DELETE", headers: internalApiHeaders() });
    void carregar();
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, color: "#e6edf3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Route size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22 }}>Direcionamento de leads</h1>
      </div>
      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13 }}>
        Regras automáticas: o lead que casa com a 1ª regra ativa (por prioridade) é direcionado ao destino.
        Sem regra que case, vale a heurística padrão. <strong style={{ color: "#c9a24a" }}>qualquer</strong> = campo em branco.
      </p>

      {/* Atividade da rede — gestão completa do Hub (lê hub_eventos) */}
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #30363d", background: "#0d1117" }}>
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

      {/* Form de nova regra */}
      <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>Nova regra</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, alignItems: "center" }}>
          <select style={inputStyle} value={form.origem} onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value }))}>
            {ORIGENS.map((o) => <option key={o} value={o}>{o || "origem: qualquer"}</option>)}
          </select>
          <select style={inputStyle} value={form.mercado} onChange={(e) => setForm((f) => ({ ...f, mercado: e.target.value }))}>
            {MERCADOS.map((m) => <option key={m} value={m}>{m || "mercado: qualquer"}</option>)}
          </select>
          <input style={inputStyle} placeholder="UF (qualquer)" value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))} />
          <select style={inputStyle} value={form.destino_tipo} onChange={(e) => setForm((f) => ({ ...f, destino_tipo: e.target.value }))}>
            <option value="agente">→ Agente IA</option>
            <option value="atendente">→ Atendente</option>
            <option value="parceiro">→ Parceiro</option>
          </select>
          <input style={inputStyle} placeholder="destino (slug/id)" value={form.destino_valor} onChange={(e) => setForm((f) => ({ ...f, destino_valor: e.target.value }))} />
          <input style={inputStyle} type="number" placeholder="prioridade" value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))} />
        </div>
        {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
        <button type="button" disabled={salvando} onClick={() => void adicionar()}
          style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
          <Plus size={14} strokeWidth={2.5} /> {salvando ? "Salvando…" : "Adicionar regra"}
        </button>
      </div>

      {/* Lista */}
      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #30363d", borderRadius: 12 }}>
          Nenhuma regra ainda — o roteamento usa a heurística padrão. Adicione a 1ª regra acima.
        </div>
      ) : (
        <div style={{ border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((r, i) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #21262d" : "none", opacity: r.ativo ? 1 : 0.5 }}>
              <span style={{ fontSize: 11, color: "#6e7681", width: 28 }}>#{r.prioridade}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <span style={{ color: "#8b949e" }}>se </span>
                <strong>{label(r.origem)}</strong>
                <span style={{ color: "#8b949e" }}> · </span><strong>{label(r.mercado)}</strong>
                <span style={{ color: "#8b949e" }}> · </span><strong>{label(r.uf)}</strong>
                <span style={{ color: "#c9a24a" }}> → {r.destino_tipo}: {r.destino_valor}</span>
              </div>
              <button type="button" onClick={() => void toggle(r)}
                style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #30363d", background: "transparent", color: r.ativo ? "#34d399" : "#8b949e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {r.ativo ? "ativa" : "inativa"}
              </button>
              <button type="button" onClick={() => void excluir(r.id)} title="Excluir"
                style={{ padding: 6, borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
