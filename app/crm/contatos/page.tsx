"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";
import { formatarTelefoneMascara } from "@/lib/crm/telefone-brasil";
import { toast } from "@/components/crm/toast";

interface Contato {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cargo: string | null;
  ativo: boolean;
  receber_novo_lead: boolean;
  receber_aprovacao: boolean;
  receber_encaminhamento: boolean;
  canal: string;
}

function Toggle({ ativo, onChange }: { ativo: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange}
      style={{
        width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: ativo ? "#34d399" : "#1d3a2c", position: "relative", transition: "background 200ms",
        padding: 0, flexShrink: 0,
      }}>
      <span style={{
        position: "absolute", top: 3, left: ativo ? 18 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 200ms",
      }} />
    </button>
  );
}

const CANAL_LABEL: Record<string, string> = { whatsapp: "WhatsApp", email: "E-mail", ambos: "Ambos" };

export default function ContatosPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostraNovo, setMostraNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: "", telefone: "", email: "", cargo: "", canal: "whatsapp",
    receber_novo_lead: true, receber_aprovacao: true, receber_encaminhamento: true,
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/contatos", { headers: await crmApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Contato[]; error?: string };
      if (res.ok) {
        setContatos(json.data ?? []);
      } else {
        toast.error(json.error || "Não foi possível carregar os contatos.");
      }
    } catch {
      toast.error("Erro de rede ao carregar contatos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function resetForm() {
    setForm({ nome: "", telefone: "", email: "", cargo: "", canal: "whatsapp", receber_novo_lead: true, receber_aprovacao: true, receber_encaminhamento: true });
    setEditando(null);
  }

  async function salvar() {
    if (!form.nome.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    const digitos = form.telefone.replace(/\D/g, "");
    if (digitos.length < 10) {
      toast.error("Telefone inválido — informe DDD + número (ex.: (11) 99999-9999).");
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch(
        editando ? `/api/crm/contatos/${encodeURIComponent(editando)}` : "/api/crm/contatos",
        {
          method: editando ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
          body: JSON.stringify(form),
        }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Não foi possível salvar o contato.");
        return;
      }
      toast.success(editando ? "Contato atualizado." : "Contato adicionado.");
      await carregar();
      resetForm();
      setMostraNovo(false);
    } catch {
      toast.error("Erro de rede ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: string) {
    try {
      const res = await fetch(`/api/crm/contatos/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: await crmApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Não foi possível remover o contato.");
        return;
      }
      toast.success("Contato removido.");
      await carregar();
    } catch {
      toast.error("Erro de rede ao remover.");
    }
  }

  async function toggleAtivo(c: Contato) {
    try {
      const res = await fetch(`/api/crm/contatos/${encodeURIComponent(c.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await crmApiHeaders()) },
        body: JSON.stringify({ ativo: !c.ativo }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error || "Não foi possível atualizar.");
        return;
      }
      await carregar();
    } catch {
      toast.error("Erro de rede.");
    }
  }

  function iniciarEdicao(c: Contato) {
    setForm({
      nome: c.nome, telefone: c.telefone, email: c.email || "", cargo: c.cargo || "",
      canal: c.canal, receber_novo_lead: c.receber_novo_lead,
      receber_aprovacao: c.receber_aprovacao, receber_encaminhamento: c.receber_encaminhamento,
    });
    setEditando(c.id);
    setMostraNovo(true);
  }

  const INPUT = {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    border: "1px solid #1d3a2c", background: "#0a140f",
    color: "#e6edf3", fontSize: 14, boxSizing: "border-box" as const,
  };

  useEffect(() => {
    setSlot({
      path: pathname,
      actions: !mostraNovo ? (
        <button
          type="button"
          onClick={() => {
            resetForm();
            setMostraNovo(true);
          }}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: "none",
            cursor: "pointer",
            background: "#c9a24a",
            color: "#0a140f",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          + Adicionar
        </button>
      ) : undefined,
    });
    return () => setSlot(null);
  }, [pathname, setSlot, mostraNovo]);

  return (
    <div style={{ background: "#0a140f", minHeight: "100%", padding: "1.5rem" }}>
      {mostraNovo && (
        <div style={{ background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <h2 style={{ color: "#e6edf3", fontSize: 15, fontWeight: 700, margin: "0 0 14px" }}>
            {editando ? "Editar contato" : "Novo contato"}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5 }}>Nome *</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome" style={INPUT} />
              </div>
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5 }}>Telefone *</label>
                <input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: formatarTelefoneMascara(e.target.value) }))} placeholder="(11) 99999-9999" style={INPUT} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5 }}>E-mail</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@ex.com" type="email" style={INPUT} />
              </div>
              <div>
                <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5 }}>Cargo</label>
                <input value={form.cargo} onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Gestor" style={INPUT} />
              </div>
            </div>
            <div>
              <label style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, display: "block", marginBottom: 5 }}>Canal de notificação</label>
              <select value={form.canal} onChange={e => setForm(f => ({ ...f, canal: e.target.value }))} style={INPUT}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ color: "#8b949e", fontSize: 11, fontWeight: 600, margin: 0 }}>Recebe notificações de:</p>
              {([
                ["receber_novo_lead", "Novo lead"],
                ["receber_aprovacao", "Aprovação pendente"],
                ["receber_encaminhamento", "Encaminhamento"],
              ] as const).map(([key, label]) => (
                <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#e6edf3", fontSize: 13 }}>{label}</span>
                  <Toggle ativo={form[key]} onChange={() => setForm(f => ({ ...f, [key]: !f[key] }))} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button onClick={() => { resetForm(); setMostraNovo(false); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid #1d3a2c", cursor: "pointer", background: "transparent", color: "#8b949e", fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando || !form.nome || !form.telefone}
                style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none", cursor: "pointer", background: "#c9a24a", color: "#0a140f", fontWeight: 700, fontSize: 13, opacity: (!form.nome || !form.telefone) ? 0.5 : 1 }}>
                {salvando ? "Salvando..." : editando ? "Salvar alterações" : "Adicionar contato"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", color: "#8b949e", padding: 40 }}>Carregando...</div>
      ) : contatos.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <p style={{ color: "#8b949e" }}>Nenhum contato configurado.</p>
          <p style={{ color: "#484f58", fontSize: 12 }}>Adicione quem deve receber alertas de leads e aprovações.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {contatos.map(c => (
            <div key={c.id}
              style={{
                background: "#0f1d16", border: "1px solid #1d3a2c", borderRadius: 14, padding: 16,
                opacity: c.ativo ? 1 : 0.5,
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <p style={{ color: "#e6edf3", fontWeight: 700, fontSize: 14, margin: 0 }}>{c.nome}</p>
                  <p style={{ color: "#8b949e", fontSize: 12, margin: "2px 0 0" }}>
                    {c.cargo ? `${c.cargo} · ` : ""}{c.telefone}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "#1d3a2c40", color: "#8b949e" }}>
                    {CANAL_LABEL[c.canal] || c.canal}
                  </span>
                  <Toggle ativo={c.ativo} onChange={() => toggleAtivo(c)} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {c.receber_novo_lead && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "#34d39915", color: "#34d399", border: "1px solid #34d39930" }}>novo lead</span>}
                {c.receber_aprovacao && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "#ef444415", color: "#ef4444", border: "1px solid #ef444430" }}>aprovação</span>}
                {c.receber_encaminhamento && <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: "#b58a6315", color: "#b58a63", border: "1px solid #b58a6330" }}>encaminhamento</span>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => iniciarEdicao(c)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: "1px solid #1d3a2c", cursor: "pointer", background: "transparent", color: "#8b949e", fontSize: 12 }}>
                  Editar
                </button>
                <button onClick={() => remover(c.id)}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ef444430", cursor: "pointer", background: "transparent", color: "#ef4444", fontSize: 12 }}>
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
