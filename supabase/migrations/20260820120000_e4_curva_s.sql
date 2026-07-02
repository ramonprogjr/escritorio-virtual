-- ============================================================================
-- E4 — CRONOGRAMA + CURVA-S (pendura no PESO do item de escopo) — BLOCO E4
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - 3 tabelas NOVAS. NENHUM DROP/ALTER em E0/E2/E0b/E5/E6/E7/E7b/E7c.
--       - hub_obra_curva_baseline (a LINHA-BASE: início/fim, 1 vigente por obra) +
--         hub_obra_curva_pontos (a CURVA PLANEJADA por semana: planejado_pct_fisico/financeiro).
--       - hub_obra_avanco_diario = APPEND-ONLY (a CURVA EXECUTADA, snapshot): GRANT só SELECT,
--         INSERT (SEM UPDATE/DELETE p/ authenticated/service_role). "NADA SE PERDE": o avanço
--         medido não se apaga nem se reescreve — corrige-se com um NOVO snapshot (igual ao extrato
--         de escrow de E6 e à medição de E7c). A verdade é o histórico completo.
--       - RLS via current_user_tenant_id() (igual E0/E2/E3/E5/E6/E7c); tenant_id NOT NULL.
--     Até aplicar, o endpoint /api/crm/obras/[id]/cronograma DEGRADA: sem baseline → calcula o
--     PLANEJADO linear (início→fim da obra) e o EXECUTADO a partir do avanço ponderado dos itens
--     (lib/obras/escopo.ts → avancoPonderado), responde migracao_pendente=true. O avanço já funciona.
--
-- DECISÃO TRAVADA pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9 #4):
--   Avanço/medição = POR ITEM (peso financeiro + pct_avanco do item, E2). A CURVA-S "pendura no
--   PESO derivado" (design §7 Fase 4): pct_fisico = avanço ponderado pelo peso; pct_financeiro =
--   peso financeiro acumulado. Os DOIS são SEPARADOS (físico = obra; financeiro = desembolso).
--   Sem E4 aplicado, degrada para "avanço-só" (físico = financeiro, ambos do avanço ponderado).
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): … E6(20260730120000) → E7(20260815120000) →
--     E7b(20260816120000) → E7c(20260817120000) → E4 (ESTE, 20260820120000). E4 depende SÓ de
--     hub_obras (FK) e LÊ hub_obra_itens (E2) via endpoint — NÃO depende de E7/E7b/E7c no schema.
--     (O design diz "E4 não depende de E7"; aqui o timestamp é posterior só por ser escrito depois.)
--
-- ROLLBACK no fim do arquivo (DROP TABLE das 3 — só elas, aditivas).
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; alinhado à canônica) ──────────
-- AUDITORIA-FIX: idêntico à canônica (20260626130000_multitenant_foundation) — NÃO enfraquecer.
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

-- ─── 1) hub_obra_curva_baseline (NOVA) — a LINHA-BASE do cronograma da obra ────
-- 1 baseline VIGENTE por obra (vigente=true). Replanejou? Insere outra e marca a antiga
-- vigente=false (mantém o histórico de baselines — auditável). data_inicio/data_fim definem o
-- horizonte da curva PLANEJADA; total_pontos é só desnormalização p/ leitura rápida.
CREATE TABLE IF NOT EXISTS public.hub_obra_curva_baseline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  data_inicio   DATE NOT NULL,
  data_fim      DATE NOT NULL,
  -- true = é a baseline em uso (a curva planejada vem dos pontos dela). Só 1 por obra (índice parcial).
  vigente       BOOLEAN NOT NULL DEFAULT true,
  total_pontos  INTEGER NOT NULL DEFAULT 0,
  observacao    TEXT,
  criada_por    TEXT,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (data_fim >= data_inicio)
);

-- Só UMA baseline vigente por obra (índice único parcial; replanejar = desligar a antiga primeiro).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_obra_curva_baseline_vigente
  ON public.hub_obra_curva_baseline (obra_id) WHERE vigente = true;
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_baseline_obra
  ON public.hub_obra_curva_baseline (obra_id, vigente);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_baseline_tenant
  ON public.hub_obra_curva_baseline (tenant_id);

ALTER TABLE public.hub_obra_curva_baseline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_curva_baseline_rls ON public.hub_obra_curva_baseline;
CREATE POLICY hub_obra_curva_baseline_rls ON public.hub_obra_curva_baseline FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
-- Baseline é editável (replanejar é um ato de gestão, não fraude): mantém UPDATE/DELETE. O que é
-- APPEND-ONLY é o avanço executado (a verdade do que aconteceu), não o plano.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_curva_baseline TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_curva_baseline IS
  'E4: linha-base do cronograma por obra (início/fim, 1 vigente). A curva PLANEJADA vem dos pontos. '
  'Replanejar = nova baseline vigente=true + antiga vigente=false (histórico preservado).';

-- ─── 2) hub_obra_curva_pontos (NOVA) — a CURVA PLANEJADA (por semana/data) ─────
-- Cada ponto = um marco temporal com o % planejado FÍSICO e FINANCEIRO acumulado (0..100).
-- Físico e financeiro SEPARADOS (decisão #4): a obra pode adiantar o físico e atrasar o desembolso
-- (ou vice-versa). semana é o índice (0,1,2…) e data o eixo X legível.
CREATE TABLE IF NOT EXISTS public.hub_obra_curva_pontos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id              UUID NOT NULL REFERENCES public.hub_obra_curva_baseline(id) ON DELETE CASCADE,
  obra_id                  UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  semana                   INTEGER NOT NULL,           -- 0,1,2… (eixo X ordinal)
  data                     DATE NOT NULL,              -- eixo X legível (fim da semana)
  planejado_pct_fisico     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planejado_pct_fisico BETWEEN 0 AND 100),
  planejado_pct_financeiro NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planejado_pct_financeiro BETWEEN 0 AND 100),
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baseline_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_baseline
  ON public.hub_obra_curva_pontos (baseline_id, semana);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_obra
  ON public.hub_obra_curva_pontos (obra_id, data);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_tenant
  ON public.hub_obra_curva_pontos (tenant_id);

ALTER TABLE public.hub_obra_curva_pontos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_curva_pontos_rls ON public.hub_obra_curva_pontos;
CREATE POLICY hub_obra_curva_pontos_rls ON public.hub_obra_curva_pontos FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_curva_pontos TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_curva_pontos IS
  'E4: a curva PLANEJADA (pontos por semana). planejado_pct_fisico e _financeiro SEPARADOS '
  '(decisão #4: físico = avanço da obra; financeiro = desembolso). Vinculados à baseline vigente.';

-- ─── 3) hub_obra_avanco_diario (NOVA) — a CURVA EXECUTADA, APPEND-ONLY ─────────
-- Cada linha é um SNAPSHOT imutável do avanço REAL num dia: pct_fisico (avanço ponderado por peso)
-- e pct_financeiro (peso financeiro medido/realizado). "NADA SE PERDE": sem UPDATE/DELETE —
-- corrigir = novo snapshot. O endpoint usa o ÚLTIMO snapshot por data p/ desenhar a curva executada;
-- sem nenhum snapshot, calcula o executado AO VIVO do avanço ponderado dos itens (degrade honesto).
CREATE TABLE IF NOT EXISTS public.hub_obra_avanco_diario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  -- pct FÍSICO acumulado (avanço ponderado pelo peso financeiro dos itens-raiz). 0..100.
  pct_fisico      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_fisico BETWEEN 0 AND 100),
  -- pct FINANCEIRO acumulado (peso financeiro realizado/medido). 0..100. Pode divergir do físico.
  pct_financeiro  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_financeiro BETWEEN 0 AND 100),
  origem          TEXT NOT NULL DEFAULT 'sistema'
                  CHECK (origem IN ('sistema','manual','medicao','ia')),
  observacao      TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico por obra em ordem de data/registro (a "nada se perde" navegável + leitura da curva).
CREATE INDEX IF NOT EXISTS idx_hub_obra_avanco_diario_obra
  ON public.hub_obra_avanco_diario (obra_id, data, criado_em);
CREATE INDEX IF NOT EXISTS idx_hub_obra_avanco_diario_tenant
  ON public.hub_obra_avanco_diario (tenant_id);

ALTER TABLE public.hub_obra_avanco_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_avanco_diario_rls ON public.hub_obra_avanco_diario;
-- FIX 02/jul: dropar os nomes REAIS antes de criar (idempotente — a tabela já existe de sessão anterior).
DROP POLICY IF EXISTS hub_obra_avanco_diario_select ON public.hub_obra_avanco_diario;
DROP POLICY IF EXISTS hub_obra_avanco_diario_insert ON public.hub_obra_avanco_diario;
-- APPEND-ONLY na própria policy: FOR SELECT e FOR INSERT (sem UPDATE/DELETE). Mesmo um tenant
-- legítimo NÃO altera/apaga um snapshot da sua obra — só insere outro. (espelha E7c e o escrow.)
CREATE POLICY hub_obra_avanco_diario_select ON public.hub_obra_avanco_diario FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
CREATE POLICY hub_obra_avanco_diario_insert ON public.hub_obra_avanco_diario FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());

-- GRANT append-only: SELECT + INSERT, NUNCA UPDATE/DELETE (nem p/ service_role — a verdade é o
-- histórico completo; corrigir = novo snapshot). É a trava física do "nada se perde".
GRANT SELECT, INSERT ON public.hub_obra_avanco_diario TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_avanco_diario IS
  'E4 (decisão #4): curva EXECUTADA — snapshot APPEND-ONLY do avanço real por dia. pct_fisico '
  '(avanço ponderado por peso) e pct_financeiro (peso financeiro realizado) SEPARADOS. NADA SE '
  'PERDE: sem UPDATE/DELETE — corrige-se com novo snapshot. Sem snapshots, o endpoint calcula ao vivo.';
COMMENT ON COLUMN public.hub_obra_avanco_diario.pct_fisico IS
  'Avanço físico acumulado ponderado pelo peso financeiro dos itens-raiz (espelha avancoPonderado).';
COMMENT ON COLUMN public.hub_obra_avanco_diario.pct_financeiro IS
  'Avanço financeiro acumulado (peso financeiro medido/realizado). Pode divergir do físico.';

-- ============================================================================
-- ROLLBACK (reversível por completo — remove só as 3 tabelas NOVAS que E4 adicionou):
--   DROP TABLE IF EXISTS public.hub_obra_avanco_diario;
--   DROP TABLE IF EXISTS public.hub_obra_curva_pontos;     -- CASCADE da FK p/ baseline
--   DROP TABLE IF EXISTS public.hub_obra_curva_baseline;
--   (E0/E2/E0b/E5/E6/E7/E7b/E7c e TODAS as colunas/constraints existentes permanecem INTACTOS —
--    E4 nunca os altera. current_user_tenant_id() é só um CREATE OR REPLACE idempotente.)
-- ============================================================================
