"use client";

/**
 * Propostas do lead — ciclo de vida completo (decisão do dono). Cria estruturada (serviço
 * Click-and-Go + escopo/prazo/validade), card com pill colorida/valor/total/expira-em/carimbos,
 * e ações de ciclo (Enviar/Aceitar/Recusar+motivo/Reenviar). "Gerar rascunho" pré-preenche pelo
 * que a ficha já sabe (interesse+valor), humano confirma antes de enviar. AUDITORIA-CICLO-LEAD-v1.md.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Send, Check, X, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { propostaStatusCor, propostaStatusLabel, diasParaExpirar } from "@/lib/crm/proposta-status";

const BORDA = "rgba(48,54,61,0.38)";
const BG = "rgba(8,12,20,0.65)";
const DEEP = "#0a140f";
const DOURADO = "#c9a24a";
const TXT = "#e6edf3";
const DIM = "#8b949e";
const VERDE = "#34d399";

type Servico = { id: string; nome: string; categoria: string | null; faixa_preco_min: number | null; faixa_preco_max: number | null; prazo_medio_dias: number | null };
type Proposta = {
  id: string; titulo: string; valor: number; escopo: string | null; prazo_dias: number | null;
  validade_dias: number | null; servico_id: string | null; status: string; criado_em: string;
  enviada_em: string | null; aprovado_em: string | null; aprovado_por: string | null;
  respondida_em: string | null; motivo_recusa: string | null;
};

const brl = (v: number | null | undefined) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR")}`;
const dataBR = (iso: string | null | undefined) => { if (!iso) return ""; try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso)); } catch { return ""; } };

export function LeadPropostasPanel({ leadId, interessePadrao, valorPadrao }: { leadId: string; interessePadrao?: string | null; valorPadrao?: number | null }) {
  const [lista, setLista] = useState<Proposta[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [abrirForm, setAbrirForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recusando, setRecusando] = useState<{ id: string; motivo: string } | null>(null);
  const [sugerido, setSugerido] = useState(false);

  // Form
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [servicoId, setServicoId] = useState("");
  const [escopo, setEscopo] = useState("");
  const [prazoDias, setPrazoDias] = useState("");
  const [validadeDias, setValidadeDias] = useState("7");

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/propostas`, { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Proposta[] };
      setLista(json.data ?? []);
    } catch { /* silencioso */ }
  }, [leadId]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/crm/servicos`, { headers: internalApiHeaders() });
        const json = (await res.json()) as { servicos?: Servico[] };
        setServicos(json.servicos ?? []);
      } catch { /* sem catálogo → Click-and-Go some, form manual segue */ }
    })();
  }, []);

  const total = useMemo(() => lista.reduce((s, p) => s + (Number(p.valor) || 0), 0), [lista]);

  const limparForm = () => { setTitulo(""); setValor(""); setServicoId(""); setEscopo(""); setPrazoDias(""); setValidadeDias("7"); setSugerido(false); setErro(null); };

  function escolherServico(id: string) {
    setServicoId(id);
    const s = servicos.find((x) => x.id === id);
    if (s) {
      if (!titulo.trim()) setTitulo(s.nome);
      if (!valor && s.faixa_preco_min) setValor(String(s.faixa_preco_min));
      if (!prazoDias && s.prazo_medio_dias) setPrazoDias(String(s.prazo_medio_dias));
    }
  }

  function gerarRascunho() {
    // IA-first leve: pré-preenche pelo que a ficha já sabe (sem depender de LLM — degrada gracioso).
    const interesse = (interessePadrao || "").trim();
    setTitulo(interesse ? `Proposta — ${interesse}` : "Proposta");
    if (valorPadrao && valorPadrao > 0) setValor(String(valorPadrao));
    setEscopo(
      interesse
        ? `Escopo sugerido a partir do interesse do cliente: ${interesse}.\n\n- Objetivo:\n- Entregáveis:\n- Observações:`
        : "- Objetivo:\n- Entregáveis:\n- Observações:"
    );
    setSugerido(true);
    setAbrirForm(true);
  }

  async function criar() {
    if (!titulo.trim()) { setErro("Informe o título."); return; }
    setSalvando(true); setErro(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/propostas`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          titulo: titulo.trim(), valor: Number(valor.replace(",", ".")) || 0,
          escopo: escopo.trim() || null, prazo_dias: prazoDias ? Number(prazoDias) : null,
          validade_dias: validadeDias ? Number(validadeDias) : 7, servico_id: servicoId || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(json.error || "Não foi possível criar."); return; }
      limparForm(); setAbrirForm(false); await carregar();
    } catch { setErro("Falha de rede."); } finally { setSalvando(false); }
  }

  async function mudarStatus(id: string, status: string, extra?: Record<string, unknown>) {
    setSalvando(true); setErro(null);
    try {
      const res = await fetch(`/api/crm/leads/${leadId}/propostas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ status, ...extra }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) { setErro(json.error || "Não foi possível atualizar."); return; }
      setRecusando(null); await carregar();
    } catch { setErro("Falha de rede."); } finally { setSalvando(false); }
  }

  async function excluir(id: string) {
    setSalvando(true);
    try {
      await fetch(`/api/crm/leads/${leadId}/propostas/${id}`, { method: "DELETE", headers: internalApiHeaders() });
      await carregar();
    } catch { /* silencioso */ } finally { setSalvando(false); }
  }

  return (
    <div style={{ borderRadius: 12, border: `1px solid ${BORDA}`, background: BG, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7d8a99" }}>Propostas</p>
        {lista.length > 0 ? (
          <span style={{ fontSize: 11, color: DIM, fontVariantNumeric: "tabular-nums" }}>{lista.length} · total {brl(total)}</span>
        ) : null}
      </div>

      {lista.length === 0 ? (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: DIM }}>Nenhuma proposta ainda. Crie uma abaixo — a IA pode gerar o rascunho.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((p) => {
            const cor = propostaStatusCor(p.status);
            const st = (p.status || "").toLowerCase();
            const dias = st === "enviada" ? diasParaExpirar(p.enviada_em, p.validade_dias) : null;
            return (
              <li key={p.id} style={{ borderRadius: 10, border: `1px solid ${BORDA}`, background: DEEP, padding: "10px 12px", borderLeft: `3px solid ${cor}` }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: TXT }}>{p.titulo || "—"}</span>
                  <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: cor, background: `${cor}1f`, borderRadius: 5, padding: "2px 6px" }}>{propostaStatusLabel(p.status)}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, flexWrap: "wrap" }}>
                  <strong style={{ color: DOURADO, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{brl(p.valor)}</strong>
                  {p.prazo_dias ? <span style={{ fontSize: 11, color: DIM }}>{p.prazo_dias}d execução</span> : null}
                  {dias != null ? <span style={{ fontSize: 11, color: dias <= 2 ? "#f0aba8" : DIM }}>{dias >= 0 ? `expira em ${dias}d` : "expirada"}</span> : null}
                </div>
                {p.escopo ? <p style={{ margin: "6px 0 0", fontSize: 12, color: "#b9c2cc", whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.escopo}</p> : null}
                {p.motivo_recusa ? <p style={{ margin: "6px 0 0", fontSize: 11, color: "#f0aba8" }}>Motivo: {p.motivo_recusa}</p> : null}

                {/* Carimbos (o sistema mostra o que fez) */}
                <div style={{ marginTop: 6, fontSize: 10.5, color: "#6b7480", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {p.enviada_em ? <span>Enviada {dataBR(p.enviada_em)}</span> : null}
                  {p.aprovado_em ? <span>Aprovada {dataBR(p.aprovado_em)}</span> : null}
                  {p.respondida_em ? <span>Respondida {dataBR(p.respondida_em)}</span> : null}
                </div>

                {/* Ações de ciclo condicionais ao status */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {st === "rascunho" ? (
                    <>
                      <BotaoAcao cor={DOURADO} onClick={() => void mudarStatus(p.id, "enviada")} disabled={salvando}><Send size={12} /> Enviar</BotaoAcao>
                      <BotaoAcao cor="#f0aba8" ghost onClick={() => void excluir(p.id)} disabled={salvando}><Trash2 size={12} /> Excluir</BotaoAcao>
                    </>
                  ) : null}
                  {st === "enviada" ? (
                    <>
                      <BotaoAcao cor={VERDE} onClick={() => void mudarStatus(p.id, "aceita")} disabled={salvando}><Check size={12} /> Aceita</BotaoAcao>
                      <BotaoAcao cor="#f0aba8" ghost onClick={() => setRecusando({ id: p.id, motivo: "" })} disabled={salvando}><X size={12} /> Recusada</BotaoAcao>
                    </>
                  ) : null}
                  {st === "expirada" ? (
                    <BotaoAcao cor={DOURADO} onClick={() => void mudarStatus(p.id, "enviada")} disabled={salvando}><RotateCcw size={12} /> Reenviar</BotaoAcao>
                  ) : null}
                </div>

                {recusando?.id === p.id ? (
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <input value={recusando.motivo} onChange={(e) => setRecusando({ id: p.id, motivo: e.target.value })} placeholder="Motivo da recusa (obrigatório)" style={campo} autoFocus />
                    <div style={{ display: "flex", gap: 6 }}>
                      <BotaoAcao cor="#f0aba8" onClick={() => recusando.motivo.trim() && void mudarStatus(p.id, "recusada", { motivo_recusa: recusando.motivo.trim() })} disabled={salvando || !recusando.motivo.trim()}>Confirmar recusa</BotaoAcao>
                      <BotaoAcao cor={DIM} ghost onClick={() => setRecusando(null)}>Cancelar</BotaoAcao>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {abrirForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: `1px solid ${BORDA}`, paddingTop: 12 }}>
          {sugerido ? (
            <p style={{ margin: 0, fontSize: 11, color: DOURADO, display: "flex", alignItems: "center", gap: 4 }}><Sparkles size={12} /> A IA preencheu com o que sabe deste lead. Revise e confirme antes de enviar.</p>
          ) : null}
          {servicos.length > 0 ? (
            <label style={col}><span style={rotulo}>Serviço (opcional)</span>
              <select value={servicoId} onChange={(e) => escolherServico(e.target.value)} style={campo}>
                <option value="">— escolher serviço —</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}{s.categoria ? ` · ${s.categoria}` : ""}</option>)}
              </select>
            </label>
          ) : null}
          <label style={col}><span style={rotulo}>Título</span>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título da proposta" style={campo} /></label>
          <div style={{ display: "flex", gap: 8 }}>
            <label style={{ ...col, flex: 1 }}><span style={rotulo}>Valor (R$)</span>
              <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0" style={campo} /></label>
            <label style={{ ...col, width: 90 }}><span style={rotulo}>Prazo (d)</span>
              <input value={prazoDias} onChange={(e) => setPrazoDias(e.target.value)} inputMode="numeric" placeholder="—" style={campo} /></label>
            <label style={{ ...col, width: 90 }}><span style={rotulo}>Validade (d)</span>
              <input value={validadeDias} onChange={(e) => setValidadeDias(e.target.value)} inputMode="numeric" placeholder="7" style={campo} /></label>
          </div>
          <label style={col}><span style={rotulo}>Escopo</span>
            <textarea value={escopo} onChange={(e) => setEscopo(e.target.value)} rows={4} placeholder="O que está incluso na proposta" style={{ ...campo, resize: "vertical", minHeight: 72 }} /></label>
          {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f0aba8" }}>{erro}</p> : null}
          <div style={{ display: "flex", gap: 6 }}>
            <BotaoAcao cor={DOURADO} onClick={() => void criar()} disabled={salvando}>{salvando ? "Salvando…" : "Salvar rascunho"}</BotaoAcao>
            <BotaoAcao cor={DIM} ghost onClick={() => { setAbrirForm(false); limparForm(); }}>Cancelar</BotaoAcao>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6 }}>
          <BotaoAcao cor={DOURADO} onClick={() => { limparForm(); setAbrirForm(true); }}><Plus size={13} /> Nova proposta</BotaoAcao>
          <BotaoAcao cor={DOURADO} ghost onClick={gerarRascunho}><Sparkles size={13} /> Gerar rascunho</BotaoAcao>
        </div>
      )}
    </div>
  );
}

function BotaoAcao({ children, cor, ghost, onClick, disabled }: { children: React.ReactNode; cor: string; ghost?: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, minHeight: 34, padding: "0 12px", borderRadius: 8,
        border: ghost ? `1px solid ${BORDA}` : "none", background: ghost ? "transparent" : cor,
        color: ghost ? cor : "#003b26", fontSize: 12, fontWeight: 700, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
      }}>
      {children}
    </button>
  );
}

const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const rotulo: React.CSSProperties = { fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: DIM };
const campo: React.CSSProperties = { minHeight: 36, borderRadius: 8, border: `1px solid ${BORDA}`, background: DEEP, color: TXT, padding: "0 10px", fontSize: 13 };
