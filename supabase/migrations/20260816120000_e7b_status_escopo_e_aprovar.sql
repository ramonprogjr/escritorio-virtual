-- ============================================================================
-- E7b — STATUS_ESCOPO (tipo + 'aditivo_potencial') + APROVAR ORÇAMENTO COPIA CUSTO — BLOCO E7b
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - SÓ estende o CHECK de hub_obra_itens.tipo (DROP+ADD preservando TODOS os valores atuais).
--         NENHUMA coluna nova, NENHUMA tabela nova nesta migração.
--       - 1 RPC SECURITY DEFINER + REVOKE public/anon + GUARD de tenant ANTES de qualquer mutação —
--         igual rpc_aprovar_orcamento_frente / rpc_liberar_escrow (E6). Idempotente.
--       - Depende de E6 (hub_obra_orcamento_itens) e de E7 (colunas de custo em hub_obra_itens).
--         Se aplicada antes de E7, o UPDATE de custo no item-mãe falha — por isso o timestamp 20260816
--         vem DEPOIS de E7 (20260815). A ordem cronológica do diretório garante o apply correto.
--     Até aplicar, o endpoint/UI degrada (isMissingPgColumn → migracao_pendente=true + fallback in-code).
--
-- DECISÕES TRAVADAS pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9):
--   #1 hub_obra_itens = o ÚNICO item de escopo (a verdade do contratado); o orçamento (E6) é a versão.
--      Ao APROVAR o orçamento de uma frente, o snapshot de custo da versão aprovada COPIA para o
--      item-mãe — NO ENDPOINT/RPC, NUNCA em trigger (triggers escondem magia; padrão do projeto §3).
--   #2 status_escopo = REUSAR o `tipo` que já existe em E2 (contrato/aditivo/servico_extra), estendendo
--      o CHECK com 'aditivo_potencial' = o catálogo ZERADO por ambiente×disciplina (item pré-listado mas
--      colapsado, quantidade 0; vira aditivo de verdade quando o humano liga a quantidade na obra).
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): … E6(20260730120000) → E7(20260815120000) → E7b (ESTE,
--     20260816120000). E7b NÃO depende de E4.
--
-- ROLLBACK no fim do arquivo (reversível por completo).
-- ============================================================================

-- ─── 1) hub_obra_itens.tipo — ESTENDER o CHECK (status_escopo, decisão #2) ─────
-- O CHECK atual (E2, 20260710120000) é IN ('contrato','aditivo','servico_extra'). DROP+ADD preservando
-- os 3 originais e acrescentando 'aditivo_potencial' (catálogo zerado). DEFAULT 'contrato' permanece.
-- Nenhum dado existente viola o novo CHECK (é superconjunto) — ALTER seguro, sem reescrever linhas.
ALTER TABLE public.hub_obra_itens DROP CONSTRAINT IF EXISTS hub_obra_itens_tipo_check;
ALTER TABLE public.hub_obra_itens ADD CONSTRAINT hub_obra_itens_tipo_check
  CHECK (tipo IN ('contrato','aditivo','servico_extra','aditivo_potencial'));

COMMENT ON COLUMN public.hub_obra_itens.tipo IS
  'E7b status_escopo (decisão #2): contrato (contratado) · aditivo (aditivo contratado) · '
  'servico_extra · aditivo_potencial (catálogo ZERADO por ambiente×disciplina, pré-listado colapsado; '
  'vira aditivo quando o humano liga a quantidade — gera card de disparidade, não edição silenciosa).';

-- ─── 2) RPC rpc_snapshot_custo_frente — SNAPSHOT de custo p/ o item-mãe (decisão #1) ──
-- NOME PRÓPRIO (não "aprovar") DE PROPÓSITO: a E6 já define rpc_aprovar_orcamento_frente(uuid,uuid,uuid)
-- e o Postgres distingue sobrecarga por TIPOS (não por nome de parâmetro) — um CREATE OR REPLACE com a
-- MESMA assinatura (3×uuid) SUBSTITUIRIA a função de E6 (que aprova + libera pagamento). Esta função é
-- SEPARADA e faz SÓ o snapshot de custo. Fluxo: a aprovação chama a rpc_aprovar_orcamento_frente de E6
-- (aprova + libera) e DEPOIS esta (copia o custo já aprovado ao item-mãe). Wiring no código = Fase 3.
--
-- COPIA o custo dos hub_obra_orcamento_itens JÁ APROVADOS da frente para o hub_obra_itens (via item_id).
-- Idempotente (re-rodar reescreve o mesmo snapshot). GUARD de tenant explícito (SECURITY DEFINER bypassa RLS).
-- Mapa de esquema E6→E7: E6 tem custo_material/custo_mao_obra/custo_outros (E6 L124-126); custo_outros
-- carrega locação/frete (design §1 col K) → custo_locacao_frete; bdi_fator NÃO é copiado (item herda
-- hub_obras.bdi_fator — 3 camadas na leitura).
CREATE OR REPLACE FUNCTION public.rpc_snapshot_custo_frente(
  p_obra_id   uuid,
  p_frente_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra_tenant uuid;
  v_copiados    int := 0;
BEGIN
  -- GUARD tenant explícito: a obra tem de ser do tenant do caller (404 lógico, sem mutar).
  SELECT tenant_id INTO v_obra_tenant
    FROM public.hub_obras
    WHERE id = p_obra_id;
  IF v_obra_tenant IS NULL OR v_obra_tenant <> p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'obra_nao_encontrada');
  END IF;

  -- SNAPSHOT: para cada item-mãe ligado a uma linha de orçamento JÁ APROVADO da frente, copia o custo.
  -- A APROVAÇÃO em si (status='aprovado' + liberar pagamento) é da rpc_aprovar_orcamento_frente de E6;
  -- esta função roda DEPOIS e só LÊ o que já está aprovado. p_frente_id NULL = todas as frentes.
  WITH agregado AS (
    SELECT
      oi.item_id,
      SUM(COALESCE(oi.custo_material, 0))  AS material,
      SUM(COALESCE(oi.custo_mao_obra, 0))  AS mao_obra,
      SUM(COALESCE(oi.custo_outros, 0))    AS locacao_frete
    FROM public.hub_obra_orcamento_itens oi
    JOIN public.hub_obra_orcamentos o ON o.id = oi.orcamento_id
    WHERE oi.obra_id = p_obra_id
      AND oi.tenant_id = p_tenant_id
      AND oi.item_id IS NOT NULL
      AND o.status = 'aprovado'
      AND (p_frente_id IS NULL OR o.frente_id = p_frente_id)
    GROUP BY oi.item_id
  )
  UPDATE public.hub_obra_itens i
    SET custo_locacao_frete = a.locacao_frete,
        custo_material      = a.material,
        custo_mao_obra      = a.mao_obra
    FROM agregado a
    WHERE i.id = a.item_id
      AND i.obra_id = p_obra_id
      AND i.tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_copiados = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'itens_custo_copiado', v_copiados);
END $$;
REVOKE ALL ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) TO authenticated, service_role;

-- SEM COLISÃO: nome próprio `rpc_snapshot_custo_frente` ≠ `rpc_aprovar_orcamento_frente` (E6). A função
-- de E6 (aprova + libera pagamento) fica INTACTA. O fluxo de aprovação chama a de E6 e DEPOIS esta para
-- materializar o custo no item-mãe. O wiring (chamar esta após a aprovação) entra no código na Fase 3.

COMMENT ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) IS
  'E7b (decisão #1): copia o snapshot de custo (E6 custo_material/mao_obra/outros) dos orçamentos '
  'APROVADOS da frente para o item-mãe E7 (hub_obra_itens). NÃO aprova (isso é da '
  'rpc_aprovar_orcamento_frente de E6) — roda DEPOIS dela. Guard tenant (SECURITY DEFINER). Idempotente.';

-- ============================================================================
-- ROLLBACK (reversível por completo — só remove/reverte o que E7b adicionou):
--   -- 1) reverter o CHECK de tipo ao conjunto E2 (só se nenhum item usa 'aditivo_potencial'):
--   --   ALTER TABLE public.hub_obra_itens DROP CONSTRAINT IF EXISTS hub_obra_itens_tipo_check;
--   --   ALTER TABLE public.hub_obra_itens ADD CONSTRAINT hub_obra_itens_tipo_check
--   --     CHECK (tipo IN ('contrato','aditivo','servico_extra'));
--   -- 2) remover só a função NOVA de snapshot (a rpc_aprovar_orcamento_frente de E6 NÃO é tocada):
--   --   DROP FUNCTION IF EXISTS public.rpc_snapshot_custo_frente(uuid, uuid, uuid);
--   (E0/E2/E0b/E5/E6/E7 e as colunas/constraints existentes permanecem INTACTOS — E7b nunca os destrói.)
-- ============================================================================
