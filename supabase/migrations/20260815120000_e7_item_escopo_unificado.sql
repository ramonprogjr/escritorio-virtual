-- ============================================================================
-- E7 — ITEM DE ESCOPO UNIFICADO (custo no item-mãe + BDI 3 camadas + peso derivado) — BLOCO E7
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - SÓ `ALTER ... ADD COLUMN` (nullable / DEFAULT que preserva o legado). NENHUM DROP,
--         NENHUMA tabela nova, ZERO toque destrutivo em E0/E2/E0b/E5/E6.
--       - 2 colunas GENERATED em hub_obra_itens (custo_unitario, custo_total) — transparência
--         auditável (as zonas K-O da planilha do dono): a conta é do banco, não "aparece pronta".
--       - 1 fator de BDI por empresa (hub_obras.bdi_fator DEFAULT 1.0 = neutro) + override por item.
--       - 2 VIEWS security_invoker=true (igual E2/E5/E6) — a leitura respeita a RLS de quem consulta;
--         os endpoints AINDA filtram tenant explícito (precedente do vazamento 28/jun — não regredir).
--       - tenant_id em hub_decision_logs (log de decisão de DINHEIRO não pode ficar fora do tenant).
--     Até aplicar, a UI/endpoint degrada (isMissingPgColumn → migracao_pendente=true + fallback in-code).
--
-- DECISÕES TRAVADAS pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9):
--   #1 hub_obra_itens = o ÚNICO item de escopo (carrega custo+preço+avanço+datas). O orçamento (E6)
--      é a versão/proposta 1:1 do mesmo item. Aqui o item-mãe ganha as colunas de CUSTO.
--   #3 BDI = fator único por empresa (hub_obras.bdi_fator), override por item (hub_obra_itens.bdi_fator).
--      Composição (admin/lucro/risco/tributos) = futuro. Leitura aplica 3 camadas: item → obra → 1.0.
--   #4 Avanço/medição = POR ITEM (peso+pct_avanco já em E2). Ambiente = AGREGAÇÃO ponderada bottom-up
--      (vw_hub_obra_item_peso, só itens-raiz, normaliza o peso financeiro p/ somar avanço por ambiente).
--
-- ⚠️  ATENÇÃO POSTGRES (não quebrar a migração): uma coluna GENERATED STORED NÃO pode referenciar
--     outra GENERATED STORED na mesma linha. Por isso `custo_total` REPETE a soma inline
--     (locacao+material+mo) × quantidade — NÃO faz `custo_unitario * quantidade`. Se o próximo dev
--     "otimizar" para custo_unitario*quantidade, o CREATE/ALTER falha. Mantenha a soma inline.
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): multitenant(20260626130000) → E0(20260705130000) →
--     A0 → E2(20260710120000) → E0b(20260711120000) → E5(20260720120000) → E6(20260730120000) →
--     [E4 20260810120000, futuro] → E7 (ESTE, 20260815120000). E7 NÃO depende de E4.
--     (Existe um segundo "E7 Medição" em 20260820120000 — arquivo/tabelas distintos; este é ANTERIOR.)
--
-- ROLLBACK no fim do arquivo (DROP COLUMN / DROP VIEW — reversível por completo).
-- ============================================================================

-- ─── 1) hub_obra_itens — CUSTO no item-mãe (E2 = a verdade do escopo contratado) ──
-- Separa o que E6 escondia em `custo_outros`: locação/frete · material · mão de obra (cols K-M da
-- planilha do dono). Todos NULLABLE (o legado e o item sem custo continuam válidos → soma trata NULL=0).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_locacao_frete NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS custo_material      NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS custo_mao_obra      NUMERIC(14,2),
  -- BDI override por item: NULL = herda de hub_obras.bdi_fator (3 camadas na leitura: item→obra→1.0).
  ADD COLUMN IF NOT EXISTS bdi_fator           NUMERIC(6,4);

-- custo_unitario = soma das 3 parcelas de custo (NULL conta como 0). GENERATED STORED, auditável.
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(14,2)
  GENERATED ALWAYS AS (
    COALESCE(custo_locacao_frete, 0) + COALESCE(custo_material, 0) + COALESCE(custo_mao_obra, 0)
  ) STORED;

-- custo_total = custo_unitario × quantidade. ATENÇÃO: GENERATED não encadeia GENERATED (ver header) —
-- REPETIMOS a soma inline, NÃO `custo_unitario * quantidade`. quantidade NULL → custo_total NULL
-- (o item sem quantidade não tem custo total; a UI mostra "—", nunca 0 enganoso).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_total NUMERIC(14,2)
  GENERATED ALWAYS AS (
    ROUND(
      (COALESCE(custo_locacao_frete, 0) + COALESCE(custo_material, 0) + COALESCE(custo_mao_obra, 0))
      * quantidade,
      2
    )
  ) STORED;

COMMENT ON COLUMN public.hub_obra_itens.custo_unitario IS
  'E7 GENERATED: soma inline (locacao_frete+material+mao_obra), NULL=0. NÃO referencia outra GENERATED.';
COMMENT ON COLUMN public.hub_obra_itens.custo_total IS
  'E7 GENERATED: soma inline × quantidade (NÃO custo_unitario*quantidade — PG não encadeia GENERATED).';
COMMENT ON COLUMN public.hub_obra_itens.bdi_fator IS
  'E7: override de BDI por item. NULL = herda hub_obras.bdi_fator. Leitura: item ?? obra ?? 1.0.';

-- ─── 2) hub_obras — BDI único por empresa/obra (1 número; a empresa que usa 1.06 seta 1.06) ──
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS bdi_fator NUMERIC(6,4) NOT NULL DEFAULT 1.0;
COMMENT ON COLUMN public.hub_obras.bdi_fator IS
  'E7: fator único de BDI da obra (DEFAULT 1.0 = neutro/preserva legado). preço = custo × BDI × qtd. '
  'Override por item em hub_obra_itens.bdi_fator. Composição (admin/lucro/risco/tributos) = futuro.';

-- ─── 3) hub_decision_logs — tenant_id (SEGURANÇA: log de dinheiro nunca órfão) ─────
-- A tabela legada (20260523170000) nasceu SEM tenant_id. lib/ia/aprovacoes.ts grava o tenant da
-- sessão no log de aprovação/rejeição (que move escrow). Sem esta coluna o log fica fora do tenant.
-- Aditivo, nullable (não exige backfill; o código tolera a ausência via isMissingPgColumn).
ALTER TABLE public.hub_decision_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hub_decision_logs_tenant
  ON public.hub_decision_logs (tenant_id);
COMMENT ON COLUMN public.hub_decision_logs.tenant_id IS
  'E7: tenant da decisão (escopo de auditoria). Gravado por lib/ia/aprovacoes.ts. Nullable (legado).';

-- ─── 4) VIEW vw_hub_obra_item_margem — custo × preço × margem por item (security_invoker) ──
-- O PREÇO sai por FÓRMULA VISÍVEL (custo × BDI × qtd) com BDI de 3 camadas (item → obra → 1.0).
-- margem_pct = (preço − custo) / preço. NULL quando não há preço (sem custo) → UI mostra "—", nunca NaN.
-- security_invoker=true → respeita a RLS de quem consulta; o endpoint AINDA filtra tenant explícito.
CREATE OR REPLACE VIEW public.vw_hub_obra_item_margem
  WITH (security_invoker = true) AS
SELECT
  i.id              AS item_id,
  i.obra_id,
  i.tenant_id,
  i.parent_id,
  i.codigo,
  i.nome,
  i.disciplina_slug,
  i.ambiente,
  i.quantidade,
  i.custo_unitario,
  i.custo_total,
  -- BDI efetivo (3 camadas): override do item, senão da obra, senão 1.0 (neutro).
  COALESCE(i.bdi_fator, o.bdi_fator, 1.0)                                          AS bdi_efetivo,
  -- Preço = custo × BDI (unitário e total). custo NULL→0; total respeita quantidade (NULL→NULL).
  ROUND(i.custo_unitario * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2)             AS preco_unitario,
  CASE WHEN i.custo_total IS NULL THEN NULL
       ELSE ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2)
  END                                                                              AS preco_total,
  -- margem_pct sobre o preço (markup honesto). NULL quando preço<=0 (sem custo) → "—" na UI.
  CASE
    WHEN i.custo_total IS NULL THEN NULL
    WHEN ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2) > 0
      THEN ROUND(
        (i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0) - i.custo_total)
        / (i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0)) * 100, 2)
    ELSE NULL
  END                                                                              AS margem_pct
FROM public.hub_obra_itens i
JOIN public.hub_obras o ON o.id = i.obra_id
WHERE i.ativo = true;

GRANT SELECT ON public.vw_hub_obra_item_margem TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_item_margem IS
  'E7: custo × preço × margem por item. Preço = custo × BDI (3 camadas: item→obra→1.0), fórmula VISÍVEL. '
  'margem_pct NULL sem preço (UI mostra —). security_invoker=true; endpoint ainda filtra tenant.';

-- ─── 5) VIEW vw_hub_obra_item_peso — peso financeiro normalizado (só itens-raiz) ──
-- DECISÃO #4: avanço é controlado POR ITEM (peso+pct_avanco em E2), exibido por item E por AMBIENTE.
-- O ambiente é AGREGAÇÃO ponderada bottom-up: precisa do peso financeiro de cada item-raiz normalizado
-- (Σ pesos da obra = 1). CUIDADO mapeado: só `parent_id IS NULL` — somar pai + subitem contaria o
-- valor em dobro. Base de peso = preço_total (custo × BDI); sem custo, peso=0 (degrada p/ média simples
-- na ausência de custo, exatamente como o design previu).
CREATE OR REPLACE VIEW public.vw_hub_obra_item_peso
  WITH (security_invoker = true) AS
WITH raiz AS (
  SELECT
    i.id              AS item_id,
    i.obra_id,
    i.tenant_id,
    i.ambiente,
    i.disciplina_slug,
    i.pct_avanco,
    -- valor de ponderação = preço_total do item (custo × BDI efetivo). NULL/sem custo → 0.
    COALESCE(
      ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2),
      0
    )                 AS valor_peso
  FROM public.hub_obra_itens i
  JOIN public.hub_obras o ON o.id = i.obra_id
  WHERE i.ativo = true AND i.parent_id IS NULL      -- SÓ RAIZ (não conta pai + subitem em dobro)
),
tot AS (
  SELECT obra_id, SUM(valor_peso) AS total_obra
  FROM raiz GROUP BY obra_id
)
SELECT
  r.item_id,
  r.obra_id,
  r.tenant_id,
  r.ambiente,
  r.disciplina_slug,
  r.pct_avanco,
  r.valor_peso,
  t.total_obra,
  -- peso financeiro normalizado (Σ na obra = 1 quando há custo). total 0 → peso NULL (UI: média simples).
  CASE WHEN COALESCE(t.total_obra, 0) > 0
       THEN ROUND(r.valor_peso / t.total_obra, 6)
       ELSE NULL
  END                                               AS peso_financeiro
FROM raiz r
LEFT JOIN tot t ON t.obra_id = r.obra_id;

GRANT SELECT ON public.vw_hub_obra_item_peso TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_item_peso IS
  'E7: peso financeiro normalizado por item-RAIZ (parent_id IS NULL; nunca conta pai+subitem em dobro). '
  'Base p/ AGREGAÇÃO de avanço por ambiente (decisão #4). total 0 → peso NULL (degrada p/ média simples).';

-- ============================================================================
-- ROLLBACK (reversível por completo — só remove o que E7 adicionou):
--   DROP VIEW IF EXISTS public.vw_hub_obra_item_peso;
--   DROP VIEW IF EXISTS public.vw_hub_obra_item_margem;
--   ALTER TABLE public.hub_obra_itens
--     DROP COLUMN IF EXISTS custo_total,
--     DROP COLUMN IF EXISTS custo_unitario,
--     DROP COLUMN IF EXISTS bdi_fator,
--     DROP COLUMN IF EXISTS custo_mao_obra,
--     DROP COLUMN IF EXISTS custo_material,
--     DROP COLUMN IF EXISTS custo_locacao_frete;
--   ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS bdi_fator;
--   DROP INDEX IF EXISTS public.idx_hub_decision_logs_tenant;
--   ALTER TABLE public.hub_decision_logs DROP COLUMN IF EXISTS tenant_id;
--   (E0/E2/E0b/E5/E6 e as colunas existentes permanecem INTACTOS — E7 nunca os destrói.)
-- ============================================================================
