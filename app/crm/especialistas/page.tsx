"use client";

import { useCallback, useEffect, useState } from "react";
import { HardHat, Plus, BadgeCheck, Link2, Check } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import { ESPECIALIDADES, EXPERIENCIAS, UFS } from "@/lib/crm/especialidades";

type Especialista = {
  id: string;
  codigo: string | null;
  nome: string;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  especialidades: string[] | null;
  especialidade_principal: string | null;
  experiencia: string | null;
  tem_equipe: boolean | null;
  verificado: boolean | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: 10, borderRadius: 8, border: "1px solid #1d3a2c",
  background: "#0a140f", color: "#e6edf3", fontSize: 13,
};

export default function EspecialistasPage() {
  const [lista, setLista] = useState<Especialista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [linkCopiado, setLinkCopiado] = useState(false);
  const FORM_VAZIO = {
    nome: "", telefone: "", cpf: "", cidade: "", uf: "", especialidades: [] as string[],
    experiencia: "", tem_equipe: false, tamanho_equipe: "", observacoes: "",
  };
  const [form, setForm] = useState(FORM_VAZIO);

  function toggleEspecialidade(esp: string) {
    setForm((f) => ({
      ...f,
      especialidades: f.especialidades.includes(esp)
        ? f.especialidades.filter((x) => x !== esp)
        : [...f.especialidades, esp],
    }));
  }

  async function copiarLinkConvite() {
    setErro("");
    try {
      const res = await fetch("/api/crm/especialistas/convite", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { por?: string };
      const url = `${window.location.origin}/especialista/cadastro${json.por ? `?por=${json.por}` : ""}`;
      await navigator.clipboard.writeText(url);
      setLinkCopiado(true);
      setTimeout(() => setLinkCopiado(false), 2500);
    } catch {
      setErro("Não foi possível copiar o link de convite.");
    }
  }

  function fecharForm() {
    setAberto(false);
    setEditId(null);
    setErro("");
    setForm(FORM_VAZIO);
  }

  async function editar(id: string) {
    setErro("");
    try {
      const res = await fetch(`/api/crm/especialistas/${id}`, { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível carregar.");
        return;
      }
      const e = json.data;
      setForm({
        nome: String(e.nome ?? ""),
        telefone: String(e.telefone ?? ""),
        cpf: String(e.cpf ?? ""),
        cidade: String(e.cidade ?? ""),
        uf: String(e.uf ?? ""),
        especialidades: Array.isArray(e.especialidades) ? (e.especialidades as string[]) : [],
        experiencia: String(e.experiencia ?? ""),
        tem_equipe: e.tem_equipe === true,
        tamanho_equipe: e.tamanho_equipe != null ? String(e.tamanho_equipe) : "",
        observacoes: String(e.observacoes ?? ""),
      });
      setEditId(id);
      setAberto(true);
    } catch {
      setErro("Erro de rede.");
    }
  }

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/especialistas", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Especialista[] };
      if (res.ok) {
        setLista(json.data ?? []);
      } else {
        // Não engole o erro em silêncio: a lista antiga ficaria parecendo "não salvou".
        toast.error("Não foi possível atualizar a lista. Recarregue a página.");
      }
    } catch {
      toast.error("Erro de rede ao carregar especialistas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Nome obrigatório."); return; }
    if (form.telefone.replace(/\D/g, "").length < 10) { setErro("Telefone com DDD obrigatório."); return; }
    if (form.especialidades.length === 0) { setErro("Escolha ao menos uma especialidade."); return; }
    setSalvando(true);
    try {
      const especialidades = form.especialidades;
      const payload = {
        nome: form.nome, telefone: form.telefone, cpf: form.cpf, cidade: form.cidade, uf: form.uf,
        especialidades, experiencia: form.experiencia,
        tem_equipe: form.tem_equipe, tamanho_equipe: form.tamanho_equipe || null,
        observacoes: form.observacoes,
      };
      const res = await fetch(editId ? `/api/crm/especialistas/${editId}` : "/api/crm/especialistas", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErro(json.error || "Falha ao salvar."); return; }
      toast.success(editId ? "Alterações salvas." : "Especialista salvo.");
      fecharForm();
      void carregar();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, color: "#e6edf3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <HardHat size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Especialistas</h1>
        <button
          type="button"
          onClick={() => void copiarLinkConvite()}
          title="Copiar um link para o especialista se cadastrar sozinho (sem login). Fica rastreado como seu convite."
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: linkCopiado ? "#34d399" : "#8b949e", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          {linkCopiado ? <><Check size={14} strokeWidth={2.5} /> Link copiado!</> : <><Link2 size={14} strokeWidth={2.5} /> Convidar (link)</>}
        </button>
        <button
          type="button"
          onClick={() => {
            if (aberto) fecharForm();
            else { setForm(FORM_VAZIO); setEditId(null); setErro(""); setAberto(true); }
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Novo especialista
        </button>
      </div>
      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13 }}>
        Mão de obra · cadastro interno (sem login), identificado por telefone (formato da rede Obra10+).
      </p>

      {aberto && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input style={inputStyle} placeholder="Nome completo *" value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <input style={inputStyle} placeholder="Telefone / WhatsApp (com DDD) *" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <input style={inputStyle} placeholder="CPF (evita duplicado)" value={form.cpf} onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))} />
            <input style={inputStyle} placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <select style={inputStyle} value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, color: "#8b949e", marginBottom: 6 }}>
                Especialidades * <span style={{ color: "#6e7681" }}>(escolha uma ou mais — a 1ª é a principal)</span>
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ESPECIALIDADES.map((esp) => {
                  const ativo = form.especialidades.includes(esp);
                  return (
                    <button
                      key={esp}
                      type="button"
                      onClick={() => toggleEspecialidade(esp)}
                      style={{
                        padding: "7px 12px", borderRadius: 999,
                        border: `1px solid ${ativo ? "#c9a24a" : "#1d3a2c"}`,
                        background: ativo ? "rgba(201,162,74,0.15)" : "#0a140f",
                        color: ativo ? "#e0b86a" : "#8b949e",
                        fontSize: 12, fontWeight: ativo ? 700 : 500, cursor: "pointer",
                      }}
                    >
                      {ativo ? "✓ " : "+ "}{esp}
                    </button>
                  );
                })}
              </div>
            </div>
            <select style={inputStyle} value={form.experiencia} onChange={(e) => setForm((f) => ({ ...f, experiencia: e.target.value }))}>
              <option value="">Tempo de experiência</option>
              {EXPERIENCIAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", gap: 8, flex: "1 1 280px" }}>
                {[
                  { label: "Trabalha sozinho", val: false },
                  { label: "Tem equipe", val: true },
                ].map((opt) => {
                  const ativo = form.tem_equipe === opt.val;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, tem_equipe: opt.val }))}
                      style={{
                        flex: 1, padding: "9px 12px", borderRadius: 8,
                        border: `1px solid ${ativo ? "#c9a24a" : "#1d3a2c"}`,
                        background: ativo ? "rgba(201,162,74,0.15)" : "#0a140f",
                        color: ativo ? "#e0b86a" : "#8b949e",
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {form.tem_equipe && (
                <input style={{ ...inputStyle, width: 130 }} type="number" placeholder="Nº pessoas" value={form.tamanho_equipe} onChange={(e) => setForm((f) => ({ ...f, tamanho_equipe: e.target.value }))} />
              )}
            </div>
            <textarea style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 60 }} placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>
          {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={salvando} onClick={() => void salvar()}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Salvando…" : editId ? "Salvar alterações" : "Salvar especialista"}
            </button>
            <button type="button" onClick={fecharForm} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #1d3a2c", borderRadius: 12 }}>
          Nenhum especialista cadastrado ainda. Clique em <strong style={{ color: "#c9a24a" }}>Novo especialista</strong>.
        </div>
      ) : (
        <div style={{ border: "1px solid #1d3a2c", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((e, i) => (
            <div
              key={e.id}
              onClick={() => void editar(e.id)}
              title="Editar especialista"
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #16271e" : "none", cursor: "pointer" }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {e.nome}
                  {e.verificado ? <BadgeCheck size={15} color="#34d399" aria-label="Verificado" /> : null}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>
                  {e.codigo ? `${e.codigo} · ` : ""}{e.especialidade_principal || (e.especialidades && e.especialidades[0]) || "—"}
                  {e.cidade ? ` · ${e.cidade}${e.uf ? `/${e.uf}` : ""}` : ""}{e.tem_equipe ? " · com equipe" : ""}
                </p>
              </div>
              {e.experiencia ? <span style={{ fontSize: 11, color: "#8b949e" }}>{e.experiencia}</span> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
