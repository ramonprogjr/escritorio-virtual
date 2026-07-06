-- ════════════════════════════════════════════════════════════════════════════
-- JANELA — RLS Faixa B (PARTE SEGURA): fecha 16 tabelas LEGADAS MORTAS
--
-- ⚠️ PREPARADA em 06/jul — **NÃO APLICADA**. Aplicar na JANELA DO DONO (via MCP,
--    com o dono presente) e rodar o security advisor depois pra confirmar que
--    fechou e nada novo apareceu. Ver docs/JANELA-SEGURANCA-CHECKLIST.md (Passo A).
--
-- CONTEXTO: o schema inicial (20260503 hub_schema_inicial) foi substituído pelas
-- tabelas hub_*. Estas 16 tabelas legadas têm policy `USING(true)` (porta aberta ao
-- papel `authenticated`) e ZERO uso no código do app (verificado por grep 06/jul —
-- nenhum `.from("leads")`, `.from("crm_persons")`, etc.). São TABELAS MORTAS.
--
-- O advisor (158 avisos, ZERO ERRO) marcou 16 delas como `rls_policy_always_true`.
-- Como o app usa hub_* via service_role (que bypassa RLS), fechá-las remove a
-- exposição latente (se a chave anon vazasse, alguém leria dados velhos) SEM afetar
-- nada em runtime.
--
-- FECHA (fail-closed, como o resto do sistema):
--   1) REVOKE de anon/authenticated  → tira o acesso (fecha a exposição de fato);
--   2) ENABLE RLS                     → defesa em profundidade;
--   3) DROP de TODAS as policies delas → limpa o aviso `rls_policy_always_true`.
-- Idempotente (só age se a tabela existir; DROP POLICY IF EXISTS) e reversível
-- (rollback: GRANT de volta — mas não há motivo, são mortas).
--
-- OPÇÃO do dono (NÃO incluída aqui de propósito): `DROP TABLE` nessas 16 remove os
-- dados velhos de vez. É DECISÃO DO DONO (apaga dado — ver regra "delete só arquiva")
-- por isso aqui a gente só FECHA. Se o dono quiser a limpeza total, faz-se à parte.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text;
  p record;
  mortas text[] := ARRAY[
    'activity_logs','agents','crm_commissions','crm_deals','crm_operational_events',
    'crm_opportunities','crm_partner_matches','crm_partners','crm_persons','departments',
    'human_profiles','lead_contacts','leads','modules','settings','tasks'
  ];
BEGIN
  FOREACH t IN ARRAY mortas LOOP
    -- tolerante: só age se a tabela existir (bancos diferentes / reconstruído do zero)
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      -- 1) fecha o acesso dos papéis expostos (a exposição real do advisor)
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
      -- 2) garante RLS ligado
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      -- 3) dropa TODAS as policies dessas tabelas mortas (limpa o rls_policy_always_true)
      FOR p IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
      RAISE NOTICE 'Tabela morta fechada: public.%', t;
    END IF;
  END LOOP;
END $$;
