"use client";

/**
 * Financeiro de REDE na ficha do negocio — "a faixa de split na cara" + "Fechar comissao".
 *
 * Antes de fechar: mostra os participantes e deixa o humano CONFIRMAR quem leva quanto (Click-and-Go),
 * com o pote e a fatia do Hub ao vivo. Ao confirmar, chama a apuracao (congela o split, imutavel).
 * Depois de apurado: mostra o split congelado + os titulos (a pagar/receber por participante) e o extrato.
 *
 * Estetica de BANCO (nunca joguinho): R$ com centavos, status com proximo passo. Tokens Obra10+ dark.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HandCoins, CheckCircle2, AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

const DOURADO = "#c9a24a";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_DEEP = "#0a140f";
const TXT = "#e6edf3";
const TXT_DIM = "#8aa99a";
const VERDE = "#34d399";

type Participante = { id: string; entidade_tipo: string; entidade_id: string | null; papel: string | null };
type Comissao = { id: string; beneficiario_nome: string | null; papel: string | null; valor: number; pct_aplicado: number | null; regra_origem: string | null };
type Titulo = { id: string; direcao: string; natureza: string; contraparte_nome: string | null; valor_total: number; valor_exigivel: number; status: string };

type Dados = {
  negocio: { id: string; titulo: string; status: string; valor_estimado: number | null; valor_fechado: number | null; percentual_comissao: number | null; pote_previsto: number; apurado: boolean };
  participantes: Participante[];
  comissoes: Comissao[];
  titulos: Titulo[];
  motor_pendente?: boolean;
  aviso?: string;
};

const brl = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  previsto: "previsto", apurado: "aguardando o cliente pagar", exigivel: "liberável (cliente pagou)",
  liberado: "liberado", autorizado: "autorizado (2 chaves)", pago: "pago", cancelado: "cancelado", retido: "retido",
};

export function NegocioFinanceiroRedeSection({ negocioId }: { negocioId: string }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Estado do painel "Fechar comissao"
  const [valorFechado, setValorFechado] = useState<string>("");
  const [fatias, setFatias] = useState<Record<string, string>>({}); // participanteId -> R$
  const [valorReceber, setValorReceber] = useState<string>("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(negocioId)}/financeiro-rede`, {
        headers: internalApiHeaders(),
      });
      const json = (await res.json()) as Dados & { error?: string };
      if (!res.ok) { setErro(json.error ?? "Não foi possível carregar o financeiro."); return; }
      setDados(json);
      if (json.negocio?.valor_estimado && !valorFechado) setValorFechado(String(json.negocio.valor_estimado));
    } catch {
      setErro("Falha de rede ao carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [negocioId, valorFechado]);

  useEffect(() => { void carregar(); }, [negocioId]); // eslint-disable-line react-hooks/exhaustive-deps

  const pct = Number(dados?.negocio.percentual_comissao ?? 0);
  const pote = useMemo(() => {
    const vf = Number(valorFechado) || 0;
    return Math.round(vf * pct) / 100;
  }, [valorFechado, pct]);
  const somaFatias = useMemo(
    () => Object.values(fatias).reduce((s, v) => s + (Number(v) || 0), 0),
    [fatias]
  );
  const residualHub = Math.round((pote - somaFatias) * 100) / 100;

  const apurar = useCallback(async () => {
    if (salvando || !dados) return;
    const vf = Number(valorFechado);
    if (!Number.isFinite(vf) || vf <= 0) { setErro("Defina o valor fechado antes de apurar a comissão."); return; }
    if (somaFatias > pote + 0.005) { setErro("As fatias somam mais que o pote de comissão."); return; }
    setSalvando(true); setErro(null); setOkMsg(null);
    try {
      const listaFatias = dados.participantes
        .filter((p) => (Number(fatias[p.id]) || 0) > 0)
        .map((p) => ({
          beneficiario_tipo: p.entidade_tipo === "empresa" ? "empresa" : "pessoa",
          beneficiario_id: p.entidade_id,
          beneficiario_nome: p.papel ?? "Participante",
          papel: p.papel,
          valor: Number(fatias[p.id]) || 0,
          regra_origem: "manual",
        }));
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(negocioId)}/financeiro-rede`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ acao: "apurar", valor_fechado: vf, fatias: listaFatias }),
      });
      const json = (await res.json()) as { ok?: boolean; erro?: string; error?: string; pote?: number; residual_hub?: number };
      if (!res.ok || json.ok === false) {
        setErro(json.error || json.erro || "Não foi possível fechar a comissão.");
        return;
      }
      setOkMsg(`Comissão fechada. Pote ${brl(json.pote)} · Hub ${brl(json.residual_hub)}. Cada parte vira a receber quando o cliente pagar.`);
      await carregar();
    } catch {
      setErro("Falha de rede ao fechar a comissão.");
    } finally {
      setSalvando(false);
    }
  }, [salvando, dados, valorFechado, somaFatias, pote, fatias, negocioId, carregar]);

  const receber = useCallback(async () => {
    if (salvando) return;
    const v = Number(valorReceber);
    if (!Number.isFinite(v) || v <= 0) { setErro("Informe o valor recebido."); return; }
    setSalvando(true); setErro(null); setOkMsg(null);
    try {
      const res = await fetch(`/api/crm/negocios/${encodeURIComponent(negocioId)}/financeiro-rede`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ acao: "receber", valor: v }),
      });
      const json = (await res.json()) as { ok?: boolean; erro?: string; error?: string; total_pago?: number };
      if (!res.ok || json.ok === false) { setErro(json.error || json.erro || "Não foi possível registrar o recebimento."); return; }
      setOkMsg(`Recebimento registrado (${brl(json.total_pago)} pago pelo cliente). As comissões viraram liberáveis na proporção.`);
      setValorReceber("");
      await carregar();
    } catch { setErro("Falha de rede ao registrar o recebimento."); }
    finally { setSalvando(false); }
  }, [salvando, valorReceber, negocioId, carregar]);

  if (carregando) {
    return <div style={{ height: 80, borderRadius: 12, background: BG_CARD, border: `1px solid ${BORDA}` }} aria-busy />;
  }
  if (erro && !dados) {
    return (
      <div role="alert" style={caixaAviso("#f0aba8", "rgba(179,38,30,0.07)")}>
        <AlertTriangle size={14} aria-hidden /> {erro}
      </div>
    );
  }
  if (!dados) return null;

  const { negocio, participantes, comissoes, titulos } = dados;
  // "O que nasceu" (design #10): recebíveis da rede = fatias que viram a receber (meus + dos parceiros).
  const recebiveis = titulos.filter((t) => t.direcao === "receber");
  const totalRecebiveis = recebiveis.reduce((s, t) => s + (Number(t.valor_total) || 0), 0);

  return (
    <section aria-labelledby="fin-rede-titulo" style={{ marginTop: 24 }}>
      <div style={cabecalho}>
        <HandCoins size={16} color={DOURADO} aria-hidden />
        <h3 id="fin-rede-titulo" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: TXT, flex: 1 }}>
          Comissão da rede
        </h3>
        {negocio.apurado ? (
          <span style={{ fontSize: 11, color: VERDE, display: "flex", alignItems: "center", gap: 4 }}>
            <Lock size={12} aria-hidden /> fechada
          </span>
        ) : null}
      </div>

      {dados.motor_pendente ? (
        <div role="status" style={caixaAviso(TXT_DIM, "rgba(201,162,74,0.06)")}>
          <AlertTriangle size={14} color={DOURADO} aria-hidden /> {dados.aviso}
        </div>
      ) : negocio.apurado ? (
        // ── APURADO: split congelado + titulos ──
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Confirmação pós-ganho (design #10): "o que nasceu", com link — mata o pânico do silêncio. */}
          {recebiveis.length > 0 ? (
            <div style={bannerNasceu}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: VERDE }}>
                  <CheckCircle2 size={14} aria-hidden /> Nasceu com o ganho
                </div>
                <div style={{ marginTop: 4, fontSize: 13, color: TXT }}>
                  <strong>{recebiveis.length}</strong> {recebiveis.length === 1 ? "recebível" : "recebíveis"} da rede ·{" "}
                  <strong style={{ color: DOURADO, fontVariantNumeric: "tabular-nums" }}>{brl(totalRecebiveis)}</strong>
                  <span style={{ color: TXT_DIM }}> — seus e dos parceiros, cada um com sua regra travada.</span>
                </div>
              </div>
              <Link href="/crm/financeiro/rede" style={linkExtrato}>
                Ver no Meu Dinheiro <ArrowRight size={13} aria-hidden />
              </Link>
            </div>
          ) : null}
          {comissoes.map((c) => (
            <div key={c.id} style={linhaSplit}>
              <span style={{ color: TXT, fontSize: 13 }}>
                {c.regra_origem === "residual_hub" ? "Hub (plataforma)" : c.beneficiario_nome || c.papel || "Participante"}
                {c.papel && c.regra_origem !== "residual_hub" ? <span style={{ color: TXT_DIM, fontSize: 11 }}> · {c.papel}</span> : null}
              </span>
              <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: TXT_DIM, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>{Number(c.pct_aplicado ?? 0).toFixed(1)}%</span>
                <strong style={{ color: DOURADO, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{brl(c.valor)}</strong>
              </span>
            </div>
          ))}
          {titulos.filter((t) => t.natureza === "comissao_split").length > 0 ? (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: TXT_DIM }}>
              Cada fatia vira <b style={{ color: TXT }}>a receber</b> na proporção do que o cliente pagar, e o pagamento exige as <b style={{ color: TXT }}>2 chaves</b> (o parceiro dá o OK, o Hub libera).
            </p>
          ) : null}

          {/* Registrar recebimento do cliente — cash-basis: torna as comissões exigíveis pro-rata */}
          <div style={{ ...linhaSplit, flexWrap: "wrap", rowGap: 8, marginTop: 4 }}>
            <span style={{ color: TXT_DIM, fontSize: 12, flex: 1, minWidth: 130 }}>Cliente pagou:</span>
            <input inputMode="decimal" value={valorReceber} onChange={(e) => setValorReceber(e.target.value.replace(",", "."))}
              placeholder="R$ recebido" style={{ ...campo, width: 120, textAlign: "right" }} aria-label="Valor recebido do cliente" />
            <button type="button" onClick={receber} disabled={salvando || !(Number(valorReceber) > 0)}
              style={{ ...botao, minHeight: 40, padding: "0 14px", opacity: salvando || !(Number(valorReceber) > 0) ? 0.6 : 1 }}>Registrar</button>
          </div>
          {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f0aba8", display: "flex", gap: 4 }}><AlertTriangle size={13} aria-hidden /> {erro}</p> : null}
        </div>
      ) : participantes.length === 0 ? (
        <p style={{ fontSize: 13, color: TXT_DIM, margin: 0 }}>
          Vincule os participantes (quem indicou/executa) na aba de relacionados para dividir a comissão.
        </p>
      ) : (
        // ── NAO APURADO: painel "Fechar comissao" (confirmar o split) ──
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* FIN-03: ganho SEM valor_fechado deixa o pote em R$ 0 — a comissão sumiria em silêncio.
              Avisa alto e trava o "Fechar comissão" até preencher (guard também no endpoint). */}
          {!(Number(negocio.valor_fechado) > 0) ? (
            <div role="alert" style={caixaAviso(DOURADO, "rgba(201,162,74,0.08)")}>
              <AlertTriangle size={14} color={DOURADO} aria-hidden />
              <span>
                <b style={{ color: TXT }}>Defina o valor fechado antes de apurar a comissão.</b> Sem ele o pote fica
                R$ 0 e a comissão some em silêncio — informe o valor abaixo.
              </span>
            </div>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={rotulo}>Valor fechado do negócio</span>
            <input inputMode="decimal" value={valorFechado} onChange={(e) => setValorFechado(e.target.value.replace(",", "."))}
              placeholder="Ex.: 38000" style={campo} aria-label="Valor fechado" />
          </label>
          <div style={{ fontSize: 12, color: TXT_DIM }}>
            Pote de comissão ({pct}% do valor): <strong style={{ color: DOURADO }}>{brl(pote)}</strong>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {participantes.map((p) => (
              <div key={p.id} style={linhaSplit}>
                <span style={{ color: TXT, fontSize: 13 }}>{p.papel || "Participante"}</span>
                <input inputMode="decimal" value={fatias[p.id] ?? ""} onChange={(e) => setFatias((f) => ({ ...f, [p.id]: e.target.value.replace(",", ".") }))}
                  placeholder="R$ 0" style={{ ...campo, width: 110, textAlign: "right" }} aria-label={`Fatia de ${p.papel || "participante"}`} />
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: TXT_DIM, paddingTop: 6, borderTop: `1px solid ${BORDA}` }}>
            <span>Fica com o Hub (o que sobra):</span>
            <strong style={{ color: residualHub < 0 ? "#f0aba8" : VERDE, fontVariantNumeric: "tabular-nums" }}>{brl(residualHub)}</strong>
          </div>

          {erro ? <p style={{ margin: 0, fontSize: 12, color: "#f0aba8", display: "flex", gap: 4 }}><AlertTriangle size={13} aria-hidden /> {erro}</p> : null}
          {okMsg ? <p style={{ margin: 0, fontSize: 12, color: VERDE, display: "flex", gap: 4 }}><CheckCircle2 size={13} aria-hidden /> {okMsg}</p> : null}

          <button type="button" onClick={apurar} disabled={salvando || residualHub < 0 || !(Number(valorFechado) > 0)}
            style={{ ...botao, opacity: salvando || residualHub < 0 || !(Number(valorFechado) > 0) ? 0.6 : 1 }}>
            {salvando ? "Fechando…" : "Fechar comissão (congela o split)"}
          </button>
          <p style={{ margin: 0, fontSize: 11, color: TXT_DIM }}>
            Ao fechar, o split fica <b style={{ color: TXT }}>gravado e imutável</b> — a prova de quem leva quanto. Correção depois é por novo lançamento.
          </p>
        </div>
      )}
      {okMsg && negocio.apurado ? <p style={{ marginTop: 8, fontSize: 12, color: VERDE }}>{okMsg}</p> : null}
    </section>
  );
}

const cabecalho: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${BORDA}` };
const bannerNasceu: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, padding: "10px 14px", borderRadius: 10, border: `1px solid ${DOURADO}44`, background: "rgba(52,211,153,0.06)" };
const linkExtrato: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: DOURADO, textDecoration: "none", whiteSpace: "nowrap" };
const linhaSplit: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 12px", background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 8 };
const rotulo: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: TXT_DIM };
const campo: React.CSSProperties = { minHeight: 40, borderRadius: 8, border: `1px solid ${BORDA}`, background: BG_DEEP, color: TXT, padding: "0 12px", fontSize: 14 };
const botao: React.CSSProperties = { minHeight: 44, borderRadius: 8, border: "none", background: DOURADO, color: BG_DEEP, fontSize: 14, fontWeight: 700, cursor: "pointer" };
function caixaAviso(cor: string, bg: string): React.CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, borderRadius: 10, border: `1px solid ${cor}33`, background: bg, padding: "10px 14px", fontSize: 12, color: cor };
}

export default NegocioFinanceiroRedeSection;
