-- ============================================================================
-- FIX de SEGURANÇA + INTEGRIDADE na cascata SC → Estoque (hub_sc_registrar_entrega)
--
-- Dois defeitos REAIS na função em produção (achados pela mesa adversarial 09/jul, confirmados
-- lendo 20260720120000_e5_compras_estoque.sql:240 e :269-281):
--
--  (1) GATE HUMANO CONTORNÁVEL — a função busca o pedido só por (id, tenant_id) e NUNCA checa o
--      `status`. Dá para registrar entrega numa SC em 'rascunho'/'cotando': o material entra no
--      estoque sem ninguém ter APROVADO a compra. O gate humano do PATCH vira decorativo.
--
--  (2) ESTOQUE DUPLICADO NO RETRY — a função SEMPRE insere a ENTRADA no razão com a quantidade
--      pedida pelo caller, e só DEPOIS limita `qtd_entregue` com LEAST(). O inventário é somado do
--      razão (vw_hub_inventario), então um reenvio do celular do canteiro (rede ruim, duplo toque)
--      insere DUAS entradas e o estoque mente. "NADA SE PERDE" protege o histórico, não a soma.
--
-- CORREÇÃO (aditiva, reversível):
--  - `entrega_uid` em hub_estoque_mov + índice único parcial (pedido_item_id, entrega_uid):
--    a mesma entrega reenviada não entra duas vezes. Idempotência REAL, não "melhor esforço".
--  - a função passa a EXIGIR status ∈ ('aprovado','entregue_parcial') — entrega só de compra aprovada.
--  - trava a linha do item (FOR UPDATE) e grava no razão só o DELTA que cabe (nunca além do pedido),
--    fechando também a corrida de dois recebimentos simultâneos.
--
-- SEGURO AGORA: hub_estoque_mov tem ZERO linhas e hub_pedidos_material tem 1 SC — o trilho nunca
-- carregou carga. Consertar antes da carga real é o único momento barato.
--
-- Autorizado pelo dono (janela, 09/jul). ROLLBACK no fim do arquivo.
-- ============================================================================

-- ─── 1) Chave de idempotência da entrega (aditiva, nullable: legado continua válido) ─────────
ALTER TABLE public.hub_estoque_mov
  ADD COLUMN IF NOT EXISTS entrega_uid UUID;

COMMENT ON COLUMN public.hub_estoque_mov.entrega_uid IS
  'Chave de idempotência da ENTREGA (uma por chamada do cliente). Reenvio com o mesmo uid não cria '
  'segunda entrada no razão. NULL = movimento humano (saída/devolução/ajuste) ou entrada legada.';

-- Único por (item, uid) — parcial: só onde há uid. Não afeta saída/devolução/ajuste.
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_estoque_mov_entrega
  ON public.hub_estoque_mov (pedido_item_id, entrega_uid)
  WHERE entrega_uid IS NOT NULL;

-- ─── 2) A função corrigida ───────────────────────────────────────────────────────────────────
-- Assinatura NOVA (ganha p_entrega_uid com DEFAULT). Dropar a antiga evita sobrecarga ambígua:
-- o caller continua chamando com 5 argumentos nomeados e o 6º cai no default.
DROP FUNCTION IF EXISTS public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.hub_sc_registrar_entrega(
  p_pedido_id      uuid,
  p_tenant_id      uuid,
  p_itens          jsonb,            -- [{ item_id, qtd }]
  p_registrado_por text DEFAULT NULL,
  p_obs            text DEFAULT NULL,
  p_entrega_uid    uuid DEFAULT NULL -- idempotência: mesma entrega reenviada não duplica
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item     jsonb;
  v_it       public.hub_pedido_itens%ROWTYPE;
  v_obra     uuid;
  v_status   text;
  v_qtd      numeric;
  v_aplicado numeric;
  v_all      boolean;
  v_registradas int := 0;
  v_ignoradas   int := 0;   -- reenvio idempotente (nada a fazer)
  v_codigo   text;
  v_mov_id   uuid;
BEGIN
  -- 0) GUARD tenant explícito (SECURITY DEFINER bypassa RLS — a posse é checada aqui).
  SELECT obra_id, status INTO v_obra, v_status
    FROM public.hub_pedidos_material
    WHERE id = p_pedido_id AND tenant_id = p_tenant_id;
  IF v_obra IS NULL THEN
    RAISE EXCEPTION 'pedido_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- 0.1) GATE HUMANO (fix 1): só compra APROVADA recebe material. Rascunho/cotando/cancelado não
  --      entram no estoque — aprovar continua sendo decisão humana na tela.
  IF v_status NOT IN ('aprovado', 'entregue_parcial') THEN
    RAISE EXCEPTION 'sc_nao_aprovada' USING ERRCODE = 'P0001',
      DETAIL = format('status atual: %s', v_status);
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'itens_invalidos' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := COALESCE((v_item->>'qtd')::numeric, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;

    -- Trava a linha do item: dois recebimentos simultâneos não leem o mesmo qtd_entregue.
    SELECT * INTO v_it FROM public.hub_pedido_itens
      WHERE id = (v_item->>'item_id')::uuid
        AND tenant_id = p_tenant_id
        AND pedido_id = p_pedido_id
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- (fix 2a) grava só o DELTA que ainda cabe no pedido — o razão nunca ultrapassa o pedido.
    v_aplicado := LEAST(v_qtd, v_it.qtd_pedida - v_it.qtd_entregue);
    IF v_aplicado <= 0 THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    v_codigo := NULL;
    IF v_it.catalogo_id IS NOT NULL THEN
      SELECT codigo INTO v_codigo FROM public.hub_catalogo
        WHERE id = v_it.catalogo_id AND (tenant_id = p_tenant_id OR tenant_id IS NULL);
    END IF;

    -- (fix 2b) IDEMPOTÊNCIA: com uid, o reenvio colide no índice único e não vira segunda entrada.
    INSERT INTO public.hub_estoque_mov(
      obra_id, tenant_id, catalogo_id, codigo_catalogo, descricao, categoria, unidade,
      tipo, quantidade, pedido_id, pedido_item_id, frente_id, registrado_por, motivo, origem, entrega_uid
    ) VALUES (
      v_obra, p_tenant_id, v_it.catalogo_id, v_codigo, v_it.descricao_snapshot, v_it.categoria,
      v_it.unidade, 'entrada', v_aplicado, p_pedido_id, v_it.id, NULL, p_registrado_por, p_obs,
      'sistema', p_entrega_uid
    )
    ON CONFLICT (pedido_item_id, entrega_uid) WHERE entrega_uid IS NOT NULL DO NOTHING
    RETURNING id INTO v_mov_id;

    IF v_mov_id IS NULL THEN
      -- reenvio exato da mesma entrega: o razão já tem a linha. Não mexe no saldo do item.
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    UPDATE public.hub_pedido_itens
      SET qtd_entregue = qtd_entregue + v_aplicado, atualizado_em = NOW()
      WHERE id = v_it.id;

    v_registradas := v_registradas + 1;
  END LOOP;

  -- Status do pedido: tudo entregue → 'entregue'; senão 'entregue_parcial'.
  -- Pedido SEM itens (legado de descrição livre) → bool_and NULL → tratamos como 'entregue'.
  SELECT COALESCE(bool_and(qtd_entregue >= qtd_pedida), true) INTO v_all
    FROM public.hub_pedido_itens WHERE pedido_id = p_pedido_id;

  UPDATE public.hub_pedidos_material
    SET status          = CASE WHEN v_all THEN 'entregue' ELSE 'entregue_parcial' END,
        entrega_parcial = NOT v_all,
        entregue_em     = CASE WHEN v_all THEN NOW() ELSE entregue_em END,
        atualizado_em   = NOW()
    WHERE id = p_pedido_id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', CASE WHEN v_all THEN 'entregue' ELSE 'entregue_parcial' END,
    'entradas_registradas', v_registradas,
    'entradas_ignoradas', v_ignoradas,
    'sugerir_resolver_restricao', (SELECT restricao_id FROM public.hub_pedidos_material WHERE id = p_pedido_id)
  );
END $$;

REVOKE ALL ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) IS
  'E5 (corrigida 09/jul): cascata SC→Inventário. EXIGE status aprovado/entregue_parcial (o gate humano '
  'da compra não é contornável). Grava no razão só o delta que cabe no pedido, com FOR UPDATE no item '
  '(anti-corrida) e idempotência por entrega_uid (reenvio do canteiro não duplica estoque).';

-- ─── 3) Verificação embutida ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tem_col   boolean;
  v_tem_idx   boolean;
  v_tem_func  boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='hub_estoque_mov' AND column_name='entrega_uid')
    INTO v_tem_col;
  SELECT EXISTS (SELECT 1 FROM pg_indexes
                 WHERE schemaname='public' AND indexname='uq_hub_estoque_mov_entrega')
    INTO v_tem_idx;
  SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='public' AND p.proname='hub_sc_registrar_entrega'
                   AND p.pronargs = 6)
    INTO v_tem_func;

  IF NOT v_tem_col  THEN RAISE EXCEPTION 'FALHA: coluna entrega_uid ausente'; END IF;
  IF NOT v_tem_idx  THEN RAISE EXCEPTION 'FALHA: índice uq_hub_estoque_mov_entrega ausente'; END IF;
  IF NOT v_tem_func THEN RAISE EXCEPTION 'FALHA: função de 6 args ausente'; END IF;
  RAISE NOTICE 'OK: gate de status + idempotência de entrega aplicados.';
END $$;

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid);
--   DROP INDEX IF EXISTS public.uq_hub_estoque_mov_entrega;
--   ALTER TABLE public.hub_estoque_mov DROP COLUMN IF EXISTS entrega_uid;
--   -- e recriar a função de 5 args do arquivo 20260720120000_e5_compras_estoque.sql (linhas 221-307).
-- ============================================================================
