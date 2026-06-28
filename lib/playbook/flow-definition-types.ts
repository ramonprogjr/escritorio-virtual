export const OBRA10_PLAYBOOK_FLOW_SCHEMA_VERSION = 1 as const;

export type Obra10PlaybookFlowSchemaVersion = typeof OBRA10_PLAYBOOK_FLOW_SCHEMA_VERSION;

export type PlaybookFlowJourney = "triagem" | "arquitetura" | "imobiliario";

export type PlaybookFlowStepKind =
  | "message"
  | "menu"
  | "input"
  | "complete"
  | "send_document"
  | "send_audio";

/**
 * Mídia de saída anexada a um passo (PDF/áudio/imagem pré-selecionados).
 * `url` é uma URL pública (bucket Supabase `playbook-media`) aceita pela UAZAPI em /send/media.
 * Aditivo e OPCIONAL: passos antigos sem `media` continuam válidos.
 */
export type PlaybookFlowMediaKind = "audio" | "document" | "image";

export type PlaybookFlowMedia = {
  type: PlaybookFlowMediaKind;
  url: string;
  caption?: string;
  file_name?: string;
};

export type PlaybookFlowInputType = "text" | "email" | "phone" | "number";

export type PlaybookFlowHandoffTarget =
  | "arquitetura"
  | "imobiliario"
  | "parcerias"
  | "time_humano";

export type PlaybookFlowPotential = "ALTO" | "MEDIO" | "BAIXO";

export type PlaybookFlowLeadKind =
  | "cliente_projetos"
  | "cliente_imobiliario"
  | "imobiliaria_corretor"
  | "outro";

export type PlaybookFlowCrmPatch = {
  estagio?: string;
  potencial?: PlaybookFlowPotential;
  lead_kind?: PlaybookFlowLeadKind;
  fluxo_ativo?: string;
  intencao_imobiliario?: string;
  interesse_principal?: string;
  tags_add?: string[];
  metadata?: Record<string, unknown>;
};

export type PlaybookFlowCompleteAction = {
  type: "complete";
  handoff_to?: PlaybookFlowHandoffTarget;
  /** Nota interna CRM — nunca enviar ao cliente no WhatsApp. */
  summary?: string;
  /** Mensagem opcional ao cliente ao encerrar o fluxo (se vazio, não envia texto extra). */
  user_message?: string;
  crm_patch?: PlaybookFlowCrmPatch;
};

export type PlaybookFlowMenuOption = {
  id: string;
  label: string;
  next?: string;
  crm_patch?: PlaybookFlowCrmPatch;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowBaseStep = {
  id: string;
  kind: PlaybookFlowStepKind;
  title?: string;
  journey?: PlaybookFlowJourney;
  crm_patch?: PlaybookFlowCrmPatch;
};

export type PlaybookFlowMessageStep = PlaybookFlowBaseStep & {
  kind: "message";
  message: string;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
  /** Mídia opcional anexada à mensagem (PDF/áudio/imagem). Aditivo. */
  media?: PlaybookFlowMedia;
  /** Quando true, o runtime envia este texto em bolhas separadas (split por \n\n). */
  split?: boolean;
};

/** Passo que envia um documento (PDF/DOCX/...) pré-selecionado via UAZAPI /send/media. */
export type PlaybookFlowSendDocumentStep = PlaybookFlowBaseStep & {
  kind: "send_document";
  media: PlaybookFlowMedia;
  /** Legenda/observação opcional ao cliente (caption). */
  message?: string;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
};

/** Passo que envia um áudio pré-selecionado via UAZAPI /send/media. */
export type PlaybookFlowSendAudioStep = PlaybookFlowBaseStep & {
  kind: "send_audio";
  media: PlaybookFlowMedia;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowMenuFormat = "list" | "button" | "text";

export type PlaybookFlowMenuStep = PlaybookFlowBaseStep & {
  kind: "menu";
  prompt: string;
  /** Chave em wa_playbook_answers; padrão: id do step. */
  field?: string;
  /** list/button = menu nativo UAZAPI; text = opções numeradas no corpo da mensagem. */
  menu_type?: PlaybookFlowMenuFormat;
  /** Rótulo do botão quando menu_type=list. */
  list_button?: string;
  options: PlaybookFlowMenuOption[];
  on_select?: Record<string, string>;
};

export type PlaybookFlowInputStep = PlaybookFlowBaseStep & {
  kind: "input";
  prompt: string;
  field: string;
  input_type?: PlaybookFlowInputType;
  next?: string;
  complete?: PlaybookFlowCompleteAction;
};

export type PlaybookFlowCompleteStep = PlaybookFlowBaseStep & {
  kind: "complete";
  complete: PlaybookFlowCompleteAction;
};

export type PlaybookFlowStep =
  | PlaybookFlowMessageStep
  | PlaybookFlowMenuStep
  | PlaybookFlowInputStep
  | PlaybookFlowCompleteStep
  | PlaybookFlowSendDocumentStep
  | PlaybookFlowSendAudioStep;

export type PlaybookFlowDefinition = {
  obra10_playbook_flow_schema: Obra10PlaybookFlowSchemaVersion;
  id?: string;
  version?: string;
  entry_step_id: string;
  journeys?: PlaybookFlowJourney[];
  steps: PlaybookFlowStep[];
};
