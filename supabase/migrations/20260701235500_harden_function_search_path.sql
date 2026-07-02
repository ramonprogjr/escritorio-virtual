-- ============================================================================
-- HARDENING: fixa o search_path de 35 funções (advisor "Function Search Path Mutable").
--
-- ✅ APLICADA 01/jul (noite) via Supabase MCP apply_migration (janela do dono, presente).
--    Verificado nos advisors: "Function Search Path Mutable" 35 → 2 (as 2 restantes são
--    funções da extensão pgvector, lang C — deixadas de propósito: não se altera função
--    de extensão). 0 ERROS antes e depois. Reversível: ALTER FUNCTION ... RESET search_path;
--
-- Por quê: função sem search_path fixo herda o do chamador → um objeto plantado
--   num schema no path poderia ser resolvido no lugar do esperado (injeção de
--   search_path). Fixar o path remove a mutabilidade (fecha os 35 WARN).
--
-- Pin escolhido: `pg_catalog, public, pg_temp`
--   - MANTÉM `public` resolvível — as funções referenciam tabelas public
--     (hub_log, hub_backups, geradores de código, triggers) INCLUSIVE via
--     `EXECUTE format('... FROM %I ...')` (hub_backup_automatico, hub_delete_seguro):
--     por isso NÃO se usa `''` (vazio) — quebraria o SQL dinâmico.
--   - `pg_temp` por ÚLTIMO evita que um objeto temporário sombreie os reais
--     (hardening extra p/ as SECURITY DEFINER).
--   - `pg_catalog` explícito (já é implícito, mas deixa o intent claro).
--
-- Revisado (corpo das 4 SECURITY DEFINER lido via MCP): todas só tocam public.* +
--   builtins → o pin não altera comportamento. Aditivo e reversível
--   (RESET: ALTER FUNCTION ... RESET search_path;).
-- ============================================================================

-- ── SECURITY DEFINER (prioritárias) ─────────────────────────────────────────
alter function public.hub_audit_trigger()                       set search_path = pg_catalog, public, pg_temp;
alter function public.hub_backup_automatico()                   set search_path = pg_catalog, public, pg_temp;
alter function public.hub_delete_seguro(text, uuid, text)       set search_path = pg_catalog, public, pg_temp;
alter function public.hub_is_service_role()                     set search_path = pg_catalog, public, pg_temp;

-- ── Triggers / helpers / geradores de código (SECURITY INVOKER) ─────────────
alter function public.block_unauthorized_delete()               set search_path = pg_catalog, public, pg_temp;
alter function public.default_obra10_tenant_id()                set search_path = pg_catalog, public, pg_temp;
alter function public.generate_architect_code()                 set search_path = pg_catalog, public, pg_temp;
alter function public.generate_broker_code()                    set search_path = pg_catalog, public, pg_temp;
alter function public.generate_client_code()                    set search_path = pg_catalog, public, pg_temp;
alter function public.generate_company_code()                   set search_path = pg_catalog, public, pg_temp;
alter function public.generate_contract_code()                  set search_path = pg_catalog, public, pg_temp;
alter function public.generate_deal_code()                      set search_path = pg_catalog, public, pg_temp;
alter function public.generate_lead_code()                      set search_path = pg_catalog, public, pg_temp;
alter function public.generate_product_code()                   set search_path = pg_catalog, public, pg_temp;
alter function public.generate_project_code()                   set search_path = pg_catalog, public, pg_temp;
alter function public.generate_property_code()                  set search_path = pg_catalog, public, pg_temp;
alter function public.generate_proposal_code()                  set search_path = pg_catalog, public, pg_temp;
alter function public.generate_real_estate_code()               set search_path = pg_catalog, public, pg_temp;
alter function public.generate_service_code()                   set search_path = pg_catalog, public, pg_temp;
alter function public.generate_supplier_code()                  set search_path = pg_catalog, public, pg_temp;
alter function public.generate_work_code()                      set search_path = pg_catalog, public, pg_temp;
alter function public.hub_agente_identidade_validar_cargo_catalogo() set search_path = pg_catalog, public, pg_temp;
alter function public.hub_agente_modelo_id_valido(text)         set search_path = pg_catalog, public, pg_temp;
alter function public.hub_arquivar_agente(text, text)           set search_path = pg_catalog, public, pg_temp;
alter function public.hub_atualizar_timestamp()                 set search_path = pg_catalog, public, pg_temp;
alter function public.hub_bloquear_alteracao_codigo_negocio()   set search_path = pg_catalog, public, pg_temp;
alter function public.hub_bloquear_alteracao_decision_logs()    set search_path = pg_catalog, public, pg_temp;
alter function public.hub_memorias_agente_set_updated_at()      set search_path = pg_catalog, public, pg_temp;
alter function public.hub_msg_jobs_set_updated_at()             set search_path = pg_catalog, public, pg_temp;
alter function public.hub_proteger_cargo_agente()               set search_path = pg_catalog, public, pg_temp;
alter function public.hub_validar_cargo_novo_agente()           set search_path = pg_catalog, public, pg_temp;
alter function public.match_hub_agente_rag_chunks(text, public.vector, integer, double precision) set search_path = pg_catalog, public, pg_temp;
alter function public.normalize_role(text)                      set search_path = pg_catalog, public, pg_temp;
alter function public.set_atualizado_em()                       set search_path = pg_catalog, public, pg_temp;
alter function public.set_updated_at()                          set search_path = pg_catalog, public, pg_temp;
