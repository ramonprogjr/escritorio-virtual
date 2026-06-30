-- ============================================================================
-- SEC-4 — RLS: NEGAR `anon` nas tabelas de COMPRAS/ESTOQUE do E5 (defesa em profundidade)
--
-- ⚠️  NÃO aplicar — janela do dono. ADITIVA, REVERSÍVEL, idempotente, fiel ao padrão do projeto.
--     Espelha o RLS já usado em E5 (tenant_id = current_user_tenant_id(), GRANT a
--     authenticated/service_role) e FECHA o role `anon` em 3 tabelas:
--       - hub_pedidos_material (cabeçalho da SC) — LEGADO: a migração 20260523120000 ligou RLS
--         e criou uma policy PERMISSIVA p/ anon (`*_anon` USING tenant_id IS NULL OR = default).
--         Em single-tenant é inócuo, mas é exatamente o ponto que SEC-4 fecha: anon NÃO deve
--         tocar a SC. Removemos a policy de anon e o GRANT a anon (authenticated/service_role
--         continuam via as policies/grants já existentes — esta migração NÃO os altera).
--       - hub_pedido_itens / hub_estoque_mov (NOVAS no E5 20260720120000) — JÁ não têm policy nem
--         GRANT p/ anon (anon já é negado por ausência). Aqui só TORNAMOS EXPLÍCITO (REVOKE
--         idempotente + DROP de qualquer policy anon que exista), para auditoria e para que o
--         estado fique declarado, não implícito.
--
-- POR QUE NÃO criar policy "deny" para anon: no Postgres/PostgREST, role SEM policy aplicável e
-- SEM GRANT já resulta em zero linhas + permissão negada. Adicionar uma policy `USING (false)`
-- para anon é redundante e arrisca conflitar com migrações futuras. O padrão correto (e usado em
-- E5) é simplesmente NÃO conceder a anon. Esta migração remove o resíduo legado que concedia.
--
-- ZERO impacto em authenticated/service_role: não dropamos as policies de tenant nem os grants
-- desses roles. ZERO DROP de tabela/coluna/dado. O service-role dos endpoints (crmDb) já filtra
-- tenant explícito no código — esta é a 2ª camada (a do banco) para o caso de um cliente anon.
--
-- ORDEM DE APPLY: depois de 20260523120000 (cria hub_pedidos_material + policy anon legada) e de
-- 20260720120000 (E5 — hub_pedido_itens / hub_estoque_mov). Idempotente: pode rodar mais de uma vez.
--
-- ROLLBACK no fim do arquivo.
-- ============================================================================

-- ─── 1) hub_pedidos_material (cabeçalho da SC) — remover acesso de `anon` ──────
-- A policy `hub_pedidos_material_anon` foi criada pela LOOP de 20260523120000 (RLS piloto).
-- Removê-la + revogar o GRANT a anon fecha o role anon nesta tabela. RLS continua LIGADA
-- (não a desabilitamos) e as policies de authenticated/service_role permanecem intactas.
DO $$
BEGIN
  IF to_regclass('public.hub_pedidos_material') IS NOT NULL THEN
    -- garante RLS ligada (idempotente — já estava ligada pelo legado)
    EXECUTE 'ALTER TABLE public.hub_pedidos_material ENABLE ROW LEVEL SECURITY';
    -- remove a policy permissiva de anon (nome criado pelo legado: <tabela>_anon)
    EXECUTE 'DROP POLICY IF EXISTS hub_pedidos_material_anon ON public.hub_pedidos_material';
    -- revoga qualquer privilégio direto concedido a anon (idempotente)
    EXECUTE 'REVOKE ALL ON public.hub_pedidos_material FROM anon';
  END IF;
END $$;

-- ─── 2) hub_pedido_itens (E5) — tornar EXPLÍCITA a negação de `anon` ───────────
-- A tabela nasceu (E5) com policy só p/ authenticated e GRANT só a authenticated/service_role.
-- anon já é negado por ausência; aqui apenas garantimos RLS + revogamos qualquer resíduo.
DO $$
BEGIN
  IF to_regclass('public.hub_pedido_itens') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hub_pedido_itens ENABLE ROW LEVEL SECURITY';
    -- se alguma migração/seed legado tiver criado uma policy anon, remove-a
    EXECUTE 'DROP POLICY IF EXISTS hub_pedido_itens_anon ON public.hub_pedido_itens';
    EXECUTE 'REVOKE ALL ON public.hub_pedido_itens FROM anon';
  END IF;
END $$;

-- ─── 3) hub_estoque_mov (E5, APPEND-ONLY) — tornar EXPLÍCITA a negação de `anon` ─
-- Mesma lógica: anon já é negado por ausência; declaramos o estado e revogamos resíduo.
-- NÃO tocamos nas policies de SELECT/INSERT de authenticated nem na imutabilidade (sem UPDATE/DELETE).
DO $$
BEGIN
  IF to_regclass('public.hub_estoque_mov') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.hub_estoque_mov ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS hub_estoque_mov_anon ON public.hub_estoque_mov';
    EXECUTE 'REVOKE ALL ON public.hub_estoque_mov FROM anon';
  END IF;
END $$;

-- ============================================================================
-- ROLLBACK (se necessário — recria o estado PERMISSIVO legado de anon SOMENTE em
-- hub_pedidos_material; hub_pedido_itens/hub_estoque_mov nunca tiveram anon, então não há o que
-- restaurar neles). Só execute se precisar reverter explicitamente esta migração:
--
--   -- restaura a policy anon legada da SC (igual à LOOP de 20260523120000):
--   ALTER TABLE public.hub_pedidos_material ENABLE ROW LEVEL SECURITY;
--   DROP POLICY IF EXISTS hub_pedidos_material_anon ON public.hub_pedidos_material;
--   CREATE POLICY hub_pedidos_material_anon ON public.hub_pedidos_material
--     FOR ALL TO anon
--     USING (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id())
--     WITH CHECK (tenant_id IS NULL OR tenant_id = public.default_obra10_tenant_id());
--   -- (o GRANT a anon NÃO é restaurado: a policy + o GRANT default do schema p/ anon definem o acesso.
--   --  Se o ambiente exigir, conceda explicitamente: GRANT SELECT, INSERT, UPDATE, DELETE ... TO anon;)
-- ============================================================================
