-- ============================================================================
-- A4 — hub_contatos_notificacao: coluna tenant_id + backfill + RLS por tenant
--
-- ⚠️  NÃO aplicar agora — janela do dono. ADITIVA, REVERSÍVEL, idempotente.
--     Fiel ao padrão do projeto: tenant_id = current_user_tenant_id() (def. em
--     20260626130000_multitenant_foundation.sql), service_role/authenticated com GRANT,
--     `anon` confinado ao tenant default legado. Mesma estrutura de 20260818120000_sec_rls_e5_anon.sql.
--
-- CONTEXTO: a tabela hub_contatos_notificacao NÃO tem CREATE TABLE neste repo (criada fora
--   das migrations versionadas). Por isso esta migração é DEFENSIVA: tudo guardado por
--   to_regclass(...) IS NOT NULL e ADD COLUMN IF NOT EXISTS — roda sem erro mesmo que a tabela
--   ainda não exista no ambiente (no-op), e é idempotente (pode rodar mais de uma vez).
--
-- POR QUE: hoje a tela /crm/contatos gravava via Supabase ANON do browser sem tenant_id;
--   a única proteção era uma RLS não declarada no repo. Esta migração:
--     (1) garante a coluna tenant_id (default = tenant Obra10 legado);
--     (2) backfilla linhas legadas (tenant_id NULL → default);
--     (3) liga RLS escopada por tenant para authenticated; mantém o tenant default para anon
--         (compat. com qualquer cliente legado) e GRANT a service_role (rotas server /api/crm/contatos).
--
-- O service-role das rotas (crmDb) ignora RLS e JÁ filtra tenant explícito no código
-- (esta é a 2ª camada — a do banco). Os notificadores de background (webhook/cron) usam o
-- service-role client e por isso NÃO são afetados por esta RLS.
--
-- ORDEM DE APPLY: depois de 20260626130000_multitenant_foundation.sql (cria
--   current_user_tenant_id() e default_obra10_tenant_id()). ROLLBACK no fim do arquivo.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.hub_contatos_notificacao') IS NULL THEN
    RAISE NOTICE 'hub_contatos_notificacao não existe neste ambiente — migração é no-op.';
    RETURN;
  END IF;

  -- (1) Coluna tenant_id (default = tenant Obra10 legado, igual ao restante do schema)
  EXECUTE $sql$
    ALTER TABLE public.hub_contatos_notificacao
      ADD COLUMN IF NOT EXISTS tenant_id uuid
      DEFAULT '00000000-0000-4000-8000-000000000001'::uuid
  $sql$;

  -- (2) Backfill: linhas legadas sem tenant herdam o tenant default (behavior-preserving)
  EXECUTE $sql$
    UPDATE public.hub_contatos_notificacao
       SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
     WHERE tenant_id IS NULL
  $sql$;

  -- Índice por tenant (filtros sempre passam por tenant_id)
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_hub_contatos_notificacao_tenant ON public.hub_contatos_notificacao (tenant_id)';

  -- (3) RLS por tenant
  EXECUTE 'ALTER TABLE public.hub_contatos_notificacao ENABLE ROW LEVEL SECURITY';

  -- authenticated: só vê/edita o próprio tenant (null-safe p/ legado)
  EXECUTE 'DROP POLICY IF EXISTS hub_contatos_notificacao_auth_tenant ON public.hub_contatos_notificacao';
  EXECUTE $sql$
    CREATE POLICY hub_contatos_notificacao_auth_tenant ON public.hub_contatos_notificacao
      FOR ALL TO authenticated
      USING (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id())
      WITH CHECK (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id())
  $sql$;

  -- anon: confinado ao tenant default legado (compat.; a tela já migrou p/ rota server)
  EXECUTE 'DROP POLICY IF EXISTS hub_contatos_notificacao_anon_default ON public.hub_contatos_notificacao';
  EXECUTE $sql$
    CREATE POLICY hub_contatos_notificacao_anon_default ON public.hub_contatos_notificacao
      FOR ALL TO anon
      USING (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id())
      WITH CHECK (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id())
  $sql$;

  -- service_role (rotas /api/crm/contatos) — acesso completo (ignora RLS de qualquer forma)
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_contatos_notificacao TO service_role';
END $$;

-- ============================================================================
-- ROLLBACK (só se precisar reverter explicitamente):
--   ALTER TABLE public.hub_contatos_notificacao DISABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS hub_contatos_notificacao_auth_tenant ON public.hub_contatos_notificacao;
--   DROP POLICY IF EXISTS hub_contatos_notificacao_anon_default ON public.hub_contatos_notificacao;
--   DROP INDEX IF EXISTS public.idx_hub_contatos_notificacao_tenant;
--   -- a coluna tenant_id pode permanecer (aditiva, sem efeito colateral). Para removê-la:
--   -- ALTER TABLE public.hub_contatos_notificacao DROP COLUMN IF EXISTS tenant_id;
-- ============================================================================
