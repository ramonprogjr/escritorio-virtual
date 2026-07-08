-- ═══════════════════════════════════════════════════════════════════════════════
-- RAS-01 · Linhagem do negócio — backfill + garantia no banco + índices
-- Diagnóstico 07/jul: colunas negocio_pai_id / negocio_raiz_id JÁ EXISTEM (dormentes);
-- 16 negócios, todos com raiz vazia. Esta migração é ADITIVA · IDEMPOTENTE · REVERSÍVEL:
--   1) backfill  — todo negócio sem raiz vira sua PRÓPRIA raiz ("nada se perde")
--   2) gatilho   — todo negócio NOVO nasce com raiz (self, ou herdada do pai) — no banco,
--                  independente do app (garante o critério F0 "nenhum negócio sem raiz")
--   3) FKs (se ainda não houver) + índices de navegação da árvore
-- Rollback comentado ao fim.
-- ═══════════════════════════════════════════════════════════════════════════════
begin;

-- 1) Backfill — raiz = self onde estiver nula (não há pai histórico)
update public.hub_negocios
   set negocio_raiz_id = id
 where negocio_raiz_id is null;

-- 2) Garantia no banco: nenhum negócio nasce sem raiz (independe do app)
create or replace function public.hub_negocios_set_linhagem()
returns trigger language plpgsql as $fn$
begin
  if new.negocio_pai_id is not null and new.negocio_raiz_id is null then
    select coalesce(n.negocio_raiz_id, n.id) into new.negocio_raiz_id
      from public.hub_negocios n where n.id = new.negocio_pai_id;
  end if;
  if new.negocio_raiz_id is null then
    new.negocio_raiz_id := new.id;
  end if;
  return new;
end
$fn$;

drop trigger if exists trg_hub_negocios_linhagem on public.hub_negocios;
create trigger trg_hub_negocios_linhagem
  before insert on public.hub_negocios
  for each row execute function public.hub_negocios_set_linhagem();

-- 3) FKs de auto-referência (só se ainda não houver FK na coluna) + índices
do $do$
begin
  if not exists (
    select 1 from information_schema.key_column_usage kcu
    join information_schema.table_constraints tc
      on tc.constraint_name = kcu.constraint_name and tc.constraint_schema = kcu.constraint_schema
    where tc.table_schema = 'public' and tc.table_name = 'hub_negocios'
      and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'negocio_pai_id'
  ) then
    alter table public.hub_negocios
      add constraint hub_negocios_pai_fk
      foreign key (negocio_pai_id) references public.hub_negocios(id) on delete set null;
  end if;
  if not exists (
    select 1 from information_schema.key_column_usage kcu
    join information_schema.table_constraints tc
      on tc.constraint_name = kcu.constraint_name and tc.constraint_schema = kcu.constraint_schema
    where tc.table_schema = 'public' and tc.table_name = 'hub_negocios'
      and tc.constraint_type = 'FOREIGN KEY' and kcu.column_name = 'negocio_raiz_id'
  ) then
    alter table public.hub_negocios
      add constraint hub_negocios_raiz_fk
      foreign key (negocio_raiz_id) references public.hub_negocios(id) on delete set null;
  end if;
end
$do$;

create index if not exists idx_hub_negocios_pai  on public.hub_negocios(negocio_pai_id);
create index if not exists idx_hub_negocios_raiz on public.hub_negocios(negocio_raiz_id);

commit;

-- PROVA (deve retornar 0):
select count(*) as negocios_sem_raiz from public.hub_negocios where negocio_raiz_id is null;

-- ─── ROLLBACK (se algum dia precisar reverter esta migração) ──────────────────
-- begin;
--   drop trigger if exists trg_hub_negocios_linhagem on public.hub_negocios;
--   drop function if exists public.hub_negocios_set_linhagem();
--   drop index if exists public.idx_hub_negocios_pai;
--   drop index if exists public.idx_hub_negocios_raiz;
--   -- (as colunas e o backfill NÃO se revertem — dado histórico; "nada se perde")
-- commit;
