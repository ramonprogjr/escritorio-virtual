-- Agregação do "Pipeline Total" e dos totais/contagens por etapa NO BANCO (SUM/COUNT),
-- substituindo a soma no app sobre no máx. 5000 linhas (MÉDIO-4 da auditoria): em tenant
-- grande o KPI vinha truncado/menor que o real. A RPC não tem teto de linhas e aplica os
-- mesmos filtros da listagem (tenant + status/etapa/prefixo/pipeline/busca).
--
-- ADITIVO e idempotente (CREATE OR REPLACE). A rota chama esta função e, se ela ainda não
-- existir nesta base, recai no fallback app-side (com limite elevado). Nenhum dado/regra
-- é alterado. NÃO aplicada automaticamente — aplicar via SQL Editor / supabase db push.
--
-- Escopo de tenant idêntico a tenantScopeOrFilter(): tenant atual + legados (tenant_id NULL
-- e o tenant Obra10 padrão). Valor da linha = COALESCE(valor_fechado, valor_estimado, 0).

CREATE OR REPLACE FUNCTION public.crm_negocios_pipeline_totais(
  p_tenant_id  uuid,
  p_status     text DEFAULT NULL,
  p_etapa      text DEFAULT NULL,
  p_prefixo    text DEFAULT NULL,
  p_pipeline_id uuid DEFAULT NULL,
  p_busca      text DEFAULT NULL
)
RETURNS TABLE (etapa text, total numeric, qtd bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(n.etapa, '')                                        AS etapa,
    COALESCE(SUM(COALESCE(n.valor_fechado, n.valor_estimado, 0)), 0) AS total,
    COUNT(*)                                                     AS qtd
  FROM public.hub_negocios n
  WHERE
    -- tenant atual + legados (NULL / Obra10 padrão) — espelha tenantScopeOrFilter()
    (
      n.tenant_id = p_tenant_id
      OR n.tenant_id IS NULL
      OR n.tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
    )
    AND (p_status IS NULL OR n.status = p_status)
    AND (p_etapa IS NULL OR n.etapa = p_etapa)
    AND (p_prefixo IS NULL OR n.prefixo_mercado = p_prefixo)
    AND (p_pipeline_id IS NULL OR n.pipeline_id = p_pipeline_id)
    AND (
      p_busca IS NULL
      OR n.titulo ILIKE '%' || p_busca || '%'
      OR n.codigo ILIKE '%' || p_busca || '%'
    )
  GROUP BY COALESCE(n.etapa, '');
$$;

COMMENT ON FUNCTION public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text) IS
  'Totais/contagens por etapa de hub_negocios (SUM/COUNT no banco) para o KPI Pipeline Total. Escopo de tenant = atual + legados (NULL/Obra10).';

REVOKE ALL ON FUNCTION public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text) TO service_role;

-- ─── ROLLBACK (manual, se necessário) ───────────────────────────────────────
-- DROP FUNCTION IF EXISTS public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text);
