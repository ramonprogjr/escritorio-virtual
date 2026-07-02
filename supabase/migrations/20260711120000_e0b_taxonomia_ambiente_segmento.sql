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
