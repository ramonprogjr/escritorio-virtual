-- ============================================================================
-- Rede / Cadastro (Bloco B) — Fase B1: tabelas hub_fornecedores + hub_especialistas
-- Aplicado 2026-06-24 via execute_sql. Formato espelha o projeto Membros (INTOCÁVEL),
-- ver memória membros-cadastro-formato. RLS tenant-scoped (sem anon); helper
-- current_user_tenant_id() já existe (Bloco E). Provado: anon=0 nas duas.
-- ============================================================================

create table if not exists public.hub_fornecedores (
  id uuid primary key default gen_random_uuid(),
  codigo text, nome text not null,
  tipo_pessoa text default 'PJ', cpf text, cnpj text,
  email text, telefone text,
  area_atuacao text, especialidade text,
  mercados jsonb, mercado_principal text,
  regiao text, cidade text, estado text,
  status_acesso text default 'pendente',   -- pendente|aprovado|recusado|bloqueado (homologação)
  recebe_leads boolean default false,
  bio text, foto_url text, instagram text, site text,
  comissao_pct numeric, indicado_por uuid,
  tenant_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.hub_especialistas (
  id uuid primary key default gen_random_uuid(),
  codigo text, nome text not null,
  telefone text not null, email text,
  cidade text, uf text,
  especialidades jsonb, especialidade_principal text,
  bio text, disponibilidade text, raio_km int, atende_regioes jsonb,
  faixa_preco text, instagram text, portfolio_urls jsonb,
  aceita_urgencia boolean default false,
  tem_equipe boolean default false, tamanho_equipe int,
  experiencia text, observacoes text,
  origem text default 'cadastro',            -- cadastro|indicado_membro|indicado_admin
  cadastrado_por uuid, foto_url text,
  verificado boolean default false,          -- sem homologação formal — só badge
  destaque boolean default false, servicos_concluidos int default 0,
  tenant_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.hub_fornecedores enable row level security;
create policy hub_fornecedores_auth_select on public.hub_fornecedores for select to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_fornecedores_auth_insert on public.hub_fornecedores for insert to authenticated with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_fornecedores_auth_update on public.hub_fornecedores for update to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null) with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);

alter table public.hub_especialistas enable row level security;
create policy hub_especialistas_auth_select on public.hub_especialistas for select to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_especialistas_auth_insert on public.hub_especialistas for insert to authenticated with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_especialistas_auth_update on public.hub_especialistas for update to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null) with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);

-- ROLLBACK (reversível; nenhuma outra tabela tocada):
--   drop table if exists public.hub_fornecedores;
--   drop table if exists public.hub_especialistas;
