-- RBAC multi-tenant (manual apply no Supabase SQL Editor se CLI indisponível)
-- Ver também: supabase/migrations/20260620190000_users_rbac_tenant.sql

-- Timestamps
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'criado_em'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN created_at TO criado_em;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'updated_at'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'atualizado_em'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN updated_at TO atualizado_em;
  END IF;
END $$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comercial'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.users SET role = 'gestor'::public.app_role WHERE role::text IN ('admin');
UPDATE public.users SET role = 'comercial'::public.app_role WHERE role::text IN ('vendedor');

INSERT INTO public.hub_tenants (id, slug, nome_exibicao)
VALUES ('00000000-0000-4000-8000-000000000001', 'obra10', 'Obra10+')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.hub_tenants (id);

UPDATE public.users
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

UPDATE public.users
SET role = 'owner'::public.app_role, status = 'Ativo'::public.record_status,
    tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE lower(trim(email)) IN (
  'ramonexercito@gmail.com',
  'nice.engemp@gmail.com',
  'ariane.ot@gmail.com'
);

UPDATE public.users
SET status = 'Inativo'::public.record_status, atualizado_em = NOW()
WHERE lower(trim(email)) = 'lucasoffgod@hotmail.com';
