"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio, Plus, Trash2 } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { CrmConfirmDialog } from "@/components/crm/CrmConfirmDialog";
import { toast } from "@/components/crm/toast";

type Canal = {
  id: string;
  tipo: string;
  nome: string;
  identificador: string | null;
  origem_slug: string | null;
  ativo: boolean;
  observacao: string | null;
};

const TIPOS: { value: string; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "meta_ads", label: "Meta Ads (Facebook/Instagram)" },
  { value: "google_ads", label: "Google Ads" },
  { value: "site", label: "Site / formulário" },
  { value: "indicacao", label: "Indicação" },
  { value: "manual", label: "Manual" },
];
const tipoLabel = (t: string) => TIPOS.find((x) => x.value === t)?.label ?? t;
const inputStyle: React.CSSProperties = {
  padding: 9, borderRadius: 8, border: "1px solid #1d3a2c", background: "#0a140f", color: "#e6edf3", fontSize: 13,
};

export default function CanaisEntradaPage() {
  const [lista, setLista] = useState<Canal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ tipo: "whatsapp", nome: "", identificador: "", origem_slug: "", observacao: "" });
  const [confirmExcluir, setConfirmExcluir] = useState<Canal | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/canais-entrada", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Canal[] };
      if (res.ok) setLista(json.data ?? []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function adicionar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Informe um nome para o canal."); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/canais-entrada", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErro(json.error || "Falha ao salvar."); return; }
      setForm({ tipo: "whatsapp", nome: "", identificador: "", origem_slug: "", observacao: "" });
      void carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  async function toggle(c: Canal) {
    await fetch(`/api/crm/canais-entrada/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ ativo: !c.ativo }),
    });
    void carregar();
  }

  async function confirmarExcluir() {
    if (!confirmExcluir) return;
    setExcluindo(true);
    try {
      const res = await fetch(`/api/crm/canais-entrada/${confirmExcluir.id}`, {
        method: "DELETE",
        headers: internalApiHeaders(),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(json.error || "Falha ao excluir o canal.");
        return;
      }
      toast.success("Canal de entrada excluído.");
      setConfirmExcluir(null);
      void carregar();
    } catch {
      toast.error("Erro de rede ao excluir.");
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <>
    <div style={{ padding: 24, maxWidth: 1000, color: "#e6edf3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Radio size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22 }}>Canais de entrada</h1>
      </div>
      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13, maxWidth: 760 }}>
        Registro das fontes de lead (WhatsApp, Meta, Google, site, indicação). O <strong style={{ color: "#c9a24a" }}>origem</strong>{" "}
        aqui é o valor usado nas regras de <strong style={{ color: "#c9a24a" }}>Direcionamento</strong>.
        Tokens/segredos ficam no servidor (nunca aqui); a conexão real do WhatsApp é na ficha do agente.
      </p>

      <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
        <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#c9a24a" }}>Novo canal</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          <select style={inputStyle} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, origem_slug: f.origem_slug || e.target.value }))}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input style={inputStyle} placeholder="Nome (ex.: WhatsApp Vendas)" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          <input style={inputStyle} placeholder="Identificador (nº/conta/form id)" value={form.identificador} onChange={(e) => setForm((f) => ({ ...f, identificador: e.target.value }))} />
          <input style={inputStyle} placeholder="origem (p/ regras)" value={form.origem_slug} onChange={(e) => setForm((f) => ({ ...f, origem_slug: e.target.value }))} />
          <input style={inputStyle} placeholder="observação" value={form.observacao} onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))} />
        </div>
        {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
        <button type="button" disabled={salvando} onClick={() => void adicionar()}
          style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
          <Plus size={14} strokeWidth={2.5} /> {salvando ? "Salvando…" : "Adicionar canal"}
        </button>
      </div>

      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #1d3a2c", borderRadius: 12 }}>
          Nenhum canal registrado. Adicione o 1º acima.
        </div>
      ) : (
        <div style={{ border: "1px solid #1d3a2c", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((c, i) => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #16271e" : "none", opacity: c.ativo ? 1 : 0.5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#c9a24a", border: "1px solid #c9a24a35", background: "#c9a24a18", borderRadius: 999, padding: "2px 8px" }}>{tipoLabel(c.tipo)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{c.nome}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>
                  {c.identificador ? `${c.identificador} · ` : ""}origem: {c.origem_slug || "—"}{c.observacao ? ` · ${c.observacao}` : ""}
                </p>
              </div>
              <button type="button" onClick={() => void toggle(c)}
                style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid #1d3a2c", background: "transparent", color: c.ativo ? "#34d399" : "#8b949e", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                {c.ativo ? "ativo" : "inativo"}
              </button>
              <button type="button" onClick={() => setConfirmExcluir(c)} title="Excluir"
                style={{ padding: 6, borderRadius: 8, border: "1px solid #f8514944", background: "transparent", color: "#f85149", cursor: "pointer", display: "flex" }}>
                <Trash2 size={14} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>

      <CrmConfirmDialog
        open={confirmExcluir !== null}
        title="Excluir canal de entrada?"
        danger
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={excluindo}
        onCancel={() => !excluindo && setConfirmExcluir(null)}
        onConfirm={() => void confirmarExcluir()}
      >
        <p style={{ margin: 0 }}>
          O canal <strong style={{ color: "#e6edf3" }}>«{confirmExcluir?.nome}»</strong> será removido. As regras de
          Direcionamento que usam esta origem deixam de reconhecê-la.
        </p>
      </CrmConfirmDialog>
    </>
  );
}
