-- Vista enriquecida: hub_leads_crm + hub_pessoas + última linha hub_fila_mensagens (mesmo lead_id CRM).
-- Leitura via PostgREST: expõe colunas calculadas para relatórios / futuras telas.
-- A app pode continuar a usar hub_leads_crm + merge no cliente se preferir.

ALTER TABLE public.hub_leads_crm ADD COLUMN IF NOT EXISTS pessoa_id UUID;

ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS cidade TEXT;
ALTER TABLE public.hub_pessoas ADD COLUMN IF NOT EXISTS estado TEXT;

CREATE INDEX IF NOT EXISTS idx_hub_fila_mensagens_lead_criado
  ON public.hub_fila_mensagens (lead_id, criado_em DESC NULLS LAST);

DROP VIEW IF EXISTS public.vw_hub_leads_crm_enriquecido;

-- Código PES: vem de hub_pessoas.codigo, exposto na view como pessoa_codigo (evita nome genérico "codigo").
CREATE VIEW public.vw_hub_leads_crm_enriquecido
WITH (security_invoker = true)
AS
SELECT
  l.*,
  p.codigo AS pessoa_codigo,
  p.nome AS pessoa_nome_completo,
  COALESCE(NULLIF(TRIM(BOTH FROM l.email), ''::text), p.email) AS email_exibicao,
  p.cidade AS pessoa_cidade,
  p.estado AS pessoa_estado,
  fm.conteudo AS ultima_mensagem_fila,
  fm.criado_em AS ultima_mensagem_fila_em
FROM public.hub_leads_crm l
LEFT JOIN public.hub_pessoas p ON p.id = l.pessoa_id
LEFT JOIN LATERAL (
  SELECT f.conteudo, f.criado_em
  FROM public.hub_fila_mensagens f
  WHERE f.lead_id = l.id
  ORDER BY f.criado_em DESC NULLS LAST
  LIMIT 1
) fm ON true;

COMMENT ON VIEW public.vw_hub_leads_crm_enriquecido IS
  'hub_leads_crm.* + enriquecimento: pessoa_codigo = código PES (hub_pessoas.codigo); email_exibicao; última linha hub_fila_mensagens onde lead_id = id do CRM.';
