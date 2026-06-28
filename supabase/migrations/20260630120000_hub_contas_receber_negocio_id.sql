-- Vínculo do RECEBÍVEL com o NEGÓCIO de origem (cadeia venda → financeiro).
-- Quando um negócio é GANHO, o usuário gera (1 toque) uma conta a receber já
-- pré-preenchida; esta coluna guarda a referência ao negócio para rastreio e
-- para exibir "quem deve" no card do recebível.
--
-- ADITIVO e idempotente: NÃO altera dados nem regras existentes. A gravação no
-- código é best-effort (tolerante se a coluna ainda não existir nesta base).
-- NÃO aplicada automaticamente — aplicar via SQL Editor / supabase db push quando aprovado.

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS negocio_id UUID;

COMMENT ON COLUMN public.hub_contas_receber.negocio_id
  IS 'Negócio (hub_negocios) que originou este recebível. NULL = lançamento manual avulso.';

-- Índice leve para buscar recebíveis por negócio (rastreio e listagens).
CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_negocio_id
  ON public.hub_contas_receber (negocio_id)
  WHERE negocio_id IS NOT NULL;

-- ─── ROLLBACK (manual, se necessário) ───────────────────────────────────────
-- DROP INDEX IF EXISTS public.idx_hub_contas_receber_negocio_id;
-- ALTER TABLE public.hub_contas_receber DROP COLUMN IF EXISTS negocio_id;
