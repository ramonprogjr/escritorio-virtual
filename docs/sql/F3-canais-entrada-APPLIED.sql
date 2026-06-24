-- ============================================================================
-- F#3 — Canais de entrada (registro de fontes de lead). Tabela aplicada 2026-06-24.
-- NÃO guarda tokens/segredos (trava). origem_slug = valor de "origem" usado nas regras
-- de roteamento (F#2). Conexão real do WhatsApp segue na ficha do agente (Uazapi);
-- Meta/Google ficam declarados aqui (ligação por webhook = passo futuro).
-- RLS tenant-scoped (sem anon). API /api/crm/canais-entrada (+ [id]); UI /crm/canais-entrada.
-- NOTA: prova de CRUD ao vivo ficou pendente (sessão expirou; senha rejeitada) — mas a
-- tabela/RLS foram criadas com sucesso e a API espelha o F#2 (CRUD já provado).
-- ============================================================================
create table public.hub_canais_entrada (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,            -- whatsapp | meta_ads | google_ads | site | indicacao | manual
  nome text not null,
  identificador text,            -- numero / conta / form id (sem tokens)
  origem_slug text,              -- "origem" usado nas regras de roteamento (F#2)
  ativo boolean not null default true,
  observacao text,
  tenant_id uuid,
  criado_em timestamptz not null default now()
);
alter table public.hub_canais_entrada enable row level security;
create policy hub_canais_entrada_auth_select on public.hub_canais_entrada for select to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_canais_entrada_auth_insert on public.hub_canais_entrada for insert to authenticated with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_canais_entrada_auth_update on public.hub_canais_entrada for update to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null) with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_canais_entrada_auth_delete on public.hub_canais_entrada for delete to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);

-- ROLLBACK: drop table public.hub_canais_entrada;
