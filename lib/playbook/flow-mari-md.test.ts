import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parsePlaybookFlowFromMarkdown } from "./flow-parse";
import { validatePlaybookFlowDefinition } from "./flow-validate";

describe("playbook-mari-unificado-obra10-plus.md flow", () => {
  it("parse + validate v1 schema", () => {
    const markdown = readFileSync(
      join(process.cwd(), "docs/playbook-mari-unificado-obra10-plus.md"),
      "utf8"
    );
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    if (!parsed.ok) {
      console.log(parsed);
    }
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePlaybookFlowDefinition(parsed.definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    expect(validated.definition.obra10_playbook_flow_schema).toBe(1);
    expect(validated.definition.entry_step_id).toBe("inicio_saudacao");
    expect(validated.definition.steps.length).toBeGreaterThan(0);
  });
});

describe("playbook-atendimento-1.md flow", () => {
  it("parse + validate fluxo Mari v2", () => {
    const markdown = readFileSync(
      join(process.cwd(), "public/playbook-exemplos/playbook-atendimento-1.md"),
      "utf8"
    );
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const validated = validatePlaybookFlowDefinition(parsed.definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) {
      console.log(validated.errors);
      return;
    }

    expect(validated.definition.id).toBe("atendimento_1_triagem_ia_v3");
    const ids = new Set(validated.definition.steps.map((s) => s.id));
    expect(ids.has("triagem_servicos_menu")).toBe(true);
    expect(ids.has("agradecer_nome")).toBe(true);
    expect(validated.definition.steps.length).toBe(4);
    expect(ids.has("arq_boas_vindas")).toBe(false);
  });
});

describe("playbook-mari-ia.md", () => {
  it("parse + validate fluxo arq+imob com botões", () => {
    const markdown = readFileSync(
      join(process.cwd(), "public/playbook-exemplos/playbook-mari-ia.md"),
      "utf8"
    );
    expect(markdown).toMatch(/obra10_agente_slug:\s*"mari"/);
    expect(markdown).toMatch(/## §3 — Triagem/);
    const parsed = parsePlaybookFlowFromMarkdown(markdown);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const validated = validatePlaybookFlowDefinition(parsed.definition);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.definition.id).toBe("mari_arq_imob_v2");
    const triagem = validated.definition.steps.find((s) => s.id === "triagem_servicos_menu");
    expect(triagem?.kind).toBe("menu");
    if (triagem?.kind === "menu") {
      expect(triagem.menu_type).toBe("button");
      expect(triagem.options.length).toBe(4);
      expect(triagem.options[0].next).toBe("arq_boas_vindas");
    }
    const ids = new Set(validated.definition.steps.map((s) => s.id));
    expect(ids.has("arq_tipo_imovel")).toBe(true);
    expect(ids.has("imobiliario_proprietario_complete")).toBe(true);
    expect(ids.has("marcenaria_descricao")).toBe(false);
    expect(validated.definition.steps.length).toBeGreaterThan(25);
  });
});
