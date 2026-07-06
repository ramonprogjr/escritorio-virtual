-- ════════════════════════════════════════════════════════════════════════════
-- rpc_liberar_pagamento_comissao — a DUPLA CHAVE do pagamento de comissao.
-- So AUTORIZA um titulo de comissao quando as 2 aprovacoes (OK do beneficiario +
-- chave do Hub) estao 'aprovado' E o titulo esta EXIGIVEL (cash-basis: cliente pagou).
-- Clone fail-closed do trilho de escrow (rpc_liberar_escrow). O 'pago' real e baixa
-- manual (fase 1). Estende o CHECK de hub_aprovacoes com os 2 tipos novos (aditivo).
--
-- APLICADO+TESTADO 06/jul via MCP (rollback via excecao). VERIFICADO: sem chave->recusa;
-- 1 chave->recusa (falta a outra); 2 chaves->autoriza (R$300, status 'autorizado').
-- Doutrina do dono: o HUB determina o pagamento; o parceiro/arquiteto da o OK.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
   WHERE conrelid='public.hub_aprovacoes'::regclass AND contype='c'
     AND pg_get_constraintdef(oid) ILIKE '%pagamento_obra_hub%';
  IF cname IS NOT NULL THEN EXECUTE format('ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT %I', cname); END IF;
  ALTER TABLE public.hub_aprovacoes ADD CONSTRAINT hub_aprovacoes_tipo_check
    CHECK (tipo = ANY (ARRAY['proposta','pedido_material','pagamento','desconto','outro',
      'orcamento_frente','pagamento_obra_arq','pagamento_obra_hub',
      'pagamento_comissao_ok','pagamento_comissao_hub']));
END $$;

CREATE OR REPLACE FUNCTION public.rpc_liberar_pagamento_comissao(
  p_titulo_id uuid, p_tenant_id uuid, p_criado_por uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_tit record; v_benef text; v_hub text;
BEGIN
  IF p_tenant_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_tenant'); END IF;
  SELECT * INTO v_tit FROM public.hub_negocio_titulos WHERE id=p_titulo_id FOR UPDATE;
  IF NOT FOUND OR v_tit.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok',false,'erro','titulo_nao_encontrado'); END IF;
  IF v_tit.direcao<>'pagar' OR v_tit.natureza<>'comissao_split' THEN
    RETURN jsonb_build_object('ok',false,'erro','titulo_nao_pagavel'); END IF;
  IF v_tit.status='pago' THEN RETURN jsonb_build_object('ok',true,'ja_pago',true); END IF;
  IF v_tit.status='autorizado' THEN RETURN jsonb_build_object('ok',true,'ja_autorizado',true); END IF;
  IF COALESCE(v_tit.valor_exigivel,0)<=0 THEN
    RETURN jsonb_build_object('ok',false,'erro','nao_exigivel'); END IF;

  SELECT status INTO v_benef FROM public.hub_aprovacoes WHERE id=v_tit.aprovacao_benef_id AND tenant_id=p_tenant_id;
  SELECT status INTO v_hub   FROM public.hub_aprovacoes WHERE id=v_tit.aprovacao_hub_id   AND tenant_id=p_tenant_id;
  IF v_benef IS DISTINCT FROM 'aprovado' OR v_hub IS DISTINCT FROM 'aprovado' THEN
    RETURN jsonb_build_object('ok',false,'erro','faltam_2_chaves',
      'beneficiario',COALESCE(v_benef,'ausente'),'hub',COALESCE(v_hub,'ausente')); END IF;

  UPDATE public.hub_negocio_titulos SET status='autorizado', atualizado_em=now() WHERE id=p_titulo_id;
  INSERT INTO public.hub_negocio_fin_movimentos (tenant_id,negocio_id,titulo_id,tipo,valor,descricao,criado_por)
  VALUES (p_tenant_id, v_tit.negocio_id, p_titulo_id, 'liberacao', v_tit.valor_exigivel, 'Comissao autorizada (2 chaves)', p_criado_por);
  RETURN jsonb_build_object('ok',true,'status','autorizado','valor',v_tit.valor_exigivel);
END $$;
REVOKE ALL ON FUNCTION public.rpc_liberar_pagamento_comissao(uuid,uuid,uuid) FROM anon, public;
