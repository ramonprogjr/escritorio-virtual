-- Alinha hub_memorias_lead.lead_id com hub_leads_crm (webhook WhatsApp usa hub_leads_crm.id).
-- Se existirem linhas órfãs (lead_id só em hub_leads), corra antes: scripts/verify-hub-memorias-lead-fk.cjs

ALTER TABLE public.hub_memorias_lead
  DROP CONSTRAINT IF EXISTS hub_memorias_lead_lead_id_fkey;

-- Garante colunas chave/valor se a BD tiver só o schema legado (hub_migration_v2)
ALTER TABLE public.hub_memorias_lead
  ADD COLUMN IF NOT EXISTS chave TEXT,
  ADD COLUMN IF NOT EXISTS valor TEXT,
  ADD COLUMN IF NOT EXISTS confianca NUMERIC(3, 2) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS criado_por TEXT DEFAULT 'ia',
  ADD COLUMN IF NOT EXISTS criado_em TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hub_memorias_lead_lead_id_fkey'
      AND conrelid = 'public.hub_memorias_lead'::regclass
  ) THEN
    ALTER TABLE public.hub_memorias_lead
      ADD CONSTRAINT hub_memorias_lead_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES public.hub_leads_crm (id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON CONSTRAINT hub_memorias_lead_lead_id_fkey ON public.hub_memorias_lead IS
  'Memórias do lead no CRM WhatsApp (hub_leads_crm), não hub_leads canvas.';
