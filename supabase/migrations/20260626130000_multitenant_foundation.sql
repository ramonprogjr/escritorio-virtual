-- Multi-tenant REAL — fundação (aplicada via Supabase MCP em 26/jun/2026, registrada aqui p/ consistência do repo).
-- Contexto: as ~36 tabelas hub_* JÁ tinham RLS tenant-scoped (qual: tenant_id = current_user_tenant_id() OR null).
-- O que faltava era a função retornar o tenant REAL do usuário (estava chumbada no default).
-- Esta migração é behavior-preserving: todos os usuários atuais ficam no tenant default, então o
-- resultado é idêntico ao anterior — mas agora o isolamento por tenant fica ATIVO para novos membros.

-- (i) Coluna aditiva users.tenant_id + backfill + default (zero quebra; nada lia antes).
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tenant_id uuid;

UPDATE public.users
SET tenant_id = '00000000-0000-4000-8000-000000000001'::uuid
WHERE tenant_id IS NULL;

ALTER TABLE public.users
ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-4000-8000-000000000001'::uuid;

-- (ii) current_user_tenant_id() dinâmica: resolve o tenant do usuário via auth.uid() -> users.auth_id.
-- SECURITY DEFINER para ler users ignorando a RLS de users (evita recursão com is_hub_admin / lockout).
-- auth.uid() segue resolvendo o usuário chamador (vem do contexto da request, não do role).
-- Fallback ao tenant default quando não há usuário/tenant (anon, service, onboarding pendente).
-- ROLLBACK: trocar o corpo por  SELECT '00000000-0000-4000-8000-000000000001'::uuid  e remover SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.current_user_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1),
    '00000000-0000-4000-8000-000000000001'::uuid
  )
$function$;
