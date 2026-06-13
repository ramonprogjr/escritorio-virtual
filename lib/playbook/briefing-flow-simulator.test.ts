import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";
import { compilePlaybookFlowToEngine } from "@/lib/whatsapp/playbook-flow-maria";
import {
  emptyBriefingFlowSimState,
  executarPassoSimulacaoFluxo,
} from "./briefing-flow-simulator";

describe("briefing-flow-simulator", () => {
  it("inicia fluxo Mari com saudação e pede nome", async () => {
    const markdown = readFileSync(
      join(process.cwd(), "public/playbook-exemplos/playbook-atendimento-1.md"),
      "utf8"
    );
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validated = validatePlaybookFlowDefinition(parsed.definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const engine = compilePlaybookFlowToEngine(validated.definition);
    const out = await executarPassoSimulacaoFluxo({
      definition: engine,
      state: emptyBriefingFlowSimState(),
      mensagem: "Olá",
    });

    expect(out.handled).toBe(true);
    expect(out.skip_ia).toBe(true);
    expect(out.parts.some((p) => p.kind === "text" && /Mari/i.test(p.text))).toBe(true);
    expect(out.state.step).toBe("coletar_nome");
  });

  it("aceita número no menu de triagem e abre subfluxo arquitetura", async () => {
    const markdown = readFileSync(
      join(process.cwd(), "public/playbook-exemplos/playbook-mari-ia.md"),
      "utf8"
    );
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    if (!parsed.ok) return;
    const validated = validatePlaybookFlowDefinition(parsed.definition);
    if (!validated.ok) return;
    const engine = compilePlaybookFlowToEngine(validated.definition);

    let state = emptyBriefingFlowSimState();
    await executarPassoSimulacaoFluxo({ definition: engine, state, mensagem: "Olá" });
    state = { step: "coletar_nome", answers: {}, active: true, complete: false, handoff_ia: false };
    const nome = await executarPassoSimulacaoFluxo({
      definition: engine,
      state,
      mensagem: "Lucas",
    });
    expect(nome.state.step).toBe("triagem_servicos_menu");
    expect(nome.parts.some((p) => p.kind === "text" && /prazer te atender/i.test(p.text))).toBe(true);
    expect(nome.parts.some((p) => p.kind === "menu")).toBe(true);
    expect(nome.parts.filter((p) => p.kind === "menu").length).toBe(1);
    const menuPart = nome.parts.find((p) => p.kind === "menu");
    expect(menuPart?.menu_type).toBe("button");

    const triagem = await executarPassoSimulacaoFluxo({
      definition: engine,
      state: nome.state,
      mensagem: "1",
      menuChoiceId: "op_arq",
    });
    expect(triagem.skip_ia).toBe(true);
    expect(triagem.state.complete).toBe(false);
    expect(triagem.parts.some((p) => p.kind === "text" && /homologados/i.test(p.text))).toBe(true);
    expect(triagem.state.step).toBe("arq_tipo_imovel");
  });
});
