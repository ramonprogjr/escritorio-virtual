BEGIN;

-- ############################################################################
-- BUNDLE AEC — completude idempotente (a maioria do schema ja existe de sessoes anteriores).
-- Fixes 02/jul: (1) idx_taxonomia_fts IMMUTABLE; (2) e6 add hub_aprovacoes.tenant_id;
--               (3) e7c drop _select/_insert antes de criar; (4) e4 avanco drop _select/_insert.
-- ESCROW (e6): schema criado/atualizado, mas NAO ATIVAR ate o fix #5 (bug GREATEST).
-- ############################################################################

-- ==== ARQUIVO: 20260711120000_e0b_taxonomia_ambiente_segmento.sql ====
-- ============================================================================
-- E0.5 — TAXONOMIA de atividades (descritivo padrão) + AMBIENTE + SEGMENTO
--        (refino ADITIVO da EAP sobre E0/E2; ambiente-first opt-in por obra nova)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - RLS via current_user_tenant_id() (igual E0 20260705130000 / E2 20260710120000);
--       - tabela nova = ESPELHO de hub_catalogo (read tenant-ou-global; write só tenant);
--       - colunas novas TODAS nullable + DEFAULT que preserva o que está no ar
--         (frentes_eap.tipo_no DEFAULT 'frente' → toda frente existente fica idêntica);
--       - seed da taxonomia = GLOBAL (tenant_id NULL), espelho de lib/obras/taxonomia.ts.
--     Até aplicar, a UI degrada graciosamente (fallback in-code em lib/obras/taxonomia.ts
--     e lib/obras/eap-presets.ts) — a taxonomia/segmento/ambiente dormem, EAP segue
--     disciplina-first, NADA quebra.
--
-- ⚠️  ORDEM DE APPLY: E0 (20260705130000) → A0 (20260705140000) → E2 (20260710120000)
--     → E0.5 (ESTE). E0.5 depende de hub_obras, hub_obra_itens, hub_obra_frentes_eap,
--     hub_eap_presets e hub_tenants existirem (E0/E2). Os timestamps já garantem a ordem.
--
-- ⚠️  ORDEM INTRA-ARQUIVO: cria hub_obra_taxonomia ANTES do ALTER hub_obra_itens ADD
--     taxonomia_id (a FK exige a tabela existir).
--
-- O QUE ENTREGA:
--   1. hub_obra_taxonomia (NOVA): catálogo controlado de atividades por disciplina
--      (descritivo padrão + sinônimos p/ a IA classificar). NÃO chaveada por segmento/ambiente.
--   2. Colunas aditivas nullable: hub_obras.segmento, hub_obra_itens.ambiente + taxonomia_id,
--      hub_obra_frentes_eap.tipo_no (DEFAULT 'frente'), hub_eap_presets.segmento.
--   3. Índice ambiente-first em hub_obra_itens.
--   4. Seed GLOBAL da taxonomia (Elétrica completa do dono + básico de civil/hidr/revest/pint).
--   5. 5 presets por segmento (frentes_json evoluído com ambientes + atividades_default).
--
-- ROLLBACK (resumo no fim do arquivo).
-- ============================================================================

-- ─── 0) Helper de tenant para RLS (idempotente; canônica já existe em prod) ────
-- AUDITORIA-FIX: alinhado à canônica (20260626130000_multitenant_foundation) — NÃO enfraquecer
-- current_user_tenant_id(). Definição IDÊNTICA à canônica (SECURITY DEFINER + search_path +
-- COALESCE com fallback ao tenant default). A canônica roda ANTES num apply limpo; este
-- CREATE OR REPLACE só garante paridade sem rebaixar a função à versão fraca.
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

-- ─── 1) hub_obra_taxonomia (NOVA) — catálogo controlado de atividades ──────────
-- DEVE vir ANTES do ALTER hub_obra_itens ADD taxonomia_id (a FK exige a tabela).
CREATE TABLE IF NOT EXISTS public.hub_obra_taxonomia (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID REFERENCES public.hub_tenants(id) ON DELETE CASCADE,  -- NULL = global
  disciplina_slug    TEXT NOT NULL,                 -- FK lógica ao hub_catalogo (categoria=disciplina)
  codigo             TEXT NOT NULL,                 -- 'ELET-TOMADA-110' (estável; alvo da IA)
  nome               TEXT NOT NULL,                 -- "Tomada 1,10m"
  descricao_padrao   TEXT,                          -- memorial pronto (NBR, altura, bitola)
  sinonimos          TEXT[] NOT NULL DEFAULT '{}',  -- ['tomada alta','TUG'] — vocabulário p/ a IA
  unidade            TEXT,                          -- 'un','m','m²','pt','vb','cj'
  qtd_padrao         NUMERIC(10,3),                 -- sugestão; humano confirma (v1 do dono)
  ambiente_tipico    TEXT[] NOT NULL DEFAULT '{}',  -- ['sala','recepcao'] — guia do preset/IA
  segmento_tipico    TEXT[] NOT NULL DEFAULT '{}',
  valor_ref_unitario NUMERIC(14,2),                 -- liga ao marketplace E5 depois
  ativo              BOOLEAN NOT NULL DEFAULT true,
  ordem              NUMERIC(6,2) NOT NULL DEFAULT 0,
  origem             TEXT NOT NULL DEFAULT 'sistema' CHECK (origem IN ('sistema','tenant','ia')),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- PG15 (Supabase) suporta NULLS NOT DISTINCT: 1 código por (tenant ou global).
  CONSTRAINT hub_obra_taxonomia_codigo_uniq UNIQUE NULLS NOT DISTINCT (tenant_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_taxonomia_disc
  ON public.hub_obra_taxonomia (disciplina_slug, ativo, ordem);
-- FTS portuguese (nome + sinônimos) — habilita a classificação da IA do Orçamento.
-- array_to_string() é STABLE (não IMMUTABLE) → índice de expressão direto falha (42P17).
-- Encapsula numa função IMMUTABLE (juntar um text[] com delimitador fixo é determinístico).
CREATE OR REPLACE FUNCTION public.hub_obra_taxonomia_fts_doc(p_nome text, p_sinonimos text[])
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $fts$
  SELECT to_tsvector('portuguese',
    COALESCE(p_nome, '') || ' ' || array_to_string(COALESCE(p_sinonimos, '{}'::text[]), ' '))
$fts$;
CREATE INDEX IF NOT EXISTS idx_taxonomia_fts
  ON public.hub_obra_taxonomia
  USING GIN (public.hub_obra_taxonomia_fts_doc(nome, sinonimos));
-- Busca por sinônimo exato (array contains).
CREATE INDEX IF NOT EXISTS idx_taxonomia_sin
  ON public.hub_obra_taxonomia USING GIN (sinonimos);
CREATE INDEX IF NOT EXISTS idx_taxonomia_tenant
  ON public.hub_obra_taxonomia (tenant_id);

DROP TRIGGER IF EXISTS hub_obra_taxonomia_ts ON public.hub_obra_taxonomia;
CREATE TRIGGER hub_obra_taxonomia_ts BEFORE UPDATE ON public.hub_obra_taxonomia
  FOR EACH ROW EXECUTE FUNCTION public.hub_atualizar_timestamp();

-- ─── 2) Colunas aditivas (TODAS nullable / com DEFAULT que preserva o existente) ──

-- hub_obras.segmento (NULL = sem segmento / genérico; backfill N/A).
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS segmento TEXT;
ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_segmento_check;
ALTER TABLE public.hub_obras ADD CONSTRAINT hub_obras_segmento_check
  CHECK (segmento IS NULL OR segmento IN ('residencial','comercial','corporativo','clinicas','pdv'));

-- hub_obra_itens.ambiente (texto livre, sem CHECK — chips + "+ Outro ambiente"; NULL = legado).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS ambiente TEXT;
-- hub_obra_itens.taxonomia_id — FK p/ a taxonomia (ON DELETE SET NULL: apagar a atividade do
-- catálogo NÃO apaga o item da obra; só desliga o vínculo).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS taxonomia_id UUID
    REFERENCES public.hub_obra_taxonomia(id) ON DELETE SET NULL;

-- hub_obra_frentes_eap.tipo_no — DEFAULT 'frente' garante NADA-SE-PERDE: toda frente já no ar
-- continua idêntica (disciplina-first). 'ambiente'/'disciplina' são opt-in (pesos por ambiente).
ALTER TABLE public.hub_obra_frentes_eap
  ADD COLUMN IF NOT EXISTS tipo_no TEXT NOT NULL DEFAULT 'frente';
ALTER TABLE public.hub_obra_frentes_eap DROP CONSTRAINT IF EXISTS hub_obra_frentes_eap_tipo_no_check;
ALTER TABLE public.hub_obra_frentes_eap ADD CONSTRAINT hub_obra_frentes_eap_tipo_no_check
  CHECK (tipo_no IN ('frente','ambiente','disciplina'));

-- hub_eap_presets.segmento (NULL = genérico; os 3 presets atuais ficam NULL = intocados).
ALTER TABLE public.hub_eap_presets
  ADD COLUMN IF NOT EXISTS segmento TEXT;

-- Índice ambiente-first (o toggle "na sala, o que tem"). Parcial = barato e seletivo.
CREATE INDEX IF NOT EXISTS idx_hub_obra_itens_ambiente
  ON public.hub_obra_itens (obra_id, ambiente, disciplina_slug) WHERE ativo = true;

-- ─── 3) RLS — espelho de hub_catalogo (read tenant-ou-global; write só tenant) ──
ALTER TABLE public.hub_obra_taxonomia ENABLE ROW LEVEL SECURITY;

-- Ler: global (tenant_id NULL) + do próprio tenant.
DROP POLICY IF EXISTS hub_obra_taxonomia_sel ON public.hub_obra_taxonomia;
CREATE POLICY hub_obra_taxonomia_sel ON public.hub_obra_taxonomia FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR tenant_id = current_user_tenant_id());
-- Escrever: SÓ o próprio tenant (ninguém edita a taxonomia global pelo app; só seed/admin SQL).
DROP POLICY IF EXISTS hub_obra_taxonomia_ins ON public.hub_obra_taxonomia;
CREATE POLICY hub_obra_taxonomia_ins ON public.hub_obra_taxonomia FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_obra_taxonomia_upd ON public.hub_obra_taxonomia;
CREATE POLICY hub_obra_taxonomia_upd ON public.hub_obra_taxonomia FOR UPDATE TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
DROP POLICY IF EXISTS hub_obra_taxonomia_del ON public.hub_obra_taxonomia;
CREATE POLICY hub_obra_taxonomia_del ON public.hub_obra_taxonomia FOR DELETE TO authenticated
  USING (tenant_id = current_user_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_taxonomia TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_taxonomia IS
  'Catálogo controlado de atividades (descritivo padrão + sinônimos p/ a IA classificar). NÃO chaveada por segmento/ambiente — o contexto (onde/quanto) vive no preset. tenant_id NULL = global.';
COMMENT ON COLUMN public.hub_obra_itens.ambiente IS
  'Ambiente desnorm. (texto livre): "sala","recepcao". Chave do toggle ambiente-first do E2. NULL = legado/sem ambiente.';
COMMENT ON COLUMN public.hub_obra_itens.taxonomia_id IS
  'Vínculo opcional à atividade-padrão (hub_obra_taxonomia). ON DELETE SET NULL: apagar do catálogo não apaga o item.';
COMMENT ON COLUMN public.hub_obra_frentes_eap.tipo_no IS
  'Tipo do nó da árvore EAP. DEFAULT frente (disciplina-first, comportamento atual). ambiente/disciplina = pesos por ambiente (opt-in E4).';
COMMENT ON COLUMN public.hub_obras.segmento IS
  'Segmento da obra (residencial/comercial/corporativo/clinicas/pdv). NULL = genérico. Guia o preset por segmento.';

-- ─── 4) Seed GLOBAL da taxonomia (espelho de lib/obras/taxonomia.ts) ───────────
-- Elétrica COMPLETA (exemplo literal do dono) + básico de civil/hidráulica/revest/pintura.
-- tenant_id NULL = global; origem='sistema'. WHERE NOT EXISTS = idempotente.
INSERT INTO public.hub_obra_taxonomia
  (tenant_id, disciplina_slug, codigo, nome, descricao_padrao, sinonimos, unidade, qtd_padrao, ambiente_tipico, ordem, origem)
SELECT NULL, v.disciplina_slug, v.codigo, v.nome, v.descricao_padrao, v.sinonimos, v.unidade, v.qtd_padrao, v.ambiente_tipico, v.ordem, 'sistema'
FROM (VALUES
  -- ── Elétrica (referência do dono) ──
  ('eletrica', 'ELET-DADOS-VOZ', 'Dados e voz',
    'Ponto de dados/voz com cabo de rede UTP cat.6, terminado em conector RJ45 keystone, conforme NBR 14565.',
    ARRAY['ponto de rede','rj45','cabo de rede','ponto de dados','rede']::text[], 'pt', NULL::numeric,
    ARRAY['recepcao','sala','escritorio']::text[], 0::numeric),
  ('eletrica', 'ELET-TOMADA-110', 'Tomada 1,10m',
    'Tomada de uso geral (TUG) 2P+T 10A/20A instalada a 1,10m do piso acabado, padrão NBR 5410.',
    ARRAY['tomada alta','tomada uso geral','tug','tomada 1,10','tomada media']::text[], 'pt', NULL::numeric,
    ARRAY['sala','recepcao','quarto','escritorio']::text[], 1::numeric),
  ('eletrica', 'ELET-TOMADA-030', 'Tomada 0,30m',
    'Tomada de uso geral (TUG) 2P+T instalada a 0,30m do piso acabado (baixa), padrão NBR 5410.',
    ARRAY['tomada baixa','tomada fogao','tomada 0,30','tomada rodape']::text[], 'pt', NULL::numeric,
    ARRAY['sala','quarto','cozinha']::text[], 2::numeric),
  ('eletrica', 'ELET-ILUM-LED', 'Iluminação LED',
    'Ponto de iluminação com luminária LED embutida (spot/plafon), incluindo infraestrutura e comando.',
    ARRAY['spot','ponto de luz','luminaria embutida','led','iluminacao']::text[], 'pt', NULL::numeric,
    ARRAY['sala','recepcao','cozinha','banheiro']::text[], 3::numeric),
  ('eletrica', 'ELET-ILUM-PLAFON', 'Iluminação plafon',
    'Ponto de iluminação com luminária de sobrepor (plafon), incluindo infraestrutura e comando.',
    ARRAY['plafon','luminaria sobrepor','luminaria teto']::text[], 'pt', NULL::numeric,
    ARRAY['banheiro','area_servico','corredor']::text[], 4::numeric),
  ('eletrica', 'ELET-QDL', 'Quadro de luz (QDL)',
    'Quadro de distribuição de luz com disjuntores DR e DPS, barramento e identificação de circuitos, NBR 5410.',
    ARRAY['qdl','disjuntor','quadro eletrico','quadro de distribuicao','quadro de luz']::text[], 'un', 1::numeric,
    ARRAY['area_tecnica','hall','area_servico']::text[], 5::numeric),
  -- ── Civil (básico) ──
  ('civil', 'CIVIL-ALVENARIA', 'Alvenaria de vedação',
    'Parede de alvenaria de vedação em bloco cerâmico/concreto, assentada com argamassa, prumo e nível.',
    ARRAY['parede','bloco','tijolo','vedacao','alvenaria']::text[], 'm²', NULL::numeric,
    ARRAY['sala','quarto','area_servico']::text[], 0::numeric),
  ('civil', 'CIVIL-CONTRAPISO', 'Contrapiso',
    'Contrapiso de regularização em argamassa de cimento e areia, nivelado e desempenado para receber revestimento.',
    ARRAY['regularizacao','contra piso','piso bruto','lastro']::text[], 'm²', NULL::numeric,
    ARRAY['sala','cozinha','area_servico']::text[], 1::numeric),
  ('civil', 'CIVIL-DRYWALL', 'Parede em drywall',
    'Parede em chapas de gesso acartonado (drywall) sobre estrutura metálica, com lã mineral quando especificado.',
    ARRAY['gesso acartonado','divisoria','parede seca','drywall']::text[], 'm²', NULL::numeric,
    ARRAY['escritorio','sala','recepcao']::text[], 2::numeric),
  -- ── Hidráulica (básico) ──
  ('hidraulica', 'HIDR-PONTO-AGUA', 'Ponto de água fria',
    'Ponto de água fria em tubo PVC soldável, com registro e teste de estanqueidade, conforme NBR 5626.',
    ARRAY['agua fria','ponto de agua','tubulacao agua','hidraulica']::text[], 'pt', NULL::numeric,
    ARRAY['banheiro','cozinha','area_servico']::text[], 0::numeric),
  ('hidraulica', 'HIDR-PONTO-ESGOTO', 'Ponto de esgoto',
    'Ponto de esgoto sanitário em tubo PVC série normal, com caimento e ventilação, conforme NBR 8160.',
    ARRAY['esgoto','ponto de esgoto','ralo','sanitario']::text[], 'pt', NULL::numeric,
    ARRAY['banheiro','cozinha','area_servico']::text[], 1::numeric),
  ('hidraulica', 'HIDR-LOUCA-METAL', 'Louças e metais',
    'Instalação de louça sanitária e metais (bacia, lavatório, torneira, registro), com vedação e fixação.',
    ARRAY['bacia','vaso','louca','metais','torneira','lavatorio']::text[], 'cj', NULL::numeric,
    ARRAY['banheiro','cozinha']::text[], 2::numeric),
  -- ── Revestimentos (básico) ──
  ('revestimento', 'REVEST-PISO-PORC', 'Piso porcelanato',
    'Revestimento de piso em porcelanato assentado com argamassa colável AC-III, rejunte epóxi/flexível, juntas niveladas.',
    ARRAY['porcelanato','piso ceramico','ceramica de piso','revestimento de piso']::text[], 'm²', NULL::numeric,
    ARRAY['sala','cozinha','recepcao']::text[], 0::numeric),
  ('revestimento', 'REVEST-PAREDE-AZUL', 'Revestimento de parede',
    'Revestimento cerâmico/porcelanato de parede assentado com argamassa colável, rejuntado e nivelado.',
    ARRAY['azulejo','revestimento parede','ceramica parede','pastilha']::text[], 'm²', NULL::numeric,
    ARRAY['banheiro','cozinha']::text[], 1::numeric),
  -- ── Pintura (básico) ──
  ('pintura', 'PINT-PAREDE-ACRIL', 'Pintura acrílica de parede',
    'Pintura em tinta acrílica sobre massa corrida/PVA, com selador, duas demãos e acabamento uniforme.',
    ARRAY['pintura','tinta acrilica','pintura parede','acabamento parede']::text[], 'm²', NULL::numeric,
    ARRAY['sala','quarto','recepcao','escritorio']::text[], 0::numeric),
  ('pintura', 'PINT-TETO', 'Pintura de teto',
    'Pintura de teto em tinta acrílica/látex sobre massa, com selador e duas demãos, acabamento fosco.',
    ARRAY['teto','pintura teto','forro pintado']::text[], 'm²', NULL::numeric,
    ARRAY['sala','quarto','cozinha']::text[], 1::numeric)
) AS v(disciplina_slug, codigo, nome, descricao_padrao, sinonimos, unidade, qtd_padrao, ambiente_tipico, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.hub_obra_taxonomia t
  WHERE t.tenant_id IS NULL AND t.codigo = v.codigo
);

-- ─── 5) 5 presets GLOBAIS por segmento (frentes_json evoluído com ambientes) ───
-- Espelho de EAP_PRESETS_SEGMENTO em lib/obras/eap-presets.ts. Os 3 presets genéricos do E0
-- ficam com segmento NULL (intocados). qtd=null em todas (humano confirma — v1 do dono).
INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, segmento, frentes_json)
SELECT NULL, 'reforma', 'residencial-padrao', 'Residencial Padrão', true, 10, 'residencial', $json$[
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":12,"peso_financeiro":13,"ambientes":[
    {"codigo":"SALA","label":"Sala","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]},
    {"codigo":"COZINHA","label":"Cozinha","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-TOMADA-030","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null}]}]},
  {"disciplina_slug":"hidraulica","nome":"Hidráulica","peso_fisico":9,"peso_financeiro":10,"ambientes":[
    {"codigo":"BANHEIRO","label":"Banheiro","atividades_default":[
      {"codigo":"HIDR-PONTO-AGUA","qtd":null},{"codigo":"HIDR-PONTO-ESGOTO","qtd":null},{"codigo":"HIDR-LOUCA-METAL","qtd":null}]}]},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":11,"peso_financeiro":11,"ambientes":[
    {"codigo":"COZINHA","label":"Cozinha","atividades_default":[{"codigo":"REVEST-PISO-PORC","qtd":null}]},
    {"codigo":"BANHEIRO","label":"Banheiro","atividades_default":[{"codigo":"REVEST-PAREDE-AZUL","qtd":null}]}]},
  {"disciplina_slug":"pintura","nome":"Pintura","peso_fisico":8,"peso_financeiro":4,"ambientes":[
    {"codigo":"SALA","label":"Sala","atividades_default":[{"codigo":"PINT-PAREDE-ACRIL","qtd":null},{"codigo":"PINT-TETO","qtd":null}]}]}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'residencial-padrao');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, segmento, frentes_json)
SELECT NULL, 'reforma', 'comercial-padrao', 'Comercial Padrão', true, 11, 'comercial', $json$[
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":13,"peso_financeiro":14,"ambientes":[
    {"codigo":"LOJA","label":"Loja","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]},
    {"codigo":"CAIXA","label":"Caixa","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]}]},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":11,"peso_financeiro":11,"ambientes":[
    {"codigo":"LOJA","label":"Loja","atividades_default":[{"codigo":"REVEST-PISO-PORC","qtd":null}]}]},
  {"disciplina_slug":"pintura","nome":"Pintura","peso_fisico":8,"peso_financeiro":4,"ambientes":[
    {"codigo":"LOJA","label":"Loja","atividades_default":[{"codigo":"PINT-PAREDE-ACRIL","qtd":null},{"codigo":"PINT-TETO","qtd":null}]}]}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'comercial-padrao');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, segmento, frentes_json)
SELECT NULL, 'reforma', 'corporativo-padrao', 'Corporativo Padrão', true, 12, 'corporativo', $json$[
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":14,"peso_financeiro":15,"ambientes":[
    {"codigo":"RECEPCAO","label":"Recepção","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null}]},
    {"codigo":"ESCRITORIO","label":"Escritório / Open space","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null}]},
    {"codigo":"SALA_REUNIAO","label":"Sala de reunião","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]}]},
  {"disciplina_slug":"civil","nome":"Civil","peso_fisico":12,"peso_financeiro":13,"ambientes":[
    {"codigo":"ESCRITORIO","label":"Escritório / Open space","atividades_default":[{"codigo":"CIVIL-DRYWALL","qtd":null}]},
    {"codigo":"SALA_REUNIAO","label":"Sala de reunião","atividades_default":[{"codigo":"CIVIL-DRYWALL","qtd":null}]}]},
  {"disciplina_slug":"pintura","nome":"Pintura","peso_fisico":8,"peso_financeiro":4,"ambientes":[
    {"codigo":"RECEPCAO","label":"Recepção","atividades_default":[{"codigo":"PINT-PAREDE-ACRIL","qtd":null},{"codigo":"PINT-TETO","qtd":null}]}]}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'corporativo-padrao');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, segmento, frentes_json)
SELECT NULL, 'reforma', 'clinicas-padrao', 'Clínicas Padrão', true, 13, 'clinicas', $json$[
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":13,"peso_financeiro":14,"ambientes":[
    {"codigo":"CONSULTORIO","label":"Consultório","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null},{"codigo":"ELET-ILUM-LED","qtd":null}]},
    {"codigo":"RECEPCAO","label":"Recepção","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]}]},
  {"disciplina_slug":"hidraulica","nome":"Hidráulica","peso_fisico":10,"peso_financeiro":11,"ambientes":[
    {"codigo":"ESTERILIZACAO","label":"Esterilização","atividades_default":[
      {"codigo":"HIDR-PONTO-AGUA","qtd":null},{"codigo":"HIDR-PONTO-ESGOTO","qtd":null}]}]},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":12,"peso_financeiro":12,"ambientes":[
    {"codigo":"SALA_PROCEDIMENTO","label":"Sala de procedimento","atividades_default":[
      {"codigo":"REVEST-PISO-PORC","qtd":null},{"codigo":"REVEST-PAREDE-AZUL","qtd":null}]}]}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'clinicas-padrao');

INSERT INTO public.hub_eap_presets (tenant_id, tipo_obra, slug, nome, sistema, ordem, segmento, frentes_json)
SELECT NULL, 'servico', 'pdv-padrao', 'PDV Padrão', true, 14, 'pdv', $json$[
  {"disciplina_slug":"eletrica","nome":"Elétrica","peso_fisico":16,"peso_financeiro":16,"ambientes":[
    {"codigo":"FRENTE_LOJA","label":"Frente de loja","atividades_default":[
      {"codigo":"ELET-ILUM-LED","qtd":null},{"codigo":"ELET-TOMADA-110","qtd":null}]},
    {"codigo":"CHECKOUT","label":"Checkout","atividades_default":[
      {"codigo":"ELET-TOMADA-110","qtd":null},{"codigo":"ELET-DADOS-VOZ","qtd":null}]}]},
  {"disciplina_slug":"revestimento","nome":"Revestimento","peso_fisico":12,"peso_financeiro":12,"ambientes":[
    {"codigo":"EXPOSICAO","label":"Área de exposição","atividades_default":[{"codigo":"REVEST-PISO-PORC","qtd":null}]}]}
]$json$::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug = 'pdv-padrao');

-- ============================================================================
-- ROLLBACK (se necessário):
--   ALTER TABLE public.hub_obra_itens DROP COLUMN IF EXISTS taxonomia_id;   -- antes da tabela (FK)
--   ALTER TABLE public.hub_obra_itens DROP COLUMN IF EXISTS ambiente;
--   DROP INDEX IF EXISTS public.idx_hub_obra_itens_ambiente;
--   ALTER TABLE public.hub_obra_frentes_eap DROP CONSTRAINT IF EXISTS hub_obra_frentes_eap_tipo_no_check;
--   ALTER TABLE public.hub_obra_frentes_eap DROP COLUMN IF EXISTS tipo_no;
--   ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_segmento_check;
--   ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS segmento;
--   DELETE FROM public.hub_eap_presets WHERE tenant_id IS NULL AND slug IN
--     ('residencial-padrao','comercial-padrao','corporativo-padrao','clinicas-padrao','pdv-padrao');
--   ALTER TABLE public.hub_eap_presets DROP COLUMN IF EXISTS segmento;
--   DROP TABLE IF EXISTS public.hub_obra_taxonomia;   -- por último (FK já removida acima)
--   (hub_obras, hub_obra_itens, hub_obra_frentes_eap, hub_eap_presets permanecem; só perdem o aditivo.)
-- ============================================================================


-- ==== ARQUIVO: 20260712120000_e3_obra_restricoes.sql ====
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


-- ==== ARQUIVO: 20260720120000_e5_compras_estoque.sql ====
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


-- ==== ARQUIVO: 20260730120000_e6_financeiro_contrato_escrow.sql ====
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
-- FIX 02/jul: hub_aprovacoes nasceu SEM tenant_id no schema real. O escrow (Gate 2 duplo) filtra
-- as aprovações por tenant nas RPCs (rpc_liberar_escrow) → a coluna é obrigatória. Aditiva, nullable,
-- sem backfill — MESMO padrão do E7 p/ hub_decision_logs. Escrow segue dormente até o fix #5.
ALTER TABLE public.hub_aprovacoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE SET NULL;
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


-- ==== ARQUIVO: 20260815120000_e7_item_escopo_unificado.sql ====
-- ============================================================================
-- E7 — ITEM DE ESCOPO UNIFICADO (custo no item-mãe + BDI 3 camadas + peso derivado) — BLOCO E7
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - SÓ `ALTER ... ADD COLUMN` (nullable / DEFAULT que preserva o legado). NENHUM DROP,
--         NENHUMA tabela nova, ZERO toque destrutivo em E0/E2/E0b/E5/E6.
--       - 2 colunas GENERATED em hub_obra_itens (custo_unitario, custo_total) — transparência
--         auditável (as zonas K-O da planilha do dono): a conta é do banco, não "aparece pronta".
--       - 1 fator de BDI por empresa (hub_obras.bdi_fator DEFAULT 1.0 = neutro) + override por item.
--       - 2 VIEWS security_invoker=true (igual E2/E5/E6) — a leitura respeita a RLS de quem consulta;
--         os endpoints AINDA filtram tenant explícito (precedente do vazamento 28/jun — não regredir).
--       - tenant_id em hub_decision_logs (log de decisão de DINHEIRO não pode ficar fora do tenant).
--     Até aplicar, a UI/endpoint degrada (isMissingPgColumn → migracao_pendente=true + fallback in-code).
--
-- DECISÕES TRAVADAS pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9):
--   #1 hub_obra_itens = o ÚNICO item de escopo (carrega custo+preço+avanço+datas). O orçamento (E6)
--      é a versão/proposta 1:1 do mesmo item. Aqui o item-mãe ganha as colunas de CUSTO.
--   #3 BDI = fator único por empresa (hub_obras.bdi_fator), override por item (hub_obra_itens.bdi_fator).
--      Composição (admin/lucro/risco/tributos) = futuro. Leitura aplica 3 camadas: item → obra → 1.0.
--   #4 Avanço/medição = POR ITEM (peso+pct_avanco já em E2). Ambiente = AGREGAÇÃO ponderada bottom-up
--      (vw_hub_obra_item_peso, só itens-raiz, normaliza o peso financeiro p/ somar avanço por ambiente).
--
-- ⚠️  ATENÇÃO POSTGRES (não quebrar a migração): uma coluna GENERATED STORED NÃO pode referenciar
--     outra GENERATED STORED na mesma linha. Por isso `custo_total` REPETE a soma inline
--     (locacao+material+mo) × quantidade — NÃO faz `custo_unitario * quantidade`. Se o próximo dev
--     "otimizar" para custo_unitario*quantidade, o CREATE/ALTER falha. Mantenha a soma inline.
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): multitenant(20260626130000) → E0(20260705130000) →
--     A0 → E2(20260710120000) → E0b(20260711120000) → E5(20260720120000) → E6(20260730120000) →
--     [E4 20260810120000, futuro] → E7 (ESTE, 20260815120000). E7 NÃO depende de E4.
--     (Existe um segundo "E7 Medição" em 20260820120000 — arquivo/tabelas distintos; este é ANTERIOR.)
--
-- ROLLBACK no fim do arquivo (DROP COLUMN / DROP VIEW — reversível por completo).
-- ============================================================================

-- ─── 1) hub_obra_itens — CUSTO no item-mãe (E2 = a verdade do escopo contratado) ──
-- Separa o que E6 escondia em `custo_outros`: locação/frete · material · mão de obra (cols K-M da
-- planilha do dono). Todos NULLABLE (o legado e o item sem custo continuam válidos → soma trata NULL=0).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_locacao_frete NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS custo_material      NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS custo_mao_obra      NUMERIC(14,2),
  -- BDI override por item: NULL = herda de hub_obras.bdi_fator (3 camadas na leitura: item→obra→1.0).
  ADD COLUMN IF NOT EXISTS bdi_fator           NUMERIC(6,4);

-- custo_unitario = soma das 3 parcelas de custo (NULL conta como 0). GENERATED STORED, auditável.
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_unitario NUMERIC(14,2)
  GENERATED ALWAYS AS (
    COALESCE(custo_locacao_frete, 0) + COALESCE(custo_material, 0) + COALESCE(custo_mao_obra, 0)
  ) STORED;

-- custo_total = custo_unitario × quantidade. ATENÇÃO: GENERATED não encadeia GENERATED (ver header) —
-- REPETIMOS a soma inline, NÃO `custo_unitario * quantidade`. quantidade NULL → custo_total NULL
-- (o item sem quantidade não tem custo total; a UI mostra "—", nunca 0 enganoso).
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS custo_total NUMERIC(14,2)
  GENERATED ALWAYS AS (
    ROUND(
      (COALESCE(custo_locacao_frete, 0) + COALESCE(custo_material, 0) + COALESCE(custo_mao_obra, 0))
      * quantidade,
      2
    )
  ) STORED;

COMMENT ON COLUMN public.hub_obra_itens.custo_unitario IS
  'E7 GENERATED: soma inline (locacao_frete+material+mao_obra), NULL=0. NÃO referencia outra GENERATED.';
COMMENT ON COLUMN public.hub_obra_itens.custo_total IS
  'E7 GENERATED: soma inline × quantidade (NÃO custo_unitario*quantidade — PG não encadeia GENERATED).';
COMMENT ON COLUMN public.hub_obra_itens.bdi_fator IS
  'E7: override de BDI por item. NULL = herda hub_obras.bdi_fator. Leitura: item ?? obra ?? 1.0.';

-- ─── 2) hub_obras — BDI único por empresa/obra (1 número; a empresa que usa 1.06 seta 1.06) ──
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS bdi_fator NUMERIC(6,4) NOT NULL DEFAULT 1.0;
COMMENT ON COLUMN public.hub_obras.bdi_fator IS
  'E7: fator único de BDI da obra (DEFAULT 1.0 = neutro/preserva legado). preço = custo × BDI × qtd. '
  'Override por item em hub_obra_itens.bdi_fator. Composição (admin/lucro/risco/tributos) = futuro.';

-- ─── 3) hub_decision_logs — tenant_id (SEGURANÇA: log de dinheiro nunca órfão) ─────
-- A tabela legada (20260523170000) nasceu SEM tenant_id. lib/ia/aprovacoes.ts grava o tenant da
-- sessão no log de aprovação/rejeição (que move escrow). Sem esta coluna o log fica fora do tenant.
-- Aditivo, nullable (não exige backfill; o código tolera a ausência via isMissingPgColumn).
ALTER TABLE public.hub_decision_logs
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hub_decision_logs_tenant
  ON public.hub_decision_logs (tenant_id);
COMMENT ON COLUMN public.hub_decision_logs.tenant_id IS
  'E7: tenant da decisão (escopo de auditoria). Gravado por lib/ia/aprovacoes.ts. Nullable (legado).';

-- ─── 4) VIEW vw_hub_obra_item_margem — custo × preço × margem por item (security_invoker) ──
-- O PREÇO sai por FÓRMULA VISÍVEL (custo × BDI × qtd) com BDI de 3 camadas (item → obra → 1.0).
-- margem_pct = (preço − custo) / preço. NULL quando não há preço (sem custo) → UI mostra "—", nunca NaN.
-- security_invoker=true → respeita a RLS de quem consulta; o endpoint AINDA filtra tenant explícito.
CREATE OR REPLACE VIEW public.vw_hub_obra_item_margem
  WITH (security_invoker = true) AS
SELECT
  i.id              AS item_id,
  i.obra_id,
  i.tenant_id,
  i.parent_id,
  i.codigo,
  i.nome,
  i.disciplina_slug,
  i.ambiente,
  i.quantidade,
  i.custo_unitario,
  i.custo_total,
  -- BDI efetivo (3 camadas): override do item, senão da obra, senão 1.0 (neutro).
  COALESCE(i.bdi_fator, o.bdi_fator, 1.0)                                          AS bdi_efetivo,
  -- Preço = custo × BDI (unitário e total). custo NULL→0; total respeita quantidade (NULL→NULL).
  ROUND(i.custo_unitario * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2)             AS preco_unitario,
  CASE WHEN i.custo_total IS NULL THEN NULL
       ELSE ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2)
  END                                                                              AS preco_total,
  -- margem_pct sobre o preço (markup honesto). NULL quando preço<=0 (sem custo) → "—" na UI.
  CASE
    WHEN i.custo_total IS NULL THEN NULL
    WHEN ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2) > 0
      THEN ROUND(
        (i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0) - i.custo_total)
        / (i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0)) * 100, 2)
    ELSE NULL
  END                                                                              AS margem_pct
FROM public.hub_obra_itens i
JOIN public.hub_obras o ON o.id = i.obra_id
WHERE i.ativo = true;

GRANT SELECT ON public.vw_hub_obra_item_margem TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_item_margem IS
  'E7: custo × preço × margem por item. Preço = custo × BDI (3 camadas: item→obra→1.0), fórmula VISÍVEL. '
  'margem_pct NULL sem preço (UI mostra —). security_invoker=true; endpoint ainda filtra tenant.';

-- ─── 5) VIEW vw_hub_obra_item_peso — peso financeiro normalizado (só itens-raiz) ──
-- DECISÃO #4: avanço é controlado POR ITEM (peso+pct_avanco em E2), exibido por item E por AMBIENTE.
-- O ambiente é AGREGAÇÃO ponderada bottom-up: precisa do peso financeiro de cada item-raiz normalizado
-- (Σ pesos da obra = 1). CUIDADO mapeado: só `parent_id IS NULL` — somar pai + subitem contaria o
-- valor em dobro. Base de peso = preço_total (custo × BDI); sem custo, peso=0 (degrada p/ média simples
-- na ausência de custo, exatamente como o design previu).
CREATE OR REPLACE VIEW public.vw_hub_obra_item_peso
  WITH (security_invoker = true) AS
WITH raiz AS (
  SELECT
    i.id              AS item_id,
    i.obra_id,
    i.tenant_id,
    i.ambiente,
    i.disciplina_slug,
    i.pct_avanco,
    -- valor de ponderação = preço_total do item (custo × BDI efetivo). NULL/sem custo → 0.
    COALESCE(
      ROUND(i.custo_total * COALESCE(i.bdi_fator, o.bdi_fator, 1.0), 2),
      0
    )                 AS valor_peso
  FROM public.hub_obra_itens i
  JOIN public.hub_obras o ON o.id = i.obra_id
  WHERE i.ativo = true AND i.parent_id IS NULL      -- SÓ RAIZ (não conta pai + subitem em dobro)
),
tot AS (
  SELECT obra_id, SUM(valor_peso) AS total_obra
  FROM raiz GROUP BY obra_id
)
SELECT
  r.item_id,
  r.obra_id,
  r.tenant_id,
  r.ambiente,
  r.disciplina_slug,
  r.pct_avanco,
  r.valor_peso,
  t.total_obra,
  -- peso financeiro normalizado (Σ na obra = 1 quando há custo). total 0 → peso NULL (UI: média simples).
  CASE WHEN COALESCE(t.total_obra, 0) > 0
       THEN ROUND(r.valor_peso / t.total_obra, 6)
       ELSE NULL
  END                                               AS peso_financeiro
FROM raiz r
LEFT JOIN tot t ON t.obra_id = r.obra_id;

GRANT SELECT ON public.vw_hub_obra_item_peso TO authenticated, service_role;

COMMENT ON VIEW public.vw_hub_obra_item_peso IS
  'E7: peso financeiro normalizado por item-RAIZ (parent_id IS NULL; nunca conta pai+subitem em dobro). '
  'Base p/ AGREGAÇÃO de avanço por ambiente (decisão #4). total 0 → peso NULL (degrada p/ média simples).';

-- ============================================================================
-- ROLLBACK (reversível por completo — só remove o que E7 adicionou):
--   DROP VIEW IF EXISTS public.vw_hub_obra_item_peso;
--   DROP VIEW IF EXISTS public.vw_hub_obra_item_margem;
--   ALTER TABLE public.hub_obra_itens
--     DROP COLUMN IF EXISTS custo_total,
--     DROP COLUMN IF EXISTS custo_unitario,
--     DROP COLUMN IF EXISTS bdi_fator,
--     DROP COLUMN IF EXISTS custo_mao_obra,
--     DROP COLUMN IF EXISTS custo_material,
--     DROP COLUMN IF EXISTS custo_locacao_frete;
--   ALTER TABLE public.hub_obras DROP COLUMN IF EXISTS bdi_fator;
--   DROP INDEX IF EXISTS public.idx_hub_decision_logs_tenant;
--   ALTER TABLE public.hub_decision_logs DROP COLUMN IF EXISTS tenant_id;
--   (E0/E2/E0b/E5/E6 e as colunas existentes permanecem INTACTOS — E7 nunca os destrói.)
-- ============================================================================


-- ==== ARQUIVO: 20260816120000_e7b_status_escopo_e_aprovar.sql ====
-- ============================================================================
-- E7b — STATUS_ESCOPO (tipo + 'aditivo_potencial') + APROVAR ORÇAMENTO COPIA CUSTO — BLOCO E7b
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - SÓ estende o CHECK de hub_obra_itens.tipo (DROP+ADD preservando TODOS os valores atuais).
--         NENHUMA coluna nova, NENHUMA tabela nova nesta migração.
--       - 1 RPC SECURITY DEFINER + REVOKE public/anon + GUARD de tenant ANTES de qualquer mutação —
--         igual rpc_aprovar_orcamento_frente / rpc_liberar_escrow (E6). Idempotente.
--       - Depende de E6 (hub_obra_orcamento_itens) e de E7 (colunas de custo em hub_obra_itens).
--         Se aplicada antes de E7, o UPDATE de custo no item-mãe falha — por isso o timestamp 20260816
--         vem DEPOIS de E7 (20260815). A ordem cronológica do diretório garante o apply correto.
--     Até aplicar, o endpoint/UI degrada (isMissingPgColumn → migracao_pendente=true + fallback in-code).
--
-- DECISÕES TRAVADAS pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9):
--   #1 hub_obra_itens = o ÚNICO item de escopo (a verdade do contratado); o orçamento (E6) é a versão.
--      Ao APROVAR o orçamento de uma frente, o snapshot de custo da versão aprovada COPIA para o
--      item-mãe — NO ENDPOINT/RPC, NUNCA em trigger (triggers escondem magia; padrão do projeto §3).
--   #2 status_escopo = REUSAR o `tipo` que já existe em E2 (contrato/aditivo/servico_extra), estendendo
--      o CHECK com 'aditivo_potencial' = o catálogo ZERADO por ambiente×disciplina (item pré-listado mas
--      colapsado, quantidade 0; vira aditivo de verdade quando o humano liga a quantidade na obra).
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): … E6(20260730120000) → E7(20260815120000) → E7b (ESTE,
--     20260816120000). E7b NÃO depende de E4.
--
-- ROLLBACK no fim do arquivo (reversível por completo).
-- ============================================================================

-- ─── 1) hub_obra_itens.tipo — ESTENDER o CHECK (status_escopo, decisão #2) ─────
-- O CHECK atual (E2, 20260710120000) é IN ('contrato','aditivo','servico_extra'). DROP+ADD preservando
-- os 3 originais e acrescentando 'aditivo_potencial' (catálogo zerado). DEFAULT 'contrato' permanece.
-- Nenhum dado existente viola o novo CHECK (é superconjunto) — ALTER seguro, sem reescrever linhas.
ALTER TABLE public.hub_obra_itens DROP CONSTRAINT IF EXISTS hub_obra_itens_tipo_check;
ALTER TABLE public.hub_obra_itens ADD CONSTRAINT hub_obra_itens_tipo_check
  CHECK (tipo IN ('contrato','aditivo','servico_extra','aditivo_potencial'));

COMMENT ON COLUMN public.hub_obra_itens.tipo IS
  'E7b status_escopo (decisão #2): contrato (contratado) · aditivo (aditivo contratado) · '
  'servico_extra · aditivo_potencial (catálogo ZERADO por ambiente×disciplina, pré-listado colapsado; '
  'vira aditivo quando o humano liga a quantidade — gera card de disparidade, não edição silenciosa).';

-- ─── 2) RPC rpc_snapshot_custo_frente — SNAPSHOT de custo p/ o item-mãe (decisão #1) ──
-- NOME PRÓPRIO (não "aprovar") DE PROPÓSITO: a E6 já define rpc_aprovar_orcamento_frente(uuid,uuid,uuid)
-- e o Postgres distingue sobrecarga por TIPOS (não por nome de parâmetro) — um CREATE OR REPLACE com a
-- MESMA assinatura (3×uuid) SUBSTITUIRIA a função de E6 (que aprova + libera pagamento). Esta função é
-- SEPARADA e faz SÓ o snapshot de custo. Fluxo: a aprovação chama a rpc_aprovar_orcamento_frente de E6
-- (aprova + libera) e DEPOIS esta (copia o custo já aprovado ao item-mãe). Wiring no código = Fase 3.
--
-- COPIA o custo dos hub_obra_orcamento_itens JÁ APROVADOS da frente para o hub_obra_itens (via item_id).
-- Idempotente (re-rodar reescreve o mesmo snapshot). GUARD de tenant explícito (SECURITY DEFINER bypassa RLS).
-- Mapa de esquema E6→E7: E6 tem custo_material/custo_mao_obra/custo_outros (E6 L124-126); custo_outros
-- carrega locação/frete (design §1 col K) → custo_locacao_frete; bdi_fator NÃO é copiado (item herda
-- hub_obras.bdi_fator — 3 camadas na leitura).
CREATE OR REPLACE FUNCTION public.rpc_snapshot_custo_frente(
  p_obra_id   uuid,
  p_frente_id uuid,
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_obra_tenant uuid;
  v_copiados    int := 0;
BEGIN
  -- GUARD tenant explícito: a obra tem de ser do tenant do caller (404 lógico, sem mutar).
  SELECT tenant_id INTO v_obra_tenant
    FROM public.hub_obras
    WHERE id = p_obra_id;
  IF v_obra_tenant IS NULL OR v_obra_tenant <> p_tenant_id THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'obra_nao_encontrada');
  END IF;

  -- SNAPSHOT: para cada item-mãe ligado a uma linha de orçamento JÁ APROVADO da frente, copia o custo.
  -- A APROVAÇÃO em si (status='aprovado' + liberar pagamento) é da rpc_aprovar_orcamento_frente de E6;
  -- esta função roda DEPOIS e só LÊ o que já está aprovado. p_frente_id NULL = todas as frentes.
  WITH agregado AS (
    SELECT
      oi.item_id,
      SUM(COALESCE(oi.custo_material, 0))  AS material,
      SUM(COALESCE(oi.custo_mao_obra, 0))  AS mao_obra,
      SUM(COALESCE(oi.custo_outros, 0))    AS locacao_frete
    FROM public.hub_obra_orcamento_itens oi
    JOIN public.hub_obra_orcamentos o ON o.id = oi.orcamento_id
    WHERE oi.obra_id = p_obra_id
      AND oi.tenant_id = p_tenant_id
      AND oi.item_id IS NOT NULL
      AND o.status = 'aprovado'
      AND (p_frente_id IS NULL OR o.frente_id = p_frente_id)
    GROUP BY oi.item_id
  )
  UPDATE public.hub_obra_itens i
    SET custo_locacao_frete = a.locacao_frete,
        custo_material      = a.material,
        custo_mao_obra      = a.mao_obra
    FROM agregado a
    WHERE i.id = a.item_id
      AND i.obra_id = p_obra_id
      AND i.tenant_id = p_tenant_id;
  GET DIAGNOSTICS v_copiados = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'itens_custo_copiado', v_copiados);
END $$;
REVOKE ALL ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) TO authenticated, service_role;

-- SEM COLISÃO: nome próprio `rpc_snapshot_custo_frente` ≠ `rpc_aprovar_orcamento_frente` (E6). A função
-- de E6 (aprova + libera pagamento) fica INTACTA. O fluxo de aprovação chama a de E6 e DEPOIS esta para
-- materializar o custo no item-mãe. O wiring (chamar esta após a aprovação) entra no código na Fase 3.

COMMENT ON FUNCTION public.rpc_snapshot_custo_frente(uuid, uuid, uuid) IS
  'E7b (decisão #1): copia o snapshot de custo (E6 custo_material/mao_obra/outros) dos orçamentos '
  'APROVADOS da frente para o item-mãe E7 (hub_obra_itens). NÃO aprova (isso é da '
  'rpc_aprovar_orcamento_frente de E6) — roda DEPOIS dela. Guard tenant (SECURITY DEFINER). Idempotente.';

-- ============================================================================
-- ROLLBACK (reversível por completo — só remove/reverte o que E7b adicionou):
--   -- 1) reverter o CHECK de tipo ao conjunto E2 (só se nenhum item usa 'aditivo_potencial'):
--   --   ALTER TABLE public.hub_obra_itens DROP CONSTRAINT IF EXISTS hub_obra_itens_tipo_check;
--   --   ALTER TABLE public.hub_obra_itens ADD CONSTRAINT hub_obra_itens_tipo_check
--   --     CHECK (tipo IN ('contrato','aditivo','servico_extra'));
--   -- 2) remover só a função NOVA de snapshot (a rpc_aprovar_orcamento_frente de E6 NÃO é tocada):
--   --   DROP FUNCTION IF EXISTS public.rpc_snapshot_custo_frente(uuid, uuid, uuid);
--   (E0/E2/E0b/E5/E6/E7 e as colunas/constraints existentes permanecem INTACTOS — E7b nunca os destrói.)
-- ============================================================================


-- ==== ARQUIVO: 20260817120000_e7c_medicao.sql ====
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


-- ==== ARQUIVO: 20260818120000_sec_rls_e5_anon.sql ====
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


-- ==== ARQUIVO: 20260819120000_aut7_drop_idx_taxonomia_tenant_redundante.sql ====
-- ============================================================================
-- AUT-7 — DROP do índice redundante `idx_taxonomia_tenant` (custo de escrita à toa)
--         (higiene da EAP/taxonomia — sem mudança de comportamento)
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA-NEGATIVA (só remove um índice redundante), REVERSÍVEL e segura.
--
-- POR QUE É REDUNDANTE:
--   A tabela hub_obra_taxonomia (criada em 20260711120000_e0b_taxonomia_ambiente_segmento.sql)
--   já tem a constraint UNIQUE:
--       hub_obra_taxonomia_codigo_uniq UNIQUE NULLS NOT DISTINCT (tenant_id, codigo)
--   que cria um índice B-tree implícito com PREFIXO = tenant_id. Qualquer consulta que
--   filtra/ordena por `tenant_id` (ou por `tenant_id, codigo`) já é servida por esse índice
--   do UNIQUE. O índice EXTRA `idx_taxonomia_tenant (tenant_id)` é, portanto, redundante:
--   só duplica trabalho em todo INSERT/UPDATE (mais um índice a manter) sem ganho de leitura.
--
--   (Os outros índices da tabela NÃO são afetados e permanecem:
--      - idx_taxonomia_disc (disciplina_slug, ativo, ordem) — leitura por disciplina;
--      - idx_taxonomia_fts (GIN to_tsvector) — busca textual da IA;
--      - idx_taxonomia_sin (GIN sinonimos) — busca por sinônimo;
--      - o índice implícito do UNIQUE (tenant_id, codigo) — cobre o filtro por tenant.)
--
-- ⚠️  ORDEM DE APPLY: depende de 20260711120000 (E0.5) já ter criado a tabela/índice.
--     O timestamp deste arquivo (20260819120000) garante que roda DEPOIS.
--     Idempotente: DROP INDEX IF EXISTS — se o índice já não existir, não falha.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_taxonomia_tenant;

-- ============================================================================
-- ROLLBACK (se necessário — recria o índice exatamente como em 20260711120000):
--   CREATE INDEX IF NOT EXISTS idx_taxonomia_tenant
--     ON public.hub_obra_taxonomia (tenant_id);
-- ============================================================================


-- ==== ARQUIVO: 20260820120000_e4_curva_s.sql ====
-- ============================================================================
-- E4 — CRONOGRAMA + CURVA-S (pendura no PESO do item de escopo) — BLOCO E4
--
-- ⚠️  NÃO aplicar — janela do dono.
--     100% ADITIVA, REVERSÍVEL e fiel ao padrão do projeto:
--       - 3 tabelas NOVAS. NENHUM DROP/ALTER em E0/E2/E0b/E5/E6/E7/E7b/E7c.
--       - hub_obra_curva_baseline (a LINHA-BASE: início/fim, 1 vigente por obra) +
--         hub_obra_curva_pontos (a CURVA PLANEJADA por semana: planejado_pct_fisico/financeiro).
--       - hub_obra_avanco_diario = APPEND-ONLY (a CURVA EXECUTADA, snapshot): GRANT só SELECT,
--         INSERT (SEM UPDATE/DELETE p/ authenticated/service_role). "NADA SE PERDE": o avanço
--         medido não se apaga nem se reescreve — corrige-se com um NOVO snapshot (igual ao extrato
--         de escrow de E6 e à medição de E7c). A verdade é o histórico completo.
--       - RLS via current_user_tenant_id() (igual E0/E2/E3/E5/E6/E7c); tenant_id NOT NULL.
--     Até aplicar, o endpoint /api/crm/obras/[id]/cronograma DEGRADA: sem baseline → calcula o
--     PLANEJADO linear (início→fim da obra) e o EXECUTADO a partir do avanço ponderado dos itens
--     (lib/obras/escopo.ts → avancoPonderado), responde migracao_pendente=true. O avanço já funciona.
--
-- DECISÃO TRAVADA pelo dono (29/jun — ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md §9 #4):
--   Avanço/medição = POR ITEM (peso financeiro + pct_avanco do item, E2). A CURVA-S "pendura no
--   PESO derivado" (design §7 Fase 4): pct_fisico = avanço ponderado pelo peso; pct_financeiro =
--   peso financeiro acumulado. Os DOIS são SEPARADOS (físico = obra; financeiro = desembolso).
--   Sem E4 aplicado, degrada para "avanço-só" (físico = financeiro, ambos do avanço ponderado).
--
-- ⚠️  ORDEM DE APPLY (timestamps já garantem): … E6(20260730120000) → E7(20260815120000) →
--     E7b(20260816120000) → E7c(20260817120000) → E4 (ESTE, 20260820120000). E4 depende SÓ de
--     hub_obras (FK) e LÊ hub_obra_itens (E2) via endpoint — NÃO depende de E7/E7b/E7c no schema.
--     (O design diz "E4 não depende de E7"; aqui o timestamp é posterior só por ser escrito depois.)
--
-- ROLLBACK no fim do arquivo (DROP TABLE das 3 — só elas, aditivas).
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

-- ─── 1) hub_obra_curva_baseline (NOVA) — a LINHA-BASE do cronograma da obra ────
-- 1 baseline VIGENTE por obra (vigente=true). Replanejou? Insere outra e marca a antiga
-- vigente=false (mantém o histórico de baselines — auditável). data_inicio/data_fim definem o
-- horizonte da curva PLANEJADA; total_pontos é só desnormalização p/ leitura rápida.
CREATE TABLE IF NOT EXISTS public.hub_obra_curva_baseline (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  data_inicio   DATE NOT NULL,
  data_fim      DATE NOT NULL,
  -- true = é a baseline em uso (a curva planejada vem dos pontos dela). Só 1 por obra (índice parcial).
  vigente       BOOLEAN NOT NULL DEFAULT true,
  total_pontos  INTEGER NOT NULL DEFAULT 0,
  observacao    TEXT,
  criada_por    TEXT,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (data_fim >= data_inicio)
);

-- Só UMA baseline vigente por obra (índice único parcial; replanejar = desligar a antiga primeiro).
CREATE UNIQUE INDEX IF NOT EXISTS uq_hub_obra_curva_baseline_vigente
  ON public.hub_obra_curva_baseline (obra_id) WHERE vigente = true;
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_baseline_obra
  ON public.hub_obra_curva_baseline (obra_id, vigente);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_baseline_tenant
  ON public.hub_obra_curva_baseline (tenant_id);

ALTER TABLE public.hub_obra_curva_baseline ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_curva_baseline_rls ON public.hub_obra_curva_baseline;
CREATE POLICY hub_obra_curva_baseline_rls ON public.hub_obra_curva_baseline FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
-- Baseline é editável (replanejar é um ato de gestão, não fraude): mantém UPDATE/DELETE. O que é
-- APPEND-ONLY é o avanço executado (a verdade do que aconteceu), não o plano.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_curva_baseline TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_curva_baseline IS
  'E4: linha-base do cronograma por obra (início/fim, 1 vigente). A curva PLANEJADA vem dos pontos. '
  'Replanejar = nova baseline vigente=true + antiga vigente=false (histórico preservado).';

-- ─── 2) hub_obra_curva_pontos (NOVA) — a CURVA PLANEJADA (por semana/data) ─────
-- Cada ponto = um marco temporal com o % planejado FÍSICO e FINANCEIRO acumulado (0..100).
-- Físico e financeiro SEPARADOS (decisão #4): a obra pode adiantar o físico e atrasar o desembolso
-- (ou vice-versa). semana é o índice (0,1,2…) e data o eixo X legível.
CREATE TABLE IF NOT EXISTS public.hub_obra_curva_pontos (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id              UUID NOT NULL REFERENCES public.hub_obra_curva_baseline(id) ON DELETE CASCADE,
  obra_id                  UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id                UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  semana                   INTEGER NOT NULL,           -- 0,1,2… (eixo X ordinal)
  data                     DATE NOT NULL,              -- eixo X legível (fim da semana)
  planejado_pct_fisico     NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planejado_pct_fisico BETWEEN 0 AND 100),
  planejado_pct_financeiro NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (planejado_pct_financeiro BETWEEN 0 AND 100),
  criado_em                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (baseline_id, semana)
);

CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_baseline
  ON public.hub_obra_curva_pontos (baseline_id, semana);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_obra
  ON public.hub_obra_curva_pontos (obra_id, data);
CREATE INDEX IF NOT EXISTS idx_hub_obra_curva_pontos_tenant
  ON public.hub_obra_curva_pontos (tenant_id);

ALTER TABLE public.hub_obra_curva_pontos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_curva_pontos_rls ON public.hub_obra_curva_pontos;
CREATE POLICY hub_obra_curva_pontos_rls ON public.hub_obra_curva_pontos FOR ALL TO authenticated
  USING (tenant_id = current_user_tenant_id())
  WITH CHECK (tenant_id = current_user_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_obra_curva_pontos TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_curva_pontos IS
  'E4: a curva PLANEJADA (pontos por semana). planejado_pct_fisico e _financeiro SEPARADOS '
  '(decisão #4: físico = avanço da obra; financeiro = desembolso). Vinculados à baseline vigente.';

-- ─── 3) hub_obra_avanco_diario (NOVA) — a CURVA EXECUTADA, APPEND-ONLY ─────────
-- Cada linha é um SNAPSHOT imutável do avanço REAL num dia: pct_fisico (avanço ponderado por peso)
-- e pct_financeiro (peso financeiro medido/realizado). "NADA SE PERDE": sem UPDATE/DELETE —
-- corrigir = novo snapshot. O endpoint usa o ÚLTIMO snapshot por data p/ desenhar a curva executada;
-- sem nenhum snapshot, calcula o executado AO VIVO do avanço ponderado dos itens (degrade honesto).
CREATE TABLE IF NOT EXISTS public.hub_obra_avanco_diario (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.hub_tenants(id) ON DELETE CASCADE,
  data            DATE NOT NULL DEFAULT CURRENT_DATE,
  -- pct FÍSICO acumulado (avanço ponderado pelo peso financeiro dos itens-raiz). 0..100.
  pct_fisico      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_fisico BETWEEN 0 AND 100),
  -- pct FINANCEIRO acumulado (peso financeiro realizado/medido). 0..100. Pode divergir do físico.
  pct_financeiro  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (pct_financeiro BETWEEN 0 AND 100),
  origem          TEXT NOT NULL DEFAULT 'sistema'
                  CHECK (origem IN ('sistema','manual','medicao','ia')),
  observacao      TEXT,
  criado_por      TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Histórico por obra em ordem de data/registro (a "nada se perde" navegável + leitura da curva).
CREATE INDEX IF NOT EXISTS idx_hub_obra_avanco_diario_obra
  ON public.hub_obra_avanco_diario (obra_id, data, criado_em);
CREATE INDEX IF NOT EXISTS idx_hub_obra_avanco_diario_tenant
  ON public.hub_obra_avanco_diario (tenant_id);

ALTER TABLE public.hub_obra_avanco_diario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS hub_obra_avanco_diario_rls ON public.hub_obra_avanco_diario;
-- FIX 02/jul: dropar os nomes REAIS antes de criar (idempotente — a tabela já existe de sessão anterior).
DROP POLICY IF EXISTS hub_obra_avanco_diario_select ON public.hub_obra_avanco_diario;
DROP POLICY IF EXISTS hub_obra_avanco_diario_insert ON public.hub_obra_avanco_diario;
-- APPEND-ONLY na própria policy: FOR SELECT e FOR INSERT (sem UPDATE/DELETE). Mesmo um tenant
-- legítimo NÃO altera/apaga um snapshot da sua obra — só insere outro. (espelha E7c e o escrow.)
CREATE POLICY hub_obra_avanco_diario_select ON public.hub_obra_avanco_diario FOR SELECT TO authenticated
  USING (tenant_id = current_user_tenant_id());
CREATE POLICY hub_obra_avanco_diario_insert ON public.hub_obra_avanco_diario FOR INSERT TO authenticated
  WITH CHECK (tenant_id = current_user_tenant_id());

-- GRANT append-only: SELECT + INSERT, NUNCA UPDATE/DELETE (nem p/ service_role — a verdade é o
-- histórico completo; corrigir = novo snapshot). É a trava física do "nada se perde".
GRANT SELECT, INSERT ON public.hub_obra_avanco_diario TO authenticated, service_role;

COMMENT ON TABLE public.hub_obra_avanco_diario IS
  'E4 (decisão #4): curva EXECUTADA — snapshot APPEND-ONLY do avanço real por dia. pct_fisico '
  '(avanço ponderado por peso) e pct_financeiro (peso financeiro realizado) SEPARADOS. NADA SE '
  'PERDE: sem UPDATE/DELETE — corrige-se com novo snapshot. Sem snapshots, o endpoint calcula ao vivo.';
COMMENT ON COLUMN public.hub_obra_avanco_diario.pct_fisico IS
  'Avanço físico acumulado ponderado pelo peso financeiro dos itens-raiz (espelha avancoPonderado).';
COMMENT ON COLUMN public.hub_obra_avanco_diario.pct_financeiro IS
  'Avanço financeiro acumulado (peso financeiro medido/realizado). Pode divergir do físico.';

-- ============================================================================
-- ROLLBACK (reversível por completo — remove só as 3 tabelas NOVAS que E4 adicionou):
--   DROP TABLE IF EXISTS public.hub_obra_avanco_diario;
--   DROP TABLE IF EXISTS public.hub_obra_curva_pontos;     -- CASCADE da FK p/ baseline
--   DROP TABLE IF EXISTS public.hub_obra_curva_baseline;
--   (E0/E2/E0b/E5/E6/E7/E7b/E7c e TODAS as colunas/constraints existentes permanecem INTACTOS —
--    E4 nunca os altera. current_user_tenant_id() é só um CREATE OR REPLACE idempotente.)
-- ============================================================================


COMMIT;
