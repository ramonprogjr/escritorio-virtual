-- Ligação agente CRM ↔ instância UAZAPI (um número WhatsApp por agente quando configurado).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS uazapi_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_token TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_instance_name TEXT,
  ADD COLUMN IF NOT EXISTS uazapi_connection_status TEXT;

COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_id IS 'ID da instância na UAZAPI (correlaciona webhook global).';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_token IS 'Token da instância (header token); não expor ao cliente.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_instance_name IS 'Nome amigável na UAZAPI.';
COMMENT ON COLUMN public.hub_agente_identidade.uazapi_connection_status IS 'disconnected | connecting | connected (espelho operacional).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_agente_uazapi_instance_id
  ON public.hub_agente_identidade (uazapi_instance_id)
  WHERE uazapi_instance_id IS NOT NULL AND trim(uazapi_instance_id) <> '';
