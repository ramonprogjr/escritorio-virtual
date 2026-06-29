import { describe, it, expect } from "vitest";
import {
  LENTES,
  PERSONAS,
  isLenteEscopo,
  isPersonaEscopo,
  personaPodeVerCusto,
  personaPodeVerMargem,
  personaPodeVerPreco,
  lentesDaPersona,
  bdiEfetivo,
  custoUnitario,
  custoTotal,
  precoUnitario,
  precoTotal,
  margemPct,
  formulaPreco,
  calcularItem,
  pesosNormalizados,
  avancoPonderado,
  subtotalGrupo,
  montarArvore,
  cockpitDe,
  rotuloAmbiente,
  rotuloDisciplina,
  fmtMoeda,
  round2,
  type ItemEscopoInput,
  type ItemEscopoCalc,
} from "./escopo";

// ── enums + guards ────────────────────────────────────────────────────────────
describe("escopo — enums e guards", () => {
  it("guards de lente e persona aceitam só valores válidos", () => {
    expect(isLenteEscopo("preco")).toBe(true);
    expect(isLenteEscopo("avanco")).toBe(true);
    expect(isLenteEscopo("inexistente")).toBe(false);
    expect(isPersonaEscopo("executor")).toBe(true);
    expect(isPersonaEscopo("hub")).toBe(true);
    expect(isPersonaEscopo("cliente")).toBe(false);
    expect(LENTES.length).toBe(4);
    expect(PERSONAS.length).toBe(4);
  });
});

// ── persona (decisão 3b — bifurcação na apresentação) ─────────────────────────
describe("escopo — visibilidade por persona (decisão 3b)", () => {
  it("custo e margem só p/ executor|hub; arquiteto não vê dinheiro; prestador vê preço, nunca margem", () => {
    expect(personaPodeVerCusto("executor")).toBe(true);
    expect(personaPodeVerCusto("hub")).toBe(true);
    expect(personaPodeVerCusto("arquiteto")).toBe(false);
    expect(personaPodeVerCusto("prestador")).toBe(false);

    expect(personaPodeVerMargem("prestador")).toBe(false);
    expect(personaPodeVerMargem("hub")).toBe(true);

    expect(personaPodeVerPreco("arquiteto")).toBe(false);
    expect(personaPodeVerPreco("prestador")).toBe(true);
  });

  it("lentes da persona: arquiteto só avanço; prestador preço+avanço; hub tudo", () => {
    expect(lentesDaPersona("arquiteto")).toEqual(["avanco"]);
    expect(lentesDaPersona("prestador")).toEqual(["preco", "avanco"]);
    expect(lentesDaPersona("hub")).toEqual(["preco", "custo", "margem", "avanco"]);
    expect(lentesDaPersona("executor")).toEqual(["preco", "custo", "margem", "avanco"]);
  });
});

// ── BDI 3 camadas (item → obra → 1.0) ─────────────────────────────────────────
describe("escopo — BDI efetivo (3 camadas, espelha COALESCE do SQL)", () => {
  it("usa override do item quando válido (>0)", () => {
    expect(bdiEfetivo(1.2, 1.06)).toBe(1.2);
  });
  it("cai para o BDI da obra quando o item é null/0/negativo", () => {
    expect(bdiEfetivo(null, 1.06)).toBe(1.06);
    expect(bdiEfetivo(0, 1.06)).toBe(1.06);
    expect(bdiEfetivo(-1, 1.06)).toBe(1.06);
  });
  it("cai para 1.0 neutro quando item e obra são ausentes", () => {
    expect(bdiEfetivo(null, null)).toBe(1.0);
    expect(bdiEfetivo(undefined, undefined)).toBe(1.0);
    expect(bdiEfetivo(0, 0)).toBe(1.0);
  });
});

// ── custo (espelha as GENERATED de E7) ────────────────────────────────────────
describe("escopo — custo_unitario / custo_total (espelha GENERATED do E7)", () => {
  it("custo_unitario = soma das 3 parcelas, NULL conta como 0", () => {
    expect(custoUnitario({ custo_locacao_frete: 10, custo_material: 20, custo_mao_obra: 20 })).toBe(50);
    expect(custoUnitario({ custo_locacao_frete: null, custo_material: 20, custo_mao_obra: null })).toBe(20);
    expect(custoUnitario({})).toBe(0);
  });

  it("custo_total = custo_unitario × quantidade (NÃO encadeia GENERATED — soma inline × qtd)", () => {
    expect(custoTotal({ custo_material: 50, quantidade: 17 })).toBe(850);
    expect(custoTotal({ custo_locacao_frete: 10, custo_material: 20, custo_mao_obra: 20, quantidade: 3 })).toBe(150);
  });

  it("quantidade NULL → custo_total NULL (item sem qtd não tem total; UI mostra —, nunca 0)", () => {
    expect(custoTotal({ custo_material: 50, quantidade: null })).toBeNull();
    expect(custoTotal({ custo_material: 50 })).toBeNull();
  });

  it("arredonda a 2 casas", () => {
    expect(custoTotal({ custo_material: 33.333, quantidade: 3 })).toBe(100); // 33.333*3 = 99.999 → 100.00
  });
});

// ── preço × BDI × margem (espelha vw_hub_obra_item_margem) ────────────────────
describe("escopo — preço e margem (custo × BDI; espelha a view de margem)", () => {
  it("preco_unitario = custo × BDI", () => {
    expect(precoUnitario(50, 1.06)).toBe(53);
  });
  it("preco_total = custo_total × BDI; NULL propaga", () => {
    expect(precoTotal(850, 1.06)).toBe(901);
    expect(precoTotal(null, 1.06)).toBeNull();
  });
  it("margem% = (preço − custo)/preço; com BDI 1.0 a margem é 0; sem custo é null", () => {
    // BDI 1.06: margem = (901-850)/901 ≈ 5.66%
    expect(margemPct(850, 1.06)).toBeCloseTo(5.66, 1);
    expect(margemPct(100, 1.0)).toBe(0); // sem markup → margem 0 (não null: há preço)
    expect(margemPct(null, 1.06)).toBeNull(); // sem custo → sem preço → null
    expect(margemPct(0, 1.06)).toBeNull(); // custo_total 0 → preço 0 → null
  });
});

// ── fórmula EXPOSTA (o dono é engenheiro) ─────────────────────────────────────
describe("escopo — fórmula exposta (R$ custo × BDI × qtd = R$ preço)", () => {
  it("monta a string com 2 casas no dinheiro e fator limpo", () => {
    // 50 × 1.06 × 17 = 901
    expect(formulaPreco(50, 1.06, 17)).toBe("R$ 50,00 × 1.06 × 17 = R$ 901,00");
  });
  it("quantidade null cai p/ 1 na fórmula (preview)", () => {
    expect(formulaPreco(50, 1.0, null)).toBe("R$ 50,00 × 1 × 1 = R$ 50,00");
  });
  it("quantidade 0 é VÁLIDA: mostra × 0 = R$ 0,00 (não cai p/ × 1)", () => {
    expect(formulaPreco(50, 1.06, 0)).toBe("R$ 50,00 × 1.06 × 0 = R$ 0,00");
  });
});

// ── calcularItem (derivados in-code = fallback sem as views) ──────────────────
describe("escopo — calcularItem (fallback in-code quando E7 não aplicou)", () => {
  it("preenche todos os derivados a partir do cru + BDI da obra", () => {
    const it: ItemEscopoInput = {
      id: "a",
      parent_id: null,
      custo_material: 50,
      quantidade: 17,
      pct_avanco: 30,
    };
    const c = calcularItem(it, 1.06);
    expect(c.custo_unitario).toBe(50);
    expect(c.custo_total).toBe(850);
    expect(c.preco_total).toBe(901);
    expect(c.bdi_efetivo).toBe(1.06);
  });

  it("override de BDI no item vence o da obra", () => {
    const c = calcularItem({ id: "a", parent_id: null, custo_material: 100, quantidade: 1, bdi_fator: 1.2 }, 1.06);
    expect(c.bdi_efetivo).toBe(1.2);
    expect(c.preco_total).toBe(120);
  });
});

// ── peso normalizado (só raiz; Σ=1; não conta pai+subitem em dobro) ───────────
describe("escopo — peso financeiro normalizado (só itens-raiz)", () => {
  it("normaliza pelo preço_total; soma das raízes = 1", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, custo_material: 100, quantidade: 1 }, 1.0), // preço 100
      calcularItem({ id: "r2", parent_id: null, custo_material: 300, quantidade: 1 }, 1.0), // preço 300
      calcularItem({ id: "sub", parent_id: "r1", custo_material: 999, quantidade: 1 }, 1.0), // NÃO entra
    ];
    const pesos = pesosNormalizados(itens);
    expect(pesos.get("r1")).toBeCloseTo(0.25, 4);
    expect(pesos.get("r2")).toBeCloseTo(0.75, 4);
    expect(pesos.has("sub")).toBe(false); // subitem não é raiz
    const soma = (pesos.get("r1") ?? 0) + (pesos.get("r2") ?? 0);
    expect(soma).toBeCloseTo(1, 6);
  });

  it("sem custo (Σ=0) → todos os pesos null (degrada p/ média simples)", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, pct_avanco: 50 }, 1.0),
      calcularItem({ id: "r2", parent_id: null, pct_avanco: 100 }, 1.0),
    ];
    const pesos = pesosNormalizados(itens);
    expect(pesos.get("r1")).toBeNull();
    expect(pesos.get("r2")).toBeNull();
  });
});

// ── avanço ponderado (físico ponderado pelo peso financeiro) ──────────────────
describe("escopo — avanço físico ponderado", () => {
  it("pondera pelo preço quando há custo", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, custo_material: 100, quantidade: 1, pct_avanco: 100 }, 1.0), // peso 0.25
      calcularItem({ id: "r2", parent_id: null, custo_material: 300, quantidade: 1, pct_avanco: 0 }, 1.0), // peso 0.75
    ];
    // ponderado = 100*0.25 + 0*0.75 = 25
    expect(avancoPonderado(itens)).toBe(25);
  });

  it("sem custo → média simples", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, pct_avanco: 40 }, 1.0),
      calcularItem({ id: "r2", parent_id: null, pct_avanco: 60 }, 1.0),
    ];
    expect(avancoPonderado(itens)).toBe(50);
  });

  it("lista vazia → 0", () => {
    expect(avancoPonderado([])).toBe(0);
  });
});

// ── subtotal de grupo (soma só raiz p/ dinheiro; avanço ponderado) ────────────
describe("escopo — subtotalGrupo", () => {
  it("soma custo/preço das raízes (subitem não dobra) e calcula margem", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, custo_material: 100, quantidade: 1, pct_avanco: 50 }, 1.06),
      calcularItem({ id: "sub", parent_id: "r1", custo_material: 999, quantidade: 1, pct_avanco: 0 }, 1.06),
    ];
    const s = subtotalGrupo(itens);
    expect(s.custo).toBe(100); // subitem não conta
    expect(s.preco).toBe(106);
    expect(s.itens_raiz).toBe(1);
    expect(s.margem_pct).toBeCloseTo(5.66, 1);
  });

  it("sem custo → margem null, avanço = média simples", () => {
    const itens: ItemEscopoCalc[] = [
      calcularItem({ id: "r1", parent_id: null, pct_avanco: 20 }, 1.0),
      calcularItem({ id: "r2", parent_id: null, pct_avanco: 80 }, 1.0),
    ];
    const s = subtotalGrupo(itens);
    expect(s.margem_pct).toBeNull();
    expect(s.avanco).toBe(50);
  });
});

// ── árvore: ambiente → disciplina → item + cockpit ────────────────────────────
describe("escopo — montarArvore (agregação ambiente → disciplina)", () => {
  const itens: ItemEscopoCalc[] = [
    calcularItem({ id: "c1", parent_id: null, ambiente: "cozinha", disciplina_slug: "eletrica", custo_material: 100, quantidade: 1, pct_avanco: 100 }, 1.0),
    calcularItem({ id: "c2", parent_id: null, ambiente: "cozinha", disciplina_slug: "hidraulica", custo_material: 300, quantidade: 1, pct_avanco: 0 }, 1.0),
    calcularItem({ id: "s1", parent_id: null, ambiente: "sala", disciplina_slug: "eletrica", custo_material: 50, quantidade: 1, pct_avanco: 50 }, 1.0),
  ];

  it("agrupa por ambiente e por disciplina dentro do ambiente", () => {
    const { ambientes } = montarArvore(itens);
    const labels = ambientes.map((a) => a.label).sort();
    expect(labels).toContain("Cozinha");
    expect(labels).toContain("Sala");
    const cozinha = ambientes.find((a) => a.chave === "cozinha")!;
    expect(cozinha.disciplinas.map((d) => d.slug).sort()).toEqual(["eletrica", "hidraulica"]);
  });

  it("subtotal do ambiente soma as disciplinas; ambiente ordena por preço desc", () => {
    const { ambientes } = montarArvore(itens);
    // cozinha (100+300=400) > sala (50) → cozinha primeiro
    expect(ambientes[0].chave).toBe("cozinha");
    expect(ambientes[0].subtotal.preco).toBe(400);
    expect(ambientes[1].subtotal.preco).toBe(50);
  });

  it("cockpit: total orçado, custo, margem, avanço ponderado sobre TODAS as raízes", () => {
    const cockpit = cockpitDe(itens);
    expect(cockpit.total_orcado).toBe(450); // 100+300+50
    expect(cockpit.custo).toBe(450);
    expect(cockpit.itens).toBe(3);
    // avanço ponderado: (100*100 + 300*0 + 50*50)/450 = (10000+0+2500)/450 ≈ 27.8 → 28
    expect(cockpit.avanco).toBe(28);
  });

  it("itens sem ambiente caem em 'Sem ambiente definido'", () => {
    const semAmb = [calcularItem({ id: "x", parent_id: null, custo_material: 10, quantidade: 1 }, 1.0)];
    const { ambientes } = montarArvore(semAmb);
    expect(ambientes[0].label).toBe("Sem ambiente definido");
  });

  it("disciplina desconhecida usa o slug como label; conhecida vem da taxonomia EAP", () => {
    expect(rotuloDisciplina("eletrica").label).toBe("Elétrica");
    expect(rotuloDisciplina("eletrica").cor).toMatch(/^#/);
    expect(rotuloDisciplina("xyz").label).toBe("xyz");
    expect(rotuloDisciplina(null).label).toBe("Sem disciplina");
  });
});

// ── formatação ────────────────────────────────────────────────────────────────
describe("escopo — formatação e arredondamento", () => {
  it("rotuloAmbiente normaliza slug → Title Case", () => {
    expect(rotuloAmbiente("cozinha")).toBe("Cozinha");
    expect(rotuloAmbiente("area_servico")).toBe("Area servico");
    expect(rotuloAmbiente(null)).toBe("Sem ambiente definido");
    expect(rotuloAmbiente("")).toBe("Sem ambiente definido");
  });

  it("fmtMoeda devolve — para nulo/NaN", () => {
    expect(fmtMoeda(null)).toBe("—");
    expect(fmtMoeda(undefined)).toBe("—");
    expect(fmtMoeda(1000)).toContain("R$");
  });

  it("round2 arredonda a 2 casas sem erro de ponto flutuante", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(99.999)).toBe(100);
  });
});
