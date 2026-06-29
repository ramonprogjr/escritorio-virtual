-- ============================================================================
-- E3 — RESTRIÇÕES / BLOQUEIOS de 1ª classe (BLOCO E3 do PLANO-BLOCOS-ARQ-ENG)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - RLS via current_user_tenant_id() (igual 20260705130000_e0 / 20260710120000_e2);
--       - trigger de timestamp reusa public.hub_atualizar_timestamp();
--       - VIEW security_invoker=true (igual vw_hub_obra_itens_situacao);
--       - RPC SECURITY DEFINER + REVOKE public/anon (igual gerar_codigo_obra / update_cronograma);
--       - ZERO DROP/ALTER em hub_obra_itens (E2) e hub_obras_ocorrencias/cronograma (E1).
--     Até aplicar, a UI degrada graciosamente (endpoints respondem migracao_pendente; o
--     cockpit E1 cai no proxy de ocorrências; a ficha do item mantém os toggles de E2).
--
-- DECISÃO-CHAVE (não-duplicação — 1 dado, 1 dono):
--   - Os 5 booleans `falta_*` de hub_obra_itens (E2) continuam a ÚNICA verdade de
--     "está bloqueado AGORA?". E3 NÃO tem seus próprios booleans.
--   - hub_obra_restricoes = o DOSSIÊ de resolução pendurado num bloqueio (quem/prazo/
--     impacto/histórico/ação/elo SC). E3 PROMOVE (cria o dossiê) e LIMPA (na resolução).
--   - Sincronização EXPLÍCITA no endpoint (PATCH liga → RPC promover; resolução → limpa
--     o boolean). NUNCA trigger bidirecional (laço/import batch/frágil — mesma razão de E2).
--
-- ⚠️  ORDEM DE APPLY: E0 (20260705130000) → A0 (20260705140000) → E2 (20260710120000) →
--     E3 (20260712120000). E3 referencia hub_obra_itens (E2) e hub_obra_frentes_eap (E0)
--     por FK nullable — em prod o degrade existe; em apply cronológico a ordem é respeitada.
--
-- ROLLBACK (resumo no fim do arquivo).
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; já existe em prod) ─────────────
-- AUDITORIA-FIX: alinhado à canônica (20260626130000_multitenant_foundation) — NÃO enfraquecer
-- current_user_tenant_id(). Definição IDÊNTICA à canônica (SECURITY DEFINER + search_path +
-- COALESCE com fallback ao tenant default). A canônica (20260626) roda ANTES num apply limpo;
-- este CREATE OR REPLACE só garante paridade sem rebaixar a função à versão fraca.
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

-- ─── 1) hub_obra_restricoes (NOVA) — o dossiê de resolução do bloqueio ─────────
CREATE TABLE IF NOT EXISTS public.hub_obra_restricoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  -- Origem flexível: item (E2) OU frente (E0) OU ambos NULL (bloqueio da obra inteira).
  item_id         UUID REFERENCES public.hub_obra_itens(id) ON DELETE CASCADE,        -- E2; nullable
  frente_id       UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE SET NULL, -- E0; nullable
  -- Tipo 1:1 com os 5 booleans de E2 (cols J–N da planilha) + escape 'outro'.
  tipo            TEXT NOT NULL
                  CHECK (tipo IN ('material','pessoa','documento','ferramenta','equipamento','outro')),
  -- Ciclo de vida. 'virou_pendencia' (§13/Emenda 1): reclassificada de falta→decisão.
  status          TEXT NOT NULL DEFAULT 'aberta'
                  CHECK (status IN ('aberta','em_resolucao','resolvida','reaberta','virou_pendencia')),
  titulo          TEXT,                    -- "falta cimento CP-II" (resumo curto)
  descricao       TEXT,
  -- Resolução (quem/prazo)
  responsavel_id  UUID,                    -- soft FK (sem hard FK, aditivo seguro)
  responsavel_nome TEXT,
  prazo_resolucao DATE,
  -- Impacto (Emenda 3): categórico (selo/cor/ordem) + estimativa numérica em dias.
  impacto         TEXT CHECK (impacto IN ('trava','atrasa','observa')),
  impacto_dias    INTEGER,
  impacto_frente_id UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE SET NULL, -- cross-frente
  -- Ação sugerida tipada (Click-and-Go).
  acao_sugerida   TEXT CHECK (acao_sugerida IN
                    ('gerar_pedido','atribuir_responsavel','solicitar_documento','providenciar','registrar')),
  -- Elos (E5 / Pendência futura) — soft FK, nullable.
  pedido_material_id UUID REFERENCES public.hub_pedidos_material(id) ON DELETE SET NULL,
  pendencia_id    UUID,                    -- módulo Pendência futuro (soft FK)
  -- SST (§19/Emenda 2): documento com poder de bloqueio = readonly-resolver.
  sst             BOOLEAN NOT NULL DEFAULT false,
  -- Procedência
  origem          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (origem IN ('manual','ia','e2_boolean','importacao','sst')),
  -- Fecho
  resolvido_em    TIMESTAMPTZ,
  resolvido_por   TEXT,
  resolucao_obs   TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hub_obra_restricoes_obra
  ON public.hub_obra_restricoes (obra_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_restricoes_tenant
  ON public.hub_obra_restricoes (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_restricoes_item
  ON public.hub_obra_restricoes (item_id);
-- Índice PARCIAL do caminho quente (cockpit só lê as NÃO resolvidas/sem pendência).
CREATE INDEX IF NOT EXISTS idx_hub_obra_restricoes_ativas
  ON public.hub_obra_restricoes (obra_id, impacto, impacto_dias)
  WHERE status IN ('aberta','em_resolucao','reaberta');
-- Idempotência da PROMOÇÃO: no máx. 1 restrição ATIVA por (item,tipo). Evita duplicar
-- ao re-ligar o mesmo boolean (parcial → permite histórico de resolvidas/pendências).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hub_obra_restricoes_item_tipo_ativa
  ON public.hub_obra_restricoes (item_id, tipo)
  WHERE status IN ('aberta','em_resolucao','reaberta') AND item_id IS NOT NULL;

DROP TRIGGER IF EXISTS hub_obra_restricoes_ts ON public.hub_obra_restricoes;
CREATE TRIGGER hub_obra_restricoes_ts BEFORE UPDATE ON public.hub_obra_restricoes
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_restricoes ENABLE ROW LEVEL SECURITY;   -- padrão das ~36 tabelas
DROP POLICY IF EXISTS hub_obra_restricoes_rls ON public.hub_obra_restricoes;
CREATE POLICY hub_obra_restricoes_rls ON public.hub_obra_restricoes FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_restricoes TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_restricoes IS
  'E3: dossiê de resolução do bloqueio (quem/prazo/impacto/histórico/ação/elo SC). tipo 1:1 com os booleans falta_* de E2 (que continuam a verdade do "bloqueado agora"). E3 promove e limpa; nunca duplica. SST (documento) = readonly-resolver.';

-- ─── 2) vw_hub_obra_bloqueios_hoje — UNIÃO sem duplicar (E3 abertas + booleans E2 órfãos) ──
-- security_invoker=true → respeita a RLS de QUEM consulta. Os endpoints ainda filtram
-- tenant_id explícito (crmDb é service-role e bypassa RLS).
--
-- (A) Restrições E3 ATIVAS (aberta/em_resolucao/reaberta) — o dado fino.
-- (B) Booleans falta_* de E2 SEM E3 ativo cobrindo (item,tipo) via NOT EXISTS — garante
--     que um falta_* legado (ligado antes de E3) nunca se perca. fonte='e2_boolean'.
-- NUNCA duplica: (B) só entra quando (A) não cobre aquele item+tipo.
CREATE OR REPLACE VIEW public.vw_hub_obra_bloqueios_hoje
  WITH (security_invoker = true) AS
-- (A) — dossiês E3 ativos
SELECT
  'e3'::text                       AS fonte,
  r.id                             AS restricao_id,
  r.obra_id,
  o.titulo                         AS obra_titulo,
  r.item_id,
  r.frente_id,
  r.tipo,
  r.status,
  COALESCE(r.titulo, i.nome)       AS titulo,
  r.responsavel_nome,
  r.prazo_resolucao,
  r.impacto,
  r.impacto_dias,
  r.acao_sugerida,
  r.origem,
  r.tenant_id
FROM public.hub_obra_restricoes r
JOIN public.hub_obras o ON o.id = r.obra_id
LEFT JOIN public.hub_obra_itens i ON i.id = r.item_id
WHERE r.status IN ('aberta','em_resolucao','reaberta')

UNION ALL

-- (B) — booleans falta_* de E2 SEM dossiê E3 ativo (boolean órfão / legado)
SELECT
  'e2_boolean'::text               AS fonte,
  NULL::uuid                       AS restricao_id,
  i.obra_id,
  o.titulo                         AS obra_titulo,
  i.id                             AS item_id,
  i.frente_id,
  b.tipo                           AS tipo,
  NULL::text                       AS status,
  i.nome                           AS titulo,
  i.responsavel_nome,
  NULL::date                       AS prazo_resolucao,
  NULL::text                       AS impacto,
  NULL::integer                    AS impacto_dias,
  NULL::text                       AS acao_sugerida,
  'e2_boolean'::text               AS origem,
  i.tenant_id
FROM public.hub_obra_itens i
JOIN public.hub_obras o ON o.id = i.obra_id
CROSS JOIN LATERAL (
  VALUES
    ('material',    i.falta_material),
    ('pessoa',      i.falta_pessoa),
    ('documento',   i.falta_documento),
    ('ferramenta',  i.falta_ferramenta),
    ('equipamento', i.falta_equipamento)
) AS b(tipo, ligado)
WHERE i.ativo = true
  AND b.ligado = true
  AND NOT EXISTS (
    SELECT 1 FROM public.hub_obra_restricoes r2
    WHERE r2.item_id = i.id
      AND r2.tipo = b.tipo
      AND r2.status IN ('aberta','em_resolucao','reaberta')
  );

GRANT SELECT ON public.vw_hub_obra_bloqueios_hoje TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_bloqueios_hoje IS
  'União sem duplicar: (A) restrições E3 ativas (dado fino) + (B) booleans falta_* de E2 sem E3 ativo (NOT EXISTS por item+tipo). fonte=e3|e2_boolean. Alimenta o cockpit E1 (§3 Bloqueios) trocando o proxy de ocorrências pelo dado fino, degradando para o proxy se a view não existir.';

-- ─── 3) hub_obra_restricao_promover — PROMOÇÃO idempotente (SELECT-first) ──────
-- Chamada pelo backend do PATCH de E2 quando um falta_X é ligado. Se já existe E3 ATIVO
-- para (item,tipo) → no-op (retorna o id existente). Seguro em double-submit/race
-- (o índice único parcial é a rede final). SECURITY DEFINER + REVOKE public/anon.
CREATE OR REPLACE FUNCTION public.hub_obra_restricao_promover(
  p_item_id uuid,
  p_tipo    text,
  p_origem  text DEFAULT 'e2_boolean'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra   uuid;
  v_tenant uuid;
  v_frente uuid;
  v_nome   text;
  v_id     uuid;
  v_impacto text;
BEGIN
  IF p_tipo NOT IN ('material','pessoa','documento','ferramenta','equipamento','outro') THEN
    RETURN NULL;
  END IF;

  -- Resolve obra/tenant/frente a partir do item (a verdade vem do item, não do caller).
  SELECT i.obra_id, i.tenant_id, i.frente_id, i.nome
    INTO v_obra, v_tenant, v_frente, v_nome
  FROM public.hub_obra_itens i
  WHERE i.id = p_item_id;
  IF v_obra IS NULL OR v_tenant IS NULL THEN
    RETURN NULL;  -- item inexistente: nada a promover (não vaza nada)
  END IF;

  -- Idempotente: já existe restrição ATIVA para (item,tipo)?
  SELECT r.id INTO v_id
  FROM public.hub_obra_restricoes r
  WHERE r.item_id = p_item_id
    AND r.tipo = p_tipo
    AND r.status IN ('aberta','em_resolucao','reaberta')
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;  -- no-op: o dossiê já existe
  END IF;

  -- Impacto default por tipo (documento trava; demais atrasam) — só selo, não reprograma nada.
  v_impacto := CASE WHEN p_tipo = 'documento' THEN 'trava' ELSE 'atrasa' END;

  INSERT INTO public.hub_obra_restricoes (
    obra_id, tenant_id, item_id, frente_id, tipo, status, titulo, impacto,
    acao_sugerida, origem
  )
  VALUES (
    v_obra, v_tenant, p_item_id, v_frente, p_tipo, 'aberta', v_nome, v_impacto,
    CASE p_tipo
      WHEN 'material'    THEN 'gerar_pedido'
      WHEN 'pessoa'      THEN 'atribuir_responsavel'
      WHEN 'documento'   THEN 'solicitar_documento'
      WHEN 'ferramenta'  THEN 'providenciar'
      WHEN 'equipamento' THEN 'providenciar'
      ELSE 'registrar'
    END,
    COALESCE(p_origem, 'e2_boolean')
  )
  ON CONFLICT (item_id, tipo) WHERE (status IN ('aberta','em_resolucao','reaberta') AND item_id IS NOT NULL)
    DO NOTHING
  RETURNING id INTO v_id;

  -- Se o ON CONFLICT pegou (corrida), recupera o id existente.
  IF v_id IS NULL THEN
    SELECT r.id INTO v_id
    FROM public.hub_obra_restricoes r
    WHERE r.item_id = p_item_id
      AND r.tipo = p_tipo
      AND r.status IN ('aberta','em_resolucao','reaberta')
    LIMIT 1;
  END IF;

  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.hub_obra_restricao_promover(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_obra_restricao_promover(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.hub_obra_restricao_promover(uuid, text, text) IS
  'PROMOÇÃO idempotente (SELECT-first + ON CONFLICT): cria o dossiê E3 para (item,tipo) quando um falta_* é ligado em E2. No-op se já existe restrição ativa. Resolve obra/tenant/frente do próprio item. Disparada pelo endpoint, nunca por trigger.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP VIEW IF EXISTS public.vw_hub_obra_bloqueios_hoje;
--   DROP FUNCTION IF EXISTS public.hub_obra_restricao_promover(uuid, text, text);
--   DROP TABLE IF EXISTS public.hub_obra_restricoes;
--   (hub_obra_itens (E2), hub_obras_ocorrencias/cronograma (E1), hub_obra_frentes_eap (E0)
--    e hub_pedidos_material permanecem INTACTOS — E3 nunca os altera.)
-- ============================================================================
