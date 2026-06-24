-- ============================================================================
-- F#2 — Roteamento automático de leads (configurável). Tabela aplicada 2026-06-24.
-- O resolver (lib/crm/lead-routing-config.ts) aplica a 1ª regra ATIVA que casa
-- (origem/mercado/uf; null=qualquer), por prioridade asc; senão cai na heurística
-- atual (lead-routing-rules.ts). Wired em: webhook WhatsApp + salvar-super-cadastro.
-- RLS tenant-scoped (sem anon). Provado: CRUD via /api/crm/distribuicao/regras.
-- ============================================================================
create table if not exists public.hub_lead_routing_regras (
  id uuid primary key default gen_random_uuid(),
  prioridade int not null default 100,
  ativo boolean not null default true,
  origem text,         -- null = qualquer (whatsapp, meta, google, indicacao, manual...)
  mercado text,        -- null = qualquer (IMB, ARQ, ENG, SRV, RFM, MRC...)
  uf text,             -- null = qualquer
  destino_tipo text not null default 'agente',   -- agente | atendente | parceiro
  destino_valor text,  -- slug do agente/atendente ou id do parceiro
  rotulo text,
  tenant_id uuid,
  criado_em timestamptz not null default now()
);
alter table public.hub_lead_routing_regras enable row level security;
create policy hub_lead_routing_regras_auth_select on public.hub_lead_routing_regras for select to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_lead_routing_regras_auth_insert on public.hub_lead_routing_regras for insert to authenticated with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_lead_routing_regras_auth_update on public.hub_lead_routing_regras for update to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null) with check (tenant_id = public.current_user_tenant_id() or tenant_id is null);
create policy hub_lead_routing_regras_auth_delete on public.hub_lead_routing_regras for delete to authenticated using (tenant_id = public.current_user_tenant_id() or tenant_id is null);

-- ROLLBACK: drop table public.hub_lead_routing_regras;  (o roteamento volta 100% a heuristica)
