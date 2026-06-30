-- ============================================================================
-- FIN-D10: Trilha de auditoria de baixa nas tabelas financeiras
--
-- ⚠️  NÃO APLICAR AUTONOMAMENTE — janela do dono (confirmar antes de rodar em prod).
--
-- Contexto:
--   Os PATCH de baixa (marcar pago/recebido) não registram quem/quando deu baixa.
--   Para dinheiro, a ausência de trilha é um gap de governança. O userId já existe
--   no contexto da autenticação (auth.ctx.userId) e está sendo ignorado.
--
-- O que faz (aditivo, sem perda de dados):
--   - Adiciona baixado_por (TEXT) e baixado_em (TIMESTAMPTZ) a ambas as tabelas.
--   - Colunas nullable: registros existentes não são afetados.
--   - Índices para consulta rápida de "quem deu baixa" por período.
--
-- Reversível: ver bloco de rollback ao final.
-- ============================================================================

ALTER TABLE public.hub_contas_pagar
  ADD COLUMN IF NOT EXISTS baixado_por TEXT,
  ADD COLUMN IF NOT EXISTS baixado_em  TIMESTAMPTZ;

ALTER TABLE public.hub_contas_receber
  ADD COLUMN IF NOT EXISTS baixado_por TEXT,
  ADD COLUMN IF NOT EXISTS baixado_em  TIMESTAMPTZ;

-- Índices para auditoria (quem/quando deu baixa)
CREATE INDEX IF NOT EXISTS idx_hub_contas_pagar_baixado_por
  ON public.hub_contas_pagar (baixado_por)
  WHERE baixado_por IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hub_contas_receber_baixado_por
  ON public.hub_contas_receber (baixado_por)
  WHERE baixado_por IS NOT NULL;

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE public.hub_contas_pagar
--     DROP COLUMN IF EXISTS baixado_por,
--     DROP COLUMN IF EXISTS baixado_em;
--   ALTER TABLE public.hub_contas_receber
--     DROP COLUMN IF EXISTS baixado_por,
--     DROP COLUMN IF EXISTS baixado_em;
-- ============================================================================
