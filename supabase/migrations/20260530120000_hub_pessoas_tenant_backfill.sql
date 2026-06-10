-- Backfill tenant_id em hub_pessoas (registos legados sem tenant).
-- Idempotente: só actualiza NULL. Alinha com hub_parceiros / hub_leads_crm.

UPDATE public.hub_pessoas
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;
