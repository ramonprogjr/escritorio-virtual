-- ############################################################################
-- TIER 0 — SCRIPT B: schema aditivo da rastreabilidade (linhagem, auto-código,
--          captador, ator, vínculo temporal, código de proposta, imutabilidade).
--
-- COMO RODAR: Supabase Dashboard -> SQL Editor -> colar TUDO -> Run.
--   Envolto em BEGIN/COMMIT (atômico: erro = rollback total). 100% ADITIVO e
--   IDEMPOTENTE. NÃO dropa nenhuma constraint existente. Rode o SCRIPT A antes.
--
-- O que NÃO está aqui (fica no Script C, parte invasiva): contador por-tenant,
--   prefixo MDO-, hub_identidade_acesso, users.pessoa_id, código da proposta gerado.
-- ############################################################################

BEGIN;

-- ═══ 1) AUTO-CÓDIGO NO BANCO (nasce codificado mesmo inserindo pelo SQL Editor) ═══
-- Só dispara quando o insert NÃO trouxe código (ex.: insert manual). Quando o app já
-- gera o código, o trigger não faz nada. Fecha o "insert manual nasce sem código".
CREATE OR REPLACE FUNCTION public.hub_auto_codigo() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.crm_proximo_codigo(TG_ARGV[0], NULL);
  END IF;
  RETURN NEW;
END $$;

-- Negócio embute o mercado no código (ex.: NGIMB2026001) → trigger dedicado.
CREATE OR REPLACE FUNCTION public.hub_auto_codigo_negocio() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := public.crm_proximo_codigo('negocio', NEW.mercado_slug);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_pessoas;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('pessoa');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_empresas;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_empresas
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('empresa');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_imoveis;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_imoveis
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('imovel');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_especialistas;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_especialistas
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('especialista');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_parceiros;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_parceiros
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('parceiro');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_leads_crm;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_leads_crm
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('lead');
DROP TRIGGER IF EXISTS trg_auto_codigo ON public.hub_servicos;
CREATE TRIGGER trg_auto_codigo BEFORE INSERT ON public.hub_servicos
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo('servico');
DROP TRIGGER IF EXISTS trg_auto_codigo_negocio ON public.hub_negocios;
CREATE TRIGGER trg_auto_codigo_negocio BEFORE INSERT ON public.hub_negocios
  FOR EACH ROW EXECUTE FUNCTION public.hub_auto_codigo_negocio();

-- ═══ 2) LINHAGEM DO NEGÓCIO (pai/raiz) — o keystone da spec ═══
ALTER TABLE public.hub_negocios
  ADD COLUMN IF NOT EXISTS negocio_pai_id  uuid REFERENCES public.hub_negocios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS negocio_raiz_id uuid REFERENCES public.hub_negocios(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hub_negocios_pai  ON public.hub_negocios (negocio_pai_id) WHERE negocio_pai_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hub_negocios_raiz ON public.hub_negocios (negocio_raiz_id);

-- Deriva a raiz (denormalizada) e protege a árvore. Filho é PROPOSTO (o app seta o pai
-- explicitamente na confirmação humana); o trigger NUNCA inventa pai.
CREATE OR REPLACE FUNCTION public.hub_negocio_set_raiz() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_pai_tenant uuid; v_pai_raiz uuid;
BEGIN
  -- Linhagem imutável: uma vez com pai, não re-parenteia (anti-ciclo + preserva causalidade).
  IF TG_OP = 'UPDATE' AND OLD.negocio_pai_id IS NOT NULL
     AND NEW.negocio_pai_id IS DISTINCT FROM OLD.negocio_pai_id THEN
    RAISE EXCEPTION 'negocio_pai_id é imutável após definido (negócio %).', NEW.id;
  END IF;

  IF NEW.negocio_pai_id IS NULL THEN
    NEW.negocio_raiz_id := NEW.id;                 -- raiz de si mesmo
  ELSE
    IF NEW.negocio_pai_id = NEW.id THEN
      RAISE EXCEPTION 'negocio_pai_id não pode ser o próprio negócio.';
    END IF;
    SELECT tenant_id, COALESCE(negocio_raiz_id, id) INTO v_pai_tenant, v_pai_raiz
      FROM public.hub_negocios WHERE id = NEW.negocio_pai_id;
    IF v_pai_tenant IS NULL THEN
      RAISE EXCEPTION 'negocio_pai_id % não existe.', NEW.negocio_pai_id;
    END IF;
    IF v_pai_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'linhagem não pode cruzar tenant.';
    END IF;
    NEW.negocio_raiz_id := v_pai_raiz;             -- herda a raiz do pai
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_negocio_set_raiz ON public.hub_negocios;
CREATE TRIGGER trg_negocio_set_raiz
  BEFORE INSERT OR UPDATE OF negocio_pai_id ON public.hub_negocios
  FOR EACH ROW EXECUTE FUNCTION public.hub_negocio_set_raiz();

-- Backfill: todo negócio existente vira raiz de si mesmo (linhagem real desconhecida).
UPDATE public.hub_negocios SET negocio_raiz_id = id WHERE negocio_raiz_id IS NULL;

-- ═══ 3) CAPTADOR DO IMÓVEL ("quem captou?" — hoje não tem resposta) ═══
ALTER TABLE public.hub_imoveis
  ADD COLUMN IF NOT EXISTS captado_por_parceiro_id uuid REFERENCES public.hub_parceiros(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captado_por_pessoa_id   uuid REFERENCES public.hub_pessoas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS captado_por_codigo      text,     -- snapshot do PAR-/PES- na captação (permanente)
  ADD COLUMN IF NOT EXISTS captado_via_link_id     uuid;     -- soft-FK p/ hub_links_cadastro
COMMENT ON COLUMN public.hub_imoveis.captado_por_codigo IS
  'Snapshot do código de quem captou (permanente mesmo se o vínculo mudar). Alimenta "qual corretor gera mais obras".';

-- ═══ 4) ATOR NOS EVENTOS ("quem fez?" — hoje ator='humano', papel, não identidade) ═══
ALTER TABLE public.hub_eventos
  ADD COLUMN IF NOT EXISTS ator_id     uuid,    -- identidade (pessoa/user) que executou
  ADD COLUMN IF NOT EXISTS ator_codigo text;    -- snapshot do código do ator

-- ═══ 5) VÍNCULO TEMPORAL PESSOA↔EMPRESA (saber onde trabalhava em X) ═══
ALTER TABLE public.hub_pessoas_empresas
  ADD COLUMN IF NOT EXISTS valido_de  date NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS valido_ate date;
COMMENT ON COLUMN public.hub_pessoas_empresas.valido_ate IS
  'NULL = vínculo ATIVO. Trocar de empresa = fecha o ativo (set valido_ate) + insere novo (Script C coordena o UNIQUE parcial).';

-- ═══ 6) CÓDIGO NA PROPOSTA (só a coluna; o gerador PROP entra no Script C) ═══
ALTER TABLE public.hub_propostas ADD COLUMN IF NOT EXISTS codigo text;

-- ═══ 7) IMUTABILIDADE DO CÓDIGO DE IDENTIDADE (hoje só o negócio é protegido) ═══
CREATE OR REPLACE FUNCTION public.hub_codigo_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.codigo IS NOT NULL AND NEW.codigo IS DISTINCT FROM OLD.codigo THEN
    RAISE EXCEPTION 'O código (%) é imutável após definido.', OLD.codigo;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_codigo_imutavel ON public.hub_pessoas;
CREATE TRIGGER trg_codigo_imutavel BEFORE UPDATE OF codigo ON public.hub_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.hub_codigo_imutavel();
DROP TRIGGER IF EXISTS trg_codigo_imutavel ON public.hub_empresas;
CREATE TRIGGER trg_codigo_imutavel BEFORE UPDATE OF codigo ON public.hub_empresas
  FOR EACH ROW EXECUTE FUNCTION public.hub_codigo_imutavel();
DROP TRIGGER IF EXISTS trg_codigo_imutavel ON public.hub_imoveis;
CREATE TRIGGER trg_codigo_imutavel BEFORE UPDATE OF codigo ON public.hub_imoveis
  FOR EACH ROW EXECUTE FUNCTION public.hub_codigo_imutavel();
DROP TRIGGER IF EXISTS trg_codigo_imutavel ON public.hub_especialistas;
CREATE TRIGGER trg_codigo_imutavel BEFORE UPDATE OF codigo ON public.hub_especialistas
  FOR EACH ROW EXECUTE FUNCTION public.hub_codigo_imutavel();

COMMIT;

-- ═══ VERIFICAÇÃO pós-apply (rode separado; espera-se sucesso) ═══
-- 1) auto-código: INSERT INTO public.hub_pessoas (nome, tenant_id) VALUES ('TESTE RASTREIO', '00000000-0000-4000-8000-000000000001')
--    RETURNING codigo;  -- deve voltar um PS...; depois DELETE dessa linha de teste.
-- 2) linhagem: SELECT count(*) FROM public.hub_negocios WHERE negocio_raiz_id IS NULL;  -- deve ser 0.
