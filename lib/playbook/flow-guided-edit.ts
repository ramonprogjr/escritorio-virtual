import type {
  PlaybookFlowDefinition,
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowMedia,
  PlaybookFlowMenuFormat,
  PlaybookFlowStep,
} from "./flow-definition-types";

/**
 * Edição da VISÃO GUIADA (lista vertical de passos) — espelha exatamente o
 * contrato de edição do inspector do canvas (`FlowVisualNodeData` parcial),
 * mas opera direto sobre `PlaybookFlowDefinition` em vez de nós ReactFlow.
 *
 * Objetivo: reusar o mesmo modelo de dados e o mesmo caminho de persistência
 * (`upsertPlaybookFlowBlockInMarkdown`) sem duplicar a lógica do canvas e
 * **preservando** os ramos (`next`, `complete`, `options[].next`, `on_select`,
 * `crm_patch`) que a visão guiada não edita.
 */

export type GuidedMenuOption = {
  id: string;
  label: string;
};

/**
 * Campos editáveis inline na visão guiada. É um subconjunto de
 * `FlowVisualNodeData` (mesmos nomes), o que mantém os dois editores alinhados.
 */
export type GuidedStepPatch = {
  /** Texto principal: message→message, input/menu→prompt, send_document→caption. */
  content?: string;
  title?: string;
  field?: string;
  inputType?: PlaybookFlowInputType;
  menuOptions?: GuidedMenuOption[];
  menuFormat?: PlaybookFlowMenuFormat;
  /** Mídia anexada (PDF/áudio/imagem). `null` remove. */
  media?: PlaybookFlowMedia | null;
  /** Apenas message: enviar em bolhas separadas. */
  split?: boolean;
};

function cloneStep<T extends PlaybookFlowStep>(step: T): T {
  if (typeof structuredClone === "function") return structuredClone(step);
  return JSON.parse(JSON.stringify(step)) as T;
}

/**
 * Aplica um patch da visão guiada a UM passo, devolvendo um novo passo.
 * Mantém intactos os campos não editados (next, complete, crm_patch, journey…).
 */
export function applyGuidedPatchToStep(
  step: PlaybookFlowStep,
  patch: GuidedStepPatch
): PlaybookFlowStep {
  const next = cloneStep(step);

  if (patch.title !== undefined) {
    const title = patch.title.trim();
    if (title) next.title = title;
    else delete next.title;
  }

  switch (next.kind) {
    case "message": {
      if (patch.content !== undefined) next.message = patch.content;
      if (patch.split !== undefined) {
        if (patch.split) next.split = true;
        else delete next.split;
      }
      if (patch.media !== undefined) {
        if (patch.media) next.media = patch.media;
        else delete next.media;
      }
      return next;
    }
    case "input": {
      if (patch.content !== undefined) next.prompt = patch.content;
      if (patch.field !== undefined) {
        const field = patch.field.trim();
        if (field) next.field = field;
      }
      if (patch.inputType !== undefined) next.input_type = patch.inputType;
      return next;
    }
    case "menu": {
      if (patch.content !== undefined) next.prompt = patch.content;
      if (patch.field !== undefined) {
        const field = patch.field.trim();
        if (field) next.field = field;
      }
      if (patch.menuFormat !== undefined) next.menu_type = patch.menuFormat;
      if (patch.menuOptions !== undefined) {
        // Preserva next/complete/crm_patch das opções existentes por id; cria
        // novas como "encerra após esta opção" (mesma convenção do canvas).
        const prevById = new Map(next.options.map((o) => [o.id, o]));
        next.options = patch.menuOptions.map((opt, index) => {
          const label = opt.label.trim() || `Opção ${index + 1}`;
          const prev = prevById.get(opt.id);
          if (prev) return { ...prev, label };
          return {
            id: opt.id,
            label,
            complete: {
              type: "complete" as const,
              summary: `Fluxo encerrado após "${label}".`,
            },
          };
        });
        if (next.options.length === 0) {
          next.options = [
            {
              id: "opcao_1",
              label: "Opção 1",
              complete: {
                type: "complete",
                summary: 'Fluxo encerrado após "Opção 1".',
              },
            },
          ];
        }
      }
      return next;
    }
    case "send_document": {
      if (patch.content !== undefined) next.message = patch.content;
      if (patch.media) next.media = patch.media;
      return next;
    }
    case "send_audio": {
      if (patch.media) next.media = patch.media;
      return next;
    }
    case "complete": {
      if (patch.content !== undefined) {
        next.complete = { ...next.complete, summary: patch.content };
      }
      return next;
    }
    default:
      return next;
  }
}

/**
 * Devolve uma NOVA definição com o passo `stepId` atualizado pelo patch.
 * Se o id não existe, devolve a definição inalterada (tolerante).
 */
export function updateStepInDefinition(
  definition: PlaybookFlowDefinition,
  stepId: string,
  patch: GuidedStepPatch
): PlaybookFlowDefinition {
  let touched = false;
  const steps = definition.steps.map((step) => {
    if (step.id !== stepId) return step;
    touched = true;
    return applyGuidedPatchToStep(step, patch);
  });
  if (!touched) return definition;
  return { ...definition, steps };
}

// ─── Leitura para a UI (resumo de cada passo) ────────────────────────────────

export type GuidedStepKind = PlaybookFlowStep["kind"];

export type GuidedStepView = {
  id: string;
  kind: GuidedStepKind;
  title?: string;
  /** Texto principal mostrado na prévia (message/prompt/caption/summary). */
  content: string;
  isEntry: boolean;
  field?: string;
  inputType?: PlaybookFlowInputType;
  menuOptions?: GuidedMenuOption[];
  menuFormat?: PlaybookFlowMenuFormat;
  media?: PlaybookFlowMedia;
  split?: boolean;
  /** Para a indentação dos caminhos do menu na lista. */
  optionTargets?: Array<{ optionId: string; label: string; next?: string; ends: boolean }>;
};

/** Texto principal de um passo, para a prévia da visão guiada. */
export function guidedStepContent(step: PlaybookFlowStep): string {
  switch (step.kind) {
    case "message":
      return step.message ?? "";
    case "input":
    case "menu":
      return step.prompt ?? "";
    case "send_document":
      return step.message ?? step.media?.caption ?? step.media?.file_name ?? "";
    case "send_audio":
      return step.media?.file_name ?? step.media?.caption ?? "";
    case "complete":
      return step.complete?.user_message ?? step.complete?.summary ?? "";
    default:
      return "";
  }
}

/**
 * Projeta a definição numa lista de "views" simples para a UI da visão guiada,
 * NA ORDEM DO FLUXO (entry → next), com os passos restantes ao final.
 */
export function toGuidedStepViews(definition: PlaybookFlowDefinition): GuidedStepView[] {
  const byId = new Map(definition.steps.map((s) => [s.id, s]));
  const ordered: PlaybookFlowStep[] = [];
  const seen = new Set<string>();

  function pushChain(startId: string | undefined) {
    let cursor = startId;
    while (cursor && byId.has(cursor) && !seen.has(cursor)) {
      const step = byId.get(cursor)!;
      seen.add(cursor);
      ordered.push(step);
      cursor = "next" in step && typeof step.next === "string" ? step.next : undefined;
    }
  }

  pushChain(definition.entry_step_id);
  // Passos não alcançados pela cadeia principal (ramos de menu, órfãos): ordem original.
  for (const step of definition.steps) {
    if (!seen.has(step.id)) {
      seen.add(step.id);
      ordered.push(step);
    }
  }

  return ordered.map((step) => {
    const optionTargets =
      step.kind === "menu"
        ? step.options.map((o) => ({
            optionId: o.id,
            label: o.label,
            next: o.next,
            ends: Boolean(o.complete) && !o.next,
          }))
        : undefined;

    return {
      id: step.id,
      kind: step.kind,
      title: step.title,
      content: guidedStepContent(step),
      isEntry: step.id === definition.entry_step_id,
      field: "field" in step ? step.field : undefined,
      inputType: step.kind === "input" ? step.input_type ?? "text" : undefined,
      menuOptions:
        step.kind === "menu"
          ? step.options.map((o) => ({ id: o.id, label: o.label }))
          : undefined,
      menuFormat: step.kind === "menu" ? step.menu_type ?? "list" : undefined,
      media: "media" in step ? step.media : undefined,
      split: step.kind === "message" ? step.split : undefined,
      optionTargets,
    };
  });
}
