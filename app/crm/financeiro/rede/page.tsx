"use client";

/**
 * "Meu Dinheiro" / Financeiro da Rede — a tela da pergunta nº1: quanto a rede tem a receber,
 * a pagar, e o que ja esta liberavel (cliente pagou). Estetica de BANCO: R$, status com proximo
 * passo, extrato imutavel. Dark verde+dourado, mobile-first. Le /api/crm/financeiro-rede.
 */
import { useCallback, useEffect, useState } from "react";
import { Wallet, ArrowDownCircle, ArrowUpCircle, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";
const VERDE = "#34d399";
const VERM = "#f0aba8";

type Titulo = { id: string; negocio_id: string; direcao: string; natureza: string; contraparte_nome: string | null; valor_total: number; valor_exigivel: number; valor_pago: number; status: string; criado_em: string };
type Mov = { id: string; negocio_id: string; tipo: string; valor: number; descricao: string | null; criado_em: string };
type Dados = { motor_pendente: boolean; aviso?: string; totais: { a_receber: number; a_pagar: number; exigivel: number; recebido: number }; titulos: Titulo[]; negocios: Record<string, string>; movimentos: Mov[] };

const brl = (v: number | null | undefined) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => { try { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(iso)); } catch { return iso; } };

const NATUREZA_LABEL: Record<string, string> = {
  recebivel_cliente: "Recebível do cliente", comissao_split: "Comissão", taxa_plataforma: "Taxa da plataforma",
  honorario: "Honorário", retencao: "Retenção", ajuste: "Ajuste",
};
const STATUS_PROX: Record<string, string> = {
  previsto: "previsto", apurado: "aguardando o cliente pagar", exigivel: "liberável (cliente pagou)",
  liberado: "liberado", autorizado: "autorizado (2 chaves) — a pagar", pago: "pago", retido: "retido",
};

export default function FinanceiroRedePage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const res = await fetch("/api/crm/financeiro-rede", { headers: internalApiHeaders() });
      const json = (await res.json()) as Dados & { error?: string };
      if (!res.ok) { setErro(json.error ?? "Não foi possível carregar."); return; }
      setDados(json);
    } catch { setErro("Falha de rede."); }
    finally { setCarregando(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "20px 16px 48px", color: TXT }}>
      <header style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <Wallet size={22} color={DOURADO} aria-hidden />
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>Meu Dinheiro</h1>
        <button type="button" onClick={() => void carregar()} disabled={carregando} aria-label="Recarregar"
          style={{ marginLeft: "auto", background: "none", border: "none", color: TXT_DIM, cursor: "pointer", padding: 6 }}>
          <RefreshCw size={16} style={{ animation: carregando ? "spin 1s linear infinite" : "none" }} aria-hidden />
        </button>
      </header>
      <p style={{ margin: "0 0 20px", color: TXT_DIM, fontSize: 13 }}>O que a rede tem a receber e a pagar — quanto e quando.</p>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {erro ? (
        <div role="alert" style={caixa(VERM, "rgba(179,38,30,0.07)")}><AlertTriangle size={14} aria-hidden /> {erro}</div>
      ) : carregando && !dados ? (
        <div style={{ height: 120, borderRadius: 14, background: BG_CARD, border: `1px solid ${BORDA}` }} aria-busy />
      ) : dados?.motor_pendente ? (
        <div role="status" style={caixa(TXT_DIM, "rgba(201,162,74,0.06)")}><AlertTriangle size={14} color={DOURADO} aria-hidden /> {dados.aviso}</div>
      ) : dados ? (
        <>
          {/* Totais glancaveis (estetica de banco) */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
            <CardTotal icone={<ArrowDownCircle size={16} color={VERDE} aria-hidden />} rotulo="A receber" valor={dados.totais.a_receber} cor={VERDE} />
            <CardTotal icone={<CheckCircle2 size={16} color={DOURADO} aria-hidden />} rotulo="Liberável (cliente pagou)" valor={dados.totais.exigivel} cor={DOURADO} />
            <CardTotal icone={<ArrowUpCircle size={16} color={VERM} aria-hidden />} rotulo="A pagar" valor={dados.totais.a_pagar} cor={VERM} />
            <CardTotal icone={<Wallet size={16} color={TXT_DIM} aria-hidden />} rotulo="Já recebido" valor={dados.totais.recebido} cor={TXT_DIM} />
          </div>

          {/* Titulos */}
          <h2 style={sub}>Contas ({dados.titulos.length})</h2>
          {dados.titulos.length === 0 ? (
            <p style={{ color: TXT_DIM, fontSize: 13 }}>Nenhuma conta ainda. Feche a comissão de um negócio ganho para começar.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {dados.titulos.map((t) => {
                const rec = t.direcao === "receber";
                return (
                  <div key={t.id} style={{ ...linha, borderLeft: `3px solid ${rec ? VERDE : VERM}` }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: TXT, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.contraparte_nome || (rec ? "Cliente" : "Participante")}
                        <span style={{ color: TXT_DIM, fontSize: 11 }}> · {NATUREZA_LABEL[t.natureza] ?? t.natureza}</span>
                      </div>
                      <div style={{ fontSize: 11, color: TXT_DIM, marginTop: 2 }}>
                        {dados.negocios[t.negocio_id] || "Negócio"} · <span style={{ color: t.status === "exigivel" || t.status === "autorizado" ? DOURADO : TXT_DIM }}>{STATUS_PROX[t.status] ?? t.status}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: rec ? VERDE : VERM, fontVariantNumeric: "tabular-nums" }}>{rec ? "" : "− "}{brl(t.valor_total)}</div>
                      {t.direcao === "pagar" && Number(t.valor_exigivel) > 0 ? (
                        <div style={{ fontSize: 11, color: DOURADO, fontVariantNumeric: "tabular-nums" }}>liberável: {brl(t.valor_exigivel)}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Extrato */}
          {dados.movimentos.length > 0 ? (
            <>
              <h2 style={sub}>Extrato</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {dados.movimentos.map((m) => (
                  <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", fontSize: 12, color: TXT_DIM, borderBottom: `1px solid ${BORDA}55` }}>
                    <span><time dateTime={m.criado_em} style={{ color: TXT_DIM }}>{dataBR(m.criado_em)}</time> · {m.descricao || m.tipo}</span>
                    <span style={{ color: TXT, fontVariantNumeric: "tabular-nums" }}>{brl(m.valor)}</span>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 12, fontSize: 11, color: TXT_DIM }}>Registros imutáveis — nada se perde. Para corrigir, lança-se um estorno.</p>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CardTotal({ icone, rotulo, valor, cor }: { icone: React.ReactNode; rotulo: string; valor: number; cor: string }) {
  return (
    <div style={{ background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: TXT_DIM }}>{icone} {rotulo}</div>
      <div style={{ marginTop: 6, fontSize: 20, fontWeight: 800, color: cor, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{brl(valor)}</div>
    </div>
  );
}

const sub: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: TXT, margin: "0 0 10px", paddingBottom: 8, borderBottom: `1px solid ${BORDA}` };
const linha: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 12px", background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 10 };
function caixa(cor: string, bg: string): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, borderRadius: 10, border: `1px solid ${cor}33`, background: bg, padding: "12px 14px", fontSize: 13, color: cor };
}
