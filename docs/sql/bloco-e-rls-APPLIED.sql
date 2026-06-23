-- ============================================================================
-- Bloco E (lote crítico) — RLS APLICADO no banco VIVO (cdjlqsznerdhwqyunodl)
-- via Supabase MCP apply_migration, 2026-06-23. Provado com set role anon/authenticated.
-- Reverter com docs/sql/bloco-e-rls-ROLLBACK.sql. Nenhum dado foi apagado.
--
-- Difere do DRAFT original em 3 pontos descobertos no banco vivo:
--  1) public.users NÃO tem tenant_id (e é INTOCÁVEL por trava) → não há mapa user->tenant.
--     Como só existe 1 tenant, o helper retorna o tenant default Obra10+ (constante).
--     -> hoje isto é, na prática, "authenticated-only + filtro de tenant default", NÃO
--        isolamento cross-tenant real (os dados/usuários ainda não suportam isso).
--  2) hub_pessoas NÃO tinha tenant_id → coluna adicionada (aditiva) + backfill.
--  3) Predicado tolera linhas legadas com tenant_id NULL (or tenant_id is null) p/ não
--     sumir nada da app (espelha lib/tenant-default.ts tenantScopeOrFilter).
-- ============================================================================

-- migration: bloco_e_helper_and_pessoas_tenant_col
create or replace function public.current_user_tenant_id()
returns uuid language sql stable set search_path = public
as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;
-- (endurecido depois: SECURITY INVOKER + execute só authenticated/service_role)
revoke all on function public.current_user_tenant_id() from public, anon;
grant execute on function public.current_user_tenant_id() to authenticated, service_role;

alter table public.hub_pessoas add column if not exists tenant_id uuid;
update public.hub_pessoas p set tenant_id = coalesce(
  (select e.tenant_id from public.hub_empresas e where e.id = p.empresa_id),
  '00000000-0000-4000-8000-000000000001') where p.tenant_id is null;

-- Padrão por tabela: 3 policies authenticated (select/insert/update) tenant-scoped,
-- DELETE só service_role (server usa service key, bypassa RLS). Depois DROP das permissivas.

-- hub_leads_crm  (provado: anon 138->0, authenticated 138)
create policy hub_leads_crm_auth_select on public.hub_leads_crm for select to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_leads_crm_auth_insert on public.hub_leads_crm for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_leads_crm_auth_update on public.hub_leads_crm for update to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null)
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
drop policy if exists "anon_select" on public.hub_leads_crm;
drop policy if exists "hub_acesso_total" on public.hub_leads_crm;

-- hub_pessoas  (PII; provado: anon 5->0, authenticated 5)
create policy hub_pessoas_auth_select on public.hub_pessoas for select to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_pessoas_auth_insert on public.hub_pessoas for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_pessoas_auth_update on public.hub_pessoas for update to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null)
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
drop policy if exists "anon_select" on public.hub_pessoas;

-- hub_contas_receber + hub_contas_pagar  (financeiro; vazias hoje; anon agora default-deny)
create policy hub_contas_receber_auth_select on public.hub_contas_receber for select to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_contas_receber_auth_insert on public.hub_contas_receber for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_contas_receber_auth_update on public.hub_contas_receber for update to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null)
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
drop policy if exists "hub_contas_receber_service" on public.hub_contas_receber;

create policy hub_contas_pagar_auth_select on public.hub_contas_pagar for select to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_contas_pagar_auth_insert on public.hub_contas_pagar for insert to authenticated
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_contas_pagar_auth_update on public.hub_contas_pagar for update to authenticated
  using (tenant_id = public.current_user_tenant_id() or tenant_id is null)
  with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
drop policy if exists "hub_contas_pagar_service" on public.hub_contas_pagar;

-- ============================================================================
-- AINDA ABERTO (próximo lote do Bloco E) — pattern idêntico em ~36 tabelas hub_*:
--   anon_select (SELECT true {anon,authenticated}) e/ou hub_acesso_total/*_service/*_anon
--   (ALL true {public}). Inclui PII/negócio: hub_negocios, hub_oportunidades, hub_parceiros,
--   hub_mensagens, hub_conversas, hub_atividades, hub_memorias_lead, hub_notas, hub_propostas,
--   hub_servicos, hub_pipelines, hub_pipeline_estagios, hub_negocio_vinculos, etc.
--   Cada uma precisa: verificar coluna de tenant (várias não têm) antes de escopar.
-- ============================================================================
