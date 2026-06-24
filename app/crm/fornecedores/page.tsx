"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Fornecedor = {
  id: string;
  codigo: string | null;
  nome: string;
  tipo_pessoa: string | null;
  cnpj: string | null;
  area_atuacao: string | null;
  cidade: string | null;
  estado: string | null;
  status_acesso: string | null;
};

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const STATUS_LABEL: Record<string, { txt: string; cor: string }> = {
  pendente: { txt: "Pendente", cor: "#f59e0b" },
  aprovado: { txt: "Aprovado", cor: "#34d399" },
  recusado: { txt: "Recusado", cor: "#f85149" },
  bloqueado: { txt: "Bloqueado", cor: "#8b949e" },
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: 10, borderRadius: 8, border: "1px solid #30363d",
  background: "#0d1117", color: "#e6edf3", fontSize: 13,
};

export default function FornecedoresPage() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    tipo_pessoa: "PJ", nome: "", cnpj: "", email: "", telefone: "",
    area_atuacao: "", cidade: "", estado: "",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/fornecedores", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Fornecedor[] };
      if (res.ok) setLista(json.data ?? []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Nome obrigatório."); return; }
    setSalvando(true);
    try {
      const res = await fetch("/api/crm/fornecedores", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErro(json.error || "Falha ao salvar."); return; }
      setForm({ tipo_pessoa: "PJ", nome: "", cnpj: "", email: "", telefone: "", area_atuacao: "", cidade: "", estado: "" });
      setAberto(false);
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
        <Handshake size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Fornecedores</h1>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Novo fornecedor
        </button>
      </div>
      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13 }}>
        PJ por área de atuação · homologação por status (formato da rede Obra10+).
      </p>

      {aberto && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["PJ", "PF"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tipo_pessoa: t }))}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #30363d", background: form.tipo_pessoa === t ? "#003b26" : "transparent", color: form.tipo_pessoa === t ? "#c9a24a" : "#8b949e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input style={inputStyle} placeholder={form.tipo_pessoa === "PJ" ? "Razão social *" : "Nome *"} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <input style={inputStyle} placeholder={form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            <input style={inputStyle} placeholder="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input style={inputStyle} placeholder="Telefone / WhatsApp" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <input style={inputStyle} placeholder="Área de atuação (ex.: elétrica, materiais)" value={form.area_atuacao} onChange={(e) => setForm((f) => ({ ...f, area_atuacao: e.target.value }))} />
            <input style={inputStyle} placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <select style={inputStyle} value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
          {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={salvando} onClick={() => void salvar()}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Salvando…" : "Salvar fornecedor"}
            </button>
            <button type="button" onClick={() => setAberto(false)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #30363d", borderRadius: 12 }}>
          Nenhum fornecedor cadastrado ainda. Clique em <strong style={{ color: "#c9a24a" }}>Novo fornecedor</strong>.
        </div>
      ) : (
        <div style={{ border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((f, i) => {
            const st = STATUS_LABEL[String(f.status_acesso ?? "pendente")] ?? STATUS_LABEL.pendente;
            return (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #21262d" : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{f.nome}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>
                    {f.codigo ? `${f.codigo} · ` : ""}{f.area_atuacao || "—"}{f.cidade ? ` · ${f.cidade}${f.estado ? `/${f.estado}` : ""}` : ""}
                  </p>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: st.cor, border: `1px solid ${st.cor}55`, borderRadius: 999, padding: "2px 10px" }}>{st.txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
