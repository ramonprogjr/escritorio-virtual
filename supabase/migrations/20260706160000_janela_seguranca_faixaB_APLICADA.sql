-- ════════════════════════════════════════════════════════════════════════════
-- JANELA DE SEGURANÇA — Faixa B  (APLICADO em 06/jul via Supabase MCP, com o dono)
--
-- Versiona o que foi APLICADO em produção (idempotente) para bancos reconstruídos
-- do zero. Baseado no security advisor REAL (158 avisos, ZERO ERRO — só WARN/INFO).
-- Roteiro completo e evidências: docs/JANELA-SEGURANCA-CHECKLIST.md.
--
-- APLICADO (verificado: 0/0/0):
--   A) 16 tabelas LEGADAS MORTAS (schema velho, 0 uso no código) → fail-closed.
--   B) 4 tabelas de briefing/config → remove policies de ESCRITA `authenticated`
--      (o app escreve via service_role).
--   C) 7 funções SECURITY DEFINER server-only/trigger → REVOKE EXECUTE de anon/public.
--   G) índice redundante idx_taxonomia_tenant (AUT-7) → DROP (UNIQUE já cobre).
--
-- NÃO aplicado de propósito:
--   • helpers de RLS (current_app_role/current_app_user_id/current_user_tenant_id/
--     is_hub_admin/hub_is_service_role) — usadas nas policies do módulo membros;
--     revogar quebraria acesso legítimo.
--   • D) buckets públicos com listagem (capas/maodeobra/playbook-media) — servem o
--     módulo membros; tratar à parte com verificação do consumidor.
--   • E) toggle HaveIBeenPwned (painel Auth) · F) secrets do Render (dev).
-- ════════════════════════════════════════════════════════════════════════════

-- ── A) 16 tabelas LEGADAS MORTAS → fail-closed (REVOKE + RLS + drop policies) ──
DO $$
DECLARE
  t text;
  p record;
  mortas text[] := ARRAY[
    'activity_logs','agents','crm_commissions','crm_deals','crm_operational_events',
    'crm_opportunities','crm_partner_matches','crm_partners','crm_persons','departments',
    'human_profiles','lead_contacts','leads','modules','settings','tasks'
  ];
BEGIN
  FOREACH t IN ARRAY mortas LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- ── B) 4 tabelas de briefing/config → remove escrita `authenticated` ──
DROP POLICY IF EXISTS hub_agente_conhecimento_auth_insert ON public.hub_agente_conhecimento;
DROP POLICY IF EXISTS hub_agente_conhecimento_auth_update ON public.hub_agente_conhecimento;
DROP POLICY IF EXISTS hub_autonomia_matriz_auth_insert    ON public.hub_autonomia_matriz;
DROP POLICY IF EXISTS hub_autonomia_matriz_auth_update    ON public.hub_autonomia_matriz;
DROP POLICY IF EXISTS hub_crm_briefing_msg_auth_insert    ON public.hub_crm_agente_briefing_mensagem;
DROP POLICY IF EXISTS hub_crm_briefing_msg_auth_update    ON public.hub_crm_agente_briefing_mensagem;
DROP POLICY IF EXISTS hub_crm_briefing_sessao_auth_insert ON public.hub_crm_agente_briefing_sessao;
DROP POLICY IF EXISTS hub_crm_briefing_sessao_auth_update ON public.hub_crm_agente_briefing_sessao;

-- ── C) 7 funções server-only/trigger → REVOKE EXECUTE de anon/public (tolerante) ──
DO $$
DECLARE
  fn text;
  funcs text[] := ARRAY[
    'public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text)',
    'public.crm_proximo_codigo(text, text, uuid)',
    'public.hub_msg_jobs_claim_batch(text, integer)',
    'public.hub_msg_jobs_try_lock_conversation(text)',
    'public.hub_msg_jobs_unlock_conversation(text)',
    'public.handle_new_auth_user()',
    'public.hub_audit_trigger()'
  ];
BEGIN
  FOREACH fn IN ARRAY funcs LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', fn);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'funcao ausente (rebuild): %', fn;
    END;
  END LOOP;
END $$;

-- ── G) AUT-7: índice redundante ──
DROP INDEX IF EXISTS public.idx_taxonomia_tenant;
