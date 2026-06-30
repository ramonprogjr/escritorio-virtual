"use client";

/**
 * E6 — Aba "Financeiro" da obra (Orçamento · Aprovações · Pagamentos · Cobertura · Custódia).
 *
 * BIFURCA por tipo_contrato (faixa-selo 🔒 IMUTÁVEL no topo):
 *   - administracao → Custos (valor UNITÁRIO, livro aberto) + Cobertura item a item;
 *   - preco_fechado → Etapas (só TOTAIS, turn-key) — sem composição, sem Cobertura por item.
 *
 * HUMANO APROVA O DINHEIRO: a IA prepara; aprovar/liberar é a fila dourada com a APROVAÇÃO DUPLA
 * (arquitetura + Hub). A 2ª chave acontece em /crm/aprovacoes (esta tela mostra o estado e abre a fila).
 *
 * Marca verde+dourado dark, mobile-first, Click-and-Go. Tolerante: migração E6 pendente → aviso honesto.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import {
  Plus,
  X,
  Lock,
  ShieldCheck,
  AlertTriangle,
  Wallet,
  ClipboardList,
  HandCoins,
  Target,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import {
  APRESENTACAO_TIPO_CONTRATO,
  APRESENTACAO_STATUS_ORCAMENTO,
  APRESENTACAO_STATUS_PAGAMENTO,
  APRESENTACAO_COBERTURA,
  rotuloAbaOrcamento,
  rotuloAbaPagamentos,
  mostraUnitario,
  derivarEstadoDupla,
  type TipoContrato,
  type StatusOrcamento,
  type StatusPagamento,
  type EstadoCobertura,
  type ResumoFinanceiro,
} from "@/lib/obras/financeiro";

const DOURADO = "#c9a24a";
const VERDE = "#003b26";
const BORDA = "#1d3a2c";
const BG_CARD = "#0f1d16";
const BG_INPUT = "#0a140f";
const TEXTO = "#e6edf3";
const TEXTO_FRACO = "#8b949e";
const VERMELHO = "#EF4444";
// A2 (E2E DOMÍNIO C): substitui azul #3B82F6 (Orçado) e roxo #8B5CF6 (Em custódia) — fora da
// marca Obra10+ (verde+dourado dark). Teal harmoniza com o verde; dourado-escuro marca a custódia
// (valor retido) distinto do dourado puro (espera) e do verde (liberado).
const TEAL = "#2f9e8f"; // Orçado — frio da marca (não-azul Shadcn)
const DOURADO_ESCURO = "#b8862f"; // Em custódia — valor protegido/retido

type SubAba = "orcamento" | "aprovacoes" | "pagamentos" | "cobertura";

type OrcamentoItem = {
  id: string;
  descricao: string;
  unidade?: string | null;
  quantidade?: number;
  valor_unitario?: number;
  valor_total: number;
  spread_pct?: number;
};

type Orcamento = {
  id: string;
  titulo: string;
  descricao?: string | null;
  valor_total: number;
  status: StatusOrcamento;
  escrow_status: string;
  itens?: OrcamentoItem[];
};

type Pagamento = {
  id: string;
  titulo: string;
  tipo: string;
  valor: number;
  valor_liquido?: number | null;
  data_vencimento: string | null;
  status: StatusPagamento;
  balde: string;
  escrow_liberado?: boolean;
  aprovacao_arq_id?: string | null;
  aprovacao_hub_id?: string | null;
  // A2: status REAL de cada chave (null = ainda não enfileirada). Deriva "em qual porta está".
  aprovacao_arq_status?: string | null;
  aprovacao_hub_status?: string | null;
  fornecedor_nome?: string | null;
};

type CoberturaRow = {
  item_id: string;
  codigo: string;
  nome: string;
  disciplina_slug?: string | null;
  area_label?: string | null;
  valor_contrato: number | null;
  orcado_aprovado: number;
  estado_cobertura: EstadoCobertura;
  pct_cobertura: number | null;
  eh_aditivo: boolean;
};

type EscrowConta = {
  saldo_custodia: number;
  saldo_liberado: number;
  saldo_pago: number;
  provedor: string;
} | null;

type EscrowMov = {
  id: string;
  tipo: string;
  valor: number;
  origem?: string | null;
  criado_em: string;
};

type Payload = {
  migracao_pendente: boolean;
  tipo_contrato: TipoContrato;
  resumo: ResumoFinanceiro;
  orcamentos: Orcamento[];
  pagamentos: Pagamento[];
  cobertura: CoberturaRow[];
  escrow?: EscrowConta;
  escrow_movimentos?: EscrowMov[];
};

function brl(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0";
  if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return `R$ ${n.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
function brlFull(v: number | null | undefined): string {
  return `R$ ${Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function ObraFinanceiroSecao({ obraId }: { obraId: string }) {
  const [subAba, setSubAba] = useState<SubAba>("orcamento");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [criandoOrc, setCriandoOrc] = useState(false);
  const [criandoPag, setCriandoPag] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/financeiro`, {
        headers: internalApiHeaders(),
        cache: "no-store",
      });
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok && !json.migracao_pendente) {
        setErro(json.error ?? "Falha ao carregar o financeiro.");
        return;
      }
      setPayload(json);
    } catch {
      setErro("Falha de rede ao carregar o financeiro.");
    } finally {
      setCarregando(false);
    }
  }, [obraId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregando && !payload) {
    return <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>Carregando o financeiro…</p>;
  }
  if (erro) {
    return <p style={{ color: "#f85149", fontSize: 13 }}>{erro}</p>;
  }
  if (!payload) return null;

  const tipo = payload.tipo_contrato;
  const ap = APRESENTACAO_TIPO_CONTRATO[tipo];
  const isAdm = mostraUnitario(tipo);

  const abas: { id: SubAba; rotulo: string; badge?: number }[] = [
    { id: "orcamento", rotulo: rotuloAbaOrcamento(tipo) },
    {
      id: "aprovacoes",
      rotulo: "Aprovações",
      badge: payload.pagamentos.filter((p) => p.status === "liberado").length,
    },
    { id: "pagamentos", rotulo: rotuloAbaPagamentos(tipo) },
    ...(isAdm ? [{ id: "cobertura" as const, rotulo: "Cobertura" }] : []),
  ];

  return (
    <div>
      {/* Faixa-selo de contrato (cadeado dourado = imutável, combate o medo de troca escondida) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 16,
          padding: "8px 14px",
          background: "#12241a",
          border: `1px solid ${DOURADO}44`,
          borderRadius: 10,
        }}
      >
        <Lock size={15} color={DOURADO} />
        <span style={{ fontSize: 13, fontWeight: 800, color: DOURADO, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {ap.icone} {ap.label}
        </span>
        <span style={{ fontSize: 12, color: TEXTO_FRACO }}>· {ap.sublabel} · imutável</span>
      </div>

      {payload.migracao_pendente && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 10,
            padding: "10px 14px",
            background: "#3a2a0f",
            border: `1px solid ${DOURADO}55`,
            color: "#f0c869",
            fontSize: 13,
          }}
        >
          <AlertTriangle size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          Financeiro ainda não ativo nesta base (migração E6 pendente — janela do dono). A tela fica pronta;
          os dados aparecem após aplicar a migração.
        </div>
      )}

      {/* Resumo (cabeçalho) */}
      <ResumoCards resumo={payload.resumo} isAdm={isAdm} />

      {/* Segmented control (rótulos mudam por tipo) */}
      <div
        role="tablist"
        aria-label="Financeiro"
        style={{ display: "flex", gap: 4, overflowX: "auto", margin: "16px 0", paddingBottom: 2 }}
      >
        {abas.map(({ id, rotulo, badge }) => {
          const ativo = subAba === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => setSubAba(id)}
              style={{
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: ativo ? "#0a140f" : "#8aa99a",
                background: ativo ? DOURADO : "transparent",
                border: `1px solid ${ativo ? DOURADO : BORDA}`,
                borderRadius: 8,
                cursor: "pointer",
                minHeight: 40,
              }}
            >
              {rotulo}
              {badge ? (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    background: ativo ? VERDE : DOURADO,
                    color: "#fff",
                    borderRadius: 999,
                    padding: "1px 6px",
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {subAba === "orcamento" && (
        <PainelOrcamento
          orcamentos={payload.orcamentos}
          isAdm={isAdm}
          onNovo={() => setCriandoOrc(true)}
          obraId={obraId}
          onMudou={() => void carregar()}
        />
      )}
      {subAba === "aprovacoes" && (
        <PainelAprovacoes pagamentos={payload.pagamentos} orcamentos={payload.orcamentos} />
      )}
      {subAba === "pagamentos" && (
        <PainelPagamentos
          pagamentos={payload.pagamentos}
          onNovo={() => setCriandoPag(true)}
          isAdm={isAdm}
        />
      )}
      {subAba === "cobertura" && isAdm && <PainelCobertura cobertura={payload.cobertura} />}

      {/* Custódia (escrow) — sempre visível abaixo (a tela que cura o medo) */}
      <PainelCustodia resumo={payload.resumo} escrow={payload.escrow ?? null} movimentos={payload.escrow_movimentos ?? []} />

      {criandoOrc && (
        <DrawerNovoOrcamento
          obraId={obraId}
          isAdm={isAdm}
          onFechar={() => setCriandoOrc(false)}
          onCriado={() => {
            setCriandoOrc(false);
            void carregar();
          }}
        />
      )}
      {criandoPag && (
        <DrawerNovoPagamento
          obraId={obraId}
          orcamentos={payload.orcamentos}
          onFechar={() => setCriandoPag(false)}
          onCriado={() => {
            setCriandoPag(false);
            void carregar();
          }}
        />
      )}
    </div>
  );
}

// ── Resumo (cabeçalho) ────────────────────────────────────────────────────────
function ResumoCards({ resumo, isAdm }: { resumo: ResumoFinanceiro; isAdm: boolean }) {
  const narrow = useNarrowViewport();
  const cards: { label: string; valor: number; cor: string }[] = isAdm
    ? [
        { label: "Previsto", valor: resumo.previsto, cor: TEXTO_FRACO },
        { label: "Orçado", valor: resumo.orcado, cor: TEAL },
        { label: "Aprovado", valor: resumo.aprovado, cor: "#3fb950" },
      ]
    : [
        { label: "Contrato", valor: resumo.orcado, cor: TEXTO_FRACO },
        { label: "Liberado", valor: resumo.liberado, cor: "#3fb950" },
        { label: "Em custódia", valor: resumo.em_custodia, cor: DOURADO_ESCURO },
      ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap: 8 }}>
      {cards.map((c) => (
        <div key={c.label} style={{ background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 10, padding: 12 }}>
          <p style={{ margin: 0, fontSize: 11, color: TEXTO_FRACO }}>{c.label}</p>
          <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 800, color: c.cor }}>{brl(c.valor)}</p>
        </div>
      ))}
    </div>
  );
}

// ── Painel Orçamento ────────────────────────────────────────────────────────
function PainelOrcamento({
  orcamentos,
  isAdm,
  onNovo,
  obraId,
  onMudou,
}: {
  orcamentos: Orcamento[];
  isAdm: boolean;
  onNovo: () => void;
  obraId: string;
  onMudou: () => void;
}) {
  const enviarParaAprovacao = useCallback(
    async (orcamentoId: string) => {
      await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/financeiro`, {
        method: "PATCH",
        headers: { ...internalApiHeaders(), "content-type": "application/json" },
        body: JSON.stringify({ acao: "enviar_orcamento", orcamento_id: orcamentoId }),
      });
      onMudou();
    },
    [obraId, onMudou]
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: TEXTO }}>{isAdm ? "Custos por frente" : "Etapas"}</h3>
        <button type="button" onClick={onNovo} style={botaoPrimario}>
          <Plus size={15} /> Novo orçamento
        </button>
      </div>
      {orcamentos.length === 0 ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>
          Nenhum orçamento ainda. Clique em <strong>Novo orçamento</strong>.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {orcamentos.map((o) => {
            const apr = APRESENTACAO_STATUS_ORCAMENTO[o.status] ?? { cor: TEXTO_FRACO, label: o.status };
            return (
              <article key={o.id} style={{ background: BG_CARD, border: `1px solid ${BORDA}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXTO }}>{o.titulo}</p>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: `${apr.cor}22`,
                        color: apr.cor,
                      }}
                    >
                      {apr.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: DOURADO }}>{brl(o.valor_total)}</span>
                </div>

                {/* Itens — administração mostra unitário; preço fechado só o total */}
                {(o.itens ?? []).length > 0 && (
                  <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "grid", gap: 4 }}>
                    {o.itens!.map((it) => (
                      <li key={it.id} style={{ fontSize: 12, color: TEXTO_FRACO, display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ minWidth: 0 }}>
                          {it.descricao}
                          {isAdm && it.quantidade != null && it.valor_unitario != null && (
                            <span style={{ color: "#6e7681" }}>
                              {" "}
                              · {it.quantidade}{it.unidade ? ` ${it.unidade}` : ""} × {brlFull(it.valor_unitario)}
                            </span>
                          )}
                        </span>
                        <span style={{ color: TEXTO }}>{brlFull(it.valor_total)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {(o.status === "rascunho" || o.status === "enviado") && (
                  <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: DOURADO }}>
                      <ShieldCheck size={13} /> Aprovar é ato HUMANO + DUPLO (arquitetura + Hub)
                    </span>
                    {o.status === "rascunho" && (
                      <button type="button" onClick={() => void enviarParaAprovacao(o.id)} style={botaoPrimario}>
                        Enviar p/ aprovação <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Painel Aprovações (estado da dupla chave + abre a fila dourada) ──────────
function PainelAprovacoes({ pagamentos }: { pagamentos: Pagamento[]; orcamentos: Orcamento[] }) {
  const pendentes = pagamentos.filter((p) => p.status === "liberado" || p.status === "bloqueado");
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
          padding: "8px 12px",
          background: "#3a2a0f",
          border: `1px solid ${DOURADO}55`,
          borderRadius: 8,
          fontSize: 12,
          color: "#f0c869",
        }}
      >
        <ShieldCheck size={16} />A liberação do dinheiro exige APROVAÇÃO DUPLA: arquitetura + Hub.
      </div>
      {pendentes.length === 0 ? (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>Nenhum pagamento aguardando aprovação.</p>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {pendentes.map((p) => {
            const bloqueado = p.status === "bloqueado";
            // A2: usa o status REAL de cada chave (não 'pendente' fixo) → mostra arq ✅ / hub ⏳ corretamente.
            // Sem registro ainda enfileirado mas com id presente → "pendente" (fail-closed: nunca "aprovado").
            const dupla = derivarEstadoDupla(
              p.aprovacao_arq_status ?? (p.aprovacao_arq_id ? "pendente" : null),
              p.aprovacao_hub_status ?? (p.aprovacao_hub_id ? "pendente" : null)
            );
            return (
              <article
                key={p.id}
                style={{
                  background: BG_CARD,
                  border: `${bloqueado ? "1px" : "3px"} solid ${bloqueado ? BORDA : DOURADO}`,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXTO }}>
                      💳 {p.titulo}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: TEXTO_FRACO }}>
                      {p.tipo} · vence {p.data_vencimento ?? "—"}
                    </p>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: DOURADO }}>{brl(p.valor)}</span>
                </div>

                {bloqueado ? (
                  <p style={{ margin: "10px 0 0", fontSize: 12, color: VERMELHO }}>
                    ⛔ Orçamento da frente ainda não aprovado — pagamento bloqueado.
                  </p>
                ) : (
                  <>
                    {/* Estado da DUPLA chave (o coração do redesign) */}
                    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 12, fontSize: 12 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: dupla.arq === "aprovado" ? "#3fb950" : DOURADO }}>
                        <KeyRound size={13} /> Arquitetura: {dupla.arq === "aprovado" ? "✅" : "⏳"}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: dupla.hub === "aprovado" ? "#3fb950" : DOURADO }}>
                        <KeyRound size={13} /> Hub: {dupla.hub === "aprovado" ? "✅" : "⏳"}
                      </span>
                    </div>
                    <a
                      href="/crm/aprovacoes?tipo=pagamento_obra_hub"
                      style={{ ...botaoPrimario, marginTop: 12, textDecoration: "none", display: "inline-flex" }}
                    >
                      Abrir fila de aprovação <ChevronRight size={14} />
                    </a>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Painel Pagamentos (3 baldes) ─────────────────────────────────────────────
function PainelPagamentos({
  pagamentos,
  onNovo,
  isAdm,
}: {
  pagamentos: Pagamento[];
  onNovo: () => void;
  isAdm: boolean;
}) {
  const baldes: { id: string; rotulo: string; cor: string }[] = [
    { id: "a_pagar", rotulo: "A pagar", cor: TEXTO_FRACO },
    { id: "vencendo_7d", rotulo: "Vence 7d", cor: "#F59E0B" },
    { id: "atrasado", rotulo: "Atrasado", cor: VERMELHO },
    { id: "pago", rotulo: "Pago", cor: "#3fb950" },
  ];
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: TEXTO }}>{isAdm ? "Pagamentos" : "Medições"}</h3>
        <button type="button" onClick={onNovo} style={botaoPrimario}>
          <Plus size={15} /> Lançar
        </button>
      </div>
      {baldes.map((b) => {
        const lista = pagamentos.filter((p) => p.balde === b.id || (b.id === "pago" && p.status === "pago"));
        if (lista.length === 0) return null;
        return (
          <div key={b.id} style={{ marginBottom: 14 }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: b.cor }}>
              {b.rotulo} · {lista.length}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {lista.map((p) => {
                const aprP = APRESENTACAO_STATUS_PAGAMENTO[p.status] ?? { cor: TEXTO_FRACO, label: p.status, icone: "•" };
                const semEscrow = p.tipo === "avulso" || p.tipo === "reembolso";
                return (
                  <article key={p.id} style={{ background: BG_CARD, border: `1px solid ${b.id === "atrasado" ? VERMELHO + "66" : BORDA}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, color: TEXTO }}>{p.titulo}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXTO_FRACO }}>
                          {aprP.icone} {aprP.label}
                          {p.fornecedor_nome ? ` · ${p.fornecedor_nome}` : ""}
                          {semEscrow ? " · sem escrow" : ""}
                          {p.data_vencimento ? ` · vence ${p.data_vencimento}` : ""}
                        </p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 800, color: b.cor }}>{brl(p.valor)}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        );
      })}
      {pagamentos.length === 0 && (
        <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>
          Nenhum pagamento. Use <strong>Lançar</strong> (habilita com orçamento aprovado ou adiantamento justificado).
        </p>
      )}
    </div>
  );
}

// ── Painel Cobertura (compatibilização 🟢🟡🔴 — vermelho primeiro) ──────────
function PainelCobertura({ cobertura }: { cobertura: CoberturaRow[] }) {
  const ordenada = useMemo(() => {
    const peso: Record<EstadoCobertura, number> = { sem_orcamento: 0, parcial: 1, coberto: 2 };
    return [...cobertura].sort((a, b) => peso[a.estado_cobertura] - peso[b.estado_cobertura]);
  }, [cobertura]);

  const total = cobertura.length;
  const cobertos = cobertura.filter((c) => c.estado_cobertura === "coberto").length;
  const pctGeral = total > 0 ? Math.round((cobertos / total) * 100) : 0;

  if (total === 0) {
    return (
      <p style={{ color: TEXTO_FRACO, fontSize: 13 }}>
        Sem itens de contrato (E2) para compatibilizar ainda.
      </p>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Target size={16} color={DOURADO} />
        <span style={{ fontSize: 14, fontWeight: 700, color: TEXTO }}>
          {pctGeral}% coberto · {cobertos} de {total} itens
        </span>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {ordenada.map((c) => {
          const apc = APRESENTACAO_COBERTURA[c.estado_cobertura];
          return (
            <article key={c.item_id} style={{ background: BG_CARD, border: `1px solid ${apc.cor}44`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, color: TEXTO }}>
                    {apc.emoji} {c.nome}
                    {c.area_label ? <span style={{ color: TEXTO_FRACO }}> · {c.area_label}</span> : null}
                    {c.eh_aditivo ? <span style={{ color: DOURADO, fontSize: 11 }}> · aditivo</span> : null}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: TEXTO_FRACO }}>
                    prev {brl(c.valor_contrato)} · orç {brl(c.orcado_aprovado)}
                  </p>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: apc.cor }}>
                  {c.pct_cobertura == null ? "—%" : `${c.pct_cobertura}%`}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ── Painel Custódia (escrow) — a tela que cura o medo ────────────────────────
function PainelCustodia({
  resumo,
  escrow,
  movimentos,
}: {
  resumo: ResumoFinanceiro;
  escrow: EscrowConta;
  movimentos: EscrowMov[];
}) {
  const narrow = useNarrowViewport();
  const emCustodia = escrow?.saldo_custodia ?? resumo.em_custodia;
  const liberado = escrow?.saldo_liberado ?? resumo.liberado;
  const aguarda = resumo.aguarda_2a_chave;

  return (
    <section style={{ marginTop: 24, background: "#0c1812", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <ShieldCheck size={18} color={DOURADO} />
        <h3 style={{ margin: 0, fontSize: 14, color: TEXTO }}>Custódia (Escrow)</h3>
      </div>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: TEXTO_FRACO }}>
        🛡 Seu dinheiro fica protegido. Só sai com <strong style={{ color: DOURADO }}>dupla aprovação</strong>{" "}
        (arquitetura + Hub). {escrow?.provedor === "interno" || !escrow ? "Custódia sob controle do Hub." : ""}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
        {[
          { label: "Em custódia 🔒", valor: emCustodia, cor: DOURADO_ESCURO },
          { label: "Aguarda 2ª chave ⏳", valor: aguarda, cor: DOURADO },
          { label: "Liberado ✅", valor: liberado, cor: "#3fb950" },
        ].map((c) => (
          <div key={c.label} style={{ background: BG_INPUT, border: `1px solid ${BORDA}`, borderRadius: 10, padding: 10, textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: c.cor }}>{brl(c.valor)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: TEXTO_FRACO }}>{c.label}</p>
          </div>
        ))}
      </div>

      {movimentos.length > 0 && (
        <div>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", color: TEXTO_FRACO }}>
            Extrato (imutável)
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
            {movimentos.slice(0, 8).map((m) => (
              <li key={m.id} style={{ fontSize: 12, color: TEXTO_FRACO, display: "flex", justifyContent: "space-between" }}>
                <span>
                  {new Date(m.criado_em).toLocaleDateString("pt-BR")} · {m.tipo}
                  {m.tipo === "liberacao" ? " 🔑arq✓ 🔑hub✓" : ""}
                </span>
                <span style={{ color: TEXTO }}>{brlFull(m.valor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Drawer Novo Orçamento (Click-and-Go) ─────────────────────────────────────
function DrawerNovoOrcamento({
  obraId,
  isAdm,
  onFechar,
  onCriado,
}: {
  obraId: string;
  isAdm: boolean;
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [valorTotal, setValorTotal] = useState(""); // preço fechado: total direto
  const [itens, setItens] = useState<{ descricao: string; quantidade: string; valor_unitario: string }[]>([
    { descricao: "", quantidade: "1", valor_unitario: "" },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const addItem = () => setItens((p) => [...p, { descricao: "", quantidade: "1", valor_unitario: "" }]);
  const setItem = (i: number, campo: string, v: string) =>
    setItens((p) => p.map((it, idx) => (idx === i ? { ...it, [campo]: v } : it)));

  const salvar = useCallback(async () => {
    if (!titulo.trim()) {
      setErro("Informe o título.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const body: Record<string, unknown> = { acao: "orcamento", titulo: titulo.trim(), status: "rascunho" };
      if (isAdm) {
        body.itens = itens
          .filter((it) => it.descricao.trim())
          .map((it) => ({
            descricao: it.descricao.trim(),
            quantidade: Number(it.quantidade) || 1,
            valor_unitario: Number(it.valor_unitario) || 0,
          }));
      } else {
        body.valor_total = Number(valorTotal) || 0;
      }
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/financeiro`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErro(json.error ?? "Falha ao criar o orçamento.");
        return;
      }
      onCriado();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }, [titulo, valorTotal, itens, isAdm, obraId, onCriado]);

  return (
    <div style={overlay} role="dialog" aria-label="Novo orçamento" onClick={onFechar}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: TEXTO }}>{isAdm ? "Novo orçamento (por item)" : "Nova etapa (total)"}</h3>
          <button type="button" onClick={onFechar} style={{ background: "none", border: "none", color: TEXTO_FRACO, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <label style={rotulo}>Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={isAdm ? "Ex.: Civil · Andar 8" : "Ex.: Etapa 1 · Fundação"} style={{ ...input, marginBottom: 14 }} />

        {isAdm ? (
          <>
            <label style={rotulo}>Itens (qtd × unitário)</label>
            {itens.map((it, i) => (
              <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                <input value={it.descricao} onChange={(e) => setItem(i, "descricao", e.target.value)} placeholder="Descrição" style={{ ...input, flex: "2 1 160px", minWidth: 90 }} />
                <input value={it.quantidade} onChange={(e) => setItem(i, "quantidade", e.target.value)} placeholder="Qtd" type="number" style={{ ...input, flex: "1 1 64px", minWidth: 64 }} />
                <input value={it.valor_unitario} onChange={(e) => setItem(i, "valor_unitario", e.target.value)} placeholder="R$/un" type="number" style={{ ...input, flex: "1 1 84px", minWidth: 84 }} />
              </div>
            ))}
            <button type="button" onClick={addItem} style={{ ...botaoSecundario, marginBottom: 16 }}>
              <Plus size={14} /> Adicionar item
            </button>
          </>
        ) : (
          <>
            <label style={rotulo}>Valor total da etapa</label>
            <input value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="Ex.: 204000" type="number" style={{ ...input, marginBottom: 16 }} />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#3a2a0f", border: `1px solid ${DOURADO}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#f0c869" }}>
          <ShieldCheck size={16} /> O orçamento nasce em rascunho. Aprovar é ato humano + duplo (arquitetura + Hub).
        </div>

        {erro && <p style={{ color: "#f85149", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...botaoSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" disabled={salvando} onClick={salvar} style={{ ...botaoPrimario, flex: 1 }}>
            {salvando ? "Salvando…" : "Criar orçamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Drawer Novo Pagamento ────────────────────────────────────────────────────
function DrawerNovoPagamento({
  obraId,
  orcamentos,
  onFechar,
  onCriado,
}: {
  obraId: string;
  orcamentos: Orcamento[];
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [tipo, setTipo] = useState("medicao");
  const [orcamentoId, setOrcamentoId] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aprovados = orcamentos.filter((o) => o.status === "aprovado");

  const salvar = useCallback(async () => {
    if (!titulo.trim() || !valor || !vencimento) {
      setErro("Preencha título, valor e vencimento.");
      return;
    }
    if (tipo === "adiantamento" && !justificativa.trim()) {
      setErro("Adiantamento exige justificativa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const res = await fetch(`/api/crm/obras/${encodeURIComponent(obraId)}/financeiro`, {
        method: "POST",
        headers: { ...internalApiHeaders(), "content-type": "application/json" },
        body: JSON.stringify({
          acao: "pagamento",
          titulo: titulo.trim(),
          valor: Number(valor),
          data_vencimento: vencimento,
          tipo,
          orcamento_id: orcamentoId || undefined,
          adiantamento_justificativa: justificativa.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; detalhe?: string };
      if (!res.ok) {
        setErro(json.detalhe ?? json.error ?? "Falha ao lançar o pagamento.");
        return;
      }
      onCriado();
    } catch {
      setErro("Falha de rede.");
    } finally {
      setSalvando(false);
    }
  }, [titulo, valor, vencimento, tipo, orcamentoId, justificativa, obraId, onCriado]);

  return (
    <div style={overlay} role="dialog" aria-label="Lançar pagamento" onClick={onFechar}>
      <div style={drawer} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: TEXTO }}>Lançar pagamento</h3>
          <button type="button" onClick={onFechar} style={{ background: "none", border: "none", color: TEXTO_FRACO, cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        <label style={rotulo}>Título</label>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Medição 3 — Elétrica" style={{ ...input, marginBottom: 12 }} />

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Valor</label>
            <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="84000" type="number" style={input} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={rotulo}>Vencimento</label>
            <input value={vencimento} onChange={(e) => setVencimento(e.target.value)} type="date" style={input} />
          </div>
        </div>

        <label style={rotulo}>Tipo</label>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={{ ...input, marginBottom: 12 }}>
          <option value="medicao">Medição</option>
          <option value="adiantamento">Adiantamento</option>
          <option value="retencao">Retenção</option>
          <option value="aditivo">Aditivo</option>
          <option value="reembolso">Reembolso (sem escrow)</option>
          <option value="avulso">Avulso (sem escrow)</option>
        </select>

        {tipo !== "avulso" && tipo !== "reembolso" && aprovados.length > 0 && (
          <>
            <label style={rotulo}>Orçamento da frente (libera o pagamento)</label>
            <select value={orcamentoId} onChange={(e) => setOrcamentoId(e.target.value)} style={{ ...input, marginBottom: 12 }}>
              <option value="">— sem orçamento (nasce bloqueado) —</option>
              {aprovados.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.titulo} ({brl(o.valor_total)})
                </option>
              ))}
            </select>
          </>
        )}

        {tipo === "adiantamento" && (
          <>
            <label style={rotulo}>Justificativa (obrigatória)</label>
            <input value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Motivo do adiantamento" style={{ ...input, marginBottom: 12 }} />
          </>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#3a2a0f", border: `1px solid ${DOURADO}55`, borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#f0c869" }}>
          <HandCoins size={16} /> A liberação do dinheiro exige aprovação dupla (arquitetura + Hub). Você prepara aqui.
        </div>

        {erro && <p style={{ color: "#f85149", fontSize: 13, margin: "0 0 10px" }}>{erro}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={onFechar} style={{ ...botaoSecundario, flex: 1 }}>
            Cancelar
          </button>
          <button type="button" disabled={salvando} onClick={salvar} style={{ ...botaoPrimario, flex: 1 }}>
            {salvando ? "Lançando…" : "Lançar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Estilos compartilhados ──────────────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "flex-end",
  zIndex: 50,
};
const drawer: React.CSSProperties = {
  width: "100%",
  maxWidth: 460,
  height: "100%",
  background: "#0a140f",
  borderLeft: `1px solid ${BORDA}`,
  padding: 20,
  overflowY: "auto",
};
const rotulo: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 700, color: TEXTO_FRACO, marginBottom: 6 };
const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  background: BG_INPUT,
  border: `1px solid ${BORDA}`,
  borderRadius: 8,
  color: TEXTO,
  fontSize: 13,
};
const botaoPrimario: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "9px 14px",
  background: DOURADO,
  color: "#0a140f",
  fontWeight: 700,
  fontSize: 13,
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const botaoSecundario: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "9px 14px",
  background: "transparent",
  color: "#8aa99a",
  fontWeight: 600,
  fontSize: 13,
  border: `1px solid ${BORDA}`,
  borderRadius: 8,
  cursor: "pointer",
};
