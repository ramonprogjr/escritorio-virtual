-- ============================================================================
-- SEG-D2: RLS tenant-scoped para hub_contas_pagar e hub_contas_receber
--
-- ⚠️  NÃO APLICAR AUTONOMAMENTE — janela do dono (confirmar antes de rodar em prod).
--
-- Contexto:
--   A migração 20260529210000_ensure_hub_financeiro_tables.sql criou estas tabelas
--   com a política "service" USING(true) WITH CHECK(true) e GRANT ALL TO anon.
--   Isso significa que qualquer cliente com a anon key pode ler/escrever todos os
--   lançamentos de todos os tenants. A versão correta já foi aplicada manualmente via
--   docs/sql/bloco-e-rls-APPLIED.sql (2026-06-23), mas nunca foi versionada.
--   Esta migração idempotente promove aquela proteção ao histórico oficial de migrações.
--
-- O que faz:
--   1. Dropa a policy permissiva "_service USING(true)" de cada tabela.
--   2. Revoga GRANT ALL de anon (anon não deve ter acesso ao financeiro).
--   3. Cria policies tenant-scoped (select/insert/update) para authenticated + service_role.
--   4. DELETE permanece exclusivo ao service_role (server usa service key, bypassa RLS).
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE POLICY + REVOKE (idempotente por si).
-- NOTA (fix 01/jul): Postgres NÃO suporta `CREATE POLICY IF NOT EXISTS` (SQL inválido) — trocado
-- por `DROP POLICY IF EXISTS <nome>; CREATE POLICY <nome>` em cada policy (mesmo efeito, válido).
-- Reversível: ver bloco de rollback ao final.
--
-- Verificar estado atual antes de aplicar:
--   SELECT polname, roles, qual
--   FROM pg_policies
--   WHERE tablename IN ('hub_contas_pagar', 'hub_contas_receber');
-- ============================================================================

-- ── hub_contas_pagar ─────────────────────────────────────────────────────────

-- 1. Dropa a policy aberta deixada pela migração anterior
DROP POLICY IF EXISTS hub_contas_pagar_service ON public.hub_contas_pagar;

-- 2. Revoga acesso ao anon (financeiro nunca deve ser lido via anon key sem JWT)
REVOKE ALL ON public.hub_contas_pagar FROM anon;

-- 3. Policies tenant-scoped para authenticated
DROP POLICY IF EXISTS hub_contas_pagar_auth_select ON public.hub_contas_pagar;
CREATE POLICY hub_contas_pagar_auth_select
  ON public.hub_contas_pagar
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_contas_pagar_auth_insert ON public.hub_contas_pagar;
CREATE POLICY hub_contas_pagar_auth_insert
  ON public.hub_contas_pagar
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_contas_pagar_auth_update ON public.hub_contas_pagar;
CREATE POLICY hub_contas_pagar_auth_update
  ON public.hub_contas_pagar
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

-- 4. service_role bypassa RLS por definição do Supabase (não precisa de policy explícita).
--    Granting SELECT para garantir que crmDb() (service key) leia mesmo que outra migração
--    tenha feito REVOKE ALL ON ... FROM service_role por engano.
GRANT SELECT, INSERT, UPDATE ON public.hub_contas_pagar TO service_role;

-- ── hub_contas_receber ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS hub_contas_receber_service ON public.hub_contas_receber;

REVOKE ALL ON public.hub_contas_receber FROM anon;

DROP POLICY IF EXISTS hub_contas_receber_auth_select ON public.hub_contas_receber;
CREATE POLICY hub_contas_receber_auth_select
  ON public.hub_contas_receber
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_contas_receber_auth_insert ON public.hub_contas_receber;
CREATE POLICY hub_contas_receber_auth_insert
  ON public.hub_contas_receber
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_contas_receber_auth_update ON public.hub_contas_receber;
CREATE POLICY hub_contas_receber_auth_update
  ON public.hub_contas_receber
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = public.current_user_tenant_id() OR tenant_id IS NULL);

GRANT SELECT, INSERT, UPDATE ON public.hub_contas_receber TO service_role;

-- ============================================================================
-- ROLLBACK (executar em ordem reversa se necessário):
--
--   DROP POLICY IF EXISTS hub_contas_pagar_auth_select  ON public.hub_contas_pagar;
--   DROP POLICY IF EXISTS hub_contas_pagar_auth_insert  ON public.hub_contas_pagar;
--   DROP POLICY IF EXISTS hub_contas_pagar_auth_update  ON public.hub_contas_pagar;
--   DROP POLICY IF EXISTS hub_contas_receber_auth_select ON public.hub_contas_receber;
--   DROP POLICY IF EXISTS hub_contas_receber_auth_insert ON public.hub_contas_receber;
--   DROP POLICY IF EXISTS hub_contas_receber_auth_update ON public.hub_contas_receber;
--   CREATE POLICY hub_contas_pagar_service   ON public.hub_contas_pagar   FOR ALL USING (true) WITH CHECK (true);
--   CREATE POLICY hub_contas_receber_service ON public.hub_contas_receber FOR ALL USING (true) WITH CHECK (true);
--   GRANT ALL ON public.hub_contas_pagar   TO anon, authenticated, service_role;
--   GRANT ALL ON public.hub_contas_receber TO anon, authenticated, service_role;
-- ============================================================================
