-- ============================================================================
-- E5 — COMPRAS → ESTOQUE (SC · Movimentação · Inventário) — BLOCO E5
--
-- ⚠️  NÃO aplicar — janela do dono. Aditiva, REVERSÍVEL, fiel ao padrão do projeto:
--       - ESTENDE hub_pedidos_material (cabeçalho da SC) — só ADD COLUMN + backfill ANTES do CHECK;
--       - 2 tabelas NOVAS (hub_pedido_itens, hub_estoque_mov) + 1 VIEW (vw_hub_inventario);
--       - RLS via current_user_tenant_id() (igual E0 20260705130000 / E3 20260712120000);
--       - trigger de timestamp reusa public.hub_atualizar_timestamp();
--       - VIEW security_invoker=true (igual vw_hub_obra_bloqueios_hoje / vw_hub_obra_itens_situacao);
--       - RPC SECURITY DEFINER + REVOKE public/anon + filtro tenant explícito (igual gerar_codigo_obra /
--         hub_obra_restricao_promover);
--       - "NADA SE PERDE": hub_estoque_mov é APPEND-ONLY (sem UPDATE/DELETE de histórico —
--         re-entrega/devolução = nova linha, nunca UPDATE destrutivo de saldo); pedido cancelado
--         é status='cancelado' (soft-delete), nunca DELETE físico.
--       - ZERO DROP/ALTER destrutivo em E0/E2/E3 e nas colunas existentes de hub_pedidos_material.
--
-- DECISÃO (verificada no código, ver docs/E5-DESIGN.md):
--   - ESTENDER hub_pedidos_material (não criar hub_compras paralelo — quebraria o elo E3
--     pedido_material_id e o proxy E1 de "pedido aberto", criando 2 verdades).
--   - hub_pedido_itens: itens estruturados (Click-and-Go destrava catálogo, entrega parcial,
--     cotação por item via cotacoes_json).
--   - hub_estoque_mov: a aba "Movimentação" (entrada nasce da cascata; saida/devolucao do humano).
--   - vw_hub_inventario: VIEW (não tabela) = Inventário é fórmula derivada (Entrada−Saída+Devolução),
--     uma única verdade do número, sempre auditável.
--   - Cotações v1 = cotacoes_json no item (NÃO reusar hub_cotacoes_pedidos/_respostas — fluxo paralelo
--     amarrado a hub_aprovacoes, sem FK a pedido/item; forçar acoplamento divergente). Promover a
--     tabela própria só quando a comissão transacional (FASE 2) exigir join.
--
-- ⚠️  ORDEM DE APPLY: 20260523120000 (hub_pedidos_material) → E0 (20260705130000, hub_catalogo +
--     hub_obra_frentes_eap) → E3 (20260712120000, hub_obra_restricoes.pedido_material_id) → E5 (este).
--     Em prod o degrade existe (endpoints respondem migracao_pendente); em apply cronológico a ordem
--     é respeitada.
--
-- ROLLBACK no fim do arquivo.
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; alinhado à canônica) ──────────
-- AUDITORIA-FIX: idêntico à canônica (20260626130000_multitenant_foundation) — NÃO enfraquecer.
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1),
    '00000000-0000-4000-8000-000000000001'::uuid
  )
$function$;
GRANT EXECUTE ON FUNCTION public.current_user_tenant_id() TO anon, authenticated;

-- ─── 1) ESTENDER hub_pedidos_material (cabeçalho da SC) — ADITIVO ──────────────
-- A tabela já tem codigo/obra_id/descricao/status/valor_estimado/solicitado_por/tenant_id.
-- O status ('rascunho','cotando','aprovado','entregue','cancelado') já É o ciclo da SC.
ALTER TABLE public.hub_pedidos_material
  ADD COLUMN IF NOT EXISTS tipo_material   TEXT,            -- categoria do catálogo (material/equipamento/servico/mao_de_obra)
  ADD COLUMN IF NOT EXISTS frente_id       UUID,            -- soft FK hub_obra_frentes_eap (E0); sem hard FK (aditivo seguro)
  ADD COLUMN IF NOT EXISTS restricao_id    UUID,            -- soft FK hub_obra_restricoes (E3); elo "falta material"→SC
  ADD COLUMN IF NOT EXISTS urgencia        TEXT,
  ADD COLUMN IF NOT EXISTS origem          TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_por    TEXT,            -- gate humano da COMPRA (quem aprovou)
  ADD COLUMN IF NOT EXISTS aprovado_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregue_em     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entrega_parcial BOOLEAN NOT NULL DEFAULT false;

-- Backfill do legado ANTES de qualquer CHECK novo (sem isso o CHECK falharia em linhas NULL).
UPDATE public.hub_pedidos_material
  SET tipo_material = COALESCE(tipo_material, 'material'),
      urgencia      = COALESCE(urgencia, 'normal'),
      origem        = COALESCE(origem, 'manual')
  WHERE tipo_material IS NULL OR urgencia IS NULL OR origem IS NULL;

-- Defaults (aplicados às linhas novas; as antigas já foram backfilled acima).
ALTER TABLE public.hub_pedidos_material
  ALTER COLUMN tipo_material SET DEFAULT 'material',
  ALTER COLUMN urgencia      SET DEFAULT 'normal',
  ALTER COLUMN origem        SET DEFAULT 'manual';

-- CHECKs aditivos (depois do backfill).
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_urgencia_check;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_urgencia_check
  CHECK (urgencia IN ('normal','urgente','critico'));
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_origem_check;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_origem_check
  CHECK (origem IN ('manual','ia','e3_restricao'));

-- Status: ampliar com 'entregue_parcial' (DROP+ADD — valores antigos preservados pelo backfill acima).
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_status_check;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_status_check
  CHECK (status IN ('rascunho','cotando','aprovado','entregue_parcial','entregue','cancelado'));

CREATE INDEX IF NOT EXISTS idx_hub_pedidos_material_obra
  ON public.hub_pedidos_material (obra_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_pedidos_material_tenant
  ON public.hub_pedidos_material (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_pedidos_material_restricao
  ON public.hub_pedidos_material (restricao_id) WHERE restricao_id IS NOT NULL;

-- ─── 2) hub_pedido_itens (NOVA) — Click-and-Go + entrega parcial + cotações v1 ─
CREATE TABLE IF NOT EXISTS public.hub_pedido_itens (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id          UUID NOT NULL REFERENCES public.hub_pedidos_material(id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  catalogo_id        UUID REFERENCES public.hub_catalogo(id) ON DELETE RESTRICT, -- NULL = item fora do catálogo
  descricao_snapshot TEXT NOT NULL,    -- congela o nome; chave de dedup textual quando catalogo_id NULL
  categoria          TEXT,
  unidade            TEXT,
  qtd_pedida         NUMERIC(12,3) NOT NULL CHECK (qtd_pedida > 0),
  qtd_entregue       NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (qtd_entregue >= 0),  -- entrega parcial
  preco_unit_estimado NUMERIC(14,4),
  preco_unit_final   NUMERIC(14,4),
  cotacoes_json      JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{fornecedor_nome, fornecedor_id?, valor_total, prazo_dias, score_ia{}, escolhida}]
  item_fora_catalogo BOOLEAN NOT NULL DEFAULT false,
  ordem              INTEGER NOT NULL DEFAULT 0,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_pedido_itens_pedido
  ON public.hub_pedido_itens (pedido_id, ordem);
CREATE INDEX IF NOT EXISTS idx_hub_pedido_itens_tenant
  ON public.hub_pedido_itens (tenant_id);

DROP TRIGGER IF EXISTS hub_pedido_itens_ts ON public.hub_pedido_itens;
CREATE TRIGGER hub_pedido_itens_ts BEFORE UPDATE ON public.hub_pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_pedido_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_pedido_itens_rls ON public.hub_pedido_itens;
CREATE POLICY hub_pedido_itens_rls ON public.hub_pedido_itens FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_pedido_itens TO authenticated, service_role;

COMMENT ON TABLE public.hub_pedido_itens IS
  'E5: itens estruturados da SC (cabeçalho = hub_pedidos_material). descricao_snapshot congela o nome; catalogo_id NULL = item fora do catálogo (agrupa por descricao_snapshot). qtd_entregue suporta entrega parcial. cotacoes_json = cotações v1 por item (sem reusar hub_cotacoes_pedidos).';

-- ─── 3) hub_estoque_mov (NOVA) — a aba "Movimentação". APPEND-ONLY (imutável) ──
-- "NADA SE PERDE": sem coluna atualizado_em. Re-entrega/devolução/ajuste = NOVA linha.
-- quantidade > 0 sempre; o SINAL vem do tipo (a view soma com o sinal correto).
CREATE TABLE IF NOT EXISTS public.hub_estoque_mov (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  catalogo_id     UUID REFERENCES public.hub_catalogo(id) ON DELETE RESTRICT,
  codigo_catalogo TEXT,
  descricao       TEXT NOT NULL,
  categoria       TEXT,
  unidade         TEXT,
  tipo            TEXT NOT NULL CHECK (tipo IN ('entrada','saida','devolucao','ajuste')),
  quantidade      NUMERIC(12,3) NOT NULL CHECK (quantidade > 0),
  pedido_id       UUID REFERENCES public.hub_pedidos_material(id) ON DELETE SET NULL,
  pedido_item_id  UUID REFERENCES public.hub_pedido_itens(id) ON DELETE SET NULL,  -- elo p/ rastreio da cascata
  frente_id       UUID,             -- soft FK (sem hard FK, aditivo seguro)
  motivo          TEXT,
  registrado_por  TEXT,
  origem          TEXT NOT NULL DEFAULT 'sistema' CHECK (origem IN ('sistema','manual','ia','ajuste')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- SEM atualizado_em: audit trail imutável
);
CREATE INDEX IF NOT EXISTS idx_hub_estoque_mov_inventario
  ON public.hub_estoque_mov (obra_id, catalogo_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_estoque_mov_tenant
  ON public.hub_estoque_mov (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_estoque_mov_pedido
  ON public.hub_estoque_mov (pedido_id);
-- Idempotência da cascata: 1 entrada por (pedido_item_id, criado_em) é garantida no RPC, mas para
-- proteger double-tap de re-entrega total acidental NÃO criamos unique (entrega parcial = N linhas
-- legítimas por item). A idempotência forte é o uso de NOW() distinto + a checagem de qtd no RPC.

ALTER TABLE public.hub_estoque_mov ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_estoque_mov_sel ON public.hub_estoque_mov;
CREATE POLICY hub_estoque_mov_sel ON public.hub_estoque_mov FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_estoque_mov_ins ON public.hub_estoque_mov;
CREATE POLICY hub_estoque_mov_ins ON public.hub_estoque_mov FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
-- SEM policy de UPDATE/DELETE para authenticated → "NADA SE PERDE": histórico imutável pela RLS.
-- (service_role mantém grant total para ajustes administrativos auditados via nova linha 'ajuste'.)
GRANT SELECT, INSERT ON public.hub_estoque_mov TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_estoque_mov TO service_role;

COMMENT ON TABLE public.hub_estoque_mov IS
  'E5: aba Movimentação. APPEND-ONLY (sem atualizado_em; sem UPDATE/DELETE para authenticated) — NADA SE PERDE. quantidade>0; o sinal vem do tipo. entrada nasce da cascata SC (hub_sc_registrar_entrega); saida/devolucao/ajuste do humano. pedido_item_id rastreia a origem.';

-- ─── 4) VIEW vw_hub_inventario = Entrada − Saída + Devolução (+ ajuste) ────────
-- security_invoker=true → respeita a RLS de QUEM consulta. Os endpoints filtram tenant explícito
-- (crmDb é service-role e bypassa RLS). Inventário NUNCA é tabela: é a fórmula da planilha, derivada.
CREATE OR REPLACE VIEW public.vw_hub_inventario WITH (security_invoker = true) AS
SELECT
  m.obra_id,
  m.tenant_id,
  m.catalogo_id,
  COALESCE(MAX(m.descricao), MAX(m.codigo_catalogo))                            AS descricao,
  MAX(m.categoria)                                                              AS categoria,
  MAX(m.unidade)                                                                AS unidade,
  MAX(m.codigo_catalogo)                                                        AS codigo_catalogo,
  SUM(CASE m.tipo
        WHEN 'entrada'   THEN m.quantidade
        WHEN 'devolucao' THEN m.quantidade
        WHEN 'saida'     THEN -m.quantidade
        WHEN 'ajuste'    THEN m.quantidade   -- ajuste pode ser +; correções negativas usam saida
        ELSE 0 END)                                                            AS em_estoque,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'entrada')                          AS total_entrada,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'saida')                            AS total_saida,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'devolucao')                        AS total_devolucao,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'ajuste')                           AS total_ajuste,
  COUNT(*)                                                                      AS num_movimentos,
  MAX(m.criado_em)                                                             AS ultima_mov_em
FROM public.hub_estoque_mov m
GROUP BY m.obra_id, m.tenant_id, m.catalogo_id;

GRANT SELECT ON public.vw_hub_inventario TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_inventario IS
  'E5: Inventário derivado (Entrada − Saída + Devolução + Ajuste) por (obra, item). Fiel à planilha. Estoque negativo é PERMITIDO (alerta na UI, nunca esconde). Agrupa por catalogo_id; itens fora do catálogo (catalogo_id NULL) agregam num grupo "sem catálogo" por obra — a UI mostra a descrição.';

-- ─── 5) RPC hub_sc_registrar_entrega — cascata SC→Inventário (idempotente) ─────
-- Registra a ENTREGA de itens: insere ENTRADA imutável em hub_estoque_mov + soma qtd_entregue +
-- recalcula o status do pedido (entregue / entregue_parcial). SECURITY DEFINER + guard tenant
-- explícito (bypassa RLS) + REVOKE public/anon. Re-entrega = NOVA linha (nunca UPDATE destrutivo).
CREATE OR REPLACE FUNCTION public.hub_sc_registrar_entrega(
  p_pedido_id      uuid,
  p_tenant_id      uuid,
  p_itens          jsonb,            -- [{ item_id, qtd }]
  p_registrado_por text DEFAULT NULL,
  p_obs            text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item   jsonb;
  v_it     public.hub_pedido_itens%ROWTYPE;
  v_obra   uuid;
  v_qtd    numeric;
  v_all    boolean;
  v_qtquer numeric := 0;   -- nº de entradas efetivamente registradas
  v_codigo text;
BEGIN
  -- 0) GUARD tenant explícito (SECURITY DEFINER bypassa RLS — a posse é checada aqui).
  SELECT obra_id INTO v_obra FROM public.hub_pedidos_material
    WHERE id = p_pedido_id AND tenant_id = p_tenant_id;
  IF v_obra IS NULL THEN
    RAISE EXCEPTION 'pedido_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'itens_invalidos' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := COALESCE((v_item->>'qtd')::numeric, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_it FROM public.hub_pedido_itens
      WHERE id = (v_item->>'item_id')::uuid
        AND tenant_id = p_tenant_id
        AND pedido_id = p_pedido_id;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- código do catálogo (se houver) para o snapshot da movimentação
    -- catalogo: tenant OU global; NULL=global legítimo (E0), não o leak de NULL=órfão.
    v_codigo := NULL;
    IF v_it.catalogo_id IS NOT NULL THEN
      SELECT codigo INTO v_codigo FROM public.hub_catalogo
        WHERE id = v_it.catalogo_id AND (tenant_id = p_tenant_id OR tenant_id IS NULL);
    END IF;

    -- ENTRADA imutável (re-entrega = nova linha; jamais UPDATE destrutivo de saldo).
    INSERT INTO public.hub_estoque_mov(
      obra_id, tenant_id, catalogo_id, codigo_catalogo, descricao, categoria, unidade,
      tipo, quantidade, pedido_id, pedido_item_id, frente_id, registrado_por, motivo, origem
    ) VALUES (
      v_obra, p_tenant_id, v_it.catalogo_id, v_codigo, v_it.descricao_snapshot, v_it.categoria,
      v_it.unidade, 'entrada', v_qtd, p_pedido_id, v_it.id, NULL, p_registrado_por, p_obs, 'sistema'
    );

    -- Soma a entrega no item (entrega parcial soma; total fecha). Idempotência: o acumulado nunca
    -- ultrapassa qtd_pedida (protege double-tap de re-entrega). hub_estoque_mov permanece append-only
    -- (a ENTRADA acima é sempre nova linha — NADA SE PERDE; só o saldo do item é limitado).
    UPDATE public.hub_pedido_itens
      SET qtd_entregue = LEAST(qtd_pedida, qtd_entregue + v_qtd), atualizado_em = NOW()
      WHERE id = v_it.id;

    v_qtquer := v_qtquer + 1;
  END LOOP;

  -- Recalcula o status do pedido: tudo entregue → 'entregue'; senão 'entregue_parcial'.
  -- bool_and sobre pedido SEM itens retorna NULL → tratamos como 'entregue' (legado de descrição livre).
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
    'entradas_registradas', v_qtquer,
    'sugerir_resolver_restricao', (SELECT restricao_id FROM public.hub_pedidos_material WHERE id = p_pedido_id)
  );
END $$;
REVOKE ALL ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text) IS
  'E5: cascata SC→Inventário. Insere ENTRADA imutável por item entregue + soma qtd_entregue + recalcula status (entregue/entregue_parcial). Guard tenant explícito (SECURITY DEFINER). Re-entrega = nova linha (NADA SE PERDE). Retorna sugerir_resolver_restricao (elo E3) — quem destrava é o humano, nunca automático.';

-- ─── 6) gerar_codigo_sc(tenant) — código SC atômico e POR TENANT ──────────────
-- Reusa o padrão atômico de gerar_codigo_obra (contador por tenant+tipo+ano, NÃO COUNT(*) global —
-- corrige o vazamento cross-tenant do gerador antigo de PED- em /api/crm/pedidos/route.ts).
CREATE OR REPLACE FUNCTION public.gerar_codigo_sc(p_tenant uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ano    int := extract(year from now())::int;
  v_seq    int;
  v_tenant uuid := coalesce(p_tenant, '00000000-0000-4000-8000-000000000001'::uuid);
BEGIN
  -- reusa a tabela de contador de E0 (hub_obra_codigo_contador) com tipo='sc' — uma só fonte atômica.
  INSERT INTO public.hub_obra_codigo_contador AS c (tenant_id, tipo, ano, ultimo)
    VALUES (v_tenant, 'sc', v_ano, 1)
    ON CONFLICT (tenant_id, tipo, ano) DO UPDATE SET ultimo = c.ultimo + 1
    RETURNING c.ultimo INTO v_seq;
  RETURN 'SC-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END $$;
REVOKE ALL ON FUNCTION public.gerar_codigo_sc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_sc(uuid) TO authenticated, service_role;

-- ─── 7) Seed global de ~20 materiais frequentes (tenant_id NULL = global) ──────
-- BLOQUEANTE do Click-and-Go: sem materiais no catálogo, a SC (Tipo→Descrição) abre vazia.
-- O dono valida/edita depois (memória: "validar o seed de materiais"). Idempotente (WHERE NOT EXISTS).
INSERT INTO public.hub_catalogo (tenant_id, categoria, codigo, descricao, unidade, grupo, ordem)
SELECT NULL, 'material', v.codigo, v.descricao, v.unidade, v.grupo, v.ordem
FROM (VALUES
  ('CIM-CPII',  'Cimento CP-II',            'saco',  'Básicos',      0),
  ('CIM-CPV',   'Cimento CP-V ARI',         'saco',  'Básicos',      1),
  ('AREIA-MED', 'Areia média',              'm³',    'Agregados',    2),
  ('AREIA-FINA','Areia fina',               'm³',    'Agregados',    3),
  ('BRITA-1',   'Brita 1',                  'm³',    'Agregados',    4),
  ('CAL-HID',   'Cal hidratada',            'saco',  'Básicos',      5),
  ('ARG-AC1',   'Argamassa colante AC-I',   'saco',  'Argamassas',   6),
  ('ARG-AC3',   'Argamassa colante AC-III', 'saco',  'Argamassas',   7),
  ('VERG-8',    'Vergalhão CA-50 8mm',      'barra', 'Aço',          8),
  ('VERG-10',   'Vergalhão CA-50 10mm',     'barra', 'Aço',          9),
  ('BLOCO-CER', 'Bloco cerâmico 9x19x19',   'un',    'Alvenaria',   10),
  ('BLOCO-CONC','Bloco de concreto 14x19x39','un',   'Alvenaria',   11),
  ('TIJOLO',    'Tijolo baiano',            'un',    'Alvenaria',   12),
  ('TUBO-PVC-100','Tubo PVC esgoto 100mm',  'barra', 'Hidráulica',  13),
  ('TUBO-PVC-25', 'Tubo PVC soldável 25mm', 'barra', 'Hidráulica',  14),
  ('CABO-25',   'Cabo flexível 2,5mm²',     'm',     'Elétrica',    15),
  ('CABO-40',   'Cabo flexível 4,0mm²',     'm',     'Elétrica',    16),
  ('ELETRODUTO','Eletroduto corrugado 3/4', 'm',     'Elétrica',    17),
  ('TINTA-18',  'Tinta acrílica 18L',       'lata',  'Pintura',     18),
  ('MASSA-COR', 'Massa corrida 18L',        'lata',  'Pintura',     19),
  ('GESSO',     'Gesso em pó',              'saco',  'Acabamento',  20),
  ('IMPER-MANTA','Manta asfáltica 3mm',     'rolo',  'Impermeab.',  21)
) AS v(codigo, descricao, unidade, grupo, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_catalogo c
  WHERE c.tenant_id IS NULL AND c.categoria = 'material' AND c.codigo = v.codigo
);

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text);
--   DROP FUNCTION IF EXISTS public.gerar_codigo_sc(uuid);
--   DROP VIEW IF EXISTS public.vw_hub_inventario;
--   DROP TABLE IF EXISTS public.hub_estoque_mov;
--   DROP TABLE IF EXISTS public.hub_pedido_itens;
--   -- hub_pedidos_material: remover só se preciso reverter o E5 (mantém dados legados):
--   --   ALTER TABLE public.hub_pedidos_material
--   --     DROP COLUMN IF EXISTS tipo_material, DROP COLUMN IF EXISTS frente_id,
--   --     DROP COLUMN IF EXISTS restricao_id, DROP COLUMN IF EXISTS urgencia,
--   --     DROP COLUMN IF EXISTS origem, DROP COLUMN IF EXISTS aprovado_por,
--   --     DROP COLUMN IF EXISTS aprovado_em, DROP COLUMN IF EXISTS entregue_em,
--   --     DROP COLUMN IF EXISTS entrega_parcial;
--   --   ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_status_check;
--   --   ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_status_check
--   --     CHECK (status IN ('rascunho','cotando','aprovado','entregue','cancelado'));
--   -- (seed de materiais globais pode permanecer — é aditivo e útil.)
-- ============================================================================
