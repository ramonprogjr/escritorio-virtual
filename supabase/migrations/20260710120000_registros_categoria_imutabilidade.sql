-- REGISTROS × LOGS × PERMISSÕES (spec do dono) — coluna categoria + imutabilidade por trigger.
-- ADITIVA e IDEMPOTENTE. Aplicar INTEIRA numa única transação (MCP apply_migration), NA JANELA DO DONO:
-- é trigger-guard na tabela hub_atividades, que a Mari escreve AO VIVO. O INSERT-stamp NUNCA rejeita
-- (inserts seguros), mas os guards de UPDATE/DELETE devem entrar com o dono ciente (regra da casa).
-- Corrigida por F0 (CHECK real): feito_por_tipo ∈ {humano,ia}; NÃO existe tipo 'agendamento' → 'reuniao'.
-- Não cria valor novo de `tipo`; não altera coluna existente; os 25+ write-sites ficam intocados.

-- 1) Colunas aditivas (NULLable) — mesmo padrão soft-archive de hub_pessoas/hub_empresas
ALTER TABLE public.hub_atividades
  ADD COLUMN IF NOT EXISTS categoria     text,
  ADD COLUMN IF NOT EXISTS arquivado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS arquivado_por text,
  ADD COLUMN IF NOT EXISTS editado_em    timestamptz;

DO $$ BEGIN
  ALTER TABLE public.hub_atividades ADD CONSTRAINT hub_atividades_categoria_chk
    CHECK (categoria IS NULL OR categoria IN ('comentario','atividade_principal','log')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.hub_atividades VALIDATE CONSTRAINT hub_atividades_categoria_chk;

-- 2) Derivação FAIL-CLOSED — fonte única (trigger + backfill). SÓ comparação textual; NUNCA cast de metadata.
CREATE OR REPLACE FUNCTION public.hub_atividade_categoria(p_tipo text, p_fpt text, p_meta jsonb)
RETURNS text LANGUAGE sql IMMUTABLE AS $fn$
  SELECT CASE
    -- [A] LOG conhecido (denylist confirmada no código, qualquer ator)
    WHEN COALESCE(p_meta->>'origem','') IN ('playbook_complete_summary','persistir_dados_lead_whatsapp') THEN 'log'
    WHEN COALESCE(p_meta,'{}'::jsonb) ? 'skip_ia' OR COALESCE(p_meta,'{}'::jsonb) ? 'midia_nao_processada' THEN 'log'
    WHEN p_tipo = 'mensagem' AND COALESCE(p_meta->>'primeira_mensagem','') <> 'true' THEN 'log'
    -- [B] COMENTÁRIO: exclusivamente nota humana
    WHEN p_tipo = 'nota' AND p_fpt = 'humano' THEN 'comentario'
    -- [C] PRINCIPAL: allowlist de marcos (reuniao = "agendou reunião" do dono)
    WHEN p_tipo IN ('status_change','proposta','reuniao') THEN 'atividade_principal'
    WHEN p_tipo = 'mensagem' THEN 'atividade_principal'                      -- só chega aqui primeira_mensagem='true'
    WHEN p_tipo = 'ia_acao' THEN 'atividade_principal'                       -- handoff + auto-avanço; o ia_acao ruidoso já caiu em [A]
    WHEN p_tipo = 'nota' AND p_fpt IN ('ia','sistema') THEN 'atividade_principal'  -- hub_registar_nota_lead
    -- [D] DEFAULT: humano nunca some (principal); ia/sistema/desconhecido nunca polui (log)
    ELSE CASE WHEN p_fpt = 'humano' THEN 'atividade_principal' ELSE 'log' END
  END $fn$;

-- 3) Carimbo no INSERT: congela a classificação na escrita; write novo pode mandar categoria explícita
CREATE OR REPLACE FUNCTION public.hub_atividades_stamp() RETURNS trigger LANGUAGE plpgsql AS $tg$
BEGIN
  IF NEW.categoria IS NULL THEN
    NEW.categoria := public.hub_atividade_categoria(NEW.tipo, NEW.feito_por_tipo, NEW.metadata);
  END IF;
  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_atividades_stamp ON public.hub_atividades;
CREATE TRIGGER trg_hub_atividades_stamp BEFORE INSERT ON public.hub_atividades
  FOR EACH ROW EXECUTE FUNCTION public.hub_atividades_stamp();

-- 4) Backfill idempotente (mesma transação — CREATE TRIGGER bloqueia INSERT concorrente até o COMMIT)
UPDATE public.hub_atividades
   SET categoria = public.hub_atividade_categoria(tipo, feito_por_tipo, metadata)
 WHERE categoria IS NULL;

UPDATE public.hub_atividades a
   SET tenant_id = l.tenant_id
  FROM public.hub_leads_crm l
 WHERE a.tenant_id IS NULL AND a.lead_id = l.id AND l.tenant_id IS NOT NULL;

DO $$ BEGIN
  UPDATE public.hub_atividades a
     SET tenant_id = n.tenant_id
    FROM public.hub_negocios n
   WHERE a.tenant_id IS NULL AND a.negocio_id = n.id AND n.tenant_id IS NOT NULL;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL; END $$;

-- 5) GUARD de hub_atividades (vale até para service_role — RLS/REVOKE não seguram crmDb)
CREATE OR REPLACE FUNCTION public.hub_atividades_guard() RETURNS trigger LANGUAGE plpgsql AS $tg$
DECLARE cat text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'hub_atividades: DELETE proibido — apagar = arquivar (arquivado_em). Regra eterna do Hub.';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.tipo IS DISTINCT FROM OLD.tipo
     OR NEW.feito_por IS DISTINCT FROM OLD.feito_por
     OR NEW.feito_por_tipo IS DISTINCT FROM OLD.feito_por_tipo
     OR NEW.criado_em IS DISTINCT FROM OLD.criado_em
     OR (OLD.tenant_id   IS NOT NULL AND NEW.tenant_id   IS DISTINCT FROM OLD.tenant_id)
     OR (OLD.entity_type IS NOT NULL AND NEW.entity_type IS DISTINCT FROM OLD.entity_type)
     OR (OLD.entity_id   IS NOT NULL AND NEW.entity_id   IS DISTINCT FROM OLD.entity_id)
     OR (OLD.categoria   IS NOT NULL AND NEW.categoria   IS DISTINCT FROM OLD.categoria) THEN
    RAISE EXCEPTION 'hub_atividades: núcleo imutável (id/tipo/autor/criado_em/tenant/entidade/categoria)';
  END IF;
  cat := COALESCE(OLD.categoria, public.hub_atividade_categoria(OLD.tipo, OLD.feito_por_tipo, OLD.metadata));
  IF cat = 'log' AND (NEW.descricao IS DISTINCT FROM OLD.descricao
       OR NEW.arquivado_em  IS DISTINCT FROM OLD.arquivado_em
       OR NEW.arquivado_por IS DISTINCT FROM OLD.arquivado_por
       OR NEW.metadata      IS DISTINCT FROM OLD.metadata) THEN
    RAISE EXCEPTION 'hub_atividades: log imutável — nem owner edita/arquiva; owner só extrai relatório';
  END IF;
  IF NEW.descricao IS DISTINCT FROM OLD.descricao THEN
    NEW.editado_em := now();  -- o banco carimba; a rota não consegue esquecer
  END IF;
  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_atividades_guard ON public.hub_atividades;
CREATE TRIGGER trg_hub_atividades_guard BEFORE UPDATE OR DELETE ON public.hub_atividades
  FOR EACH ROW EXECUTE FUNCTION public.hub_atividades_guard();

-- 6) Prova de adulteração: todo update relevante espelha em hub_eventos (imutável), independente da rota
CREATE OR REPLACE FUNCTION public.hub_atividades_audit() RETURNS trigger LANGUAGE plpgsql AS $tg$
BEGIN
  BEGIN
    INSERT INTO public.hub_eventos (event_type, entity_type, entity_id, ator, payload, tenant_id)
    VALUES ('registro_alterado', COALESCE(OLD.entity_type,'lead'), COALESCE(OLD.entity_id, OLD.lead_id), 'db_trigger',
            jsonb_build_object('atividade_id', OLD.id,
              'descricao_antes', OLD.descricao, 'descricao_depois', NEW.descricao,
              'arquivado_em_antes', OLD.arquivado_em, 'arquivado_em_depois', NEW.arquivado_em,
              'arquivado_por', NEW.arquivado_por),
            OLD.tenant_id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub_atividades_audit falhou: %', SQLERRM;  -- best-effort: nunca derruba o update legítimo
  END;
  RETURN NEW;
END $tg$;
DROP TRIGGER IF EXISTS trg_hub_atividades_audit ON public.hub_atividades;
CREATE TRIGGER trg_hub_atividades_audit AFTER UPDATE ON public.hub_atividades
  FOR EACH ROW
  WHEN (OLD.descricao IS DISTINCT FROM NEW.descricao OR OLD.arquivado_em IS DISTINCT FROM NEW.arquivado_em)
  EXECUTE FUNCTION public.hub_atividades_audit();

-- 7) Logs REALMENTE imutáveis: linha (UPDATE/DELETE) + statement (TRUNCATE).
--    hub_prompt_logs (engine) e hub_conversas_log (storage) são insert-only — verificado.
--    hub_msg_jobs / hub_conversas sofrem UPDATE legítimo — ficam FORA por design.
CREATE OR REPLACE FUNCTION public.bloquear_mutacao_log() RETURNS trigger LANGUAGE plpgsql AS $tg$
BEGIN RAISE EXCEPTION '%: log imutável (append-only) — nem owner apaga; extração só por relatório', TG_TABLE_NAME; END $tg$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['hub_acoes_ia','hub_eventos','hub_prompt_logs','hub_conversas_log'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_imutavel_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_imutavel_%I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacao_log()', t, t);
      EXECUTE format('DROP TRIGGER IF EXISTS trg_trunc_%I ON public.%I', t, t);
      EXECUTE format('CREATE TRIGGER trg_trunc_%I BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.bloquear_mutacao_log()', t, t);
      EXECUTE format('REVOKE UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS trg_trunc_hub_atividades ON public.hub_atividades;
CREATE TRIGGER trg_trunc_hub_atividades BEFORE TRUNCATE ON public.hub_atividades
  FOR EACH STATEMENT EXECUTE FUNCTION public.bloquear_mutacao_log();

-- 8) Índice parcial da timeline
CREATE INDEX IF NOT EXISTS idx_hub_atividades_timeline
  ON public.hub_atividades (tenant_id, entity_type, entity_id, criado_em DESC)
  WHERE arquivado_em IS NULL;

-- 9) Verificação embutida: falha ATÔMICA (rollback total) se sobrou linha sem categoria
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.hub_atividades WHERE categoria IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'backfill incompleto: % linhas sem categoria — migração revertida', n; END IF;
END $$;

-- ROLLBACK seguro: reverter o filtro de leitura no CÓDIGO primeiro; só então DROP dos triggers stamp/guard/audit.
-- Colunas ficam (inofensivas). NUNCA dropar o stamp com o filtro de leitura vivo.
-- Resíduo honesto: superuser/DDL na janela consegue DROP TRIGGER — mitigação = trilha em hub_eventos + backup 3h.
