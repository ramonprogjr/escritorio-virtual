-- ============================================================================
-- Bloco E STEP 2 — refinamento tenant (8 tabelas por-lead/negócio) APLICADO 2026-06-23.
-- Aplicado via execute_sql statement-a-statement (apply_migration caía no socket
-- instável do MCP). Provado: anon 0 / authenticated lê real (msg 15, ativ 214,
-- parc 2, conv 5). anon_or_public_open=0 mantido. Rollback: bloco-e-step2-tenant-ROLLBACK.sql.
--
-- NOTA: helper current_user_tenant_id() ainda retorna o tenant default (1 tenant).
-- Hoje o efeito é "authenticated + filtro default" — estrutura tenant pronta p/ futuro.
-- ============================================================================

-- 1) Coluna tenant_id (aditiva) nas 8 tabelas:
alter table public.hub_mensagens     add column if not exists tenant_id uuid;
alter table public.hub_conversas     add column if not exists tenant_id uuid;
alter table public.hub_oportunidades add column if not exists tenant_id uuid;
alter table public.hub_memorias_lead add column if not exists tenant_id uuid;
alter table public.hub_propostas     add column if not exists tenant_id uuid;
alter table public.hub_parceiros     add column if not exists tenant_id uuid;
alter table public.hub_atividades    add column if not exists tenant_id uuid;
alter table public.hub_notas         add column if not exists tenant_id uuid;

-- 2) Backfill DEFAULT (single-tenant). hub_conversas FOI PULADA: trigger
--    set_atualizado_em() referencia NEW.atualizado_em que não existe na tabela →
--    qualquer UPDATE em hub_conversas FALHA (bug PRÉ-EXISTENTE, ver STATUS). Como a
--    policy tolera tenant_id NULL, as linhas de conversas seguem visíveis sem backfill.
update public.hub_mensagens     set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_oportunidades set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_memorias_lead set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_propostas     set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_parceiros     set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_atividades    set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
update public.hub_notas         set tenant_id='00000000-0000-4000-8000-000000000001' where tenant_id is null;
-- (hub_conversas: tenant_id permanece NULL — tolerado pela policy)

-- 3) Policies tenant-scoped (ALTER POLICY, in-place; predicado tolera NULL legado):
--    SELECT-only: mensagens, conversas, oportunidades, parceiros
--    ALL (select+insert+update): memorias_lead, propostas, atividades, notas
-- (ver corpo exato no histórico; padrão = tenant_id = public.current_user_tenant_id() or tenant_id is null)
