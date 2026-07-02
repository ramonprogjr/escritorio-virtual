-- ============================================================================
-- E7c — MEDIÇÃO HONESTA (append-only com evidência) — BLOCO E7c (Fase 3a)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - 1 tabela NOVA (hub_obra_medicoes). NENHUM DROP/ALTER em E0/E2/E0b/E5/E6/E7/E7b.
--       - "NADA SE PERDE": APPEND-ONLY — GRANT só SELECT, INSERT (SEM UPDATE/DELETE para
--         authenticated/service_role). Medição não se apaga nem se edita: corrige-se com uma NOVA
--         medição (a verdade é o histórico completo, como o extrato de escrow de E6 L12-13).
--       - RLS via current_user_tenant_id() (igual E0/E2/E3/E5/E6); timestamp NÃO precisa de trigger
--         de update (a linha nunca muda — só nasce). tenant_id NOT NULL (item novo nunca é global).
--     Até aplicar, o endpoint /api/crm/obras/[id]/medicoes degrada: grava SÓ o pct_avanco no item
--     (caminho E2, que sempre existe) + responde migracao_pendente=true. O avanço por item já funciona.
--
-- DECISÃO TRAVADA pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9 #4):
--   Avanço/medição = POR ITEM. O % de avanço é controlado por ITEM (peso + pct_avanco do item, E2).
--   A MEDIÇÃO é o registro FORMAL e auditável desse avanço, com evidência (foto) e quantidade
--   realizada — coexiste com o slider rápido do ObraItensSecao (slider = rápido; medição = formal).
--   Ambiente/disciplina = agregação; medição é por item. (design §3 fluxo medição→pagamento→escrow,
--   §4 verbo GERENCIAR: "a faixa-dinheiro vira 'medido R$X de R$Y' + botão 'Medir'".)
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): … E6(20260730120000) → E7(20260815120000) →
--     E7b(20260816120000) → E7c (ESTE, 20260817120000). E7c depende SÓ de E2 (hub_obra_itens) —
--     NÃO depende de E7/E7b (a coluna pct_avanco que ela atualiza é de E2). FK p/ hub_obra_itens (E2).
--
-- ROLLBACK no fim do arquivo (DROP TABLE — só ela, aditiva).
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

-- ─── 1) hub_obra_medicoes (NOVA) — registro APPEND-ONLY de medição com evidência ──
-- Cada linha é uma medição imutável: quem mediu, quanto, quando, com qual foto. O pct_avanco
-- "resultante" é o snapshot do avanço do item NO momento da medição (auditoria: o que valeu então).
-- A coluna viva (hub_obra_itens.pct_avanco) é atualizada PELO ENDPOINT (não por trigger) — padrão
-- do projeto (§3: snapshot no endpoint, nunca em trigger; triggers escondem magia).
CREATE TABLE IF NOT EXISTS public.hub_obra_medicoes (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id                UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  item_id                UUID NOT NULL REFERENCES public.hub_obra_itens(id) ON DELETE CASCADE, -- E2
  tenant_id              UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  -- Data da medição em campo (default hoje; pode ser retroativa). A medição é POR ITEM (decisão #4).
  data                   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Quantidade FÍSICA realizada nesta medição (ex.: 12 m² de piso). Opcional: medição pode ser só %.
  quantidade_realizada   NUMERIC(14,3),
  -- O pct de avanço do item DEPOIS desta medição (o que foi gravado no item-mãe). 0..100.
  pct_avanco_resultante  NUMERIC(5,2) CHECK (pct_avanco_resultante BETWEEN 0 AND 100),
  -- Evidência (a alma da "medição honesta"): foto rastreável + observação livre.
  foto_url               TEXT,
  observacao             TEXT,
  -- Quem mediu (responsável de campo). id opcional (pode ser operário sem login); nome sempre legível.
  responsavel_id         UUID,
  responsavel_nome       TEXT,
  -- Trilha de criação (quem registrou — humano/agente/sistema). NÃO há atualizado_* (append-only).
  criado_por             TEXT,
  criado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice de auditoria: histórico por obra/item em ordem de registro (o "nada se perde" navegável).
CREATE INDEX IF NOT EXISTS idx_hub_obra_medicoes_obra_item
  ON public.hub_obra_medicoes (obra_id, item_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_hub_obra_medicoes_tenant
  ON public.hub_obra_medicoes (tenant_id);

ALTER TABLE public.hub_obra_medicoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_medicoes_rls ON public.hub_obra_medicoes;
-- FIX 02/jul: dropar os nomes REAIS antes de criar (idempotente — a tabela já existe de sessão anterior).
DROP POLICY IF EXISTS hub_obra_medicoes_select ON public.hub_obra_medicoes;
DROP POLICY IF EXISTS hub_obra_medicoes_insert ON public.hub_obra_medicoes;
-- APPEND-ONLY na própria policy: FOR SELECT e FOR INSERT (sem UPDATE/DELETE). Mesmo um tenant
-- legítimo NÃO altera/apaga uma medição da sua obra — só insere outra. (espelha o extrato de escrow.)
CREATE POLICY hub_obra_medicoes_select ON public.hub_obra_medicoes FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
CREATE POLICY hub_obra_medicoes_insert ON public.hub_obra_medicoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());

-- GRANT append-only: SELECT + INSERT, NUNCA UPDATE/DELETE (nem p/ service_role — a verdade é o
-- histórico completo; corrigir = nova medição). É a trava física do "nada se perde".
GRANT SELECT, INSERT ON public.hub_obra_medicoes TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_medicoes IS
  'E7c (decisão #4): medição FORMAL e auditável por ITEM (append-only, com evidência foto). '
  'NADA SE PERDE: sem UPDATE/DELETE — corrige-se com nova medição. O pct_avanco vivo do item é '
  'atualizado pelo ENDPOINT (não trigger). Coexiste com o slider rápido (slider=rápido; medição=formal).';
COMMENT ON COLUMN public.hub_obra_medicoes.pct_avanco_resultante IS
  'Snapshot do pct_avanco do item APÓS esta medição (o que foi gravado no item-mãe). Auditoria: o que valeu.';
COMMENT ON COLUMN public.hub_obra_medicoes.quantidade_realizada IS
  'Quantidade física realizada NESTA medição (ex.: 12 m²). Opcional (medição pode ser só %).';

-- ============================================================================
-- ROLLBACK (reversível por completo — só remove a tabela NOVA que E7c adicionou):
--   DROP TABLE IF EXISTS public.hub_obra_medicoes;   -- CASCADE de FK não toca hub_obras/hub_obra_itens
--   (E0/E2/E0b/E5/E6/E7/E7b e TODAS as colunas/constraints existentes permanecem INTACTOS — E7c
--    nunca os altera nem destrói. current_user_tenant_id() é só um CREATE OR REPLACE idempotente.)
-- ============================================================================
