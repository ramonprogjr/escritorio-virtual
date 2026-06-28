import { mensagemEhSaudacaoSimples } from "@/lib/whatsapp/menu-triagem-uazapi";

export type FlowEngineResult =
  | { handled: false }
  | { handled: true; skipIa: boolean; step?: string };

export type FlowEngineStepType =
  | "await_name"
  | "send_text"
  | "send_media"
  | "menu"
  | "ask_text"
  | "branch_imob_sub"
  | "complete";

/** Tipo de mídia de saída no runtime (alinhado à UAZAPI /send/media). */
export type FlowEngineMediaType = "document" | "audio" | "image";

type BaseStep = {
  id: string;
  type: FlowEngineStepType;
};

export type FlowAwaitNameStep = BaseStep & {
  type: "await_name";
  prompt: string;
  invalid_prompt?: string;
  answer_key?: string;
  next_step: string;
};

export type FlowSendTextStep = BaseStep & {
  type: "send_text";
  text: string;
  next_step?: string;
  /**
   * Quando true, este texto NÃO é concatenado com vizinhos: é enviado como
   * bolha(s) separada(s) — split por linhas em branco (\n\n) — com pequeno delay.
   */
  split?: boolean;
};

export type FlowSendMediaStep = BaseStep & {
  type: "send_media";
  media_type: FlowEngineMediaType;
  /** URL pública (ou base64) do arquivo. */
  file: string;
  caption?: string;
  file_name?: string;
  next_step?: string;
};

export type FlowMenuChoice = {
  id: string;
  label: string;
  next_step?: string;
};

export type FlowMenuStep = BaseStep & {
  type: "menu";
  text: string;
  menu_type?: "list" | "button" | "text";
  list_button?: string;
  choices: FlowMenuChoice[];
  answer_key?: string;
  invalid_prompt?: string;
  next_step?: string;
};

export type FlowAskTextValidator = "text" | "email";

export type FlowAskTextStep = BaseStep & {
  type: "ask_text";
  prompt: string;
  answer_key: string;
  next_step: string;
  min_length?: number;
  allow_media?: boolean;
  validator?: FlowAskTextValidator;
  invalid_prompt?: string;
};

export type FlowBranchImobSubStep = BaseStep & {
  type: "branch_imob_sub";
  source_key?: string;
  answer_key?: string;
  routes: Record<string, string>;
  default_step?: string;
  invalid_prompt?: string;
};

export type FlowCompleteStep = BaseStep & {
  type: "complete";
  /** Texto ao cliente (nunca usar summary interno aqui). */
  text?: string;
  /** Resumo interno para CRM — não enviar ao WhatsApp. */
  internalSummary?: string;
  /** Após concluir, permitir IA no mesmo turno (handoff conversacional). */
  handoff_ia?: boolean;
  /** Patch CRM opcional ao concluir (ex.: triagem inicial). */
  complete_crm_patch?: Record<string, unknown>;
};

export type FlowEngineStep =
  | FlowAwaitNameStep
  | FlowSendTextStep
  | FlowSendMediaStep
  | FlowMenuStep
  | FlowAskTextStep
  | FlowBranchImobSubStep
  | FlowCompleteStep;

export type FlowEngineDefinition = {
  start_step: string;
  steps: Record<string, FlowEngineStep>;
};

export type FlowEngineInput = {
  step: string | null;
  answers: Record<string, string>;
  mensagem: string;
  menuChoiceId?: string | null;
  tipoMidia: string;
};

export type FlowEnginePersistPatch = {
  step?: string | null;
  answers?: Record<string, string>;
  active?: boolean;
  complete?: boolean;
};

/**
 * Delay padrão (ms) entre bolhas separadas — humaniza o ritmo das mensagens.
 * Pode ser sobrescrito por `FLOW_SPLIT_BUBBLE_DELAY_MS` (ex.: 0 em testes).
 */
export const FLOW_SPLIT_BUBBLE_DELAY_MS = 800;

function resolveSplitBubbleDelayMs(): number {
  const raw = process.env.FLOW_SPLIT_BUBBLE_DELAY_MS;
  if (raw !== undefined && raw !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return FLOW_SPLIT_BUBBLE_DELAY_MS;
}

/** Separa um texto em bolhas por linha(s) em branco; ignora vazios. */
export function splitTextIntoBubbles(text: string): string[] {
  return String(text ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export type FlowEngineAdapter = {
  sendText: (text: string) => Promise<void>;
  /**
   * Envia mídia (documento/áudio/imagem). Opcional: adapters sem suporte
   * simplesmente não recebem passos send_media (o motor tolera a ausência).
   */
  sendMedia?: (args: {
    mediaType: FlowEngineMediaType;
    file: string;
    caption?: string;
    fileName?: string;
  }) => Promise<{ ok: boolean; erro?: string }>;
  sendMenu: (args: {
    text: string;
    menuType: "list" | "button" | "text";
    listButton?: string;
    choices: string[];
  }) => Promise<{ ok: boolean; erro?: string }>;
  resolveChoiceId: (mensagem: string, menuChoiceId?: string | null) => string | null;
  persistState: (patch: FlowEnginePersistPatch) => Promise<void>;
  onNameCaptured?: (name: string) => Promise<void>;
  onStepComplete?: (
    stepId: string,
    answers: Record<string, string>,
    meta?: {
      internalSummary?: string;
      handoffIa?: boolean;
      crmPatch?: Record<string, unknown>;
    }
  ) => Promise<void>;
};

function mensagemPareceNome(mensagem: string): boolean {
  const t = mensagem.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (mensagemEhSaudacaoSimples(t)) return false;
  if (/^\d+$/.test(t)) return false;
  if (t.includes("@")) return false;
  return true;
}

function askTextAceitaResposta(step: FlowAskTextStep, texto: string, tipoMidia: string): boolean {
  const minLength = Number.isFinite(step.min_length) ? Math.max(1, Number(step.min_length)) : 1;
  const mediaOk = step.allow_media === true && tipoMidia !== "texto";
  const textOk = texto.length >= minLength;
  const validEmail = step.validator === "email" ? mensagemPareceEmail(texto) : true;
  if (!((mediaOk || textOk) && validEmail)) return false;
  if (step.answer_key === "nome" && !mediaOk && !mensagemPareceNome(texto)) return false;
  return true;
}

function mensagemPareceEmail(mensagem: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mensagem.trim());
}

/** Normaliza texto de menu para comparação (rótulos, respostas livres, m²/m2). */
export function normMenuChoiceText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/m²/g, "m2")
    .replace(/[²º°]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function choiceIdFromCandidates(
  candidates: string[],
  choices: FlowMenuChoice[],
  globalResolve?: (mensagem: string, menuChoiceId?: string | null) => string | null
): string | null {
  const choiceIds = new Set(choices.map((c) => c.id));

  for (const raw of candidates) {
    const t = raw.trim();
    if (!t) continue;

    const globalId = globalResolve?.(t, null);
    if (globalId && choiceIds.has(globalId)) return globalId;

    if (choiceIds.has(t)) return t;
    const lower = t.toLowerCase();
    const byId = choices.find((c) => c.id === t || c.id.toLowerCase() === lower);
    if (byId) return byId.id;

    const pipeId = t.includes("|") ? t.split("|").pop()?.trim() : "";
    if (pipeId && choiceIds.has(pipeId)) return pipeId;

    if (/^\d+$/.test(t)) {
      const idx = Number.parseInt(t, 10);
      if (idx >= 1 && idx <= choices.length) return choices[idx - 1].id;
    }

    const normMsg = normMenuChoiceText(t);
    if (!normMsg) continue;

    const exactLabel = choices.find((c) => normMenuChoiceText(c.label) === normMsg);
    if (exactLabel) return exactLabel.id;

    const partialLabel = choices.find((c) => {
      const normLabel = normMenuChoiceText(c.label);
      if (!normLabel || normLabel.length < 4) return false;
      return normMsg.includes(normLabel) || normLabel.includes(normMsg);
    });
    if (partialLabel) return partialLabel.id;
  }

  return null;
}

/**
 * Resolve opção de menu: ID do WhatsApp, aliases globais, índice numérico (1..n) ou rótulo.
 */
export function resolveMenuChoiceId(
  mensagem: string,
  menuChoiceId: string | null | undefined,
  choices: FlowMenuChoice[],
  globalResolve?: (mensagem: string, menuChoiceId?: string | null) => string | null
): string | null {
  if (!choices.length) return null;

  const fromGlobal = globalResolve?.(mensagem, menuChoiceId);
  if (fromGlobal && choices.some((c) => c.id === fromGlobal)) return fromGlobal;

  const candidates = [menuChoiceId, mensagem].filter(
    (x): x is string => typeof x === "string" && Boolean(x.trim())
  );
  return choiceIdFromCandidates(candidates, choices, globalResolve);
}

const MAX_AUTO_TRANSITIONS = 12;

/** Pausa não-bloqueante entre bolhas (pulada em ambiente de teste via delay 0). */
function delayBubble(ms: number): Promise<void> {
  if (!(ms > 0)) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Monta prompt com opções numeradas (estilo POP Mari no WhatsApp). */
export function formatMenuOpcoesTexto(prompt: string, choices: FlowMenuChoice[]): string {
  const header = prompt.trim();
  const lines = choices.map((choice, index) => `${index + 1}. ${choice.label.trim()}`);
  return [header, ...lines].filter(Boolean).join("\n");
}

export async function executeFlowEngine(
  definition: FlowEngineDefinition,
  input: FlowEngineInput,
  adapter: FlowEngineAdapter
): Promise<FlowEngineResult> {
  let currentStepId = input.step || definition.start_step;
  if (!currentStepId) return { handled: false };

  const answers = { ...input.answers };
  const texto = input.mensagem.trim();

  for (let transitions = 0; transitions < MAX_AUTO_TRANSITIONS; transitions += 1) {
    const step = definition.steps[currentStepId];
    if (!step) return { handled: false };
    const waitingAtCurrentStep = input.step === currentStepId;
    const choiceId =
      step.type === "menu" && waitingAtCurrentStep
        ? resolveMenuChoiceId(
            input.mensagem,
            input.menuChoiceId,
            step.choices,
            adapter.resolveChoiceId
          )
        : adapter.resolveChoiceId(input.mensagem, input.menuChoiceId);

    switch (step.type) {
      case "send_text": {
        // Bolhas a enviar, na ordem. Um step com `split` produz N bolhas (split por \n\n);
        // steps SEM split consecutivos são concatenados num único envio (comportamento atual).
        const bubbles: string[] = [];
        let pendingConcat: string[] = [];
        const flushConcat = () => {
          if (pendingConcat.length) {
            bubbles.push(pendingConcat.join("\n\n"));
            pendingConcat = [];
          }
        };

        let walk: string | undefined = currentStepId;
        let landedStepId: string | undefined;
        while (walk) {
          const st: FlowEngineStep | undefined = definition.steps[walk];
          if (!st || st.type !== "send_text") {
            landedStepId = walk;
            break;
          }
          const trimmed = st.text.trim();
          if (st.split) {
            // Fecha o bloco concatenado anterior e emite cada parte como bolha própria.
            flushConcat();
            for (const part of splitTextIntoBubbles(st.text)) {
              bubbles.push(part);
            }
          } else if (trimmed) {
            pendingConcat.push(trimmed);
          }
          if (!st.next_step) {
            currentStepId = walk;
            walk = undefined;
            break;
          }
          walk = st.next_step;
          currentStepId = walk;
        }
        flushConcat();

        const bubbleDelayMs = resolveSplitBubbleDelayMs();
        for (let i = 0; i < bubbles.length; i += 1) {
          if (i > 0) await delayBubble(bubbleDelayMs);
          await adapter.sendText(bubbles[i]);
        }

        if (landedStepId) {
          const landed = definition.steps[landedStepId];
          if (landed && landed.type !== "send_text") {
            currentStepId = landedStepId;
            continue;
          }
        }

        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: true, step: currentStepId };
      }

      case "send_media": {
        if (typeof adapter.sendMedia === "function" && step.file.trim()) {
          const out = await adapter.sendMedia({
            mediaType: step.media_type,
            file: step.file.trim(),
            caption: step.caption?.trim() || undefined,
            fileName: step.file_name?.trim() || undefined,
          });
          if (!out.ok && step.caption?.trim()) {
            // Tolerância: se a mídia falhar mas houver legenda, ao menos manda o texto.
            await adapter.sendText(step.caption.trim());
          }
        } else if (step.caption?.trim()) {
          // Adapter sem suporte a mídia: não derruba o fluxo, envia a legenda como texto.
          await adapter.sendText(step.caption.trim());
        }

        if (step.next_step && definition.steps[step.next_step]) {
          await adapter.persistState({
            step: step.next_step,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step;
          continue;
        }

        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: true, step: currentStepId };
      }

      case "await_name": {
        if (waitingAtCurrentStep && mensagemPareceNome(texto) && !choiceId) {
          const key = step.answer_key || "nome";
          answers[key] = texto;
          if (adapter.onNameCaptured) {
            await adapter.onNameCaptured(texto);
          }
          await adapter.persistState({
            step: step.next_step,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step;
          continue;
        }
        await adapter.sendText(step.invalid_prompt || step.prompt);
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: true, step: currentStepId };
      }

      case "menu": {
        const selected =
          waitingAtCurrentStep && choiceId ? step.choices.find((c) => c.id === choiceId) : null;
        if (selected) {
          const key = step.answer_key;
          if (key) answers[key] = selected.id;
          const nextStep = selected.next_step || step.next_step;
          if (!nextStep) {
            await adapter.persistState({
              step: currentStepId,
              answers,
              active: true,
              complete: false,
            });
            return { handled: true, skipIa: true, step: currentStepId };
          }
          await adapter.persistState({
            step: nextStep,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = nextStep;
          continue;
        }

        if (choiceId && step.invalid_prompt) {
          await adapter.sendText(step.invalid_prompt);
        }
        const menuType = step.menu_type || "list";
        if (menuType === "text") {
          await adapter.sendText(formatMenuOpcoesTexto(step.text, step.choices));
        } else {
          const menuChoices = step.choices.map((c) => `${c.label}|${c.id}`);
          const menu = await adapter.sendMenu({
            text: step.text,
            menuType,
            listButton: step.list_button,
            choices: menuChoices,
          });
          if (!menu.ok) {
            await adapter.sendText(
              formatMenuOpcoesTexto(
                step.text,
                step.choices
              )
            );
          }
        }
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: true, step: currentStepId };
      }

      case "ask_text": {
        if (
          waitingAtCurrentStep &&
          askTextAceitaResposta(step, texto, input.tipoMidia) &&
          !choiceId
        ) {
          const mediaOk = step.allow_media === true && input.tipoMidia !== "texto";
          answers[step.answer_key] = mediaOk ? input.tipoMidia : texto;
          await adapter.persistState({
            step: step.next_step,
            answers,
            active: true,
            complete: false,
          });
          currentStepId = step.next_step;
          continue;
        }
        await adapter.sendText(step.invalid_prompt || step.prompt);
        await adapter.persistState({
          step: currentStepId,
          answers,
          active: true,
          complete: false,
        });
        return { handled: true, skipIa: true, step: currentStepId };
      }

      case "branch_imob_sub": {
        const key = step.source_key || step.answer_key || "imob_sub";
        const incoming = choiceId || answers[key] || "";
        if (incoming) answers[key] = incoming;
        const nextStep = step.routes[incoming] || step.default_step;
        if (!nextStep) {
          await adapter.sendText(step.invalid_prompt || "Escolha uma opção do menu para continuarmos.");
          await adapter.persistState({
            step: currentStepId,
            answers,
            active: true,
            complete: false,
          });
          return { handled: true, skipIa: true, step: currentStepId };
        }
        await adapter.persistState({
          step: nextStep,
          answers,
          active: true,
          complete: false,
        });
        currentStepId = nextStep;
        continue;
      }

      case "complete": {
        if (step.text?.trim()) {
          await adapter.sendText(step.text.trim());
        }
        if (adapter.onStepComplete) {
          await adapter.onStepComplete(currentStepId, answers, {
            internalSummary: step.internalSummary?.trim() || undefined,
            handoffIa: step.handoff_ia === true,
            crmPatch:
              step.complete_crm_patch && typeof step.complete_crm_patch === "object"
                ? step.complete_crm_patch
                : undefined,
          });
        }
        await adapter.persistState({
          step: "concluido",
          answers,
          active: false,
          complete: true,
        });
        return { handled: true, skipIa: step.handoff_ia !== true, step: "concluido" };
      }
    }
  }

  await adapter.persistState({
    step: currentStepId,
    answers,
    active: true,
    complete: false,
  });
  return { handled: true, skipIa: true, step: currentStepId };
}
