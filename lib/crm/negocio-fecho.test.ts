import { describe, expect, it } from "vitest";
import { eventTypeDoFecho, statusDoFecho, tipoFechoDaEtapa } from "@/lib/crm/negocio-fecho";

// Trava o conserto do bug A1 (venda de mercado ganha nao gerava obra/recebivel + sumia do KPI).

describe("tipoFechoDaEtapa — o tipo_fecho do pipeline manda; senao cai no slug legado", () => {
  it("usa o tipo_fecho do pipeline (mercados fecham com slugs diferentes)", () => {
    expect(tipoFechoDaEtapa("fechado_ganho", "ganho")).toBe("ganho");
    expect(tipoFechoDaEtapa("obra_criada", "ganho")).toBe("ganho"); // obra_reforma: win = obra_criada
    expect(tipoFechoDaEtapa("projeto_obra_criado", "ganho")).toBe("ganho"); // engenharia
    expect(tipoFechoDaEtapa("servico_fechado", "ganho")).toBe("ganho"); // servicos
    expect(tipoFechoDaEtapa("fechado_perdido", "perdido")).toBe("perdido");
    expect(tipoFechoDaEtapa("novo_negocio", "aberto")).toBe("aberto");
    expect(tipoFechoDaEtapa("negociacao", "aberto")).toBe("aberto");
  });
  it("negocio LEGADO sem pipeline: cai no slug conhecido", () => {
    expect(tipoFechoDaEtapa("ganho", null)).toBe("ganho");
    expect(tipoFechoDaEtapa("fechado_ganho", undefined)).toBe("ganho");
    expect(tipoFechoDaEtapa("perdido", null)).toBe("perdido");
    expect(tipoFechoDaEtapa("fechado_perdido", null)).toBe("perdido");
    expect(tipoFechoDaEtapa("negociando", null)).toBe("aberto");
    expect(tipoFechoDaEtapa("", null)).toBe("aberto");
  });
  it("tipo_fecho invalido/vazio no pipeline: ignora e usa o slug", () => {
    expect(tipoFechoDaEtapa("fechado_ganho", "")).toBe("ganho");
    expect(tipoFechoDaEtapa("fechado_ganho", "lixo")).toBe("ganho");
  });
});

describe("statusDoFecho", () => {
  it("ganho -> fechado_ganho; perdido -> fechado_perdido; aberto -> null (nao forca)", () => {
    expect(statusDoFecho("ganho")).toBe("fechado_ganho");
    expect(statusDoFecho("perdido")).toBe("fechado_perdido");
    expect(statusDoFecho("aberto")).toBeNull();
  });
});

describe("eventTypeDoFecho (KPI)", () => {
  it("mapeia o evento de funil", () => {
    expect(eventTypeDoFecho("ganho")).toBe("negocio_ganho");
    expect(eventTypeDoFecho("perdido")).toBe("negocio_perdido");
    expect(eventTypeDoFecho("aberto")).toBe("negocio_etapa_mudou");
  });
});
