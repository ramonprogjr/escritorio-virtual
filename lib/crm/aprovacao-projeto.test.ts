import { describe, it, expect } from "vitest";
import {
  calcularAprovacaoProjeto,
  proximaFaseAprovacao,
  isAcaoAprovacao,
  isFaseAprovacaoStatus,
} from "./aprovacao-projeto";

describe("aprovacao-projeto — agregado (reprovado domina)", () => {
  it("0 entregáveis → sem_aprovacao", () => {
    expect(calcularAprovacaoProjeto([])).toBe("sem_aprovacao");
  });

  it("algum rejeitado domina mesmo com enviados/aprovados em voo", () => {
    expect(calcularAprovacaoProjeto(["enviado", "aprovado", "rejeitado"])).toBe("reprovado");
  });

  it("nenhum rejeitado, algum enviado → aguardando", () => {
    expect(calcularAprovacaoProjeto(["aprovado", "enviado", "pendente"])).toBe("aguardando");
  });

  it("todos aprovados → aprovado", () => {
    expect(calcularAprovacaoProjeto(["aprovado", "aprovado"])).toBe("aprovado");
  });

  it("só pendentes → sem_aprovacao", () => {
    expect(calcularAprovacaoProjeto(["pendente", "pendente"])).toBe("sem_aprovacao");
  });

  it("status desconhecido é tratado como pendente", () => {
    expect(calcularAprovacaoProjeto([null, undefined, "lixo"])).toBe("sem_aprovacao");
  });
});

describe("aprovacao-projeto — máquina de estados", () => {
  it("enviar sem arquivo → 422", () => {
    const r = proximaFaseAprovacao("enviar", "pendente", { temUrl: false });
    expect(r).toEqual({ ok: false, erro: "entregavel_sem_arquivo", http: 422 });
  });

  it("enviar com arquivo (pendente → enviado)", () => {
    const r = proximaFaseAprovacao("enviar", "pendente", { temUrl: true });
    expect(r).toEqual({ ok: true, novoStatus: "enviado" });
  });

  it("responder aprovado só de enviado", () => {
    expect(proximaFaseAprovacao("responder", "enviado", { temUrl: true, decisao: "aprovado" }))
      .toEqual({ ok: true, novoStatus: "aprovado" });
    expect(proximaFaseAprovacao("responder", "pendente", { temUrl: true, decisao: "aprovado" }))
      .toEqual({ ok: false, erro: "resposta_so_de_enviado", http: 409 });
  });

  it("responder rejeitado exige motivo → 400", () => {
    expect(proximaFaseAprovacao("responder", "enviado", { temUrl: true, decisao: "rejeitado" }))
      .toEqual({ ok: false, erro: "motivo_obrigatorio", http: 400 });
    expect(proximaFaseAprovacao("responder", "enviado", { temUrl: true, decisao: "rejeitado", motivo: "mudar fachada" }))
      .toEqual({ ok: true, novoStatus: "rejeitado" });
  });

  it("reenviar só de rejeitado/aprovado, com arquivo", () => {
    expect(proximaFaseAprovacao("reenviar", "rejeitado", { temUrl: true }))
      .toEqual({ ok: true, novoStatus: "enviado" });
    expect(proximaFaseAprovacao("reenviar", "pendente", { temUrl: true }))
      .toEqual({ ok: false, erro: "reenvio_so_de_rejeitado", http: 409 });
    expect(proximaFaseAprovacao("reenviar", "rejeitado", { temUrl: false }))
      .toEqual({ ok: false, erro: "entregavel_sem_arquivo", http: 422 });
  });

  it("reabertura: reenviar de aprovado volta a enviado (com arquivo)", () => {
    // Reabrir um entregável já aceito é caminho auditado (a tool sinaliza
    // `nota: 'reabertura de entregável aprovado'`; a rota REST expõe `de:'aprovado'`).
    expect(proximaFaseAprovacao("reenviar", "aprovado", { temUrl: true }))
      .toEqual({ ok: true, novoStatus: "enviado" });
    expect(proximaFaseAprovacao("reenviar", "aprovado", { temUrl: false }))
      .toEqual({ ok: false, erro: "entregavel_sem_arquivo", http: 422 });
  });

  it("PROIBIDO: enviar atalho de aprovado → 409 (use reenviar)", () => {
    expect(proximaFaseAprovacao("enviar", "aprovado", { temUrl: true }))
      .toEqual({ ok: false, erro: "ja_aprovado", http: 409 });
  });

  it("anexar mantém o estado", () => {
    expect(proximaFaseAprovacao("anexar", "rejeitado", { temUrl: true }))
      .toEqual({ ok: true, novoStatus: "rejeitado" });
  });
});

describe("aprovacao-projeto — type guards", () => {
  it("isAcaoAprovacao", () => {
    expect(isAcaoAprovacao("enviar")).toBe(true);
    expect(isAcaoAprovacao("apagar")).toBe(false);
  });
  it("isFaseAprovacaoStatus", () => {
    expect(isFaseAprovacaoStatus("enviado")).toBe(true);
    expect(isFaseAprovacaoStatus("aguardando")).toBe(false); // é status de projeto, não de fase
  });
});
