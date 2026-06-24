-- ============================================================================
-- F1.1 — Negócio flexível (estilo Pipedrive). Aplicado 2026-06-24 via execute_sql.
-- Autorizado pelo usuário (pessoa_id e lead_id). Negócio pode ser criado DIRETO,
-- ligado a pessoa E/OU empresa, SEM exigir lead. O converter lead→negócio segue
-- setando lead_id normalmente. Aditivo/reversível. A guarda "ganho exige pessoa"
-- continua no app (lib/crm/negocio-rules.ts).
-- Provado live: POST /api/crm/negocios {titulo, prefixo_mercado:'IMB'} -> 201,
-- codigo NGIMB2026001, pipeline_id resolvido (funil do mercado), lead_id/pessoa_id null.
-- ============================================================================
alter table public.hub_negocios alter column pessoa_id drop not null;
alter table public.hub_negocios alter column lead_id   drop not null;

-- ROLLBACK (só se não houver linhas com null nessas colunas):
--   alter table public.hub_negocios alter column pessoa_id set not null;
--   alter table public.hub_negocios alter column lead_id   set not null;
