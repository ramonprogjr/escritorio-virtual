import { describe, it, expect } from "vitest";
import {
  TIPOS_RESTRICAO,
  STATUS_RESTRICAO,
  STATUS_ABERTOS,
  booleanDoTipo,
  tipoDoBooleano,
  acaoSugeridaPadrao,
  ehSstReadonly,
  compararRestricoes,
  isTipoRestricao,
  isStatusRestricao,
  isImpactoRestricao,
  ehRestricaoAtiva,
  APRESENTACAO_TIPO,
  APRESENTACAO_IMPACTO,
} from "./restricoes";

describe("restricoes — mapeamento tipo ↔ boolean E2 (não-duplicação)", () => {
  it("os 5 tipos com boolean mapeiam 1:1 com as colunas falta_* de E2", () => {
    expect(booleanDoTipo("material")).toBe("falta_material");
    expect(booleanDoTipo("pessoa")).toBe("falta_pessoa");
    expect(booleanDoTipo("documento")).toBe("falta_documento");
    expect(booleanDoTipo("ferramenta")).toBe("falta_ferramenta");
    expect(booleanDoTipo("equipamento")).toBe("falta_equipamento");
  });

  it("'outro' não tem boolean correspondente (escape sem coluna em E2)", () => {
    expect(booleanDoTipo("outro")).toBeNull();
  });

  it("a direção inversa (PROMOÇÃO) é consistente para os 5 booleans", () => {
    expect(tipoDoBooleano("falta_material")).toBe("material");
    expect(tipoDoBooleano("falta_pessoa")).toBe("pessoa");
    expect(tipoDoBooleano("falta_documento")).toBe("documento");
    expect(tipoDoBooleano("falta_ferramenta")).toBe("ferramenta");
    expect(tipoDoBooleano("falta_equipamento")).toBe("equipamento");
  });

  it("round-trip tipo→boolean→tipo preserva (exceto 'outro')", () => {
    for (const t of TIPOS_RESTRICAO) {
      const campo = booleanDoTipo(t);
      if (campo) expect(tipoDoBooleano(campo)).toBe(t);
    }
  });
});

describe("restricoes — ação sugerida por tipo (Click-and-Go)", () => {
  it("material → gerar_pedido (elo SC/E5)", () => {
    expect(acaoSugeridaPadrao("material")).toBe("gerar_pedido");
  });
  it("pessoa → atribuir_responsavel", () => {
    expect(acaoSugeridaPadrao("pessoa")).toBe("atribuir_responsavel");
  });
  it("documento → solicitar_documento", () => {
    expect(acaoSugeridaPadrao("documento")).toBe("solicitar_documento");
  });
  it("ferramenta/equipamento → providenciar", () => {
    expect(acaoSugeridaPadrao("ferramenta")).toBe("providenciar");
    expect(acaoSugeridaPadrao("equipamento")).toBe("providenciar");
  });
  it("outro → registrar", () => {
    expect(acaoSugeridaPadrao("outro")).toBe("registrar");
  });
});

describe("restricoes — SST readonly-resolver (§19, Emenda 2)", () => {
  it("documento com origem='sst' é readonly", () => {
    expect(ehSstReadonly({ tipo: "documento", origem: "sst" })).toBe(true);
  });
  it("documento com flag sst=true é readonly", () => {
    expect(ehSstReadonly({ tipo: "documento", sst: true })).toBe(true);
  });
  it("documento comum (sem SST) NÃO é readonly", () => {
    expect(ehSstReadonly({ tipo: "documento", origem: "manual" })).toBe(false);
  });
  it("material com origem='sst' NÃO é readonly (SST só trava documento)", () => {
    expect(ehSstReadonly({ tipo: "material", origem: "sst" })).toBe(false);
  });
});

describe("restricoes — ordenação do cockpit (trava > atrasa > observa, depois +dias)", () => {
  it("trava vem antes de atrasa vem antes de observa", () => {
    const trava = { impacto: "trava" as const, impacto_dias: 1 };
    const atrasa = { impacto: "atrasa" as const, impacto_dias: 9 };
    const observa = { impacto: "observa" as const, impacto_dias: 99 };
    const arr = [observa, atrasa, trava].sort(compararRestricoes);
    expect(arr.map((r) => r.impacto)).toEqual(["trava", "atrasa", "observa"]);
  });

  it("dentro do mesmo impacto, mais dias primeiro", () => {
    const a = { impacto: "trava" as const, impacto_dias: 2 };
    const b = { impacto: "trava" as const, impacto_dias: 7 };
    const arr = [a, b].sort(compararRestricoes);
    expect(arr.map((r) => r.impacto_dias)).toEqual([7, 2]);
  });

  it("impacto null trata como 'observa' (não quebra)", () => {
    const nulo = { impacto: null, impacto_dias: null };
    const trava = { impacto: "trava" as const, impacto_dias: 0 };
    const arr = [nulo, trava].sort(compararRestricoes);
    expect(arr[0].impacto).toBe("trava");
  });
});

describe("restricoes — guards e status ativo", () => {
  it("isTipoRestricao só aceita os 6 tipos", () => {
    expect(isTipoRestricao("material")).toBe(true);
    expect(isTipoRestricao("outro")).toBe(true);
    expect(isTipoRestricao("xpto")).toBe(false);
  });

  it("isStatusRestricao aceita os 5 status incl. virou_pendencia", () => {
    expect(isStatusRestricao("virou_pendencia")).toBe(true);
    expect(isStatusRestricao("resolvida")).toBe(true);
    expect(isStatusRestricao("zumbi")).toBe(false);
  });

  it("isImpactoRestricao aceita os 3 impactos", () => {
    expect(isImpactoRestricao("trava")).toBe(true);
    expect(isImpactoRestricao("urgente")).toBe(false);
  });

  it("status ABERTOS são exatamente aberta/em_resolucao/reaberta", () => {
    expect([...STATUS_ABERTOS].sort()).toEqual(["aberta", "em_resolucao", "reaberta"]);
  });

  it("ehRestricaoAtiva: resolvida e virou_pendencia NÃO são ativas", () => {
    expect(ehRestricaoAtiva("aberta")).toBe(true);
    expect(ehRestricaoAtiva("em_resolucao")).toBe(true);
    expect(ehRestricaoAtiva("reaberta")).toBe(true);
    expect(ehRestricaoAtiva("resolvida")).toBe(false);
    expect(ehRestricaoAtiva("virou_pendencia")).toBe(false);
  });
});

describe("restricoes — apresentação cobre todos os enums (sem hex/rótulo faltando)", () => {
  it("todo tipo tem ícone+label", () => {
    for (const t of TIPOS_RESTRICAO) {
      expect(APRESENTACAO_TIPO[t].icone).toBeTruthy();
      expect(APRESENTACAO_TIPO[t].label).toBeTruthy();
    }
  });
  it("todo impacto tem cor+label", () => {
    for (const i of ["trava", "atrasa", "observa"] as const) {
      expect(APRESENTACAO_IMPACTO[i].cor).toMatch(/^#|^[a-z]/i);
      expect(APRESENTACAO_IMPACTO[i].label).toBeTruthy();
    }
  });
  it("STATUS_RESTRICAO tem exatamente 5 valores", () => {
    expect(STATUS_RESTRICAO).toHaveLength(5);
  });
});
