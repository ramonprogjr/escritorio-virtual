-- Elo lead→parceiro ESTRUTURADO (laudo CRM): hub_encaminhamentos guardava o parceiro só como TEXTO
-- (encaminhado_para = nome) e o parceiro_id enterrado no JSON criterio_selecao; as FKs apontavam para
-- hub_profissionais (0 linhas, morta). Renomear o parceiro perdia o rastreio/comissão. Agora há uma
-- coluna parceiro_id FK→hub_parceiros, gravada no encaminhamento e retroalimentada do JSON existente.
-- Aditiva/idempotente. Aplicada via MCP 09/jul.

alter table hub_encaminhamentos add column if not exists parceiro_id uuid references hub_parceiros(id);
create index if not exists idx_encaminhamentos_parceiro on hub_encaminhamentos (parceiro_id);

update hub_encaminhamentos
set parceiro_id = (criterio_selecao::jsonb ->> 'parceiro_id')::uuid
where parceiro_id is null
  and criterio_selecao ~ '^\s*\{'
  and (criterio_selecao::jsonb ->> 'parceiro_id') ~ '^[0-9a-fA-F-]{36}$'
  and exists (select 1 from hub_parceiros p where p.id = (criterio_selecao::jsonb ->> 'parceiro_id')::uuid);
