-- Fase 1 do metering de IA (moeda: Tijolos): preços, config, ledger de consumo e movimentos da carteira.
-- Aditivo. Tenant-scoped + RLS. Nada de bloqueio aqui (modo de construção).

create table if not exists public.hub_ia_precos (
  modelo text primary key,
  input_usd_milhao numeric not null,
  output_usd_milhao numeric not null,
  cache_read_fator numeric not null default 0.1,
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.hub_ia_config (
  id uuid primary key default gen_random_uuid(),
  escopo text not null check (escopo in ('global','tenant')),
  tenant_id uuid,
  markup numeric not null default 10,
  fx_usd_brl numeric not null default 6,
  valor_credito_brl numeric not null default 0.10,
  nome_moeda text not null default 'Tijolos',
  modo text not null default 'prepago' check (modo in ('prepago','pospago')),
  alerta_saldo_baixo integer not null default 50,
  criado_em timestamptz not null default now()
);
create unique index if not exists hub_ia_config_escopo_tenant_uniq
  on public.hub_ia_config (escopo, coalesce(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.hub_ia_consumo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  usuario_id uuid,
  origem text not null,
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  custo_usd numeric not null default 0,
  custo_brl numeric not null default 0,
  creditos integer not null default 0,
  ref_tipo text,
  ref_id text,
  criado_em timestamptz not null default now()
);
create index if not exists hub_ia_consumo_tenant_idx on public.hub_ia_consumo (tenant_id, criado_em desc);

create table if not exists public.hub_ia_creditos_mov (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tipo text not null check (tipo in ('compra','bonus','assinatura','debito','estorno')),
  creditos integer not null,
  descricao text,
  ref_id text,
  criado_em timestamptz not null default now()
);
create index if not exists hub_ia_creditos_mov_tenant_idx on public.hub_ia_creditos_mov (tenant_id, criado_em desc);

-- RLS tenant-scoped (mesmo padrão das ~36 tabelas existentes)
alter table public.hub_ia_precos enable row level security;
alter table public.hub_ia_config enable row level security;
alter table public.hub_ia_consumo enable row level security;
alter table public.hub_ia_creditos_mov enable row level security;

create policy hub_ia_precos_sel on public.hub_ia_precos for select to authenticated using (true);
create policy hub_ia_config_sel on public.hub_ia_config for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());
create policy hub_ia_consumo_sel on public.hub_ia_consumo for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());
create policy hub_ia_mov_sel on public.hub_ia_creditos_mov for select to authenticated
  using (tenant_id is null or tenant_id = current_user_tenant_id());

-- seed de preços de referência
insert into public.hub_ia_precos (modelo, input_usd_milhao, output_usd_milhao) values
  ('claude-opus-4-8', 5, 25),
  ('claude-sonnet-4-6', 3, 15),
  ('claude-haiku-4-5', 1, 5),
  ('claude-fable-5', 10, 50),
  ('mistral-large-latest', 2, 6),
  ('mistral-small-latest', 0.2, 0.6)
on conflict (modelo) do nothing;

-- config global default (Tijolos: R$0,10/Tijolo, markup 10×, câmbio 6)
insert into public.hub_ia_config (escopo, tenant_id, markup, fx_usd_brl, valor_credito_brl, nome_moeda, modo)
  values ('global', null, 10, 6, 0.10, 'Tijolos', 'prepago')
on conflict do nothing;
