-- ============================================================================
-- SEED CONSULADO V2 — ARQUIVO 1 de 4 : DDL (expande CHECK + escopa RLS)
-- ============================================================================
-- ORDEM: rode DEPOIS do Arquivo 0 (restore-point) e ANTES do Arquivo 2 (ecossistema).
-- Rodar como service_role, na janela do dono.
--
-- O QUE ESTE ARQUIVO FAZ
--   (a) hub_negocio_vinculos: amplia os 2 CHECK (entidade_tipo e papel) para
--       aceitar os papeis ricos do ecossistema Consulado (arquiteto,
--       engenharia_executora, executor_candidato, prestador, fornecedor,
--       cliente_representante) e a entidade 'servico'. E SUPERSET do CHECK atual,
--       entao nenhuma linha existente passa a violar.
--   (b) hub_servicos: hoje as policies de `authenticated` sao USING(true)/CHECK(true)
--       (vazam entre tenants). Troca por predicado tenant-scoped TOLERANTE a NULL,
--       usando a MESMA funcao que hub_negocios/hub_pessoas usam (current_user_tenant_id()).
--       As 8 linhas atuais de hub_servicos tem tenant_id=NULL, entao o "OR tenant_id
--       IS NULL" mantem elas visiveis (nao quebra o catalogo de servicos existente).
--
-- IDEMPOTENTE: DROP CONSTRAINT/POLICY IF EXISTS antes de recriar. Pode rodar 2x.
-- Envolvido em BEGIN/COMMIT (tudo ou nada).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- (a) EXPANDIR OS 2 CHECK DE hub_negocio_vinculos
-- ----------------------------------------------------------------------------
-- CHECK atual (confirmado):
--   entidade_tipo IN (pessoa, empresa, parceiro, lead)
--   papel         IN (cliente, contato_principal, lead_origem, empresa, parceiro,
--                     indicador, participante)

ALTER TABLE public.hub_negocio_vinculos
  DROP CONSTRAINT IF EXISTS hub_negocio_vinculos_entidade_tipo_check;
ALTER TABLE public.hub_negocio_vinculos
  ADD  CONSTRAINT hub_negocio_vinculos_entidade_tipo_check
  CHECK (entidade_tipo = ANY (ARRAY[
    'pessoa'::text, 'empresa'::text, 'parceiro'::text, 'lead'::text,
    'servico'::text
  ]));

ALTER TABLE public.hub_negocio_vinculos
  DROP CONSTRAINT IF EXISTS hub_negocio_vinculos_papel_check;
ALTER TABLE public.hub_negocio_vinculos
  ADD  CONSTRAINT hub_negocio_vinculos_papel_check
  CHECK (papel = ANY (ARRAY[
    'cliente'::text, 'contato_principal'::text, 'lead_origem'::text,
    'empresa'::text, 'parceiro'::text, 'indicador'::text, 'participante'::text,
    -- novos papeis ricos do ecossistema Consulado:
    'arquiteto'::text, 'engenharia_executora'::text, 'executor_candidato'::text,
    'prestador'::text, 'fornecedor'::text, 'cliente_representante'::text
  ]));

-- ----------------------------------------------------------------------------
-- (b) ESCOPAR A RLS DE hub_servicos (tenant-scoped, tolerante a NULL)
-- ----------------------------------------------------------------------------
-- Mesma forma das policies authenticated de hub_negocios/hub_pessoas:
--   (tenant_id = current_user_tenant_id() OR tenant_id IS NULL)
-- current_user_tenant_id(): SECURITY DEFINER, le users.tenant_id por auth.uid()
-- e cai no tenant Obra10 default. Confirmado em pg_policies/pg_get_functiondef.

DROP POLICY IF EXISTS hub_servicos_auth_select ON public.hub_servicos;
CREATE POLICY hub_servicos_auth_select ON public.hub_servicos
  FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_servicos_auth_insert ON public.hub_servicos;
CREATE POLICY hub_servicos_auth_insert ON public.hub_servicos
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id() OR tenant_id IS NULL);

DROP POLICY IF EXISTS hub_servicos_auth_update ON public.hub_servicos;
CREATE POLICY hub_servicos_auth_update ON public.hub_servicos
  FOR UPDATE TO authenticated
  USING      (tenant_id = current_user_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = current_user_tenant_id() OR tenant_id IS NULL);

COMMIT;

-- ----------------------------------------------------------------------------
-- CONFERENCIA (rode apos o COMMIT; leia o resultado)
-- ----------------------------------------------------------------------------
-- 1) CHECKs novos:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.hub_negocio_vinculos'::regclass AND contype='c';
-- 2) Policies novas de hub_servicos (nenhuma deve mais ser 'true'):
--   SELECT policyname, cmd, qual, with_check
--     FROM pg_policies WHERE schemaname='public' AND tablename='hub_servicos';
-- ============================================================================
