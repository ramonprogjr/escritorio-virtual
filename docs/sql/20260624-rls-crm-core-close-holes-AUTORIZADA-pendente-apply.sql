-- ============================================================================
-- Migração: rls_crm_core_close_holes  (Bloco 4 — fatia segura)
-- STATUS: AUTORIZADA, APPLY PENDENTE — Supabase MCP caiu por erro de socket (rede) ao
-- aplicar (24/jun). Idempotente: reaplicar quando o MCP voltar OU colar no SQL Editor do
-- Supabase; depois verificar policies. Mesa redonda arquitetura+segurança (architect-review).
-- ----------------------------------------------------------------------------
-- Objetivo: fechar buracos de RLS em tabelas CRM que têm RLS LIGADO mas ZERO
-- policies (deny-all p/ authenticated) + completar hub_negocios (faltavam
-- INSERT/UPDATE). Padrão tenant já validado: tenant_id = current_user_tenant_id()
-- OR tenant_id IS NULL.
--
-- Por que é ZERO-REGRESSÃO:
--  • A API usa service_role (crmDb()), que BYPASSA RLS — nada da API muda.
--  • É puramente ADITIVA/permissiva: LIBERA acesso `authenticated` onde antes
--    era deny-all; não restringe nada que já funcionava.
--  • Single-tenant hoje (current_user_tenant_id() = 1 tenant fixo) → o filtro
--    retorna todos os dados existentes.
--
-- NÃO INCLUI (deferido — maior blast radius): alterar is_hub_admin() (usado em
-- ~30 policies de schema paralelo) e o multi-tenant real (current_user_tenant_id
-- dinâmica, fornecedor_id, Hub vê tudo) = Bloco 5+.
-- Idempotente (DROP POLICY IF EXISTS antes de CREATE).
-- ============================================================================

-- 1. hub_negocios — faltavam INSERT e UPDATE (SELECT já existia)
drop policy if exists hub_negocios_auth_insert on public.hub_negocios;
create policy hub_negocios_auth_insert on public.hub_negocios
  for insert to authenticated
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_negocios_auth_update on public.hub_negocios;
create policy hub_negocios_auth_update on public.hub_negocios
  for update to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null))
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));

-- 2. hub_empresas — zero policies (deny-all). Completar SELECT/INSERT/UPDATE.
drop policy if exists hub_empresas_auth_select on public.hub_empresas;
create policy hub_empresas_auth_select on public.hub_empresas
  for select to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_empresas_auth_insert on public.hub_empresas;
create policy hub_empresas_auth_insert on public.hub_empresas
  for insert to authenticated
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_empresas_auth_update on public.hub_empresas;
create policy hub_empresas_auth_update on public.hub_empresas
  for update to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null))
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));

-- 3. hub_pessoas_empresas — zero policies
drop policy if exists hub_pessoas_empresas_auth_select on public.hub_pessoas_empresas;
create policy hub_pessoas_empresas_auth_select on public.hub_pessoas_empresas
  for select to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_pessoas_empresas_auth_insert on public.hub_pessoas_empresas;
create policy hub_pessoas_empresas_auth_insert on public.hub_pessoas_empresas
  for insert to authenticated
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_pessoas_empresas_auth_update on public.hub_pessoas_empresas;
create policy hub_pessoas_empresas_auth_update on public.hub_pessoas_empresas
  for update to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null))
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));

-- 4. hub_proximas_acoes — zero policies
drop policy if exists hub_proximas_acoes_auth_select on public.hub_proximas_acoes;
create policy hub_proximas_acoes_auth_select on public.hub_proximas_acoes
  for select to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_proximas_acoes_auth_insert on public.hub_proximas_acoes;
create policy hub_proximas_acoes_auth_insert on public.hub_proximas_acoes
  for insert to authenticated
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_proximas_acoes_auth_update on public.hub_proximas_acoes;
create policy hub_proximas_acoes_auth_update on public.hub_proximas_acoes
  for update to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null))
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));

-- 5. hub_leads — zero policies (≠ hub_leads_crm, que já tem)
drop policy if exists hub_leads_auth_select on public.hub_leads;
create policy hub_leads_auth_select on public.hub_leads
  for select to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_leads_auth_insert on public.hub_leads;
create policy hub_leads_auth_insert on public.hub_leads
  for insert to authenticated
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));
drop policy if exists hub_leads_auth_update on public.hub_leads;
create policy hub_leads_auth_update on public.hub_leads
  for update to authenticated
  using ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null))
  with check ((tenant_id = public.current_user_tenant_id()) or (tenant_id is null));

-- ============================================================================
-- ROLLBACK (rodar manualmente se necessário)
-- ----------------------------------------------------------------------------
-- drop policy if exists hub_negocios_auth_insert on public.hub_negocios;
-- drop policy if exists hub_negocios_auth_update on public.hub_negocios;
-- drop policy if exists hub_empresas_auth_select on public.hub_empresas;
-- drop policy if exists hub_empresas_auth_insert on public.hub_empresas;
-- drop policy if exists hub_empresas_auth_update on public.hub_empresas;
-- drop policy if exists hub_pessoas_empresas_auth_select on public.hub_pessoas_empresas;
-- drop policy if exists hub_pessoas_empresas_auth_insert on public.hub_pessoas_empresas;
-- drop policy if exists hub_pessoas_empresas_auth_update on public.hub_pessoas_empresas;
-- drop policy if exists hub_proximas_acoes_auth_select on public.hub_proximas_acoes;
-- drop policy if exists hub_proximas_acoes_auth_insert on public.hub_proximas_acoes;
-- drop policy if exists hub_proximas_acoes_auth_update on public.hub_proximas_acoes;
-- drop policy if exists hub_leads_auth_select on public.hub_leads;
-- drop policy if exists hub_leads_auth_insert on public.hub_leads;
-- drop policy if exists hub_leads_auth_update on public.hub_leads;
-- ============================================================================
