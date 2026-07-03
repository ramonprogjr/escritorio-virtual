-- ============================================================================
-- JANELA DO DONO — #3: coluna do ENGENHEIRO RESPONSÁVEL da obra
-- ----------------------------------------------------------------------------
-- MOTIVO (ressalva do dono + Onda 0): o escrow é universal e a "chave técnica" é do
-- RESPONSÁVEL daquele pagamento. Arquiteto já amarra por hub_projetos.responsavel_id
-- (coluna existe). Falta a ponta da ENGENHARIA: hub_obras não tem coluna de responsável.
-- Esta migração ADITIVA cria hub_obras.engenheiro_responsavel_id (uuid puro, mesmo padrão
-- da coluna irmã responsavel_id de hub_projetos — sem FK rígida).
--
-- Depois disto, uma onda de CÓDIGO amarra a chave técnica de OBRA ao engenheiro responsável
-- (hoje o gate é PAPEL operation + humano-distinto + humano-only — ver TODO em
-- lib/ia/aprovacoes.ts validarChaveEscrow). NÃO muda comportamento sozinha; é preparo.
-- Idempotente (IF NOT EXISTS) e reversível.
-- ============================================================================

ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS engenheiro_responsavel_id uuid;

COMMENT ON COLUMN public.hub_obras.engenheiro_responsavel_id IS
  'Usuário (role operation) responsável técnico da obra — amarra a escrow:chave_tecnica de obra/prestadores ao humano certo. Espelha hub_projetos.responsavel_id (arquiteto).';

-- Conferência:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public' AND table_name='hub_obras' AND column_name='engenheiro_responsavel_id';

-- --------------------------------------------------------------------------
-- OPCIONAL (decisão sua) — apontar o engenheiro responsável da obra Consulado.
-- Quem é o eng. residente? (ex.: "Roberto Nunes — Eng. Residente", role operation).
-- Descubra o id e rode:
-- UPDATE public.hub_obras
-- SET engenheiro_responsavel_id = (SELECT id FROM public.users WHERE email='residente@niceengenharia.com.br')
-- WHERE id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';

-- ROLLBACK (se precisar):
-- ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS engenheiro_responsavel_id;
