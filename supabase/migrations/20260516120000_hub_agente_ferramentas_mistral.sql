-- Ferramentas de IA por agente + provisionamento opcional na API Mistral (Agents).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS motor_ferramentas_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS uso_ferramentas_ia jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS mistral_agent_id text,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_em timestamptz,
  ADD COLUMN IF NOT EXISTS mistral_agent_sync_erro text;

COMMENT ON COLUMN public.hub_agente_identidade.motor_ferramentas_habilitado IS
  'Se true, o motor de atendimento pode invocar ferramentas (function calling) quando o modelo é Mistral.';
COMMENT ON COLUMN public.hub_agente_identidade.mistral_agent_sync_habilitado IS
  'Se true, cria/atualiza um registo em beta Agents da Mistral alinhado a este agente Hub.';
COMMENT ON COLUMN public.hub_agente_identidade.uso_ferramentas_ia IS
  'Mapa { "tool_id": true|false } — só tools conhecidas pelo servidor são permitidas.';
COMMENT ON COLUMN public.hub_agente_identidade.mistral_agent_id IS
  'ID devolvido pela Mistral ao provisionar o agente (Agents API).';
