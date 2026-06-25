"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HardHat, CheckCircle2 } from "lucide-react";
import { ESPECIALIDADES, EXPERIENCIAS, UFS } from "@/lib/crm/especialidades";

const input: React.CSSProperties = {
  width: "100%", padding: 12, borderRadius: 8, border: "1px solid #30363d",
  background: "#0d1117", color: "#e6edf3", fontSize: 14, boxSizing: "border-box",
};

function FormConvite() {
  const sp = useSearchParams();
  const por = sp.get("por") || "";

  const [form, setForm] = useState({
    nome: "", telefone: "", cidade: "", uf: "",
    especialidades: [] as string[], experiencia: "", tem_equipe: false,
  });
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [okCodigo, setOkCodigo] = useState<string | null>(null);

  function toggle(esp: string) {
    setForm((f) => ({
      ...f,
      especialidades: f.especialidades.includes(esp)
        ? f.especialidades.filter((x) => x !== esp)
        : [...f.especialidades, esp],
    }));
  }

  async function enviar() {
    setErro("");
    if (!form.nome.trim()) { setErro("Diga seu nome completo."); return; }
    if (form.telefone.replace(/\D/g, "").length < 10) { setErro("Telefone com DDD (WhatsApp)."); return; }
    if (form.especialidades.length === 0) { setErro("Escolha ao menos uma especialidade."); return; }
    setEnviando(true);
    try {
      const res = await fetch("/api/public/especialista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, por }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; codigo?: string; error?: string };
      if (!res.ok || !json.ok) { setErro(json.error || "Não foi possível enviar. Tente de novo."); return; }
      setOkCodigo(json.codigo || "OK");
    } catch {
      setErro("Sem conexão. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (okCodigo) {
    return (
      <div style={{ textAlign: "center", padding: "32px 8px" }}>
        <CheckCircle2 size={56} color="#34d399" style={{ margin: "0 auto 16px" }} />
        <h2 style={{ margin: "0 0 8px", fontSize: 22, color: "#e6edf3" }}>Cadastro enviado!</h2>
        <p style={{ margin: 0, color: "#8b949e", fontSize: 14 }}>
          Recebemos seus dados{okCodigo !== "OK" ? <> (código <strong style={{ color: "#c9a24a" }}>{okCodigo}</strong>)</> : null}.
          A equipe vai te chamar no WhatsApp. Pode fechar esta página.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <input style={input} placeholder="Seu nome completo *" value={form.nome}
          onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        <input style={input} placeholder="WhatsApp com DDD *" value={form.telefone}
          onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
        <input style={input} placeholder="Cidade" value={form.cidade}
          onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} />
        <select style={input} value={form.uf} onChange={(e) => setForm((f) => ({ ...f, uf: e.target.value }))}>
          <option value="">Estado (UF)</option>
          {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
        </select>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, color: "#8b949e", marginBottom: 8 }}>
          O que você faz? * <span style={{ color: "#6e7681" }}>(escolha uma ou mais)</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ESPECIALIDADES.map((esp) => {
            const ativo = form.especialidades.includes(esp);
            return (
              <button key={esp} type="button" onClick={() => toggle(esp)} aria-pressed={ativo}
                style={{
                  padding: "8px 13px", borderRadius: 999,
                  border: `1px solid ${ativo ? "#c9a24a" : "#30363d"}`,
                  background: ativo ? "rgba(201,162,74,0.15)" : "#0d1117",
                  color: ativo ? "#e0b86a" : "#8b949e",
                  fontSize: 13, fontWeight: ativo ? 700 : 500, cursor: "pointer",
                }}>
                {ativo ? "✓ " : "+ "}{esp}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <select style={input} value={form.experiencia} onChange={(e) => setForm((f) => ({ ...f, experiencia: e.target.value }))}>
          <option value="">Tempo de experiência</option>
          {EXPERIENCIAS.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          {[{ label: "Trabalho sozinho", val: false }, { label: "Tenho equipe", val: true }].map((opt) => {
            const ativo = form.tem_equipe === opt.val;
            return (
              <button key={opt.label} type="button" onClick={() => setForm((f) => ({ ...f, tem_equipe: opt.val }))}
                style={{
                  flex: 1, padding: "11px 8px", borderRadius: 8,
                  border: `1px solid ${ativo ? "#c9a24a" : "#30363d"}`,
                  background: ativo ? "rgba(201,162,74,0.15)" : "#0d1117",
                  color: ativo ? "#e0b86a" : "#8b949e",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {erro && <p style={{ color: "#f85149", fontSize: 13, margin: 0 }}>{erro}</p>}

      <button type="button" disabled={enviando} onClick={() => void enviar()}
        style={{
          padding: "14px 16px", borderRadius: 10, border: "none",
          background: "#c9a24a", color: "#003b26", fontWeight: 800, fontSize: 15,
          cursor: enviando ? "default" : "pointer", opacity: enviando ? 0.6 : 1,
        }}>
        {enviando ? "Enviando…" : "Enviar meu cadastro"}
      </button>
    </div>
  );
}

export default function CadastroEspecialistaPublico() {
  return (
    <div style={{ minHeight: "100vh", background: "#010409", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px" }}>
      <div style={{ width: "100%", maxWidth: 620 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <HardHat size={26} color="#c9a24a" aria-hidden />
          <h1 style={{ margin: 0, fontSize: 24, color: "#e6edf3" }}>Cadastro de mão de obra</h1>
        </div>
        <p style={{ margin: "0 0 22px", color: "#8b949e", fontSize: 14, lineHeight: 1.5 }}>
          Você foi convidado para entrar na nossa base de profissionais. É rápido — só escolher o que
          você faz e deixar seu WhatsApp. Sem login, sem custo.
        </p>
        <div style={{ padding: 20, borderRadius: 16, border: "1px solid #c9a24a44", background: "#003b2618" }}>
          <Suspense fallback={<p style={{ color: "#8b949e" }}>Carregando…</p>}>
            <FormConvite />
          </Suspense>
        </div>
        <p style={{ margin: "16px 2px 0", color: "#6e7681", fontSize: 12 }}>Obra10+ · rede de profissionais</p>
      </div>
    </div>
  );
}
