import { describe, it, expect, afterEach } from "vitest";
import {
  COPILOTO_FERRAMENTAS_LEITURA,
  COPILOTO_FERRAMENTAS_ESCRITA_FASE3,
  CopilotoSegredoAusenteError,
  assinarConfirmacao,
  validarConfirmacao,
  nivelDaFerramenta,
  ferramentaExecutavel,
  dentroDoRateLimit,
  extrairJsonObjeto,
} from "./copiloto-core";

describe("copiloto-core — gate de nível de acesso", () => {
  it("inclui as 4 leituras de lead + 2 de obra (E0) + 1 de arquitetura (A0)", () => {
    expect(COPILOTO_FERRAMENTAS_LEITURA).toEqual(
      expect.arrayContaining([
        "hub_lead_resumo",
        "hub_lead_memorias",
        "hub_lead_lookup_por_telefone",
        "hub_metricas_escritorio",
        // E0 — Engenharia/Obra (leitura, auto-executável)
        "hub_obra_listar",
        "hub_obra_resumo",
        // A0 — Arquitetura/Projeto (leitura, auto-executável)
        "arq_resumo",
      ])
    );
    expect(COPILOTO_FERRAMENTAS_LEITURA).toHaveLength(7);
  });

  it("classifica leitura vs escrita corretamente", () => {
    expect(nivelDaFerramenta("hub_lead_resumo")).toBe("leitura");
    expect(nivelDaFerramenta("hub_atualizar_lead")).toBe("escrita");
    expect(nivelDaFerramenta("inexistente")).toBeNull();
  });
});

describe("copiloto-core — ferramentaExecutavel (Fase 3)", () => {
  it("allowlist de escrita = 2 de lead + 2 de obra (E0) + 3 de arquitetura (A0)", () => {
    expect(COPILOTO_FERRAMENTAS_ESCRITA_FASE3).toEqual([
      "hub_registar_nota_lead",
      "hub_atualizar_lead",
      // E0 — escrita de obra/EAP (operam sobre obra_id, não sobre lead aberto)
      "hub_obra_criar",
      "hub_obra_eap_montar",
      // A0 — escrita de projeto/arquitetura (operam sobre projeto_id, não sobre lead)
      "arq_criar_projeto",
      "arq_mover_estagio",
      "arq_programa_item",
    ]);
  });

  it("escrita de obra (E0) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("hub_obra_criar")).toBe(true);
    expect(ferramentaExecutavel("hub_obra_eap_montar")).toBe(true);
  });

  it("escrita de arquitetura (A0) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("arq_criar_projeto")).toBe(true);
    expect(ferramentaExecutavel("arq_mover_estagio")).toBe(true);
    expect(ferramentaExecutavel("arq_programa_item")).toBe(true);
    expect(ferramentaExecutavel("arq_resumo")).toBe(true);
  });

  it("leitura é executável", () => {
    expect(ferramentaExecutavel("hub_lead_resumo")).toBe(true);
    expect(ferramentaExecutavel("hub_metricas_escritorio")).toBe(true);
  });

  it("escrita na allowlist é executável", () => {
    expect(ferramentaExecutavel("hub_atualizar_lead")).toBe(true);
    expect(ferramentaExecutavel("hub_registar_nota_lead")).toBe(true);
  });

  it("escrita FORA da allowlist NÃO é executável", () => {
    expect(ferramentaExecutavel("hub_crm_criar_cadastro")).toBe(false);
    expect(ferramentaExecutavel("hub_whatsapp_menu")).toBe(false);
  });

  it("ferramenta inexistente NÃO é executável", () => {
    expect(ferramentaExecutavel("inexistente")).toBe(false);
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

describe("copiloto-core — leadId dentro da assinatura (BUG 2)", () => {
  const tool = "hub_atualizar_lead";
  const params = { estagio: "qualificado" };

  it("assina e valida com o MESMO leadId", () => {
    const ts = Date.now();
    const id = assinarConfirmacao(tool, params, ts, "lead-A");
    expect(validarConfirmacao(id, tool, params, ts, "lead-A").ok).toBe(true);
  });

  it("REJEITA quando o leadId muda entre assinar e validar (navegou de lead)", () => {
    const ts = Date.now();
    const id = assinarConfirmacao(tool, params, ts, "lead-A");
    const r = validarConfirmacao(id, tool, params, ts, "lead-B");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toBe("confirmacao_invalida");
  });

  it("uma proposta SEM lead não casa com validação COM lead (e vice-versa)", () => {
    const ts = Date.now();
    const idSemLead = assinarConfirmacao(tool, params, ts);
    expect(validarConfirmacao(idSemLead, tool, params, ts, "lead-A").ok).toBe(false);

    const idComLead = assinarConfirmacao(tool, params, ts, "lead-A");
    expect(validarConfirmacao(idComLead, tool, params, ts).ok).toBe(false);
  });

  it("compatível: leitura sem lead (leadId vazio) continua assinando/validando", () => {
    const ts = Date.now();
    const id = assinarConfirmacao("hub_lead_resumo", {}, ts);
    expect(validarConfirmacao(id, "hub_lead_resumo", {}, ts).ok).toBe(true);
    // leadId "" explícito é equivalente ao default
    expect(validarConfirmacao(id, "hub_lead_resumo", {}, ts, "").ok).toBe(true);
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

describe("copiloto-core — segredo HMAC fail-closed (BUG 3)", () => {
  const envSecret = process.env.COPILOTO_HMAC_SECRET;
  const envNodeEnv = process.env.NODE_ENV;
  afterEach(() => {
    if (envSecret === undefined) delete process.env.COPILOTO_HMAC_SECRET;
    else process.env.COPILOTO_HMAC_SECRET = envSecret;
    process.env.NODE_ENV = envNodeEnv;
  });

  it("em produção SEM segredo → lança CopilotoSegredoAusenteError", () => {
    delete process.env.COPILOTO_HMAC_SECRET;
    process.env.NODE_ENV = "production";
    expect(() => assinarConfirmacao("hub_lead_resumo", {}, Date.now())).toThrow(
      CopilotoSegredoAusenteError
    );
  });

  it("em produção COM segredo → funciona normalmente", () => {
    process.env.COPILOTO_HMAC_SECRET = "segredo-de-prod-forte";
    process.env.NODE_ENV = "production";
    const ts = Date.now();
    const id = assinarConfirmacao("hub_lead_resumo", {}, ts);
    expect(typeof id).toBe("string");
    expect(validarConfirmacao(id, "hub_lead_resumo", {}, ts).ok).toBe(true);
  });

  it("em dev SEM segredo → usa fallback (não lança)", () => {
    delete process.env.COPILOTO_HMAC_SECRET;
    process.env.NODE_ENV = "development";
    expect(() => assinarConfirmacao("hub_lead_resumo", {}, Date.now())).not.toThrow();
  });
});

describe("copiloto-core — extrairJsonObjeto", () => {
  it("extrai JSON puro e com cercas markdown", () => {
    expect(extrairJsonObjeto('{"a":1}')).toEqual({ a: 1 });
    expect(extrairJsonObjeto('```json\n{"b":2}\n```')).toEqual({ b: 2 });
    expect(extrairJsonObjeto("sem json")).toBeNull();
  });
});
