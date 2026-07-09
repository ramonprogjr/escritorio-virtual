-- Gerenciador de tarefas UNIVERSAL: hub_tarefas_comerciais deixa de ser só lead/negócio e passa a
-- valer para QUALQUER entidade (lead, pessoa, empresa, negócio, fornecedor, especialista, obra).
-- Aditiva/reversível; a tabela estava com 0 linhas em prod. O par entity_type+entity_id casa com
-- hub_eventos e com o barramento de tarefas/aprovações. Aplicada via MCP em 2026-07-09.

alter table hub_tarefas_comerciais add column if not exists entity_type text;
alter table hub_tarefas_comerciais add column if not exists entity_id uuid;
-- origem: 'ia' (criada pela Mari/copiloto) | 'humano' (criada na tela). Default humano.
alter table hub_tarefas_comerciais add column if not exists origem text not null default 'humano';

-- Backfill dos vínculos antigos (0 linhas hoje; mantém consistência se surgirem).
update hub_tarefas_comerciais set entity_type = 'lead', entity_id = lead_id
  where entity_id is null and lead_id is not null;
update hub_tarefas_comerciais set entity_type = 'negocio', entity_id = negocio_id
  where entity_id is null and negocio_id is not null;

create index if not exists idx_tarefas_entity on hub_tarefas_comerciais (entity_type, entity_id);
create index if not exists idx_tarefas_status_venc on hub_tarefas_comerciais (status, vencimento_em);
create index if not exists idx_tarefas_tenant_status on hub_tarefas_comerciais (tenant_id, status);

-- SEGURANÇA: escrita/leitura só via service-role (crmDb, que bypassa RLS). RLS ligada sem policy =
-- anon key (pública) sem acesso — mesmo padrão de hub_eventos/hub_atendimento_pausas.
alter table hub_tarefas_comerciais enable row level security;
