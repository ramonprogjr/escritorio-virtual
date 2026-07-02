-- ============================================================================
-- SEED — ECOSSISTEMA CONSULADO (Passo 1: espinha Hub-side, tenant Obra10+)
-- ----------------------------------------------------------------------------
-- Dado REAL conectado que valida a rastreabilidade ponta-a-ponta:
--   Cliente (Consulado) → NEGÓCIO RAIZ → Projeto (Takiguthi) → Obra (Nice)
--                                       ↘ Negócio FILHO (Marcenaria) [prova a linhagem]
--
-- Os CÓDIGOS nascem INTERNOS (invisíveis ao usuário — regra do dono 02/jul):
--   empresa=EM…, pessoa=PS… (contador GLOBAL: mesmo código em qualquer tenant)
--   negócio=NG…  (por-tenant, via trigger), obra=REF-… projeto=PRJ-… (RPCs do app)
--
-- IDEMPOTENTE: re-rodar não duplica (guarda pela existência do Consulado).
-- Rode INTEIRO no SQL Editor (janela do dono). É uma transação única (DO block).
-- ============================================================================

DO $$
DECLARE
  v_tenant       uuid := '00000000-0000-4000-8000-000000000001';  -- Obra10+ (único tenant hoje)
  v_nice uuid; v_takiguthi uuid; v_consulado uuid; v_marcenaria uuid;
  v_marcos uuid; v_nice_p uuid; v_consulado_p uuid;
  v_neg_raiz uuid; v_neg_marc uuid;
  v_projeto uuid; v_obra uuid;
  v_u_marcos uuid; v_u_nice uuid; v_u_consulado uuid;
  v_cod_obra text; v_cod_proj text;
BEGIN
  IF EXISTS (SELECT 1 FROM hub_empresas
             WHERE razao_social = 'Consulado Geral da Itália' AND tenant_id = v_tenant) THEN
    RAISE NOTICE 'Seed Consulado JÁ aplicado — nada a fazer.';
    RETURN;
  END IF;

  -- ── EMPRESAS (código EM global preenchido pelo trigger auto-código) ──
  INSERT INTO hub_empresas (razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES ('Nice Engenharia LTDA','Nice Engenharia','Engenharia','ENG','São Paulo','SP', v_tenant)
    RETURNING id INTO v_nice;
  INSERT INTO hub_empresas (razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES ('Takiguthi Arquitetura LTDA','Takiguthi Arquitetura','Arquitetura','ARQ','São Paulo','SP', v_tenant)
    RETURNING id INTO v_takiguthi;
  INSERT INTO hub_empresas (razao_social, nome_fantasia, segmento, cidade, estado, tenant_id)
    VALUES ('Consulado Geral da Itália','Consulado da Itália','Cliente institucional','São Paulo','SP', v_tenant)
    RETURNING id INTO v_consulado;
  INSERT INTO hub_empresas (razao_social, nome_fantasia, segmento, prefixo_mercado, cidade, estado, tenant_id)
    VALUES ('Marcenaria Fina LTDA','Marcenaria Fina','Marcenaria','MRC','São Paulo','SP', v_tenant)
    RETURNING id INTO v_marcenaria;

  -- ── PESSOAS (código PS global via trigger) ──
  INSERT INTO hub_pessoas (nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES ('Marcos Takiguthi','parceiro','PF', v_takiguthi,'Arquitetura','marcos@takiguthiarquitetura.com.br','São Paulo','SP', v_tenant)
    RETURNING id INTO v_marcos;
  INSERT INTO hub_pessoas (nome, tipo, tipo_pessoa, empresa_id, area_atuacao, email, cidade, estado, tenant_id)
    VALUES ('Nice Engenharia — Responsável','parceiro','PF', v_nice,'Engenharia','contato@niceengenharia.com.br','São Paulo','SP', v_tenant)
    RETURNING id INTO v_nice_p;
  INSERT INTO hub_pessoas (nome, tipo, tipo_pessoa, empresa_id, email, cidade, estado, tenant_id)
    VALUES ('Consulado da Itália — Representante','cliente','PF', v_consulado,'representante@consulado-italia.example','São Paulo','SP', v_tenant)
    RETURNING id INTO v_consulado_p;

  -- ── NEGÓCIO RAIZ (espinha comercial; pai=NULL → raiz de si mesmo) ──
  INSERT INTO hub_negocios (titulo, tipo, prefixo_mercado, mercado_slug, status, etapa, empresa_id, pessoa_id, tenant_id)
    VALUES ('Consulado da Itália — Reforma','produto_servico','ENG','eng','fechado_ganho','ganho', v_consulado, v_consulado_p, v_tenant)
    RETURNING id INTO v_neg_raiz;

  -- ── NEGÓCIO FILHO (linhagem: pai=raiz → herda raiz pelo trigger; prova o pai/raiz) ──
  INSERT INTO hub_negocios (titulo, tipo, prefixo_mercado, mercado_slug, status, etapa, empresa_id, negocio_pai_id, tenant_id)
    VALUES ('Consulado — Marcenaria (subcontrato)','produto_servico','MRC','mrc','aberto','novo', v_marcenaria, v_neg_raiz, v_tenant)
    RETURNING id INTO v_neg_marc;

  -- ── PROJETO (Takiguthi) — código PRJ- via RPC do app ──
  v_cod_proj := gerar_codigo_projeto(v_tenant);
  INSERT INTO hub_projetos (codigo, titulo, negocio_id, cliente_empresa_id, cliente_nome,
                            estagio, status, aprovacao_status, tipologia, tenant_id)
    VALUES (v_cod_proj,'Projeto Arquitetônico — Consulado', v_neg_raiz, v_consulado,'Consulado da Itália',
            'executivo','em_andamento','aprovado','Institucional', v_tenant)
    RETURNING id INTO v_projeto;

  -- ── OBRA (Nice executa) — código REF- via RPC do app ──
  v_cod_obra := gerar_codigo_obra(v_tenant,'reforma');
  INSERT INTO hub_obras (codigo, titulo, negocio_id, cliente_empresa_id, tipo_obra, tipo_contrato,
                         bdi_fator, segmento, status, cidade, estado, tenant_id)
    VALUES (v_cod_obra,'Obra Consulado da Itália', v_neg_raiz, v_consulado,'reforma','administracao',
            1.22,'corporativo','ativa','São Paulo','SP', v_tenant)
    RETURNING id INTO v_obra;

  -- elo projeto ↔ obra
  UPDATE hub_projetos SET obra_id = v_obra WHERE id = v_projeto;

  -- ── USERS (pessoal do sistema; auth_id NULL = SEM login ainda — login provisiona depois) ──
  INSERT INTO users (email, name, role, status, tenant_id, pessoa_id)
    VALUES ('marcos@takiguthiarquitetura.com.br','Marcos Takiguthi','architect','Ativo', v_tenant, v_marcos)
    RETURNING id INTO v_u_marcos;
  INSERT INTO users (email, name, role, status, tenant_id, pessoa_id)
    VALUES ('operacao@niceengenharia.com.br','Nice Engenharia — Operação','operation','Ativo', v_tenant, v_nice_p)
    RETURNING id INTO v_u_nice;
  INSERT INTO users (email, name, role, status, tenant_id, pessoa_id)
    VALUES ('representante@consulado-italia.example','Consulado da Itália — Cliente','client','Ativo', v_tenant, v_consulado_p)
    RETURNING id INTO v_u_consulado;

  -- responsável do projeto = user do Marcos
  UPDATE hub_projetos SET responsavel_id = v_u_marcos WHERE id = v_projeto;

  RAISE NOTICE 'SEED CONSULADO OK — Obra %, Projeto % (códigos internos).', v_cod_obra, v_cod_proj;
END $$;

-- ============================================================================
-- VERIFICAÇÃO (o que nasceu + a linhagem). Rode junto; os códigos aqui são
-- só p/ conferência interna — NÃO vão pra tela do usuário.
-- ============================================================================
SELECT 'EMPRESA' AS camada, codigo, razao_social AS nome, '—' AS liga
  FROM hub_empresas WHERE tenant_id='00000000-0000-4000-8000-000000000001'
    AND razao_social IN ('Nice Engenharia LTDA','Takiguthi Arquitetura LTDA','Consulado Geral da Itália','Marcenaria Fina LTDA')
UNION ALL
SELECT 'PESSOA', codigo, nome, coalesce((SELECT razao_social FROM hub_empresas e WHERE e.id=p.empresa_id),'—')
  FROM hub_pessoas p WHERE tenant_id='00000000-0000-4000-8000-000000000001'
    AND nome IN ('Marcos Takiguthi','Nice Engenharia — Responsável','Consulado da Itália — Representante')
UNION ALL
SELECT 'NEGÓCIO', n.codigo, n.titulo,
       'raiz='||coalesce((SELECT r.codigo FROM hub_negocios r WHERE r.id=n.negocio_raiz_id),'?')||
       case when n.negocio_pai_id is not null then ' pai='||(SELECT pp.codigo FROM hub_negocios pp WHERE pp.id=n.negocio_pai_id) else '' end
  FROM hub_negocios n WHERE tenant_id='00000000-0000-4000-8000-000000000001'
    AND titulo IN ('Consulado da Itália — Reforma','Consulado — Marcenaria (subcontrato)')
UNION ALL
SELECT 'PROJETO', codigo, titulo, 'negócio='||(SELECT codigo FROM hub_negocios n WHERE n.id=hub_projetos.negocio_id)||' obra='||coalesce((SELECT codigo FROM hub_obras o WHERE o.id=hub_projetos.obra_id),'?')
  FROM hub_projetos WHERE tenant_id='00000000-0000-4000-8000-000000000001' AND titulo='Projeto Arquitetônico — Consulado'
UNION ALL
SELECT 'OBRA', codigo, titulo, 'negócio='||(SELECT codigo FROM hub_negocios n WHERE n.id=hub_obras.negocio_id)||' cliente='||(SELECT razao_social FROM hub_empresas e WHERE e.id=hub_obras.cliente_empresa_id)
  FROM hub_obras WHERE tenant_id='00000000-0000-4000-8000-000000000001' AND titulo='Obra Consulado da Itália'
ORDER BY camada, codigo;
