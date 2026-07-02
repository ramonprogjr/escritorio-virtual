-- ############################################################################
-- TIER 0 — SCRIPT C: identidade global + contador por-tenant (a parte "de rede").
--   Contador por-tenant p/ DOCUMENTOS; GLOBAL (sentinela) p/ IDENTIDADE (pessoa/empresa/imóvel).
--   Prefixo MDO- p/ mão de obra. hub_identidade_acesso. users.pessoa_id. link com atribuição.
--
-- COMO RODAR: SQL Editor -> colar TUDO -> Run. BEGIN/COMMIT (atômico). Idempotente.
--   ORDEM: A (índices) -> B (schema) -> C (ESTE).
--
-- NÃO invasivo aqui: mantém os uniques GLOBAIS de documento existentes (negócios/leads/
--   parceiros) — inofensivos com 1 tenant. O SWAP p/ (tenant,codigo) fica p/ ANTES do 2º tenant
--   (com 1 escritório, contador global == por-tenant; nenhum código muda).
-- ############################################################################

BEGIN;

-- ═══ 1) CONTADOR POR-TENANT (identidade global via sentinela) ═══
ALTER TABLE public.hub_codigo_contador ADD COLUMN IF NOT EXISTS tenant_id uuid;
-- Backfill: identidade -> sentinela global; documento -> tenant default (preserva as sequências).
UPDATE public.hub_codigo_contador SET tenant_id =
  CASE WHEN entidade IN ('pessoa','empresa','imovel')
       THEN '00000000-0000-0000-0000-000000000000'::uuid
       ELSE '00000000-0000-4000-8000-000000000001'::uuid END
  WHERE tenant_id IS NULL;
ALTER TABLE public.hub_codigo_contador DROP CONSTRAINT IF EXISTS hub_codigo_contador_pkey;
ALTER TABLE public.hub_codigo_contador ADD CONSTRAINT hub_codigo_contador_pkey PRIMARY KEY (tenant_id, entidade, ano);

-- ═══ 2) crm_proximo_codigo — 3-arg (lógica real, tenant-aware) + wrapper 2-arg (compat app) ═══
CREATE OR REPLACE FUNCTION public.crm_proximo_codigo(p_entidade text, p_mercado text, p_tenant uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano int := extract(year from now())::int;
  v_seq int;
  v_prefixo text;
  v_ent text := lower(p_entidade);
  v_conta_tenant uuid;
BEGIN
  v_prefixo := case v_ent
    when 'pessoa' then 'PS' when 'empresa' then 'EM' when 'lead' then 'LD'
    when 'negocio' then 'NG' when 'parceiro' then 'PC' when 'fornecedor' then 'FR'
    when 'especialista' then 'MDO' when 'imovel' then 'IM' when 'obra' then 'OB'
    when 'projeto' then 'PJ' when 'servico' then 'SV' when 'produto' then 'PD'
    when 'proposta' then 'PP' when 'contrato' then 'CT' when 'comissao' then 'CM'
    when 'orcamento' then 'OR'
    when 'marcenaria' then 'MC' when 'marmoraria' then 'MM' when 'vidracaria' then 'VD'
    else 'XX' end;
  -- IDENTIDADE (pessoa/empresa/imóvel) = contador GLOBAL (sentinela); resto = POR-TENANT.
  IF v_ent IN ('pessoa','empresa','imovel') THEN
    v_conta_tenant := '00000000-0000-0000-0000-000000000000'::uuid;
  ELSE
    v_conta_tenant := coalesce(p_tenant, '00000000-0000-4000-8000-000000000001'::uuid);
  END IF;
  INSERT INTO public.hub_codigo_contador AS c (tenant_id, entidade, ano, ultimo)
    VALUES (v_conta_tenant, v_ent, v_ano, 1)
    ON CONFLICT (tenant_id, entidade, ano) DO UPDATE SET ultimo = c.ultimo + 1
    RETURNING c.ultimo INTO v_seq;
  RETURN v_prefixo
    || case when v_ent = 'negocio' and coalesce(p_mercado,'') <> '' then upper(p_mercado) else '' end
    || v_ano::text || lpad(v_seq::text, 3, '0');
END $$;

-- Wrapper 2-arg (assinatura que o app JÁ chama) → delega ao 3-arg com tenant default.
CREATE OR REPLACE FUNCTION public.crm_proximo_codigo(p_entidade text, p_mercado text DEFAULT NULL)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.crm_proximo_codigo(p_entidade, p_mercado, NULL::uuid);
$$;
GRANT EXECUTE ON FUNCTION public.crm_proximo_codigo(text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.crm_proximo_codigo(text, text) TO authenticated, service_role;

-- ═══ 3) Auto-código passa a levar o tenant (por-tenant real) + prefixo MDO já no gerador ═══
CREATE OR REPLACE FUNCTION public.hub_auto_codigo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.crm_proximo_codigo(TG_ARGV[0], NULL, NEW.tenant_id);
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.hub_auto_codigo_negocio() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.crm_proximo_codigo('negocio', NEW.mercado_slug, NEW.tenant_id);
  END IF;
  RETURN NEW;
END $$;
-- Proposta: agora que o branch PP existe, liga o auto-código.
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_propostas;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_propostas
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('proposta');

-- ═══ 4) hub_identidade_acesso — identidade GLOBAL (pessoa) ↔ tenant ↔ papel ═══
CREATE TABLE IF NOT EXISTS public.hub_identidade_acesso (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id   uuid NOT NULL REFERENCES public.hub_pessoas(id) ON DELETE CASCADE,   -- identidade global
  tenant_id   uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  papel       text NOT NULL,                     -- membro | fornecedor | cliente | parceiro | admin ...
  ativo       boolean NOT NULL DEFAULT true,
  valido_de   date NOT NULL DEFAULT current_date,
  valido_ate  date,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pessoa_id, tenant_id, papel)
);
CREATE INDEX IF NOT EXISTS idx_identidade_acesso_pessoa ON public.hub_identidade_acesso (pessoa_id);
CREATE INDEX IF NOT EXISTS idx_identidade_acesso_tenant ON public.hub_identidade_acesso (tenant_id);
ALTER TABLE public.hub_identidade_acesso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS identidade_acesso_rls ON public.hub_identidade_acesso;
CREATE POLICY identidade_acesso_rls ON public.hub_identidade_acesso FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id()) WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_identidade_acesso TO authenticated, service_role;
COMMENT ON TABLE public.hub_identidade_acesso IS
  'Identidade GLOBAL (hub_pessoas) ↔ tenant ↔ papel/acesso. Mesma pessoa = 1 identidade na rede; papéis por tenant. Vínculo temporal (valido_de/ate).';

-- ═══ 5) users.pessoa_id — login aponta pra identidade global (backfill manual: 1-2 users) ═══
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pessoa_id uuid REFERENCES public.hub_pessoas(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.users.pessoa_id IS
  'Identidade global (PES-) do usuário. Mesmo código do cadastro E do acesso. Backfill dos users atuais é manual (poucos).';

-- ═══ 6) hub_links_cadastro — atribuição na ORIGEM (o link carrega o código do gerador) ═══
-- (Fechar o SELECT anônimo + resolver token no servidor = commit de CÓDIGO, não este schema.)
ALTER TABLE public.hub_links_cadastro
  ADD COLUMN IF NOT EXISTS tenant_id      uuid,
  ADD COLUMN IF NOT EXISTS gerador_codigo text,
  ADD COLUMN IF NOT EXISTS gerador_tipo   text;   -- 'pessoa' | 'empresa'

COMMIT;

-- ═══ VERIFICAÇÃO (rode separado) ═══
-- 1) contador: SELECT tenant_id, entidade, ano, ultimo FROM public.hub_codigo_contador ORDER BY entidade;
-- 2) MDO: SELECT public.crm_proximo_codigo('especialista', NULL, '00000000-0000-4000-8000-000000000001');  -- MDO2026...
-- 3) identidade: SELECT to_regclass('public.hub_identidade_acesso');  -- não-nulo.
