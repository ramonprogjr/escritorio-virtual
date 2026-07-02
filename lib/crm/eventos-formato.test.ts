import { describe, expect, it } from "vitest";
import {
  formatarEvento,
  humanizarEventType,
  temFormatoDedicado,
} from "./eventos-formato";

describe("eventos-formato", () => {
  it("formata os eventos de dinheiro do funil com cor semântica certa", () => {
    expect(formatarEvento("negocio_ganho")).toEqual({
      label: "Negócio ganho",
      icone: "Trophy",
      cor: "sucesso",
    });
    expect(formatarEvento("negocio_perdido").cor).toBe("perigo");
    expect(formatarEvento("lead_criado").cor).toBe("info");
  });

  it("event_type desconhecido → fallback legível, nunca lança", () => {
    const r = formatarEvento("algo_totalmente_novo");
    expect(r.label).toBe("Algo totalmente novo");
    expect(r.icone).toBe("Circle");
    expect(r.cor).toBe("neutro");
  });

  it("humaniza slug com _ e - e capitaliza a 1ª letra", () => {
    // fallback humaniza o slug cru — NÃO inventa acento (o rótulo acentuado vem do mapa dedicado)
    expect(humanizarEventType("negocio_etapa_mudou")).toBe("Negocio etapa mudou");
    expect(humanizarEventType("proposta-enviada")).toBe("Proposta enviada");
    expect(humanizarEventType("  ")).toBe("Evento");
    expect(humanizarEventType("")).toBe("Evento");
  });

  it("tolera entrada nula/vazia sem quebrar", () => {
    // @ts-expect-error — teste de robustez com undefined em runtime
    expect(() => formatarEvento(undefined)).not.toThrow();
    expect(formatarEvento("").label).toBe("Evento");
  });

  it("temFormatoDedicado distingue conhecido de desconhecido", () => {
    expect(temFormatoDedicado("negocio_ganho")).toBe(true);
    expect(temFormatoDedicado("xpto")).toBe(false);
  });

  // Trava de cobertura: todos os event_type que a instrumentação HOJE grava no
  // hub_eventos (verificados via Supabase MCP) precisam ter formatação dedicada —
  // senão a timeline mostra o slug cru pra um evento real.
  it("cobre todos os event_type realmente emitidos hoje", () => {
    const emitidos = [
      "fornecedor_cobrado",
      "lead_distribuido",
      "entrega_gerada",
      "lead_criado",
      "negocio_etapa_mudou",
      "lead_recusado",
      "lead_recolocado",
      "gate_liberado",
      "gate_pendencia_bloqueio",
      "negocio_criado",
      "negocio_ganho",
      "negocio_perdido",
      "estagio_alterado",
    ];
    const semFormato = emitidos.filter((t) => !temFormatoDedicado(t));
    expect(semFormato).toEqual([]);
  });
});
