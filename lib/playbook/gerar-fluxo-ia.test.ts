import { describe, it, expect } from "vitest";
import { gerarPlaybookViaIa, type LlmCompletionFn } from "./gerar-fluxo-ia";
import { validatePlaybookFlowDefinition } from "./flow-validate";

const REGRAS_JSON = JSON.stringify({
  identidade: "Sou a Ana, atendente do Obra10+.",
  tom: "Cordial e objetiva.",
  saudacao: "Oi! Sou a Ana. Como posso ajudar?",
  pode_fazer: ["acolher o lead", "qualificar"],
  nao_pode_fazer: ["falar preço final"],
  o_que_coletar: ["nome", "tipo de imóvel"],
  perguntas_essenciais: ["Qual é o seu nome?", "Qual tipo de imóvel?"],
});

const FLUXO_VALIDO = "```json\n" + JSON.stringify({
  obra10_playbook_flow_schema: 1,
  entry_step_id: "ola",
  steps: [
    { kind: "message", id: "ola", message: "Oi!", next: "fim" },
    { kind: "complete", id: "fim", complete: { type: "complete", handoff_to: "time_humano", summary: "x" } },
  ],
}) + "\n```";

const FLUXO_INVALIDO = JSON.stringify({
  obra10_playbook_flow_schema: 1,
  entry_step_id: "ola",
  steps: [{ kind: "message", id: "ola", message: "Oi!", next: "inexistente" }],
});

/** Mock do LLM: devolve respostas em fila e captura as chamadas. */
function mockLlm(respostas: string[]): { fn: LlmCompletionFn; chamadas: Array<{ systemPrompt: string; conteudo: string; modelo: string }> } {
  const chamadas: Array<{ systemPrompt: string; conteudo: string; modelo: string }> = [];
  let i = 0;
  const fn = (async (params) => {
    chamadas.push({
      systemPrompt: params.systemPrompt,
      conteudo: params.mensagens.map((m) => m.content).join("\n"),
      modelo: params.modeloFromDb,
    });
    const texto = respostas[Math.min(i, respostas.length - 1)];
    i += 1;
    return { ok: true as const, texto, tokensEntrada: 10, tokensSaida: 20, modeloLog: params.modeloFromDb };
  }) as LlmCompletionFn;
  return { fn, chamadas };
}

const OPTS = { descricao: "A Ana atende leads de imóveis, coleta nome e tipo, não fala preço.", agenteNome: "Ana", agenteSlug: "ana" };

describe("gerarPlaybookViaIa", () => {
  it("(a) descrição simples gera fluxo que passa na validação + regras populadas", async () => {
    const { fn } = mockLlm([REGRAS_JSON, FLUXO_VALIDO]);
    const out = await gerarPlaybookViaIa(OPTS, { llm: fn });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(validatePlaybookFlowDefinition(out.flowDefinition).ok).toBe(true);
    expect(out.flowDefinition.entry_step_id).toBe("ola");
    expect(out.regras.pode_fazer).toContain("acolher o lead");
    expect(out.regras.perguntas_essenciais.length).toBeGreaterThan(0);
    expect(out.markdown).toContain("obra10_playbook_flow");
    expect(out.usos).toHaveLength(2); // narrativa + fluxo
  });

  it("(b) JSON de fluxo inválido aciona auto-fix recebendo os errors[]", async () => {
    const { fn, chamadas } = mockLlm([REGRAS_JSON, FLUXO_INVALIDO, FLUXO_VALIDO]);
    const out = await gerarPlaybookViaIa(OPTS, { llm: fn });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // 3 chamadas: narrativa, fluxo (inválido), auto-fix (válido)
    expect(chamadas).toHaveLength(3);
    // a 3ª chamada (auto-fix) deve conter o erro de validação reenviado
    expect(chamadas[2].conteudo).toContain("INVÁLIDA");
    expect(chamadas[2].conteudo.toLowerCase()).toContain("inexistente");
    expect(out.avisos.join(" ")).toMatch(/corrigido automaticamente/i);
    expect(validatePlaybookFlowDefinition(out.flowDefinition).ok).toBe(true);
  });

  it("(c) fluxo inválido em todas as tentativas cai no fallback de template (rascunho editável)", async () => {
    const { fn, chamadas } = mockLlm([REGRAS_JSON, FLUXO_INVALIDO, FLUXO_INVALIDO, FLUXO_INVALIDO]);
    const out = await gerarPlaybookViaIa(OPTS, { llm: fn });

    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // 1 narrativa + 3 tentativas de fluxo (0,1,2)
    expect(chamadas).toHaveLength(4);
    // última tentativa escala o modelo para auto-fix (Claude)
    expect(chamadas[3].modelo).toContain("claude");
    expect(out.avisos.join(" ")).toMatch(/esqueleto/i);
    // o fallback garante um markdown com fluxo válido para o dono editar
    expect(out.markdown).toContain("obra10_playbook_flow");
  });

  it("rejeita descrição curta demais", async () => {
    const { fn } = mockLlm([REGRAS_JSON, FLUXO_VALIDO]);
    const out = await gerarPlaybookViaIa({ ...OPTS, descricao: "oi" }, { llm: fn });
    expect(out.ok).toBe(false);
  });
});
