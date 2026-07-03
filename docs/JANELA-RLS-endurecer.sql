-- ============================================================================
-- JANELA DO DONO — ENDURECER RLS authenticated (resto da auditoria M3)
-- ============================================================================
-- Rode como service_role no SQL Editor. Complementa o APLICAR-URGENTE-RLS-anon.sql
-- (que já fechou o anon em hub_obras/projetos/tarefas/contatos).
--
-- CONTEXTO: a app roda por service_role (bypassa RLS). O papel `authenticated` é
-- alcançável pelo cliente do browser (JWT do usuário logado) — hoje 26 usuários
-- existem, e várias tabelas têm policy authenticated `USING(true)` (qualquer logado
-- lê/escreve tudo, cross-tenant). Este arquivo fecha o que é SEGURO agora.
--
-- SEGURO (não quebra o app): (A) o schema legado inglês é CÓDIGO MORTO (só o
-- lib/supabase/queries.ts, que ninguém importa) — revogar acesso não afeta nada;
-- (B) escopar SELECT por tenant só RESTRINGE linhas, não nega a tela.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- (A) SCHEMA LEGADO INGLÊS (órfão, com PII) — revoga anon E authenticated.
--     Não dropa as tabelas (dado preservado — princípio "nada se apaga"); só
--     tranca o acesso via PostgREST. Nenhuma rota viva usa (grep = 0 no app).
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.leads, public.crm_deals, public.crm_persons,
              public.crm_partners, public.crm_commissions, public.crm_opportunities,
              public.crm_partner_matches, public.crm_operational_events,
              public.human_profiles, public.lead_contacts, public.activity_logs,
              public.agents, public.departments, public.modules, public.settings,
              public.tasks
  FROM anon, authenticated;

-- ----------------------------------------------------------------------------
-- (B) TABELAS hub_* COM tenant_id + policy authenticated USING(true) → escopar.
--     (as únicas 2 do levantamento que TÊM tenant_id; usa a mesma função das
--      policies de hub_negocios/hub_pessoas, tolerante a NULL legado.)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS hub_aprovacoes_auth_select ON public.hub_aprovacoes;
CREATE POLICY hub_aprovacoes_auth_select ON public.hub_aprovacoes
  FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_decision_logs_auth_select ON public.hub_decision_logs;
CREATE POLICY hub_decision_logs_auth_select ON public.hub_decision_logs
  FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id() OR tenant_id IS NULL);

COMMIT;

-- ============================================================================
-- ⚠️ NÃO FEITO AQUI (precisa de MIGRAÇÃO — CEO prepara com cuidado + você revisa)
-- ============================================================================
-- Estas tabelas hub_* têm authenticated USING(true) MAS NÃO TÊM coluna tenant_id,
-- então NÃO dá pra escopar sem antes ADICIONAR tenant_id (schema change + backfill).
-- São de escrita/leitura sensível — priorizar:
--   ESCRITA por qualquer logado (mais grave): hub_agente_conhecimento (RAG),
--     hub_autonomia_matriz (limite de gasto/autonomia da IA),
--     hub_crm_agente_briefing_sessao, hub_crm_agente_briefing_mensagem.
--   LEITURA por qualquer logado: hub_alertas, hub_backups, hub_briefings,
--     hub_caderno, hub_campanhas, hub_ciclos_ia, hub_decisoes, hub_fluxos,
--     hub_hierarquia, hub_kpis_metas, hub_kpis_resultados, hub_log,
--     hub_metricas_trafego, hub_qualidade_agente, hub_scripts.
-- Plano: migração aditiva (ADD COLUMN tenant_id + backfill p/ Obra10) → então
--   trocar USING(true) por tenant-scoped. Alternativa p/ as sem dono-de-tenant
--   claro: restringir a is_hub_admin() em vez de authenticated.
-- Catálogos GLOBAIS (ok deixar SELECT p/ authenticated): hub_mercados,
--   hub_cargos_catalogo, hub_perfis_personalidade, hub_ia_precos.
--
-- ALÉM DISSO (repo↔live drift): criar uma MIGRAÇÃO FORWARD que codifique o estado
--   endurecido (as migrações do repo ainda recriam policies anon inseguras em
--   pessoas/empresas/pipelines — um `supabase db reset` nasceria vazando). É
--   idempotente/no-op no banco atual; protege ambientes novos.
--
-- E o BACKFILL do tenant NULL (UPDATE hub_* SET tenant_id=Obra10 WHERE NULL) →
--   só ENTÃO trocar tenantScopeOrFilter (is.null+default) por .eq puro no código.
-- ============================================================================
