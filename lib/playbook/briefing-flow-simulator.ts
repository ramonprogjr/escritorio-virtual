import type { SupabaseClient } from "@supabase/supabase-js";
import {
  executeFlowEngine,
  formatMenuOpcoesTexto,
  type FlowEngineDefinition,
  type FlowMenuChoice,
} from "@/lib/playbook/flow-engine";
import {
  type BriefingFlowSimState,
  type BriefingSimMenuChoice,
  type BriefingSimOutboundPart,
} from "@/lib/playbook/briefing-flow-sim-shared";
import {
  carregarDynamicPlaybookRuntime,
  resolverChoiceId,
} from "@/lib/whatsapp/playbook-flow-maria";
import { mensagemEhSaudacaoSimples } from "@/lib/whatsapp/menu-triagem-uazapi";

export type {
  BriefingFlowSimState,
  BriefingSimMenuChoice,
  BriefingSimOutboundPart,
} from "@/lib/playbook/briefing-flow-sim-shared";
export {
  BRIEFING_FLOW_SIM_STATE_KEY,
  emptyBriefingFlowSimState,
  parseBriefingFlowSimState,
  partToDisplayText,
  resolverFlowStateParaSimulacao,
} from "@/lib/playbook/briefing-flow-sim-shared";

export type BriefingFlowSimStepResult = {
  parts: BriefingSimOutboundPart[];
  state: BriefingFlowSimState;
  /** true = ainda no fluxo determinístico; false = IA pode responder */
  skip_ia: boolean;
  handled: boolean;
};

const FLOW_SIM_CACHE_TTL_MS = 120_000;
const flowSimCache = new Map<string, { expireAt: number; definition: FlowEngineDefinition }>();

export async function carregarFluxoPublicadoParaSimulacao(
  supabase: SupabaseClient,
  agenteSlug: string
): Promise<FlowEngineDefinition | null> {
  const key = agenteSlug.trim().toLowerCase();
  if (key) {
    const hit = flowSimCache.get(key);
    if (hit && hit.expireAt > Date.now()) return hit.definition;
  }

  const runtime = await carregarDynamicPlaybookRuntime(supabase, agenteSlug);
  const definition = runtime?.definition ?? null;
  if (key && definition) {
    flowSimCache.set(key, { expireAt: Date.now() + FLOW_SIM_CACHE_TTL_MS, definition });
  }
  return definition;
}

function toMenuChoices(choices: FlowMenuChoice[]): BriefingSimMenuChoice[] {
  return choices.map((c) => ({ id: c.id, label: c.label }));
}

export async function executarPassoSimulacaoFluxo(params: {
  definition: FlowEngineDefinition;
  state: BriefingFlowSimState;
  mensagem: string;
  menuChoiceId?: string | null;
}): Promise<BriefingFlowSimStepResult> {
  const parts: BriefingSimOutboundPart[] = [];
  let nextState: BriefingFlowSimState = { ...params.state, answers: { ...params.state.answers } };
  let handoffIa = params.state.handoff_ia;
  let skipIa = true;
  let handled = false;

  let flowStep = params.state.complete && mensagemEhSaudacaoSimples(params.mensagem)
    ? null
    : params.state.step;
  let flowAnswers = { ...params.state.answers };

  if (params.state.complete && mensagemEhSaudacaoSimples(params.mensagem)) {
    nextState = {
      step: null,
      answers: {},
      active: true,
      complete: false,
      handoff_ia: false,
    };
    flowStep = null;
    flowAnswers = {};
    handoffIa = false;
  }

  const persistState = async (patch: {
    step?: string | null;
    answers?: Record<string, string>;
    active?: boolean;
    complete?: boolean;
  }) => {
    if (patch.answers) flowAnswers = { ...patch.answers };
    nextState = {
      step: patch.step !== undefined ? patch.step : nextState.step,
      answers: flowAnswers,
      active: patch.active !== undefined ? patch.active : nextState.active,
      complete: patch.complete !== undefined ? patch.complete : nextState.complete,
      handoff_ia: handoffIa,
    };
  };

  const result = await executeFlowEngine(
    params.definition,
    {
      step: flowStep,
      answers: flowAnswers,
      mensagem: params.mensagem,
      menuChoiceId: params.menuChoiceId,
      tipoMidia: "texto",
    },
    {
      sendText: async (text) => {
        const t = text.trim();
        if (t) parts.push({ kind: "text", text: t });
      },
      sendMenu: async ({ text, menuType, choices, listButton }) => {
        const parsedChoices = choices.map((c) => {
          const pipe = c.includes("|") ? c.split("|") : [c, c];
          const label = (pipe[0] || c).trim();
          const id = (pipe[pipe.length - 1] || c).trim();
          return { id, label };
        });
        if (menuType === "text") {
          parts.push({
            kind: "menu",
            text: formatMenuOpcoesTexto(text, parsedChoices.map((p) => ({ id: p.id, label: p.label }))),
            menu_type: "text",
            choices: parsedChoices,
          });
        } else {
          parts.push({
            kind: "menu",
            text: text.trim(),
            menu_type: menuType,
            choices: parsedChoices,
            list_button: listButton,
          });
        }
        return { ok: true };
      },
      resolveChoiceId: resolverChoiceId,
      persistState,
      onStepComplete: async (_stepId, _answers, meta) => {
        if (meta?.handoffIa) {
          handoffIa = true;
        }
        if (!meta?.handoffIa && nextState.complete) {
          handoffIa = true;
        }
      },
    }
  );

  if (result.handled) {
    handled = true;
    skipIa = result.skipIa;
    if (nextState.complete && !handoffIa) {
      handoffIa = true;
      skipIa = false;
    }
    nextState = { ...nextState, handoff_ia: handoffIa };
  }

  const enriched = result.handled
    ? enrichPartsWithActiveMenu(params.definition, result.step, parts)
    : parts;

  return {
    parts: enriched,
    state: nextState,
    skip_ia: skipIa,
    handled,
  };
}

function enrichPartsWithActiveMenu(
  definition: FlowEngineDefinition,
  stepId: string | undefined,
  parts: BriefingSimOutboundPart[]
): BriefingSimOutboundPart[] {
  if (!stepId || stepId === "concluido") return parts;
  if (parts.some((p) => p.kind === "menu")) return parts;
  const step = definition.steps[stepId];
  if (!step || step.type !== "menu") return parts;

  const menuType = step.menu_type || "list";
  const choices = toMenuChoices(step.choices);
  const withoutDupMenuText = parts.filter((p) => {
    if (p.kind !== "text") return true;
    if (menuType === "text") {
      const formatted = formatMenuOpcoesTexto(step.text, step.choices);
      return p.text.trim() !== formatted.trim();
    }
    return p.text.trim() !== step.text.trim();
  });

  if (menuType === "text") {
    return [
      ...withoutDupMenuText,
      {
        kind: "menu",
        text: step.text.trim(),
        menu_type: "text",
        choices,
      },
    ];
  }

  return [
    ...withoutDupMenuText,
    {
      kind: "menu",
      text: step.text.trim(),
      menu_type: menuType,
      choices,
      list_button: step.list_button,
    },
  ];
}
