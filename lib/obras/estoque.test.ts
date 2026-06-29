import { describe, it, expect } from "vitest";
import {
  TIPOS_MATERIAL_SC,
  STATUS_SC,
  STATUS_SC_ABERTOS,
  URGENCIAS_SC,
  TIPOS_MOVIMENTO,
  isTipoMaterialSc,
  isStatusSc,
  isUrgenciaSc,
  isOrigemSc,
  isTipoMovimento,
  pontuarCotacoes,
  melhorCotacaoIndice,
  sanitizarCotacoes,
  formulaInventario,
  previewAposMovimento,
  APRESENTACAO_STATUS_SC,
  APRESENTACAO_TIPO_MATERIAL,
  type CotacaoItem,
} from "./estoque";

describe("estoque — enums e guards (espelham os CHECK da migração)", () => {
  it("guards aceitam só valores válidos", () => {
    expect(isTipoMaterialSc("material")).toBe(true);
    expect(isTipoMaterialSc("imovel")).toBe(false);
    expect(isStatusSc("entregue_parcial")).toBe(true);
    expect(isStatusSc("inventado")).toBe(false);
    expect(isUrgenciaSc("critico")).toBe(true);
    expect(isUrgenciaSc("medio")).toBe(false);
    expect(isOrigemSc("e3_restricao")).toBe(true);
    expect(isOrigemSc("xpto")).toBe(false);
    expect(isTipoMovimento("devolucao")).toBe(true);
    expect(isTipoMovimento("transferencia")).toBe(false);
  });

  it("STATUS_SC_ABERTOS é subconjunto de STATUS_SC e exclui fechados", () => {
    for (const s of STATUS_SC_ABERTOS) expect(STATUS_SC).toContain(s);
    expect(STATUS_SC_ABERTOS).not.toContain("entregue");
    expect(STATUS_SC_ABERTOS).not.toContain("cancelado");
  });

  it("toda chave de enum tem apresentação (sem buraco visual)", () => {
    for (const s of STATUS_SC) expect(APRESENTACAO_STATUS_SC[s]).toBeTruthy();
    for (const t of TIPOS_MATERIAL_SC) expect(APRESENTACAO_TIPO_MATERIAL[t]).toBeTruthy();
    expect(URGENCIAS_SC.length).toBe(3);
    expect(TIPOS_MOVIMENTO).toContain("ajuste");
  });
});

describe("estoque — score de cotação (IA sugere; humano escolhe)", () => {
  it("custo-benefício (cenário T2): homologado de preço intermediário vence o avulso mais barato", () => {
    // Reproduz a tela T2 do E5-DESIGN: 3 cotações, a do meio (homologada, rápida) ganha do avulso barato.
    const cot: CotacaoItem[] = [
      { fornecedor_nome: "ConstruMax", fornecedor_id: "f1", homologado: true, valor_total: 1180, prazo_dias: 6 },
      { fornecedor_nome: "Friopeças", fornecedor_id: "f2", homologado: true, valor_total: 1140, prazo_dias: 2 },
      { fornecedor_nome: "Avulso", valor_total: 1090, prazo_dias: 5 }, // mais barato, mas sem fornecedor (risco)
    ];
    const pont = pontuarCotacoes(cot);
    expect(pont.every((c) => c.score_ia !== null)).toBe(true);
    // Friopeças (índice 1): preço médio + prazo mínimo + homologado → melhor custo-benefício.
    const melhor = melhorCotacaoIndice(pont);
    expect(melhor).toBe(1);
  });

  it("o mais barato E mais rápido vence mesmo sendo avulso (o score é honesto, não enviesado)", () => {
    const cot: CotacaoItem[] = [
      { fornecedor_nome: "ConstruMax", fornecedor_id: "f1", homologado: true, valor_total: 1180, prazo_dias: 6 },
      { fornecedor_nome: "Avulso", valor_total: 1090, prazo_dias: 3 }, // mais barato E mais rápido
    ];
    const melhor = melhorCotacaoIndice(pontuarCotacoes(cot));
    expect(melhor).toBe(1);
  });

  it("sem base de comparação (1 cotação) → score_ia null, não inventa", () => {
    const pont = pontuarCotacoes([{ fornecedor_nome: "Único", valor_total: 500 }]);
    expect(pont[0].score_ia).toBeNull();
    expect(melhorCotacaoIndice(pont)).toBe(-1);
  });

  it("cotação sem valor válido recebe score null e é ignorada na escolha", () => {
    const cot: CotacaoItem[] = [
      { fornecedor_nome: "A", fornecedor_id: "f1", valor_total: 100, prazo_dias: 2 },
      { fornecedor_nome: "B", fornecedor_id: "f2", valor_total: 200, prazo_dias: 5 },
      { fornecedor_nome: "Lixo", valor_total: 0 },
    ];
    const pont = pontuarCotacoes(cot);
    expect(pont[2].score_ia).toBeNull();
    expect([0, 1]).toContain(melhorCotacaoIndice(pont));
  });

  it("componentes do score ficam entre 0 e 1", () => {
    const cot: CotacaoItem[] = [
      { fornecedor_nome: "A", fornecedor_id: "f1", homologado: true, valor_total: 100, prazo_dias: 2 },
      { fornecedor_nome: "B", fornecedor_id: "f2", valor_total: 300, prazo_dias: 10 },
    ];
    const pont = pontuarCotacoes(cot);
    for (const c of pont) {
      if (c.score_ia) {
        expect(c.score_ia.total).toBeGreaterThanOrEqual(0);
        expect(c.score_ia.total).toBeLessThanOrEqual(1);
        expect(c.score_ia.preco).toBeGreaterThanOrEqual(0);
        expect(c.score_ia.risco).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("estoque — sanitização de cotações (anti-lixo do body/IA)", () => {
  it("descarta entradas sem nome ou sem valor numérico", () => {
    const raw = [
      { fornecedor_nome: "OK", valor_total: 100 },
      { fornecedor_nome: "", valor_total: 50 },
      { valor_total: 50 },
      { fornecedor_nome: "SemValor" },
      "lixo",
      null,
    ];
    const out = sanitizarCotacoes(raw);
    expect(out).toHaveLength(1);
    expect(out[0].fornecedor_nome).toBe("OK");
  });

  it("normaliza prazo_dias e homologado, preserva escolhida", () => {
    const out = sanitizarCotacoes([
      { fornecedor_nome: "X", valor_total: 100, prazo_dias: 4.7, homologado: true, escolhida: true },
    ]);
    expect(out[0].prazo_dias).toBe(5);
    expect(out[0].homologado).toBe(true);
    expect(out[0].escolhida).toBe(true);
  });

  it("não-array → vazio", () => {
    expect(sanitizarCotacoes(null)).toEqual([]);
    expect(sanitizarCotacoes("x")).toEqual([]);
  });
});

describe("estoque — inventário derivado (Entrada − Saída + Devolução)", () => {
  it("fórmula visível bate com a planilha", () => {
    const f = formulaInventario({ total_entrada: 50, total_saida: 14, total_devolucao: 2 });
    expect(f).toBe("Entr.50 − Saí.14 + Dev.2");
  });

  it("inclui ajuste só quando há", () => {
    expect(formulaInventario({ total_entrada: 10, total_saida: 0, total_devolucao: 0 })).not.toContain("Aj.");
    expect(formulaInventario({ total_entrada: 10, total_saida: 0, total_devolucao: 0, total_ajuste: 3 })).toContain("Aj.3");
  });

  it("preview de movimento: saída subtrai, devolução/entrada somam", () => {
    expect(previewAposMovimento(38, "saida", 12)).toBe(26);
    expect(previewAposMovimento(38, "devolucao", 2)).toBe(40);
    expect(previewAposMovimento(38, "entrada", 50)).toBe(88);
    expect(previewAposMovimento(38, "ajuste", 5)).toBe(43);
  });

  it("preview pode ficar negativo (não bloqueia; a UI avisa)", () => {
    expect(previewAposMovimento(10, "saida", 12)).toBe(-2);
  });
});
