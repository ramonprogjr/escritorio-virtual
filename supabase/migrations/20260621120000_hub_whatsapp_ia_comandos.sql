-- Comandos WhatsApp: pausa global da linha + operadores autorizados a comandar IA

ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS ia_whatsapp_pausada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_pausada_em timestamptz,
  ADD COLUMN IF NOT EXISTS ia_pausada_por text,
  ADD COLUMN IF NOT EXISTS ia_pausada_motivo text;

ALTER TABLE public.hub_contatos_notificacao
  ADD COLUMN IF NOT EXISTS pode_comandar_ia boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.hub_agente_identidade.ia_whatsapp_pausada IS
  'Quando true, a IA não responde leads nesta instância WhatsApp até reativar (CRM ou /ia-on).';

COMMENT ON COLUMN public.hub_contatos_notificacao.pode_comandar_ia IS
  'Telefone autorizado a enviar comandos /ia-off, /ia pausa, etc. para o número comercial.';
