-- ############################################################################
-- TIER 0 — SCRIPT A: anti-duplicata de código (as 2 tabelas que faltavam)
--
-- COMO RODAR: Supabase Dashboard -> SQL Editor -> colar -> Run.
--   Índice normal (tabelas quase vazias = instantâneo). Pode rodar antes do B.
--
-- Pré-check 02/jul: 0 duplicatas de código em todas as tabelas (global p/ identidade,
--   por-tenant p/ documento). As demais tabelas JÁ têm unique de código — só faltam estas 2.
-- Idempotente: IF NOT EXISTS.
-- ############################################################################

-- Mão de obra (hub_especialistas) e serviços são registros por-tenant → unique (tenant_id, codigo).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_especialistas_codigo_tenant
  ON public.hub_especialistas (tenant_id, codigo) WHERE codigo IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_servicos_codigo_tenant
  ON public.hub_servicos (tenant_id, codigo) WHERE codigo IS NOT NULL;

-- Verificação (rode depois; deve listar os 2 índices acima como válidos):
--   SELECT indexrelid::regclass, indisvalid FROM pg_index
--   WHERE indexrelid::regclass::text IN ('uq_hub_especialistas_codigo_tenant','uq_hub_servicos_codigo_tenant');
