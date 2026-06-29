-- ============================================================================
-- E6 — FINANCEIRO + 2 MODELOS DE CONTRATO + ESCROW (custódia + aprovação dupla) — BLOCO E6
--
-- ⚠️  NÃO aplicar — janela do dono. ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - tipo_contrato em hub_obras (CHECK administracao/preco_fechado; IMUTÁVEL pós-1º orçamento
--         aprovado via GUARD no endpoint PATCH — NÃO trigger, para não esconder magia);
--       - 5 tabelas NOVAS (orcamentos, orcamento_itens, pagamentos, escrow_contas, escrow_movimentos);
--       - 1 VIEW (vw_hub_obra_compatibilizacao, security_invoker=true como E2/E5);
--       - 2 RPCs SECURITY DEFINER + REVOKE public/anon + GUARD de tenant ANTES de qualquer mutação;
--       - expande o CHECK de hub_aprovacoes.tipo (DROP+ADD, preservando os 5 originais) + add obra_id;
--       - RLS via current_user_tenant_id() (igual E0/E2/E3/E5); timestamp reusa hub_atualizar_timestamp();
--       - "NADA SE PERDE": hub_obra_escrow_movimentos é APPEND-ONLY (extrato imutável, sem UPDATE/DELETE
--         para authenticated); pagamento cancelado é status='cancelado' (soft-delete), nunca DELETE físico.
--       - ZERO DROP/ALTER destrutivo em E0/E2/E3/E5 nem nas colunas existentes de hub_obras/hub_aprovacoes.
--
-- HUMANO APROVA O DINHEIRO: a IA prepara o card e enfileira; o escrow só libera com a APROVAÇÃO DUPLA
--   (arquitetura + Hub) — DOIS registros tipados em hub_aprovacoes, não JSONB mutável. Aprovar/liberar
--   por voz é PROIBIDO por design (espelha E5: a SC nasce em rascunho, aprovar é gate humano na tela).
--
-- BIFURCAÇÃO POR tipo_contrato É NA APRESENTAÇÃO, NÃO NO SCHEMA: um campo no dado, duas telas.
--   administracao → cliente vê valor UNITÁRIO (gestão aberta); preco_fechado → só TOTAIS (turn-key,
--   a composição é da executante). O endpoint do financeiro filtra o que cada um vê (defesa na query:
--   no preço fechado NÃO seleciona valor_unitario).
--
-- ⚠️  ORDEM DE APPLY: 20260523120000 (hub_aprovacoes) → E0 (20260705130000) → E2 (20260710120000,
--     hub_obra_itens.valor_contrato = base da compatibilização) → E5 (20260720120000) → E6 (este).
--     Em prod o degrade existe (endpoints respondem migracao_pendente; cockpit §4 segue temFinanceiro=false);
--     em apply cronológico do diretório a ordem é respeitada pelos timestamps.
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

-- ─── 1) ALTER hub_obras — o EIXO tipo_contrato (IMUTÁVEL via guard no endpoint) ──
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'administracao';
ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_tipo_contrato_check;
ALTER TABLE public.hub_obras ADD CONSTRAINT hub_obras_tipo_contrato_check
  CHECK (tipo_contrato IN ('administracao','preco_fechado'));
COMMENT ON COLUMN public.hub_obras.tipo_contrato IS
  'IMUTÁVEL pós-1º orçamento aprovado (guard no endpoint PATCH /api/crm/obras/[id], SEM trigger). '
  'administracao=cliente vê UNITÁRIO (gestão aberta); preco_fechado=turn-key, só TOTAIS (composição da executante).';

-- ─── 2) hub_obra_orcamentos — cabeçalho/frente (unidade de aprovação — Gate 1) ──
CREATE TABLE IF NOT EXISTS public.hub_obra_orcamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  frente_id       UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE SET NULL, -- E0; nullable
  titulo          TEXT NOT NULL,
  descricao       TEXT,
  versao          INTEGER NOT NULL DEFAULT 1,
  orcamento_pai_id UUID REFERENCES public.hub_obra_orcamentos(id) ON DELETE SET NULL, -- aditivo/revisão
  -- administracao: derivado dos itens; preco_fechado: lump sum direto.
  valor_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'rascunho'
                  CHECK (status IN ('rascunho','enviado','aprovado','rejeitado','cancelado')),
  -- Link ao gate dourado (Gate 1 = orcamento_frente em hub_aprovacoes).
  aprovacao_id    UUID REFERENCES public.hub_aprovacoes(id) ON DELETE SET NULL,
  aprovado_em     TIMESTAMPTZ,
  aprovado_por    TEXT,
  -- Escrow do orçamento (custódia). MVP contábil; banco real = fase 2.
  escrow_status   TEXT NOT NULL DEFAULT 'sem_custodia'
                  CHECK (escrow_status IN ('sem_custodia','aguardando_deposito','em_custodia','liberado','devolvido')),
  escrow_valor    NUMERIC(14,2),
  escrow_ref      TEXT,             -- id externo do provedor (fase 2)
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamentos_obra
  ON public.hub_obra_orcamentos (obra_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamentos_tenant
  ON public.hub_obra_orcamentos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamentos_frente
  ON public.hub_obra_orcamentos (frente_id);

DROP TRIGGER IF EXISTS hub_obra_orcamentos_ts ON public.hub_obra_orcamentos;
CREATE TRIGGER hub_obra_orcamentos_ts BEFORE UPDATE ON public.hub_obra_orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_orcamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_orcamentos_rls ON public.hub_obra_orcamentos;
CREATE POLICY hub_obra_orcamentos_rls ON public.hub_obra_orcamentos FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_orcamentos TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_orcamentos IS
  'E6: orçamento por frente (Gate 1). Não armazena tipo_contrato (lê da obra = fonte única). '
  'valor_total: administracao=derivado dos itens; preco_fechado=lump sum. aprovacao_id=link ao gate dourado.';

-- ─── 3) hub_obra_orcamento_itens — linha/item (fidelidade unitária) ───────────
-- Existe nos dois tipos; visivel_cliente controla exposição. No preço fechado o endpoint NÃO seleciona
-- valor_unitario/composição (defesa na query) — a composição interna é da executante.
CREATE TABLE IF NOT EXISTS public.hub_obra_orcamento_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    UUID NOT NULL REFERENCES public.hub_obra_orcamentos(id) ON DELETE CASCADE,
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  item_id         UUID REFERENCES public.hub_obra_itens(id) ON DELETE SET NULL,  -- E2: base da compatibilização
  descricao       TEXT NOT NULL,
  unidade         TEXT,
  quantidade      NUMERIC(10,3) NOT NULL DEFAULT 1,
  valor_unitario  NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total     NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantidade * valor_unitario, 2)) STORED,
  spread_pct      NUMERIC(5,2) NOT NULL DEFAULT 0,   -- "gerenciamento" honesto (adm); auditável
  -- Composição INTERNA (preço fechado: nunca exibida ao cliente; o endpoint filtra antes do Portal).
  custo_material  NUMERIC(14,2),
  custo_mao_obra  NUMERIC(14,2),
  custo_outros    NUMERIC(14,2),
  margem_pct      NUMERIC(5,2),
  visivel_cliente BOOLEAN NOT NULL DEFAULT true,
  ordem           INTEGER NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamento_itens_orcamento
  ON public.hub_obra_orcamento_itens (orcamento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamento_itens_item
  ON public.hub_obra_orcamento_itens (item_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_orcamento_itens_tenant
  ON public.hub_obra_orcamento_itens (tenant_id);

ALTER TABLE public.hub_obra_orcamento_itens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_orcamento_itens_rls ON public.hub_obra_orcamento_itens;
CREATE POLICY hub_obra_orcamento_itens_rls ON public.hub_obra_orcamento_itens FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_orcamento_itens TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_orcamento_itens IS
  'E6: linhas do orçamento. valor_total é GENERATED (qtd×unitário). item_id liga ao item E2 (compatibilização). '
  'Composição interna (custo_*/margem) é auditável pelo Hub mas FILTRADA pelo endpoint no preço fechado (nunca ao cliente).';

-- ─── 4) hub_obra_pagamentos — parcela (Gate 2 DUPLO: arq + hub) + escrow ──────
CREATE TABLE IF NOT EXISTS public.hub_obra_pagamentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  orcamento_id    UUID REFERENCES public.hub_obra_orcamentos(id) ON DELETE SET NULL,
  item_id         UUID REFERENCES public.hub_obra_itens(id) ON DELETE SET NULL,
  titulo          TEXT NOT NULL,
  tipo            TEXT NOT NULL DEFAULT 'medicao'
                  CHECK (tipo IN ('medicao','adiantamento','retencao','aditivo','reembolso','avulso')),
  numero_medicao  INTEGER,
  valor           NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_retencao  NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_liquido   NUMERIC(14,2) GENERATED ALWAYS AS (valor - valor_retencao) STORED,
  valor_pago      NUMERIC(14,2),
  data_vencimento DATE NOT NULL,
  data_pagamento  DATE,
  -- 'atrasado' é DERIVADO na UI (status liberável + venc<hoje), NÃO coluna (fonte única).
  status          TEXT NOT NULL DEFAULT 'bloqueado'
                  CHECK (status IN ('bloqueado','liberado','autorizado','em_custodia','pago','cancelado')),
  -- GATE 2 DUPLO: dois links de aprovação, papéis distintos (DOIS registros tipados em hub_aprovacoes).
  aprovacao_arq_id UUID REFERENCES public.hub_aprovacoes(id) ON DELETE SET NULL,  -- chave 1: arquitetura
  aprovacao_hub_id UUID REFERENCES public.hub_aprovacoes(id) ON DELETE SET NULL,  -- chave 2: Hub (juiz)
  escrow_liberado    BOOLEAN NOT NULL DEFAULT false,
  escrow_liberado_em TIMESTAMPTZ,
  escrow_liberado_por TEXT,
  tipo_contrato   TEXT NOT NULL DEFAULT 'administracao',  -- desnorm. p/ relatório (lido da obra)
  adiantamento_justificativa TEXT,   -- obrigatório se tipo='adiantamento' (CHECK abaixo)
  fornecedor_id   UUID,
  fornecedor_nome TEXT,
  criado_por      TEXT,
  decidido_por    TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.hub_obra_pagamentos DROP CONSTRAINT IF EXISTS chk_adiantamento_just;
ALTER TABLE public.hub_obra_pagamentos ADD CONSTRAINT chk_adiantamento_just
  CHECK (tipo <> 'adiantamento' OR adiantamento_justificativa IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_hub_obra_pagamentos_obra
  ON public.hub_obra_pagamentos (obra_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_obra_pagamentos_tenant
  ON public.hub_obra_pagamentos (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_pagamentos_orcamento
  ON public.hub_obra_pagamentos (orcamento_id);
-- Índice parcial do cockpit (vencimento dos liberáveis): barato e seletivo.
CREATE INDEX IF NOT EXISTS idx_hub_obra_pagamentos_cockpit
  ON public.hub_obra_pagamentos (tenant_id, status, data_vencimento)
  WHERE status IN ('liberado','autorizado','em_custodia');

DROP TRIGGER IF EXISTS hub_obra_pagamentos_ts ON public.hub_obra_pagamentos;
CREATE TRIGGER hub_obra_pagamentos_ts BEFORE UPDATE ON public.hub_obra_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_pagamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_pagamentos_rls ON public.hub_obra_pagamentos;
CREATE POLICY hub_obra_pagamentos_rls ON public.hub_obra_pagamentos FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_pagamentos TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_pagamentos IS
  'E6: parcela/medição. Gate 2 DUPLO: aprovacao_arq_id + aprovacao_hub_id (DOIS registros em hub_aprovacoes). '
  'O escrow só libera com AMBAS aprovadas (rpc_liberar_escrow). append-only: cancelar=status (soft), nunca DELETE. '
  '"atrasado" é DERIVADO (status liberável + venc<hoje), não coluna.';

-- ─── 5) ESCROW — conta (1 por obra) + movimentos APPEND-ONLY (extrato imutável) ──
CREATE TABLE IF NOT EXISTS public.hub_obra_escrow_contas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  saldo_custodia  NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_liberado  NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_pago      NUMERIC(14,2) NOT NULL DEFAULT 0,
  provedor        TEXT NOT NULL DEFAULT 'interno',   -- MVP=virtual/contábil; fase2='banco_x'
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_obra_escrow_contas_tenant
  ON public.hub_obra_escrow_contas (tenant_id);

DROP TRIGGER IF EXISTS hub_obra_escrow_contas_ts ON public.hub_obra_escrow_contas;
CREATE TRIGGER hub_obra_escrow_contas_ts BEFORE UPDATE ON public.hub_obra_escrow_contas
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_escrow_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_escrow_contas_rls ON public.hub_obra_escrow_contas;
CREATE POLICY hub_obra_escrow_contas_rls ON public.hub_obra_escrow_contas FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_escrow_contas TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_escrow_contas IS
  'E6: 1 conta de custódia por obra. MVP provedor=interno (custódia CONTÁBIL, não banco real — honestidade na UI). '
  'Saldos são o agregado dos movimentos (extrato é a verdade auditável).';

-- Movimentos: APPEND-ONLY (sem atualizado_em; sem UPDATE/DELETE para authenticated). NADA SE PERDE.
CREATE TABLE IF NOT EXISTS public.hub_obra_escrow_movimentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id        UUID NOT NULL REFERENCES public.hub_obra_escrow_contas(id) ON DELETE CASCADE,
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('deposito','liberacao','pagamento','estorno')),
  valor           NUMERIC(14,2) NOT NULL CHECK (valor > 0),
  pagamento_id    UUID REFERENCES public.hub_obra_pagamentos(id) ON DELETE SET NULL,
  aprovacao_arq_id UUID REFERENCES public.hub_aprovacoes(id) ON DELETE SET NULL,  -- as 2 chaves que liberaram
  aprovacao_hub_id UUID REFERENCES public.hub_aprovacoes(id) ON DELETE SET NULL,
  origem          TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()  -- SEM atualizado_em: extrato imutável
);
CREATE INDEX IF NOT EXISTS idx_hub_obra_escrow_mov_conta
  ON public.hub_obra_escrow_movimentos (conta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_obra_escrow_mov_obra
  ON public.hub_obra_escrow_movimentos (obra_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_escrow_mov_tenant
  ON public.hub_obra_escrow_movimentos (tenant_id);

ALTER TABLE public.hub_obra_escrow_movimentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_escrow_mov_sel ON public.hub_obra_escrow_movimentos;
CREATE POLICY hub_obra_escrow_mov_sel ON public.hub_obra_escrow_movimentos FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_obra_escrow_mov_ins ON public.hub_obra_escrow_movimentos;
CREATE POLICY hub_obra_escrow_mov_ins ON public.hub_obra_escrow_movimentos FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
-- SEM policy de UPDATE/DELETE para authenticated → extrato imutável pela RLS (NADA SE PERDE).
-- (service_role mantém grant total para a RPC SECURITY DEFINER + estornos auditados via nova linha.)
GRANT SELECT, INSERT ON public.hub_obra_escrow_movimentos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_escrow_movimentos TO service_role;

COMMENT ON TABLE public.hub_obra_escrow_movimentos IS
  'E6: extrato APPEND-ONLY do escrow (deposito/liberacao/pagamento/estorno). Sem atualizado_em, sem UPDATE/DELETE '
  'para authenticated — o lastro auditável que o cliente vê. liberacao carrega as 2 chaves (arq+hub) que autorizaram.';

-- ─── 6) hub_aprovacoes — EXPANDIR o CHECK de tipo (Gate 1 + Gate 2 duplo) + obra_id ──
-- Confirmado no código: o CHECK ainda são os 5 originais. DROP+ADD preservando-os.
ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT IF EXISTS hub_aprovacoes_tipo_check;
ALTER TABLE public.hub_aprovacoes ADD CONSTRAINT hub_aprovacoes_tipo_check
  CHECK (tipo IN ('proposta','pedido_material','pagamento','desconto','outro',
                  'orcamento_frente',     -- GATE 1
                  'pagamento_obra_arq',   -- GATE 2 chave 1 (arquitetura)
                  'pagamento_obra_hub')); -- GATE 2 chave 2 (Hub)
ALTER TABLE public.hub_aprovacoes
  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.hub_obras(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_tenant_status
  ON public.hub_aprovacoes (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_aprovacoes_obra
  ON public.hub_aprovacoes (obra_id) WHERE obra_id IS NOT NULL;

-- ─── 7) VIEW vw_hub_obra_compatibilizacao — cobertura 🟢🟡🔴 + % (security_invoker) ──
-- Base = hub_obra_itens (E2, só itens-pai ativos). Melhor-orçamento por item: aprovado primeiro,
-- senão pendente (enviado) mais recente. % = orçado_aprovado ÷ valor_contrato. 3 estados (não 2).
-- security_invoker=true → respeita a RLS de quem consulta (endpoints ainda filtram tenant explícito).
CREATE OR REPLACE VIEW public.vw_hub_obra_compatibilizacao
  WITH (security_invoker = true) AS
WITH orc_por_item AS (
  SELECT
    oi.item_id,
    SUM(oi.valor_total) FILTER (WHERE o.status = 'aprovado')                       AS orcado_aprovado,
    SUM(oi.valor_total) FILTER (WHERE o.status IN ('enviado','rascunho'))          AS orcado_pendente
  FROM public.hub_obra_orcamento_itens oi
  JOIN public.hub_obra_orcamentos o ON o.id = oi.orcamento_id
  WHERE oi.item_id IS NOT NULL AND o.status <> 'cancelado'
  GROUP BY oi.item_id
),
pago_por_item AS (
  SELECT p.item_id, SUM(COALESCE(p.valor_pago, 0)) AS total_pago
  FROM public.hub_obra_pagamentos p
  WHERE p.item_id IS NOT NULL AND p.status = 'pago'
  GROUP BY p.item_id
)
SELECT
  i.id            AS item_id,
  i.obra_id,
  i.tenant_id,
  i.codigo,
  i.nome,
  i.disciplina_slug,
  i.area_label,
  i.valor_contrato,
  COALESCE(opi.orcado_aprovado, 0)  AS orcado_aprovado,
  COALESCE(opi.orcado_pendente, 0)  AS orcado_pendente,
  COALESCE(ppi.total_pago, 0)       AS total_pago,
  CASE
    WHEN COALESCE(opi.orcado_aprovado, 0) <= 0 AND COALESCE(opi.orcado_pendente, 0) <= 0 THEN 'sem_orcamento'
    WHEN i.valor_contrato IS NOT NULL AND i.valor_contrato > 0
         AND COALESCE(opi.orcado_aprovado, 0) >= i.valor_contrato THEN 'coberto'
    ELSE 'parcial'
  END AS estado_cobertura,
  CASE
    WHEN i.valor_contrato IS NULL OR i.valor_contrato = 0 THEN NULL
    ELSE ROUND(COALESCE(opi.orcado_aprovado, 0) / i.valor_contrato * 100)
  END AS pct_cobertura,
  (i.valor_contrato IS NOT NULL AND i.valor_contrato > 0
     AND COALESCE(opi.orcado_aprovado, 0) > i.valor_contrato) AS eh_aditivo
FROM public.hub_obra_itens i
LEFT JOIN orc_por_item opi ON opi.item_id = i.id
LEFT JOIN pago_por_item ppi ON ppi.item_id = i.id
WHERE i.ativo = true AND i.parent_id IS NULL;

GRANT SELECT ON public.vw_hub_obra_compatibilizacao TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_compatibilizacao IS
  'E6: cobertura (compatibilização) por item E2. 3 estados: sem_orcamento(🔴)/parcial(🟡)/coberto(🟢) + pct. '
  'pct=NULL quando sem valor_contrato (UI mostra —%). eh_aditivo=orçado>contratado (badge, não erro).';

-- ─── 8) RPC rpc_aprovar_orcamento_frente — Gate 1 (libera os pagamentos da frente) ──
-- SECURITY DEFINER + GUARD de tenant ANTES de qualquer mutação (crmDb/PATCH usam service_role e
-- bypassam RLS). Marca o orçamento 'aprovado' + os pagamentos vinculados 'bloqueado'→'liberado'.
CREATE OR REPLACE FUNCTION public.rpc_aprovar_orcamento_frente(
  p_orcamento_id uuid,
  p_aprovacao_id uuid,
  p_tenant_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra uuid;
  v_status text;
  v_liberados int := 0;
BEGIN
  -- GUARD tenant explícito (SECURITY DEFINER bypassa RLS — a posse é checada aqui).
  SELECT obra_id, status INTO v_obra, v_status
    FROM public.hub_obra_orcamentos
    WHERE id = p_orcamento_id AND tenant_id = p_tenant_id;
  IF v_obra IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'orcamento_nao_encontrado');
  END IF;

  -- Idempotência: já aprovado → não reprocessa (double-tap).
  IF v_status = 'aprovado' THEN
    RETURN jsonb_build_object('ok', true, 'idempotente', true, 'pagamentos_liberados', 0);
  END IF;

  UPDATE public.hub_obra_orcamentos
    SET status = 'aprovado',
        aprovacao_id = COALESCE(p_aprovacao_id, aprovacao_id),
        aprovado_em = NOW(),
        aprovado_por = 'humano'
    WHERE id = p_orcamento_id AND tenant_id = p_tenant_id;

  -- Libera os pagamentos vinculados a este orçamento (Gate 1 destrava o pagamento).
  UPDATE public.hub_obra_pagamentos
    SET status = 'liberado'
    WHERE orcamento_id = p_orcamento_id AND tenant_id = p_tenant_id AND status = 'bloqueado';
  GET DIAGNOSTICS v_liberados = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'pagamentos_liberados', v_liberados);
END $$;
REVOKE ALL ON FUNCTION public.rpc_aprovar_orcamento_frente(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_aprovar_orcamento_frente(uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_aprovar_orcamento_frente(uuid, uuid, uuid) IS
  'E6 Gate 1: aprova o orçamento da frente + libera (bloqueado→liberado) os pagamentos vinculados. '
  'Guard tenant explícito (SECURITY DEFINER). Idempotente. Disparada por EVENTO (cascata de hub_aprovacoes), não trigger.';

-- ─── 9) RPC rpc_liberar_escrow — Gate 2 DUPLO (só com arq E hub aprovados) ────
-- Lê o status das DUAS chaves (ambas com guard de tenant); só libera se AMBAS = 'aprovado'.
-- Insere o movimento 'liberacao' (APPEND-ONLY) + marca o pagamento 'autorizado'. Cria a conta se faltar.
CREATE OR REPLACE FUNCTION public.rpc_liberar_escrow(
  p_pagamento_id uuid,
  p_tenant_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pag      public.hub_obra_pagamentos%ROWTYPE;
  v_arq_st   text;
  v_hub_st   text;
  v_conta_id uuid;
  v_valor    numeric;
BEGIN
  -- GUARD tenant explícito.
  SELECT * INTO v_pag FROM public.hub_obra_pagamentos
    WHERE id = p_pagamento_id AND tenant_id = p_tenant_id;
  IF v_pag.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'pagamento_nao_encontrado');
  END IF;

  -- Idempotência: já liberado/autorizado → não reprocessa.
  IF v_pag.escrow_liberado OR v_pag.status IN ('autorizado','em_custodia','pago') THEN
    RETURN jsonb_build_object('ok', true, 'idempotente', true, 'status', v_pag.status);
  END IF;

  -- Lê o status de cada chave (com guard de tenant em cada SELECT).
  SELECT status INTO v_arq_st FROM public.hub_aprovacoes
    WHERE id = v_pag.aprovacao_arq_id AND tenant_id = p_tenant_id;
  SELECT status INTO v_hub_st FROM public.hub_aprovacoes
    WHERE id = v_pag.aprovacao_hub_id AND tenant_id = p_tenant_id;

  -- O escrow só libera com AS DUAS chaves aprovadas (fail-closed: NULL/ausente conta como não-aprovado).
  -- M3: aceita as duas grafias 'aprovado'/'aprovada' (derivarEstadoDupla normaliza ambas) — senão um
  -- produtor que grave a forma feminina travaria o escrow sem causa visível. Continua fail-closed.
  IF v_arq_st NOT IN ('aprovado','aprovada') OR v_arq_st IS NULL
     OR v_hub_st NOT IN ('aprovado','aprovada') OR v_hub_st IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false, 'erro', 'aprovacao_dupla_incompleta',
      'arq', COALESCE(v_arq_st, 'ausente'), 'hub', COALESCE(v_hub_st, 'ausente')
    );
  END IF;

  v_valor := COALESCE(v_pag.valor_liquido, v_pag.valor, 0);

  -- Garante a conta de escrow da obra (1 por obra).
  SELECT id INTO v_conta_id FROM public.hub_obra_escrow_contas
    WHERE obra_id = v_pag.obra_id AND tenant_id = p_tenant_id;
  IF v_conta_id IS NULL THEN
    INSERT INTO public.hub_obra_escrow_contas (obra_id, tenant_id, provedor)
      VALUES (v_pag.obra_id, p_tenant_id, 'interno')
      ON CONFLICT (obra_id) DO UPDATE SET atualizado_em = NOW()
      RETURNING id INTO v_conta_id;
  END IF;

  -- Pagamento → autorizado + escrow liberado.
  UPDATE public.hub_obra_pagamentos
    SET status = 'autorizado',
        escrow_liberado = true,
        escrow_liberado_em = NOW(),
        escrow_liberado_por = 'duplo'
    WHERE id = p_pagamento_id AND tenant_id = p_tenant_id;

  -- Movimento APPEND-ONLY de liberação (carrega as 2 chaves que autorizaram).
  INSERT INTO public.hub_obra_escrow_movimentos(
    conta_id, obra_id, tenant_id, tipo, valor, pagamento_id,
    aprovacao_arq_id, aprovacao_hub_id, origem, criado_por
  ) VALUES (
    v_conta_id, v_pag.obra_id, p_tenant_id, 'liberacao', v_valor, p_pagamento_id,
    v_pag.aprovacao_arq_id, v_pag.aprovacao_hub_id, 'rpc_liberar_escrow', 'duplo'
  );

  -- Atualiza o saldo agregado da conta (a verdade auditável segue no extrato).
  UPDATE public.hub_obra_escrow_contas
    SET saldo_liberado = saldo_liberado + v_valor,
        saldo_custodia = GREATEST(0, saldo_custodia - v_valor)
    WHERE id = v_conta_id;

  RETURN jsonb_build_object('ok', true, 'pagamento_id', p_pagamento_id, 'valor_liberado', v_valor);
END $$;
REVOKE ALL ON FUNCTION public.rpc_liberar_escrow(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_liberar_escrow(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_liberar_escrow(uuid, uuid) IS
  'E6 Gate 2 DUPLO: libera o escrow SÓ com arq E hub aprovados (fail-closed). Insere movimento liberacao '
  '(append-only) + marca pagamento autorizado. Guard tenant explícito. Idempotente. Por EVENTO, não trigger.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP FUNCTION IF EXISTS public.rpc_liberar_escrow(uuid, uuid);
--   DROP FUNCTION IF EXISTS public.rpc_aprovar_orcamento_frente(uuid, uuid, uuid);
--   DROP VIEW IF EXISTS public.vw_hub_obra_compatibilizacao;
--   DROP TABLE IF EXISTS public.hub_obra_escrow_movimentos;
--   DROP TABLE IF EXISTS public.hub_obra_escrow_contas;
--   DROP TABLE IF EXISTS public.hub_obra_pagamentos;        -- CASCADE remove dependências internas
--   DROP TABLE IF EXISTS public.hub_obra_orcamento_itens;
--   DROP TABLE IF EXISTS public.hub_obra_orcamentos;
--   -- hub_aprovacoes: reverter o CHECK ampliado (mantém dados; só remova se nenhum registro usa os tipos novos):
--   --   ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT IF EXISTS hub_aprovacoes_tipo_check;
--   --   ALTER TABLE public.hub_aprovacoes ADD CONSTRAINT hub_aprovacoes_tipo_check
--   --     CHECK (tipo IN ('proposta','pedido_material','pagamento','desconto','outro'));
--   --   ALTER TABLE public.hub_aprovacoes DROP COLUMN IF EXISTS obra_id;
--   -- hub_obras: remover o eixo (só se reverter o E6 inteiro):
--   --   ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_tipo_contrato_check;
--   --   ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS tipo_contrato;
--   (E0/E2/E3/E5 e hub_obras/hub_aprovacoes existentes permanecem INTACTOS — E6 nunca os destrói.)
-- ============================================================================
