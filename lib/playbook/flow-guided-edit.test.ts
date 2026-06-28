import { describe, expect, it } from "vitest";
import type { PlaybookFlowDefinition } from "./flow-definition-types";
import {
  applyGuidedPatchToStep,
  guidedStepContent,
  toGuidedStepViews,
  updateStepInDefinition,
} from "./flow-guided-edit";

const DEF: PlaybookFlowDefinition = {
  obra10_playbook_flow_schema: 1,
  entry_step_id: "inicio",
  steps: [
    { id: "inicio", kind: "message", title: "Boas-vindas", message: "Olá!", next: "pergunta" },
    {
      id: "pergunta",
      kind: "input",
      prompt: "Qual seu nome?",
      field: "nome",
      input_type: "text",
      next: "menu_1",
    },
    {
      id: "menu_1",
      kind: "menu",
      prompt: "Escolha uma área:",
      field: "area",
      menu_type: "list",
      options: [
        { id: "op_a", label: "Arquitetura", next: "fim", crm_patch: { fluxo_ativo: "arquitetura" } },
        { id: "op_b", label: "Sair", complete: { type: "complete", summary: "Saiu no menu." } },
      ],
    },
    { id: "fim", kind: "complete", complete: { type: "complete", summary: "Obrigado!" } },
  ],
};

describe("applyGuidedPatchToStep", () => {
  it("edita o texto da mensagem sem perder o next", () => {
    const step = DEF.steps[0];
    const next = applyGuidedPatchToStep(step, { content: "Bem-vindo!" });
    expect(next.kind).toBe("message");
    if (next.kind === "message") {
      expect(next.message).toBe("Bem-vindo!");
      expect(next.next).toBe("pergunta");
    }
  });

  it("aplica e remove o toggle de split em mensagens", () => {
    const ligado = applyGuidedPatchToStep(DEF.steps[0], { split: true });
    expect((ligado as { split?: boolean }).split).toBe(true);
    const desligado = applyGuidedPatchToStep(ligado, { split: false });
    expect("split" in desligado).toBe(false);
  });

  it("anexa e remove mídia em mensagens", () => {
    const comPdf = applyGuidedPatchToStep(DEF.steps[0], {
      media: { type: "document", url: "https://x/y.pdf", file_name: "y.pdf" },
    });
    expect((comPdf as { media?: unknown }).media).toBeTruthy();
    const semPdf = applyGuidedPatchToStep(comPdf, { media: null });
    expect("media" in semPdf).toBe(false);
  });

  it("edita prompt e field do input sem perder next/input_type", () => {
    const next = applyGuidedPatchToStep(DEF.steps[1], { content: "Seu nome completo?", field: "nome_full" });
    expect(next.kind).toBe("input");
    if (next.kind === "input") {
      expect(next.prompt).toBe("Seu nome completo?");
      expect(next.field).toBe("nome_full");
      expect(next.next).toBe("menu_1");
      expect(next.input_type).toBe("text");
    }
  });

  it("preserva next/crm_patch das opções existentes ao renomear labels", () => {
    const next = applyGuidedPatchToStep(DEF.steps[2], {
      menuOptions: [
        { id: "op_a", label: "Projetos" },
        { id: "op_b", label: "Encerrar" },
      ],
    });
    if (next.kind === "menu") {
      expect(next.options[0]).toMatchObject({ id: "op_a", label: "Projetos", next: "fim" });
      expect(next.options[0].crm_patch).toEqual({ fluxo_ativo: "arquitetura" });
      // op_b mantém seu complete original
      expect(next.options[1].label).toBe("Encerrar");
      expect(next.options[1].complete?.summary).toBe("Saiu no menu.");
    }
  });

  it("cria opção nova de menu como 'encerra após esta opção'", () => {
    const next = applyGuidedPatchToStep(DEF.steps[2], {
      menuOptions: [
        { id: "op_a", label: "Arquitetura" },
        { id: "op_b", label: "Sair" },
        { id: "op_c", label: "Falar com humano" },
      ],
    });
    if (next.kind === "menu") {
      expect(next.options).toHaveLength(3);
      expect(next.options[2].complete?.type).toBe("complete");
    }
  });

  it("edita a mensagem de conclusão preservando o complete", () => {
    const next = applyGuidedPatchToStep(DEF.steps[3], { content: "Valeu!" });
    if (next.kind === "complete") {
      expect(next.complete.summary).toBe("Valeu!");
      expect(next.complete.type).toBe("complete");
    }
  });

  it("não muta o passo original", () => {
    const original = DEF.steps[0];
    applyGuidedPatchToStep(original, { content: "outro" });
    expect((original as { message?: string }).message).toBe("Olá!");
  });
});

describe("updateStepInDefinition", () => {
  it("retorna nova definição com o passo atualizado", () => {
    const out = updateStepInDefinition(DEF, "inicio", { content: "Oi!" });
    expect(out).not.toBe(DEF);
    expect((out.steps[0] as { message?: string }).message).toBe("Oi!");
    // demais passos intactos
    expect(out.steps[3]).toEqual(DEF.steps[3]);
  });

  it("é tolerante a id inexistente (retorna a mesma referência)", () => {
    const out = updateStepInDefinition(DEF, "nao_existe", { content: "x" });
    expect(out).toBe(DEF);
  });
});

describe("toGuidedStepViews", () => {
  it("ordena pela cadeia entry → next e marca a entrada", () => {
    const views = toGuidedStepViews(DEF);
    expect(views.map((v) => v.id)).toEqual(["inicio", "pergunta", "menu_1", "fim"]);
    expect(views[0].isEntry).toBe(true);
    expect(views[1].isEntry).toBe(false);
  });

  it("inclui passos órfãos ao final sem quebrar", () => {
    const withOrphan: PlaybookFlowDefinition = {
      ...DEF,
      steps: [...DEF.steps, { id: "orfao", kind: "message", message: "Solto", next: undefined }],
    };
    const views = toGuidedStepViews(withOrphan);
    expect(views.map((v) => v.id)).toContain("orfao");
    expect(views[views.length - 1].id).toBe("orfao");
  });

  it("expõe os caminhos das opções do menu para indentação", () => {
    const views = toGuidedStepViews(DEF);
    const menu = views.find((v) => v.id === "menu_1")!;
    expect(menu.optionTargets).toHaveLength(2);
    expect(menu.optionTargets?.[0]).toMatchObject({ label: "Arquitetura", next: "fim" });
    expect(menu.optionTargets?.[1].ends).toBe(true);
  });
});

describe("guidedStepContent", () => {
  it("extrai o texto principal por tipo", () => {
    expect(guidedStepContent(DEF.steps[0])).toBe("Olá!");
    expect(guidedStepContent(DEF.steps[1])).toBe("Qual seu nome?");
    expect(guidedStepContent(DEF.steps[2])).toBe("Escolha uma área:");
    expect(guidedStepContent(DEF.steps[3])).toBe("Obrigado!");
  });
});
