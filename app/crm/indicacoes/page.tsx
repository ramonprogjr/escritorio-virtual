"use client";

/**
 * "Minhas indicações" (+ Indicar em 1 toque) — desenho: docs/DESIGN-INDICAR-1-TOQUE.md.
 * Lista os comprovantes (semáforo por estágio) + botão "Indicar" que abre um card mínimo
 * (nome + telefone; mercado/obs opcionais) → POST /api/crm/indicacoes → comprovante carimbado.
 * A prova nasce ANTES do negócio — é o que tira a indicação do WhatsApp. Dark verde+dourado.
 */
import { useCallback, useEffect, useState } from "react";
import { UserPlus, CheckCircle2, AlertTriangle, X, Share2, Stamp } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";
const VERDE = "#34d399";

type Indicacao = { lead_id: string; indicado_nome: string; indicado_telefone: string; estagio: string; criado_em: string; comprovante_codigo: string | null; regra_texto: string | null; resultado: string };
type Comprovante = { comprovante_codigo: string; indicador_nome: string; regra_texto: string; criado_em: string; resultado: string };

const dataBR = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)); } catch { return iso; } };
const SEMAFORO: Record<string, { label: string; cor: string }> = {
  novo: { label: "Enviada — na fila do Hub", cor: TXT_DIM }, contatado: { label: "Vista / em contato", cor: DOURADO },
  qualificado: { label: "Andando", cor: DOURADO }, ganho: { label: "Fechou 🎉", cor: VERDE }, perdido: { label: "Perdida", cor: "#f0aba8" },
};

export default function IndicacoesPage() {
  const [lista, setLista] = useState<Indicacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const res = await fetch("/api/crm/indicacoes", { headers: internalApiHeaders() });
      const json = (await res.json()) as { indicacoes?: Indicacao[] };
      setLista(json.indicacoes ?? []);
    } catch { /* silencioso */ } finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 48px", color: TXT }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Stamp size={22} color={DOURADO} aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", flex: 1 }}>Minhas indicações</h1>
        <button type="button" onClick={() => setAberto(true)} style={{ ...botao, display: "flex", alignItems: "center", gap: 6 }}>
          <UserPlus size={16} aria-hidden /> Indicar
        </button>
      </header>
      <p style={{ margin: "0 0 20px", color: TXT_DIM, fontSize: 13 }}>Cada indicação vira um comprovante carimbado — a prova de quem trouxe o cliente.</p>

      {carregando ? (
        <div style={{ height: 80, borderRadius: 12, background: BG_CARD, border: `1px solid ${BORDA}` }} aria-busy />
      ) : lista.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 16px", color: TXT_DIM }}>
          <Stamp size={28} color={TXT_DIM} aria-hidden />
          <p style={{ marginTop: 10, fontSize: 14 }}>Nenhuma indicação ainda.</p>
          <button type="button" onClick={() => setAberto(true)} style={{ ...botao, marginTop: 10 }}>Fazer a primeira indicação</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lista.map((i) => {
            const sem = SEMAFORO[i.estagio] ?? { label: i.estagio, cor: TXT_DIM };
            return (
              <div key={i.lead_id} style={{ ...linha, borderLeft: `3px solid ${sem.cor}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: TXT, fontWeight: 600 }}>{i.indicado_nome}</div>
                  <div style={{ fontSize: 12, color: sem.cor, marginTop: 2 }}>{sem.label}{i.resultado === "duplicado" ? " · já estava no Hub" : ""}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: DOURADO, fontVariantNumeric: "tabular-nums" }}>{i.comprovante_codigo}</div>
                  <div style={{ fontSize: 11, color: TXT_DIM }}>{dataBR(i.criado_em)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {aberto ? <IndicarCard onFechar={() => setAberto(false)} onFeito={() => { setAberto(false); void carregar(); }} /> : null}
    </div>
  );
}

function IndicarCard({ onFechar, onFeito }: { onFechar: () => void; onFeito: () => void }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comprovante, setComprovante] = useState<(Comprovante & { aviso?: string }) | null>(null);

  const confirmar = useCallback(async () => {
    if (salvando) return;
    if (!nome.trim() || !telefone.trim()) { setErro("Preencha nome e telefone."); return; }
    setSalvando(true); setErro(null);
    try {
      const res = await fetch("/api/crm/indicacoes", {
        method: "POST", headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim(), observacao: observacao.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; comprovante?: Comprovante; aviso?: string };
      if (!res.ok || !json.ok || !json.comprovante) { setErro(json.error || "Não foi possível registrar."); return; }
      setComprovante({ ...json.comprovante, aviso: json.aviso });
    } catch { setErro("Falha de rede."); } finally { setSalvando(false); }
  }, [salvando, nome, telefone, observacao]);

  const compartilhar = useCallback(() => {
    if (!comprovante) return;
    const texto = `Indicação registrada ✓\n${comprovante.comprovante_codigo}\n${dataBR(comprovante.criado_em)}`;
    if (typeof navigator !== "undefined" && navigator.share) void navigator.share({ text: texto }).catch(() => {});
  }, [comprovante]);

  return (
    <div style={overlay} role="dialog" aria-label="Indicar" onClick={onFechar}>
      <div style={sideover} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <UserPlus size={18} color={DOURADO} aria-hidden />
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TXT, flex: 1 }}>{comprovante ? "Comprovante" : "Indicar em 1 toque"}</h2>
          <button type="button" onClick={onFechar} aria-label="Fechar" style={{ background: "none", border: "none", color: TXT_DIM, cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {comprovante ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ border: `1px solid ${DOURADO}55`, borderRadius: 12, background: BG_DEEP, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: VERDE, fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={15} aria-hidden /> Indicação registrada</div>
              <div style={{ marginTop: 8, fontSize: 18, fontWeight: 800, color: DOURADO, letterSpacing: "0.02em" }}>{comprovante.comprovante_codigo}</div>
              <div style={{ fontSize: 12, color: TXT_DIM }}>{dataBR(comprovante.criado_em)} · por {comprovante.indicador_nome}</div>
              <p style={{ margin: "10px 0 0", fontSize: 12, color: TXT_DIM, lineHeight: 1.5 }}>{comprovante.regra_texto}</p>
              {comprovante.aviso ? <p style={{ margin: "8px 0 0", fontSize: 12, color: DOURADO }}>{comprovante.aviso}</p> : null}
            </div>
            <button type="button" onClick={compartilhar} style={{ ...botaoSec, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Share2 size={15} aria-hidden /> Compartilhar</button>
            <button type="button" onClick={onFeito} style={botao}>Ver minhas indicações</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={col}><span style={rotulo}>Nome de quem você indica</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Fernanda" style={campo} aria-label="Nome" /></label>
            <label style={col}><span style={rotulo}>Telefone / WhatsApp</span>
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" placeholder="(11) 9…" style={campo} aria-label="Telefone" /></label>
            <label style={col}><span style={rotulo}>Observação (opcional)</span>
              <input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: reforma de cozinha" style={campo} aria-label="Observação" /></label>
            {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f0aba8", display: "flex", gap: 4 }}><AlertTriangle size={13} aria-hidden /> {erro}</p> : null}
            <button type="button" onClick={confirmar} disabled={salvando} style={{ ...botao, opacity: salvando ? 0.6 : 1 }}>{salvando ? "Registrando…" : "Confirmar indicação"}</button>
            <p style={{ margin: 0, fontSize: 11, color: TXT_DIM }}>Vira um comprovante carimbado na hora — data, código e regra, imutável.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const botao: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "none", background: DOURADO, color: BG_DEEP, fontSize: 14, fontWeight: 700, cursor: "pointer", padding: "0 16px" };
const botaoSec: React.CSSProperties = { minHeight: 40, borderRadius: 8, border: `1px solid ${BORDA}`, background: BG_CARD, color: TXT, fontSize: 13, fontWeight: 600, cursor: "pointer" };
const linha: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 10 };
const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: TXT_DIM };
const campo: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: `1px solid ${BORDA}`, background: BG_DEEP, color: TXT, padding: "0 12px", fontSize: 15 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "flex-end", zIndex: 60 };
const sideover: React.CSSProperties = { width: "min(420px,100%)", height: "100%", background: BG_CARD, borderLeft: `1px solid ${BORDA}`, padding: 20, overflowY: "auto" };
