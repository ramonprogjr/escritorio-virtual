-- ============================================================================
-- SEED CONSULADO V2 — ARQUIVO 4 de 4 : ROLLBACK (desfazer o ecossistema)
-- ============================================================================
-- ORDEM: rode SO se precisar desfazer o Arquivo 2. Rodar como service_role.
--
-- PRINCIPIO DO DONO: usuario NUNCA apaga — "delete" so ARQUIVA.
--   => O rollback PADRAO e o MODO A (arquivar, reversivel).
--   => O MODO B (hard-delete) e operacao de ADMIN, ultimo caso, e vem com
--      ROLLBACK por padrao (dry-run). So troque por COMMIT com certeza total.
--
-- ANCORA (como este arquivo encontra o ecossistema):
--   selo ....... hub_empresas/hub_pessoas.dados_extras->>'seed' = 'ecossistema-consulado-v2'
--   linhagem ... hub_negocios.negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001' (NGARQ)
--
-- Se precisar restaurar os valores ORIGINAIS (pre-V2) das linhas pre-existentes
-- (NGENG/NGMRC, projeto, empresas/pessoas), use o schema do Arquivo 0
-- (_rollback_consulado) — veja os exemplos de UPDATE no fim daquele arquivo.
-- ============================================================================


-- ############################################################################
-- MODO A — ARQUIVAR (PADRAO, NAO DESTRUTIVO, REVERSIVEL)
-- ############################################################################
BEGIN;

-- Empresas do selo => arquivadas (tem coluna arquivado_motivo)
UPDATE public.hub_empresas
   SET arquivado_em = now(),
       arquivado_motivo = 'rollback seed ecossistema-consulado-v2',
       ativo = false
 WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2';

-- Pessoas do selo => arquivadas (hub_pessoas so tem arquivado_em)
UPDATE public.hub_pessoas
   SET arquivado_em = now()
 WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2';

-- Negocios da linhagem NGARQ => encerrados (perdido) e fora do funil.
-- NAO mexe em codigo nem em negocio_pai_id (imutaveis por trigger).
-- OBS: inclui as pre-existentes NGENG/NGMRC (agora sob a raiz NGARQ). Para
--      devolve-las ao estado original, use o Arquivo 0 (_rollback_consulado).
UPDATE public.hub_negocios
   SET status = 'fechado_perdido',
       pipeline_id = NULL
 WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001';

-- Users login-off do ecossistema => Inativo (nunca toca login real: auth_id NULL)
UPDATE public.users
   SET status = 'Inativo'::record_status
 WHERE auth_id IS NULL
   AND pessoa_id IN (
     SELECT id FROM public.hub_pessoas
      WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2');

-- Conferencia do Modo A:
SELECT 'empresas_arquivadas' AS o, count(*) FROM public.hub_empresas WHERE dados_extras->>'seed'='ecossistema-consulado-v2' AND arquivado_em IS NOT NULL
UNION ALL SELECT 'pessoas_arquivadas', count(*) FROM public.hub_pessoas WHERE dados_extras->>'seed'='ecossistema-consulado-v2' AND arquivado_em IS NOT NULL
UNION ALL SELECT 'negocios_perdidos', count(*) FROM public.hub_negocios WHERE negocio_raiz_id='5eedc02a-0001-4000-8000-000000000001' AND status='fechado_perdido';

COMMIT;   -- Modo A confirma (arquivar e seguro/reversivel).


-- ############################################################################
-- MODO B — HARD-DELETE (ADMIN, ULTIMO CASO). DRY-RUN: termina em ROLLBACK.
-- ############################################################################
-- LEIA ANTES DE TROCAR PARA COMMIT:
--   * CASCADE da obra: apagar a obra REF-2026-0001 destroi EAP, orcamento,
--     medicoes e o ESCROW (contas + movimentos = lastro auditavel que o cliente
--     ve). CONFIRA o escrow antes (no momento da escrita: 0 contas / 0 movimentos):
--       SELECT (SELECT count(*) FROM public.hub_obra_escrow_contas   WHERE obra_id='a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d') contas,
--              (SELECT count(*) FROM public.hub_obra_escrow_movimentos WHERE obra_id='a52b2c9a-9dc3-4aa7-bd3b-e5c0d4e7da8d') movimentos;
--   * Referencias NO ACTION a pessoas (hub_conversas, hub_leads, hub_leads_crm,
--     hub_mensagens, hub_decisoes, hub_oportunidades) BLOQUEIAM o DELETE de uma
--     pessoa se existirem. No momento da escrita nenhuma seed-pessoa esta
--     referenciada; confira antes de COMMIT.
--
-- O QUE NAO VOLTA (mesmo apos re-seed):
--   * Contadores de codigo (hub_codigo_contador / contador de negocios / obra /
--     projeto) avancam e NAO retrocedem — um novo seed geraria codigos com gaps.
--   * Auditoria append-only (hub_log, hub_backups, hub_eventos) permanece por design.
BEGIN;

SET LOCAL app.delete_authorized = true;   -- destrava block_unauthorized_delete()

-- Ordem de FK (pais->filhos primeiro onde nao ha CASCADE):
-- 1) projetos e obras da linhagem (obra CASCATEIA seus filhos: EAP/escrow/etc.)
DELETE FROM public.hub_projetos
 WHERE negocio_id IN (SELECT id FROM public.hub_negocios
                      WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001');

DELETE FROM public.hub_obras
 WHERE negocio_id IN (SELECT id FROM public.hub_negocios
                      WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001');

-- 2) servicos da linhagem
DELETE FROM public.hub_servicos
 WHERE negocio_id IN (SELECT id FROM public.hub_negocios
                      WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001');

-- 3) vinculos da linhagem (tambem cairiam por CASCADE do negocio; explicito)
DELETE FROM public.hub_negocio_vinculos
 WHERE negocio_id IN (SELECT id FROM public.hub_negocios
                      WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001');

-- 4) negocios: derivados/filhos primeiro, depois a raiz NGARQ
--    (auto-FK e SET NULL, entao a ordem e por clareza, nao por obrigacao)
DELETE FROM public.hub_negocios
 WHERE negocio_raiz_id = '5eedc02a-0001-4000-8000-000000000001'
   AND id <> '5eedc02a-0001-4000-8000-000000000001';
DELETE FROM public.hub_negocios
 WHERE id = '5eedc02a-0001-4000-8000-000000000001';

-- 5) users login-off do ecossistema (protege login real: auth_id IS NULL)
DELETE FROM public.users
 WHERE auth_id IS NULL
   AND pessoa_id IN (SELECT id FROM public.hub_pessoas
                     WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2');

-- 6) pessoas_empresas (cairiam por CASCADE de pessoa/empresa; explicito p/ ordem)
DELETE FROM public.hub_pessoas_empresas
 WHERE pessoa_id IN (SELECT id FROM public.hub_pessoas  WHERE dados_extras->>'seed'='ecossistema-consulado-v2')
    OR empresa_id IN (SELECT id FROM public.hub_empresas WHERE dados_extras->>'seed'='ecossistema-consulado-v2');

-- 7) pessoas do selo
DELETE FROM public.hub_pessoas
 WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2';

-- 8) empresas do selo
DELETE FROM public.hub_empresas
 WHERE dados_extras->>'seed' = 'ecossistema-consulado-v2';

-- Conferencia do Modo B (tudo deve ir a 0 se o hard-delete pegou o ecossistema):
SELECT 'negocios_linhagem'  AS o, count(*) FROM public.hub_negocios  WHERE negocio_raiz_id='5eedc02a-0001-4000-8000-000000000001'
UNION ALL SELECT 'empresas_selo', count(*) FROM public.hub_empresas WHERE dados_extras->>'seed'='ecossistema-consulado-v2'
UNION ALL SELECT 'pessoas_selo',  count(*) FROM public.hub_pessoas  WHERE dados_extras->>'seed'='ecossistema-consulado-v2';

ROLLBACK;   -- <== DRY-RUN. Troque por COMMIT quando tiver certeza absoluta.
-- ============================================================================
