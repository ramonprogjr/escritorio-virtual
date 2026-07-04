"use client";

import { useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import { UFS } from "@/lib/crm/especialidades";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";

/**
 * Cadastro MANUAL de parceiro (inline, sem drawer) — espelha o form do especialista.
 * O comercial cadastra na hora quem já conhece; o link permanente ("Convidar") continua
 * para quem se cadastra sozinho. Posta em /api/crm/parceiros (guarded, tenant da sessão,
 * atribuição de "quem cadastrou" gravada na trilha pelo próprio server).
 */

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type TipoPessoa = "PF" | "PJ";

// Tokens do design system travado (--obra-*), com fallback — nunca hex cru solto.
const OB = {
  borda: "var(--obra-borda, #1d3a2c)",
  campo: "var(--obra-dark, #0a140f)",
  texto: "var(--obra-texto, #e6edf3)",
  texto2: "var(--obra-texto-2, #8b949e)",
  dourado: "var(--obra-dourado, #c9a24a)",
  douradoClaro: "var(--obra-dourado-light, #e0b86a)",
  verde: "var(--obra-verde, #003b26)",
  erro: "var(--obra-vermelho-light, #dc2626)",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 8,
  border: `1px solid ${OB.borda}`,
  background: OB.campo,
  color: OB.texto,
  fontSize: 13,
  boxSizing: "border-box",
};

const FORM_VAZIO = {
  nome: "",
  telefone: "",
  cpf: "",
  cnpj: "",
  email: "",
  mercado: "",
  cidade: "",
  uf: "",
};

export function ParceiroFormManual({ open, onClose, onCreated }: Props) {
  const [tipo, setTipo] = useState<TipoPessoa>("PF");
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  // Colapsar o form (inclusive pelo botão do header) zera campos e erro — sem estado obsoleto.
  useEffect(() => {
    if (!open) {
      setForm(FORM_VAZIO);
      setTipo("PF");
      setErro("");
    }
  }, [open]);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function fechar() {
    setForm(FORM_VAZIO);
    setTipo("PF");
    setErro("");
    onClose();
  }

  async function salvar() {
    setErro("");
    const nome = form.nome.trim();
    if (!nome) {
      setErro(tipo === "PJ" ? "Razão social obrigatória." : "Nome obrigatório.");
      return;
    }
    if (form.telefone.replace(/\D/g, "").length < 10) {
      setErro("Telefone com DDD obrigatório.");
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        nome,
        telefone: form.telefone,
        // PF envia CPF, PJ envia CNPJ — o outro fica de fora (dedup do lado certo).
        cpf: tipo === "PF" ? form.cpf : "",
        cnpj: tipo === "PJ" ? form.cnpj : "",
        email: form.email,
        mercado: form.mercado,
        cidade: form.cidade,
        estado: form.uf,
      };
      const res = await fetch("/api/crm/parceiros", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao cadastrar parceiro.");
        return;
      }
      toast.success("Parceiro cadastrado em Captação.");
      fechar();
      onCreated();
    } catch {
      setErro("Erro de rede.");
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  const docLabel = tipo === "PF" ? "CPF (evita duplicado)" : "CNPJ (evita duplicado)";
  const docValue = tipo === "PF" ? form.cpf : form.cnpj;
  const docKey: "cpf" | "cnpj" = tipo === "PF" ? "cpf" : "cnpj";

  return (
    <div
      style={{
        marginBottom: 12,
        padding: 16,
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${OB.dourado} 33%, transparent)`,
        background: `color-mix(in srgb, ${OB.verde} 14%, transparent)`,
      }}
    >
      {/* Ring de foco visível (teclado) sem depender de config do Tailwind. */}
      <style>{`
        .pf-parc-field:focus-visible { outline: 2px solid ${OB.dourado}; outline-offset: 1px; }
        .pf-parc-btn:focus-visible { outline: 2px solid ${OB.dourado}; outline-offset: 2px; }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <UserPlus size={16} color={OB.dourado} aria-hidden />
        <strong style={{ color: OB.texto, fontSize: 14 }}>Novo parceiro (cadastro manual)</strong>
      </div>

      {/* PF / PJ */}
      <div role="group" aria-label="Tipo de pessoa" style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {(["PF", "PJ"] as TipoPessoa[]).map((t) => {
          const ativo = tipo === t;
          return (
            <button
              key={t}
              type="button"
              className="pf-parc-btn"
              aria-pressed={ativo}
              disabled={salvando}
              onClick={() => setTipo(t)}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 8,
                border: `1px solid ${ativo ? OB.dourado : OB.borda}`,
                background: ativo ? `color-mix(in srgb, ${OB.dourado} 15%, transparent)` : OB.campo,
                color: ativo ? OB.douradoClaro : OB.texto2,
                fontSize: 12,
                fontWeight: 700,
                cursor: salvando ? "default" : "pointer",
                opacity: salvando ? 0.7 : 1,
              }}
            >
              {t === "PF" ? "Pessoa física" : "Pessoa jurídica"}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        <input
          className="pf-parc-field"
          style={inputStyle}
          aria-label={tipo === "PJ" ? "Razão social" : "Nome completo"}
          placeholder={tipo === "PJ" ? "Razão social *" : "Nome completo *"}
          value={form.nome}
          onChange={(e) => set("nome", e.target.value)}
        />
        <input
          className="pf-parc-field"
          style={inputStyle}
          aria-label="Telefone ou WhatsApp com DDD"
          placeholder="Telefone / WhatsApp (com DDD) *"
          value={form.telefone}
          onChange={(e) => set("telefone", e.target.value)}
        />
        <input
          className="pf-parc-field"
          style={inputStyle}
          aria-label={docLabel}
          placeholder={docLabel}
          value={docValue}
          onChange={(e) => set(docKey, e.target.value)}
        />
        <input
          className="pf-parc-field"
          style={inputStyle}
          type="email"
          aria-label="E-mail"
          placeholder="E-mail"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
        <select
          className="pf-parc-field"
          style={inputStyle}
          aria-label="Mercado"
          value={form.mercado}
          onChange={(e) => set("mercado", e.target.value)}
        >
          <option value="">Mercado</option>
          {MERCADOS_PREFIXO_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          className="pf-parc-field"
          style={inputStyle}
          aria-label="Cidade"
          placeholder="Cidade"
          value={form.cidade}
          onChange={(e) => set("cidade", e.target.value)}
        />
        <select
          className="pf-parc-field"
          style={inputStyle}
          aria-label="UF"
          value={form.uf}
          onChange={(e) => set("uf", e.target.value)}
        >
          <option value="">UF</option>
          {UFS.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>
      </div>

      {erro && (
        <p role="alert" aria-live="polite" style={{ color: OB.erro, fontSize: 12, margin: "10px 0 0" }}>
          {erro}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="pf-parc-btn"
          disabled={salvando}
          onClick={() => void salvar()}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: "none",
            background: OB.dourado,
            color: OB.verde,
            fontWeight: 700,
            fontSize: 12,
            cursor: salvando ? "default" : "pointer",
            opacity: salvando ? 0.6 : 1,
          }}
        >
          {salvando ? "Salvando…" : "Salvar parceiro"}
        </button>
        <button
          type="button"
          className="pf-parc-btn"
          disabled={salvando}
          onClick={fechar}
          style={{
            padding: "9px 16px",
            borderRadius: 8,
            border: `1px solid ${OB.borda}`,
            background: "transparent",
            color: OB.texto2,
            fontSize: 12,
            cursor: salvando ? "default" : "pointer",
            opacity: salvando ? 0.6 : 1,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
