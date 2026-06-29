-- ============================================================================
-- E0 — ESPINHA Obra + EAP + Catálogo (BLOCO E0 do PLANO-BLOCOS-ARQ-ENG)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     Esta migração é ADITIVA, REVERSÍVEL e segue o padrão já usado no projeto
--     (DROP+ADD de CHECK como em 20260620180000; RLS current_user_tenant_id()
--     como em 20260626210000_ia_metering; código atômico por contador como em
--     20260704120000_crm_codigo_rastreio_rpc). Mas aplicar é decisão do dono.
--     Até aplicar, a UI degrada graciosamente (fallback in-code em
--     lib/obras/eap-presets.ts), nunca quebra.
--
-- O QUE ENTREGA (nível-1 da espinha):
--   1. ALTER hub_obras: tipo_obra, codigo_legivel, cliente_*, area, valor,
--      pipeline_id, estagio_slug + relax do status (com UPDATE legado ANTES do DROP).
--   2. hub_obra_frentes_eap: a árvore EAP (frentes por disciplina; ×andar fica p/ E2).
--   3. hub_catalogo: master dos dropdowns (15 disciplinas + ~20 áreas/andares).
--   4. hub_eap_presets: 3 presets globais (Reforma Padrão = planilha do Consulado).
--   5. ALTER hub_pipelines.tipo: + 'obra','projeto' + seed do pipeline-obra global.
--   6. gerar_codigo_obra(tenant, tipo): código ATÔMICO e POR TENANT
--      (corrige o vazamento cross-tenant do COUNT(*) global achado na auditoria).
--
-- situação/andamento NÃO entram aqui — vão para E2 (itens de contrato/Detalhamento).
--
-- ROLLBACK (resumo no fim do arquivo).
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; já existe em prod via 20260626130000) ──
-- Garante paridade em ambientes novos. NÃO recria se já existe com corpo dinâmico.
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO anon, authenticated;

-- ─── 1) ALTER hub_obras (aditivo) ─────────────────────────────────────────────
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS tipo_obra TEXT NOT NULL DEFAULT 'reforma';
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS codigo_legivel TEXT;            -- CON.2026.0001 / REF-2026-0004
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS cliente_pessoa_id UUID;         -- soft FK (sem hard FK, aditivo seguro)
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS cliente_empresa_id UUID;
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS area_total_m2 NUMERIC(10,2);
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS valor_contrato NUMERIC(14,2);
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS estagio_slug TEXT DEFAULT 'planejamento';

-- tipo_obra CHECK (aditivo; default 'reforma' já cobre linhas existentes)
ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_tipo_obra_check;
ALTER TABLE public.hub_obras ADD CONSTRAINT hub_obras_tipo_obra_check
  CHECK (tipo_obra IN ('construcao','reforma','servico','manutencao','consultoria','projeto','assistencia'));

-- Relax do status — AUDITORIA-FIX: o UPDATE de valor legado vem ANTES do DROP.
-- Sem ele, qualquer base com obras 'em_andamento' (CHECK atual) faz a migração FALHAR.
UPDATE public.hub_obras SET status = 'ativa'      WHERE status = 'em_andamento';
UPDATE public.hub_obras SET status = 'encerrada'  WHERE status = 'concluida';
ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_status_check;
ALTER TABLE public.hub_obras ADD CONSTRAINT hub_obras_status_check
  CHECK (status IN ('planejamento','mobilizacao','ativa','atencao','critica','pausada','encerrada','cancelada'));

-- Código legível único POR TENANT (guard de corrida; parcial p/ não bater em NULL).
CREATE UNIQUE INDEX IF NOT EXISTS hub_obras_codigo_tenant_unique
  ON public.hub_obras (tenant_id, codigo_legivel) WHERE codigo_legivel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hub_obras_tipo ON public.hub_obras (tenant_id, tipo_obra);

-- ─── 2) hub_obra_frentes_eap (NOVA) — a árvore EAP ────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_obra_frentes_eap (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE CASCADE, -- árvore (E2 usa ×andar)
  codigo          TEXT NOT NULL,          -- "CIVIL", "ELET" (imutável; único por obra)
  nome            TEXT NOT NULL,          -- "Elétrica" (renomeável)
  disciplina_slug TEXT,                   -- liga ao catálogo (desnormalizado p/ query rápida)
  area_label      TEXT,                   -- "Andar 8" (NULL no nascimento; E2 preenche)
  cor             TEXT,                   -- acento por disciplina (do catálogo)
  peso_fisico     NUMERIC(5,2) NOT NULL DEFAULT 0,   -- opcional em E0; trava 100% só em E4
  peso_financeiro NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,     -- toggle = oculta, NÃO deleta
  ordem           INTEGER NOT NULL DEFAULT 0,
  origem          TEXT NOT NULL DEFAULT 'preset' CHECK (origem IN ('preset','manual','ia','aditivo')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, codigo)
);
CREATE INDEX IF NOT EXISTS idx_hub_obra_frentes_eap_obra
  ON public.hub_obra_frentes_eap (obra_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_hub_obra_frentes_eap_tenant
  ON public.hub_obra_frentes_eap (tenant_id);

DROP TRIGGER IF EXISTS hub_obra_frentes_eap_ts ON public.hub_obra_frentes_eap;
CREATE TRIGGER hub_obra_frentes_eap_ts BEFORE UPDATE ON public.hub_obra_frentes_eap
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

-- ─── 3) hub_catalogo (NOVA) — master de dropdowns (tenant_id NULL = global) ────
CREATE TABLE IF NOT EXISTS public.hub_catalogo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,  -- NULL = global
  categoria       TEXT NOT NULL CHECK (categoria IN
                    ('disciplina','material','servico','equipamento','mao_de_obra','area_andar')),
  codigo          TEXT NOT NULL,
  descricao       TEXT NOT NULL,
  unidade         TEXT,
  grupo           TEXT,
  disciplina_slug TEXT,
  cor             TEXT,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- unicidade por (tenant ou global) + categoria + código
CREATE UNIQUE INDEX IF NOT EXISTS hub_catalogo_codigo_uniq
  ON public.hub_catalogo
     (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), categoria, codigo);
CREATE INDEX IF NOT EXISTS idx_hub_catalogo_categoria
  ON public.hub_catalogo (categoria, ativo, ordem);

-- ─── 4) hub_eap_presets (NOVA) — templates globais (espelho de hub_pipelines) ──
CREATE TABLE IF NOT EXISTS public.hub_eap_presets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,  -- NULL = global
  tipo_obra     TEXT NOT NULL,
  slug          TEXT NOT NULL,
  nome          TEXT NOT NULL,
  sistema       BOOLEAN NOT NULL DEFAULT false,
  ordem         INTEGER NOT NULL DEFAULT 0,
  frentes_json  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{disciplina_slug,nome,peso_fisico,peso_financeiro}]
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_eap_presets_slug_uniq
  ON public.hub_eap_presets
     (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug);

-- ─── 5) hub_pipelines.tipo — ALTER CHECK aditivo (+ obra,projeto) ──────────────
-- Mesmo DROP+ADD de 20260620180000; nenhuma linha existente usa 'obra'/'projeto'.
ALTER TABLE public.hub_pipelines DROP CONSTRAINT IF EXISTS hub_pipelines_tipo_check;
ALTER TABLE public.hub_pipelines ADD CONSTRAINT hub_pipelines_tipo_check
  CHECK (tipo IN ('lead','negocio','obra','projeto'));

-- Seed do pipeline-obra global (estágios = os 8 status da obra).
-- AUDITORIA-NOTA: hub_pipelines.tenant_id é NULLABLE (ver 20260620180000: coluna sem NOT NULL,
-- e o índice único usa COALESCE(tenant_id, zero-uuid)). O INSERT omite tenant_id de propósito
-- → entra como NULL = pipeline GLOBAL, exatamente como os pipelines lead/negócio de sistema.
-- Não falha silenciosamente: o NULL é intencional e suportado pelo schema.
INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'obras-global', 'Obras — Pipeline global', 'obra', NULL, 2
WHERE NOT EXISTS (SELECT 1 FROM public.hub_pipelines WHERE slug = 'obras-global' AND tenant_id IS NULL);

DO $$
DECLARE pid_obra UUID;
BEGIN
  SELECT id INTO pid_obra FROM public.hub_pipelines WHERE slug = 'obras-global' AND tenant_id IS NULL LIMIT 1;
  IF pid_obra IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_obra, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('planejamento', 'Planejamento', '#6B7280', 0, 'aberto'),
      ('mobilizacao',  'Mobilização',  '#3B82F6', 1, 'aberto'),
      ('ativa',        'Em obra',      '#C9A24A', 2, 'aberto'),
      ('atencao',      'Atenção',      '#F59E0B', 3, 'aberto'),
      ('critica',      'Crítica',      '#EF4444', 4, 'aberto'),
      ('pausada',      'Pausada',      '#9CA3AF', 5, 'aberto'),
      ('encerrada',    '✓ Encerrada',  '#22C55E', 6, 'ganho'),
      ('cancelada',    '✗ Cancelada',  '#6E7781', 7, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;
  END IF;
END $$;

-- ─── 6) gerar_codigo_obra(tenant, tipo) — código ATÔMICO e POR TENANT ──────────
-- AUDITORIA-FIX (P0): o gerador antigo usava COUNT(*) GLOBAL (sem .eq tenant_id),
-- vazando contagem entre empresas. Aqui o contador é (tenant_id, tipo, ano) → cada
-- tenant tem sua própria sequência; on conflict do update = atômico (sem corrida).
CREATE TABLE IF NOT EXISTS public.hub_obra_codigo_contador (
  tenant_id UUID NOT NULL,
  tipo      TEXT NOT NULL,
  ano       INT  NOT NULL,
  ultimo    INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, tipo, ano)
);
ALTER TABLE public.hub_obra_codigo_contador ENABLE ROW LEVEL SECURITY;  -- só a função (definer) escreve

CREATE OR REPLACE FUNCTION public.gerar_codigo_obra(p_tenant uuid, p_tipo text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano int := extract(year from now())::int;
  v_seq int;
  v_prefixo text;
  v_tenant uuid := coalesce(p_tenant, '00000000-0000-4000-8000-000000000001'::uuid);
  v_tipo text := lower(coalesce(p_tipo, 'reforma'));
BEGIN
  v_prefixo := case v_tipo
    when 'construcao'  then 'CON'
    when 'reforma'     then 'REF'
    when 'servico'     then 'SRV'
    when 'manutencao'  then 'MAN'
    when 'consultoria' then 'CSL'
    when 'projeto'     then 'PRJ'
    when 'assistencia' then 'AST'
    else 'OBR' end;
  INSERT INTO public.hub_obra_codigo_contador AS c (tenant_id, tipo, ano, ultimo)
    VALUES (v_tenant, v_tipo, v_ano, 1)
    ON CONFLICT (tenant_id, tipo, ano) DO UPDATE SET ultimo = c.ultimo + 1  -- atômico
    RETURNING c.ultimo INTO v_seq;
  RETURN v_prefixo || '-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.gerar_codigo_obra(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_obra(uuid, text) TO authenticated, service_role;

-- ─── 7) Seeds globais — Catálogo (15 disciplinas + áreas/andares) ──────────────
INSERT INTO public.hub_catalogo (tenant_id, categoria, codigo, descricao, disciplina_slug, cor, ordem)
SELECT NULL, 'disciplina', v.codigo, v.descricao, v.slug, v.cor, v.ordem
FROM (VALUES
  ('PRELIM', 'Preliminares',       'preliminares',      '#9CA3AF',  0),
  ('CIVIL',  'Civil',              'civil',             '#C9A24A',  1),
  ('DEMOL',  'Demolições',         'demolicoes',        '#B45309',  2),
  ('REVEST', 'Revestimento',       'revestimento',      '#D6A129',  3),
  ('PINT',   'Pintura',            'pintura',           '#22C55E',  4),
  ('ELET',   'Elétrica',           'eletrica',          '#EAB308',  5),
  ('HIDR',   'Hidráulica',         'hidraulica',        '#3B82F6',  6),
  ('INST',   'Instalações',        'instalacoes',       '#06B6D4',  7),
  ('ESQUA',  'Esquadrias',         'esquadrias',        '#8B5CF6',  8),
  ('SERR',   'Serralheria',        'serralheria',       '#6B7280',  9),
  ('FORRO',  'Forro',              'forro',             '#A855F7', 10),
  ('CLIMA',  'Climatização',       'climatizacao',      '#0EA5E9', 11),
  ('IMPER',  'Impermeabilização',  'impermeabilizacao', '#0891B2', 12),
  ('ELEV',   'Elevadores',         'elevadores',        '#F97316', 13),
  ('LIMP',   'Limpeza',            'limpeza',           '#10B981', 14)
) AS v(codigo, descricao, slug, cor, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_catalogo c
  WHERE c.tenant_id IS NULL AND c.categoria = 'disciplina' AND c.codigo = v.codigo
);

INSERT INTO public.hub_catalogo (tenant_id, categoria, codigo, descricao, ordem)
SELECT NULL, 'area_andar', v.codigo, v.descricao, v.ordem
FROM (VALUES
  ('SUBSOLO',  'Subsolo',        0),
  ('TERREO',   'Térreo',         1),
  ('ANDAR8',   'Andar 8',        2),
  ('ANDAR9',   'Andar 9',        3),
  ('ROOFTOP',  'Roof Top',       4),
  ('HALLS',    'Halls',          5),
  ('ELEVADORES','Elevadores',    6),
  ('FACHADA',  'Fachada',        7),
  ('AREA_EXT', 'Área externa',   8),
  ('AREA_COM', 'Área comum',     9)
) AS v(codigo, descricao, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_catalogo c
  WHERE c.tenant_id IS NULL AND c.categoria = 'area_andar' AND c.codigo = v.codigo
);

-- ─── 8) Seeds globais — 3 presets de EAP ──────────────────────────────────────
-- "Reforma Padrão" = IDÊNTICO à planilha do Consulado (15 disciplinas reais).
INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, frentes_json)
SELECT NULL, 'reforma', 'reforma-padrao', 'Reforma Padrão', true, 0, $json$[
  {"disciplina_slug":"preliminares","nome":"Preliminares","peso_fisico":5,"peso_financeiro":3},
  {"disciplina_slug":"demolicoes","nome":"Demolições","peso_fisico":6,"peso_financeiro":4},
  {"disciplina_slug":"civil","nome":"Civil","peso_fisico":14,"peso_financeiro":16},
  {"disciplina_slug":"hidraulica","nome":"Hidráulica","peso_fisico":8,"peso_financeiro":9},
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":9,"peso_financeiro":11},
  {"disciplina_slug":"instalacoes","nome":"Instalações","peso_fisico":6,"peso_financeiro":7},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":10,"peso_financeiro":11},
  {"disciplina_slug":"impermeabilizacao","nome":"Impermeabilização","peso_fisico":4,"peso_financeiro":4},
  {"disciplina_slug":"forro","nome":"Forro","peso_fisico":5,"peso_financeiro":5},
  {"disciplina_slug":"esquadrias","nome":"Esquadrias","peso_fisico":6,"peso_financeiro":7},
  {"disciplina_slug":"serralheria","nome":"Serralheria","peso_fisico":4,"peso_financeiro":4},
  {"disciplina_slug":"climatizacao","nome":"Climatização","peso_fisico":5,"peso_financeiro":4},
  {"disciplina_slug":"pintura","nome":"Pintura","peso_fisico":8,"peso_financeiro":3},
  {"disciplina_slug":"elevadores","nome":"Elevadores","peso_fisico":2,"peso_financeiro":1},
  {"disciplina_slug":"limpeza","nome":"Limpeza","peso_fisico":3,"peso_financeiro":0}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'reforma-padrao');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, frentes_json)
SELECT NULL, 'construcao', 'construcao-residencial', 'Construção Residencial', true, 1, $json$[
  {"disciplina_slug":"preliminares","nome":"Preliminares e canteiro","peso_fisico":4,"peso_financeiro":3},
  {"disciplina_slug":"civil","nome":"Fundação e estrutura","peso_fisico":20,"peso_financeiro":24},
  {"disciplina_slug":"civil","nome":"Alvenaria","peso_fisico":10,"peso_financeiro":9},
  {"disciplina_slug":"hidraulica","nome":"Hidráulica","peso_fisico":8,"peso_financeiro":8},
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":8,"peso_financeiro":9},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":10,"peso_financeiro":10},
  {"disciplina_slug":"impermeabilizacao","nome":"Impermeabilização","peso_fisico":4,"peso_financeiro":4},
  {"disciplina_slug":"forro","nome":"Forro e gesso","peso_fisico":5,"peso_financeiro":5},
  {"disciplina_slug":"esquadrias","nome":"Esquadrias","peso_fisico":7,"peso_financeiro":8},
  {"disciplina_slug":"climatizacao","nome":"Climatização","peso_fisico":4,"peso_financeiro":4},
  {"disciplina_slug":"pintura","nome":"Pintura","peso_fisico":7,"peso_financeiro":3},
  {"disciplina_slug":"limpeza","nome":"Limpeza final","peso_fisico":3,"peso_financeiro":1}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'construcao-residencial');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, frentes_json)
SELECT NULL, 'servico', 'servico-pontual', 'Serviço Pontual', true, 2, $json$[
  {"disciplina_slug":"preliminares","nome":"Preparação","peso_fisico":20,"peso_financeiro":15},
  {"disciplina_slug":"civil","nome":"Execução","peso_fisico":60,"peso_financeiro":70},
  {"disciplina_slug":"limpeza","nome":"Limpeza e entrega","peso_fisico":20,"peso_financeiro":15}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'servico-pontual');

-- ─── 9) RLS — mesmo padrão das ~36 tabelas (tenant null = global; service_role bypassa) ──
ALTER TABLE public.hub_obra_frentes_eap ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_catalogo         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_eap_presets      ENABLE ROW LEVEL SECURITY;

-- Frentes EAP: ler/escrever SÓ o próprio tenant.
-- AUDITORIA-FIX: frentes nunca são globais (tenant_id é NOT NULL nesta tabela), então
-- NÃO incluímos `OR tenant_id IS NULL` — isso só abriria uma janela de vazamento sem uso real.
DROP POLICY IF EXISTS hub_obra_frentes_eap_rls ON public.hub_obra_frentes_eap;
CREATE POLICY hub_obra_frentes_eap_rls ON public.hub_obra_frentes_eap FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());

-- Catálogo: ler global+tenant; escrever só o próprio tenant (ninguém edita o global pelo app).
DROP POLICY IF EXISTS hub_catalogo_sel ON public.hub_catalogo;
CREATE POLICY hub_catalogo_sel ON public.hub_catalogo FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_catalogo_ins ON public.hub_catalogo;
CREATE POLICY hub_catalogo_ins ON public.hub_catalogo FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_catalogo_upd ON public.hub_catalogo;
CREATE POLICY hub_catalogo_upd ON public.hub_catalogo FOR UPDATE TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());

-- Presets: ler global+tenant; escrever só o próprio tenant.
DROP POLICY IF EXISTS hub_eap_presets_sel ON public.hub_eap_presets;
CREATE POLICY hub_eap_presets_sel ON public.hub_eap_presets FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_eap_presets_ins ON public.hub_eap_presets;
CREATE POLICY hub_eap_presets_ins ON public.hub_eap_presets FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_eap_presets_upd ON public.hub_eap_presets;
CREATE POLICY hub_eap_presets_upd ON public.hub_eap_presets FOR UPDATE TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_frentes_eap TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_catalogo         TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_eap_presets      TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_frentes_eap IS 'EAP da obra: frentes por disciplina (nível-1). ×andar e itens de contrato entram em E2. ativo=false oculta, não deleta.';
COMMENT ON TABLE public.hub_catalogo IS 'Master de dropdowns (Click-and-Go): disciplinas, áreas/andares, materiais. tenant_id NULL = global.';
COMMENT ON TABLE public.hub_eap_presets IS 'Templates de EAP por tipo de obra. Reforma Padrão = planilha do Consulado. tenant_id NULL = global.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.gerar_codigo_obra(uuid, text);
--   DROP TABLE IF EXISTS public.hub_obra_codigo_contador;
--   DROP TABLE IF EXISTS public.hub_obra_frentes_eap;
--   DROP TABLE IF EXISTS public.hub_eap_presets;
--   DROP TABLE IF EXISTS public.hub_catalogo;
--   DELETE FROM public.hub_pipeline_estagios WHERE pipeline_id IN
--     (SELECT id FROM public.hub_pipelines WHERE slug='obras-global' AND tenant_id IS NULL);
--   DELETE FROM public.hub_pipelines WHERE slug='obras-global' AND tenant_id IS NULL;
--   ALTER TABLE public.hub_pipelines DROP CONSTRAINT IF EXISTS hub_pipelines_tipo_check;
--   ALTER TABLE public.hub_pipelines ADD CONSTRAINT hub_pipelines_tipo_check CHECK (tipo IN ('lead','negocio'));
--   ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_tipo_obra_check;
--   ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS tipo_obra, ... (demais colunas aditivas).
--   (o status volta a 'em_andamento'/'concluida' SÓ se quiser — o relax é compatível pra cima.)
-- ============================================================================
