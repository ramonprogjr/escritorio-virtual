-- Persiste o SETOR do agente IA em hub_agente_identidade.
-- Aditiva e OPCIONAL: o setor continua sendo derivável do cargo em runtime
-- (lib/hub/agente-setor.ts) quando esta coluna estiver nula — nenhum dado existente
-- é alterado. Valores esperados: atendimento|comercial|financeiro|rh|engenharia|
-- trafego|operacoes|marketing|conteudo (texto livre tolerado).
ALTER TABLE public.hub_agente_identidade
  ADD COLUMN IF NOT EXISTS setor_ia TEXT;

-- ──────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (não aplicar a menos que precise desfazer):
--   ALTER TABLE public.hub_agente_identidade DROP COLUMN IF EXISTS setor_ia;
-- ──────────────────────────────────────────────────────────────────────────────
