import { describe, it, expect } from "vitest";
import {
  TIPOS_CONTRATO,
  STATUS_ORCAMENTO,
  STATUS_ESCROW,
  TIPOS_PAGAMENTO,
  STATUS_PAGAMENTO,
  STATUS_PAGAMENTO_LIBERAVEIS,
  TIPOS_APROVACAO_E6,
  APRESENTACAO_TIPO_CONTRATO,
  APRESENTACAO_STATUS_ORCAMENTO,
  APRESENTACAO_STATUS_PAGAMENTO,
  APRESENTACAO_APROVACAO_E6,
  APRESENTACAO_COBERTURA,
  isTipoContrato,
  isStatusOrcamento,
  isStatusEscrow,
  isTipoPagamento,
  isStatusPagamento,
  isTipoAprovacaoE6,
  mostraUnitario,
  rotuloAbaOrcamento,
  rotuloAbaPagamentos,
  pagamentoSemEscrow,
  derivarEstadoDupla,
  classificarCobertura,
  pagamentoAtrasado,
  baldePagamento,
  rotuloSpreadAdministracao,
  resumoFinanceiroVazio,
} from "./financeiro";

describe("financeiro — enums e guards (espelham os CHECK da migração E6)", () => {
  it("guards aceitam só valores válidos", () => {
    expect(isTipoContrato("administracao")).toBe(true);
    expect(isTipoContrato("preco_fechado")).toBe(true);
    expect(isTipoContrato("empreitada")).toBe(false);
    expect(isStatusOrcamento("aprovado")).toBe(true);
    expect(isStatusOrcamento("pago")).toBe(false);
    expect(isStatusEscrow("em_custodia")).toBe(true);
    expect(isStatusEscrow("sacado")).toBe(false);
    expect(isTipoPagamento("medicao")).toBe(true);
    expect(isTipoPagamento("pix")).toBe(false);
    expect(isStatusPagamento("autorizado")).toBe(true);
    expect(isStatusPagamento("enviado")).toBe(false);
    expect(isTipoAprovacaoE6("pagamento_obra_hub")).toBe(true);
    expect(isTipoAprovacaoE6("cotacao_fornecedor")).toBe(false);
  });

  it("toda chave de enum tem apresentação (sem buraco visual)", () => {
    for (const t of TIPOS_CONTRATO) expect(APRESENTACAO_TIPO_CONTRATO[t]).toBeTruthy();
    for (const s of STATUS_ORCAMENTO) expect(APRESENTACAO_STATUS_ORCAMENTO[s]).toBeTruthy();
    for (const s of STATUS_PAGAMENTO) expect(APRESENTACAO_STATUS_PAGAMENTO[s]).toBeTruthy();
    for (const t of TIPOS_APROVACAO_E6) expect(APRESENTACAO_APROVACAO_E6[t]).toBeTruthy();
    expect(Object.keys(APRESENTACAO_COBERTURA)).toHaveLength(3);
  });

  it("STATUS_PAGAMENTO_LIBERAVEIS é subconjunto de STATUS_PAGAMENTO e exclui terminais", () => {
    for (const s of STATUS_PAGAMENTO_LIBERAVEIS) expect(STATUS_PAGAMENTO).toContain(s);
    expect(STATUS_PAGAMENTO_LIBERAVEIS).not.toContain("pago");
    expect(STATUS_PAGAMENTO_LIBERAVEIS).not.toContain("bloqueado");
    expect(STATUS_PAGAMENTO_LIBERAVEIS).not.toContain("cancelado");
  });
});

describe("financeiro — bifurcação por tipo de contrato (apresentação)", () => {
  it("administração mostra unitário; preço fechado não", () => {
    expect(mostraUnitario("administracao")).toBe(true);
    expect(mostraUnitario("preco_fechado")).toBe(false);
  });

  it("rótulos das abas mudam por tipo (T1a Custos × T1b Etapas)", () => {
    expect(rotuloAbaOrcamento("administracao")).toBe("Custos");
    expect(rotuloAbaOrcamento("preco_fechado")).toBe("Etapas");
    expect(rotuloAbaPagamentos("administracao")).toBe("Pagamentos");
    expect(rotuloAbaPagamentos("preco_fechado")).toBe("Medições");
  });

  it("itens avulso/reembolso são 'sem escrow' (honestidade na UI)", () => {
    expect(pagamentoSemEscrow("avulso")).toBe(true);
    expect(pagamentoSemEscrow("reembolso")).toBe(true);
    expect(pagamentoSemEscrow("medicao")).toBe(false);
  });
});

describe("financeiro — aprovação dupla (escrow só libera com arq E hub)", () => {
  it("ambas aprovadas → completa, nada falta", () => {
    const e = derivarEstadoDupla("aprovado", "aprovado");
    expect(e.completa).toBe(true);
    expect(e.faltam).toEqual([]);
  });

  it("só arquitetura aprovada → falta o Hub (a 2ª chave)", () => {
    const e = derivarEstadoDupla("aprovado", "pendente");
    expect(e.completa).toBe(false);
    expect(e.faltam).toEqual(["hub"]);
  });

  it("só Hub aprovado → falta a arquitetura", () => {
    const e = derivarEstadoDupla("pendente", "aprovado");
    expect(e.completa).toBe(false);
    expect(e.faltam).toEqual(["arquitetura"]);
  });

  it("chave ausente (registro não criado) conta como pendente — fail-closed, nunca libera", () => {
    const e = derivarEstadoDupla(null, "aprovado");
    expect(e.arq).toBe("ausente");
    expect(e.completa).toBe(false);
    expect(e.faltam).toContain("arquitetura");
  });

  it("aceita o vocabulário legado 'aprovada' (pt feminino) como aprovado", () => {
    const e = derivarEstadoDupla("aprovada", "aprovada");
    expect(e.completa).toBe(true);
  });

  it("rejeitada nunca conta como aprovada", () => {
    const e = derivarEstadoDupla("rejeitado", "aprovado");
    expect(e.arq).toBe("rejeitado");
    expect(e.completa).toBe(false);
  });
});

describe("financeiro — compatibilização/cobertura (🟢🟡🔴 + %)", () => {
  it("🟢 coberto: orçado aprovado ≥ contratado", () => {
    const c = classificarCobertura({ valor_contrato: 120000, orcado_aprovado: 120000 });
    expect(c.estado).toBe("coberto");
    expect(c.pct_cobertura).toBe(100);
    expect(c.eh_aditivo).toBe(false);
  });

  it("🟡 parcial: cobertura aprovada < 100%", () => {
    const c = classificarCobertura({ valor_contrato: 45000, orcado_aprovado: 30000 });
    expect(c.estado).toBe("parcial");
    expect(c.pct_cobertura).toBe(67);
  });

  it("🟡 parcial: só há orçamento PENDENTE (não deixa pendente parecer coberto)", () => {
    const c = classificarCobertura({ valor_contrato: 50000, orcado_aprovado: 0, orcado_pendente: 50000 });
    expect(c.estado).toBe("parcial");
  });

  it("🔴 sem_orcamento: nada aprovado nem pendente", () => {
    const c = classificarCobertura({ valor_contrato: 120000, orcado_aprovado: 0 });
    expect(c.estado).toBe("sem_orcamento");
    expect(c.pct_cobertura).toBe(0);
  });

  it("sem valor_contrato → pct NULL (UI mostra —%, nunca NaN)", () => {
    const c = classificarCobertura({ valor_contrato: null, orcado_aprovado: 5000 });
    expect(c.pct_cobertura).toBeNull();
    expect(c.estado).toBe("parcial"); // há orçado mas sem base de % → parcial, não coberto
  });

  it("aditivo: orçado > contratado vira badge eh_aditivo (legítimo, >100%)", () => {
    const c = classificarCobertura({ valor_contrato: 80000, orcado_aprovado: 95000 });
    expect(c.estado).toBe("coberto");
    expect(c.eh_aditivo).toBe(true);
    expect(c.pct_cobertura).toBe(119);
  });
});

describe("financeiro — atraso de pagamento (DERIVADO, nunca coluna)", () => {
  const HOJE = "2026-06-29";
  it("liberado + vencido = atrasado", () => {
    expect(pagamentoAtrasado("liberado", "2026-06-25", HOJE)).toBe(true);
    expect(pagamentoAtrasado("autorizado", "2026-06-25", HOJE)).toBe(true);
  });
  it("pago/bloqueado nunca conta como atrasado (não é liberável a pagar)", () => {
    expect(pagamentoAtrasado("pago", "2026-06-25", HOJE)).toBe(false);
    expect(pagamentoAtrasado("bloqueado", "2026-06-25", HOJE)).toBe(false);
  });
  it("em_custodia vencido NÃO é atraso de pagamento (o dinheiro já está no cofre)", () => {
    expect(pagamentoAtrasado("em_custodia", "2026-06-25", HOJE)).toBe(false);
  });
  it("vencimento futuro não é atraso; sem vencimento também não", () => {
    expect(pagamentoAtrasado("liberado", "2026-07-10", HOJE)).toBe(false);
    expect(pagamentoAtrasado("liberado", null, HOJE)).toBe(false);
  });

  it("baldePagamento classifica em UM balde só (mutuamente exclusivos)", () => {
    expect(baldePagamento("liberado", "2026-06-25", HOJE)).toBe("atrasado");
    expect(baldePagamento("liberado", "2026-07-03", HOJE)).toBe("vencendo_7d"); // 4 dias
    expect(baldePagamento("liberado", "2026-07-20", HOJE)).toBe("a_pagar");
    expect(baldePagamento("autorizado", "2026-07-20", HOJE)).toBe("a_pagar");
    expect(baldePagamento("pago", "2026-06-01", HOJE)).toBe("pago");
    expect(baldePagamento("bloqueado", "2026-06-25", HOJE)).toBe("fora");
  });

  it("em_custodia é seu PRÓPRIO balde (cofre) — não cai em prazo, mesmo vencido", () => {
    // O dinheiro já saiu do cliente e está em custódia; não é "a pagar" nem "atrasado".
    expect(baldePagamento("em_custodia", "2026-06-25", HOJE)).toBe("em_custodia");
    expect(baldePagamento("em_custodia", "2026-07-20", HOJE)).toBe("em_custodia");
  });
});

describe("financeiro — spread honesto (gerenciamento como economia)", () => {
  it("spread positivo vira rótulo com % e economia", () => {
    const r = rotuloSpreadAdministracao(8, 890);
    expect(r).toContain("gerenciamento 8%");
    expect(r).toContain("890");
    expect(r).toContain("poupados");
  });
  it("sem economia mostra só o % declarado", () => {
    expect(rotuloSpreadAdministracao(8)).toBe("gerenciamento 8% declarado");
  });
  it("spread zero/ausente → null (administração não renderiza linha sem spread)", () => {
    expect(rotuloSpreadAdministracao(0)).toBeNull();
    expect(rotuloSpreadAdministracao(null)).toBeNull();
  });
});

describe("financeiro — resumo vazio (base degradável)", () => {
  it("resumo vazio zera todos os baldes", () => {
    const r = resumoFinanceiroVazio();
    expect(r.previsto).toBe(0);
    expect(r.aprovado).toBe(0);
    expect(r.em_custodia).toBe(0);
    expect(r.aguarda_2a_chave).toBe(0);
  });
});
