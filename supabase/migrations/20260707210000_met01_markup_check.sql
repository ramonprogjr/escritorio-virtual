-- MET-01 (metade banco) · CHECK de markup >= 1 em hub_ia_config
-- O guard do app (PUT /api/crm/ia/config) já rejeita markup < 1; o CADERNO §9 pedia TAMBÉM
-- o CHECK no banco, que estava faltando. Fecha o "IA de graça" mesmo contra escrita direta.
-- Seguro: hub_ia_config tinha 1 linha (markup=10), 0 violando. Aditiva · idempotente.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'hub_ia_config' and c.conname = 'hub_ia_config_markup_check'
  ) then
    alter table public.hub_ia_config
      add constraint hub_ia_config_markup_check check (markup >= 1);
  end if;
end $$;

-- Rollback: alter table public.hub_ia_config drop constraint if exists hub_ia_config_markup_check;
