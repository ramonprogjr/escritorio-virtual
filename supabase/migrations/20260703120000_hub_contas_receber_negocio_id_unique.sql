-- Anti-duplicação no caminho do dinheiro (CRÍTICO-4 da auditoria): garante que cada NEGÓCIO
-- gere NO MÁXIMO uma conta a receber. Índice ÚNICO PARCIAL — só vale quando negocio_id NÃO é
-- nulo (lançamentos manuais avulsos continuam livres, podem repetir negocio_id NULL à vontade).
--
-- Complementa o backend (SELECT-first em app/api/crm/financeiro/contas/route.ts, que retorna o
-- recebível existente em vez de criar outro) e o índice NÃO-único já criado em
-- 20260630120000_hub_contas_receber_negocio_id.sql (substituído aqui pelo único).
--
-- ADITIVO e idempotente. NÃO aplicada automaticamente — aplicar via SQL Editor / supabase db push.
--
-- ATENÇÃO ANTES DE APLICAR: se a base já tiver recebíveis duplicados para o mesmo negocio_id,
-- a criação do índice único FALHA. Rode antes a verificação abaixo e consolide manualmente:
--   SELECT negocio_id, COUNT(*) FROM public.hub_contas_receber
--   WHERE negocio_id IS NOT NULL GROUP BY negocio_id HAVING COUNT(*) > 1;

-- Remove o índice NÃO-único anterior (mesma coluna/condição) — será substituído pelo único.
DROP INDEX IF EXISTS public.idx_hub_contas_receber_negocio_id;

-- Índice ÚNICO PARCIAL: um negocio_id (não nulo) só pode ter um recebível.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_contas_receber_negocio_id
  ON public.hub_contas_receber (negocio_id)
  WHERE negocio_id IS NOT NULL;

-- ─── ROLLBACK (manual, se necessário) ───────────────────────────────────────
-- DROP INDEX IF EXISTS public.uq_hub_contas_receber_negocio_id;
-- -- (opcional) recriar o índice não-único anterior:
-- CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_negocio_id
--   ON public.hub_contas_receber (negocio_id) WHERE negocio_id IS NOT NULL;
