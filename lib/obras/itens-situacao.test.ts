import { describe, it, expect } from "vitest";
import {
  derivarSituacao,
  diasAtraso,
  avancoDerivadoDeSubitens,
  calcularKpisItens,
  contarBloqueios,
  codigoItemFromNome,
  isSituacaoItem,
  isAndamentoItem,
  SITUACOES,
  ANDAMENTOS,
} from "./itens-situacao";

const HOJE = "2026-06-29";

describe("derivarSituacao — os 7 estados, na ordem sagrada da view", () => {
  const base = {
    andamento: "nao_iniciado",
    pct_avanco: 0,
    situacao_override: null,
    data_inicio: "2026-06-01",
    data_termino: "2026-07-10",
  };

  it("cancelado vence tudo (andamento manda)", () => {
    expect(derivarSituacao({ ...base, andamento: "cancelado", pct_avanco: 50 }, HOJE)).toBe(
      "cancelado"
    );
  });

  it("finalizado → concluido mesmo com prazo vencido (termina atrasado, mas conta como concluído)", () => {
    expect(
      derivarSituacao(
        { ...base, andamento: "finalizado", data_termino: "2026-06-01", pct_avanco: 80 },
        HOJE
      )
    ).toBe("concluido");
  });

  it("pct_avanco>=100 → concluido (mesmo sem finalizar o andamento)", () => {
    expect(derivarSituacao({ ...base, pct_avanco: 100 }, HOJE)).toBe("concluido");
  });

  it("override aplica quando não cancelado/concluído", () => {
    expect(
      derivarSituacao({ ...base, situacao_override: "em_andamento", pct_avanco: 10 }, HOJE)
    ).toBe("em_andamento");
  });

  it("sem data de início OU término → sem_data (planilha tolera)", () => {
    expect(derivarSituacao({ ...base, data_termino: null }, HOJE)).toBe("sem_data");
    expect(derivarSituacao({ ...base, data_inicio: null }, HOJE)).toBe("sem_data");
  });

  it("término no passado e pct<100 → atrasado", () => {
    expect(
      derivarSituacao({ ...base, data_inicio: "2026-06-01", data_termino: "2026-06-20", pct_avanco: 30 }, HOJE)
    ).toBe("atrasado");
  });

  it("início no futuro → a_iniciar", () => {
    expect(
      derivarSituacao({ ...base, data_inicio: "2026-07-01", data_termino: "2026-07-20" }, HOJE)
    ).toBe("a_iniciar");
  });

  it("término em ≤3d e pct<70 → atencao", () => {
    expect(
      derivarSituacao({ ...base, data_inicio: "2026-06-01", data_termino: "2026-07-01", pct_avanco: 40 }, HOJE)
    ).toBe("atencao");
  });

  it("dentro do prazo, em curso → em_andamento", () => {
    expect(
      derivarSituacao({ ...base, data_inicio: "2026-06-01", data_termino: "2026-07-10", pct_avanco: 50 }, HOJE)
    ).toBe("em_andamento");
  });

  it("término em ≤3d mas pct>=70 → em_andamento (não vira atenção)", () => {
    expect(
      derivarSituacao({ ...base, data_inicio: "2026-06-01", data_termino: "2026-07-01", pct_avanco: 85 }, HOJE)
    ).toBe("em_andamento");
  });
});

describe("KPI Finalizados — regra TRAVADA (andamento, nunca situação/pct)", () => {
  it("conta SÓ andamento==='finalizado'", () => {
    const itens = [
      { andamento: "finalizado", situacao: "concluido", parent_id: null },
      { andamento: "iniciado", situacao: "em_andamento", parent_id: null },
      { andamento: "nao_iniciado", situacao: "a_iniciar", parent_id: null },
    ];
    expect(calcularKpisItens(itens).finalizados).toBe(1);
  });

  it("item a 100% PARALISADO não conta como finalizado (separação sagrada)", () => {
    const itens = [
      // situação seria 'concluido' (pct>=100), mas o humano não declarou finalizado
      { andamento: "paralisado", situacao: "concluido", parent_id: null },
    ];
    const kpi = calcularKpisItens(itens);
    expect(kpi.finalizados).toBe(0);
  });

  it("cancelados saem do numerador E do denominador", () => {
    const itens = [
      { andamento: "finalizado", situacao: "concluido", parent_id: null },
      { andamento: "cancelado", situacao: "cancelado", parent_id: null },
      { andamento: "iniciado", situacao: "em_andamento", parent_id: null },
    ];
    const kpi = calcularKpisItens(itens);
    expect(kpi.total).toBe(2); // 3 − 1 cancelado
    expect(kpi.cancelados).toBe(1);
    expect(kpi.finalizados).toBe(1);
  });

  it("subitens (parent_id setado) NÃO entram no KPI (evita dobrar)", () => {
    const itens = [
      { andamento: "finalizado", situacao: "concluido", parent_id: null },
      { andamento: "finalizado", situacao: "concluido", parent_id: "pai-1" },
    ];
    expect(calcularKpisItens(itens).finalizados).toBe(1);
  });

  it("atrasados conta situação='atrasado' (e ignora cancelado)", () => {
    const itens = [
      { andamento: "iniciado", situacao: "atrasado", parent_id: null },
      { andamento: "cancelado", situacao: "atrasado", parent_id: null },
    ];
    expect(calcularKpisItens(itens).atrasados).toBe(1);
  });
});

describe("avancoDerivadoDeSubitens", () => {
  it("média dos subitens não-cancelados", () => {
    expect(
      avancoDerivadoDeSubitens([
        { pct_avanco: 100, andamento: "finalizado" },
        { pct_avanco: 0, andamento: "nao_iniciado" },
      ])
    ).toBe(50);
  });
  it("ignora cancelados na média", () => {
    expect(
      avancoDerivadoDeSubitens([
        { pct_avanco: 80, andamento: "iniciado" },
        { pct_avanco: 0, andamento: "cancelado" },
      ])
    ).toBe(80);
  });
  it("sem subitens elegíveis → null (folha usa o próprio pct)", () => {
    expect(avancoDerivadoDeSubitens([])).toBe(null);
    expect(avancoDerivadoDeSubitens([{ pct_avanco: 50, andamento: "cancelado" }])).toBe(null);
  });
});

describe("diasAtraso", () => {
  it("positivo quando vencido", () => {
    expect(diasAtraso("2026-06-27", HOJE)).toBe(2);
  });
  it("negativo quando ainda no futuro", () => {
    expect(diasAtraso("2026-07-01", HOJE)).toBe(-2);
  });
  it("null sem término", () => {
    expect(diasAtraso(null, HOJE)).toBe(null);
  });
});

describe("contarBloqueios + helpers", () => {
  it("conta as 5 faltas", () => {
    expect(
      contarBloqueios({
        falta_pessoa: true,
        falta_documento: false,
        falta_material: true,
        falta_ferramenta: false,
        falta_equipamento: false,
      })
    ).toBe(2);
  });
  it("codigoItemFromNome remove acentos e usa prefixo", () => {
    expect(codigoItemFromNome("Spot embutir", "HAE8")).toBe("HAE8.SPOTEMBUTI");
    expect(codigoItemFromNome("")).toMatch(/^IT/);
  });
  it("guards reconhecem todos os enums", () => {
    for (const s of SITUACOES) expect(isSituacaoItem(s)).toBe(true);
    for (const a of ANDAMENTOS) expect(isAndamentoItem(a)).toBe(true);
    expect(isSituacaoItem("xyz")).toBe(false);
  });
});
