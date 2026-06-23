-- ============================================================================
-- ROLLBACK do Bloco E (lote crítico) — recria EXATAMENTE as policies removidas.
-- Snapshot tirado do banco VIVO (cdjlqsznerdhwqyunodl) em 2026-06-23 antes do apply.
-- Nenhum dado foi apagado pelo apply; este script reverte 100% o estado de RLS.
-- ============================================================================

-- hub_leads_crm — permissivas originais
create policy "anon_select" on public.hub_leads_crm
  for select to anon, authenticated using (true);
create policy "hub_acesso_total" on public.hub_leads_crm
  for all to public using (true);

-- hub_pessoas — permissiva original
create policy "anon_select" on public.hub_pessoas
  for select to anon, authenticated using (true);

-- hub_contas_receber — permissiva original
create policy "hub_contas_receber_service" on public.hub_contas_receber
  for all to public using (true) with check (true);

-- hub_contas_pagar — permissiva original
create policy "hub_contas_pagar_service" on public.hub_contas_pagar
  for all to public using (true) with check (true);

-- Remover o que o apply criou (policies novas + helper + coluna aditiva):
drop policy if exists hub_leads_crm_auth_select on public.hub_leads_crm;
drop policy if exists hub_leads_crm_auth_insert on public.hub_leads_crm;
drop policy if exists hub_leads_crm_auth_update on public.hub_leads_crm;
drop policy if exists hub_pessoas_auth_select on public.hub_pessoas;
drop policy if exists hub_pessoas_auth_insert on public.hub_pessoas;
drop policy if exists hub_pessoas_auth_update on public.hub_pessoas;
drop policy if exists hub_contas_receber_auth_select on public.hub_contas_receber;
drop policy if exists hub_contas_receber_auth_write on public.hub_contas_receber;
drop policy if exists hub_contas_pagar_auth_select on public.hub_contas_pagar;
drop policy if exists hub_contas_pagar_auth_write on public.hub_contas_pagar;

-- coluna aditiva em hub_pessoas (reverte exatamente o estado anterior: coluna não existia)
alter table public.hub_pessoas drop column if exists tenant_id;

drop function if exists public.current_user_tenant_id();
