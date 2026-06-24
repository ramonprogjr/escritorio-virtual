-- ============================================================================
-- FIX (drift) — hub_atividades não tinha `negocio_id`, embora o código do negócio
-- (PATCH em etapa-change + GET da timeline) já usasse `eq("negocio_id", ...)`. Resultado:
-- a TIMELINE DO NEGÓCIO nunca mostrou atividades (query/insert falhavam em silêncio).
-- A feature de "nota" (F#4) expôs isso. Aplicado 2026-06-24 via execute_sql.
--   1) add negocio_id (aditivo) — conserta timeline do negócio + nota.
--   2) lead_id deixa de ser NOT NULL — consistente com negócio sem lead (Pipedrive/F1.1):
--      atividade de negócio lead-less não tem lead_id. Autorizado (mesma decisão do F1.1).
-- Provado live: POST nota -> 201, timeline do negócio mostra a nota.
-- ============================================================================
alter table public.hub_atividades add column if not exists negocio_id uuid;
alter table public.hub_atividades alter column lead_id drop not null;

-- ROLLBACK (só se não houver linhas usando):
--   alter table public.hub_atividades alter column lead_id set not null;
--   alter table public.hub_atividades drop column if exists negocio_id;
