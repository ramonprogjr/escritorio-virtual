-- ============================================================================
-- E2 — ITEM × SUBITEM (Situação automática × Andamento manual) por disciplina×andar
--      (BLOCO E2 do PLANO-BLOCOS-ARQ-ENG)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - RLS via current_user_tenant_id() (igual 20260705130000_e0 / 20260626 metering);
--       - trigger de timestamp reusa public.hub_atualizar_timestamp();
--       - ZERO DROP/ALTER em hub_obras_cronograma (o cockpit E1 LÊ dela — não tocar);
--       - frente_id nullable → E2 funciona mesmo sem E0 aplicado (degrada por disciplina_slug).
--     Até aplicar, a UI degrada graciosamente (a aba "Itens" mostra aviso honesto,
--     nunca quebra) e os endpoints respondem com migracao_pendente=true.
--
-- O QUE ENTREGA (o coração operacional da planilha do Consulado):
--   1. hub_obra_itens: item (parent_id NULL) + subitem (parent_id setado) na MESMA tabela
--      (auto-join). Espelha Gestão (item de contrato) × Detalhamento (subitem/EAP fina).
--   2. vw_hub_obra_itens_situacao: Situação = AUTOMÁTICA (derivada do prazo), NUNCA gravada.
--   3. update_cronograma_from_itens: bridge E2→E1 OPT-IN (RPC manual, SECURITY DEFINER),
--      NUNCA trigger — preserva o % manual do gestor no cronograma.
--
-- DECISÃO-CHAVE (fidelidade à planilha):
--   - "Situação" = a MÁQUINA calcula pelo prazo (a_iniciar/em_andamento/atrasado/concluido…).
--   - "Andamento" = o HUMANO declara (nao_iniciado/iniciado/paralisado/finalizado/cancelado).
--   - KPI "Finalizados" conta andamento='finalizado' — NUNCA a situação nem pct_avanco>=100.
--
-- ⚠️  ORDEM DE APPLY OBRIGATÓRIA: E0 (20260705130000) → A0 (20260705140000) → E2 (20260710120000).
--     E2 tem FK frente_id → hub_obra_frentes_eap, criada em E0. Aplicar E2 antes de E0 falha.
--     (frente_id é nullable, então em prod o degrade existe; mas num apply em ordem cronológica
--     do diretório de migrações a sequência acima já é respeitada pelos timestamps.)
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

-- ─── 1) hub_obra_itens (NOVA) — item (nível-0) + subitem (auto-join por parent_id) ──
CREATE TABLE IF NOT EXISTS public.hub_obra_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  frente_id       UUID REFERENCES public.hub_obra_frentes_eap(id) ON DELETE SET NULL, -- E0; nullable
  parent_id       UUID REFERENCES public.hub_obra_itens(id) ON DELETE CASCADE,        -- NULL=item, set=subitem
  -- Identificação (planilha: A=item de Gestão, B=subitem do Detalhamento "X.Y.N")
  codigo          TEXT NOT NULL,           -- "HAE8.01" | "2.1.3"
  nome            TEXT NOT NULL,           -- Atividade (col C)
  descricao       TEXT,                    -- col D
  disciplina_slug TEXT,                    -- desnorm. da frente (catálogo E0) — query sem JOIN
  area_codigo     TEXT,                    -- "ANDAR8" (hub_catalogo categoria=area_andar)
  area_label      TEXT,                    -- "Andar 8" (desnorm. p/ exibição)
  tipo            TEXT NOT NULL DEFAULT 'contrato'
                  CHECK (tipo IN ('contrato','aditivo','servico_extra')),
  -- Datas (fonte: Início/Término do Detalhamento)
  data_inicio     DATE,
  data_termino    DATE,
  -- Avanço (col O) — MANUAL (slider). Em itens com subitens vira derivado na leitura.
  pct_avanco      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_avanco BETWEEN 0 AND 100),
  -- SITUAÇÃO = AUTOMÁTICA → NÃO é coluna; derivada na VIEW. Só guarda override p/ aditivo de prazo:
  situacao_override TEXT
                  CHECK (situacao_override IN ('a_iniciar','em_andamento','atrasado','concluido','cancelado')),
  -- ANDAMENTO = MANUAL (col H da planilha; KPI "Finalizados" conta ISTO, não a situação)
  andamento       TEXT NOT NULL DEFAULT 'nao_iniciado'
                  CHECK (andamento IN ('nao_iniciado','iniciado','paralisado','finalizado','cancelado')),
  -- Bloqueios (planilha cols J–N = "Não/Falta")
  falta_pessoa      BOOLEAN NOT NULL DEFAULT false,
  falta_documento   BOOLEAN NOT NULL DEFAULT false,
  falta_material    BOOLEAN NOT NULL DEFAULT false,
  falta_ferramenta  BOOLEAN NOT NULL DEFAULT false,
  falta_equipamento BOOLEAN NOT NULL DEFAULT false,
  bloqueio_obs      TEXT,
  -- Medição / contrato / responsável / evidência
  quantidade      NUMERIC(10,3),
  unidade         TEXT,
  valor_contrato  NUMERIC(14,2),
  responsavel_id  UUID,
  responsavel_nome TEXT,
  tem_evidencia   BOOLEAN NOT NULL DEFAULT false,
  evidencia_url   TEXT,
  observacoes     TEXT,
  -- Controle
  peso            NUMERIC(5,2) NOT NULL DEFAULT 0,   -- só trava em E4 (medição)
  ordem           INTEGER NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,     -- toggle = oculta, NÃO deleta
  origem          TEXT NOT NULL DEFAULT 'manual'
                  CHECK (origem IN ('manual','ia','importacao','aditivo')),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_obra
  ON public.hub_obra_itens (obra_id, ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_tenant
  ON public.hub_obra_itens (tenant_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_frente
  ON public.hub_obra_itens (frente_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_parent
  ON public.hub_obra_itens (parent_id);
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_disciplina
  ON public.hub_obra_itens (obra_id, disciplina_slug);
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_area
  ON public.hub_obra_itens (obra_id, area_codigo);
-- Índice parcial dos "atrasáveis" (o que pode aparecer na fila do dia) — barato e seletivo.
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_atrasados
  ON public.hub_obra_itens (obra_id, data_termino)
  WHERE ativo = true AND pct_avanco < 100 AND andamento NOT IN ('finalizado','cancelado');

DROP TRIGGER IF EXISTS hub_obra_itens_ts ON public.hub_obra_itens;       -- reusa função existente
CREATE TRIGGER hub_obra_itens_ts BEFORE UPDATE ON public.hub_obra_itens
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

ALTER TABLE public.hub_obra_itens ENABLE ROW LEVEL SECURITY;             -- padrão das ~36 tabelas
DROP POLICY IF EXISTS hub_obra_itens_rls ON public.hub_obra_itens;
CREATE POLICY hub_obra_itens_rls ON public.hub_obra_itens FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_itens TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_itens IS
  'Itens de contrato (parent_id NULL) + subitens (parent_id setado) por disciplina×andar. Situação é AUTO (vw_hub_obra_itens_situacao); Andamento é MANUAL. KPI Finalizados = andamento=finalizado.';

-- ─── 2) vw_hub_obra_itens_situacao — Situação AUTOMÁTICA (derivada, NUNCA gravada) ──
-- security_invoker=true → a view respeita a RLS de QUEM consulta (não a do dono da view).
-- Mesmo assim os endpoints filtram tenant_id explicitamente (crmDb é service-role e bypassa RLS).
CREATE OR REPLACE VIEW public.vw_hub_obra_itens_situacao
  WITH (security_invoker = true) AS
SELECT i.*,
  CASE
    WHEN i.andamento = 'cancelado' THEN 'cancelado'
    WHEN i.andamento = 'finalizado' OR i.pct_avanco >= 100 THEN 'concluido'  -- andamento manda no fecho
    WHEN i.situacao_override IS NOT NULL THEN i.situacao_override            -- aditivo de prazo aprovado
    WHEN i.data_termino IS NULL OR i.data_inicio IS NULL THEN 'sem_data'     -- planilha tolera s/ data
    WHEN i.data_termino < CURRENT_DATE AND i.pct_avanco < 100 THEN 'atrasado'
    WHEN i.data_inicio > CURRENT_DATE THEN 'a_iniciar'
    WHEN i.data_termino BETWEEN CURRENT_DATE AND CURRENT_DATE + 3 AND i.pct_avanco < 70 THEN 'atencao'
    ELSE 'em_andamento'
  END AS situacao,
  CASE WHEN i.data_termino IS NOT NULL THEN (CURRENT_DATE - i.data_termino)::int END AS dias_atraso
FROM public.hub_obra_itens i
WHERE i.ativo = true;
GRANT SELECT ON public.vw_hub_obra_itens_situacao TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_itens_situacao IS
  'Situação derivada do prazo (cancelado/concluido/override/sem_data/atrasado/a_iniciar/atencao/em_andamento) + dias_atraso. Leitura para a cor da Situação. Nunca gravada.';

-- ─── 3) update_cronograma_from_itens — bridge E2→E1 OPT-IN (RPC manual, NUNCA trigger) ──
-- Liga frente.nome = cronograma.fase e atualiza percentual = AVG(pct_avanco) + concluida,
-- SÓ onde JÁ EXISTE linha de cronograma (preserva o % manual de fases que o gestor digitou).
-- Sem chamada, o E1 (cockpit "Hoje") segue intacto com os dados que já tem.
CREATE OR REPLACE FUNCTION public.update_cronograma_from_itens(
  p_obra_id uuid,
  p_frente_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tenant uuid;
  v_afetadas int := 0;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.hub_obras WHERE id = p_obra_id;
  IF v_tenant IS NULL THEN
    RETURN 0;  -- obra inexistente: nada a fazer (não vaza nada)
  END IF;

  WITH avanco_por_frente AS (
    SELECT
      f.id   AS frente_id,
      f.nome AS frente_nome,
      AVG(i.pct_avanco) FILTER (WHERE i.andamento <> 'cancelado') AS pct_medio,
      bool_and(i.pct_avanco >= 100 OR i.andamento = 'finalizado')
        FILTER (WHERE i.andamento <> 'cancelado')                AS tudo_concluido,
      COUNT(*) FILTER (WHERE i.andamento <> 'cancelado')          AS n_itens
    FROM public.hub_obra_frentes_eap f
    JOIN public.hub_obra_itens i
      ON i.frente_id = f.id AND i.ativo = true AND i.parent_id IS NULL
    WHERE f.obra_id = p_obra_id
      AND f.tenant_id = v_tenant
      AND (p_frente_id IS NULL OR f.id = p_frente_id)
    GROUP BY f.id, f.nome
  )
  UPDATE public.hub_obras_cronograma c
     SET percentual = ROUND(a.pct_medio)::numeric,
         concluida  = COALESCE(a.tudo_concluido, c.concluida)
    FROM avanco_por_frente a
   WHERE c.obra_id = p_obra_id
     AND c.tenant_id = v_tenant
     AND c.fase = a.frente_nome     -- ligação por nome (E2-v2 liga por UUID; aditivo futuro)
     AND a.n_itens > 0;

  GET DIAGNOSTICS v_afetadas = ROW_COUNT;
  RETURN v_afetadas;
END $$;
REVOKE ALL ON FUNCTION public.update_cronograma_from_itens(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.update_cronograma_from_itens(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_cronograma_from_itens(uuid, uuid) IS
  'Bridge OPT-IN E2→E1: sincroniza percentual/concluida do cronograma a partir da média de pct_avanco dos itens por frente. Só atualiza linhas de cronograma já existentes (preserva o % manual). Nunca cria fases. Disparada por botão, nunca por trigger.';

-- ============================================================================
-- ROLLBACK (se necessário):
--   DROP VIEW IF EXISTS public.vw_hub_obra_itens_situacao;
--   DROP FUNCTION IF EXISTS public.update_cronograma_from_itens(uuid, uuid);
--   DROP TABLE IF EXISTS public.hub_obra_itens;     -- CASCADE remove subitens (parent_id) automaticamente
--   (hub_obras_cronograma, hub_obras, hub_obra_frentes_eap permanecem INTACTOS — E2 nunca os altera.)
-- ============================================================================
