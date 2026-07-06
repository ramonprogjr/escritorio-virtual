-- ════════════════════════════════════════════════════════════════════════════
-- rpc_apurar_comissoes — CONGELA a comissao de um negocio a partir do SPLIT que o
-- HUMANO CONFIRMOU (a regra so pre-preenche a sugestao; a RPC nao depende do mapeamento
-- automatico de papeis). APLICADO+TESTADO em 06/jul via MCP.
--
-- TESTE sintetico (rollback via excecao) VERIFICADO: pote=500 (10000x5%), fatias 300+150=450,
-- residual Hub=50, soma das comissoes = pote (nada some/nasce), 3 titulos, idempotente, fail-closed.
-- comissao_calculada e coluna GERADA (valor_fechado*percentual/100) — o teste pegou isso: a RPC
-- so seta valor_fechado; o pote e calculado pelo banco e bate com v_pote.
--
-- Cash-basis (decisao do dono): titulos nascem 'apurado' com valor_exigivel=0; viram exigiveis
-- pro-rata quando o cliente PAGA (rpc_registrar_recebimento_negocio — proxima). Residual do Hub
-- e fatia declarada (juiz declarado). Comissao do Hub nao se devolve (decisao do dono).
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_apurar_comissoes(
  p_negocio_id uuid, p_tenant_id uuid, p_valor_fechado numeric, p_fatias jsonb, p_criado_por uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_neg record; v_pote numeric(14,2); v_soma numeric(14,2) := 0; v_residual numeric(14,2);
  v_pct numeric; f jsonb; v_com_id uuid; v_val numeric(14,2);
BEGIN
  IF p_tenant_id IS NULL THEN RETURN jsonb_build_object('ok',false,'erro','sem_tenant'); END IF;
  SELECT id, tenant_id, percentual_comissao INTO v_neg FROM public.hub_negocios WHERE id=p_negocio_id FOR UPDATE;
  IF NOT FOUND OR v_neg.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RETURN jsonb_build_object('ok',false,'erro','negocio_nao_encontrado'); END IF;
  IF EXISTS (SELECT 1 FROM public.hub_comissoes WHERE negocio_id=p_negocio_id AND apuracao_seq=1) THEN
    RETURN jsonb_build_object('ok',true,'ja_apurado',true); END IF;
  IF p_valor_fechado IS NULL OR p_valor_fechado <= 0 THEN
    RETURN jsonb_build_object('ok',false,'erro','sem_valor_fechado'); END IF;

  v_pct := COALESCE(v_neg.percentual_comissao, 0);
  v_pote := round(p_valor_fechado * v_pct / 100.0, 2);
  IF v_pote <= 0 THEN RETURN jsonb_build_object('ok',false,'erro','pote_zero'); END IF;

  FOR f IN SELECT * FROM jsonb_array_elements(COALESCE(p_fatias,'[]'::jsonb)) LOOP
    v_soma := v_soma + COALESCE((f->>'valor')::numeric,0); END LOOP;
  IF v_soma > v_pote + 0.005 THEN
    RETURN jsonb_build_object('ok',false,'erro','fatias_excedem_pote','pote',v_pote,'soma',v_soma); END IF;

  UPDATE public.hub_negocios SET valor_fechado=p_valor_fechado WHERE id=p_negocio_id AND tenant_id=p_tenant_id;

  INSERT INTO public.hub_negocio_titulos
    (tenant_id,negocio_id,direcao,natureza,contraparte_tipo,contraparte_nome,valor_total,valor_exigivel,status,criado_por)
  VALUES (p_tenant_id,p_negocio_id,'receber','recebivel_cliente','cliente','Cliente do negocio',p_valor_fechado,0,'apurado',p_criado_por);

  FOR f IN SELECT * FROM jsonb_array_elements(p_fatias) LOOP
    v_val := round(COALESCE((f->>'valor')::numeric,0),2);
    INSERT INTO public.hub_comissoes
      (tenant_id,negocio_id,apuracao_seq,beneficiario_tipo,beneficiario_id,beneficiario_nome,papel,base_valor,pool_pct,pct_aplicado,valor,regra_id,regra_origem,criado_por)
    VALUES (p_tenant_id,p_negocio_id,1,f->>'beneficiario_tipo',NULLIF(f->>'beneficiario_id','')::uuid,f->>'beneficiario_nome',f->>'papel',
            v_pote,v_pct, CASE WHEN v_pote>0 THEN round(v_val/v_pote*100,3) ELSE 0 END, v_val,
            NULLIF(f->>'regra_id','')::uuid, COALESCE(f->>'regra_origem','manual'), p_criado_por)
    RETURNING id INTO v_com_id;
    INSERT INTO public.hub_negocio_titulos
      (tenant_id,negocio_id,comissao_id,direcao,natureza,contraparte_tipo,contraparte_id,contraparte_nome,valor_total,valor_exigivel,status,criado_por)
    VALUES (p_tenant_id,p_negocio_id,v_com_id,'pagar','comissao_split',f->>'beneficiario_tipo',NULLIF(f->>'beneficiario_id','')::uuid,f->>'beneficiario_nome',v_val,0,'apurado',p_criado_por);
  END LOOP;

  v_residual := round(v_pote - v_soma, 2);
  IF v_residual > 0 THEN
    INSERT INTO public.hub_comissoes
      (tenant_id,negocio_id,apuracao_seq,beneficiario_tipo,beneficiario_nome,papel,base_valor,pool_pct,pct_aplicado,valor,regra_origem,criado_por)
    VALUES (p_tenant_id,p_negocio_id,1,'hub','Hub (plataforma)','taxa_plataforma',v_pote,v_pct,round(v_residual/v_pote*100,3),v_residual,'residual_hub',p_criado_por);
  END IF;

  RETURN jsonb_build_object('ok',true,'pote',v_pote,'soma_fatias',v_soma,'residual_hub',v_residual);
END $$;
REVOKE ALL ON FUNCTION public.rpc_apurar_comissoes(uuid,uuid,numeric,jsonb,uuid) FROM anon, public;
