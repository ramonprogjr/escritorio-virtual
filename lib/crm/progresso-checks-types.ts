import type { ProgressoStatus } from "./progresso-sistema-data";

export type ProgressoCheckType =
  | "file_exists"
  | "grep"
  | "supabase_table"
  | "supabase_column"
  | "env"
  | "http"
  | "manual";

export type ProgressoCheckDef = {
  id: string;
  type: ProgressoCheckType;
  /** Obrigatório para status ok; falha opcional → parcial se algum obrigatório passou */
  required?: boolean;
  path?: string;
  paths?: string[];
  pattern?: string;
  flags?: string;
  table?: string;
  column?: string;
  minCount?: number;
  env?: string;
  equals?: string;
  url?: string;
  expectStatus?: number;
  jsonPath?: string;
  jsonMinLength?: number;
  manualStatus?: ProgressoStatus;
};

export type ProgressoCheckResult = {
  id: string;
  ok: boolean;
  detail: string;
  required: boolean;
};

export type ProgressoItemVerificacao = {
  status: ProgressoStatus;
  checks: ProgressoCheckResult[];
  oQueFalta: string;
};

export type ProgressoDeployVerificacao = {
  id: string;
  ok: boolean;
  detail: string;
};

export type ProgressoVerificacaoArtifact = {
  geradoEm: string;
  ambiente: string;
  itens: Record<string, ProgressoItemVerificacao>;
  deploy: Record<string, ProgressoDeployVerificacao>;
};
