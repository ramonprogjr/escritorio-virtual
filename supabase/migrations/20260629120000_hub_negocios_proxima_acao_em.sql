-- Próxima ação acionável (Click-and-Go) no NEGÓCIO.
-- A coluna de TEXTO `proxima_acao` já existe (20260528120000_hub_crm_pdf_refinamento.sql).
-- Aqui adicionamos só a DATA/HORA-alvo da próxima ação, espelhando o que os LEADS já têm
-- (hub_leads_crm.data_proxima_acao) e alimentando a "Caixa de Próximas Ações".
--
-- ADITIVO e idempotente: não altera dados nem regras existentes.
-- NÃO aplicada automaticamente — aplicar via SQL Editor / supabase db push quando aprovado.

ALTER TABLE public.hub_negocios
  ADD COLUMN IF NOT EXISTS proxima_acao_em TIMESTAMPTZ;

COMMENT ON COLUMN public.hub_negocios.proxima_acao_em
  IS 'Data/hora-alvo da próxima ação do negócio (Click-and-Go). NULL = sem agenda.';

-- Índice leve para listar/ordenar próximas ações pendentes por vencimento.
CREATE INDEX IF NOT EXISTS idx_hub_negocios_proxima_acao_em
  ON public.hub_negocios (proxima_acao_em)
  WHERE proxima_acao_em IS NOT NULL;

-- ─── ROLLBACK (manual, se necessário) ───────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_hub_negocios_proxima_acao_em;
-- ALTER TABLE public.hub_negocios DROP COLUMN IF EXISTS proxima_acao_em;
