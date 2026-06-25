-- ============================================================================
-- LOTE-FIM — ✅ APLICADO em 25/jun/2026 (autorização do dono: "aplique").
-- Todas ADITIVAS/IDEMPOTENTES. Mantido como registro do que foi aplicado.
-- ============================================================================

-- [1] ✅ APLICADO (migração especialistas_add_cpf) — CPF único p/ dedup da base.
alter table public.hub_especialistas add column if not exists cpf text;
create index if not exists idx_hub_especialistas_cpf
  on public.hub_especialistas (cpf) where cpf is not null;

-- [2] ✅ APLICADO (higiene_leads_teste_20260625) — limpeza de leads de teste/funcionários.
--     Backup: public.hub_leads_crm_bkp_20260625 + public.hub_negocios_bkp_20260625 (restauráveis).
--     144 leads → 6 mocks realistas (resto + dependentes em 9 tabelas FK apagados).
--     OBS: hub_leads_crm tem trigger block_unauthorized_delete() — DELETE exige
--     `set local app.delete_authorized = true;` dentro da transação.
