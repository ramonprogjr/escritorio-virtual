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
- [x] **D — Segurança · diagnóstico (advisors)** — rodado; achados triados; **P0 corrigido** (anon podia DELETAR PII via RPC) + view SECURITY DEFINER corrigida; backlog menor documentado
- [x] **E — Segurança · RLS `hub_*`** — FECHADO (lote 1 crítico + lote 2): **`anon_or_public_open = 0` em TODAS as hub_***. Provado no banco + QA logado. Refinamento tenant é melhoria futura (não-bloqueante).
- [ ] F — Segurança · funções/prova
- [x] **G — Espinha dorsal (caminho de valor)** — backbone API + UI: `fn-derivados` (botão "Gerar obra/projeto" no negócio ganho) + `rf-alerta-parado` (widget "Leads parados" no dashboard, provado live com 8 leads). Sem migration. 162/162 testes.
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

### 2026-06-23 — Bloco J: guardrails do caminho de valor — VERIFICADOS e travados
- **Achado:** `validarMudancaEstagioLead`/`validarMudancaNegocio` **já existem e estão LIGADAS** nas rotas de update (`leads/[id]:106`, `negocios/[id]:96`). Vários "P0" do plano **já estavam prontos**:
  - **rf-perda-motivo** ✅ DONE — **provado ao vivo** (PATCH lead→`perdido` sem motivo → **400 "Informe o motivo da perda"**, lead NÃO mutado) + travado com testes.
  - **rf-ganho-validacao (pessoa)** ✅ — ganho exige pessoa principal + testes. (valor/comissão/responsável são "quando aplicável" no doc mestre → NÃO forçados; habilitar exige verificar o fluxo de ganho na UI via Playwright p/ não bloquear vendas.)
  - **pa-obrigatoria** — lógica existe + testada (flag ON); flag `CRM_PROXIMA_ACAO_OBRIGATORIA` está **OFF**. Ligar exige confirmar no Playwright que o kanban/move envia `proxima_acao` (senão flipar quebra o drag). **DEFERIDO** até Playwright.
- **Testes:** `lib/crm/lead-rules.test.ts` (8) + `lib/crm/negocio-rules.test.ts` (9) → **17/17 vitest passam**. `_chk23` OK.
- Em aberto no Bloco J (separados, próximos): `fn-derivados` (ganho→cria obra/projeto), `rf-alerta-parado` (dashboard), `fl-aguardando` (ciclo).

### 2026-06-23 — Robustez: cobertura de testes em lógica pura crítica (MCP/Playwright fora)
- Adicionados **49 testes** (vitest), todos verdes, travando comportamento crítico contra regressão:
  - `caller-identity.test.ts` (6) — identidade por cookie (fix de escalada).
  - `lead-rules.test.ts` (8) + `negocio-rules.test.ts` (9) — guardrails perda/ganho/próxima-ação.
  - `crm-permissoes.test.ts` (15) — RBAC/anti-escalada (auditado: sem furo óbvio).
  - `codigos-rastreio.test.ts` (5) — formato `PREFIXO-AAAA-####` (documenta divergência vs `PS2026001` do doc e o risco de corrida `COUNT+1` — correção real = sequence/trigger via MCP).
  - `distribuir-lead.test.ts` (6) — scoring de encaminhamento (IA-first): mercado 40 / cidade 30 / UF 15 / carga / homologado 10; corte score<10; ranking; limite. Auditado (matemática confere).

### 2026-06-23 — Bloco E: migration DRAFT pronta (apply BLOQUEADO no MCP)
- Usuário pediu "Bloco E", mas o **Supabase MCP segue desconectado** → não dá p/ auditar `pg_policies` restantes nem **aplicar** DDL (service role fala REST, não roda DDL).
- Escrito **[docs/sql/bloco-e-rls-DRAFT.sql](sql/bloco-e-rls-DRAFT.sql)** — pronto p/ aplicar via MCP com GO: helper `current_user_tenant_id()` (auth.uid()→users) + policies `authenticated` tenant-scoped **create-before-drop** para `hub_leads_crm`/`hub_pessoas`/`hub_contas_receber` + DROP das permissivas (`anon_select`/`hub_acesso_total`/`*_service`). DELETE fica só p/ service_role. Rollback documentado (políticas são reversíveis; nenhum dado apagado).
- **PENDENTE p/ fechar:** (a) reconectar Supabase MCP; (b) finir auditoria das demais hub_*; (c) aplicar 1 tabela/vez com backup + GO + prova força bruta (anon negado) + app logado OK (incl. realtime).
- `_chk23` OK. Nada em prod foi tocado.

### 2026-06-23 — Bloco E: MCP reconectou → AUDITORIA COMPLETA + LOTE CRÍTICO APLICADO e provado
- **MCP do Supabase voltou** (sessão nova). Workaround do socket que derruba em payloads multi-linha: **agregar tudo em 1 linha** (`string_agg`) — `pg_get_expr(qual)` quebra a cada >1 linha. Com isso, **auditoria completa de `pg_policies`** das hub_*:
  - **Padrão sistêmico confirmado, MUITO maior que 3 tabelas:** **~45 policies permissivas (`qual=true`) em ~40 tabelas hub_***. Dois moldes: `anon_select` (SELECT `true` p/ {anon,authenticated}, ~30 tabelas) e `hub_acesso_total`/`*_service`/`*_anon` (ALL `true` p/ `public`, ~15 tabelas). Todas as 93 hub_* têm **RLS ON** (nenhuma aberta por RLS-off).
- **Correções decisivas ao DRAFT (descobertas no banco vivo):**
  - `public.users` **NÃO tem `tenant_id`** (e é INTOCÁVEL) → não há mapa user→tenant. **Só 1 tenant** existe. ⇒ helper `current_user_tenant_id()` retorna o **tenant default** (constante). Hoje isto é, na real, **authenticated-only + filtro default**, NÃO isolamento cross-tenant (dados/usuários ainda não suportam).
  - `hub_pessoas` **não tinha `tenant_id`** → **coluna adicionada (aditiva) + backfill** (empresa→tenant, senão default). O DRAFT teria falhado nessa tabela.
  - Linhas legadas têm `tenant_id` **NULL** → predicado **tolera NULL** (`or tenant_id is null`) p/ não sumir nada da app.
- **APLICADO (via apply_migration) no lote crítico, create-before-drop, com snapshot p/ rollback:** `hub_leads_crm`, `hub_pessoas`, `hub_contas_receber`, `hub_contas_pagar`. Ver **[bloco-e-rls-APPLIED.sql](sql/bloco-e-rls-APPLIED.sql)** e **[bloco-e-rls-ROLLBACK.sql](sql/bloco-e-rls-ROLLBACK.sql)**.
- **PROVA força-bruta (set role no banco vivo):** baseline anon via key pública lia **138 leads + 5 pessoas** (PII — viola "contato nunca exposto"). Pós-fix: **anon = 0/0/0/0** nas 4 tabelas; **authenticated = 138 leads + 5 pessoas** (app intacta). Cliente browser lê como **authenticated** (bridge hidrata sessão Supabase) → telas logadas continuam funcionando.
- **Hardening pós-advisor:** helper virou **SECURITY INVOKER** (corpo constante não precisa DEFINER) + `revoke execute` de anon/public. Advisor de segurança não lista mais as 4 tabelas em `rls_policy_always_true`.
- **AINDA ABERTO (próximo lote E):** ~36 tabelas hub_* com o mesmo padrão (inclui `hub_negocios`, `hub_oportunidades`, `hub_parceiros`, `hub_mensagens`, `hub_conversas`, `hub_atividades`, `hub_memorias_lead`, `hub_notas`, `hub_propostas`, `hub_servicos`, `hub_pipelines`, `hub_pipeline_estagios`, `hub_negocio_vinculos`…). Cada uma exige verificar coluna de tenant (várias não têm) antes de escopar.
- `_chk23` OK. Nenhum dado apagado.

### 2026-06-23 — Bloco E: QA visual LOGADO (Playwright) — RLS não quebrou a app ✅
- **Provado logado ao vivo** (login `nice.engemp@gmail.com`, Playwright):
  - **Dashboard** `/crm`: dados reais (120 aguardando, funil 85 / R$ 6.5M, Receita potencial R$ 8.6M, nomes reais) — **0 erros de console**. (vem de APIs server/service-role.)
  - **Kanban de leads** `/crm/leads`: **138 leads renderizados** (header "Pipeline global · 138 leads", colunas Novos/Qualificando/…, nomes Lucas/Ramon/Wendel). Este é o teste decisivo: usa **leitura client-side** de `hub_leads_crm` (anon-key + sessão) → passa pela policy `authenticated` nova. **Confirma que o fix de RLS NÃO quebrou as telas logadas.**
  - **Financeiro** `/crm/financeiro` (cobre `contas_receber/pagar`): renderiza limpo, R$ 0 (tabelas vazias, correto), **0 erros**.
  - Screenshot: `qa/E-leads-kanban-pos-rls.png`.
- **2 erros de console observados — AMBOS PRÉ-EXISTENTES, não do Bloco E:**
  - `GET /api/crm/encaminhamentos/pendentes` **500** consistente → **`column hub_encaminhamentos.encaminhado_para does not exist`**. **Bug de drift schema↔código** na rota [app/api/crm/encaminhamentos/pendentes/route.ts:30](../app/api/crm/encaminhamentos/pendentes/route.ts) — seleciona coluna inexistente (a tabela tem `profissional_id`/`destinatario_pessoa_id`/`responsavel_envio`, não `encaminhado_para`). `hub_encaminhamentos` **não foi tocada** pelo Bloco E (service-role ignora RLS). Tabela vazia → feature dormente. **Fix separado recomendado** (1 linha no SELECT; decidir coluna-alvo).
  - `GET /api/crm/me/context` **401** (1x, corrida do cookie de sessão na 1ª pintura — bridge posta o cookie async). Pré-existente ("token inválido" já notado).
- **Conclusão:** lote crítico do Bloco E **fechado e verificado logado**. App íntegra.

### 2026-06-23 — Bloco E LOTE 2: fecha anon nas ~38 tabelas hub_* restantes ✅
- **Auditoria autoritativa pós-lote-1:** as 4 já feitas saíram da lista de abertas; restavam **40 policies permissivas em 38 tabelas**. Classificadas: **4 com `tenant_id`** (tenant-scoped) + **34 sem** (authenticated-only). Regra capability-preserving: origem `anon_select`(SELECT) → só `authenticated SELECT` (writes já eram server-only); origem ALL(`hub_acesso_total`/`*_service`/`*_anon`) → `authenticated select+insert+update`, DELETE→service.
- **Guardrail bloqueou o apply em massa** (escalada de escopo além do lote crítico); usuário **re-autorizou** ("em lotes visíveis"). Aplicado em **3 migrations**: `groupA_tenant_scoped` (hub_negocios, hub_negocio_vinculos, hub_pipelines, hub_agente_identidade — verificado: 0 linhas com tenant estrangeiro, nada some), `groupB_select_only` (24), `groupB_all_access` (10, inclui atividades/notas que tinham os dois moldes).
- **PROVA:**
  - Auditoria de role: **`anon_or_public_open = 0`** em TODAS as hub_* (nenhuma policy `qual=true` p/ anon/public sobrou). ⚠️ O advisor `rls_policy_always_true` ainda lista ~34 tabelas — são as **authenticated-only `using(true)`** (intencional p/ tabelas sem tenant; NÃO é furo anon).
  - `set role`: anon **0** em negocios/parceiros/mensagens/conversas/atividades/mercados; authenticated lê real (**atividades 214, mensagens 15, conversas 5, parceiros 2, mercados 8**).
- Rollback: **[bloco-e-rls-lote2-ROLLBACK.sql](sql/bloco-e-rls-lote2-ROLLBACK.sql)** (recria as 40 permissivas; remove as `*_auth_*`). Nenhum dado apagado.
- **Bloco E essencialmente fechado:** todas as hub_* sem leitura/escrita anônima. Refinamento futuro: adicionar `tenant_id` + escopar as tabelas hoje authenticated-only que são por-lead/negócio (mensagens, conversas, oportunidades, memorias_lead, propostas, parceiros…). `_chk23` OK. Deploy não tocado.

### 2026-06-23 — Pós-E: corrigido bug pré-existente `encaminhamentos/pendentes` (drift de schema)
- **Causa-raiz:** a tabela VIVA `hub_encaminhamentos` (22 colunas, criada de fonte rica) **não tinha `encaminhado_para`**, mas a migration `20260523170000_obra10_runtime_essencial.sql:176` define a coluna (`CREATE TABLE IF NOT EXISTS` não a adicionou pois a tabela já existia). **4 arquivos** usam a coluna: rota `pendentes` (SELECT → 500), `sugerir-encaminhamento-auto.ts` (INSERT → quebrava distribuição-auto), `notificar-parceiro-lead.ts` (UPDATE → quebrava envio ao parceiro).
- **Fix (aditivo, reversível):** `alter table public.hub_encaminhamentos add column if not exists encaminhado_para text` (migration `fix_hub_encaminhamentos_add_encaminhado_para`). Repara os 3 caminhos de código de uma vez; alinha prod à migration do repo.
- **Provado logado (Playwright):** endpoint `/api/crm/encaminhamentos/pendentes` **200 `{"data":[]}`** (era 500); `/crm/leads` agora **0 erros de console** (antes 5). Tabela vazia → `[]` correto.
- ⚠️ Drift residual a observar: a 2ª query da rota lê `hub_leads_crm.nome/telefone` — verificar se essas colunas existem em leads (lead tem `pessoa_id`; nome/telefone ficam em `hub_pessoas`). Não causa 500 (erro ignorado; só roda se houver encaminhamentos). Deploy não tocado.

### 2026-06-23 — Step 2: refinamento tenant das 8 tabelas por-lead/negócio (user pediu mesmo com ganho ~nulo hoje)
- **Aplicado** `tenant_id` (aditivo) + policies tenant-scoped em `hub_mensagens`, `hub_conversas`, `hub_oportunidades`, `hub_memorias_lead`, `hub_propostas`, `hub_parceiros`, `hub_atividades`, `hub_notas`. Predicado tolera `tenant_id is null`. Ver [bloco-e-step2-tenant-APPLIED.sql](sql/bloco-e-step2-tenant-APPLIED.sql) / [ROLLBACK](sql/bloco-e-step2-tenant-ROLLBACK.sql).
- **Via `execute_sql` statement-a-statement** (apply_migration caía no socket instável; multi-statement idem → fiz singles). Workaround documentado.
- **PROVA:** anon **0** (mensagens/atividades/parceiros/conversas); authenticated lê real (**msg 15, ativ 214, parc 2, conv 5**); `anon_or_public_open=0` mantido; `tenant_scoped_policies=26` (lote1 8 + lote2A 6 + step2 12 select/update). QA logado: `/crm/atendimento` **138/138 conversas**, **0 erros console**.
- ⚠️ **BUG PRÉ-EXISTENTE achado:** `hub_conversas` tem trigger `set_atualizado_em()` que faz `NEW.atualizado_em = NOW()`, **mas a tabela não tem coluna `atualizado_em`** → **qualquer UPDATE em hub_conversas FALHA** (`record "new" has no field "atualizado_em"`). Afeta marcar/encerrar/transferir conversa no app. Por isso o backfill de conversas foi **pulado** (linhas ficam tenant NULL, toleradas pela policy). **Fix recomendado (separado):** ou adicionar `atualizado_em TIMESTAMPTZ` em hub_conversas, ou ajustar o trigger p/ checar a coluna. Não toquei (fora do escopo do Step 2).
- **Honestidade reafirmada:** com helper constante (1 tenant), isto NÃO muda o comportamento hoje — é só estrutura pronta. O ganho real futuro nessas tabelas é RLS por papel, não tenant.

### 2026-06-23 — Step 3a: corrigido trigger `set_atualizado_em` em tabelas sem a coluna (drift)
- **Causa-raiz:** `hub_migration_v2.sql:238` anexa o trigger `BEFORE UPDATE` (`NEW.atualizado_em = NOW()`) a 8 tabelas, mas **2 não têm a coluna no banco vivo**: `hub_conversas` e `hub_whatsapp_config` → **qualquer UPDATE falhava** (`record "new" has no field "atualizado_em"`). Impacto real: conversas (marcar lida/encerrar/transferir) e config do WhatsApp não atualizavam.
- **Fix (aditivo, reversível):** `add column atualizado_em timestamptz not null default now()` nas 2 tabelas. Ver [fix-trigger-atualizado-em.sql](sql/fix-trigger-atualizado-em.sql).
- **Provado:** UPDATE em `hub_conversas` (o backfill de tenant_id que tinha sido pulado) **voltou a funcionar** → conversas agora também com tenant_id backfillado. `_chk23` OK.

### 2026-06-23 — Step 3b / Bloco D (advisors): P0 anon-DELETE corrigido + view SECURITY DEFINER
- **🔴 P0 (mais grave da sessão):** `get_advisors` + verificação direta acharam **9 funções `SECURITY DEFINER` destrutivas executáveis por ANON** (`has_function_privilege('anon',fn,'execute')=true`): `hub_delete_pessoa_crm`, `hub_delete_empresa_crm`, `hub_delete_seguro` (DELETE genérico em qualquer tabela!), `hub_delete_agente_cascade`, `hub_delete_ciclo_cascade`, `hub_delete_cargo_catalogo`, `hub_backup_automatico`, `rls_auto_enable`, `write_audit_log`. Corpo verificado: **sem guarda de papel**; fazem `SET LOCAL app.delete_authorized=true` p/ furar o trigger `block_unauthorized_delete` e deletam. ⇒ qualquer um com a **anon key (do browser)** podia `POST /rest/v1/rpc/hub_delete_pessoa_crm {p_id}` e **apagar PII**. Pior que a exposição de leitura do Bloco E.
- **Fix:** `revoke execute` de public/anon/authenticated; `grant` só `service_role` (server). Callers são todos server-side (service-role) → não quebra. **Provado:** anon execute = **false**; service_role = **true**. Ver [bloco-d-hardening-APPLIED.sql](sql/bloco-d-hardening-APPLIED.sql).
- **ERROR (advisor):** view `vw_hub_auditoria_ferramentas_agentes` era `SECURITY DEFINER` (bypassa RLS do caller) → `set (security_invoker = on)`.
- **Backlog triado (não-bloqueante):** 38 `function_search_path_mutable` (hardening em lote); `pg_net`/`vector` em `public` (mover é arriscado); bucket `capas` permite listagem (`capas_pub_sel`); `auth_leaked_password_protection` desligado (painel); read-helpers anon-executáveis (baixo risco). Detalhe no SQL acima.
