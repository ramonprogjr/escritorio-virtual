-- ============================================================================
-- FIX (drift): trigger set_atualizado_em() em tabelas sem a coluna atualizado_em.
-- A migration hub_migration_v2 anexa o trigger BEFORE UPDATE (que faz
-- NEW.atualizado_em = NOW()) a 8 tabelas, mas 2 delas não têm a coluna no banco vivo:
--   hub_conversas, hub_whatsapp_config
-- → QUALQUER UPDATE nessas tabelas falhava: «record "new" has no field "atualizado_em"».
--   Impacto: hub_conversas = não dava p/ marcar lida/encerrar/transferir conversa;
--            hub_whatsapp_config = não dava p/ atualizar config do WhatsApp.
-- FIX aditivo/reversível: adicionar a coluna (alinha ao schema que o trigger pressupõe).
-- Aplicado 2026-06-23 via execute_sql. Provado: UPDATE em hub_conversas voltou a funcionar.
-- ============================================================================
alter table public.hub_conversas       add column if not exists atualizado_em timestamptz not null default now();
alter table public.hub_whatsapp_config add column if not exists atualizado_em timestamptz not null default now();

-- ROLLBACK (se desejado): remove as colunas (volta ao estado quebrado — não recomendado):
--   alter table public.hub_conversas       drop column if exists atualizado_em;
--   alter table public.hub_whatsapp_config drop column if exists atualizado_em;
