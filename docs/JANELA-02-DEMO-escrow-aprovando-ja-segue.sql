-- ============================================================================
-- JANELA DO DONO — Parte 2: SEED **DEMO** (removível) para VER "aprovando já segue"
-- ----------------------------------------------------------------------------
-- Objetivo: colocar dinheiro FICTÍCIO no fluxo da obra Consulado só para você
-- exercitar, ao vivo, o feedback fiel que subimos hoje. Tudo marcado "DEMO",
-- com UUIDs fixos (de3000..), idempotente (ON CONFLICT DO NOTHING) e com ROLLBACK
-- de 1 bloco no fim. NÃO é dado real — apague quando terminar o teste.
--
-- Alvos verificados (Supabase MCP, 03/jul):
--   obra    a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d  (Obra Consulado da Itália)
--   tenant  00000000-0000-4000-8000-000000000001
--
-- COMO TESTAR (depois de rodar este SQL):
--   1) Entre no app e abra  /crm/aprovacoes  — vão aparecer 3 cards DEMO.
--   2) BLOCO A (Gate 1 — orçamento):
--      • Aprove "DEMO — Orçamento Pintura…"  → toast: "Orçamento aprovado — 1 pagamento desbloqueado."
--   3) BLOCO B (Gate 2 — ESCROW dupla-chave, a alma):
--      • Logado como GESTOR/ADMIN (ex. lucasoffgod@hotmail.com), aprove a
--        "Chave 1 (Arquitetura)"  → toast: "1 de 2 chaves confirmada — falta a chave do Hub…"
--      • Logado como OWNER (ex. nice.engemp@gmail.com), aprove a
--        "Chave 2 (Hub)"          → toast: "Escrow liberado: R$ 15.000,00 — as 2 chaves confirmaram…"
--   (a ordem entre as 2 chaves não importa; quem confirmar por último libera.)
--   OBS: a chave da Arquitetura EXIGE um gestor que NÃO seja owner (regra das 2
--   autoridades). Se você só tiver o login owner, ainda verá o "1 de 2 — falta a
--   chave da Arquitetura" ao aprovar a do Hub (já demonstra o "aprovando já segue").
-- ============================================================================

BEGIN;

-- ── Bloco B (ESCROW dupla-chave) — orçamento já aprovado + medição liberada + 2 chaves pendentes ──

-- 1) Item de escopo (a medição referencia um item — R2)
INSERT INTO public.hub_obra_itens (id, obra_id, tenant_id, codigo, nome, tipo, unidade, quantidade, valor_contrato)
VALUES ('de300001-0000-4000-8000-000000000001','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','00000000-0000-4000-8000-000000000001',
        'DEMO-ESC-01','DEMO — Impermeabilização (escopo)','contrato','vb',1,15000)
ON CONFLICT (id) DO NOTHING;

-- 2) Orçamento da frente JÁ APROVADO (como se o Gate 1 já tivesse passado)
INSERT INTO public.hub_obra_orcamentos (id, obra_id, tenant_id, titulo, valor_total, status, aprovado_em, aprovado_por, criado_por)
VALUES ('de300002-0000-4000-8000-000000000002','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','00000000-0000-4000-8000-000000000001',
        'DEMO — Orçamento Impermeabilização',15000,'aprovado',now(),'seed_demo','seed_demo')
ON CONFLICT (id) DO NOTHING;

-- 3) As 2 chaves (pendentes) — a cascata lê tudo por `dados` (pagamento_id) + `tipo`
INSERT INTO public.hub_aprovacoes (id, tipo, agente_slug, descricao, status, tenant_id, obra_id, valor_envolvido, dados)
VALUES
 ('de300004-0000-4000-8000-000000000004','pagamento_obra_arq','seed_demo',
  'DEMO — Pagamento: Chave 1 (Arquitetura) — medição impermeabilização','pendente',
  '00000000-0000-4000-8000-000000000001','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d',15000,
  jsonb_build_object('pagamento_id','de300003-0000-4000-8000-000000000003','obra_id','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','papel','arquitetura')),
 ('de300005-0000-4000-8000-000000000005','pagamento_obra_hub','seed_demo',
  'DEMO — Pagamento: Chave 2 (Hub) — medição impermeabilização','pendente',
  '00000000-0000-4000-8000-000000000001','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d',15000,
  jsonb_build_object('pagamento_id','de300003-0000-4000-8000-000000000003','obra_id','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','papel','hub'))
ON CONFLICT (id) DO NOTHING;

-- 4) Medição LIBERADA, apontando para as 2 chaves (a RPC libera o escrow só com AS DUAS aprovadas)
INSERT INTO public.hub_obra_pagamentos
  (id, obra_id, tenant_id, orcamento_id, item_id, titulo, tipo, numero_medicao,
   valor, valor_retencao, valor_liquido, data_vencimento, status,
   aprovacao_arq_id, aprovacao_hub_id, escrow_liberado, tipo_contrato, criado_por)
VALUES
  ('de300003-0000-4000-8000-000000000003','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','00000000-0000-4000-8000-000000000001',
   'de300002-0000-4000-8000-000000000002','de300001-0000-4000-8000-000000000001',
   'DEMO — Medição 1 (impermeabilização)','medicao',1,
   15000,0,15000,CURRENT_DATE + 7,'liberado',
   'de300004-0000-4000-8000-000000000004','de300005-0000-4000-8000-000000000005',false,'administracao','seed_demo')
ON CONFLICT (id) DO NOTHING;

-- ── Bloco A (Gate 1) — orçamento AGUARDANDO aprovação + medição bloqueada até liberar ──

-- 5) Orçamento enviado (aguardando aprovação)
INSERT INTO public.hub_obra_orcamentos (id, obra_id, tenant_id, titulo, valor_total, status, criado_por)
VALUES ('de300006-0000-4000-8000-000000000006','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','00000000-0000-4000-8000-000000000001',
        'DEMO — Orçamento Pintura',8000,'enviado','seed_demo')
ON CONFLICT (id) DO NOTHING;

-- 6) Medição BLOQUEADA vinculada (a aprovação do orçamento desbloqueia)
INSERT INTO public.hub_obra_pagamentos
  (id, obra_id, tenant_id, orcamento_id, titulo, tipo, valor, valor_retencao, valor_liquido, data_vencimento, status, tipo_contrato, criado_por)
VALUES
  ('de300007-0000-4000-8000-000000000007','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d','00000000-0000-4000-8000-000000000001',
   'de300006-0000-4000-8000-000000000006','DEMO — Medição Pintura (bloqueada)','medicao',8000,0,8000,CURRENT_DATE + 14,'bloqueado','administracao','seed_demo')
ON CONFLICT (id) DO NOTHING;

-- 7) A aprovação do orçamento (Gate 1) — a cascata lê dados.orcamento_id
INSERT INTO public.hub_aprovacoes (id, tipo, agente_slug, descricao, status, tenant_id, obra_id, valor_envolvido, dados)
VALUES
 ('de300008-0000-4000-8000-000000000008','orcamento_frente','seed_demo',
  'DEMO — Orçamento Pintura: aprovar libera os pagamentos vinculados','pendente',
  '00000000-0000-4000-8000-000000000001','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d',8000,
  jsonb_build_object('orcamento_id','de300006-0000-4000-8000-000000000006','obra_id','a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d'))
ON CONFLICT (id) DO NOTHING;

-- Conferência: 3 aprovações DEMO pendentes devem aparecer
SELECT tipo, status, descricao FROM public.hub_aprovacoes
WHERE agente_slug = 'seed_demo' ORDER BY tipo;

COMMIT;

-- ============================================================================
-- ROLLBACK DEMO — remove SÓ o que este seed criou (por id/marcador). Rode quando
-- terminar o teste, ou antes de entrar os dados reais. Escopo restrito ao DEMO.
-- ============================================================================
-- BEGIN;
-- SET LOCAL app.delete_authorized = true;  -- defensivo (caso haja trigger de bloqueio)
-- DELETE FROM public.hub_obra_escrow_movimentos
--   WHERE pagamento_id = 'de300003-0000-4000-8000-000000000003';
-- DELETE FROM public.hub_obra_pagamentos
--   WHERE id IN ('de300003-0000-4000-8000-000000000003','de300007-0000-4000-8000-000000000007');
-- DELETE FROM public.hub_aprovacoes
--   WHERE id IN ('de300004-0000-4000-8000-000000000004','de300005-0000-4000-8000-000000000005','de300008-0000-4000-8000-000000000008');
-- DELETE FROM public.hub_obra_orcamentos
--   WHERE id IN ('de300002-0000-4000-8000-000000000002','de300006-0000-4000-8000-000000000006');
-- DELETE FROM public.hub_obra_itens
--   WHERE id = 'de300001-0000-4000-8000-000000000001';
-- -- a conta de escrow (hub_obra_escrow_contas) fica vazia/zerada por obra — inofensiva;
-- -- se quiser zerar o saldo criado pelo DEMO:
-- -- UPDATE public.hub_obra_escrow_contas SET saldo_liberado = 0
-- --   WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d' AND saldo_pago = 0;
-- COMMIT;
