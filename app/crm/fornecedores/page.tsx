"use client";

import { useCallback, useEffect, useState } from "react";
import { Handshake, Plus, Radio } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  AREAS_ATUACAO,
  isAreaAtuacaoValid,
  labelAreaAtuacao,
  normalizarAreaAtuacao,
} from "@/lib/crm/areas-atuacao";
import { MercadoLeadPicker } from "@/components/crm/leads/MercadoLeadPicker";
import { toast } from "@/components/crm/toast";

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
  mercados: string[] | null;
  recebe_leads: boolean | null;
};

/** Status de homologação (formato da rede). Define se o motor pode distribuir leads. */
const STATUS_OPCOES = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado (homologado)" },
  { value: "recusado", label: "Recusado" },
  { value: "bloqueado", label: "Bloqueado" },
] as const;

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

const STATUS_LABEL: Record<string, { txt: string; cor: string }> = {
  pendente: { txt: "Pendente", cor: "#f59e0b" },
  aprovado: { txt: "Aprovado", cor: "#34d399" },
  recusado: { txt: "Recusado", cor: "#f85149" },
  bloqueado: { txt: "Bloqueado", cor: "#8b949e" },
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: 10, borderRadius: 8, border: "1px solid #1d3a2c",
  background: "#0a140f", color: "#e6edf3", fontSize: 13,
};

export default function FornecedoresPage() {
  const [lista, setLista] = useState<Fornecedor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const FORM_VAZIO = {
    tipo_pessoa: "PJ", nome: "", cnpj: "", email: "", telefone: "",
    area_atuacao: "", cidade: "", estado: "",
    // Campos que habilitam o fornecedor no motor de distribuição.
    mercados: [] as string[], recebe_leads: false, status_acesso: "pendente",
  };
  const [form, setForm] = useState(FORM_VAZIO);

  function fecharForm() {
    setAberto(false);
    setEditId(null);
    setErro("");
    setForm(FORM_VAZIO);
  }

  async function editar(id: string) {
    setErro("");
    try {
      const res = await fetch(`/api/crm/fornecedores/${id}`, { headers: internalApiHeaders() });
      const json = (await res.json().catch(() => ({}))) as { data?: Record<string, unknown>; error?: string };
      if (!res.ok || !json.data) {
        setErro(json.error || "Não foi possível carregar.");
        return;
      }
      const f = json.data;
      setForm({
        tipo_pessoa: String(f.tipo_pessoa ?? "PJ") === "PF" ? "PF" : "PJ",
        nome: String(f.nome ?? ""),
        cnpj: String(f.cnpj ?? f.cpf ?? ""),
        email: String(f.email ?? ""),
        telefone: String(f.telefone ?? ""),
        // Normaliza para o value canônico da lista; texto livre legado é preservado como está.
        area_atuacao: ((raw) => normalizarAreaAtuacao(raw) ?? raw)(String(f.area_atuacao ?? "")),
        cidade: String(f.cidade ?? ""),
        estado: String(f.estado ?? ""),
        // Campos do motor de distribuição (mesmo formato que o motor lê).
        mercados: Array.isArray(f.mercados) ? (f.mercados as unknown[]).map(String) : [],
        recebe_leads: f.recebe_leads === true,
        status_acesso: String(f.status_acesso ?? "pendente"),
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
      const res = await fetch(editId ? `/api/crm/fornecedores/${editId}` : "/api/crm/fornecedores", {
        method: editId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(form),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        const msg = json.error || "Falha ao salvar.";
        setErro(msg);
        toast.error(msg);
        return;
      }
      toast.success(editId ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      fecharForm();
      void carregar();
    } catch {
      setErro("Erro de rede.");
      toast.error("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, color: "#e6edf3" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Handshake size={22} color="#c9a24a" aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, flex: 1 }}>
          <span className="hidden md:inline">Fornecedores</span>
        </h1>
        <button
          type="button"
          onClick={() => {
            if (aberto) fecharForm();
            else { setForm(FORM_VAZIO); setEditId(null); setErro(""); setAberto(true); }
          }}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
        >
          <Plus size={14} strokeWidth={2.5} /> Novo fornecedor
        </button>
      </div>
      <p style={{ margin: "0 0 16px", color: "#8b949e", fontSize: 13 }}>
        Mercados habilitam a distribuição de leads · homologação por status (formato da rede Obra10+).
      </p>

      {aberto && (
        <div style={{ marginBottom: 20, padding: 16, borderRadius: 12, border: "1px solid #c9a24a44", background: "#003b2622" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["PJ", "PF"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tipo_pessoa: t }))}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #1d3a2c", background: form.tipo_pessoa === t ? "#003b26" : "transparent", color: form.tipo_pessoa === t ? "#c9a24a" : "#8b949e", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {t === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <input style={inputStyle} placeholder={form.tipo_pessoa === "PJ" ? "Razão social *" : "Nome *"} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            <input style={inputStyle} placeholder={form.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} value={form.cnpj} onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))} />
            <input style={inputStyle} placeholder="E-mail" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input style={inputStyle} placeholder="Telefone / WhatsApp" value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            <select
              style={inputStyle}
              value={form.area_atuacao}
              onChange={(e) => setForm((f) => ({ ...f, area_atuacao: e.target.value }))}
            >
              <option value="">Área de atuação…</option>
              {AREAS_ATUACAO.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
              {/* Compatibilidade: preserva valor legado (texto livre) que não está na lista. */}
              {form.area_atuacao && !isAreaAtuacaoValid(form.area_atuacao) && (
                <option value={form.area_atuacao}>
                  {labelAreaAtuacao(form.area_atuacao)} (atual)
                </option>
              )}
            </select>
            <input style={inputStyle} placeholder="Cidade" value={form.cidade} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
            <select style={inputStyle} value={form.estado} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}>
              <option value="">UF</option>
              {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>

          {/* Motor de distribuição — sem isto o Hub não envia leads para este fornecedor. */}
          <div style={{ marginTop: 16, padding: 14, borderRadius: 10, border: "1px solid #c9a24a33", background: "#0a140f" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Radio size={16} color="#c9a24a" aria-hidden />
              <strong style={{ fontSize: 13, color: "#e0b86a" }}>Distribuição de leads</strong>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 12, color: "#8b949e" }}>
              O Hub casa o lead com o fornecedor por <strong style={{ color: "#e6edf3" }}>mercado</strong>. Escolha os mercados, ligue o recebimento e homologue.
            </p>

            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#c9b37a", marginBottom: 6 }}>Mercados que atende</label>
            <MercadoLeadPicker
              mercados={form.mercados}
              onToggle={(sigla, ativo) =>
                setForm((f) => ({
                  ...f,
                  mercados: ativo
                    ? [...f.mercados, sigla]
                    : f.mercados.filter((m) => m !== sigla),
                }))
              }
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", marginTop: 14 }}>
              {/* Toggle recebe_leads */}
              <button
                type="button"
                role="switch"
                aria-checked={form.recebe_leads}
                onClick={() => setForm((f) => ({ ...f, recebe_leads: !f.recebe_leads }))}
                style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", cursor: "pointer" }}
              >
                <span
                  aria-hidden
                  style={{ width: 38, height: 22, borderRadius: 999, padding: 2, background: form.recebe_leads ? "#34d399" : "#1d3a2c", transition: "background 150ms", display: "inline-flex", justifyContent: form.recebe_leads ? "flex-end" : "flex-start" }}
                >
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: "#0a140f", display: "block" }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: form.recebe_leads ? "#34d399" : "#8b949e" }}>
                  {form.recebe_leads ? "Recebendo leads" : "Não recebe leads"}
                </span>
              </button>

              {/* Status de homologação */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8b949e" }}>
                Homologação
                <select
                  style={{ ...inputStyle, width: "auto", minWidth: 180 }}
                  value={form.status_acesso}
                  onChange={(e) => setForm((f) => ({ ...f, status_acesso: e.target.value }))}
                >
                  {STATUS_OPCOES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {form.recebe_leads && form.mercados.length === 0 && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#f59e0b" }}>
                Recebimento ligado, mas sem mercado escolhido — o motor não terá como casar leads. Escolha ao menos um mercado.
              </p>
            )}
          </div>

          {erro && <p style={{ color: "#f85149", fontSize: 12, margin: "10px 0 0" }}>{erro}</p>}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" disabled={salvando} onClick={() => void salvar()}
              style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: "#c9a24a", color: "#003b26", fontWeight: 700, fontSize: 12, cursor: salvando ? "default" : "pointer", opacity: salvando ? 0.6 : 1 }}>
              {salvando ? "Salvando…" : editId ? "Salvar alterações" : "Salvar fornecedor"}
            </button>
            <button type="button" onClick={fecharForm} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #1d3a2c", background: "transparent", color: "#8b949e", fontSize: 12, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}

      {carregando ? (
        <p style={{ color: "#8b949e", fontSize: 13 }}>Carregando…</p>
      ) : lista.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: "#8b949e", border: "1px dashed #1d3a2c", borderRadius: 12 }}>
          Nenhum fornecedor cadastrado ainda. Clique em <strong style={{ color: "#c9a24a" }}>Novo fornecedor</strong>.
        </div>
      ) : (
        <div style={{ border: "1px solid #1d3a2c", borderRadius: 12, overflow: "hidden" }}>
          {lista.map((f, i) => {
            const st = STATUS_LABEL[String(f.status_acesso ?? "pendente")] ?? STATUS_LABEL.pendente;
            const mercados = Array.isArray(f.mercados) ? f.mercados.filter(Boolean) : [];
            const noMotor = f.recebe_leads === true && mercados.length > 0;
            return (
              <div
                key={f.id}
                onClick={() => void editar(f.id)}
                title="Editar fornecedor"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid #16271e" : "none", cursor: "pointer" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{f.nome}</p>
                  <p style={{ margin: 0, fontSize: 12, color: "#8b949e" }}>
                    {mercados.length ? mercados.join(" · ") : f.area_atuacao || "—"}{f.cidade ? ` · ${f.cidade}${f.estado ? `/${f.estado}` : ""}` : ""}
                  </p>
                </div>
                {noMotor && (
                  <span title="Recebendo leads do Hub" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#34d399", border: "1px solid #34d39955", borderRadius: 999, padding: "2px 8px" }}>
                    <Radio size={11} aria-hidden /> No motor
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 700, color: st.cor, border: `1px solid ${st.cor}55`, borderRadius: 999, padding: "2px 10px" }}>{st.txt}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
