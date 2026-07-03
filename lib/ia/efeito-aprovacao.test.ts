import { describe, it, expect } from "vitest";
import { mensagemDoEfeito } from "./efeito-aprovacao";

// Teste 100% PURO — importa só mensagemDoEfeito (sem banco, sem supabase, sem fetch).
// Formatador determinístico injetado para não depender de Intl/locale.
const fmt = (v: number) => "R$ " + v;

describe("mensagemDoEfeito — mapeamento efeito -> mensagem (fiel à verdade da RPC)", () => {
  it("(a) escrow_aguardando faltando Hub: fala da chave do Hub e NÃO diz 'liberado'", () => {
    const msg = mensagemDoEfeito({ kind: "escrow_aguardando", faltam: ["hub"] }, fmt);
    expect(msg).toContain("falta a chave do Hub");
    expect(msg).not.toContain("liberado");
  });

  it("(b) escrow_aguardando faltando Arquitetura: fala da chave da Arquitetura", () => {
    const msg = mensagemDoEfeito({ kind: "escrow_aguardando", faltam: ["arquitetura"] }, fmt);
    expect(msg).toContain("a chave da Arquitetura");
  });

  it("(c) escrow_liberado: mostra o valor via formatador injetado", () => {
    const msg = mensagemDoEfeito({ kind: "escrow_liberado", valorLiberado: 12500 }, fmt);
    expect(msg).toContain("Escrow liberado: R$ 12500");
  });

  it("(d) orcamento_aprovado N=3: plural 'pagamentos desbloqueados'", () => {
    const msg = mensagemDoEfeito({ kind: "orcamento_aprovado", pagamentosLiberados: 3 }, fmt);
    expect(msg).toContain("3 pagamentos desbloqueados");
  });

  it("(e) orcamento_aprovado N=1: singular 'pagamento desbloqueado'", () => {
    const msg = mensagemDoEfeito({ kind: "orcamento_aprovado", pagamentosLiberados: 1 }, fmt);
    expect(msg).toContain("1 pagamento desbloqueado");
    expect(msg).not.toContain("pagamentos");
  });

  it("(f) ja_processada: 'sem novo movimento'", () => {
    const msg = mensagemDoEfeito({ kind: "ja_processada" }, fmt);
    expect(msg).toContain("sem novo movimento");
  });

  it("(g) indisponivel: NÃO diz 'liberado' e é honesto ('confirmada em instantes')", () => {
    const msg = mensagemDoEfeito({ kind: "indisponivel" }, fmt);
    expect(msg).not.toContain("liberado");
    expect(msg).toContain("confirmada em instantes");
  });

  it("(h) undefined: cai no fallback ('registrado')", () => {
    const msg = mensagemDoEfeito(undefined, fmt);
    expect(msg).toContain("registrado");
  });

  // ── Caminhos idempotentes de DINHEIRO: não podem mentir "liberado R$X" ──
  it("(i) escrow_ja_liberado: honesto, sem novo movimento e sem afirmar valor", () => {
    const msg = mensagemDoEfeito({ kind: "escrow_ja_liberado" }, fmt);
    expect(msg).toContain("já havia sido liberado");
    expect(msg).not.toContain("R$");
  });

  it("(j) orcamento_ja_aprovado: honesto, 'nenhum novo movimento'", () => {
    const msg = mensagemDoEfeito({ kind: "orcamento_ja_aprovado" }, fmt);
    expect(msg).toContain("já estava aprovado");
    expect(msg).not.toContain("desbloquead");
  });

  // ── Falha REAL da cascata: não pode fingir sucesso nem dizer 'liberado' ──
  it("(k) falhou: avisa que a liberação NÃO concluiu e não mente 'liberado'", () => {
    const msg = mensagemDoEfeito({ kind: "falhou" }, fmt);
    expect(msg).toContain("não pôde ser concluída");
    expect(msg).not.toContain("liberado");
  });

  it("(l) falhou com motivo: mostra o motivo controlado", () => {
    const msg = mensagemDoEfeito({ kind: "falhou", motivo: "pagamento_nao_encontrado" }, fmt);
    expect(msg).toContain("pagamento_nao_encontrado");
  });

  // ── Dupla-chave: as DUAS pendentes não afirma "1 de 2 registrada" ──
  it("(m) escrow_aguardando faltando AS DUAS: não afirma '1 de 2 registrada'", () => {
    const msg = mensagemDoEfeito({ kind: "escrow_aguardando", faltam: ["arquitetura", "hub"] }, fmt);
    expect(msg).toContain("Aguardando");
    expect(msg).not.toContain("1 de 2");
    expect(msg).not.toContain("liberado");
  });

  it("(n) cotacao_aprovada e orcamento_aprovado N=0: mensagens honestas", () => {
    expect(mensagemDoEfeito({ kind: "cotacao_aprovada" }, fmt)).toContain("Cotação aprovada");
    const zero = mensagemDoEfeito({ kind: "orcamento_aprovado", pagamentosLiberados: 0 }, fmt);
    expect(zero).toContain("Orçamento aprovado");
    expect(zero).not.toContain("desbloquead");
  });
});
