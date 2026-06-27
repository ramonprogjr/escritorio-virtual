import { describe, it, expect } from "vitest";
import {
  COPILOTO_FERRAMENTAS_LEITURA,
  assinarConfirmacao,
  validarConfirmacao,
  nivelDaFerramenta,
  dentroDoRateLimit,
  extrairJsonObjeto,
} from "./copiloto-core";

describe("copiloto-core — gate de nível de acesso", () => {
  it("só as 4 ferramentas de leitura entram na fase 1", () => {
    expect(COPILOTO_FERRAMENTAS_LEITURA).toEqual(
      expect.arrayContaining([
        "hub_lead_resumo",
        "hub_lead_memorias",
        "hub_lead_lookup_por_telefone",
        "hub_metricas_escritorio",
      ])
    );
    expect(COPILOTO_FERRAMENTAS_LEITURA).toHaveLength(4);
  });

  it("classifica leitura vs escrita corretamente", () => {
    expect(nivelDaFerramenta("hub_lead_resumo")).toBe("leitura");
    expect(nivelDaFerramenta("hub_atualizar_lead")).toBe("escrita");
    expect(nivelDaFerramenta("inexistente")).toBeNull();
  });
});

describe("copiloto-core — confirmação HMAC", () => {
  const tool = "hub_lead_resumo";
  const params = { lead_id: "abc" };

  it("assina e valida no caminho feliz", () => {
    const ts = Date.now();
    const id = assinarConfirmacao(tool, params, ts);
    expect(validarConfirmacao(id, tool, params, ts).ok).toBe(true);
  });

  it("rejeita params adulterados (mesma assinatura, params diferentes)", () => {
    const ts = Date.now();
    const id = assinarConfirmacao(tool, params, ts);
    const r = validarConfirmacao(id, tool, { lead_id: "OUTRO" }, ts);
    expect(r.ok).toBe(false);
  });

  it("rejeita ferramenta trocada", () => {
    const ts = Date.now();
    const id = assinarConfirmacao(tool, params, ts);
    expect(validarConfirmacao(id, "hub_atualizar_lead", params, ts).ok).toBe(false);
  });

  it("rejeita confirmação expirada (>5min)", () => {
    const ts = Date.now() - 6 * 60 * 1000;
    const id = assinarConfirmacao(tool, params, ts);
    const r = validarConfirmacao(id, tool, params, ts);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("confirmacao_expirada");
  });

  it("rejeita assinatura inválida", () => {
    const ts = Date.now();
    expect(validarConfirmacao("deadbeef", tool, params, ts).ok).toBe(false);
  });
});

describe("copiloto-core — rate limit", () => {
  it("bloqueia após o teto na janela", () => {
    const tenant = "tenant-rate-test-unico";
    let permitidos = 0;
    for (let i = 0; i < 40; i++) if (dentroDoRateLimit(tenant)) permitidos++;
    expect(permitidos).toBe(30);
  });
});

describe("copiloto-core — extrairJsonObjeto", () => {
  it("extrai JSON puro e com cercas markdown", () => {
    expect(extrairJsonObjeto('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJsonObjeto('```json\n{"b":2}\n```')).toEqual({ b: 2 });
    expect(extrairJsonObjeto("sem json")).toBeNull();
  });
});
