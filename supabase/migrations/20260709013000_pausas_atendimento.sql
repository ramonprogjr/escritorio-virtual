-- Bloco A (segurança do atendimento Mari): deny-list de pausa por telefone + garantir default da pausa do agente.
-- Aditiva/reversível. Aplicada via MCP em 2026-07-09. Ver docs/DESIGN-ATENDIMENTO-DEFINITIVO.md §1.2.
--
-- Fontes de pausa (fonte):
--   etiqueta  -> espelho da etiqueta "pausa" do WhatsApp Business (sync UAZAPI); sync pode apagar/repor.
--   comando   -> /pausa pelo celular do dono.
--   painel    -> (reservado) pausa manual por telefone via tela.
--   seed      -> lote da lista de clientes ativos colada pelo dono.
-- O gate consulta por telefone_sufixo11 (mesma equivalência de telefonesConversaEquivalentes: últimos 11 dígitos).

create table if not exists hub_atendimento_pausas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  telefone text not null,                     -- canônico: só dígitos, E.164 sem '+'
  telefone_sufixo11 text generated always as (right(telefone, 11)) stored,
  fonte text not null check (fonte in ('etiqueta','comando','painel','seed')),
  labelid text,                               -- quando fonte='etiqueta'
  motivo text,
  criado_por text,                            -- 'wendel' | 'sync' | ...
  criado_em timestamptz not null default now(),
  unique (telefone, fonte)
);

create index if not exists idx_pausas_sufixo11 on hub_atendimento_pausas (telefone_sufixo11);

-- SEGURANÇA (laudo Fable, Baixo 11): a deny-list é lida/escrita SEMPRE via service_role (crmDb, que
-- bypassa RLS). Habilitar RLS SEM criar policy = anon key (pública) fica sem acesso nenhum. Sem esta
-- linha, recriar o banco do repo deixaria a tabela ABERTA à anon — e apagar estas linhas =
-- despausar clientes ativos. Idempotente (o banco vivo já está com RLS ON).
alter table hub_atendimento_pausas enable row level security;

-- Ressuscitar o "pausar" do agente: garantir default explícito (a coluna já existia, mas sem default consistente).
alter table hub_agente_identidade alter column ia_whatsapp_pausada set default false;
