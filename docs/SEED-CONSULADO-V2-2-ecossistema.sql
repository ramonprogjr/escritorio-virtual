-- ============================================================================
-- SEED CONSULADO V2 — ARQUIVO 2 de 4 : ECOSSISTEMA (reancora ARQ + popula)
-- ============================================================================
-- ORDEM: rode DEPOIS do Arquivo 0 (restore-point) e do Arquivo 1 (ddl).
-- Rodar como service_role, na janela do dono. Tudo num unico DO block
-- transacional (BEGIN/EXCEPTION implicitos do bloco): se qualquer passo falhar,
-- nada e gravado.
--
-- DECISOES DO CEO (delegadas pelo dono) aplicadas aqui:
--   (1) A RAIZ (fonte de rastreio) = o PRIMEIRO e PRINCIPAL negocio da jornada,
--       de QUALQUER mercado. NAO existe "arquitetura como regra". A ARQ aqui e so
--       porque, NESTE caso do Consulado, a primeira oportunidade no Hub foi a
--       arquitetura (Takiguthi) — entao a raiz vira o negocio ARQ e a linhagem
--       existente (NGENG->NGMRC) reancora sob ele. Noutra jornada que comece, por
--       ex., por venda de imovel, a raiz seria IMB. A regra e "primeiro+principal",
--       nunca o mercado.
--   (2) PRODUTO fica DEFERIDO: o fornecedor vira um NEGOCIO derivado no mercado
--       PRO (pipeline de Produtos/Materiais). NAO cria tabela hub_produtos.
--   (3) DDL ja foi rodado no Arquivo 1.
--
-- PRINCIPIOS
--   - Codigo de identidade e gerado por TRIGGER: os INSERT de empresa/pessoa/
--     negocio NAO informam `codigo` (deixa a trigger preencher).
--   - Idempotente: entidades com codigo-gerado usam guarda IF NOT EXISTS por UUID
--     fixo (evita QUEIMAR numeros de codigo a cada re-execucao — um ON CONFLICT
--     DO NOTHING dispararia a trigger e gastaria o contador mesmo pulando a linha).
--     Tabelas de relacao usam ON CONFLICT no indice unico natural.
--   - TRAVA DE OURO: tenant_id em TODA linha; pipeline_id em TODO negocio;
--     etapa/estagio com slug valido; users login-off status=Inativo; valido_de
--     preenchido em pessoas_empresas.
--
-- IDs FIXOS (UUID "seed-tag" prefixo 5eedc02a = seed-consulado-v2). Estaveis
-- entre re-execucoes; usados como ancora do rollback (Arquivo 4).
-- ============================================================================

DO $$
DECLARE
  -- tenant unico ------------------------------------------------------------
  v_tenant   uuid := '00000000-0000-4000-8000-000000000001';

  -- pipelines (confirmados; todos com estagios novo/qualificando/qualificado/
  -- proposta/negociando/fechamento/ganho/perdido) --------------------------
  v_pipe_arq uuid := '024c0e7d-eaf2-409c-bf2a-1ca259158789';
  v_pipe_eng uuid := 'ac30946f-e9f2-4bcd-a64e-957b48ee311b';
  v_pipe_mrc uuid := 'dd2ea8cc-016b-4f57-a9ee-cc5f75f92814';
  v_pipe_srv uuid := 'e98488e7-76af-487d-9ae0-435ebab6038f';
  v_pipe_pro uuid := 'd536e83a-7a66-4a6a-bc1d-7448fe997bd4';
  v_pipe_prj uuid := 'eaee3615-6cd2-4484-9925-b72126656763'; -- funil de PROJETO arq

  -- linhagem existente ------------------------------------------------------
  v_ngeng    uuid := '71c3ce20-e445-4435-960c-0867ec054f64'; -- NGENG2026013 (raiz hoje)
  v_ngmrc    uuid := 'd84fb83f-66cc-490b-b1f1-220bf1096dd8'; -- NGMRC2026014 (filho)

  -- empresas existentes -----------------------------------------------------
  v_emp_nice      uuid := 'aa1bd065-528c-4d93-b21d-b85ef2d01fbd'; -- EM2026001 Nice Eng.
  v_emp_takiguthi uuid := '49ec043d-95aa-4087-b051-cf7a7c39ce29'; -- EM2026002 Takiguthi
  v_emp_consulado uuid := '58b4156b-ec6e-451e-afec-379afa5c6122'; -- EM2026003 Consulado
  v_emp_marcen    uuid := '98a0d31e-ff0f-4857-bc29-f178be91d53a'; -- EM2026004 Marcenaria

  -- pessoas existentes ------------------------------------------------------
  v_pes_marcos     uuid := 'eccf238e-9d5a-4b1b-a153-b32357ad8782'; -- PS2026004 Marcos
  v_pes_niceresp   uuid := 'eaccfdd3-bd61-4612-9b0a-30ef311c8914'; -- PS2026005 Nice-resp
  v_pes_consulrep  uuid := '0ce3273f-3562-4de0-98cc-083678f9cdfd'; -- PS2026006 Consulado-rep

  -- NOVAS entidades (UUID fixo seed-tag) ------------------------------------
  v_ngarq          uuid := '5eedc02a-0001-4000-8000-000000000001'; -- negocio raiz ARQ

  v_emp_perdedora  uuid := '5eedc02a-0002-4000-8000-000000000001'; -- engenharia perdedora
  v_emp_prestador  uuid := '5eedc02a-0002-4000-8000-000000000002'; -- prestador de servico
  v_emp_fornecedor uuid := '5eedc02a-0002-4000-8000-000000000003'; -- fornecedor de produtos

  v_pes_wendel     uuid := '5eedc02a-0003-4000-8000-000000000001'; -- Wendel Cruz (Nice)
  v_pes_func1      uuid := '5eedc02a-0003-4000-8000-000000000002'; -- Eng. Residente (Nice)
  v_pes_func2      uuid := '5eedc02a-0003-4000-8000-000000000003'; -- Mestre de Obras (Nice)
  v_pes_prest      uuid := '5eedc02a-0003-4000-8000-000000000004'; -- pessoa do prestador
  v_pes_forn       uuid := '5eedc02a-0003-4000-8000-000000000005'; -- pessoa do fornecedor

  v_neg_perdedora  uuid := '5eedc02a-0004-4000-8000-000000000001'; -- negocio ENG perdedor
  v_neg_srv        uuid := '5eedc02a-0004-4000-8000-000000000002'; -- negocio SRV (prestador)
  v_neg_pro        uuid := '5eedc02a-0004-4000-8000-000000000003'; -- negocio PRO (fornecedor)

  v_usr_wendel     uuid := '5eedc02a-0005-4000-8000-000000000001';
  v_usr_func1      uuid := '5eedc02a-0005-4000-8000-000000000002';
  v_usr_func2      uuid := '5eedc02a-0005-4000-8000-000000000003';
  v_usr_prest      uuid := '5eedc02a-0005-4000-8000-000000000004';
  v_usr_forn       uuid := '5eedc02a-0005-4000-8000-000000000005';

  v_selo jsonb := '{"seed":"ecossistema-consulado-v2"}'::jsonb;
BEGIN
  -- ==========================================================================
  -- PARTE A — REANCORAR (ordem obrigatoria pela imutabilidade da linhagem)
  -- ==========================================================================

  -- (A1) Cria o negocio raiz ARQUITETURA (pai=NULL => raiz de si mesmo).
  --      codigo omitido: trigger trg_auto_codigo_negocio gera NGARQ....
  IF NOT EXISTS (SELECT 1 FROM public.hub_negocios WHERE id = v_ngarq) THEN
    INSERT INTO public.hub_negocios
      (id, titulo, tipo, prefixo_mercado, pipeline_id, mercado_slug,
       empresa_id, pessoa_id, status, etapa, negocio_pai_id, tenant_id)
    VALUES
      (v_ngarq,
       'Consulado da Italia — Projeto Arquitetonico',
       'produto_servico', 'ARQ', v_pipe_arq, 'arquitetura',
       v_emp_consulado, v_pes_consulrep,
       'em_negociacao', 'proposta',
       NULL, v_tenant);
  END IF;

  -- (A2) Reancora a NGENG sob a NGARQ. A trigger hub_negocio_set_raiz recomputa
  --      negocio_raiz_id = NGARQ. Como hoje NGENG.pai=NULL, a reancoragem e
  --      permitida (a imutabilidade so bloqueia trocar um pai JA definido).
  --      Re-execucao e segura: NEW.pai == OLD.pai => sem excecao.
  UPDATE public.hub_negocios
     SET negocio_pai_id = v_ngarq,
         pipeline_id    = v_pipe_eng,
         mercado_slug   = 'engenharia'
   WHERE id = v_ngeng;

  -- (A3) "Toca" a NGMRC (no-op no pai) para reprocessar a raiz DEPOIS que a
  --      NGENG ja aponta para NGARQ => NGMRC.raiz vira NGARQ tambem.
  --      Tem de vir depois de (A2). Ajusta pipeline/mercado da marcenaria.
  UPDATE public.hub_negocios
     SET negocio_pai_id = negocio_pai_id,   -- no-op: dispara trigger de raiz
         pipeline_id    = v_pipe_mrc,
         mercado_slug   = 'marcenaria'
   WHERE id = v_ngmrc;

  -- (A4) Projeto arquitetonico do Consulado passa a viver no funil de PROJETO.
  --      estagio atual = 'anteprojeto' (slug valido do funil), preservado.
  UPDATE public.hub_projetos
     SET pipeline_id = v_pipe_prj
   WHERE codigo = 'PRJ-2026-0003';

  -- ==========================================================================
  -- PARTE B — POPULAR (seed minimo-representativo: prova cada aresta 1x)
  -- ==========================================================================

  -- (B1) EMPRESAS FALTANTES (codigo gerado por trigger; guarda IF NOT EXISTS) --
  IF NOT EXISTS (SELECT 1 FROM public.hub_empresas WHERE id = v_emp_perdedora) THEN
    INSERT INTO public.hub_empresas
      (id, razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES
      (v_emp_perdedora, 'Construtora Rival Engenharia LTDA', 'Construtora Rival',
       'Engenharia', 'ENG', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_empresas WHERE id = v_emp_prestador) THEN
    INSERT INTO public.hub_empresas
      (id, razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES
      (v_emp_prestador, 'Impermax Servicos Especializados LTDA', 'Impermax Servicos',
       'Servicos', 'SRV', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_empresas WHERE id = v_emp_fornecedor) THEN
    INSERT INTO public.hub_empresas
      (id, razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES
      (v_emp_fornecedor, 'Deposito Central de Materiais LTDA', 'Deposito Central',
       'Materiais de Construcao', 'PRO', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  -- (B2) PESSOAS FALTANTES (codigo gerado por trigger; guarda IF NOT EXISTS) --
  IF NOT EXISTS (SELECT 1 FROM public.hub_pessoas WHERE id = v_pes_wendel) THEN
    INSERT INTO public.hub_pessoas
      (id, nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES
      (v_pes_wendel, 'Wendel Cruz', 'parceiro', 'PF', v_emp_nice,
       'Engenharia Civil', 'wendel.cruz@niceengenharia.com.br', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_pessoas WHERE id = v_pes_func1) THEN
    INSERT INTO public.hub_pessoas
      (id, nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES
      (v_pes_func1, 'Roberto Nunes', 'parceiro', 'PF', v_emp_nice,
       'Engenharia Residente', 'residente@niceengenharia.com.br', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_pessoas WHERE id = v_pes_func2) THEN
    INSERT INTO public.hub_pessoas
      (id, nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES
      (v_pes_func2, 'Jose Aparecido', 'parceiro', 'PF', v_emp_nice,
       'Mestre de Obras', 'mestre@niceengenharia.com.br', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_pessoas WHERE id = v_pes_prest) THEN
    INSERT INTO public.hub_pessoas
      (id, nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES
      (v_pes_prest, 'Sergio Andrade', 'parceiro', 'PF', v_emp_prestador,
       'Impermeabilizacao', 'contato@impermax-servicos.example', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.hub_pessoas WHERE id = v_pes_forn) THEN
    INSERT INTO public.hub_pessoas
      (id, nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES
      (v_pes_forn, 'Claudia Ramos', 'fornecedor', 'PF', v_emp_fornecedor,
       'Comercial', 'comercial@deposito-materiais.example', 'Sao Paulo', 'SP', v_tenant);
  END IF;

  -- (B3) VINCULOS N:N pessoa<->empresa (valido_de NOT NULL; ON CONFLICT no par) --
  INSERT INTO public.hub_pessoas_empresas
    (pessoa_id, empresa_id, cargo, principal, valido_de, tenant_id)
  VALUES
    (v_pes_marcos,    v_emp_takiguthi, 'Arquiteto Titular',          true,  CURRENT_DATE, v_tenant),
    (v_pes_niceresp,  v_emp_nice,      'Responsavel Administrativo', false, CURRENT_DATE, v_tenant),
    (v_pes_wendel,    v_emp_nice,      'Responsavel Tecnico',        true,  CURRENT_DATE, v_tenant),
    (v_pes_func1,     v_emp_nice,      'Engenheiro Residente',       false, CURRENT_DATE, v_tenant),
    (v_pes_func2,     v_emp_nice,      'Mestre de Obras',            false, CURRENT_DATE, v_tenant),
    (v_pes_consulrep, v_emp_consulado, 'Representante Consular',     true,  CURRENT_DATE, v_tenant),
    (v_pes_prest,     v_emp_prestador, 'Responsavel Tecnico',        true,  CURRENT_DATE, v_tenant),
    (v_pes_forn,      v_emp_fornecedor,'Gerente Comercial',          true,  CURRENT_DATE, v_tenant)
  ON CONFLICT (pessoa_id, empresa_id) DO UPDATE
    SET cargo = EXCLUDED.cargo,
        principal = EXCLUDED.principal,
        tenant_id = EXCLUDED.tenant_id;

  -- (B4) USERS login-off (auth_id=NULL, status=Inativo, email unico). ---------
  --      ON CONFLICT (email): reafirma o estado login-off sem duplicar.
  INSERT INTO public.users
    (id, email, name, role, status, auth_id, pessoa_id, tenant_id)
  VALUES
    (v_usr_wendel, 'wendel.cruz@niceengenharia.com.br', 'Wendel Cruz',
       'operation'::app_role, 'Inativo'::record_status, NULL, v_pes_wendel, v_tenant),
    (v_usr_func1,  'residente@niceengenharia.com.br',   'Roberto Nunes — Eng. Residente',
       'operation'::app_role, 'Inativo'::record_status, NULL, v_pes_func1, v_tenant),
    (v_usr_func2,  'mestre@niceengenharia.com.br',      'Jose Aparecido — Mestre de Obras',
       'operation'::app_role, 'Inativo'::record_status, NULL, v_pes_func2, v_tenant),
    (v_usr_prest,  'contato@impermax-servicos.example', 'Impermax Servicos',
       'supplier'::app_role,  'Inativo'::record_status, NULL, v_pes_prest, v_tenant),
    (v_usr_forn,   'comercial@deposito-materiais.example', 'Deposito Central',
       'supplier'::app_role,  'Inativo'::record_status, NULL, v_pes_forn, v_tenant)
  ON CONFLICT (email) DO UPDATE
    SET status    = 'Inativo'::record_status,
        pessoa_id = EXCLUDED.pessoa_id,
        role      = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id;

  -- (B4b) Os 3 users v1 login-off (Marcos/Nice-resp/Consulado-rep) => Inativo.
  --       Escopo por pessoa_id do ecossistema E auth_id IS NULL, para NUNCA tocar
  --       um usuario real de login (auth_id preenchido).
  UPDATE public.users
     SET status = 'Inativo'::record_status
   WHERE auth_id IS NULL
     AND pessoa_id IN (v_pes_marcos, v_pes_niceresp, v_pes_consulrep);

  -- (B5) NEGOCIOS DERIVADOS de NGARQ (pai=NGARQ => raiz=NGARQ). ---------------
  --      codigo omitido (trigger). etapa com slug valido do funil.

  --  engenharia PERDEDORA (fechado_perdido + motivo_perda)
  IF NOT EXISTS (SELECT 1 FROM public.hub_negocios WHERE id = v_neg_perdedora) THEN
    INSERT INTO public.hub_negocios
      (id, titulo, tipo, prefixo_mercado, pipeline_id, mercado_slug,
       empresa_id, status, etapa, motivo_perda, negocio_pai_id, tenant_id)
    VALUES
      (v_neg_perdedora,
       'Consulado — Proposta de Engenharia (nao vencedora)',
       'produto_servico', 'ENG', v_pipe_eng, 'engenharia',
       v_emp_perdedora, 'fechado_perdido', 'perdido',
       'Cliente optou pela Nice Engenharia — proposta concorrente nao selecionada',
       v_ngarq, v_tenant);
  END IF;

  --  PRESTADOR de servico (pipeline SRV)
  IF NOT EXISTS (SELECT 1 FROM public.hub_negocios WHERE id = v_neg_srv) THEN
    INSERT INTO public.hub_negocios
      (id, titulo, tipo, prefixo_mercado, pipeline_id, mercado_slug,
       empresa_id, status, etapa, negocio_pai_id, tenant_id)
    VALUES
      (v_neg_srv,
       'Consulado — Servico de Impermeabilizacao',
       'produto_servico', 'SRV', v_pipe_srv, 'servico',
       v_emp_prestador, 'aberto', 'novo',
       v_ngarq, v_tenant);
  END IF;

  --  FORNECEDOR de produtos (pipeline PRO — decisao (2): produto DEFERIDO)
  IF NOT EXISTS (SELECT 1 FROM public.hub_negocios WHERE id = v_neg_pro) THEN
    INSERT INTO public.hub_negocios
      (id, titulo, tipo, prefixo_mercado, pipeline_id, mercado_slug,
       empresa_id, status, etapa, negocio_pai_id, tenant_id)
    VALUES
      (v_neg_pro,
       'Consulado — Fornecimento de Materiais',
       'produto_servico', 'PRO', v_pipe_pro, 'produto',
       v_emp_fornecedor, 'aberto', 'novo',
       v_ngarq, v_tenant);
  END IF;

  -- (B6) VINCULOS do NGARQ com os papeis ricos. codigo_rastreio = codigo da
  --      entidade (buscado por subselect => sempre correto, inclusive para as
  --      entidades cujo codigo foi gerado por trigger agora). ON CONFLICT no
  --      indice unico (negocio_id, entidade_tipo, entidade_id, papel).
  INSERT INTO public.hub_negocio_vinculos
    (negocio_id, entidade_tipo, entidade_id, papel, codigo_rastreio, tenant_id)
  VALUES
    (v_ngarq, 'empresa', v_emp_consulado, 'cliente',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_consulado), v_tenant),
    (v_ngarq, 'pessoa',  v_pes_consulrep, 'cliente_representante',
       (SELECT codigo FROM public.hub_pessoas  WHERE id = v_pes_consulrep), v_tenant),
    (v_ngarq, 'empresa', v_emp_takiguthi, 'arquiteto',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_takiguthi), v_tenant),
    (v_ngarq, 'pessoa',  v_pes_marcos,    'arquiteto',
       (SELECT codigo FROM public.hub_pessoas  WHERE id = v_pes_marcos), v_tenant),
    (v_ngarq, 'empresa', v_emp_nice,      'engenharia_executora',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_nice), v_tenant),
    (v_ngarq, 'pessoa',  v_pes_wendel,    'engenharia_executora',
       (SELECT codigo FROM public.hub_pessoas  WHERE id = v_pes_wendel), v_tenant),
    (v_ngarq, 'empresa', v_emp_perdedora, 'executor_candidato',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_perdedora), v_tenant)
  ON CONFLICT (negocio_id, entidade_tipo, entidade_id, papel) DO NOTHING;

  -- (B6b) Exercita os papeis 'prestador'/'fornecedor' nos negocios derivados
  --       (prova as arestas novas do CHECK com uma linha real cada).
  INSERT INTO public.hub_negocio_vinculos
    (negocio_id, entidade_tipo, entidade_id, papel, codigo_rastreio, tenant_id)
  VALUES
    (v_neg_srv, 'empresa', v_emp_prestador,  'prestador',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_prestador), v_tenant),
    (v_neg_pro, 'empresa', v_emp_fornecedor, 'fornecedor',
       (SELECT codigo FROM public.hub_empresas WHERE id = v_emp_fornecedor), v_tenant)
  ON CONFLICT (negocio_id, entidade_tipo, entidade_id, papel) DO NOTHING;

  -- (B7) SELO — marca dados_extras das empresas/pessoas do seed (ancora do
  --      rollback). Inclui as PRE-EXISTENTES do ecossistema + as novas.
  UPDATE public.hub_empresas
     SET dados_extras = COALESCE(dados_extras, '{}'::jsonb) || v_selo
   WHERE id IN (v_emp_nice, v_emp_takiguthi, v_emp_consulado, v_emp_marcen,
                v_emp_perdedora, v_emp_prestador, v_emp_fornecedor);

  UPDATE public.hub_pessoas
     SET dados_extras = COALESCE(dados_extras, '{}'::jsonb) || v_selo
   WHERE id IN (v_pes_marcos, v_pes_niceresp, v_pes_consulrep,
                v_pes_wendel, v_pes_func1, v_pes_func2, v_pes_prest, v_pes_forn);

  RAISE NOTICE 'SEED CONSULADO V2 aplicado. NGARQ=%', v_ngarq;
END $$;

-- ----------------------------------------------------------------------------
-- CONFERENCIA (rode apos o bloco; leia os resultados)
-- ----------------------------------------------------------------------------
-- 1) Linhagem reancorada (todos devem ter negocio_raiz_id = id do NGARQ):
--   SELECT codigo, titulo, prefixo_mercado, etapa, status, pipeline_id,
--          negocio_pai_id, negocio_raiz_id
--     FROM public.hub_negocios
--    WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001'
--    ORDER BY criado_em;
-- 2) Vinculos do NGARQ (7 papeis ricos):
--   SELECT entidade_tipo, papel, codigo_rastreio
--     FROM public.hub_negocio_vinculos
--    WHERE negocio_id = '5eedc02a-0001-4000-8000-000000000001' ORDER BY papel;
-- 3) Users login-off do ecossistema (todos Inativo, auth_id NULL):
--   SELECT email, role, status, pessoa_id FROM public.users
--    WHERE pessoa_id IN (SELECT id FROM public.hub_pessoas
--                        WHERE dados_extras->>'seed'='ecossistema-consulado-v2');
-- 4) Selo aplicado:
--   SELECT 'empresas' t, count(*) FROM public.hub_empresas WHERE dados_extras->>'seed'='ecossistema-consulado-v2'
--   UNION ALL SELECT 'pessoas', count(*) FROM public.hub_pessoas WHERE dados_extras->>'seed'='ecossistema-consulado-v2';
-- ============================================================================
