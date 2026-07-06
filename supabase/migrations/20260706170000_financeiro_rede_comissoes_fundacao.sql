-- ════════════════════════════════════════════════════════════════════════════
-- FINANCEIRO DE REDE (comissoes) — FUNDACAO (4 tabelas)
-- APLICADO em 06/jul via Supabase MCP (com o dono). Versiona o aplicado (idempotente).
-- Design: docs/DESIGN-FINANCEIRO-REDE-COMISSOES.md. Base do split = POTE
-- (hub_negocios.valor_fechado x percentual_comissao). Reusa hub_negocio_vinculos
-- (participantes) e hub_parceiros.comissao_pct (fallback 5%). Aditivo, fail-closed
-- (RLS on + REVOKE anon/authenticated = so service_role, o caminho da API), imutavel
-- onde e fato historico (snapshot de comissao + extrato).
--
-- Decisoes do dono TRAVADAS (06/jul): (1) comissao paga SO apos o cliente pagar
-- (cash-basis pro-rata, valor_exigivel); (2) a comissao do HUB nao se devolve — o Hub
-- audita, nao se responsabiliza por desavenca fornecedor<->cliente; (3) sem retencao no inicio.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.hub_append_only_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Registro append-only (%): corrigir = lancar estorno, nunca UPDATE/DELETE', TG_TABLE_NAME;
END $$;

-- 1) REGRA DE SPLIT — nasce no NEGOCIO ou no PARCEIRO
CREATE TABLE IF NOT EXISTS public.hub_split_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  escopo text NOT NULL CHECK (escopo IN ('parceiro','negocio')),
  parceiro_id uuid,
  negocio_id uuid,
  beneficiario_tipo text NOT NULL CHECK (beneficiario_tipo IN ('parceiro','pessoa','empresa','hub')),
  beneficiario_id uuid,
  papel_gatilho text NOT NULL CHECK (papel_gatilho IN ('indicou_cliente','indicou_comprador','indicou_vendedor','executor','captador')),
  pct numeric(6,3),
  valor_fixo numeric(14,2),
  mercado_sigla text,
  ativo boolean NOT NULL DEFAULT true,
  arquivado_em timestamptz,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_split_escopo_alvo CHECK (
    (escopo='parceiro' AND parceiro_id IS NOT NULL AND negocio_id IS NULL) OR
    (escopo='negocio'  AND negocio_id IS NOT NULL AND parceiro_id IS NULL)),
  CONSTRAINT hub_split_pct_xor_valor CHECK (
    (pct IS NOT NULL AND valor_fixo IS NULL) OR (pct IS NULL AND valor_fixo IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS hub_split_regras_uniq_ativa ON public.hub_split_regras
  (tenant_id, escopo, COALESCE(parceiro_id, negocio_id), beneficiario_tipo,
   COALESCE(beneficiario_id, '00000000-0000-0000-0000-000000000000'::uuid), papel_gatilho) WHERE ativo;
CREATE INDEX IF NOT EXISTS hub_split_regras_negocio_idx ON public.hub_split_regras (negocio_id) WHERE negocio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS hub_split_regras_parceiro_idx ON public.hub_split_regras (parceiro_id) WHERE parceiro_id IS NOT NULL;
ALTER TABLE public.hub_split_regras ENABLE ROW LEVEL SECURITY;

-- 2) SNAPSHOT imutavel da comissao (BRL = trava BACEN)
CREATE TABLE IF NOT EXISTS public.hub_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  negocio_id uuid NOT NULL,
  apuracao_seq integer NOT NULL DEFAULT 1,
  beneficiario_tipo text NOT NULL,
  beneficiario_id uuid,
  beneficiario_nome text,
  papel text,
  base_valor numeric(14,2) NOT NULL,
  pool_pct numeric(6,3),
  pct_aplicado numeric(6,3),
  valor numeric(14,2) NOT NULL,
  moeda text NOT NULL DEFAULT 'BRL' CHECK (moeda = 'BRL'),
  regra_id uuid,
  regra_origem text,
  estorna_comissao_id uuid,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_comissoes_uniq UNIQUE (negocio_id, apuracao_seq, beneficiario_tipo, beneficiario_id)
);
CREATE INDEX IF NOT EXISTS hub_comissoes_negocio_idx ON public.hub_comissoes (negocio_id, apuracao_seq);
CREATE INDEX IF NOT EXISTS hub_comissoes_benef_idx ON public.hub_comissoes (tenant_id, beneficiario_tipo, beneficiario_id);
ALTER TABLE public.hub_comissoes ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_hub_comissoes_imutavel ON public.hub_comissoes;
CREATE TRIGGER trg_hub_comissoes_imutavel BEFORE UPDATE OR DELETE ON public.hub_comissoes
  FOR EACH ROW EXECUTE FUNCTION public.hub_append_only_guard();

-- 3) FINANCEIRO POR NEGOCIO: a pagar/receber de cada um (cash-basis: valor_exigivel)
CREATE TABLE IF NOT EXISTS public.hub_negocio_titulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  negocio_id uuid NOT NULL,
  comissao_id uuid,
  direcao text NOT NULL CHECK (direcao IN ('receber','pagar')),
  natureza text NOT NULL CHECK (natureza IN ('recebivel_cliente','comissao_split','taxa_plataforma','honorario','retencao','ajuste')),
  contraparte_tipo text,
  contraparte_id uuid,
  contraparte_nome text,
  valor_total numeric(14,2) NOT NULL,
  valor_exigivel numeric(14,2) NOT NULL DEFAULT 0,
  valor_pago numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'previsto'
    CHECK (status IN ('previsto','apurado','exigivel','liberado','autorizado','pago','cancelado','retido')),
  aprovacao_benef_id uuid,
  aprovacao_hub_id uuid,
  pagamento_obra_id uuid,
  ref_escrow_mov_id uuid,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz
);
CREATE INDEX IF NOT EXISTS hub_negocio_titulos_negocio_idx ON public.hub_negocio_titulos (negocio_id);
CREATE INDEX IF NOT EXISTS hub_negocio_titulos_contraparte_idx ON public.hub_negocio_titulos (tenant_id, contraparte_tipo, contraparte_id);
ALTER TABLE public.hub_negocio_titulos ENABLE ROW LEVEL SECURITY;

-- 4) EXTRATO append-only do negocio
CREATE TABLE IF NOT EXISTS public.hub_negocio_fin_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  negocio_id uuid NOT NULL,
  titulo_id uuid,
  tipo text NOT NULL CHECK (tipo IN ('recebimento','liberacao','pagamento','estorno','retencao_liberada')),
  valor numeric(14,2) NOT NULL,
  descricao text,
  ref_id uuid,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_negocio_fin_mov_negocio_idx ON public.hub_negocio_fin_movimentos (negocio_id, criado_em DESC);
ALTER TABLE public.hub_negocio_fin_movimentos ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS trg_hub_negocio_fin_mov_imutavel ON public.hub_negocio_fin_movimentos;
CREATE TRIGGER trg_hub_negocio_fin_mov_imutavel BEFORE UPDATE OR DELETE ON public.hub_negocio_fin_movimentos
  FOR EACH ROW EXECUTE FUNCTION public.hub_append_only_guard();

-- Fail-closed limpo (RLS ja nega; sem grant tambem = so service_role)
REVOKE ALL ON public.hub_split_regras           FROM anon, authenticated;
REVOKE ALL ON public.hub_comissoes              FROM anon, authenticated;
REVOKE ALL ON public.hub_negocio_titulos        FROM anon, authenticated;
REVOKE ALL ON public.hub_negocio_fin_movimentos FROM anon, authenticated;
