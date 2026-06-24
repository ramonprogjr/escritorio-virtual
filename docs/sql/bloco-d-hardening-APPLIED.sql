-- ============================================================================
-- Bloco D (advisors) — HARDENING aplicado 2026-06-23 (via execute_sql, socket instável).
-- ============================================================================

-- P0 (CRÍTICO) — RPCs SECURITY DEFINER destrutivas executáveis por ANON.
-- Achado: `has_function_privilege('anon', fn, 'execute') = true` em funções de DELETE
-- SEM guarda de papel, que fazem `SET LOCAL app.delete_authorized=true` p/ furar o
-- trigger block_unauthorized_delete e DELETAM. ⇒ qualquer um com a anon key podia
-- `POST /rest/v1/rpc/hub_delete_pessoa_crm {p_id}` e apagar PII (e FKs em leads/negocios).
-- hub_delete_seguro(p_tabela,p_id,p_motivo) é DELETE genérico em QUALQUER tabela.
-- Fix: revoke execute de public/anon/authenticated; grant só service_role (server).
-- Provado: anon execute = false; service_role = true (server intacto).
revoke all on function public.hub_delete_pessoa_crm(p_id uuid)                       from public, anon, authenticated;
grant execute on function public.hub_delete_pessoa_crm(p_id uuid)                     to service_role;
revoke all on function public.hub_delete_empresa_crm(p_id uuid)                       from public, anon, authenticated;
grant execute on function public.hub_delete_empresa_crm(p_id uuid)                    to service_role;
revoke all on function public.hub_delete_seguro(p_tabela text, p_id uuid, p_motivo text) from public, anon, authenticated;
grant execute on function public.hub_delete_seguro(p_tabela text, p_id uuid, p_motivo text) to service_role;
revoke all on function public.hub_delete_agente_cascade(p_agente_slug text)          from public, anon, authenticated;
grant execute on function public.hub_delete_agente_cascade(p_agente_slug text)        to service_role;
revoke all on function public.hub_delete_ciclo_cascade(p_ciclo_id uuid)              from public, anon, authenticated;
grant execute on function public.hub_delete_ciclo_cascade(p_ciclo_id uuid)            to service_role;
revoke all on function public.hub_delete_cargo_catalogo(p_slug text)                 from public, anon, authenticated;
grant execute on function public.hub_delete_cargo_catalogo(p_slug text)              to service_role;
revoke all on function public.hub_backup_automatico()                                from public, anon, authenticated;
grant execute on function public.hub_backup_automatico()                             to service_role;
revoke all on function public.rls_auto_enable()                                      from public, anon, authenticated;
revoke all on function public.write_audit_log()                                      from public, anon, authenticated;

-- ERROR — view SECURITY DEFINER (bypassa RLS do chamador). Passa a respeitar RLS do caller.
alter view public.vw_hub_auditoria_ferramentas_agentes set (security_invoker = on);

-- ROLLBACK (não recomendado p/ os revokes — reabriria o P0):
--   grant execute on function ... to public;   -- (reabre anon)
--   alter view public.vw_hub_auditoria_ferramentas_agentes set (security_invoker = off);

-- ============================================================================
-- BACKLOG TRIADO (não-bloqueante; recomendações):
--  * function_search_path_mutable (38 funcs): hardening — ALTER FUNCTION ... SET search_path=public.
--    Baixo risco isolado; fazer em lote numa migration dedicada.
--  * extension_in_public (pg_net, vector): mover de schema é arriscado (deps) — avaliar depois.
--  * public_bucket_allows_listing (bucket `capas`, policy capas_pub_sel): permite LISTAR todos os
--    arquivos. URLs de objeto público não precisam de listagem → considerar dropar a policy de SELECT
--    ampla (verificar antes se algo lista o bucket).
--  * auth_leaked_password_protection: habilitar no painel Supabase (Auth) — checagem HaveIBeenPwned.
--  * anon-executable read helpers (is_hub_admin, current_app_role, current_app_user_id, hub_is_service_role):
--    baixo risco (retornam papel/bool com auth.uid()=null p/ anon) — revogar de anon por higiene depois.
-- ============================================================================
