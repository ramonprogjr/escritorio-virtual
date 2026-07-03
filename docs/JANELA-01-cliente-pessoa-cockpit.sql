-- ============================================================================
-- JANELA DO DONO — Parte 1: ligar o CLIENTE à obra (acende o cockpit do cliente)
-- Contexto: o cockpit por persona (Onda 2) escopa a "Minha obra" do cliente por
-- hub_obras.cliente_pessoa_id. Hoje a obra Consulado tem cliente_empresa_id mas
-- cliente_pessoa_id = NULL -> a visão do CLIENTE nasce vazia. Isto liga a pessoa
-- representante do Consulado à obra. É ADITIVO, idempotente e reversível.
--
-- Alvos (verificados via Supabase MCP em 03/jul):
--   obra    a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d  (Obra Consulado da Itália, status 'ativa')
--   tenant  00000000-0000-4000-8000-000000000001
--   pessoa  0ce3273f-3562-4de0-98cc-083678f9cdfd  (Consulado da Itália — Representante, PS2026006)
-- ============================================================================

BEGIN;

-- Segurança: só atualiza a linha certa (obra + tenant) e só se ainda estiver NULL
-- (idempotente — rodar de novo não muda nada).
UPDATE public.hub_obras
SET    cliente_pessoa_id = '0ce3273f-3562-4de0-98cc-083678f9cdfd'
WHERE  id        = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d'
  AND  tenant_id = '00000000-0000-4000-8000-000000000001'
  AND  cliente_pessoa_id IS NULL;

-- Confirmação (deve mostrar a pessoa ligada):
SELECT id, titulo, status, cliente_pessoa_id
FROM   public.hub_obras
WHERE  id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';

COMMIT;

-- ROLLBACK (se precisar desfazer):
-- UPDATE public.hub_obras SET cliente_pessoa_id = NULL
-- WHERE id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d'
--   AND tenant_id = '00000000-0000-4000-8000-000000000001';

-- --------------------------------------------------------------------------
-- OPCIONAL (decisão sua) — avançar o ESTÁGIO da obra no board.
-- A obra está status='ativa' mas estagio_slug='planejamento' (o board mostra
-- "Planejamento"). status e estágio são eixos diferentes (saúde vs etapa), então
-- NÃO é bug — mas se o Consulado já está em execução, avance o estágio:
-- UPDATE public.hub_obras SET estagio_slug = 'execucao'   -- confirme o slug do seu pipeline
-- WHERE id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d'
--   AND tenant_id = '00000000-0000-4000-8000-000000000001';
