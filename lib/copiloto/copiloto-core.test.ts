import { describe, it, expect, afterEach } from "vitest";
import {
  COPILOTO_FERRAMENTAS_LEITURA,
  COPILOTO_FERRAMENTAS_ESCRITA_FASE3,
  CopilotoSegredoAusenteError,
  assinarConfirmacao,
  validarConfirmacao,
  nivelDaFerramenta,
  ferramentaExecutavel,
  escritaSemLead,
  dentroDoRateLimit,
  extrairJsonObjeto,
} from "./copiloto-core";

describe("copiloto-core — gate de nível de acesso", () => {
  it("inclui as 4 leituras de lead + 3 de obra (E0/E1) + 1 de item (E2) + 1 de bloqueios (E3) + 1 de estoque (E5) + 1 de financeiro (E6) + 1 de arquitetura (A0)", () => {
    expect(COPILOTO_FERRAMENTAS_LEITURA).toEqual(
      expect.arrayContaining([
        "hub_lead_resumo",
        "hub_lead_memorias",
        "hub_lead_lookup_por_telefone",
        "hub_metricas_escritorio",
        // E0 — Engenharia/Obra (leitura, auto-executável)
        "hub_obra_listar",
        "hub_obra_resumo",
        // E1 — cockpit "Hoje" (fila de decisões, leitura, auto-executável)
        "hub_obra_hoje",
        // E2 — Itens × Subitens (leitura, auto-executável)
        "hub_obra_item_listar",
        // E3 — Restrições/Bloqueios (leitura, auto-executável)
        "hub_obra_bloqueios_listar",
        // E5 — Inventário/estoque (leitura, auto-executável)
        "hub_obra_estoque_consultar",
        // E6 — Resumo financeiro (leitura, auto-executável)
        "hub_obra_financeiro_resumo",
        // A0 — Arquitetura/Projeto (leitura, auto-executável)
        "arq_resumo",
      ])
    );
    expect(COPILOTO_FERRAMENTAS_LEITURA).toHaveLength(12);
  });

  it("classifica leitura vs escrita corretamente", () => {
    expect(nivelDaFerramenta("hub_lead_resumo")).toBe("leitura");
    expect(nivelDaFerramenta("hub_atualizar_lead")).toBe("escrita");
    expect(nivelDaFerramenta("inexistente")).toBeNull();
  });
});

describe("copiloto-core — ferramentaExecutavel (Fase 3)", () => {
  it("allowlist de escrita = 3 de lead (nota+atualizar+encaminhar) + 2 de obra (E0) + 2 de item (E2) + 2 de bloqueio (E3) + 1 de SC (E5) + 1 de pagamento (E6) + 3 de arquitetura (A0) + 2 de aprovação (A1) + 1 de gerar obra (A2)", () => {
    expect(COPILOTO_FERRAMENTAS_ESCRITA_FASE3).toEqual([
      "hub_registar_nota_lead",
      "hub_atualizar_lead",
      // Comercial — direcionar/encaminhar o lead a parceiro (proposta pendente; a voz nunca aprova o envio)
      "hub_lead_encaminhar",
      // E0 — escrita de obra/EAP (operam sobre obra_id, não sobre lead aberto)
      "hub_obra_criar",
      "hub_obra_eap_montar",
      // E2 — escrita de item (avanço/andamento; operam sobre obra_id/item_id, não sobre lead)
      "hub_obra_item_avanco",
      "hub_obra_item_andamento",
      // E3 — escrita de bloqueio (criar/resolver; operam sobre obra_id/item_id, não sobre lead)
      "hub_obra_bloqueio_criar",
      "hub_obra_bloqueio_resolver",
      // E5 — criar SC de compra (opera sobre obra_id; nasce em rascunho, aprovar é gate humano na tela)
      "hub_obra_sc_criar",
      // E6 — preparar pagamento (opera sobre obra_id; PREPARA + enfileira a dupla aprovação, nunca libera)
      "hub_obra_pagamento_preparar",
      // A0 — escrita de projeto/arquitetura (operam sobre projeto_id, não sobre lead)
      "arq_criar_projeto",
      "arq_mover_estagio",
      "arq_programa_item",
      // A1 — aprovação do cliente (operam sobre projeto_id/fase_id, não sobre lead)
      "arq_enviar_aprovacao",
      "arq_registrar_aprovacao",
      // A2 — elo Gerar Obra (opera sobre projeto_id, não sobre lead)
      "arq_gerar_obra",
    ]);
  });

  it("encaminhar lead (Comercial) é executável, é escrita e é LEAD-BOUND (não dispensa lead aberto)", () => {
    expect(ferramentaExecutavel("hub_lead_encaminhar")).toBe(true);
    expect(nivelDaFerramenta("hub_lead_encaminhar")).toBe("escrita");
    // Fica FORA de SEM_LEAD → exige lead aberto + o leadId entra na assinatura HMAC (nunca cai no lead errado).
    expect(escritaSemLead("hub_lead_encaminhar")).toBe(false);
    // A voz NUNCA aprova/envia ao parceiro nem toca dinheiro: essas tools seguem bloqueadas.
    expect(ferramentaExecutavel("hub_obra_pagamento_aprovar")).toBe(false);
    expect(ferramentaExecutavel("hub_obra_escrow_liberar")).toBe(false);
  });

  it("escrita de bloqueio (E3) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("hub_obra_bloqueio_criar")).toBe(true);
    expect(ferramentaExecutavel("hub_obra_bloqueio_resolver")).toBe(true);
  });

  it("escrita de obra (E0) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("hub_obra_criar")).toBe(true);
    expect(ferramentaExecutavel("hub_obra_eap_montar")).toBe(true);
  });

  it("SC de compra (E5) é executável, dispensa lead aberto e tem leitura de estoque auto-exec", () => {
    expect(ferramentaExecutavel("hub_obra_sc_criar")).toBe(true);
    expect(escritaSemLead("hub_obra_sc_criar")).toBe(true);
    // leitura de inventário é auto-executável (não está na allowlist de escrita)
    expect(ferramentaExecutavel("hub_obra_estoque_consultar")).toBe(true);
    expect(nivelDaFerramenta("hub_obra_estoque_consultar")).toBe("leitura");
    expect(nivelDaFerramenta("hub_obra_sc_criar")).toBe("escrita");
  });

  it("escrita de item (E2) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("hub_obra_item_avanco")).toBe(true);
    expect(ferramentaExecutavel("hub_obra_item_andamento")).toBe(true);
  });

  it("financeiro (E6): resumo é leitura auto-exec; preparar pagamento é escrita, dispensa lead e NUNCA aprova/libera", () => {
    // Leitura do resumo é auto-executável (não está na allowlist de escrita).
    expect(nivelDaFerramenta("hub_obra_financeiro_resumo")).toBe("leitura");
    expect(ferramentaExecutavel("hub_obra_financeiro_resumo")).toBe(true);
    // Preparar pagamento é escrita, executável, opera sobre obra_id (sem lead).
    expect(nivelDaFerramenta("hub_obra_pagamento_preparar")).toBe("escrita");
    expect(ferramentaExecutavel("hub_obra_pagamento_preparar")).toBe(true);
    expect(escritaSemLead("hub_obra_pagamento_preparar")).toBe(true);
    // NÃO existe ferramenta de IA que aprove/libere o escrow (humano aprova o dinheiro).
    expect(ferramentaExecutavel("hub_obra_pagamento_aprovar")).toBe(false);
    expect(ferramentaExecutavel("hub_obra_escrow_liberar")).toBe(false);
  });

  it("escrita de arquitetura (A0) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("arq_criar_projeto")).toBe(true);
    expect(ferramentaExecutavel("arq_mover_estagio")).toBe(true);
    expect(ferramentaExecutavel("arq_programa_item")).toBe(true);
    expect(ferramentaExecutavel("arq_resumo")).toBe(true);
  });

  it("escrita de aprovação (A1) é executável e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("arq_enviar_aprovacao")).toBe(true);
    expect(ferramentaExecutavel("arq_registrar_aprovacao")).toBe(true);
    expect(escritaSemLead("arq_enviar_aprovacao")).toBe(true);
    expect(escritaSemLead("arq_registrar_aprovacao")).toBe(true);
  });

  it("gerar obra (A2) é executável, é escrita e dispensa lead aberto", () => {
    expect(ferramentaExecutavel("arq_gerar_obra")).toBe(true);
    expect(escritaSemLead("arq_gerar_obra")).toBe(true);
    expect(nivelDaFerramenta("arq_gerar_obra")).toBe("escrita");
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
