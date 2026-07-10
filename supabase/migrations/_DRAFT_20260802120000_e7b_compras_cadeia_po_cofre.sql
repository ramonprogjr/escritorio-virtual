-- ================================================================
-- e7b — RASCUNHO (NAO APLICADO) gerado no Fable + QA parcial (sintese final falhou no limite de sessao).
-- REVISAR com cabeca fresca antes de aplicar. Ver notas_de_decisao no task w1swavexw / journal wf_1c00c631-426.
-- Cofre de contas anti-golpe + cadeia + PO + guard. NAO rodar sem revisao humana.
-- ================================================================

-- ============================================================================
-- e7b — COMPRAS: CADEIA DE VALIDAÇÃO · ORDEM DE COMPRA · COFRE DE CONTAS · GUARD DA CASCATA
-- (parte 2/2 da FASE 2 da SPEC-COMPRAS-CORACAO — a e7a 20260801120000 é pré-requisito APLICADO)
--
-- ⚠️  RASCUNHO PARA REVISÃO DO DONO — NÃO APLICAR sem a janela. Aplicar INTEIRA numa única
--     transação (MCP apply_migration), mostrando SQL + resultado. Rollback POR BLOCO no rodapé.
--
-- PRÉ-REQUISITOS (verificados no repo em 09/jul):
--   • e7a (20260801120000): âncoras negocio/projeto/servico + obra_id nullable + chk_sc_contexto;
--     tipo_item/modelo_precificacao em hub_pedido_itens; pedido_id/ordem_compra_id/fornecedor_conta_id
--     em hub_obra_pagamentos; hub_alertas.tenant_id (o alerta anti-golpe deste arquivo usa).
--   • E5 (20260720120000) + fix 20260711120000: hub_pedido_itens, hub_estoque_mov(+entrega_uid),
--     vw_hub_inventario, gerar_codigo_sc, hub_sc_registrar_entrega (6 args) — o Bloco H REDEFINE esta função.
--   • hub_obra_codigo_contador (E0) — contador atômico reusado pelo gerar_codigo_oc.
--   • hub_eventos (keystone, append-only) — trilha imutável do cofre grava aqui.
--   • current_user_tenant_id() (canônica 20260626130000) — RLS das 4 tabelas novas.
--
-- TRAVAS DA CASA respeitadas: aditivo/reversível; idempotente (IF NOT EXISTS / DROP IF EXISTS /
-- CREATE OR REPLACE); NADA SE PERDE (append-only + soft-delete por status; DELETE bloqueado por
-- trigger); códigos de DOCUMENTO aparecem (SC-/OC-), pessoas pelo NOME; conta bancária NUNCA em
-- claro em log/evento/alerta (máscara obrigatória). Verificação embutida no fim (DO $$ ... RAISE):
-- inclui SMOKE TEST do cofre com rollback interno — exercita trigger + 3 RPCs sem deixar resíduo.
--
-- DESVIOS CONSCIENTES (para o revisor bater o olho — detalhados nos blocos):
--   (1) Bloco H: item não-estoque CONTINUA gravando linha no razão, com afeta_estoque=false, em vez
--       de pular o INSERT. Motivo: pular o INSERT destruiria a idempotência por entrega_uid (medição
--       parcial reenviada do canteiro dobraria a cobrança). O inventário filtra (não vira estoque —
--       intenção cumprida) e a aba Movimentação vira livro-razão universal da entrega.
--   (2) Bloco H: hub_estoque_mov.obra_id DROP NOT NULL — desde a e7a a SC pode ancorar em projeto/
--       serviço (obra NULL); sem isso, QUALQUER entrega dessas SCs estoura NOT NULL e a cascata cai.
--   (3) Cofre: UNIQUE parcial "1 conta ATIVA por fornecedor" — a segunda conta ativa é exatamente o
--       vetor do golpe do boleto trocado. Se o dono precisar de N contas ativas, dropar só o índice.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ STATUS — 'em_validacao' entra no ciclo da SC                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Ciclo passa a ser: rascunho → cotando → em_validacao → aprovado → entregue_parcial → entregue
--                    (cancelado a qualquer momento; rejeição na cadeia volta p/ cotando em NOVA rodada)
-- Adicionar valor a CHECK nunca invalida linha existente. DROP+ADD preserva o conjunto atual + o novo.
ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_status_check;
ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_status_check
  CHECK (status IN ('rascunho','cotando','em_validacao','aprovado','entregue_parcial','entregue','cancelado'));

-- Índice de fila (e7a) recriado INCLUINDO em_validacao — senão a fila de 1.200/semana do balcão
-- varre a tabela para o status mais consultado da FASE 3/4.
DROP INDEX IF EXISTS public.idx_hub_pedidos_fila;
CREATE INDEX IF NOT EXISTS idx_hub_pedidos_fila
  ON public.hub_pedidos_material (tenant_id, status, criado_em DESC, id)
  WHERE status IN ('rascunho','cotando','em_validacao','aprovado','entregue_parcial');


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ HELPER COMPARTILHADO — TRUNCATE bloqueado nas tabelas de auditoria        ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
CREATE OR REPLACE FUNCTION public.hub_compras_bloquear_truncate() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
BEGIN
  RAISE EXCEPTION '%: TRUNCATE proibido — tabela de auditoria de Compras (NADA SE PERDE)', TG_TABLE_NAME;
END $tg$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO B — CADEIA DE VALIDAÇÃO (hub_sc_politicas + hub_sc_validacoes)      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Regra da casa: a IA PREPARA (monta a cadeia pela política assinada), o HUMANO decide na tela.
-- 1.200/semana dissolve por regra assinada + lote + exceção — nunca afrouxando o gate.

-- ── B.1 hub_sc_politicas — regras ASSINADAS por faixa de valor ──────────────────────────────────
-- Config viva (edita/desativa), mas: só fica ATIVA se assinada; delegação sempre com prazo.
CREATE TABLE IF NOT EXISTS public.hub_sc_politicas (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE RESTRICT,
  nome                 text NOT NULL,
  valor_min            numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_min >= 0),
  valor_max            numeric(14,2),                    -- NULL = sem teto (faixa aberta p/ cima)
  etapas_json          jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{etapa,ordem,obrigatoria,capacidade_exigida}]
  teto_fornecedor_dia  numeric(14,2) CHECK (teto_fornecedor_dia IS NULL OR teto_fornecedor_dia >= 0),
  janela_movel_dias    integer CHECK (janela_movel_dias IS NULL OR janela_movel_dias > 0), -- anti-fatiamento
  exige_24h            boolean NOT NULL DEFAULT false,   -- espera mínima antes de aprovar (anti-impulso)
  amostra_pct          numeric(5,2) NOT NULL DEFAULT 0 CHECK (amostra_pct >= 0 AND amostra_pct <= 100),
  assinada_por         text,
  assinada_em          timestamptz,
  ativa                boolean NOT NULL DEFAULT false,
  kill_switch          boolean NOT NULL DEFAULT false,   -- true = suspende a regra → tudo volta ao gate manual
  delegado_para        text,
  delegacao_expira_em  timestamptz,
  criado_em            timestamptz NOT NULL DEFAULT now(),
  atualizado_em        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_politica_faixa     CHECK (valor_max IS NULL OR valor_max >= valor_min),
  CONSTRAINT chk_politica_etapas    CHECK (jsonb_typeof(etapas_json) = 'array'),
  CONSTRAINT chk_politica_assinada  CHECK ((NOT ativa) OR (assinada_por IS NOT NULL AND assinada_em IS NOT NULL)),
  CONSTRAINT chk_politica_delegacao CHECK ((delegado_para IS NULL) = (delegacao_expira_em IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_hub_sc_politicas_tenant
  ON public.hub_sc_politicas (tenant_id, ativa);

DROP TRIGGER IF EXISTS hub_sc_politicas_ts ON public.hub_sc_politicas;
CREATE TRIGGER hub_sc_politicas_ts BEFORE UPDATE ON public.hub_sc_politicas
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_trunc_hub_sc_politicas ON public.hub_sc_politicas;
CREATE TRIGGER trg_trunc_hub_sc_politicas BEFORE TRUNCATE ON public.hub_sc_politicas
  FOR EACH STATEMENT EXECUTE FUNCTION public.hub_compras_bloquear_truncate();

COMMENT ON TABLE public.hub_sc_politicas IS
  'e7b: regras ASSINADAS da cadeia de validação de SC, por faixa de valor. Só fica ativa se assinada '
  '(chk_politica_assinada). kill_switch=true suspende a regra (tudo volta ao gate manual). Delegação '
  'sempre temporária (chk_politica_delegacao). Desativar = ativa=false; DELETE não é concedido a '
  'authenticated (rastro se preserva). Score/teto/janela = SQL determinístico na FASE 3 (0 tokens).';

-- ── B.2 hub_sc_validacoes — a cadeia (append-only; decisão IMUTÁVEL; reabrir = nova rodada) ─────
CREATE TABLE IF NOT EXISTS public.hub_sc_validacoes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id           uuid NOT NULL REFERENCES public.hub_pedidos_material(id) ON DELETE RESTRICT,
  tenant_id           uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE RESTRICT,
  rodada              integer NOT NULL DEFAULT 1 CHECK (rodada >= 1),
  etapa               text NOT NULL CHECK (etapa IN ('resp_tecnico','engenharia','compras','diretor')),
  ordem               integer NOT NULL DEFAULT 0,
  obrigatoria         boolean NOT NULL DEFAULT true,
  capacidade_exigida  text,                     -- ex.: 'alcada_ate_5k' (checada pelo motor na FASE 3)
  status              text NOT NULL DEFAULT 'aguardando'
                        CHECK (status IN ('aguardando','ativa','validada','rejeitada','dispensada_por_regra')),
  decidido_por        text,                     -- pessoa pelo NOME (padrão aprovado_por da casa)
  decidido_em         timestamptz,
  motivo              text,
  regra_id            uuid REFERENCES public.hub_sc_politicas(id) ON DELETE SET NULL,
  prazo_em            timestamptz,              -- SLA da etapa (alerta/escala na FASE 3)
  criado_em           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_hub_sc_validacoes_etapa UNIQUE (pedido_id, etapa, rodada)
);

CREATE INDEX IF NOT EXISTS idx_hub_sc_validacoes_fila
  ON public.hub_sc_validacoes (tenant_id, status)
  WHERE status IN ('aguardando','ativa');
CREATE INDEX IF NOT EXISTS idx_hub_sc_validacoes_pedido
  ON public.hub_sc_validacoes (pedido_id, rodada, ordem);

-- Nascimento: etapa NUNCA nasce decidida (validada/rejeitada só por UPDATE auditado pelo guard).
-- Dispensa por regra PODE nascer dispensada (a política monta a cadeia já dispensando) — exige regra_id.
CREATE OR REPLACE FUNCTION public.hub_sc_validacoes_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
BEGIN
  IF NEW.status IS NULL THEN NEW.status := 'aguardando'; END IF;
  IF NEW.status IN ('validada','rejeitada') THEN
    RAISE EXCEPTION 'hub_sc_validacoes: etapa não nasce decidida — decisão é UPDATE (aguardando/ativa → validada/rejeitada)';
  END IF;
  IF NEW.status = 'dispensada_por_regra' THEN
    IF NEW.regra_id IS NULL THEN
      RAISE EXCEPTION 'hub_sc_validacoes: dispensa exige regra_id (a regra assinada que dispensou)';
    END IF;
    NEW.decidido_por := COALESCE(NULLIF(btrim(NEW.decidido_por), ''), 'sistema');
    NEW.decidido_em  := COALESCE(NEW.decidido_em, now());
  ELSE
    IF (NEW.decidido_por IS NOT NULL) OR (NEW.decidido_em IS NOT NULL) THEN
      RAISE EXCEPTION 'hub_sc_validacoes: campos de decisão só entram com a decisão';
    END IF;
  END IF;
  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_sc_validacoes_stamp ON public.hub_sc_validacoes;
CREATE TRIGGER trg_hub_sc_validacoes_stamp BEFORE INSERT ON public.hub_sc_validacoes
  FOR EACH ROW EXECUTE FUNCTION public.hub_sc_validacoes_stamp();

-- Guard (padrão 20260710120000, vale até p/ service_role — crmDb bypassa RLS, não bypassa trigger):
--   • identidade/estrutura da etapa: imutável;
--   • máquina de estados: aguardando→{ativa,dispensada_por_regra}; ativa→{validada,rejeitada,dispensada_por_regra};
--   • decisão tomada = linha CONGELADA (reabrir = INSERT de nova rodada);
--   • SoD inviolável: a mesma pessoa não VALIDA duas etapas da mesma rodada;
--   • DELETE proibido (append-only).
CREATE OR REPLACE FUNCTION public.hub_sc_validacoes_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
DECLARE
  v_decidida boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hub_sc_validacoes: DELETE proibido (append-only) — rejeitar/dispensar; reabrir = nova rodada';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.pedido_id IS DISTINCT FROM OLD.pedido_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.rodada IS DISTINCT FROM OLD.rodada
     OR NEW.etapa IS DISTINCT FROM OLD.etapa
     OR NEW.ordem IS DISTINCT FROM OLD.ordem
     OR NEW.obrigatoria IS DISTINCT FROM OLD.obrigatoria
     OR NEW.capacidade_exigida IS DISTINCT FROM OLD.capacidade_exigida
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'hub_sc_validacoes: identidade/estrutura da etapa é imutável';
  END IF;

  v_decidida := OLD.status IN ('validada','rejeitada','dispensada_por_regra');
  IF v_decidida THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.decidido_por IS DISTINCT FROM OLD.decidido_por
       OR NEW.decidido_em IS DISTINCT FROM OLD.decidido_em
       OR NEW.motivo IS DISTINCT FROM OLD.motivo
       OR NEW.regra_id IS DISTINCT FROM OLD.regra_id
       OR NEW.prazo_em IS DISTINCT FROM OLD.prazo_em THEN
      RAISE EXCEPTION 'hub_sc_validacoes: decisão é imutável — reabrir = nova rodada (INSERT)';
    END IF;
    RETURN NEW;  -- no-op idempotente permitido
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ( ((OLD.status = 'aguardando') AND (NEW.status IN ('ativa','dispensada_por_regra')))
          OR ((OLD.status = 'ativa')      AND (NEW.status IN ('validada','rejeitada','dispensada_por_regra'))) ) THEN
      RAISE EXCEPTION 'hub_sc_validacoes: transição % → % proibida', OLD.status, NEW.status;
    END IF;

    IF NEW.status IN ('validada','rejeitada','dispensada_por_regra') THEN
      IF NEW.status = 'dispensada_por_regra' THEN
        IF NEW.regra_id IS NULL THEN
          RAISE EXCEPTION 'hub_sc_validacoes: dispensa exige regra_id';
        END IF;
        NEW.decidido_por := COALESCE(NULLIF(btrim(NEW.decidido_por), ''), 'sistema');
      ELSE
        IF (NEW.decidido_por IS NULL) OR (btrim(NEW.decidido_por) = '') THEN
          RAISE EXCEPTION 'hub_sc_validacoes: decisão exige decidido_por';
        END IF;
      END IF;
      NEW.decidido_em := COALESCE(NEW.decidido_em, now());

      -- SoD (spec §4, inviolável): mesma pessoa não valida 2 etapas da mesma rodada.
      IF (NEW.status = 'validada') AND EXISTS (
           SELECT 1 FROM public.hub_sc_validacoes v
           WHERE v.pedido_id = NEW.pedido_id AND v.rodada = NEW.rodada AND v.id <> NEW.id
             AND v.status = 'validada'
             AND lower(btrim(v.decidido_por)) = lower(btrim(NEW.decidido_por)) ) THEN
        RAISE EXCEPTION 'hub_sc_validacoes: SoD — % já validou outra etapa desta rodada', NEW.decidido_por;
      END IF;
    END IF;
  ELSE
    -- sem mudança de status: só prazo_em pode mudar (repactuação de SLA); decisão não se antecipa
    IF NEW.decidido_por IS DISTINCT FROM OLD.decidido_por
       OR NEW.decidido_em IS DISTINCT FROM OLD.decidido_em
       OR NEW.motivo IS DISTINCT FROM OLD.motivo
       OR NEW.regra_id IS DISTINCT FROM OLD.regra_id THEN
      RAISE EXCEPTION 'hub_sc_validacoes: campos de decisão só mudam junto com a decisão';
    END IF;
  END IF;

  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_sc_validacoes_guard ON public.hub_sc_validacoes;
CREATE TRIGGER trg_hub_sc_validacoes_guard BEFORE UPDATE OR DELETE ON public.hub_sc_validacoes
  FOR EACH ROW EXECUTE FUNCTION public.hub_sc_validacoes_guard();

DROP TRIGGER IF EXISTS trg_trunc_hub_sc_validacoes ON public.hub_sc_validacoes;
CREATE TRIGGER trg_trunc_hub_sc_validacoes BEFORE TRUNCATE ON public.hub_sc_validacoes
  FOR EACH STATEMENT EXECUTE FUNCTION public.hub_compras_bloquear_truncate();

COMMENT ON TABLE public.hub_sc_validacoes IS
  'e7b: cadeia de validação da SC (resp_tecnico→engenharia→compras→diretor), append-only. Decisão é '
  'IMUTÁVEL (guard); reabrir = nova rodada (INSERT). SoD no banco: mesma pessoa não valida 2 etapas da '
  'rodada. dispensada_por_regra sempre aponta a regra assinada (regra_id). FK RESTRICT: com decisão '
  'registrada, o pedido não pode ser apagado fisicamente (delete = arquivar, regra eterna do Hub).';

-- ── B.3 RLS + grants ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hub_sc_politicas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_sc_politicas_rls ON public.hub_sc_politicas;
CREATE POLICY hub_sc_politicas_rls ON public.hub_sc_politicas FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
REVOKE ALL ON public.hub_sc_politicas FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.hub_sc_politicas TO authenticated;          -- sem DELETE: desativar, nunca apagar
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_sc_politicas TO service_role;

ALTER TABLE public.hub_sc_validacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_sc_validacoes_sel ON public.hub_sc_validacoes;
CREATE POLICY hub_sc_validacoes_sel ON public.hub_sc_validacoes FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_sc_validacoes_ins ON public.hub_sc_validacoes;
CREATE POLICY hub_sc_validacoes_ins ON public.hub_sc_validacoes FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_sc_validacoes_upd ON public.hub_sc_validacoes;
CREATE POLICY hub_sc_validacoes_upd ON public.hub_sc_validacoes FOR UPDATE TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
REVOKE ALL ON public.hub_sc_validacoes FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.hub_sc_validacoes TO authenticated;          -- sem DELETE (o guard bloqueia até service_role)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_sc_validacoes TO service_role;   -- DELETE concedido mas o TRIGGER nega


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO C — ORDEM DE COMPRA (hub_ordens_compra + gerar_codigo_oc)           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── C.1 gerar_codigo_oc(tenant) — clone de gerar_codigo_sc com tipo='oc' ('OC-2026-0001') ───────
CREATE OR REPLACE FUNCTION public.gerar_codigo_oc(p_tenant uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ano    int := extract(year from now())::int;
  v_seq    int;
  v_tenant uuid := coalesce(p_tenant, '00000000-0000-4000-8000-000000000001'::uuid);
BEGIN
  -- mesma fonte atômica de E0/E5 (hub_obra_codigo_contador), tipo='oc'
  INSERT INTO public.hub_obra_codigo_contador AS c (tenant_id, tipo, ano, ultimo)
    VALUES (v_tenant, 'oc', v_ano, 1)
    ON CONFLICT (tenant_id, tipo, ano) DO UPDATE SET ultimo = c.ultimo + 1
    RETURNING c.ultimo INTO v_seq;
  RETURN 'OC-' || v_ano::text || '-' || lpad(v_seq::text, 4, '0');
END $fn$;
REVOKE ALL ON FUNCTION public.gerar_codigo_oc(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_codigo_oc(uuid) TO authenticated, service_role;

-- ── C.2 hub_ordens_compra — o documento que o FORNECEDOR aceita ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_ordens_compra (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                    text NOT NULL,                       -- 'OC-2026-0001' (documento: APARECE)
  pedido_id                 uuid NOT NULL REFERENCES public.hub_pedidos_material(id) ON DELETE RESTRICT,
  obra_id                   uuid,                                -- espelho do contexto da SC (soft-FK, pode ser NULL)
  tenant_id                 uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE RESTRICT,
  fornecedor_id             uuid NOT NULL REFERENCES public.hub_fornecedores(id) ON DELETE RESTRICT,
  fornecedor_nome_snapshot  text NOT NULL,                       -- congela o nome no documento
  valor_total               numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  condicao_tipo             text NOT NULL DEFAULT 'a_vista'
                              CHECK (condicao_tipo IN ('a_vista','prazo_dias','na_entrega','na_medicao','por_diaria','adiantamento_parcial')),
  condicao_parcelas_json    jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(condicao_parcelas_json) = 'array'),
  status                    text NOT NULL DEFAULT 'emitida'
                              CHECK (status IN ('emitida','aceita','em_entrega','concluida','cancelada')),
  aceite_em                 timestamptz,
  aceite_por                text,                                -- quem aceitou PELO fornecedor (nome)
  aceite_canal              text,                                -- whatsapp | email | telefone | presencial | ...
  aceite_evidencia          text,                                -- URL/print/hash do aceite
  emitida_por               text,
  emitida_em                timestamptz NOT NULL DEFAULT now(),
  criado_em                 timestamptz NOT NULL DEFAULT now(),
  atualizado_em             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_hub_ordens_compra_codigo UNIQUE (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_hub_ordens_compra_fila
  ON public.hub_ordens_compra (tenant_id, status, emitida_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_ordens_compra_pedido
  ON public.hub_ordens_compra (pedido_id);
CREATE INDEX IF NOT EXISTS idx_hub_ordens_compra_fornecedor
  ON public.hub_ordens_compra (fornecedor_id, status);

DROP TRIGGER IF EXISTS hub_ordens_compra_ts ON public.hub_ordens_compra;
CREATE TRIGGER hub_ordens_compra_ts BEFORE UPDATE ON public.hub_ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

-- Guard: OC não se apaga (cancelar = status); identidade imutável; máquina de estados;
-- OC ACEITA é contrato (termos congelados); aceite registrado não se reescreve.
CREATE OR REPLACE FUNCTION public.hub_ordens_compra_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hub_ordens_compra: DELETE proibido — cancelar = status ''cancelada'' (NADA SE PERDE)';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.codigo IS DISTINCT FROM OLD.codigo
     OR NEW.pedido_id IS DISTINCT FROM OLD.pedido_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.fornecedor_id IS DISTINCT FROM OLD.fornecedor_id
     OR NEW.emitida_por IS DISTINCT FROM OLD.emitida_por
     OR NEW.emitida_em IS DISTINCT FROM OLD.emitida_em
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em THEN
    RAISE EXCEPTION 'hub_ordens_compra: identidade da OC é imutável (código/pedido/fornecedor/emissão)';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT ( ((OLD.status = 'emitida')    AND (NEW.status IN ('aceita','cancelada')))
          OR ((OLD.status = 'aceita')     AND (NEW.status IN ('em_entrega','concluida','cancelada')))
          OR ((OLD.status = 'em_entrega') AND (NEW.status IN ('concluida','cancelada'))) ) THEN
      RAISE EXCEPTION 'hub_ordens_compra: transição % → % proibida', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'aceita' THEN
      IF (NEW.aceite_por IS NULL) OR (btrim(NEW.aceite_por) = '') THEN
        RAISE EXCEPTION 'hub_ordens_compra: aceite exige aceite_por (quem aceitou pelo fornecedor)';
      END IF;
      IF (NEW.aceite_canal IS NULL) OR (btrim(NEW.aceite_canal) = '') THEN
        RAISE EXCEPTION 'hub_ordens_compra: aceite exige aceite_canal (whatsapp/email/telefone/presencial)';
      END IF;
      NEW.aceite_em := COALESCE(NEW.aceite_em, now());
    END IF;
  END IF;

  -- aceite registrado é imutável (o "de acordo" do fornecedor não se reescreve)
  IF (OLD.aceite_em IS NOT NULL) AND (
       NEW.aceite_em IS DISTINCT FROM OLD.aceite_em
       OR NEW.aceite_por IS DISTINCT FROM OLD.aceite_por
       OR NEW.aceite_canal IS DISTINCT FROM OLD.aceite_canal
       OR NEW.aceite_evidencia IS DISTINCT FROM OLD.aceite_evidencia ) THEN
    RAISE EXCEPTION 'hub_ordens_compra: aceite é imutável';
  END IF;

  -- OC aceita é CONTRATO: termos congelados; mudou o combinado = cancelar e emitir outra OC
  IF (OLD.status IN ('aceita','em_entrega','concluida')) AND (
       NEW.valor_total IS DISTINCT FROM OLD.valor_total
       OR NEW.condicao_tipo IS DISTINCT FROM OLD.condicao_tipo
       OR NEW.condicao_parcelas_json IS DISTINCT FROM OLD.condicao_parcelas_json
       OR NEW.fornecedor_nome_snapshot IS DISTINCT FROM OLD.fornecedor_nome_snapshot ) THEN
    RAISE EXCEPTION 'hub_ordens_compra: OC aceita é contrato — termos imutáveis (cancele e emita outra)';
  END IF;

  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_ordens_compra_guard ON public.hub_ordens_compra;
CREATE TRIGGER trg_hub_ordens_compra_guard BEFORE UPDATE OR DELETE ON public.hub_ordens_compra
  FOR EACH ROW EXECUTE FUNCTION public.hub_ordens_compra_guard();

DROP TRIGGER IF EXISTS trg_trunc_hub_ordens_compra ON public.hub_ordens_compra;
CREATE TRIGGER trg_trunc_hub_ordens_compra BEFORE TRUNCATE ON public.hub_ordens_compra
  FOR EACH STATEMENT EXECUTE FUNCTION public.hub_compras_bloquear_truncate();

COMMENT ON TABLE public.hub_ordens_compra IS
  'e7b: Ordem de Compra (documento que o fornecedor aceita). Código OC- atômico por tenant '
  '(gerar_codigo_oc). Soft-delete por status=cancelada (DELETE bloqueado por trigger). OC aceita = '
  'contrato: valor/condições/snapshot congelados. Elo com pagamento: hub_obra_pagamentos.ordem_compra_id (e7a).';

-- ── C.3 RLS + grants ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.hub_ordens_compra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_ordens_compra_sel ON public.hub_ordens_compra;
CREATE POLICY hub_ordens_compra_sel ON public.hub_ordens_compra FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_ordens_compra_ins ON public.hub_ordens_compra;
CREATE POLICY hub_ordens_compra_ins ON public.hub_ordens_compra FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_ordens_compra_upd ON public.hub_ordens_compra;
CREATE POLICY hub_ordens_compra_upd ON public.hub_ordens_compra FOR UPDATE TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
REVOKE ALL ON public.hub_ordens_compra FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.hub_ordens_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_ordens_compra TO service_role;   -- DELETE negado pelo trigger


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO D — COFRE DE CONTAS DO FORNECEDOR (anti-golpe, a peça mais crítica) ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- O golpe real que este bloco mata: trocar a conta do fornecedor na véspera do pagamento.
-- Desenho: APPEND-ONLY absoluto — os DADOS da conta nunca sofrem UPDATE; "trocar" = INSERT de conta
-- nova (carência 72h zerada de novo) + antiga vira 'substituida'. Status só muda pelas RPCs oficiais
-- (flag transacional 'app.cofre_via_rpc' checada no trigger — vale até para service_role).
-- Quatro-olhos: quem VERIFICA/ativa nunca é quem CRIOU. NUNCA conta em claro em log/evento/alerta.

-- ── D.0 máscara obrigatória (única forma aceitável de citar uma conta fora do cofre) ────────────
CREATE OR REPLACE FUNCTION public.hub_mascarar_chave(p_valor text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT CASE
    WHEN p_valor IS NULL OR length(p_valor) = 0 THEN NULL
    WHEN length(p_valor) <= 4 THEN '••••'
    ELSE '••••' || right(p_valor, 4)
  END
$fn$;
COMMENT ON FUNCTION public.hub_mascarar_chave(text) IS
  'e7b: máscara de chave PIX/conta (mantém só os 4 últimos). ÚNICA forma permitida de citar uma conta '
  'em evento/alerta/log/UI de lista. NUNCA logar conta em claro.';

-- ── D.1 a tabela-cofre ──────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_fornecedor_contas (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id       uuid NOT NULL REFERENCES public.hub_fornecedores(id) ON DELETE RESTRICT,
  tenant_id           uuid NOT NULL REFERENCES public.hub_tenants(id) ON DELETE RESTRICT,
  tipo                text NOT NULL CHECK (tipo IN ('pix','conta_bancaria')),
  pix_tipo            text CHECK (pix_tipo IS NULL OR pix_tipo IN ('cpf','cnpj','email','telefone','aleatoria')),
  pix_chave           text,        -- NUNCA em log/evento/alerta em claro — só via hub_mascarar_chave
  banco               text,
  agencia             text,
  conta               text,        -- NUNCA em log/evento/alerta em claro — só via hub_mascarar_chave
  titular_nome        text NOT NULL,
  titular_doc         text,        -- CPF/CNPJ do titular (compara com o doc do fornecedor → titular_diverge)
  status              text NOT NULL DEFAULT 'pendente_verificacao'
                        CHECK (status IN ('pendente_verificacao','ativa','substituida','revogada')),
  criada_por          text NOT NULL,
  criada_em           timestamptz NOT NULL DEFAULT now(),     -- carimbada pelo banco (stamp), caller não escolhe
  verificada_por      text,
  verificada_em       timestamptz,
  carencia_ate        timestamptz NOT NULL DEFAULT (now() + interval '72 hours'), -- recarimbada no stamp
  substitui_conta_id  uuid REFERENCES public.hub_fornecedor_contas(id),
  titular_diverge     boolean NOT NULL DEFAULT false,         -- computado pelo banco (stamp), fail-closed
  CONSTRAINT chk_cofre_pix   CHECK ( (tipo <> 'pix') OR ((pix_chave IS NOT NULL) AND (pix_tipo IS NOT NULL)) ),
  CONSTRAINT chk_cofre_banco CHECK ( (tipo <> 'conta_bancaria') OR ((banco IS NOT NULL) AND (agencia IS NOT NULL) AND (conta IS NOT NULL)) )
);

CREATE INDEX IF NOT EXISTS idx_hub_fornecedor_contas_status
  ON public.hub_fornecedor_contas (fornecedor_id, status);
CREATE INDEX IF NOT EXISTS idx_hub_fornecedor_contas_hist
  ON public.hub_fornecedor_contas (fornecedor_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS idx_hub_fornecedor_contas_tenant
  ON public.hub_fornecedor_contas (tenant_id);
-- Anti-golpe: no máximo UMA conta ATIVA por fornecedor (a 2ª conta ativa é o vetor do golpe do
-- boleto/PIX trocado). Ativar outra exige revogar/substituir a atual. Se o negócio exigir N ativas,
-- dropar SÓ este índice (decisão do dono).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_fornecedor_contas_ativa
  ON public.hub_fornecedor_contas (fornecedor_id)
  WHERE status = 'ativa';

COMMENT ON TABLE public.hub_fornecedor_contas IS
  'e7b: COFRE de contas de pagamento do fornecedor. APPEND-ONLY absoluto: dados da conta jamais sofrem '
  'UPDATE (trocar = hub_fornecedor_conta_substituir → conta nova + carência 72h nova); DELETE proibido '
  '(revogar). Status só muda pelas RPCs oficiais (flag transacional checada no trigger — vale até para '
  'service_role). Quatro-olhos na ativação. carencia_ate/criada_em/titular_diverge carimbados pelo banco. '
  'FASE 3: rpc_liberar_pagamento só paga conta ATIVA e fora da carência. NUNCA logar conta em claro.';
COMMENT ON COLUMN public.hub_fornecedor_contas.carencia_ate IS
  'criada_em + 72h, carimbado pelo stamp (nem o caller escolhe). Pagamento antes disso = bloqueado na FASE 3.';

-- ── D.2 stamp do INSERT — o banco carimba o que ninguém pode escolher ──────────────────────────
CREATE OR REPLACE FUNCTION public.hub_fornecedor_contas_stamp() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
DECLARE
  v_forn_cpf  text;
  v_forn_cnpj text;
  v_forn_ten  uuid;
  v_doc       text;
BEGIN
  -- nascimento SEMPRE pendente_verificacao (ninguém nasce 'ativa' — nem via service_role)
  IF NEW.status IS DISTINCT FROM 'pendente_verificacao' THEN
    RAISE EXCEPTION 'cofre: conta nasce pendente_verificacao (recebido: %)', NEW.status;
  END IF;
  IF (NEW.verificada_por IS NOT NULL) OR (NEW.verificada_em IS NOT NULL) THEN
    RAISE EXCEPTION 'cofre: verificação não entra no INSERT — quatro-olhos via hub_fornecedor_conta_ativar';
  END IF;

  -- criada_em/carencia_ate: o BANCO carimba (caller que mandar criada_em no passado não encurta a carência)
  NEW.criada_em    := now();
  NEW.carencia_ate := NEW.criada_em + interval '72 hours';
  IF (NEW.criada_por IS NULL) OR (btrim(NEW.criada_por) = '') THEN
    RAISE EXCEPTION 'cofre: criada_por é obrigatório (autoria é parte do anti-golpe)';
  END IF;

  -- posse: fornecedor existe E é do MESMO tenant (crmDb bypassa RLS; o trigger não deixa vazar)
  SELECT f.cpf, f.cnpj, f.tenant_id INTO v_forn_cpf, v_forn_cnpj, v_forn_ten
    FROM public.hub_fornecedores f WHERE f.id = NEW.fornecedor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'cofre: fornecedor não encontrado';
  END IF;
  IF v_forn_ten IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'cofre: fornecedor pertence a outro tenant';
  END IF;

  -- titularidade computada pelo banco, FAIL-CLOSED: sem doc comparável ⇒ diverge=true (atenção humana)
  v_doc := regexp_replace(COALESCE(NEW.titular_doc, ''), '\D', '', 'g');
  NEW.titular_diverge := NOT (
    (v_doc <> '') AND (
      (v_doc = regexp_replace(COALESCE(v_forn_cpf,  ''), '\D', '', 'g') AND COALESCE(v_forn_cpf,  '') <> '')
      OR
      (v_doc = regexp_replace(COALESCE(v_forn_cnpj, ''), '\D', '', 'g') AND COALESCE(v_forn_cnpj, '') <> '')
    )
  );

  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_stamp ON public.hub_fornecedor_contas;
CREATE TRIGGER trg_hub_fornecedor_contas_stamp BEFORE INSERT ON public.hub_fornecedor_contas
  FOR EACH ROW EXECUTE FUNCTION public.hub_fornecedor_contas_stamp();

-- trilha de criação (fail-closed: sem trilha, não há conta) — payload SEMPRE mascarado
CREATE OR REPLACE FUNCTION public.hub_fornecedor_contas_audit_ins() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
BEGIN
  INSERT INTO public.hub_eventos (event_type, entity_type, entity_id, ator, payload, tenant_id)
  VALUES ('fornecedor_conta_criada', 'fornecedor_conta', NEW.id, NEW.criada_por,
          jsonb_build_object(
            'fornecedor_id',    NEW.fornecedor_id,
            'tipo',             NEW.tipo,
            'chave_mascarada',  public.hub_mascarar_chave(COALESCE(NEW.pix_chave, NEW.conta)),
            'titular_nome',     NEW.titular_nome,
            'titular_diverge',  NEW.titular_diverge,
            'substitui_conta_id', NEW.substitui_conta_id,
            'carencia_ate',     NEW.carencia_ate),
          NEW.tenant_id);
  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_audit_ins ON public.hub_fornecedor_contas;
CREATE TRIGGER trg_hub_fornecedor_contas_audit_ins AFTER INSERT ON public.hub_fornecedor_contas
  FOR EACH ROW EXECUTE FUNCTION public.hub_fornecedor_contas_audit_ins();

-- ── D.3 guard de UPDATE/DELETE — imutabilidade absoluta + status só via RPC ─────────────────────
CREATE OR REPLACE FUNCTION public.hub_fornecedor_contas_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $tg$
DECLARE
  v_via_rpc boolean := (COALESCE(current_setting('app.cofre_via_rpc', true), '') = '1');
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'cofre: DELETE proibido — conta não some, é revogada/substituída (RPCs hub_fornecedor_conta_*)';
  END IF;

  -- payload da conta é IMUTÁVEL, sempre — trocar dados = hub_fornecedor_conta_substituir (conta NOVA)
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.fornecedor_id IS DISTINCT FROM OLD.fornecedor_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.pix_tipo IS DISTINCT FROM OLD.pix_tipo
     OR NEW.pix_chave IS DISTINCT FROM OLD.pix_chave
     OR NEW.banco IS DISTINCT FROM OLD.banco
     OR NEW.agencia IS DISTINCT FROM OLD.agencia
     OR NEW.conta IS DISTINCT FROM OLD.conta
     OR NEW.titular_nome IS DISTINCT FROM OLD.titular_nome
     OR NEW.titular_doc IS DISTINCT FROM OLD.titular_doc
     OR NEW.criada_por IS DISTINCT FROM OLD.criada_por
     OR NEW.criada_em IS DISTINCT FROM OLD.criada_em
     OR NEW.carencia_ate IS DISTINCT FROM OLD.carencia_ate
     OR NEW.substitui_conta_id IS DISTINCT FROM OLD.substitui_conta_id
     OR NEW.titular_diverge IS DISTINCT FROM OLD.titular_diverge THEN
    RAISE EXCEPTION 'cofre: dados da conta são IMUTÁVEIS — trocar = hub_fornecedor_conta_substituir (nova conta + carência nova)';
  END IF;

  -- daqui pra baixo só status / verificada_* podem ter mudado
  IF (NEW.status IS DISTINCT FROM OLD.status)
     OR (NEW.verificada_por IS DISTINCT FROM OLD.verificada_por)
     OR (NEW.verificada_em IS DISTINCT FROM OLD.verificada_em) THEN

    IF NOT v_via_rpc THEN
      RAISE EXCEPTION 'cofre: status só muda pelas RPCs oficiais (ativar/revogar/substituir) — UPDATE direto negado';
    END IF;

    IF NOT ( ((OLD.status = 'pendente_verificacao') AND (NEW.status IN ('ativa','revogada','substituida')))
          OR ((OLD.status = 'ativa')                AND (NEW.status IN ('revogada','substituida'))) ) THEN
      RAISE EXCEPTION 'cofre: transição % → % proibida (substituida/revogada são terminais)', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'ativa' THEN
      -- QUATRO-OLHOS: quem verifica nunca é quem criou (comparação case-insensitive)
      IF (NEW.verificada_por IS NULL) OR (btrim(NEW.verificada_por) = '') THEN
        RAISE EXCEPTION 'cofre: ativação exige verificada_por';
      END IF;
      IF lower(btrim(NEW.verificada_por)) = lower(btrim(OLD.criada_por)) THEN
        RAISE EXCEPTION 'cofre: quatro-olhos — quem verifica não pode ser quem cadastrou a conta';
      END IF;
      NEW.verificada_em := COALESCE(NEW.verificada_em, now());
    ELSE
      IF (NEW.verificada_por IS DISTINCT FROM OLD.verificada_por)
         OR (NEW.verificada_em IS DISTINCT FROM OLD.verificada_em) THEN
        RAISE EXCEPTION 'cofre: verificada_* só são gravados na ativação';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_guard ON public.hub_fornecedor_contas;
CREATE TRIGGER trg_hub_fornecedor_contas_guard BEFORE UPDATE OR DELETE ON public.hub_fornecedor_contas
  FOR EACH ROW EXECUTE FUNCTION public.hub_fornecedor_contas_guard();

DROP TRIGGER IF EXISTS trg_trunc_hub_fornecedor_contas ON public.hub_fornecedor_contas;
CREATE TRIGGER trg_trunc_hub_fornecedor_contas BEFORE TRUNCATE ON public.hub_fornecedor_contas
  FOR EACH STATEMENT EXECUTE FUNCTION public.hub_compras_bloquear_truncate();

-- ── D.4 RPCs oficiais — a ÚNICA via de mudança de status ───────────────────────────────────────
-- SECURITY DEFINER + guard de tenant explícito + trilha em hub_eventos FAIL-CLOSED (sem trilha, sem
-- mudança) + máscara SEMPRE. EXECUTE só para service_role: DINHEIRO E CONTA NUNCA POR VOZ nem por
-- chamada direta do browser — o caminho é a API autenticada (crmDb), que valida sessão e papel antes.

-- (a) ATIVAR — verificação humana (quatro-olhos)
CREATE OR REPLACE FUNCTION public.hub_fornecedor_conta_ativar(
  p_conta_id       uuid,
  p_tenant_id      uuid,
  p_verificado_por text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $rpc$
DECLARE
  v_conta public.hub_fornecedor_contas%ROWTYPE;
BEGIN
  IF (p_verificado_por IS NULL) OR (btrim(p_verificado_por) = '') THEN
    RAISE EXCEPTION 'verificador_obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_conta FROM public.hub_fornecedor_contas
    WHERE id = p_conta_id AND tenant_id = p_tenant_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conta_nao_encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_conta.status <> 'pendente_verificacao' THEN
    RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = 'P0001',
      DETAIL = format('status atual: %s (só pendente_verificacao ativa)', v_conta.status);
  END IF;
  IF lower(btrim(p_verificado_por)) = lower(btrim(v_conta.criada_por)) THEN
    RAISE EXCEPTION 'quatro_olhos' USING ERRCODE = 'P0001',
      DETAIL = 'quem verifica não pode ser quem cadastrou a conta';
  END IF;

  BEGIN
    PERFORM set_config('app.cofre_via_rpc', '1', true);
    UPDATE public.hub_fornecedor_contas
      SET status = 'ativa', verificada_por = p_verificado_por, verificada_em = now()
      WHERE id = p_conta_id;
    PERFORM set_config('app.cofre_via_rpc', '0', true);
  EXCEPTION WHEN unique_violation THEN
    -- uq_hub_fornecedor_contas_ativa: já existe conta ATIVA deste fornecedor
    RAISE EXCEPTION 'ja_existe_conta_ativa' USING ERRCODE = 'P0001',
      DETAIL = 'revogue ou substitua a conta ativa antes de ativar outra';
  END;

  -- trilha imutável (fail-closed: se não auditar, a transação toda volta)
  INSERT INTO public.hub_eventos (event_type, entity_type, entity_id, ator, payload, tenant_id)
  VALUES ('fornecedor_conta_ativada', 'fornecedor_conta', p_conta_id, p_verificado_por,
          jsonb_build_object(
            'fornecedor_id',   v_conta.fornecedor_id,
            'tipo',            v_conta.tipo,
            'chave_mascarada', public.hub_mascarar_chave(COALESCE(v_conta.pix_chave, v_conta.conta)),
            'titular_diverge', v_conta.titular_diverge,
            'carencia_ate',    v_conta.carencia_ate),
          p_tenant_id);

  RETURN jsonb_build_object(
    'ok', true, 'status', 'ativa',
    'carencia_ate', v_conta.carencia_ate,          -- pagar antes disso continua BLOQUEADO (FASE 3)
    'titular_diverge', v_conta.titular_diverge);
END $rpc$;
REVOKE ALL ON FUNCTION public.hub_fornecedor_conta_ativar(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_fornecedor_conta_ativar(uuid, uuid, text) TO service_role;

-- (b) REVOGAR — mata a conta (terminal); motivo vai para a trilha
CREATE OR REPLACE FUNCTION public.hub_fornecedor_conta_revogar(
  p_conta_id  uuid,
  p_tenant_id uuid,
  p_ator      text,
  p_motivo    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $rpc$
DECLARE
  v_conta public.hub_fornecedor_contas%ROWTYPE;
BEGIN
  IF (p_ator IS NULL) OR (btrim(p_ator) = '') THEN
    RAISE EXCEPTION 'ator_obrigatorio' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_conta FROM public.hub_fornecedor_contas
    WHERE id = p_conta_id AND tenant_id = p_tenant_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conta_nao_encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_conta.status NOT IN ('pendente_verificacao', 'ativa') THEN
    RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = 'P0001',
      DETAIL = format('status atual: %s (substituida/revogada são terminais)', v_conta.status);
  END IF;

  PERFORM set_config('app.cofre_via_rpc', '1', true);
  UPDATE public.hub_fornecedor_contas SET status = 'revogada' WHERE id = p_conta_id;
  PERFORM set_config('app.cofre_via_rpc', '0', true);

  INSERT INTO public.hub_eventos (event_type, entity_type, entity_id, ator, payload, tenant_id)
  VALUES ('fornecedor_conta_revogada', 'fornecedor_conta', p_conta_id, p_ator,
          jsonb_build_object(
            'fornecedor_id',   v_conta.fornecedor_id,
            'status_anterior', v_conta.status,
            'chave_mascarada', public.hub_mascarar_chave(COALESCE(v_conta.pix_chave, v_conta.conta)),
            'motivo',          p_motivo),
          p_tenant_id);

  RETURN jsonb_build_object('ok', true, 'status', 'revogada');
END $rpc$;
REVOKE ALL ON FUNCTION public.hub_fornecedor_conta_revogar(uuid, uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_fornecedor_conta_revogar(uuid, uuid, text, text) TO service_role;

-- (c) SUBSTITUIR — a ÚNICA forma de "trocar a conta": INSERT da nova (pendente, carência 72h NOVA,
--     herda o fornecedor da antiga — não dá para desviar no meio) + antiga vira 'substituida', atômico.
--     Troca <7 dias e/ou titular divergente ⇒ ALERTA de segurança (determinístico, 0 tokens).
CREATE OR REPLACE FUNCTION public.hub_fornecedor_conta_substituir(
  p_conta_antiga uuid,
  p_tenant_id    uuid,
  p_nova         jsonb,   -- {tipo, pix_tipo?, pix_chave?, banco?, agencia?, conta?, titular_nome, titular_doc?}
  p_criada_por   text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $rpc$
DECLARE
  v_antiga       public.hub_fornecedor_contas%ROWTYPE;
  v_nova_id      uuid;
  v_carencia     timestamptz;
  v_diverge      boolean;
  v_troca_rapida boolean;
  v_forn_nome    text;
BEGIN
  IF (p_criada_por IS NULL) OR (btrim(p_criada_por) = '') THEN
    RAISE EXCEPTION 'ator_obrigatorio' USING ERRCODE = '22023';
  END IF;
  IF (p_nova IS NULL) OR (jsonb_typeof(p_nova) <> 'object') THEN
    RAISE EXCEPTION 'conta_nova_invalida' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(btrim(p_nova->>'tipo'), '') IS NULL OR NULLIF(btrim(p_nova->>'titular_nome'), '') IS NULL THEN
    RAISE EXCEPTION 'conta_nova_incompleta' USING ERRCODE = '22023',
      DETAIL = 'tipo e titular_nome são obrigatórios';
  END IF;

  SELECT * INTO v_antiga FROM public.hub_fornecedor_contas
    WHERE id = p_conta_antiga AND tenant_id = p_tenant_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'conta_nao_encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF v_antiga.status NOT IN ('pendente_verificacao', 'ativa') THEN
    RAISE EXCEPTION 'transicao_invalida' USING ERRCODE = 'P0001',
      DETAIL = format('status atual: %s (substituida/revogada são terminais)', v_antiga.status);
  END IF;

  -- nova conta: NASCE pendente + carência 72h nova (stamp carimba); FORNECEDOR HERDADO da antiga
  INSERT INTO public.hub_fornecedor_contas
    (fornecedor_id, tenant_id, tipo, pix_tipo, pix_chave, banco, agencia, conta,
     titular_nome, titular_doc, criada_por, substitui_conta_id)
  VALUES
    (v_antiga.fornecedor_id, p_tenant_id,
     NULLIF(btrim(p_nova->>'tipo'), ''),
     NULLIF(btrim(p_nova->>'pix_tipo'), ''),
     NULLIF(btrim(p_nova->>'pix_chave'), ''),
     NULLIF(btrim(p_nova->>'banco'), ''),
     NULLIF(btrim(p_nova->>'agencia'), ''),
     NULLIF(btrim(p_nova->>'conta'), ''),
     NULLIF(btrim(p_nova->>'titular_nome'), ''),
     NULLIF(btrim(p_nova->>'titular_doc'), ''),
     p_criada_por, v_antiga.id)
  RETURNING id, carencia_ate, titular_diverge INTO v_nova_id, v_carencia, v_diverge;

  PERFORM set_config('app.cofre_via_rpc', '1', true);
  UPDATE public.hub_fornecedor_contas SET status = 'substituida' WHERE id = v_antiga.id;
  PERFORM set_config('app.cofre_via_rpc', '0', true);

  -- red flags determinísticos → alerta de segurança (tela mais nobre) — SEMPRE mascarado
  v_troca_rapida := (v_antiga.criada_em > (now() - interval '7 days'));
  IF v_troca_rapida OR v_diverge THEN
    SELECT nome INTO v_forn_nome FROM public.hub_fornecedores WHERE id = v_antiga.fornecedor_id;
    INSERT INTO public.hub_alertas (tenant_id, tipo, titulo, descricao)
    VALUES (p_tenant_id, 'seguranca',
      CASE WHEN v_troca_rapida THEN 'Conta de fornecedor trocada em menos de 7 dias'
           ELSE 'Conta nova com titular divergente do fornecedor' END,
      format('Fornecedor %s: conta %s substituída por %s (%s). Confirme por um canal JÁ CONHECIDO (telefone salvo no cadastro, nunca o do pedido de troca) antes de qualquer pagamento. Carência até %s.',
        COALESCE(v_forn_nome, 'sem nome'),
        COALESCE(public.hub_mascarar_chave(COALESCE(v_antiga.pix_chave, v_antiga.conta)), '—'),
        COALESCE(public.hub_mascarar_chave(COALESCE(NULLIF(btrim(p_nova->>'pix_chave'), ''), NULLIF(btrim(p_nova->>'conta'), ''))), '—'),
        CASE WHEN v_troca_rapida AND v_diverge THEN 'troca rápida + titular diverge'
             WHEN v_troca_rapida THEN 'troca em menos de 7 dias'
             ELSE 'titular diverge' END,
        to_char(v_carencia, 'DD/MM HH24:MI')));
  END IF;

  INSERT INTO public.hub_eventos (event_type, entity_type, entity_id, ator, payload, tenant_id)
  VALUES ('fornecedor_conta_substituida', 'fornecedor_conta', v_nova_id, p_criada_por,
          jsonb_build_object(
            'fornecedor_id',            v_antiga.fornecedor_id,
            'conta_anterior_id',        v_antiga.id,
            'chave_anterior_mascarada', public.hub_mascarar_chave(COALESCE(v_antiga.pix_chave, v_antiga.conta)),
            'chave_nova_mascarada',     public.hub_mascarar_chave(COALESCE(NULLIF(btrim(p_nova->>'pix_chave'), ''), NULLIF(btrim(p_nova->>'conta'), ''))),
            'troca_rapida_7d',          v_troca_rapida,
            'titular_diverge',          v_diverge,
            'carencia_ate',             v_carencia),
          p_tenant_id);

  RETURN jsonb_build_object(
    'ok', true,
    'nova_conta_id', v_nova_id,
    'status', 'pendente_verificacao',
    'carencia_ate', v_carencia,
    'titular_diverge', v_diverge,
    'alerta_troca_rapida', v_troca_rapida);
END $rpc$;
REVOKE ALL ON FUNCTION public.hub_fornecedor_conta_substituir(uuid, uuid, jsonb, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_fornecedor_conta_substituir(uuid, uuid, jsonb, text) TO service_role;

-- ── D.5 RLS + grants (cofre: authenticated só VÊ e CRIA; mudar status = RPC; UPDATE/DELETE negados) ─
ALTER TABLE public.hub_fornecedor_contas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_fornecedor_contas_sel ON public.hub_fornecedor_contas;
CREATE POLICY hub_fornecedor_contas_sel ON public.hub_fornecedor_contas FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_fornecedor_contas_ins ON public.hub_fornecedor_contas;
CREATE POLICY hub_fornecedor_contas_ins ON public.hub_fornecedor_contas FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
REVOKE ALL ON public.hub_fornecedor_contas FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.hub_fornecedor_contas FROM authenticated;
GRANT SELECT, INSERT ON public.hub_fornecedor_contas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_fornecedor_contas TO service_role;  -- triggers seguram


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO H — GUARD DA CASCATA (hub_sc_registrar_entrega v3)                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Problema: serviço/mão de obra/diária/medição/empreitada/verba têm QUANTIDADE DE COBRANÇA — isso
-- NÃO é estoque (3 diárias de pedreiro não são 3 itens na prateleira).
-- Desenho (desvio consciente nº 1 do cabeçalho): a entrega SEMPRE grava a linha no razão (mantém a
-- idempotência por entrega_uid — pular o INSERT faria a medição parcial reenviada DOBRAR a cobrança),
-- mas a linha nasce com afeta_estoque=false e o INVENTÁRIO a ignora. "Não vira estoque" cumprido,
-- livro-razão universal preservado (aba Movimentação mostra a entrega de tudo — nada se perde).

-- H.1 razão: flag de estoque + obra opcional (SC ancorada em projeto/serviço entrega sem obra — e7a)
ALTER TABLE public.hub_estoque_mov
  ADD COLUMN IF NOT EXISTS afeta_estoque boolean NOT NULL DEFAULT true;
ALTER TABLE public.hub_estoque_mov
  ALTER COLUMN obra_id DROP NOT NULL;

COMMENT ON COLUMN public.hub_estoque_mov.afeta_estoque IS
  'e7b: false = quantidade de COBRANÇA (serviço/mão de obra/diária/medição/empreitada/verba) — linha '
  'fica no livro-razão (auditoria + idempotência por entrega_uid) mas NÃO soma no inventário.';

-- H.2 inventário só enxerga o que é estoque físico (mesmas colunas; comportamento idêntico p/ legado)
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
        WHEN 'ajuste'    THEN m.quantidade
        ELSE 0 END)                                                            AS em_estoque,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'entrada')                          AS total_entrada,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'saida')                            AS total_saida,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'devolucao')                        AS total_devolucao,
  SUM(m.quantidade) FILTER (WHERE m.tipo = 'ajuste')                           AS total_ajuste,
  COUNT(*)                                                                      AS num_movimentos,
  MAX(m.criado_em)                                                             AS ultima_mov_em
FROM public.hub_estoque_mov m
WHERE m.afeta_estoque
GROUP BY m.obra_id, m.tenant_id, m.catalogo_id;

GRANT SELECT ON public.vw_hub_inventario TO authenticated, service_role;
COMMENT ON VIEW public.vw_hub_inventario IS
  'E5/e7b: Inventário derivado (Entrada − Saída + Devolução + Ajuste) por (obra, item), SÓ de linhas '
  'afeta_estoque=true (cobrança de serviço/diária/medição não é estoque). Estoque negativo é permitido '
  '(alerta na UI, nunca esconde).';

-- H.3 a função v3 — MESMA assinatura de 6 args, MESMO gate de status, MESMA idempotência.
--     Única mudança: v_afeta_estoque com PARÊNTESES EXPLÍCITOS decide se a linha soma no inventário.
CREATE OR REPLACE FUNCTION public.hub_sc_registrar_entrega(
  p_pedido_id      uuid,
  p_tenant_id      uuid,
  p_itens          jsonb,            -- [{ item_id, qtd }]
  p_registrado_por text DEFAULT NULL,
  p_obs            text DEFAULT NULL,
  p_entrega_uid    uuid DEFAULT NULL -- idempotência: mesma entrega reenviada não duplica
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_item           jsonb;
  v_it             public.hub_pedido_itens%ROWTYPE;
  v_obra           uuid;
  v_status         text;
  v_qtd            numeric;
  v_aplicado       numeric;
  v_all            boolean;
  v_registradas    int := 0;
  v_ignoradas      int := 0;   -- reenvio idempotente (nada a fazer)
  v_codigo         text;
  v_mov_id         uuid;
  v_afeta_estoque  boolean;
BEGIN
  -- 0) GUARD tenant explícito (SECURITY DEFINER bypassa RLS — a posse é checada aqui).
  --    Nota e7b: obra_id pode ser NULL (SC ancorada em projeto/serviço) — por isso o guard é por
  --    EXISTÊNCIA da linha, não por v_obra.
  SELECT obra_id, status INTO v_obra, v_status
    FROM public.hub_pedidos_material
    WHERE id = p_pedido_id AND tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pedido_nao_encontrado' USING ERRCODE = 'P0002';
  END IF;

  -- 0.1) GATE HUMANO (fix 20260711120000): só compra APROVADA recebe. Preservado na íntegra.
  IF v_status NOT IN ('aprovado', 'entregue_parcial') THEN
    RAISE EXCEPTION 'sc_nao_aprovada' USING ERRCODE = 'P0001',
      DETAIL = format('status atual: %s', v_status);
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'itens_invalidos' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_qtd := COALESCE((v_item->>'qtd')::numeric, 0);
    IF v_qtd <= 0 THEN CONTINUE; END IF;

    -- Trava a linha do item: dois recebimentos simultâneos não leem o mesmo qtd_entregue.
    SELECT * INTO v_it FROM public.hub_pedido_itens
      WHERE id = (v_item->>'item_id')::uuid
        AND tenant_id = p_tenant_id
        AND pedido_id = p_pedido_id
      FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    -- grava só o DELTA que ainda cabe no pedido — o razão nunca ultrapassa o pedido.
    v_aplicado := LEAST(v_qtd, v_it.qtd_pedida - v_it.qtd_entregue);
    IF v_aplicado <= 0 THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    -- ★ e7b (Bloco H) — GUARD DA CASCATA, com PARÊNTESES EXPLÍCITOS:
    --   quantidade de COBRANÇA (modelo não-unitário OU item de serviço/mão de obra) NÃO é estoque.
    --   A linha ainda entra no razão (idempotência + auditoria), mas com afeta_estoque=false —
    --   o inventário (vw_hub_inventario) a ignora.
    v_afeta_estoque := NOT (
      (COALESCE(v_it.modelo_precificacao, 'unitario') <> 'unitario')
      OR
      (COALESCE(v_it.tipo_item, 'material') IN ('servico', 'mao_de_obra'))
    );

    -- TODO (fora do escopo e7b — exigiria coluna nova não prevista na FASE 2): qtd_fisica para item
    -- RETORNÁVEL (locação): a quantidade de COBRANÇA (ex.: 10 diárias) não é a quantidade FÍSICA
    -- (1 betoneira). Entra com o desenho de devolução de retornáveis (e7c/medição), com coluna própria.

    v_codigo := NULL;
    IF v_it.catalogo_id IS NOT NULL THEN
      SELECT codigo INTO v_codigo FROM public.hub_catalogo
        WHERE id = v_it.catalogo_id AND (tenant_id = p_tenant_id OR tenant_id IS NULL);
    END IF;

    -- IDEMPOTÊNCIA (preservada): com uid, o reenvio colide no índice único e não vira segunda linha.
    INSERT INTO public.hub_estoque_mov(
      obra_id, tenant_id, catalogo_id, codigo_catalogo, descricao, categoria, unidade,
      tipo, quantidade, pedido_id, pedido_item_id, frente_id, registrado_por, motivo, origem,
      entrega_uid, afeta_estoque
    ) VALUES (
      v_obra, p_tenant_id, v_it.catalogo_id, v_codigo, v_it.descricao_snapshot, v_it.categoria,
      v_it.unidade, 'entrada', v_aplicado, p_pedido_id, v_it.id, NULL, p_registrado_por, p_obs,
      'sistema', p_entrega_uid, v_afeta_estoque
    )
    ON CONFLICT (pedido_item_id, entrega_uid) WHERE entrega_uid IS NOT NULL DO NOTHING
    RETURNING id INTO v_mov_id;

    IF v_mov_id IS NULL THEN
      -- reenvio exato da mesma entrega: o razão já tem a linha. Não mexe no saldo do item.
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    UPDATE public.hub_pedido_itens
      SET qtd_entregue = qtd_entregue + v_aplicado, atualizado_em = NOW()
      WHERE id = v_it.id;

    v_registradas := v_registradas + 1;
  END LOOP;

  -- Status do pedido: tudo entregue → 'entregue'; senão 'entregue_parcial'.
  -- Pedido SEM itens (legado de descrição livre) → bool_and NULL → tratamos como 'entregue'.
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
    'entradas_registradas', v_registradas,
    'entradas_ignoradas', v_ignoradas,
    'sugerir_resolver_restricao', (SELECT restricao_id FROM public.hub_pedidos_material WHERE id = p_pedido_id)
  );
END $fn$;

REVOKE ALL ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.hub_sc_registrar_entrega(uuid, uuid, jsonb, text, text, uuid) IS
  'E5/e7b (v3): cascata SC→razão. EXIGE status aprovado/entregue_parcial (gate humano); delta que cabe '
  'no pedido + FOR UPDATE (anti-corrida); idempotência por entrega_uid (reenvio não duplica). e7b: item '
  'de COBRANÇA (modelo≠unitario OU servico/mao_de_obra) entra no razão com afeta_estoque=false — '
  'não soma no inventário. Suporta SC sem obra (âncora projeto/serviço).';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ VERIFICAÇÃO EMBUTIDA — estrutural + SMOKE TEST do cofre (com rollback)    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
DO $verif$
DECLARE
  n int;
  v_def text;
  v_notnull boolean;
BEGIN
  -- tabelas novas
  SELECT count(*) INTO n FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('hub_sc_validacoes','hub_sc_politicas','hub_ordens_compra','hub_fornecedor_contas');
  IF n <> 4 THEN RAISE EXCEPTION 'FALHA e7b: tabelas novas ausentes (%/4)', n; END IF;

  -- dependências vivas da trilha do cofre
  IF to_regclass('public.hub_eventos') IS NULL THEN
    RAISE EXCEPTION 'FALHA e7b: hub_eventos ausente (trilha do cofre não tem onde gravar)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_alertas' AND column_name='tenant_id') THEN
    RAISE EXCEPTION 'FALHA e7b: hub_alertas.tenant_id ausente (aplicar e7a antes)';
  END IF;

  -- funções
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname='public' AND p.proname='gerar_codigo_oc' AND p.pronargs=1) THEN
    RAISE EXCEPTION 'FALHA C: gerar_codigo_oc ausente';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname='public' AND p.proname='hub_sc_registrar_entrega' AND p.pronargs=6
      AND p.prosrc ILIKE '%afeta_estoque%') THEN
    RAISE EXCEPTION 'FALHA H: hub_sc_registrar_entrega v3 (6 args + guard) ausente';
  END IF;
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname='public' AND p.proname IN
      ('hub_fornecedor_conta_ativar','hub_fornecedor_conta_revogar','hub_fornecedor_conta_substituir','hub_mascarar_chave');
  IF n < 4 THEN RAISE EXCEPTION 'FALHA D: RPCs/máscara do cofre ausentes (%/4)', n; END IF;

  -- triggers do cofre (stamp + audit_ins + guard + truncate)
  SELECT count(*) INTO n FROM pg_trigger
    WHERE tgrelid = 'public.hub_fornecedor_contas'::regclass AND NOT tgisinternal;
  IF n < 4 THEN RAISE EXCEPTION 'FALHA D: cofre com % trigger(s) — esperados 4', n; END IF;

  -- status da SC ganhou em_validacao
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
    WHERE conname = 'hub_pedidos_material_status_check' AND conrelid = 'public.hub_pedidos_material'::regclass;
  IF v_def IS NULL OR v_def NOT ILIKE '%em_validacao%' THEN
    RAISE EXCEPTION 'FALHA STATUS: CHECK sem em_validacao';
  END IF;

  -- razão: flag + obra opcional; view filtrando
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='hub_estoque_mov' AND column_name='afeta_estoque') THEN
    RAISE EXCEPTION 'FALHA H: hub_estoque_mov.afeta_estoque ausente';
  END IF;
  SELECT a.attnotnull INTO v_notnull FROM pg_attribute a
    WHERE a.attrelid = 'public.hub_estoque_mov'::regclass AND a.attname = 'obra_id';
  IF v_notnull THEN RAISE EXCEPTION 'FALHA H: hub_estoque_mov.obra_id ainda NOT NULL'; END IF;
  IF pg_get_viewdef('public.vw_hub_inventario'::regclass) NOT ILIKE '%afeta_estoque%' THEN
    RAISE EXCEPTION 'FALHA H: vw_hub_inventario não filtra afeta_estoque';
  END IF;

  -- máscara nunca expõe a chave
  IF public.hub_mascarar_chave('12345678900') <> '••••8900' THEN
    RAISE EXCEPTION 'FALHA D: hub_mascarar_chave errada';
  END IF;

  RAISE NOTICE 'e7b estrutural OK (B, C, D, H, status).';
END $verif$;

-- SMOKE TEST comportamental do COFRE — roda dentro de um sub-bloco que é SEMPRE revertido
-- (SMOKE_ROLLBACK): exercita trigger de imutabilidade, as 3 RPCs, o alerta e a trilha em hub_eventos
-- SEM deixar resíduo. Se qualquer proteção falhar, a MIGRAÇÃO INTEIRA aborta (nada meio-aplicado).
DO $smoke$
DECLARE
  v_forn        uuid;
  v_forn_tenant uuid;
  v_conta       uuid;
  v_res         jsonb;
  v_nova        uuid;
  v_bloqueou    boolean;
  v_cod         text;
BEGIN
  SELECT f.id, f.tenant_id INTO v_forn, v_forn_tenant
    FROM public.hub_fornecedores f
    WHERE f.tenant_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.hub_tenants t WHERE t.id = f.tenant_id)
    LIMIT 1;
  IF v_forn IS NULL THEN
    RAISE NOTICE 'smoke do cofre PULADO: nenhum fornecedor com tenant válido (checks estruturais já passaram). Rodar o roleplay E2E dedicado depois do apply.';
    RETURN;
  END IF;

  BEGIN  -- ══ sandbox: TUDO aqui dentro é revertido no final ══
    -- C: formato do código OC (o contador incrementado aqui também é revertido)
    v_cod := public.gerar_codigo_oc(v_forn_tenant);
    IF v_cod !~ '^OC-\d{4}-\d{4}$' THEN
      RAISE EXCEPTION 'FALHA C: gerar_codigo_oc devolveu formato inesperado: %', v_cod;
    END IF;

    -- D: conta nasce pendente, carimbada pelo banco
    INSERT INTO public.hub_fornecedor_contas
      (fornecedor_id, tenant_id, tipo, pix_tipo, pix_chave, titular_nome, titular_doc, criada_por)
    VALUES
      (v_forn, v_forn_tenant, 'pix', 'aleatoria', 'smoke-chave-e7b-nao-e-real', 'QA Smoke', NULL, 'qa_criador')
    RETURNING id INTO v_conta;

    -- (1) tentar nascer 'ativa' → stamp bloqueia
    v_bloqueou := false;
    BEGIN
      INSERT INTO public.hub_fornecedor_contas
        (fornecedor_id, tenant_id, tipo, pix_tipo, pix_chave, titular_nome, criada_por, status)
      VALUES (v_forn, v_forn_tenant, 'pix', 'aleatoria', 'smoke-2', 'QA Smoke', 'qa_criador', 'ativa');
    EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;
    IF NOT v_bloqueou THEN RAISE EXCEPTION 'FALHA D: INSERT nascendo ativa NÃO foi bloqueado'; END IF;

    -- (2) UPDATE direto do payload → guard bloqueia
    v_bloqueou := false;
    BEGIN
      UPDATE public.hub_fornecedor_contas SET pix_chave = 'hackeada' WHERE id = v_conta;
    EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;
    IF NOT v_bloqueou THEN RAISE EXCEPTION 'FALHA D: UPDATE direto de pix_chave NÃO foi bloqueado'; END IF;

    -- (3) mudança de status FORA da RPC → guard bloqueia (mesmo como role da migração/superuser)
    v_bloqueou := false;
    BEGIN
      UPDATE public.hub_fornecedor_contas
        SET status = 'ativa', verificada_por = 'x', verificada_em = now() WHERE id = v_conta;
    EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;
    IF NOT v_bloqueou THEN RAISE EXCEPTION 'FALHA D: mudança de status fora da RPC NÃO foi bloqueada'; END IF;

    -- (4) DELETE → bloqueado
    v_bloqueou := false;
    BEGIN
      DELETE FROM public.hub_fornecedor_contas WHERE id = v_conta;
    EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;
    IF NOT v_bloqueou THEN RAISE EXCEPTION 'FALHA D: DELETE no cofre NÃO foi bloqueado'; END IF;

    -- (5) quatro-olhos: criador tentando verificar → RPC nega
    v_bloqueou := false;
    BEGIN
      PERFORM public.hub_fornecedor_conta_ativar(v_conta, v_forn_tenant, 'qa_criador');
    EXCEPTION WHEN OTHERS THEN v_bloqueou := true; END;
    IF NOT v_bloqueou THEN RAISE EXCEPTION 'FALHA D: quatro-olhos NÃO barrou criador=verificador'; END IF;

    -- (6) caminho feliz: ativar via RPC (exercita flag + trilha hub_eventos)
    PERFORM public.hub_fornecedor_conta_ativar(v_conta, v_forn_tenant, 'qa_verificador');
    IF NOT EXISTS (SELECT 1 FROM public.hub_fornecedor_contas WHERE id = v_conta AND status = 'ativa') THEN
      RAISE EXCEPTION 'FALHA D: RPC ativar não ativou';
    END IF;

    -- (7) substituir via RPC (exercita conta nova + antiga substituida + alerta <7d + trilha)
    v_res := public.hub_fornecedor_conta_substituir(
      v_conta, v_forn_tenant,
      jsonb_build_object('tipo','pix','pix_tipo','aleatoria','pix_chave','smoke-nova-chave','titular_nome','QA Smoke 2'),
      'qa_criador_2');
    v_nova := (v_res->>'nova_conta_id')::uuid;
    IF v_nova IS NULL THEN RAISE EXCEPTION 'FALHA D: substituir não devolveu nova_conta_id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hub_fornecedor_contas WHERE id = v_conta AND status = 'substituida') THEN
      RAISE EXCEPTION 'FALHA D: substituir não marcou a antiga como substituida';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hub_fornecedor_contas WHERE id = v_nova AND status = 'pendente_verificacao') THEN
      RAISE EXCEPTION 'FALHA D: conta nova não nasceu pendente_verificacao';
    END IF;
    IF COALESCE((v_res->>'alerta_troca_rapida')::boolean, false) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'FALHA D: troca imediata não sinalizou alerta_troca_rapida';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.hub_alertas
                   WHERE tenant_id = v_forn_tenant AND tipo = 'seguranca'
                     AND titulo ILIKE '%trocada em menos de 7 dias%') THEN
      RAISE EXCEPTION 'FALHA D: alerta de troca <7d não foi gravado em hub_alertas';
    END IF;

    -- (8) revogar via RPC
    PERFORM public.hub_fornecedor_conta_revogar(v_nova, v_forn_tenant, 'qa_seguranca', 'teste embutido e7b');
    IF NOT EXISTS (SELECT 1 FROM public.hub_fornecedor_contas WHERE id = v_nova AND status = 'revogada') THEN
      RAISE EXCEPTION 'FALHA D: RPC revogar não revogou';
    END IF;

    -- (9) trilha imutável existe e está MASCARADA (nunca a chave em claro)
    IF NOT EXISTS (SELECT 1 FROM public.hub_eventos
                   WHERE event_type = 'fornecedor_conta_substituida' AND entity_id = v_nova) THEN
      RAISE EXCEPTION 'FALHA D: trilha da substituição não foi gravada em hub_eventos';
    END IF;
    IF EXISTS (SELECT 1 FROM public.hub_eventos
               WHERE entity_type = 'fornecedor_conta'
                 AND payload::text ILIKE '%smoke-chave-e7b-nao-e-real%') THEN
      RAISE EXCEPTION 'FALHA D: chave em CLARO vazou para hub_eventos — máscara furada';
    END IF;

    RAISE EXCEPTION 'SMOKE_ROLLBACK';  -- descarta TUDO do sandbox (contas, eventos, alerta, contador OC)
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'SMOKE_ROLLBACK' THEN RAISE; END IF;  -- falha REAL propaga e aborta a migração inteira
  END;

  RAISE NOTICE 'e7b OK: cadeia + OC + COFRE (smoke test passou e foi revertido) + guard da cascata.';
END $smoke$;


-- ============================================================================
-- TODO DOCUMENTADO — ÂNCORA OBRIGATÓRIA DA SC (chk_sc_ancorada) — NÃO ENTRA AGORA
-- ----------------------------------------------------------------------------
-- A regra "toda SC ancorada a ALGO" (num_nonnulls(obra_id, projeto_id, servico_id, negocio_id) >= 1)
-- fica FORA da e7b de propósito: o app ainda NÃO grava negocio_id/projeto_id/servico_id no POST/PATCH
-- e existe a SC órfã PED-2026-0001 (obra_id NULL, nenhuma âncora). Exigir agora quebraria a criação de
-- SC e congelaria a linha órfã (NOT VALID não isenta UPDATE dos guards de entrega).
-- QUANDO o app gravar as âncoras (FASE 3) + backfill da órfã, aplicar em migração própria:
--   -- 1) backfill:  UPDATE public.hub_pedidos_material SET negocio_id = <negócio correto>
--   --               WHERE codigo = 'PED-2026-0001' AND num_nonnulls(obra_id, projeto_id, servico_id, negocio_id) = 0;
--   -- 2) constraint: ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT chk_sc_ancorada
--   --               CHECK (num_nonnulls(obra_id, projeto_id, servico_id, negocio_id) >= 1) NOT VALID;
--   -- 3) validar:    ALTER TABLE public.hub_pedidos_material VALIDATE CONSTRAINT chk_sc_ancorada;
-- ============================================================================

-- ============================================================================
-- ROLLBACK (por bloco, ordem inversa; NADA SE PERDE: exportar dados reais antes de dropar):
--
-- H (guard da cascata):
--   -- ⚠️ AVISO: o rollback de H só é 100% limpo enquanto NÃO houver linha afeta_estoque=false no
--   --    razão (hoje: zero linhas). Se já houver entregas de serviço/diária registradas, restaurar a
--   --    view do E5 fará essas linhas SOMAREM no inventário (mentira no estoque) — nesse caso, manter
--   --    a view e7b e reverter só a função, ou tratar as linhas com movimento de 'ajuste' auditado.
--   -- 1) restaurar a função ANTERIOR (6 args): reaplicar a seção 2 INTEIRA do arquivo
--   --    supabase/migrations/20260711120000_sc_entrega_gate_e_idempotencia.sql (linhas 45-166) —
--   --    ela não referencia afeta_estoque, então pode rodar antes do passo 3.
--   -- 2) restaurar a VIEW do E5 (mesma definição, sem o WHERE):
--   CREATE OR REPLACE VIEW public.vw_hub_inventario WITH (security_invoker = true) AS
--   SELECT m.obra_id, m.tenant_id, m.catalogo_id,
--          COALESCE(MAX(m.descricao), MAX(m.codigo_catalogo)) AS descricao,
--          MAX(m.categoria) AS categoria, MAX(m.unidade) AS unidade,
--          MAX(m.codigo_catalogo) AS codigo_catalogo,
--          SUM(CASE m.tipo WHEN 'entrada' THEN m.quantidade WHEN 'devolucao' THEN m.quantidade
--                          WHEN 'saida' THEN -m.quantidade WHEN 'ajuste' THEN m.quantidade ELSE 0 END) AS em_estoque,
--          SUM(m.quantidade) FILTER (WHERE m.tipo = 'entrada')   AS total_entrada,
--          SUM(m.quantidade) FILTER (WHERE m.tipo = 'saida')     AS total_saida,
--          SUM(m.quantidade) FILTER (WHERE m.tipo = 'devolucao') AS total_devolucao,
--          SUM(m.quantidade) FILTER (WHERE m.tipo = 'ajuste')    AS total_ajuste,
--          COUNT(*) AS num_movimentos, MAX(m.criado_em) AS ultima_mov_em
--   FROM public.hub_estoque_mov m
--   GROUP BY m.obra_id, m.tenant_id, m.catalogo_id;
--   -- 3) ALTER TABLE public.hub_estoque_mov DROP COLUMN IF EXISTS afeta_estoque;
--   -- 4) obra_id de volta a NOT NULL SÓ se não houver linha órfã (senão o ALTER falha — e não force):
--   --    SELECT count(*) FROM public.hub_estoque_mov WHERE obra_id IS NULL;  -- precisa ser 0
--   --    ALTER TABLE public.hub_estoque_mov ALTER COLUMN obra_id SET NOT NULL;
--
-- D (cofre):  -- se houver contas REAIS, exportar antes (NADA SE PERDE)
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_conta_substituir(uuid, uuid, jsonb, text);
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_conta_revogar(uuid, uuid, text, text);
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_conta_ativar(uuid, uuid, text);
--   DROP TRIGGER IF EXISTS trg_trunc_hub_fornecedor_contas ON public.hub_fornecedor_contas;
--   DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_guard ON public.hub_fornecedor_contas;
--   DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_audit_ins ON public.hub_fornecedor_contas;
--   DROP TRIGGER IF EXISTS trg_hub_fornecedor_contas_stamp ON public.hub_fornecedor_contas;
--   DROP TABLE IF EXISTS public.hub_fornecedor_contas;
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_contas_guard();
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_contas_audit_ins();
--   DROP FUNCTION IF EXISTS public.hub_fornecedor_contas_stamp();
--   DROP FUNCTION IF EXISTS public.hub_mascarar_chave(text);
--
-- C (ordem de compra):  -- se houver OCs emitidas, exportar antes
--   DROP TRIGGER IF EXISTS trg_trunc_hub_ordens_compra ON public.hub_ordens_compra;
--   DROP TRIGGER IF EXISTS trg_hub_ordens_compra_guard ON public.hub_ordens_compra;
--   DROP TRIGGER IF EXISTS hub_ordens_compra_ts ON public.hub_ordens_compra;
--   DROP TABLE IF EXISTS public.hub_ordens_compra;
--   DROP FUNCTION IF EXISTS public.hub_ordens_compra_guard();
--   DROP FUNCTION IF EXISTS public.gerar_codigo_oc(uuid);
--   DELETE FROM public.hub_obra_codigo_contador WHERE tipo = 'oc';  -- opcional (linhas inofensivas)
--
-- B (cadeia):  -- se houver decisões registradas, exportar antes
--   DROP TRIGGER IF EXISTS trg_trunc_hub_sc_validacoes ON public.hub_sc_validacoes;
--   DROP TRIGGER IF EXISTS trg_hub_sc_validacoes_guard ON public.hub_sc_validacoes;
--   DROP TRIGGER IF EXISTS trg_hub_sc_validacoes_stamp ON public.hub_sc_validacoes;
--   DROP TABLE IF EXISTS public.hub_sc_validacoes;
--   DROP FUNCTION IF EXISTS public.hub_sc_validacoes_guard();
--   DROP FUNCTION IF EXISTS public.hub_sc_validacoes_stamp();
--   DROP TRIGGER IF EXISTS trg_trunc_hub_sc_politicas ON public.hub_sc_politicas;
--   DROP TRIGGER IF EXISTS hub_sc_politicas_ts ON public.hub_sc_politicas;
--   DROP TABLE IF EXISTS public.hub_sc_politicas;
--   DROP FUNCTION IF EXISTS public.hub_compras_bloquear_truncate();
--
-- STATUS:
--   -- NADA SE PERDE: mover as SCs em validação de volta ANTES de estreitar o CHECK
--   UPDATE public.hub_pedidos_material SET status = 'cotando' WHERE status = 'em_validacao';
--   ALTER TABLE public.hub_pedidos_material DROP CONSTRAINT IF EXISTS hub_pedidos_material_status_check;
--   ALTER TABLE public.hub_pedidos_material ADD CONSTRAINT hub_pedidos_material_status_check
--     CHECK (status IN ('rascunho','cotando','aprovado','entregue_parcial','entregue','cancelado'));
--   DROP INDEX IF EXISTS public.idx_hub_pedidos_fila;
--   CREATE INDEX IF NOT EXISTS idx_hub_pedidos_fila
--     ON public.hub_pedidos_material (tenant_id, status, criado_em DESC, id)
--     WHERE status IN ('rascunho','cotando','aprovado','entregue_parcial');
-- ============================================================================
