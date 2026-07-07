import { describe, expect, it } from "vitest";
import { montarOperacaoExcecao } from "./operacao-excecao";

const AGORA = new Date("2026-07-07T12:00:00Z").getTime();
const diasAtras = (d: number) => new Date(AGORA - d * 86_400_000).toISOString();

describe("montarOperacaoExcecao — só o que travou", () => {
  it("pega negócios parados +7d com R$ e pior tempo", () => {
    const r = montarOperacaoExcecao({
      negocios: [
        { status: "aberto", atualizado_em: diasAtras(10), valor_estimado: 100, proxima_acao: "ligar" },
        { status: "em_negociacao", atualizado_em: diasAtras(20), valor_estimado: 200, proxima_acao: "x" },
        { status: "aberto", atualizado_em: diasAtras(2), valor_estimado: 999, proxima_acao: "y" }, // recente, não conta
        { status: "fechado_ganho", atualizado_em: diasAtras(30), valor_estimado: 500, proxima_acao: "z" }, // fechado, não conta
      ],
      obras: [],
      pedidos: [],
      agoraMs: AGORA,
    });
    const neg = r.itens.find((i) => i.key === "negocios_parados")!;
    expect(neg.count).toBe(2);
    expect(neg.valor).toBe(300);
    expect(neg.piorDias).toBe(20);
  });

  it("pega negócios sem próxima ação", () => {
    const r = montarOperacaoExcecao({
      negocios: [
        { status: "aberto", atualizado_em: diasAtras(1), valor_estimado: 50, proxima_acao: null },
        { status: "aberto", atualizado_em: diasAtras(1), valor_estimado: 50, proxima_acao: "  " },
        { status: "aberto", atualizado_em: diasAtras(1), valor_estimado: 50, proxima_acao: "ligar" },
      ],
      obras: [],
      pedidos: [],
      agoraMs: AGORA,
    });
    const s = r.itens.find((i) => i.key === "sem_proxima_acao")!;
    expect(s.count).toBe(2);
  });

  it("pega obras com previsão vencida e o pior atraso", () => {
    const r = montarOperacaoExcecao({
      negocios: [],
      obras: [
        { status: "ativa", data_previsao_fim: diasAtras(5) },
        { status: "ativa", data_previsao_fim: new Date(AGORA + 5 * 86_400_000).toISOString() }, // futura, ok
        { status: "planejamento", data_previsao_fim: diasAtras(12) },
      ],
      pedidos: [],
      agoraMs: AGORA,
    });
    const o = r.itens.find((i) => i.key === "obras_atrasadas")!;
    expect(o.count).toBe(2);
    expect(o.piorDias).toBe(12);
  });

  it("tudoEmDia quando nada travou", () => {
    const r = montarOperacaoExcecao({
      negocios: [{ status: "aberto", atualizado_em: diasAtras(1), valor_estimado: 10, proxima_acao: "ok" }],
      obras: [],
      pedidos: [],
      agoraMs: AGORA,
    });
    expect(r.tudoEmDia).toBe(true);
    expect(r.itens.length).toBe(0);
  });
});
