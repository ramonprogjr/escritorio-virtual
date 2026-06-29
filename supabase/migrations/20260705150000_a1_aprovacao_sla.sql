-- ============================================================================
-- A1 — Aprovação do cliente: SLA + histórico mínimo (BLOCO A1)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     Migração ADITIVA, idempotente e REVERSÍVEL. ZERO tabela nova: só 3 colunas
--     aditivas em hub_projetos_fases (para o SLA do cockpit "Aguardando há 4d" e o
--     último motivo da rejeição) + 1 índice parcial para a fila do arquiteto.
--     Segue o padrão de A0 (20260705140000): ADD COLUMN IF NOT EXISTS, sem CHECK novo.
--
-- DEPENDE de A0 (20260705140000_a0_arquitetura_projeto.sql): reusa as colunas
--   hub_projetos_fases.tipo / aprovacao_status / entregavel_url já criadas lá.
--   NÃO re-altera nenhum CHECK de A0 (o de aprovacao_status já cobre os 4 estados).
--
-- ATÉ APLICAR: a app degrada graciosamente — as rotas A1 detectam a coluna ausente
--   (isMissingPgColumn) e caem num caminho sem SLA (usa atualizado_em como proxy do
--   tempo de espera; o motivo da rejeição não fica persistido). Nunca quebra.
--
-- O QUE ENTREGA:
--   1. aprovacao_enviado_em    — quando a fase foi enviada (relógio do SLA "há Nd").
--   2. aprovacao_respondido_em — quando o cliente respondeu (aprovou/rejeitou).
--   3. aprovacao_motivo        — último motivo de rejeição (citado no card + timeline).
--   4. Índice parcial p/ a FILA do arquiteto (fases tipo='fase' AND status='enviado').
-- ============================================================================

-- ─── 0) Guard de ordem A0→A1 ──────────────────────────────────────────────────
-- O índice parcial abaixo referencia colunas criadas pela A0 (tipo / aprovacao_status).
-- Se A1 for aplicada antes da A0, falha cedo com mensagem clara (em vez de um erro
-- críptico de "column does not exist" no CREATE INDEX).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hub_projetos_fases'
      AND column_name IN ('tipo', 'aprovacao_status')
    GROUP BY table_name
    HAVING COUNT(DISTINCT column_name) = 2
  ) THEN
    RAISE EXCEPTION 'Aplique a migração A0 (20260705140000_a0_arquitetura_projeto.sql) antes da A1: faltam as colunas tipo/aprovacao_status em hub_projetos_fases.';
  END IF;
END $$;

-- ─── 1) Colunas aditivas de SLA/histórico mínimo ──────────────────────────────
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS aprovacao_enviado_em    TIMESTAMPTZ;
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS aprovacao_respondido_em TIMESTAMPTZ;
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS aprovacao_motivo        TEXT;

-- ─── 2) Índice parcial p/ a fila "Em aprovação" (cockpit do arquiteto) ────────
-- Ordena por tempo de espera (pior no topo) → aprovacao_enviado_em ASC. O índice
-- parcial cobre só as linhas enviadas, que são as da fila (barato e seletivo).
CREATE INDEX IF NOT EXISTS idx_hub_projetos_fases_fila_aprovacao
  ON public.hub_projetos_fases (tenant_id, aprovacao_enviado_em)
  WHERE tipo = 'fase' AND aprovacao_status = 'enviado';

COMMENT ON COLUMN public.hub_projetos_fases.aprovacao_enviado_em IS
  'A1: instante do envio ao cliente (relógio do SLA do cockpit). NULL = nunca enviado.';
COMMENT ON COLUMN public.hub_projetos_fases.aprovacao_respondido_em IS
  'A1: instante da resposta do cliente (aprovou/rejeitou).';
COMMENT ON COLUMN public.hub_projetos_fases.aprovacao_motivo IS
  'A1: último motivo de rejeição do cliente (obrigatório ao rejeitar). Citado no card e na timeline.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP INDEX IF EXISTS public.idx_hub_projetos_fases_fila_aprovacao;
--   ALTER TABLE public.hub_projetos_fases
--     DROP COLUMN IF EXISTS aprovacao_enviado_em,
--     DROP COLUMN IF EXISTS aprovacao_respondido_em,
--     DROP COLUMN IF EXISTS aprovacao_motivo;
-- ============================================================================
