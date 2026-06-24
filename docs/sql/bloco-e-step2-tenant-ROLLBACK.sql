-- ============================================================================
-- ROLLBACK do Bloco E — STEP 2 (refinamento tenant das 8 tabelas por-lead/negócio).
-- Reverte para authenticated-only (using true) e remove as colunas tenant_id aditivas.
-- NÃO reabre anon (as policies continuam só p/ authenticated). Nenhum dado apagado.
-- Aplicado via execute_sql (não apply_migration) por instabilidade do socket MCP.
-- ============================================================================

-- 1) Policies de volta a authenticated-only (using true / with check true):
alter policy hub_mensagens_auth_select     on public.hub_mensagens     using (true);
alter policy hub_conversas_auth_select     on public.hub_conversas     using (true);
alter policy hub_oportunidades_auth_select on public.hub_oportunidades using (true);
alter policy hub_parceiros_auth_select     on public.hub_parceiros     using (true);

alter policy hub_memorias_lead_auth_select on public.hub_memorias_lead using (true);
alter policy hub_memorias_lead_auth_insert on public.hub_memorias_lead with check (true);
alter policy hub_memorias_lead_auth_update on public.hub_memorias_lead using (true) with check (true);

alter policy hub_propostas_auth_select on public.hub_propostas using (true);
alter policy hub_propostas_auth_insert on public.hub_propostas with check (true);
alter policy hub_propostas_auth_update on public.hub_propostas using (true) with check (true);

alter policy hub_atividades_auth_select on public.hub_atividades using (true);
alter policy hub_atividades_auth_insert on public.hub_atividades with check (true);
alter policy hub_atividades_auth_update on public.hub_atividades using (true) with check (true);

alter policy hub_notas_auth_select on public.hub_notas using (true);
alter policy hub_notas_auth_insert on public.hub_notas with check (true);
alter policy hub_notas_auth_update on public.hub_notas using (true) with check (true);

-- 2) Remover as colunas aditivas (reverte ao estado anterior: não existiam):
alter table public.hub_mensagens     drop column if exists tenant_id;
alter table public.hub_conversas     drop column if exists tenant_id;
alter table public.hub_oportunidades drop column if exists tenant_id;
alter table public.hub_memorias_lead drop column if exists tenant_id;
alter table public.hub_propostas     drop column if exists tenant_id;
alter table public.hub_parceiros     drop column if exists tenant_id;
alter table public.hub_atividades    drop column if exists tenant_id;
alter table public.hub_notas         drop column if exists tenant_id;
