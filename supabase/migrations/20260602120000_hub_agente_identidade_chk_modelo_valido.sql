-- Alinha chk_modelo_valido com o Hub Mistral-first (lib/ia/hub-model-defaults.ts):
-- sentinel `mistral`, atalhos legados haiku|sonnet|opus, família Mistral (*mistral-*, ministral*, etc.),
-- e IDs Anthropic (`claude-*`). Corrige linhas antigas antes de recriar o CHECK.

CREATE OR REPLACE FUNCTION public.hub_agente_modelo_id_valido(p text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT
    p IS NOT NULL
    AND length(btrim(p)) > 0
    AND (
      lower(btrim(p)) = 'mistral'
      OR lower(btrim(p)) IN ('haiku', 'sonnet', 'opus')
      OR btrim(p) ~* '^claude-'
      OR btrim(p) ~* '^mistral-'
      OR btrim(p) ~* '^ministral'
      OR btrim(p) ~* '^open-mixtral'
      OR btrim(p) ~* '^pixtral'
      OR btrim(p) ~* '^codestral'
    );
$$;

COMMENT ON FUNCTION public.hub_agente_modelo_id_valido(text) IS
  'Valida modelo_padrao / modelo_critico / modelo_alto_valor em hub_agente_identidade (Mistral sentinel, legados curtos, família Mistral, claude-*).';

UPDATE public.hub_agente_identidade h
SET
  modelo_padrao = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_padrao) THEN h.modelo_padrao
    ELSE 'mistral'
  END,
  modelo_critico = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_critico) THEN h.modelo_critico
    ELSE 'mistral'
  END,
  modelo_alto_valor = CASE
    WHEN public.hub_agente_modelo_id_valido(h.modelo_alto_valor) THEN h.modelo_alto_valor
    ELSE 'mistral'
  END
WHERE
  NOT public.hub_agente_modelo_id_valido(h.modelo_padrao)
  OR NOT public.hub_agente_modelo_id_valido(h.modelo_critico)
  OR NOT public.hub_agente_modelo_id_valido(h.modelo_alto_valor);

ALTER TABLE public.hub_agente_identidade
  DROP CONSTRAINT IF EXISTS chk_modelo_valido;

ALTER TABLE public.hub_agente_identidade
  ADD CONSTRAINT chk_modelo_valido CHECK (
    public.hub_agente_modelo_id_valido(modelo_padrao)
    AND public.hub_agente_modelo_id_valido(modelo_critico)
    AND public.hub_agente_modelo_id_valido(modelo_alto_valor)
  );
