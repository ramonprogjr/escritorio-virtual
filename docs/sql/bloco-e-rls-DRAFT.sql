-- ============================================================================
-- DRAFT — Bloco E: corrigir RLS aberto a anon (Hub Obra10+)
-- ----------------------------------------------------------------------------
-- ⚠️ NÃO APLICAR via `supabase db push` (drift repo↔prod). Aplicar via MCP
--    (apply_migration), UMA TABELA POR VEZ, com:
--      1) backup antes (workflow supabase-backup.yml / DATABASE_URL);
--      2) GO humano por tabela;
--      3) prova por força bruta: chave ANON tentando ler/escrever → NEGADO;
--      4) app LOGADO continua lendo/escrevendo (incl. realtime de hub_leads).
-- ESCOPO: SOMENTE tabelas hub_* deste projeto. NUNCA tocar
--    public.users / membros_* / profissionais_* (Membros é projeto separado no
--    MESMO Supabase). Nomear cada tabela explicitamente — sem loop dinâmico.
-- PRÉ-REQUISITO: finir auditoria viva de TODAS as hub_* (pg_policies). Este draft
--    cobre só as 3 confirmadas abertas (leads, pessoas, contas_receber); auditar
--    hub_empresas/hub_negocios/hub_contas_pagar/hub_imoveis/hub_msg_jobs/
--    hub_fila_mensagens/hub_pipelines/hub_negocio_vinculos antes de fechar o bloco.
-- DESIGN (validado 2026-06-23): o JWT da sessão NÃO tem claim `tenant_id`, então
--    `app_tenant_id()` (claim) = NULL no browser. Resolvemos o tenant por
--    auth.uid()->public.users. Server usa service_role (bypassa RLS) → escritas
--    server seguem funcionando; DELETE fica só p/ service_role (admin via server).
-- ============================================================================

-- 0) Helper: tenant do usuário logado, sem depender de claim no JWT.
create or replace function public.current_user_tenant_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from public.users where auth_id = auth.uid() limit 1
$$;
revoke all on function public.current_user_tenant_id() from public;
grant execute on function public.current_user_tenant_id() to authenticated;

-- ============================ hub_leads_crm ============================
-- (1) CRIAR policies escopadas ANTES de dropar as permissivas.
create policy hub_leads_crm_auth_select on public.hub_leads_crm
  for select to authenticated
  using (tenant_id = public.current_user_tenant_id());

create policy hub_leads_crm_auth_insert on public.hub_leads_crm
  for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id());

create policy hub_leads_crm_auth_update on public.hub_leads_crm
  for update to authenticated
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());
-- DELETE: sem policy p/ authenticated → só service_role (admin via server) apaga.

-- (2) >>> VALIDAR app logado + realtime + força bruta anon <<< e SÓ ENTÃO:
drop policy if exists "anon_select" on public.hub_leads_crm;
drop policy if exists "hub_acesso_total" on public.hub_leads_crm;

-- ============================ hub_pessoas ============================
create policy hub_pessoas_auth_select on public.hub_pessoas
  for select to authenticated
  using (tenant_id = public.current_user_tenant_id());

create policy hub_pessoas_auth_insert on public.hub_pessoas
  for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id());

create policy hub_pessoas_auth_update on public.hub_pessoas
  for update to authenticated
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

-- >>> VALIDAR <<< e então:
drop policy if exists "anon_select" on public.hub_pessoas;

-- ====================== hub_contas_receber (financeiro) ======================
-- Baseline tenant-scoped. NOTA: refinar p/ financeiro/gestor/owner depois
-- (rota financeira já é gated por papel no server; RLS aqui é defesa em profundidade).
create policy hub_contas_receber_auth_select on public.hub_contas_receber
  for select to authenticated
  using (tenant_id = public.current_user_tenant_id());

create policy hub_contas_receber_auth_write on public.hub_contas_receber
  for all to authenticated
  using (tenant_id = public.current_user_tenant_id())
  with check (tenant_id = public.current_user_tenant_id());

-- >>> VALIDAR <<< e então:
drop policy if exists "hub_contas_receber_service" on public.hub_contas_receber;

-- ============================================================================
-- ROLLBACK (se algo quebrar): recriar a policy permissiva dropada, ex.:
--   create policy "anon_select" on public.hub_leads_crm for select to anon, authenticated using (true);
-- (políticas são reversíveis; nenhum dado é apagado por este script.)
-- ============================================================================
