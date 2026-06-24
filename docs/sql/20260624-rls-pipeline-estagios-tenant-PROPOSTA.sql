-- ============================================================================
-- PROPOSTA (NÃO APLICADA) — Tenant-aware RLS em hub_pipeline_estagios
-- ----------------------------------------------------------------------------
-- Contexto (auditado 2026-06-24 via MCP):
--   • RLS já está LIGADO em hub_pipelines e hub_pipeline_estagios.
--   • NÃO há policy para `anon` -> acesso anônimo já bloqueado (o "anon-open" era falso).
--   • hub_pipelines: policies select/insert/update já tenant-scoped (correto).
--   • hub_pipeline_estagios: policies para `authenticated` usam qual = TRUE (NÃO filtram
--     tenant) -> um usuário autenticado de um tenant pode ler/editar etapas de OUTRO tenant.
--     ESTE é o único gap. Estágios não têm tenant_id próprio -> escopo via pipeline-pai.
--
-- Segurança da mudança:
--   • A API/Kanban usam crmDb() = SERVICE ROLE, que BYPASSA RLS -> NÃO são afetados.
--   • Esta migração só restringe acesso direto de clientes `authenticated` (JWT) ao que
--     pertence ao tenant do usuário. Aditiva e REVERSÍVEL (rollback ao fim).
--   • DELETE continua sem policy (mais restritivo; API usa service role).
-- ============================================================================

alter table public.hub_pipeline_estagios enable row level security; -- idempotente (já on)

drop policy if exists hub_pipeline_estagios_auth_select on public.hub_pipeline_estagios;
drop policy if exists hub_pipeline_estagios_auth_insert on public.hub_pipeline_estagios;
drop policy if exists hub_pipeline_estagios_auth_update on public.hub_pipeline_estagios;

create policy hub_pipeline_estagios_auth_select on public.hub_pipeline_estagios
  for select to authenticated
  using (
    exists (
      select 1 from public.hub_pipelines p
      where p.id = hub_pipeline_estagios.pipeline_id
        and (p.tenant_id = public.current_user_tenant_id() or p.tenant_id is null)
    )
  );

create policy hub_pipeline_estagios_auth_insert on public.hub_pipeline_estagios
  for insert to authenticated
  with check (
    exists (
      select 1 from public.hub_pipelines p
      where p.id = hub_pipeline_estagios.pipeline_id
        and (p.tenant_id = public.current_user_tenant_id() or p.tenant_id is null)
    )
  );

create policy hub_pipeline_estagios_auth_update on public.hub_pipeline_estagios
  for update to authenticated
  using (
    exists (
      select 1 from public.hub_pipelines p
      where p.id = hub_pipeline_estagios.pipeline_id
        and (p.tenant_id = public.current_user_tenant_id() or p.tenant_id is null)
    )
  )
  with check (
    exists (
      select 1 from public.hub_pipelines p
      where p.id = hub_pipeline_estagios.pipeline_id
        and (p.tenant_id = public.current_user_tenant_id() or p.tenant_id is null)
    )
  );

-- ============================================================================
-- ROLLBACK (reverte ao estado anterior: authenticated com qual = TRUE)
-- ----------------------------------------------------------------------------
-- drop policy if exists hub_pipeline_estagios_auth_select on public.hub_pipeline_estagios;
-- drop policy if exists hub_pipeline_estagios_auth_insert on public.hub_pipeline_estagios;
-- drop policy if exists hub_pipeline_estagios_auth_update on public.hub_pipeline_estagios;
-- create policy hub_pipeline_estagios_auth_select on public.hub_pipeline_estagios
--   for select to authenticated using (true);
-- create policy hub_pipeline_estagios_auth_insert on public.hub_pipeline_estagios
--   for insert to authenticated with check (true);
-- create policy hub_pipeline_estagios_auth_update on public.hub_pipeline_estagios
--   for update to authenticated using (true) with check (true);
-- ============================================================================
