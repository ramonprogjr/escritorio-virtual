# STATUS — Maratona Obra10+ / Escritório Virtual Ramon

> Diário vivo da maratona. Atualizado a cada micro-etapa. Última atualização: **2026-06-23**.

## Objetivo
Sair de *"renderiza e quase funciona"* → **"confiável + espinha dorsal viva + IA Anthropic"**. Fechar o caminho de valor **Lead → Negócio → Obra/Projeto → Financeiro** com segurança real.

## Escopo & travas
- Só este projeto (`escritorio-virtual-ramon`), tabelas **`hub_*`** (+ legado `crm_*`/genérico apenas para *deprecar com trava*). **Membros (`membros_*`/`profissionais_*`) INTOCADO** — confirmado no **mesmo** Supabase.
- Migrações **só aditivas** (sem drop/sem apagar dado). Sem `git push`. Segredo só como secret (nunca no Git/front). **Contato de lead nunca exposto.** Mão de obra sem login. `_chk23` OK + cold load sem branco antes de fechar etapa.
- **Modo loop autônomo** até o critério de aceite ser provado **logado ao vivo**. GO humano só p/ migration em prod e deploy.

## Baseline verificada (2026-06-23)
- Dev server `:3001` no ar. `/api/health` → 200, `/login` → 200, `/crm` → 307 (redirect deslogado).
- `node app/_chk23.js` → **OK**.
- DB vivo (`cdjlqsznerdhwqyunodl`): **3 schemas coexistem** — `hub_*` (app vivo, com dados: `hub_leads_crm` 138, `hub_atividades` 214, `hub_fila_mensagens` 105, `hub_msg_jobs` 246); `crm_*`/genérico (legado quase vazio, 1–3 linhas); `membros_*`/`profissionais_*` (projeto separado, mesmo banco). **Migrations do repo (68) ≠ migrations aplicadas (lineage diferente)** → drift a reconciliar antes de qualquer DDL.

## Blocos
- [x] **A — Fundação de trabalho** (artefatos) — CONCLUÍDO (commit `ce8e1d0`; `_chk23` OK)
- [~] **B — Verdade (QA logado)** — blocker da service role **RESOLVIDO**; falta verificação de console no browser (Playwright reconectando)
- [ ] C — Drift & fronteira
- [ ] D — Segurança · diagnóstico (advisors)
- [ ] E — Segurança · RLS `hub_*`
- [ ] F — Segurança · funções/prova
- [ ] G — Espinha dorsal (migrations PDF aditivas)
- [ ] H — Anthropic · base
- [ ] I — Anthropic · ferramentas
- [ ] J — Caminho de valor
- [ ] K — Higiene de produto
- [ ] L — Fechamento

## Log de execução

### 2026-06-23 — Bloco A (fundação)
- Criados: `docs/STATUS_MARATONA.md`, `docs/PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`.
- `_chk23` baseline: **OK** (health 200, login 200, crm 307).

### 2026-06-23 — Bloco B (verdade) — BLOQUEADO no 1º achado
- Login OK (sessão persistente, conta `nice.engemp`). Shell do CRM renderiza; **design intacto** (baseline `qa/B1-dashboard.png`).
- **Achado crítico:** `GET /api/crm/dashboard` → **500**, `GET /api/crm/me/context` → **503** (em loop). Causa raiz (stack do servidor): `supabaseKey is required` → **`SUPABASE_SERVICE_ROLE_KEY` VAZIA** no `.env.local`.
- **Alcance:** a chave é usada em **139 ocorrências / 77 rotas `/api/*`** → todo o dado logado do CRM cai. Por isso o funil mostra **0 leads** apesar de **138** em `hub_leads_crm`. É "renderiza mas não funciona" = 1 segredo faltando, não 77 bugs.
- **BLOQUEIO (precisa do usuário):** fornecer `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → `service_role`). Vai em `.env.local` (dev, gitignored) + Render secret (prod). Sem ela, Bloco B não valida o app real.

### 2026-06-23 — Bloco B — BLOQUEIO RESOLVIDO
- Usuário forneceu a `SUPABASE_SERVICE_ROLE_KEY`. Inserida no `.env.local` (gitignored, NÃO commitada). Chave validada direta no Supabase REST: `HTTP 206`, `hub_leads_crm` = **138 linhas** (chave correta, não estava errada — só vazia).
- Dev reiniciado (b21i0kjhd) p/ recarregar env. `_chk23` OK (timeout subido p/ 30s por causa do cold-compile do dev).
- **Prova server-side (curl autenticado):** `POST /api/auth/crm-session` 200 → `GET /api/crm/dashboard` **200** (era 500), corpo com dados reais (`leadsAguardando:120`, `receitaPotencial:8556250`, `agentesAtivos:1`, alertas reais); `GET /api/crm/me/context` **200** `{role:owner,tenantNome:Obra10+}` (o 403 anterior era falta do header `x-caller-auth-id` no curl, não bug).
- **PENDENTE:** verificação de cold load logado no browser (console 0 erros) — Playwright reconectando; fazer quando voltar. Restam ainda os 2 erros de console vistos antes (React "state update on unmounted"; "Invalid or unexpected token") a confirmar/investigar no browser.

### 🔐 Achado de segurança (Bloco D/E — CONFIRMADO no fluxo, prova de exploit pendente)
- `lib/crm/crm-api-auth.ts:19` `requireInternalApiKey` **libera** (`return null`) quando `INTERNAL_API_KEY` está vazia (está). Então `/api/crm/*` não exige chave interna.
- `lib/internal-api-headers-client.ts:9` define `x-caller-auth-id` **no cliente** (do `user.id`); o servidor (`crm-api-auth.ts:45`, e rotas de atendimento) **confia** nesse header p/ identificar o caller. `proxy.ts` **não** injeta/sobrescreve esse header (sem match no grep).
- **Risco (anti-escalada de papel):** um usuário **autenticado** (cookie de sessão válido p/ passar o `proxy.ts`) pode enviar **outro** `x-caller-auth-id` → o handler busca o `role/tenant` daquele outro usuário em `public.users` e age como ele (impersonation / cross-tenant). Mitigação atual: exige cookie de sessão válido (não é anônimo). Correção no Bloco E: derivar o auth_id da sessão validada no servidor (não confiar no header), e/ou exigir `INTERNAL_API_KEY`. Prova por força bruta a fazer no Bloco D.

### 2026-06-23 — Bloco D (segurança · diagnóstico) — PARCIAL (Supabase MCP instável)
- Supabase MCP **flapando** (socket fecha em queries não-triviais; `select 1` e políticas de `users` passaram, as demais derrubaram). Anti-loop: parei de repetir.
- **Achado que CORRIGE pessimismo anterior:** as políticas **VIVAS** de `public.users` estão **travadas** — `ALL` via `is_hub_admin()`, `SELECT` via `auth_id = auth.uid()`. **NÃO é o `true/true` que o repo sugeria.** ⇒ Confirma **drift repo↔prod: prod está mais seguro que o repo**. A auditoria de segurança tem de ser sobre o **banco VIVO**, não sobre os .sql do repo; os "riscos de RLS" derivados do repo (memória `schema-rls-alinhamento-mestre`) precisam ser **reverificados em prod** antes de qualquer correção.
- **Auditoria viva (parcial, MCP cooperou):** segurança **heterogênea** —
  - `public.users` 🟢 travada: `ALL` via `is_hub_admin()`, `SELECT` via `auth_id=auth.uid()`.
  - `hub_leads_crm` 🔴 **ABERTA**: `anon_select` (SELECT, `{anon,authenticated}`, `true`) + `hub_acesso_total` (ALL, `{public}`, `true`) → anon lê/escreve todos os 138 leads **com contato** (viola trava "contato de lead nunca exposto").
  - `hub_pessoas` 🔴 leitura aberta: `anon_select` (`true`) → PII legível por anon.
  - `hub_contas_receber` 🔴 **ABERTA**: `hub_contas_receber_service` (ALL, `{public}`, `true`) → financeiro exposto.
- **Padrão sistêmico:** políticas legadas permissivas (`anon_select`/`hub_acesso_total`/`*_service` com `qual=true`). `users` foi endurecida à parte (migração RBAC posterior). RLS é OR-de-políticas → **corrigir EXIGE remover/substituir as políticas `true`** (não basta adicionar restritiva).
- PENDENTE: auditar `hub_empresas`, `hub_negocios`, `hub_contas_pagar`, `hub_imoveis`, `hub_msg_jobs`, `hub_fila_mensagens` (1 query/tabela).

### 2026-06-23 — Bloco B DESBLOQUEADO (service role key carregada)
- A `SUPABASE_SERVICE_ROLE_KEY` já estava no `.env.local` (válida: `role=service_role`, `ref=cdjlqsznerdhwqyunodl`, não expirada). O erro 500 anterior era **servidor dev stale** — não tinha recarregado o `.env.local`. Resposta ao "a chave está errada?": **não, a chave está certa**; faltava reiniciar.
- Reiniciei o dev → `_chk23` OK. Verificado por **curl autenticado** (login real → cookie de sessão → rota): `/api/crm/dashboard` **200** (era 500), `/api/crm/leads` **200**, `/api/crm/me/context` **200** (com header `x-caller-auth-id` do browser). O "renderiza mas não funciona" era **1 segredo faltando**, confirmado.
- **Ajuste de severidade do achado `crm-api-auth`:** forja de `x-caller-auth-id` **sem** cookie válido → **401** (proxy bloqueia). Logo NÃO é acesso não-autenticado; é escalada por usuário **já autenticado** enviando `auth_id` de outro (a confirmar com 2ª conta). Severidade revisada **CRÍTICO → MÉDIO**. Fix ainda recomendado (derivar `auth_id` do token validado server-side; `INTERNAL_API_KEY` fail-closed).
- Pendências de ferramenta: QA visual logado completo aguarda **Playwright** reconectar; auditoria RLS viva restante + DDL aguardam **Supabase MCP** reconectar (ambos caíram nesta sessão).

### 2026-06-23 — Bloco E (segurança) passo 1: fix `crm-api-auth` (escalada `x-caller-auth-id`)
- **Implementado:** `getCallerContext` deriva `auth_id` do **cookie de sessão** (JWT `sub` decodificado localmente; proxy já validou assinatura/expiração) — header `x-caller-auth-id` forjável é **ignorado quando há cookie**; fallback p/ header só sem cookie (chamador interno, já gated por `x-api-key`). `try/catch` no `decodeURIComponent`. Helper `resolveCallerAuthId` exportado.
- **Estendido** às 3 rotas de atendimento (`assumir`/`send`/`devolver`) que liam o header **direto** (achado **CRÍTICO** do code-review — mesmo vetor de escalada: tomar posse/enviar-como/devolver lead de outro operador).
- **Validado ao vivo (curl) ANTES da rede degradar:** `/me/context` 200, `/dashboard` 200, `/leads` 200; **cookie + header FALSO → 200 com `role: owner`** (header ignorado, **escalada fechada**); sem cookie → 401; `_chk23` OK.
- **code-review (agente):** aprovado com 2 itens → ambos corrigidos. Demais OK (regex/decode base64url/proxy fail-closed/`Buffer` em node/sem padrão "atuar como" no cliente).
- **PENDENTE (não fechar):** re-validação ao vivo das 3 rotas de atendimento — **bloqueada por rede instável proxy→Supabase** (`fetchAuthUserFromAccessToken: fetch failed`, mesma raiz que derrubou o MCP). Código equivalente ao já provado; falta só o run verde quando a rede estabilizar.

### 2026-06-23 — rede voltou: Bloco B (API) GREEN + passo 1 FECHADO + pré-condição Bloco E
- **Rotas de atendimento VALIDADAS ao vivo** (cookie→400 id ok; cookie+header-falso→400 cookie venceu; sem-cookie→401). **Passo 1 de segurança (`crm-api-auth`) FECHADO** — provado logado, escalada `x-caller-auth-id` fechada nas ~77 rotas + 3 de atendimento.
- **Varredura logada de 23 endpoints `/api/crm/*` e `/api/hub/*` → TODOS 200.** Com a service role carregada, **o data layer do CRM está saudável a nível de API** (dashboard, leads, negócios, pessoas, empresas, imóveis, obras, projetos, pedidos, financeiro, tarefas, atendimento, métricas, pipelines, integrações, onboarding, agentes, ciclos, aprovações, canais, alertas, ferramentas). Milestone: o "renderiza mas não funciona" era 1 chave + restart. (QA **visual/console por tela** ainda pendente — Playwright fora.)
- **Bloco E pré-condição (achada sem MCP, decisiva):** o JWT de sessão **NÃO tem claim `tenant_id`** → `app_tenant_id()`=NULL no browser. Políticas `authenticated AND tenant_id=app_tenant_id()` casariam ZERO linhas e quebrariam telas. **Decisão de design:** RLS do Bloco E resolve tenant por **`auth.uid()`→`public.users`** (helper `current_user_tenant_id()` SECURITY DEFINER), create-before-drop por tabela, com policies de write p/ os reads/writes do client. A validar com security-reviewer ao aplicar (via MCP, com GO).
- Travado: Bloco E (apply RLS) aguarda **Supabase MCP** reconectar; QA visual aguarda **Playwright**.
