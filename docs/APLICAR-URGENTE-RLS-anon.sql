-- ============================================================================
-- 🚨 URGENTE — fecha CRUD ANÔNIMO em hub_obras/projetos/tarefas/contatos + legadas
-- ----------------------------------------------------------------------------
-- ACHADO (Maratona 3, verificado ao vivo 02/jul): estas tabelas têm política RLS
-- FOR ALL para o papel {anon} + GRANT (DELETE/INSERT/UPDATE/TRUNCATE) — escopada a
-- (tenant NULL OR Obra10), que é o único tenant vivo. Ou seja: QUALQUER pessoa na
-- internet, com a NEXT_PUBLIC_SUPABASE_ANON_KEY (pública, no bundle), lê/edita/APAGA
-- todas as obras, projetos, tarefas e contatos — direto no PostgREST, sem login.
--
-- SEGURO: o app roda SEMPRE por service-role no servidor (bypassa RLS e grants), então
-- remover o acesso do anon NÃO quebra nada do app. Rode INTEIRO no SQL Editor.
-- (hub_pessoas/hub_empresas já estão endurecidas — não precisam.)
-- ============================================================================
BEGIN;

-- 1) Remove as políticas do papel anon (RLS passa a NEGAR anon por padrão)
DROP POLICY IF EXISTS hub_obras_anon                     ON public.hub_obras;
DROP POLICY IF EXISTS hub_projetos_anon                  ON public.hub_projetos;
DROP POLICY IF EXISTS hub_tarefas_comerciais_anon        ON public.hub_tarefas_comerciais;
DROP POLICY IF EXISTS hub_contatos_notificacao_anon_default ON public.hub_contatos_notificacao;

-- 2) Revoga os GRANTs do anon (defesa em profundidade)
REVOKE ALL ON public.hub_obras                FROM anon;
REVOKE ALL ON public.hub_projetos             FROM anon;
REVOKE ALL ON public.hub_tarefas_comerciais   FROM anon;
REVOKE ALL ON public.hub_contatos_notificacao FROM anon;

-- 3) Tabelas LEGADAS órfãs (schema inglês; só referenciadas por lib/supabase/queries.ts
--    que é código MORTO). Trava anon E authenticated — ninguém no app usa.
REVOKE ALL ON public.leads       FROM anon, authenticated;
REVOKE ALL ON public.crm_deals   FROM anon, authenticated;
REVOKE ALL ON public.crm_persons FROM anon, authenticated;

COMMIT;

-- Verificação (deve voltar VAZIO = nenhuma política anon nessas tabelas):
SELECT tablename, policyname, roles::text
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('hub_obras','hub_projetos','hub_tarefas_comerciais','hub_contatos_notificacao')
  AND 'anon' = ANY(roles);
