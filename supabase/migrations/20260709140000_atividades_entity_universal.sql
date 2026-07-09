-- Timeline UNIVERSAL: hub_atividades ganha entity_type+entity_id (como hub_eventos e hub_tarefas)
-- para servir QUALQUER entidade (lead/pessoa/empresa/negócio/fornecedor/especialista/obra) — hoje
-- só tinha lead_id/negocio_id/pessoa_id fixos. Aditiva/idempotente; backfill dos 50 registros vivos.
-- As colunas legadas continuam (compat com as fichas atuais). Aplicada via MCP 09/jul.

alter table hub_atividades add column if not exists entity_type text;
alter table hub_atividades add column if not exists entity_id uuid;

update hub_atividades set entity_type='lead',    entity_id=lead_id    where entity_id is null and lead_id    is not null;
update hub_atividades set entity_type='negocio', entity_id=negocio_id where entity_id is null and negocio_id is not null;
update hub_atividades set entity_type='pessoa',  entity_id=pessoa_id  where entity_id is null and pessoa_id  is not null;

create index if not exists idx_atividades_entity on hub_atividades (entity_type, entity_id, criado_em desc);
