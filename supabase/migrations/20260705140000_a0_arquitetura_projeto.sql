-- ============================================================================
-- A0 — Funil de PROJETO (Arquitetura) — BLOCO A0 do PLANO-BLOCOS-ARQ-ENG
--
-- ⚠️  NÃO aplicar — janela do dono.
--     Migração ADITIVA, idempotente e REVERSÍVEL. Segue o padrão já usado no
--     projeto (DROP+ADD de CHECK com UPDATE de legado ANTES do DROP, como em
--     20260705130000_e0; RLS via current_user_tenant_id(); código por tenant via
--     RPC, como gerar_codigo_obra). Aplicar é decisão do dono (rodar com backup —
--     o DROP CONSTRAINT de hub_projetos.status + UPDATE de legado é irreversível-parcial).
--     Até aplicar, a UI degrada graciosamente (fallback in-code em
--     lib/crm/projeto-funil-defaults.ts), nunca quebra.
--
-- DISJUNTO de E0: NÃO toca hub_obras, hub_obra_frentes_eap, hub_catalogo,
--   hub_eap_presets. E0 (20260705130000) JÁ estendeu hub_pipelines.tipo para
--   incluir 'obra','projeto' — A0 REUSA esse CHECK e NÃO o re-altera (re-impor o
--   CHECK aqui derrubaria 'obra' se A0 rodasse depois de E0).
--
-- O QUE ENTREGA:
--   1. Relax do status de hub_projetos (com UPDATE de legado ANTES do DROP).
--   2. Colunas aditivas em hub_projetos (estagio, pipeline_id, cliente_*, etc.).
--   3. hub_projetos_fases vira o "Programa" (coluna tipo: 'fase' | 'comodo').
--   4. RPC gerar_codigo_projeto(tenant) — código PRJ-AAAA-NNNN POR TENANT
--      (corrige o vazamento cross-tenant do COUNT(*) global em /api/crm/projetos).
--   5. Seed do pipeline global 'projetos-arq' (7 estágios), idempotente.
--   6. Backfill pipeline_id/estagio dos projetos existentes (status→estagio).
--
-- ROLLBACK (resumo no fim do arquivo).
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; já existe via E0/20260626130000) ──
-- AUDITORIA-FIX: alinhado à canônica (20260626130000_multitenant_foundation) — NÃO enfraquecer
-- current_user_tenant_id(). Definição IDÊNTICA à canônica (SECURITY DEFINER + search_path +
-- COALESCE com fallback ao tenant default). A canônica (20260626) roda ANTES num apply limpo;
-- este CREATE OR REPLACE só garante paridade sem rebaixar a função à versão fraca.
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1),
    '00000000-0000-4000-8000-000000000001'::uuid
  )
$function$;
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO anon, authenticated;

-- ─── 1) Relax do status de hub_projetos (funil editável exige) ────────────────
-- AUDITORIA-FIX: o UPDATE de valor legado vem ANTES do DROP. Sem ele, qualquer
-- base com projetos 'desenvolvimento'/'aprovacao_cliente'/'concluido' (CHECK atual)
-- faz a migração FALHAR no novo CHECK. Mapeamento p/ os slugs do funil A0.
UPDATE public.hub_projetos SET status = 'estudo'     WHERE status = 'desenvolvimento';
UPDATE public.hub_projetos SET status = 'aprovacao'  WHERE status = 'aprovacao_cliente';
UPDATE public.hub_projetos SET status = 'entregue'   WHERE status = 'concluido';
ALTER TABLE public.hub_projetos DROP CONSTRAINT IF EXISTS hub_projetos_status_check;
-- Sem re-impor enum: status passa a espelhar estagio (igual hub_negocios.etapa).
-- O funil é editável; enum fixo mataria o "não-engessado".

-- ─── 2) Colunas aditivas em hub_projetos ──────────────────────────────────────
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS estagio            TEXT NOT NULL DEFAULT 'briefing';
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS pipeline_id        UUID REFERENCES public.hub_pipelines(id) ON DELETE SET NULL;
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS responsavel_id     UUID;   -- soft FK (sem REFERENCES; segue padrão hub_obras)
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS tipologia          TEXT;   -- dropdown na app, sem CHECK no banco (editável)
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS area_m2            NUMERIC(10,2);
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS cliente_pessoa_id  UUID;   -- soft FK
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS cliente_empresa_id UUID;   -- soft FK
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS cliente_nome       TEXT;   -- desnormalizado p/ card sem JOIN
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS proxima_entrega    TEXT;
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS proxima_entrega_em DATE;
ALTER TABLE public.hub_projetos
  ADD COLUMN IF NOT EXISTS aprovacao_status   TEXT DEFAULT 'sem_aprovacao';

-- aprovacao_status é um eixo separado e estável (o gargalo do arquiteto) → tem CHECK.
ALTER TABLE public.hub_projetos DROP CONSTRAINT IF EXISTS hub_projetos_aprovacao_status_check;
ALTER TABLE public.hub_projetos ADD CONSTRAINT hub_projetos_aprovacao_status_check
  CHECK (aprovacao_status IN ('sem_aprovacao','aguardando','aprovado','reprovado'));

-- AUDITORIA-FIX (CRÍTICO): fecha a CAUSA-RAIZ do vazamento legado. As rotas de
-- projeto agora filtram por `tenant_id = caller` PURO (sem `OR tenant_id IS NULL`);
-- qualquer projeto órfão (tenant_id NULL) some da app. Este backfill os adota no
-- tenant default (mesmo padrão do E0 para hub_obras). Roda ANTES dos índices.
UPDATE public.hub_projetos
  SET tenant_id = public.default_obra10_tenant_id()
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_projetos_tenant_estagio
  ON public.hub_projetos (tenant_id, estagio, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_projetos_pipeline
  ON public.hub_projetos (pipeline_id, estagio);
-- Código único POR TENANT (guard de corrida; parcial p/ não bater em NULL).
CREATE UNIQUE INDEX IF NOT EXISTS hub_projetos_codigo_tenant_uniq
  ON public.hub_projetos (tenant_id, codigo) WHERE codigo IS NOT NULL;

-- ─── 3) hub_projetos_fases vira o "Programa" (reuso, zero tabela nova) ─────────
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS tipo             TEXT DEFAULT 'fase';   -- 'fase' (etapa) | 'comodo' (programa)
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS categoria        TEXT;                  -- 'ambiente'|'servico'|'lazer'|'tecnico'
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS metragem_m2      NUMERIC(8,2);
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS observacao       TEXT;
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS aprovacao_status TEXT DEFAULT 'pendente';
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS entregavel_url   TEXT;
ALTER TABLE public.hub_projetos_fases
  ADD COLUMN IF NOT EXISTS atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.hub_projetos_fases DROP CONSTRAINT IF EXISTS hub_projetos_fases_aprovacao_status_check;
ALTER TABLE public.hub_projetos_fases ADD CONSTRAINT hub_projetos_fases_aprovacao_status_check
  CHECK (aprovacao_status IN ('pendente','enviado','aprovado','rejeitado'));

-- AUDITORIA-FIX (CRÍTICO): mesma causa-raiz para as fases/cômodos. hub_projetos_fases
-- TEM tenant_id próprio (FK hub_tenants), então herdamos do projeto pai (já backfilled
-- acima) e caímos no tenant default só se algo ainda restar NULL. Habilita a RLS abaixo
-- a isolar de verdade. Roda ANTES do índice.
UPDATE public.hub_projetos_fases f
  SET tenant_id = COALESCE(p.tenant_id, public.default_obra10_tenant_id())
  FROM public.hub_projetos p
  WHERE f.projeto_id = p.id AND f.tenant_id IS NULL;
-- Cinto-e-suspensório: fase órfã sem projeto correspondente vai ao tenant default.
UPDATE public.hub_projetos_fases
  SET tenant_id = public.default_obra10_tenant_id()
  WHERE tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_hub_projetos_fases_projeto
  ON public.hub_projetos_fases (projeto_id, tipo, ordem);

-- ─── 4) gerar_codigo_projeto(tenant) — código ATÔMICO e POR TENANT ────────────
-- AUDITORIA-FIX (P0): /api/crm/projetos POST usava COUNT(*) GLOBAL (sem tenant) →
-- vazava contagem entre empresas. Aqui o contador é (tenant_id, ano) → cada tenant
-- tem sua própria sequência; on conflict do update = atômico (sem corrida).
CREATE TABLE IF NOT EXISTS public.hub_projeto_codigo_contador (
  tenant_id UUID NOT NULL,
  ano       INT  NOT NULL,
  ultimo    INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, ano)
);
ALTER TABLE public.hub_projeto_codigo_contador ENABLE ROW LEVEL SECURITY;  -- só a função (definer) escreve

CREATE OR REPLACE FUNCTION public.gerar_codigo_projeto(p_tenant uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano int := extract(year from now())::int;
  v_seq int;
  v_tenant uuid := coalesce(p_tenant, '00000000-0000-4000-8000-000000000001'::uuid);
BEGIN
  INSERT INTO public.hub_projeto_codigo_contador AS c (tenant_id, ano, ultimo)
    VALUES (v_tenant, v_ano, 1)
    ON CONFLICT (tenant_id, ano) DO UPDATE SET ultimo = c.ultimo + 1  -- atômico
    RETURNING c.ultimo INTO v_seq;
  RETURN 'PRJ-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.gerar_codigo_projeto(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_projeto(uuid) TO authenticated, service_role;

-- Backfill do contador para refletir os projetos já existentes (por tenant/ano) —
-- evita colisão de PRJ entre o legado e o primeiro código novo gerado pela RPC.
INSERT INTO public.hub_projeto_codigo_contador (tenant_id, ano, ultimo)
SELECT
  coalesce(p.tenant_id, '00000000-0000-4000-8000-000000000001'::uuid) AS tenant_id,
  extract(year from now())::int AS ano,
  count(*) AS ultimo
FROM public.hub_projetos p
WHERE p.codigo LIKE 'PRJ-' || extract(year from now())::int::text || '-%'
GROUP BY 1, 2
ON CONFLICT (tenant_id, ano) DO UPDATE
  SET ultimo = GREATEST(public.hub_projeto_codigo_contador.ultimo, EXCLUDED.ultimo);

-- ─── 5) Seed do pipeline global 'projetos-arq' (tipo='projeto') ───────────────
-- NÃO re-altera hub_pipelines.tipo (E0/20260705130000 já o fez). Só seeda.
INSERT INTO public.hub_pipelines (slug, nome, tipo, mercado_sigla, ordem)
SELECT 'projetos-arq', 'Arquitetura — Funil de projeto', 'projeto', NULL, 3
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_pipelines WHERE slug = 'projetos-arq' AND tenant_id IS NULL
);

DO $$
DECLARE pid_prj UUID;
BEGIN
  SELECT id INTO pid_prj FROM public.hub_pipelines WHERE slug = 'projetos-arq' AND tenant_id IS NULL LIMIT 1;
  IF pid_prj IS NOT NULL THEN
    INSERT INTO public.hub_pipeline_estagios (pipeline_id, slug, label, cor, ordem, tipo_fecho, sistema)
    SELECT pid_prj, v.slug, v.label, v.cor, v.ordem, v.tipo_fecho, true
    FROM (VALUES
      ('briefing',    'Briefing',        '#6B7280', 0, 'aberto'),
      ('estudo',      'Estudo',          '#E0B86A', 1, 'aberto'),
      ('anteprojeto', 'Anteprojeto',     '#C9A24A', 2, 'aberto'),
      ('executivo',   'Executivo',       '#EAB308', 3, 'aberto'),
      ('aprovacao',   'Aprovação',       '#D6A129', 4, 'aberto'),
      ('entregue',    '✓ Entregue',      '#22C55E', 5, 'ganho'),
      ('arquivado',   '✗ Arquivado',     '#EF4444', 6, 'perdido')
    ) AS v(slug, label, cor, ordem, tipo_fecho)
    ON CONFLICT (pipeline_id, slug) DO NOTHING;
  END IF;
END $$;

-- ─── 6) Backfill pipeline_id + estagio dos projetos existentes ────────────────
-- Mapeia o status legado/relaxado → estagio do funil; aponta ao pipeline global.
DO $$
DECLARE pid_prj UUID;
BEGIN
  SELECT id INTO pid_prj FROM public.hub_pipelines WHERE slug = 'projetos-arq' AND tenant_id IS NULL LIMIT 1;

  -- estagio a partir do status (legado já foi mapeado no passo 1).
  UPDATE public.hub_projetos SET estagio = CASE
    WHEN status IN ('briefing','estudo','anteprojeto','executivo','aprovacao','entregue','arquivado') THEN status
    WHEN status = 'cancelado' THEN 'arquivado'
    ELSE 'briefing'
  END
  WHERE estagio = 'briefing' AND status IS NOT NULL AND status <> 'briefing';

  IF pid_prj IS NOT NULL THEN
    UPDATE public.hub_projetos SET pipeline_id = pid_prj WHERE pipeline_id IS NULL;
  END IF;
END $$;

-- ─── 7) RLS — defesa em profundidade (as rotas usam service_role, mas o banco também isola) ──
-- AUDITORIA-FIX (ATENÇÃO): hub_projetos_fases NÃO tinha policy → sem RLS própria,
-- só dependia do filtro in-code. Habilita o mesmo padrão do E0 (current_user_tenant_id(),
-- definido no passo 0). Após o backfill acima, tenant_id está populado nas duas tabelas.
-- SELECT tolera global (tenant_id NULL) por paridade com hub_negocios/hub_obras; escrita
-- é estrita ao tenant do usuário. service_role bypassa RLS (rotas REST seguem funcionando).
ALTER TABLE public.hub_projetos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hub_projetos_fases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hub_projetos_sel ON public.hub_projetos;
CREATE POLICY hub_projetos_sel ON public.hub_projetos FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_ins ON public.hub_projetos;
CREATE POLICY hub_projetos_ins ON public.hub_projetos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_upd ON public.hub_projetos;
CREATE POLICY hub_projetos_upd ON public.hub_projetos FOR UPDATE TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_del ON public.hub_projetos;
CREATE POLICY hub_projetos_del ON public.hub_projetos FOR DELETE TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

DROP POLICY IF EXISTS hub_projetos_fases_sel ON public.hub_projetos_fases;
CREATE POLICY hub_projetos_fases_sel ON public.hub_projetos_fases FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_fases_ins ON public.hub_projetos_fases;
CREATE POLICY hub_projetos_fases_ins ON public.hub_projetos_fases FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_fases_upd ON public.hub_projetos_fases;
CREATE POLICY hub_projetos_fases_upd ON public.hub_projetos_fases FOR UPDATE TO authenticated
  USING (tenant_id = public.current_user_tenant_id())
  WITH CHECK (tenant_id = public.current_user_tenant_id());
DROP POLICY IF EXISTS hub_projetos_fases_del ON public.hub_projetos_fases;
CREATE POLICY hub_projetos_fases_del ON public.hub_projetos_fases FOR DELETE TO authenticated
  USING (tenant_id = public.current_user_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_projetos       TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_projetos_fases TO authenticated, service_role;

COMMENT ON COLUMN public.hub_projetos.estagio IS 'Estágio do funil de projeto (espelha hub_pipeline_estagios do pipeline_id). Editável — sem CHECK.';
COMMENT ON COLUMN public.hub_projetos.aprovacao_status IS 'Eixo separado do funil: gate de aprovação do cliente (a "Situação" da planilha). Estável, com CHECK.';
COMMENT ON COLUMN public.hub_projetos_fases.tipo IS 'fase = etapa/entregável do funil; comodo = item do Programa (ambientes). Aba Programa filtra tipo=comodo.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.gerar_codigo_projeto(uuid);
--   DROP TABLE IF EXISTS public.hub_projeto_codigo_contador;
--   DELETE FROM public.hub_pipeline_estagios WHERE pipeline_id IN
--     (SELECT id FROM public.hub_pipelines WHERE slug='projetos-arq' AND tenant_id IS NULL);
--   DELETE FROM public.hub_pipelines WHERE slug='projetos-arq' AND tenant_id IS NULL;
--   ALTER TABLE public.hub_projetos DROP CONSTRAINT IF EXISTS hub_projetos_aprovacao_status_check;
--   ALTER TABLE public.hub_projetos
--     DROP COLUMN IF EXISTS estagio, DROP COLUMN IF EXISTS pipeline_id,
--     DROP COLUMN IF EXISTS responsavel_id, DROP COLUMN IF EXISTS tipologia,
--     DROP COLUMN IF EXISTS area_m2, DROP COLUMN IF EXISTS cliente_pessoa_id,
--     DROP COLUMN IF EXISTS cliente_empresa_id, DROP COLUMN IF EXISTS cliente_nome,
--     DROP COLUMN IF EXISTS proxima_entrega, DROP COLUMN IF EXISTS proxima_entrega_em,
--     DROP COLUMN IF EXISTS aprovacao_status;
--   ALTER TABLE public.hub_projetos_fases
--     DROP CONSTRAINT IF EXISTS hub_projetos_fases_aprovacao_status_check,
--     DROP COLUMN IF EXISTS tipo, DROP COLUMN IF EXISTS categoria,
--     DROP COLUMN IF EXISTS metragem_m2, DROP COLUMN IF EXISTS observacao,
--     DROP COLUMN IF EXISTS aprovacao_status, DROP COLUMN IF EXISTS entregavel_url,
--     DROP COLUMN IF EXISTS atualizado_em;
--   -- NÃO re-impor hub_projetos_status_check: o relax é compatível pra cima.
--   -- NÃO tocar hub_pipelines.tipo (é de E0).
--   -- RLS (passo 7): opcional reverter (a app degrada via service_role de qualquer forma):
--   --   DROP POLICY IF EXISTS hub_projetos_sel ON public.hub_projetos;        -- (+ _ins/_upd/_del)
--   --   DROP POLICY IF EXISTS hub_projetos_fases_sel ON public.hub_projetos_fases;  -- (+ _ins/_upd/_del)
--   -- O backfill de tenant_id (causa-raiz) NÃO é revertido de propósito (não há como
--   -- saber qual linha era NULL; e tê-las no tenant default é o comportamento correto).
-- ============================================================================
