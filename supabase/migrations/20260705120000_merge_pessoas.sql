-- ============================================================================
-- MERGE DE DUPLICATAS DE PESSOAS — colunas de soft-archive + log + RPC atômica.
--
-- PRIORIDADE #1 do dono: unificar contatos duplicados (mesmo CPF/CNPJ/telefone)
-- SEM perder dados nem vínculos. Decisões do CEO embutidas nesta RPC:
--   • Vencedor é escolhido pela APP (mais campos preenchidos; empate → menor
--     criado_em); o operador pode inverter na tela. A RPC recebe p_vencedor /
--     p_perdedor já decididos.
--   • NUNCA sobrescreve texto preenchido do vencedor: campo divergente vai para
--     dados_extras.merge_origem (auditável/reversível). Só COPIA campo VAZIO.
--   • documentos DIFERENTES preenchidos → NÃO são duplicata → ABORTA (exception).
--   • Perdedor é ARQUIVADO (soft), NUNCA deletado — hub_pessoas_empresas tem
--     ON DELETE CASCADE em pessoa_id; deletar apagaria os vínculos do perdedor.
--
-- ADITIVO + IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
-- CREATE OR REPLACE FUNCTION. NÃO APLICAR automaticamente — só versionar. O dono
-- aplica (e liga a flag NEXT_PUBLIC_CRM_MERGE_DUPLICATAS) após aprovar o 1º par.
--
-- ROLLBACK no fim do arquivo.
-- ============================================================================

-- ── 1. Colunas de soft-archive em hub_pessoas ───────────────────────────────
ALTER TABLE public.hub_pessoas
  ADD COLUMN IF NOT EXISTS arquivado_em      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS merge_vencedor_id UUID;

COMMENT ON COLUMN public.hub_pessoas.arquivado_em IS
  'Quando preenchido, a pessoa foi arquivada (soft) por merge — não listar como ativa.';
COMMENT ON COLUMN public.hub_pessoas.merge_vencedor_id IS
  'Pessoa vencedora que absorveu este registo no merge (aponta para hub_pessoas.id).';

-- Índice parcial: listagens ativas filtram arquivado_em IS NULL (barato).
CREATE INDEX IF NOT EXISTS idx_hub_pessoas_ativas
  ON public.hub_pessoas (tenant_id)
  WHERE arquivado_em IS NULL;

-- ── 2. Log de auditoria do merge (reversível) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_merge_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID,
  vencedor_id  UUID NOT NULL,
  perdedor_id  UUID NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- snapshot pré-merge + reapontamentos
  feito_por    UUID,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_merge_log_tenant ON public.hub_merge_log (tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_merge_log_perdedor ON public.hub_merge_log (perdedor_id);

ALTER TABLE public.hub_merge_log ENABLE ROW LEVEL SECURITY;  -- só a RPC (definer) escreve
COMMENT ON TABLE public.hub_merge_log IS
  'Auditoria de merges de pessoas: snapshot pré-merge + FKs reapontadas (para reversão manual).';

-- ── 3. RPC atômica de merge ─────────────────────────────────────────────────
-- SECURITY DEFINER: roda como dono da função, ignora RLS das tabelas tocadas.
-- A autorização de QUEM pode chamar fica na API (requireCrmGestor + flag); aqui
-- validamos as invariantes de dados (mesmo tenant + documentos não-conflitantes).
CREATE OR REPLACE FUNCTION public.crm_merge_pessoas(
  p_vencedor UUID,
  p_perdedor UUID,
  p_tenant   UUID,
  p_user     UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venc      public.hub_pessoas%ROWTYPE;
  v_perd      public.hub_pessoas%ROWTYPE;
  v_first     UUID;
  v_second    UUID;
  v_doc_v     TEXT;
  v_doc_p     TEXT;
  v_extras    JSONB;
  v_origem    JSONB := '{}'::jsonb;
  v_updates   JSONB := '{}'::jsonb;
  v_reaponta  JSONB := '{}'::jsonb;
  v_n         INT;
  v_now       TIMESTAMPTZ := now();
  -- Campos de texto copiáveis (aditivo) — endereço incluído.
  v_campos    TEXT[] := ARRAY[
    'email','telefone','documento','tipo_pessoa','empresa','origem','area_atuacao',
    'cep','logradouro','numero','complemento','bairro','cidade','estado'
  ];
  v_campo     TEXT;
  v_val_v     TEXT;
  v_val_p     TEXT;
  v_set_sql   TEXT := '';
BEGIN
  IF p_vencedor IS NULL OR p_perdedor IS NULL THEN
    RAISE EXCEPTION 'merge: vencedor e perdedor são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  IF p_vencedor = p_perdedor THEN
    RAISE EXCEPTION 'merge: vencedor e perdedor não podem ser o mesmo registo.' USING ERRCODE = '22023';
  END IF;

  -- Anti-deadlock: travar SEMPRE na ordem LEAST/GREATEST (dois merges cruzados
  -- não esperam um pelo outro em ordem inversa).
  v_first  := LEAST(p_vencedor, p_perdedor);
  v_second := GREATEST(p_vencedor, p_perdedor);
  PERFORM 1 FROM public.hub_pessoas WHERE id = v_first  FOR UPDATE;
  PERFORM 1 FROM public.hub_pessoas WHERE id = v_second FOR UPDATE;

  SELECT * INTO v_venc FROM public.hub_pessoas WHERE id = p_vencedor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge: pessoa vencedora não encontrada.' USING ERRCODE = 'no_data_found';
  END IF;
  SELECT * INTO v_perd FROM public.hub_pessoas WHERE id = p_perdedor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'merge: pessoa perdedora não encontrada.' USING ERRCODE = 'no_data_found';
  END IF;

  -- Já arquivada? evita merge em cadeia / duplo-clique.
  IF v_perd.arquivado_em IS NOT NULL THEN
    RAISE EXCEPTION 'merge: a pessoa perdedora já está arquivada.' USING ERRCODE = '22023';
  END IF;
  IF v_venc.arquivado_em IS NOT NULL THEN
    RAISE EXCEPTION 'merge: a pessoa vencedora está arquivada.' USING ERRCODE = '22023';
  END IF;

  -- Mesmo tenant (tratando legado tenant_id NULL como o tenant informado).
  IF COALESCE(v_venc.tenant_id, p_tenant) <> COALESCE(v_perd.tenant_id, p_tenant) THEN
    RAISE EXCEPTION 'merge: as duas pessoas pertencem a tenants diferentes.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_venc.tenant_id, p_tenant) <> p_tenant
     OR COALESCE(v_perd.tenant_id, p_tenant) <> p_tenant THEN
    RAISE EXCEPTION 'merge: pessoa fora do tenant da sessão.' USING ERRCODE = '22023';
  END IF;

  -- Documentos DIFERENTES preenchidos → não são a mesma pessoa → ABORTA.
  v_doc_v := NULLIF(regexp_replace(COALESCE(v_venc.documento, ''), '\D', '', 'g'), '');
  v_doc_p := NULLIF(regexp_replace(COALESCE(v_perd.documento, ''), '\D', '', 'g'), '');
  IF v_doc_v IS NOT NULL AND v_doc_p IS NOT NULL AND v_doc_v <> v_doc_p THEN
    RAISE EXCEPTION 'merge: documentos diferentes — não são duplicata (%, %).', v_doc_v, v_doc_p
      USING ERRCODE = '22023';
  END IF;

  -- ── Reaponta FKs do perdedor → vencedor ────────────────────────────────────
  -- hub_leads_crm.pessoa_id (UUID solto, sem FK física)
  UPDATE public.hub_leads_crm SET pessoa_id = p_vencedor WHERE pessoa_id = p_perdedor;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_reaponta := v_reaponta || jsonb_build_object('hub_leads_crm', v_n);

  -- hub_negocios.pessoa_id (UUID solto, sem FK física) — só se a coluna existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_negocios' AND column_name = 'pessoa_id'
  ) THEN
    UPDATE public.hub_negocios SET pessoa_id = p_vencedor WHERE pessoa_id = p_perdedor;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_reaponta := v_reaponta || jsonb_build_object('hub_negocios', v_n);
  END IF;

  -- hub_encaminhamentos.destinatario_pessoa_id (UUID solto) — reaponta se existir.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hub_encaminhamentos'
      AND column_name = 'destinatario_pessoa_id'
  ) THEN
    UPDATE public.hub_encaminhamentos
       SET destinatario_pessoa_id = p_vencedor
     WHERE destinatario_pessoa_id = p_perdedor;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_reaponta := v_reaponta || jsonb_build_object('hub_encaminhamentos', v_n);
  END IF;

  -- hub_negocio_vinculos: entidade pessoa. DELETA as linhas do perdedor que
  -- colidiriam com o vencedor (mesmo negocio_id + papel) e reaponta o resto.
  -- UNIQUE = (negocio_id, entidade_tipo, entidade_id, papel).
  DELETE FROM public.hub_negocio_vinculos perd
   WHERE perd.entidade_tipo = 'pessoa'
     AND perd.entidade_id = p_perdedor
     AND EXISTS (
       SELECT 1 FROM public.hub_negocio_vinculos venc
        WHERE venc.entidade_tipo = 'pessoa'
          AND venc.entidade_id = p_vencedor
          AND venc.negocio_id = perd.negocio_id
          AND venc.papel = perd.papel
     );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_reaponta := v_reaponta || jsonb_build_object('hub_negocio_vinculos_del', v_n);
  UPDATE public.hub_negocio_vinculos
     SET entidade_id = p_vencedor
   WHERE entidade_tipo = 'pessoa' AND entidade_id = p_perdedor;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_reaponta := v_reaponta || jsonb_build_object('hub_negocio_vinculos_upd', v_n);

  -- hub_pessoas_empresas (FK CASCADE): DELETA as linhas do perdedor que
  -- colidiriam (mesma empresa_id já vinculada ao vencedor) e reaponta o resto.
  -- UNIQUE = (pessoa_id, empresa_id).
  DELETE FROM public.hub_pessoas_empresas perd
   WHERE perd.pessoa_id = p_perdedor
     AND EXISTS (
       SELECT 1 FROM public.hub_pessoas_empresas venc
        WHERE venc.pessoa_id = p_vencedor
          AND venc.empresa_id = perd.empresa_id
     );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_reaponta := v_reaponta || jsonb_build_object('hub_pessoas_empresas_del', v_n);
  UPDATE public.hub_pessoas_empresas
     SET pessoa_id = p_vencedor
   WHERE pessoa_id = p_perdedor;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_reaponta := v_reaponta || jsonb_build_object('hub_pessoas_empresas_upd', v_n);

  -- ── Copia campos VAZIOS do vencedor a partir do perdedor (aditivo) ─────────
  -- telefone/documento têm índice UNIQUE GLOBAL parcial. Para copiá-los ao
  -- vencedor sem violar o índice (o perdedor permanece na tabela, só arquivado),
  -- LIMPAMOS o valor no perdedor ANTES de gravá-lo no vencedor.
  FOREACH v_campo IN ARRAY v_campos LOOP
    EXECUTE format('SELECT ($1).%I::text', v_campo) INTO v_val_v USING v_venc;
    EXECUTE format('SELECT ($1).%I::text', v_campo) INTO v_val_p USING v_perd;
    v_val_v := NULLIF(btrim(COALESCE(v_val_v, '')), '');
    v_val_p := NULLIF(btrim(COALESCE(v_val_p, '')), '');

    IF v_val_v IS NULL AND v_val_p IS NOT NULL THEN
      -- Vencedor vazio: copia do perdedor.
      IF v_campo IN ('telefone', 'documento') THEN
        -- libera o índice único global removendo do perdedor primeiro
        EXECUTE format('UPDATE public.hub_pessoas SET %I = NULL WHERE id = $1', v_campo)
          USING p_perdedor;
      END IF;
      v_set_sql := v_set_sql || format('%I = %L, ', v_campo, v_val_p);
      v_updates := v_updates || jsonb_build_object(v_campo, v_val_p);
    ELSIF v_val_v IS NOT NULL AND v_val_p IS NOT NULL AND v_val_v <> v_val_p THEN
      -- Ambos preenchidos e divergentes: vencedor MANTÉM; perdedor vai p/ origem.
      v_origem := v_origem || jsonb_build_object(v_campo, v_val_p);
    END IF;
  END LOOP;

  -- Aplica os campos copiados + carimbo no vencedor.
  IF v_set_sql <> '' OR v_origem <> '{}'::jsonb THEN
    SELECT COALESCE(dados_extras, '{}'::jsonb) INTO v_extras
      FROM public.hub_pessoas WHERE id = p_vencedor;
    IF v_origem <> '{}'::jsonb THEN
      v_extras := v_extras || jsonb_build_object(
        'merge_origem',
        COALESCE(v_extras->'merge_origem', '{}'::jsonb) || jsonb_build_object(
          p_perdedor::text, jsonb_build_object('campos', v_origem, 'em', v_now)
        )
      );
    END IF;
    EXECUTE format(
      'UPDATE public.hub_pessoas SET %s dados_extras = $2, atualizado_em = $3 WHERE id = $1',
      v_set_sql
    ) USING p_vencedor, v_extras, v_now;
  END IF;

  -- ── Arquiva o perdedor (soft) ──────────────────────────────────────────────
  UPDATE public.hub_pessoas
     SET arquivado_em = v_now,
         merge_vencedor_id = p_vencedor,
         atualizado_em = v_now
   WHERE id = p_perdedor;

  -- ── Log de auditoria (snapshot pré-merge + reapontamentos) ─────────────────
  INSERT INTO public.hub_merge_log (tenant_id, vencedor_id, perdedor_id, payload, feito_por)
  VALUES (
    p_tenant, p_vencedor, p_perdedor,
    jsonb_build_object(
      'vencedor_antes', to_jsonb(v_venc),
      'perdedor_antes', to_jsonb(v_perd),
      'campos_copiados', v_updates,
      'campos_divergentes_origem', v_origem,
      'reapontamentos', v_reaponta,
      'em', v_now
    ),
    p_user
  );

  RETURN jsonb_build_object(
    'ok', true,
    'vencedor_id', p_vencedor,
    'perdedor_id', p_perdedor,
    'campos_copiados', v_updates,
    'campos_divergentes_origem', v_origem,
    'reapontamentos', v_reaponta
  );
END;
$$;

REVOKE ALL ON FUNCTION public.crm_merge_pessoas(uuid, uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.crm_merge_pessoas(uuid, uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.crm_merge_pessoas(uuid, uuid, uuid, uuid) IS
  'Merge atômico de pessoas duplicadas: reaponta FKs, copia campos vazios, arquiva o perdedor (soft) e loga. Autorização (gestor/owner + flag) é na API.';

-- ============================================================================
-- ROLLBACK (manual, se preciso reverter o esquema):
--   DROP FUNCTION IF EXISTS public.crm_merge_pessoas(uuid, uuid, uuid, uuid);
--   DROP TABLE IF EXISTS public.hub_merge_log;
--   DROP INDEX IF EXISTS public.idx_hub_pessoas_ativas;
--   ALTER TABLE public.hub_pessoas
--     DROP COLUMN IF EXISTS arquivado_em,
--     DROP COLUMN IF EXISTS merge_vencedor_id;
--
-- REVERTER UM MERGE ESPECÍFICO (a partir de hub_merge_log.payload):
--   1. UPDATE hub_pessoas SET arquivado_em = NULL, merge_vencedor_id = NULL,
--        <campos do perdedor a partir de payload->'perdedor_antes'> WHERE id = perdedor_id;
--   2. Reapontar de volta hub_leads_crm / hub_negocios / hub_encaminhamentos /
--      vinculos para perdedor_id (linhas DELETADAS por colisão NÃO voltam — eram
--      redundantes com o vencedor; ver payload->'reapontamentos' para contagens).
--   NOTA: hub_operarios_checkin.pessoa_id (módulo Obra) NÃO é reapontado pelo
--   merge — o perdedor é só arquivado (linha continua válida), sem orfanar nada.
--   3. Restaurar dados_extras do vencedor a partir de payload->'vencedor_antes'.
-- ============================================================================
