-- ============================================================================
-- Códigos de rastreio (tipo "CPF" ponta a ponta) — codificador ATÔMICO.
-- Aplicado 2026-06-24 via execute_sql. Substitui o COUNT(*)+1 do app (corrida +
-- vazamento de contagem entre tenants). Formato compacto do doc: PREFIXO+AAAA+SEQ
-- (PS2026001); negócio embute o mercado (NGIMB2026001). Provado end-to-end:
-- POST pessoa -> 201 PS2026001 -> /api/crm/rastreio resolve 200.
-- App: lib/crm/codigos-rastreio.ts chama esta rpc (com fallback p/ PREFIXO-AAAA-####).
-- ============================================================================

create table if not exists public.hub_codigo_contador (
  entidade text not null,
  ano int not null,
  ultimo int not null default 0,
  primary key (entidade, ano)
);
alter table public.hub_codigo_contador enable row level security;  -- só a função (definer) escreve

create or replace function public.crm_proximo_codigo(p_entidade text, p_mercado text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_ano int := extract(year from now())::int; v_seq int; v_prefixo text;
begin
  v_prefixo := case lower(p_entidade)
    when 'pessoa' then 'PS' when 'empresa' then 'EM' when 'lead' then 'LD'
    when 'negocio' then 'NG' when 'parceiro' then 'PC' when 'fornecedor' then 'FR'
    when 'especialista' then 'ES' when 'imovel' then 'IM' when 'obra' then 'OB'
    when 'projeto' then 'PJ' when 'servico' then 'SV' when 'produto' then 'PD'
    else 'XX' end;
  insert into public.hub_codigo_contador as c (entidade, ano, ultimo)
    values (lower(p_entidade), v_ano, 1)
    on conflict (entidade, ano) do update set ultimo = c.ultimo + 1   -- atômico (sem corrida)
    returning c.ultimo into v_seq;
  return v_prefixo
    || case when lower(p_entidade) = 'negocio' and coalesce(p_mercado,'') <> '' then upper(p_mercado) else '' end
    || v_ano::text || lpad(v_seq::text, 3, '0');
end $$;
revoke all on function public.crm_proximo_codigo(text, text) from public, anon;
grant execute on function public.crm_proximo_codigo(text, text) to authenticated, service_role;

-- ROLLBACK: drop function public.crm_proximo_codigo(text,text); drop table public.hub_codigo_contador;
-- (o app volta a gerar PREFIXO-AAAA-#### automaticamente via fallback.)
