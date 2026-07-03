-- ============================================================================
-- SEED CONSULADO V2 — ARQUIVO 0 de 4 : PONTO DE RESTAURACAO (RODE PRIMEIRO)
-- ============================================================================
-- ORDEM DE EXECUCAO (rodar como service_role, na janela do dono):
--   0) SEED-CONSULADO-V2-0-restore-point.sql   <== ESTE ARQUIVO (rode ANTES de tudo)
--   1) SEED-CONSULADO-V2-1-ddl.sql             (expande CHECK + escopa RLS de servicos)
--   2) SEED-CONSULADO-V2-2-ecossistema.sql     (reancora ARQ + popula o ecossistema)
--   4) SEED-CONSULADO-V2-rollback.sql          (desfazer — Modo A arquiva / Modo B deleta)
--
-- O QUE ESTE ARQUIVO FAZ
--   Tira uma "foto" (snapshot) do estado ATUAL (pre-V2) das linhas do ecossistema
--   Consulado da Italia, gravando-as num schema separado `_rollback_consulado`.
--   As linhas sao copiadas com os MESMOS UUIDs e MESMOS codigos de identidade.
--   Se qualquer mutacao do Arquivo 2 (reancoragem, troca de pipeline, selo) sair
--   errada, o dono restaura os valores originais a partir deste schema — SEM perder
--   a identidade (codigo/UUID nao muda).
--
-- IDEMPOTENTE: comeca com DROP SCHEMA ... CASCADE, entao pode ser rodado de novo
--   (a foto sera refeita a partir do estado corrente). ATENCAO: se rodar DEPOIS do
--   Arquivo 2, a foto ja tera o estado pos-V2 — rode este arquivo ANTES do Arquivo 2.
--
-- NAO E DESTRUTIVO no schema public: so cria copias em `_rollback_consulado`.
--
-- ANCORAS (confirmadas por query read-only em 2026-07-02):
--   tenant Obra10 .......... 00000000-0000-4000-8000-000000000001
--   raiz atual (NGENG2026013) 71c3ce20-e445-4435-960c-0867ec054f64  (pai=NULL hoje)
--   filho (NGMRC2026014) .... d84fb83f-66cc-490b-b1f1-220bf1096dd8  (pai=raiz)
--   obra Consulado (REF-2026-0001) a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d
--   projeto (PRJ-2026-0003) . 85971363-c0ac-4900-8e86-b6519d0fca46
--   empresas EM2026001..004 . Nice / Takiguthi / Consulado / Marcenaria
--   pessoas  PS2026004..006 . Marcos / Nice-resp / Consulado-rep
--   No momento da escrita: 0 servicos, 0 vinculos, 0 itens/frentes de obra,
--   0 contas e 0 movimentos de escrow ligados a este ecossistema.
-- ============================================================================

DROP SCHEMA IF EXISTS _rollback_consulado CASCADE;
CREATE SCHEMA _rollback_consulado;

COMMENT ON SCHEMA _rollback_consulado IS
  'Ponto de restauracao SEED CONSULADO V2 — foto pre-V2 do ecossistema Consulado da Italia. Gerado por SEED-CONSULADO-V2-0-restore-point.sql.';

-- ---------------------------------------------------------------------------
-- NUCLEO DO ECOSSISTEMA (exatamente o que os arquivos 2 e 4 mexem/desfazem)
-- ---------------------------------------------------------------------------

-- Empresas do Consulado (identidade EM2026001..004)
CREATE TABLE _rollback_consulado.hub_empresas AS
  SELECT * FROM public.hub_empresas
  WHERE codigo IN ('EM2026001','EM2026002','EM2026003','EM2026004');

-- Pessoas do Consulado (identidade PS2026004..006)
CREATE TABLE _rollback_consulado.hub_pessoas AS
  SELECT * FROM public.hub_pessoas
  WHERE codigo IN ('PS2026004','PS2026005','PS2026006');

-- Negocios da linhagem atual (raiz 71c3ce20 + tudo que herda essa raiz)
CREATE TABLE _rollback_consulado.hub_negocios AS
  SELECT * FROM public.hub_negocios
  WHERE id = '71c3ce20-e445-4435-960c-0867ec054f64'
     OR negocio_raiz_id = '71c3ce20-e445-4435-960c-0867ec054f64';

-- Projetos e obras desses negocios
CREATE TABLE _rollback_consulado.hub_projetos AS
  SELECT * FROM public.hub_projetos
  WHERE negocio_id IN (
    SELECT id FROM public.hub_negocios
    WHERE id = '71c3ce20-e445-4435-960c-0867ec054f64'
       OR negocio_raiz_id = '71c3ce20-e445-4435-960c-0867ec054f64');

CREATE TABLE _rollback_consulado.hub_obras AS
  SELECT * FROM public.hub_obras
  WHERE negocio_id IN (
    SELECT id FROM public.hub_negocios
    WHERE id = '71c3ce20-e445-4435-960c-0867ec054f64'
       OR negocio_raiz_id = '71c3ce20-e445-4435-960c-0867ec054f64');

-- Users login-off dessas pessoas (nao filtra por auth_id: a foto guarda todos os
-- vinculos user->pessoa que existirem; a restauracao decide o que reativar)
CREATE TABLE _rollback_consulado.users AS
  SELECT * FROM public.users
  WHERE pessoa_id IN (
    SELECT id FROM public.hub_pessoas
    WHERE codigo IN ('PS2026004','PS2026005','PS2026006'));

-- Vinculo pessoa<->empresa (N:N) do ecossistema
CREATE TABLE _rollback_consulado.hub_pessoas_empresas AS
  SELECT * FROM public.hub_pessoas_empresas
  WHERE pessoa_id IN (SELECT id FROM public.hub_pessoas WHERE codigo IN ('PS2026004','PS2026005','PS2026006'))
     OR empresa_id IN (SELECT id FROM public.hub_empresas WHERE codigo IN ('EM2026001','EM2026002','EM2026003','EM2026004'));

-- Participantes do negocio (vinculos) da linhagem
CREATE TABLE _rollback_consulado.hub_negocio_vinculos AS
  SELECT * FROM public.hub_negocio_vinculos
  WHERE negocio_id IN (
    SELECT id FROM public.hub_negocios
    WHERE id = '71c3ce20-e445-4435-960c-0867ec054f64'
       OR negocio_raiz_id = '71c3ce20-e445-4435-960c-0867ec054f64');

-- Servicos ligados a esses negocios
CREATE TABLE _rollback_consulado.hub_servicos AS
  SELECT * FROM public.hub_servicos
  WHERE negocio_id IN (
    SELECT id FROM public.hub_negocios
    WHERE id = '71c3ce20-e445-4435-960c-0867ec054f64'
       OR negocio_raiz_id = '71c3ce20-e445-4435-960c-0867ec054f64');

-- ---------------------------------------------------------------------------
-- TABELAS-FILHAS DA OBRA (o que um hard-delete da obra — Modo B — destruiria)
-- Todas verificadas com 0 linhas no momento da escrita; a foto e feita mesmo
-- assim (fica vazia hoje, mas o arquivo continua correto se rodado no futuro
-- quando a obra ja tiver EAP/orcamento/medicao/escrow).
-- obra Consulado = a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d
-- ---------------------------------------------------------------------------
CREATE TABLE _rollback_consulado.hub_obra_frentes_eap    AS SELECT * FROM public.hub_obra_frentes_eap    WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_itens          AS SELECT * FROM public.hub_obra_itens          WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_orcamentos     AS SELECT * FROM public.hub_obra_orcamentos     WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_orcamento_itens AS SELECT * FROM public.hub_obra_orcamento_itens WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_pagamentos     AS SELECT * FROM public.hub_obra_pagamentos     WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_medicoes       AS SELECT * FROM public.hub_obra_medicoes       WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_escrow_contas    AS SELECT * FROM public.hub_obra_escrow_contas    WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_escrow_movimentos AS SELECT * FROM public.hub_obra_escrow_movimentos WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_curva_baseline AS SELECT * FROM public.hub_obra_curva_baseline WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_curva_pontos   AS SELECT * FROM public.hub_obra_curva_pontos   WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_avanco_diario  AS SELECT * FROM public.hub_obra_avanco_diario  WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_obra_restricoes     AS SELECT * FROM public.hub_obra_restricoes     WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_estoque_mov         AS SELECT * FROM public.hub_estoque_mov         WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_pedidos_material    AS SELECT * FROM public.hub_pedidos_material    WHERE obra_id = 'a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d';
CREATE TABLE _rollback_consulado.hub_projetos_fases      AS SELECT * FROM public.hub_projetos_fases
  WHERE projeto_id IN (SELECT id FROM public.hub_projetos
                       WHERE negocio_id = '71c3ce20-e445-4435-960c-0867ec054f64');

-- ---------------------------------------------------------------------------
-- CONFERENCIA — quantas linhas a foto guardou (leia o resultado)
-- ---------------------------------------------------------------------------
SELECT 'empresas'          AS tabela, count(*) FROM _rollback_consulado.hub_empresas
UNION ALL SELECT 'pessoas',           count(*) FROM _rollback_consulado.hub_pessoas
UNION ALL SELECT 'negocios',          count(*) FROM _rollback_consulado.hub_negocios
UNION ALL SELECT 'projetos',          count(*) FROM _rollback_consulado.hub_projetos
UNION ALL SELECT 'obras',             count(*) FROM _rollback_consulado.hub_obras
UNION ALL SELECT 'users',             count(*) FROM _rollback_consulado.users
UNION ALL SELECT 'pessoas_empresas',  count(*) FROM _rollback_consulado.hub_pessoas_empresas
UNION ALL SELECT 'negocio_vinculos',  count(*) FROM _rollback_consulado.hub_negocio_vinculos
UNION ALL SELECT 'servicos',          count(*) FROM _rollback_consulado.hub_servicos
ORDER BY tabela;

-- ============================================================================
-- COMO RESTAURAR (exemplos — NAO executados aqui; rode manualmente se precisar)
-- ============================================================================
-- A foto guarda os valores originais das colunas que o Arquivo 2 altera. Para
-- reverter uma mutacao especifica sem hard-delete, faca UPDATE a partir da foto.
-- Exemplos:
--
--   -- desfazer a reancoragem do NGENG (voltar pai/pipeline/mercado originais):
--   UPDATE public.hub_negocios n
--      SET pipeline_id  = r.pipeline_id,
--          mercado_slug = r.mercado_slug
--     FROM _rollback_consulado.hub_negocios r
--    WHERE n.id = r.id AND r.id = '71c3ce20-e445-4435-960c-0867ec054f64';
--   -- OBS: negocio_pai_id e IMUTAVEL depois de definido (trigger hub_negocio_set_raiz).
--   --      Voltar pai=NULL exige hard-delete/reinsercao do negocio (ver Arquivo 4, Modo B)
--   --      ou intervencao de admin desabilitando o trigger. Nao ha caminho "soft".
--
--   -- restaurar o pipeline do projeto:
--   UPDATE public.hub_projetos p SET pipeline_id = r.pipeline_id, estagio = r.estagio
--     FROM _rollback_consulado.hub_projetos r WHERE p.id = r.id;
--
--   -- remover o selo de uma empresa (voltar dados_extras original):
--   UPDATE public.hub_empresas e SET dados_extras = r.dados_extras
--     FROM _rollback_consulado.hub_empresas r WHERE e.id = r.id;
-- ============================================================================
