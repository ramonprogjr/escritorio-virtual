-- RLS piloto multi-tenant (Documento Mestre / melhorias recomendadas).
-- Pré-requisito: 20260509120000_hub_ciclos_slugs_e_tenants.sql (colunas tenant_id preenchidas).
-- Service role do Supabase continua a ignorar RLS (uso nas rotas Next).

-- Helpers: claim JWT customizado "tenant_id" (UUID). Documentar no Supabase Auth > JWT template.
CREATE OR REPLACE FUNCTION public.app_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(
    trim(COALESCE(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')),
    ''
  )::uuid;
$$;

CREATE OR REPLACE FUNCTION public.default_obra10_tenant_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '00000000-0000-4000-8000-000000000001'::uuid;
$$;

GRANT EXECUTE ON FUNCTION public.app_tenant_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.default_obra10_tenant_id() TO anon, authenticated;

-- Catálogo de tenants: leitura pública mínima (slugs ativos)
ALTER TABLE hub_tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_tenants_select_authenticated ON hub_tenants;
DROP POLICY IF EXISTS hub_tenants_select_anon ON hub_tenants;
CREATE POLICY hub_tenants_select_anon ON hub_tenants
  FOR SELECT TO anon USING (ativo = true);
CREATE POLICY hub_tenants_select_authenticated ON hub_tenants
  FOR SELECT TO authenticated USING (ativo = true);

-- Tabelas com tenant_id: anon só vê/edita tenant Obra10 legado; authenticated só com claim tenant_id
ALTER TABLE hub_leads_crm ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_leads_crm_anon_default ON hub_leads_crm;
DROP POLICY IF EXISTS hub_leads_crm_auth_claim ON hub_leads_crm;
CREATE POLICY hub_leads_crm_anon_default ON hub_leads_crm
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_leads_crm_auth_claim ON hub_leads_crm
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_parceiros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_parceiros_anon_default ON hub_parceiros;
DROP POLICY IF EXISTS hub_parceiros_auth_claim ON hub_parceiros;
CREATE POLICY hub_parceiros_anon_default ON hub_parceiros
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_parceiros_auth_claim ON hub_parceiros
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_agente_identidade ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_agente_identidade_anon_default ON hub_agente_identidade;
DROP POLICY IF EXISTS hub_agente_identidade_auth_claim ON hub_agente_identidade;
CREATE POLICY hub_agente_identidade_anon_default ON hub_agente_identidade
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_agente_identidade_auth_claim ON hub_agente_identidade
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());

ALTER TABLE hub_fila_mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_fila_mensagens_anon_default ON hub_fila_mensagens;
DROP POLICY IF EXISTS hub_fila_mensagens_auth_claim ON hub_fila_mensagens;
CREATE POLICY hub_fila_mensagens_anon_default ON hub_fila_mensagens
  FOR ALL TO anon
  USING (tenant_id = default_obra10_tenant_id())
  WITH CHECK (tenant_id = default_obra10_tenant_id());
CREATE POLICY hub_fila_mensagens_auth_claim ON hub_fila_mensagens
  FOR ALL TO authenticated
  USING (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id())
  WITH CHECK (app_tenant_id() IS NOT NULL AND tenant_id = app_tenant_id());
