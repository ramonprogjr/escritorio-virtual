-- ============================================================================
-- e7a — COMPRAS, FUNDAÇÃO (pura aditiva, risco ~zero) — janela do dono 09/jul
--
-- Parte 1 de 2 da FASE 2 da SPEC-COMPRAS-CORACAO. AQUI só o que é ADD COLUMN / ADD INDEX / CHECK-widen —
-- backfill-safe, nada muda de comportamento. As partes CRÍTICAS (cadeia de validação, ordem de compra,
-- COFRE de contas bancárias com trigger + RPC, guard da cascata) ficam para a e7b, com QA dedicada — não
-- se rusha o anti-fraude. Nada aqui depende das tabelas da e7b (âncoras e elos são soft-FK = uuid puro,
-- padrão frente_id do E5). Aplicar via MCP, bloco a bloco, mostrando SQL + resultado. Rollback no rodapé.
--
-- CORREÇÃO DE DESENHO (tensão achada no levantamento do schema): a spec dizia CHECK "exatamente uma âncora"
-- mas também pedia negocio_id DENORMALIZADO junto com obra_id — contradição. Modelo resolvido:
--   • CONTEXTO operacional = no máximo UM de {obra_id, projeto_id, servico_id};
--   • a SC precisa estar ancorada a ALGO (contexto OU negocio_id);
--   • negocio_id = link ao CONTRATO/raiz (denormalizado), pode coexistir com o contexto.
-- ============================================================================

-- ─── BLOCO A — ÂNCORAS DA SC (concatenação imóvel→projeto→serviço→SC) ─────────────────────────
ALTER TABLE public.hub_pedidos_material
  ADD COLUMN IF NOT EXISTS negocio_id uuid,   -- link ao CONTRATO (raiz da linhagem) — denormalizado
  ADD COLUMN IF NOT EXISTS projeto_id uuid,   -- contexto: projeto de arquitetura/gerenciamento
  ADD COLUMN IF NOT EXISTS servico_id uuid;   -- contexto: negócio de serviço (marcenaria, etc.)

COMMENT ON COLUMN public.hub_pedidos_material.negocio_id IS
  'Contrato/negócio raiz a que esta compra pertence (denormalizado da árvore). Pode coexistir com o contexto.';

-- obra_id JÁ é nullable no schema; garantimos idempotente.
ALTER TABLE public.hub_pedidos_material ALTER COLUMN obra_id DROP NOT NULL;

-- CHECK SEGURO DA e7a: NO MÁXIMO UM contexto operacional {obra, projeto, servico}. Valida LIMPO em toda linha
-- (legado com obra_id → 1; órfã PED-2026-0001 → 0) e é satisfeito por todo INSERT/UPDATE do app hoje.
-- A regra "tem que estar ANCORADA a algo" (num_nonnulls(...,negocio_id) >= 1) NÃO entra aqui: o app ainda não
-- grava negocio_id/projeto_id/servico_id, então exigi-la AGORA quebraria a criação de SC e a entrega do E5 (a
-- linha legada sem âncora ficaria intocável — NOT VALID não isenta UPDATE). Ela vira constraint separada
-- (chk_sc_ancorada) na e7b, DEPOIS de (a) o app gravar as âncoras no POST/PATCH e (b) backfill da SC legada.
-- [correção do VETO da QA — bloqueador crítico]
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS chk_sc_ancora;   -- caso um apply anterior tenha criado
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS chk_sc_contexto;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT chk_sc_contexto
  CHECK (num_nonnulls(obra_id, projeto_id, servico_id) <= 1);

-- ─── BLOCO E — ITEM POLIMÓRFICO (editável, IA-first; unidade herdada do orçamento) ────────────
-- Discriminador por LINHA, sem EAV. Invariante mantida: total = qtd_pedida × preco_unit em TODOS os modelos.
ALTER TABLE public.hub_pedido_itens
  ADD COLUMN IF NOT EXISTS tipo_item text NOT NULL DEFAULT 'material',
  ADD COLUMN IF NOT EXISTS modelo_precificacao text NOT NULL DEFAULT 'unitario',
  ADD COLUMN IF NOT EXISTS precificacao_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS retornavel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contratado_pessoa_id uuid,        -- soft-FK hub_pessoas (freelance/diária)
  ADD COLUMN IF NOT EXISTS unidade_cobranca text;            -- herdada da linha do orçamento; editável por lista

ALTER TABLE public.hub_pedido_itens DROP CONSTRAINT IF EXISTS chk_item_tipo;
ALTER TABLE public.hub_pedido_itens ADD CONSTRAINT chk_item_tipo
  CHECK (tipo_item IN ('material','equipamento','ferramenta','servico','mao_de_obra'));
ALTER TABLE public.hub_pedido_itens DROP CONSTRAINT IF EXISTS chk_item_modelo;
ALTER TABLE public.hub_pedido_itens ADD CONSTRAINT chk_item_modelo
  CHECK (modelo_precificacao IN ('unitario','diaria','empreitada','medicao','hora','verba'));

-- Backfill (hoje 0 itens — trivial; deixa correto p/ quando entrar carga): tipo desce do cabeçalho.
UPDATE public.hub_pedido_itens i
  SET tipo_item = COALESCE(NULLIF(p.tipo_material, ''), 'material')
  FROM public.hub_pedidos_material p
  WHERE i.pedido_id = p.id
    AND p.tipo_material IN ('material','equipamento','ferramenta','servico','mao_de_obra')
    AND i.tipo_item = 'material';

-- ─── BLOCO F — ELO SC → FINANCEIRO (soft-FK; parcela de compra entra na MESMA fila dourada) ────
ALTER TABLE public.hub_obra_pagamentos
  ADD COLUMN IF NOT EXISTS pedido_id uuid,          -- soft-FK hub_pedidos_material
  ADD COLUMN IF NOT EXISTS ordem_compra_id uuid,    -- soft-FK hub_ordens_compra (criada na e7b)
  ADD COLUMN IF NOT EXISTS fornecedor_conta_id uuid;-- soft-FK hub_fornecedor_contas (criada na e7b)

-- tipo 'compra' no CHECK (aditivo no conjunto de valores; dupla chave/escrow INTOCADOS).
ALTER TABLE public.hub_obra_pagamentos DROP CONSTRAINT IF EXISTS hub_obra_pagamentos_tipo_check;
ALTER TABLE public.hub_obra_pagamentos ADD CONSTRAINT hub_obra_pagamentos_tipo_check
  CHECK (tipo IN ('medicao','adiantamento','retencao','aditivo','reembolso','avulso','compra'));

-- ─── BLOCO G — tenant_id EM hub_alertas (fecha o vazamento cross-tenant que a FASE 0 neutralizou) ─
-- DEFAULT do tenant real: os 12 INSERTs vivos do app (webhook WhatsApp, ciclos) ainda NÃO passam tenant_id;
-- sem o DEFAULT, todo alerta novo nasceria tenant-null (reabrindo o vazamento que este bloco fecha) e a
-- verificação abaixo poderia falhar por corrida com o webhook ao vivo. [correção do VETO da QA — bloqueador alto]
-- e7b/multi-tenant real REMOVE o DEFAULT e põe NOT NULL quando os 12 call-sites passarem tenant explícito.
ALTER TABLE public.hub_alertas ADD COLUMN IF NOT EXISTS tenant_id uuid
  DEFAULT '00000000-0000-4000-8000-000000000001'::uuid;
-- backfill: alertas pré-existentes (criados antes da coluna) vão para o tenant default.
UPDATE public.hub_alertas SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid WHERE tenant_id IS NULL;

-- ─── BLOCO I — ÍNDICES DE ESCALA (só sobre tabelas existentes; os das tabelas novas ficam na e7b) ─
CREATE INDEX IF NOT EXISTS idx_hub_pedidos_fila
  ON public.hub_pedidos_material (tenant_id, status, criado_em DESC, id)
  WHERE status IN ('rascunho','cotando','aprovado','entregue_parcial');
CREATE INDEX IF NOT EXISTS idx_hub_pedidos_negocio
  ON public.hub_pedidos_material (tenant_id, negocio_id) WHERE negocio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hub_pedido_itens_tipo
  ON public.hub_pedido_itens (tenant_id, tipo_item);
CREATE INDEX IF NOT EXISTS idx_hub_alertas_tenant
  ON public.hub_alertas (tenant_id, lido, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_pagamentos_pedido
  ON public.hub_obra_pagamentos (pedido_id) WHERE pedido_id IS NOT NULL;

-- ─── VERIFICAÇÃO EMBUTIDA ────────────────────────────────────────────────────────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_pedidos_material'
      AND column_name IN ('negocio_id','projeto_id','servico_id');
  IF n <> 3 THEN RAISE EXCEPTION 'FALHA A: âncoras ausentes (%/3)', n; END IF;

  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_pedido_itens'
      AND column_name IN ('tipo_item','modelo_precificacao','precificacao_json','retornavel','contratado_pessoa_id','unidade_cobranca');
  IF n <> 6 THEN RAISE EXCEPTION 'FALHA E: colunas do item ausentes (%/6)', n; END IF;

  SELECT count(*) INTO n FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_obra_pagamentos'
      AND column_name IN ('pedido_id','ordem_compra_id','fornecedor_conta_id');
  IF n <> 3 THEN RAISE EXCEPTION 'FALHA F: elos do pagamento ausentes (%/3)', n; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_alertas' AND column_name='tenant_id') THEN
    RAISE EXCEPTION 'FALHA G: hub_alertas.tenant_id ausente';
  END IF;
  IF EXISTS (SELECT 1 FROM public.hub_alertas WHERE tenant_id IS NULL) THEN
    RAISE EXCEPTION 'FALHA G: há alerta sem tenant após backfill';
  END IF;

  RAISE NOTICE 'e7a OK: fundação de Compras aplicada (A·E·F·G·I). Cofre/cadeia/RPC = e7b.';
END $$;

-- ============================================================================
-- ROLLBACK (por bloco):
--  I: DROP INDEX IF EXISTS idx_hub_pedidos_fila, idx_hub_pedidos_negocio, idx_hub_pedido_itens_tipo,
--     idx_hub_alertas_tenant, idx_hub_pagamentos_pedido;
--  G: ALTER TABLE public.hub_alertas DROP COLUMN IF EXISTS tenant_id;
--  F: -- 1) se houver linhas tipo='compra', mover ANTES (NADA SE PERDE), senão o ADD do CHECK antigo falha:
--     UPDATE public.hub_obra_pagamentos SET tipo='avulso' WHERE tipo='compra';
--     ALTER TABLE public.hub_obra_pagamentos DROP CONSTRAINT IF EXISTS hub_obra_pagamentos_tipo_check;
--     ALTER TABLE public.hub_obra_pagamentos ADD CONSTRAINT hub_obra_pagamentos_tipo_check CHECK (tipo IN ('medicao','adiantamento','retencao','aditivo','reembolso','avulso'));
--     ALTER TABLE public.hub_obra_pagamentos DROP COLUMN IF EXISTS pedido_id, DROP COLUMN IF EXISTS ordem_compra_id, DROP COLUMN IF EXISTS fornecedor_conta_id;
--  E: ALTER TABLE public.hub_pedido_itens DROP CONSTRAINT IF EXISTS chk_item_tipo, DROP CONSTRAINT IF EXISTS chk_item_modelo;
--     ALTER TABLE public.hub_pedido_itens DROP COLUMN IF EXISTS tipo_item, DROP COLUMN IF EXISTS modelo_precificacao, DROP COLUMN IF EXISTS precificacao_json, DROP COLUMN IF EXISTS retornavel, DROP COLUMN IF EXISTS contratado_pessoa_id, DROP COLUMN IF EXISTS unidade_cobranca;
--  A: ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS chk_sc_contexto;
--     ALTER TABLE public.hub_pedidos_material DROP COLUMN IF EXISTS negocio_id, DROP COLUMN IF EXISTS projeto_id, DROP COLUMN IF EXISTS servico_id;
--  G: ALTER TABLE public.hub_alertas ALTER COLUMN tenant_id DROP DEFAULT; ALTER TABLE public.hub_alertas DROP COLUMN IF EXISTS tenant_id;
--  (obra_id volta a NOT NULL só após backfill garantido — não reverter às cegas.)
-- ============================================================================
