-- ════════════════════════════════════════════════════════════════════════════
-- JANELA 06/jul — Storage (mídia de negócio) · Log de erros · Diário de obra ·
--                 Medição rica · Nota Fiscal (anexar).
--
-- APLICADO EM PRODUÇÃO em 06/jul via Supabase MCP (5 migrações, com o dono presente):
--   business_media_buckets_private · hub_error_logs · hub_obras_diario_rdo ·
--   medicao_rica_video_fvs · hub_notas_fiscais_anexar.
-- Este arquivo VERSIONA o que foi aplicado (idempotente: IF NOT EXISTS / ON CONFLICT).
-- Decisões do dono: buckets PRIVADOS (URL assinada no servidor); NF = ANEXAR (não emitir).
-- Segurança: novas tabelas com RLS ON e SEM policy permissiva (fail-closed = só service_role,
-- que é o caminho da API). Acesso ao Storage: escrita/leitura via SUPABASE_SERVICE_ROLE_KEY.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Buckets de mídia de NEGÓCIO — todos PRIVADOS ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('medicoes',        'medicoes',        false, 26214400,  ARRAY['image/png','image/jpeg','image/webp','application/octet-stream']::text[]),
  ('obra-videos',     'obra-videos',     false, 209715200, ARRAY['video/mp4','video/webm','video/quicktime','application/octet-stream']::text[]),
  ('documentos-obra', 'documentos-obra', false, 52428800,  ARRAY['application/pdf','image/png','image/jpeg','application/octet-stream']::text[]),
  ('contratos',       'contratos',       false, 52428800,  ARRAY['application/pdf','application/octet-stream']::text[]),
  ('notas-fiscais',   'notas-fiscais',   false, 26214400,  ARRAY['application/pdf','application/xml','text/xml','application/octet-stream']::text[])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2) Log central de ERROS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_error_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid,
  nivel      text NOT NULL DEFAULT 'error',
  origem     text,
  mensagem   text NOT NULL,
  stack      text,
  contexto   jsonb DEFAULT '{}'::jsonb,
  request_id text,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_error_logs_criado_idx ON public.hub_error_logs (criado_em DESC);
CREATE INDEX IF NOT EXISTS hub_error_logs_tenant_idx ON public.hub_error_logs (tenant_id, criado_em DESC);
ALTER TABLE public.hub_error_logs ENABLE ROW LEVEL SECURITY;

-- ── 3) Diário de obra (RDO) — a migração original (20260523) nunca chegou a prod ─
CREATE TABLE IF NOT EXISTS public.hub_obras_diario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.hub_obras(id) ON DELETE CASCADE,
  resumo TEXT NOT NULL,
  clima TEXT,
  registrado_por TEXT,
  tenant_id UUID REFERENCES public.hub_tenants(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hub_obras_diario_obra_idx ON public.hub_obras_diario (obra_id, criado_em DESC);
ALTER TABLE public.hub_obras_diario ENABLE ROW LEVEL SECURITY;

-- ── 4) Medição RICA — vídeo, pontos de melhoria, fornecedor executor + FVS ────
ALTER TABLE public.hub_obra_medicoes
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS pontos_melhoria text,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid;

CREATE TABLE IF NOT EXISTS public.hub_obra_fvs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  obra_id    uuid NOT NULL,
  item_id    uuid,
  ambiente   text,
  criterios  jsonb DEFAULT '[]'::jsonb,
  aprovado   boolean DEFAULT false,
  criado_por uuid,
  criado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_obra_fvs_obra_idx ON public.hub_obra_fvs (obra_id, criado_em DESC);
ALTER TABLE public.hub_obra_fvs ENABLE ROW LEVEL SECURITY;

-- ── 5) Nota Fiscal — modelo ANEXAR ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.hub_notas_fiscais (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  obra_id      uuid,
  pagamento_id uuid,
  negocio_id   uuid,
  numero       text,
  emitente     text,
  valor        numeric(14,2),
  emitida_em   date,
  arquivo_path text,
  status       text NOT NULL DEFAULT 'anexada',
  arquivado_em timestamptz,
  criado_por   uuid,
  criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_nf_tenant_idx ON public.hub_notas_fiscais (tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS hub_nf_obra_idx ON public.hub_notas_fiscais (obra_id);
ALTER TABLE public.hub_notas_fiscais ENABLE ROW LEVEL SECURITY;
