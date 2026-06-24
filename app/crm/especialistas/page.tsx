"use client";

import { useCallback, useEffect, useState } from "react";
import { HardHat, Plus, BadgeCheck } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

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

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const EXPERIENCIAS = ["Menos de 1 ano", "1 a 3 anos", "3 a 5 anos", "5 a 10 anos", "Mais de 10 anos"];

const inputStyle: React.CSSProperties = {
  width: "100%", padding: 10, borderRadius: 8, border: "1px solid #30363d",
  background: "#0d1117", color: "#e6edf3", fontSize: 13,
};

export default function EspecialistasPage() {
  const [lista, setLista] = useState<Especialista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({
    nome: "", telefone: "", cidade: "", uf: "", especialidades: "",
    experiencia: "", tem_equipe: false, tamanho_equipe: "", observacoes: "",
  });

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/especialistas", { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Especialista[] };
      if (res.ok) setLista(json.data ?? []);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Nome obrigatório."); return; }
    if (form.telefone.replace(/\D/g, "").length < 10) { setErro("Telefone com DDD obrigatório."); return; }
    setSalvando(true);
    try {
      const especialidades = form.especialidades.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/crm/especialistas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          nome: form.nome, telefone: form.telefone, cidade: form.cidade, uf: form.uf,
          especialidades, experiencia: form.experiencia,
          tem_equipe: form.tem_equipe, tamanho_equipe: form.tamanho_equipe || null,
          observacoes: form.observacoes,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) { setErro(json.error || "Falha ao salvar."); return; }
      setForm({ nome: "", telefone: "", cidade: "", uf: "", especialidades: "", experiencia: "", tem_equipe: false, tamanho_equipe: "", observacoes: "" });
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
        <HardHat size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>Especialistas</h1>
        <button
          type="button"
          onClick={() => setAberto((a) => !a)}
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
            <input style={inputStyle} placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <select style={inputStyle} value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
            <input style={{ ...inputStyle, gridColumn: "1 / -1" }} placeholder="Especialidades (separadas por vírgula — 1ª é a principal)" value={form.especialidades} onChange={(e) => setForm((f) => ({ ...f, especialidades: e.target.value }))} />
            <select style={inputStyle} value={form.experiencia} onChange={(e) => setForm((f) => ({ ...f, experiencia: e.target.value }))}>
              <option value="">Tempo de experiência</option>
              {EXPERIENCIAS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#8b949e", cursor: "pointer" }}>
                <input type="checkbox" checked={form.tem_equipe} onChange={(e) => setForm((f) => ({ ...f, tem_equipe: e.target.checked }))} />
                Tem equipe
              </label>
              {form.tem_equipe && (
                <input style={{ ...inputStyle, width: 120 }} type="number" placeholder="Nº pessoas" value={form.tamanho_equipe} onChange={(e) => setForm((f) => ({ ...f, tamanho_equipe: e.target.value }))} />
              )}
            </div>
            <textarea style={{ ...inputStyle, gridColumn: "1 / -1", minHeight: 60 }} placeholder="Observações" value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
          </div>
          {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={salvando} onClick={() => void salvar()}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Salvando…" : "Salvar especialista"}
            </button>
            <button type="button" onClick={() => setAberto(false)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #30363d", background: "transparent", color: "#8b949e", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #30363d", borderRadius: 12 }}>
          Nenhum especialista cadastrado ainda. Clique em <strong style={{ color: "#c9a24a" }}>Novo especialista</strong>.
        </div>
      ) : (
        <div style={{ border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((e, i) => (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #21262d" : "none" }}>
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
