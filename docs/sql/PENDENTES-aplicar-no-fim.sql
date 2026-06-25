-- ============================================================================
-- MIGRAÇÕES PENDENTES — aplicar TODAS no fim, em lote (decisão do dono 25/jun:
-- "siga e migramos tudo no fim"). Todas ADITIVAS e IDEMPOTENTES. Revisar antes de aplicar.
-- ============================================================================

-- [1] Especialistas (mão de obra): CPF único para dedup da base.
--     Permite "todos os especialistas têm um CPF único" + não duplicar a mesma pessoa.
alter table public.hub_especialistas add column if not exists cpf text;
create index if not exists idx_hub_especialistas_cpf
  on public.hub_especialistas (cpf) where cpf is not null;

-- (próximas migrações pendentes entram aqui conforme avançamos)
