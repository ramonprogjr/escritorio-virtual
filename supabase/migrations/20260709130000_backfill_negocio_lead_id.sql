-- Backfill hub_negocios.lead_id a partir de hub_negocio_vinculos (papel='lead_origem').
-- A FK hub_negocios.lead_id aponta para hub_leads_crm (verificado); antes o converter gravava
-- lead_id=null por um comentário obsoleto → 0/16 negócios com lead_id → KPI de conversão SEMPRE ZERO
-- (kpis/calcular conta lead_id NOT NULL) e sem idempotência (3 "Negócio — TESTE ARIANE" duplicados).
-- Aditivo/idempotente: só preenche nulos e só quando o lead existe (respeita a FK). Aplicada via MCP 09/jul.

update hub_negocios n
set lead_id = v.entidade_id
from hub_negocio_vinculos v
where v.negocio_id = n.id
  and v.papel = 'lead_origem'
  and v.entidade_tipo = 'lead'
  and n.lead_id is null
  and exists (select 1 from hub_leads_crm l where l.id = v.entidade_id);
