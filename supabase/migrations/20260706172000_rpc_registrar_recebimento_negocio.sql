-- ════════════════════════════════════════════════════════════════════════════
-- rpc_registrar_recebimento_negocio — CASH-BASIS (decisao do dono: comissao so apos o
-- cliente pagar). O cliente paga -> os titulos de comissao (a pagar) viram EXIGIVEIS
-- pro-rata: exigivel de cada fatia = fatia * (total_pago / valor_fechado). Residuo de
-- centavos vai no MAIOR titulo (nada se perde). Grava movimento no extrato append-only.
-- Fail-closed (tenant + valor). valor_pago do recebivel do cliente e capado em valor_total.
--
-- APLICADO+TESTADO 06/jul via MCP (rollback via excecao). VERIFICADO: pagar 50% ->
-- arq 150 (de 300)/cor 75 (de 150)/soma 225 (=450*0.5), status vira 'exigivel'; pagar
-- 100% -> arq 300/cor 150/soma 450. Numeros exatos.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_registrar_recebimento_negocio(
  p_negocio_id uuid, p_tenant_id uuid, p_valor numeric, p_criado_por uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg record; v_valor numeric(14,2); v_receb record; v_total_pago numeric(14,2); v_fracao numeric;
  v_soma_fatias numeric(14,2); v_alvo numeric(14,2); v_soma_exig numeric(14,2) := 0;
  v_residuo numeric(14,2); v_maior_id uuid; t record;
BEGIN
  IF p_tenant_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_tenant'); END IF;
  v_valor := round(COALESCE(p_valor,0),2);
  IF v_valor <= 0 THEN RETURN jsonb_build_object('ok',false,'erro','valor_invalido'); END IF;

  SELECT id, tenant_id, valor_fechado INTO v_neg FROM public.hub_negocios WHERE id=p_negocio_id FOR UPDATE;
  IF NOT FOUND OR v_neg.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok',false,'erro','negocio_nao_encontrado'); END IF;
  IF v_neg.valor_fechado IS NULL OR v_neg.valor_fechado <= 0 THEN
    RETURN jsonb_build_object('ok',false,'erro','negocio_sem_valor_fechado'); END IF;

  SELECT id, valor_total, valor_pago INTO v_receb FROM public.hub_negocio_titulos
    WHERE negocio_id=p_negocio_id AND tenant_id=p_tenant_id AND natureza='recebivel_cliente'
    ORDER BY criado_em LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'erro','sem_recebivel_apurado'); END IF;

  v_total_pago := LEAST(round(v_receb.valor_pago + v_valor, 2), v_receb.valor_total);
  UPDATE public.hub_negocio_titulos SET valor_pago=v_total_pago, atualizado_em=now() WHERE id=v_receb.id;

  v_fracao := v_total_pago / v_neg.valor_fechado;

  SELECT COALESCE(sum(valor_total),0) INTO v_soma_fatias FROM public.hub_negocio_titulos
    WHERE negocio_id=p_negocio_id AND tenant_id=p_tenant_id AND natureza='comissao_split' AND direcao='pagar';
  v_alvo := round(v_soma_fatias * v_fracao, 2);

  FOR t IN SELECT id, valor_total FROM public.hub_negocio_titulos
           WHERE negocio_id=p_negocio_id AND tenant_id=p_tenant_id AND natureza='comissao_split' AND direcao='pagar'
           ORDER BY valor_total DESC, id FOR UPDATE LOOP
    IF v_maior_id IS NULL THEN v_maior_id := t.id; END IF;
    UPDATE public.hub_negocio_titulos
      SET valor_exigivel = round(t.valor_total * v_fracao, 2),
          status = CASE WHEN round(t.valor_total*v_fracao,2) > 0 AND status='apurado' THEN 'exigivel' ELSE status END,
          atualizado_em = now()
      WHERE id = t.id;
    v_soma_exig := v_soma_exig + round(t.valor_total * v_fracao, 2);
  END LOOP;

  v_residuo := round(v_alvo - v_soma_exig, 2);
  IF v_residuo <> 0 AND v_maior_id IS NOT NULL THEN
    UPDATE public.hub_negocio_titulos SET valor_exigivel = valor_exigivel + v_residuo WHERE id=v_maior_id;
  END IF;

  INSERT INTO public.hub_negocio_fin_movimentos (tenant_id,negocio_id,titulo_id,tipo,valor,descricao,criado_por)
  VALUES (p_tenant_id,p_negocio_id,v_receb.id,'recebimento',v_valor,'Recebimento do cliente',p_criado_por);

  RETURN jsonb_build_object('ok',true,'total_pago',v_total_pago,'fracao',round(v_fracao,4),'exigivel_comissoes',v_alvo);
END $$;
REVOKE ALL ON FUNCTION public.rpc_registrar_recebimento_negocio(uuid,uuid,numeric,uuid) FROM anon, public;
