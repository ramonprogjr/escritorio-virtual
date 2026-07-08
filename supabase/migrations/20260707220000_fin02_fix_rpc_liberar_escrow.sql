-- FIN-02 (P0) · corrige custódia fantasma em rpc_liberar_escrow.
-- Antes: `saldo_custodia = GREATEST(0, saldo_custodia - v_valor)` MASCARAVA saldo negativo
-- (liberava mais do que havia em custódia) e sem FOR UPDATE havia corrida de saldo.
-- Agora: FOR UPDATE no pagamento e na conta; guarda de custódia ANTES de qualquer escrita
-- (fail-closed → estado consistente, nunca meia-liberação); subtração sem GREATEST.
-- Aplicada via MCP em 07/jul + verificada (não usa mais GREATEST; usa FOR UPDATE).
CREATE OR REPLACE FUNCTION public.rpc_liberar_escrow(p_pagamento_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pag      public.hub_obra_pagamentos%ROWTYPE;
  v_arq_st   text;
  v_hub_st   text;
  v_conta_id uuid;
  v_custodia numeric;
  v_valor    numeric;
BEGIN
  SELECT * INTO v_pag FROM public.hub_obra_pagamentos
    WHERE id = p_pagamento_id AND tenant_id = p_tenant_id
    FOR UPDATE;
  IF v_pag.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
  END IF;

  IF v_pag.escrow_liberado OR v_pag.status IN ('autorizado','em_custodia','pago') THEN
    RETURN jsonb_build_object('ok', true, 'idempotente', true, 'status', v_pag.status);
  END IF;

  SELECT status INTO v_arq_st FROM public.hub_aprovacoes
    WHERE id = v_pag.aprovacao_arq_id AND tenant_id = p_tenant_id;
  SELECT status INTO v_hub_st FROM public.hub_aprovacoes
    WHERE id = v_pag.aprovacao_hub_id AND tenant_id = p_tenant_id;

  IF v_arq_st NOT IN ('aprovado','aprovada') OR v_arq_st IS NULL
     OR v_hub_st NOT IN ('aprovado','aprovada') OR v_hub_st IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'erro', 'aprovacao_dupla_incompleta',
      'arq', COALESCE(v_arq_st, 'ausente'), 'hub', COALESCE(v_hub_st, 'ausente')
    );
  END IF;

  v_valor := COALESCE(v_pag.valor_liquido, v_pag.valor, 0);

  SELECT id, saldo_custodia INTO v_conta_id, v_custodia
    FROM public.hub_obra_escrow_contas
    WHERE obra_id = v_pag.obra_id AND tenant_id = p_tenant_id
    FOR UPDATE;

  IF v_conta_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'sem_conta_escrow');
  END IF;
  IF v_custodia < v_valor THEN
    RETURN jsonb_build_object(
      'ok', false, 'erro', 'custodia_insuficiente',
      'saldo_custodia', v_custodia, 'valor_solicitado', v_valor
    );
  END IF;

  UPDATE public.hub_obra_pagamentos
    SET status = 'autorizado', escrow_liberado = true,
        escrow_liberado_em = NOW(), escrow_liberado_por = 'duplo'
    WHERE id = p_pagamento_id AND tenant_id = p_tenant_id;

  INSERT INTO public.hub_obra_escrow_movimentos(
    conta_id, obra_id, tenant_id, tipo, valor, pagamento_id,
    aprovacao_arq_id, aprovacao_hub_id, origem, criado_por
  ) VALUES (
    v_conta_id, v_pag.obra_id, p_tenant_id, 'liberacao', v_valor, p_pagamento_id,
    v_pag.aprovacao_arq_id, v_pag.aprovacao_hub_id, 'rpc_liberar_escrow', 'duplo'
  );

  UPDATE public.hub_obra_escrow_contas
    SET saldo_liberado = saldo_liberado + v_valor,
        saldo_custodia = saldo_custodia - v_valor
    WHERE id = v_conta_id;

  RETURN jsonb_build_object('ok', true, 'pagamento_id', p_pagamento_id, 'valor_liberado', v_valor);
END $function$;
