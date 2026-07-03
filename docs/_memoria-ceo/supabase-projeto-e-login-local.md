---
name: supabase-projeto-e-login-local
description: Projeto Supabase do app (SISTEMA OBRA10+) e o que o login local realmente exige no .env.local
metadata:
  type: project
---

O app Escritório Virtual — Obra10+ usa o projeto Supabase **SISTEMA OBRA10+** (ref `cdjlqsznerdhwqyunodl`, região sa-east-1, URL `https://cdjlqsznerdhwqyunodl.supabase.co`). URL e anon key podem ser obtidas pelo MCP do Supabase (`list_projects` → `get_project_url` / `get_publishable_keys`); a service role key NÃO é exposta pelo MCP (é segredo — pedir ao usuário).

**Login local só precisa de `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.** `SUPABASE_SERVICE_ROLE_KEY` só é exigida pelo login se `LOGIN_ENFORCE_APP_USERS` / `LOGIN_REQUIRE_PUBLIC_USERS_ROW` / `LOGIN_ALLOWED_APP_ROLES` estiverem ligadas (em `lib/auth/verify-public-user.ts`) — no `.env.local` atual essas vars não existem, então a service role só faz falta nas telas de dados do CRM, não no login.

A conta `nice.engemp@gmail.com` é **owner** (auth_id `da68e9cf-e142-403f-a0ee-f4a19ea67a3e`, `public.users.role=owner`, `status=Ativo`, e-mail confirmado). Em 2026-06-22 o login foi **verificado funcionando** ponta-a-ponta: entra e redireciona para `/crm`, e o dashboard carrega dados reais (leads, movimentos) **sem console errors mesmo sem a service role key** — leituras do CRM passam pela sessão autenticada/RLS.

Em 2026-06-22 o `.env.local` estava com todas as chaves Supabase **vazias** (esqueleto). Preenchi URL+ANON via MCP; service role ficou pendente (usuário fornece, só faz falta em writes privilegiados/webhooks/crons). Corrige uma observação antiga do claude-mem que dizia "as chaves já estavam definidas, era servidor stale" — eram realmente vazias. O `npm run dev` (porta 3001, `scripts/dev-insecure-tls.cjs`) precisa de **restart** para recarregar o `.env.local`; um dev server stale emite o warning `[supabase/client] ... ausentes`. Verificação de login funcional: submeter credenciais falsas e confirmar `400 Invalid login credentials` vindo de `/auth/v1/token` (prova a ligação, sem precisar de conta real).
