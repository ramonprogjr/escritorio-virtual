# AUDITORIA ENTERPRISE — Obra10+ (Relatório Final Consolidado)

> **Data:** 2026-07-01 · **Escopo:** SaaS multi-tenant IA-first (Next.js 16 App Router + Supabase) rumo à produção
> **Método:** consolidação de 16 frentes adversariais (secrets, auth, authz/IDOR, injeção, RLS/multi-tenant, webhooks/pagamentos/race, IA-security, arquitetura, performance, db-design, observabilidade, devops/infra, UX/a11y, código/deps/testes, produto/IA-first, pentest dinâmico). Achados-chave reverificados no código real (arquivo:linha) por este diretor.
> **Diretor da auditoria:** consolidação cética — dedup, ranqueamento por risco real, rebaixamento de falsos-positivos.

---

## 1. SUMÁRIO EXECUTIVO — estado real de prontidão

**Veredito: REPROVADO para produção multi-tenant. NÃO SUBIR com dados reais de mais de um cliente no estado atual.**

O produto tem uma base funcional rica (CRM, atendimento WhatsApp, agentes de IA, escrow, obra) e boas ideias de segurança **documentadas** — mas a implementação tem uma **falha-raiz catastrófica que invalida quase toda a camada de segurança**, além de vazamentos multi-tenant sistêmicos e um núcleo financeiro contabilmente incorreto.

**A falha-raiz (reverificada agora):** o middleware de autenticação de borda foi escrito em `proxy.ts`. **O Next.js só executa `middleware.ts`** — e esse arquivo **não existe** no repositório (confirmado: `find` retorna vazio; só há `proxy.ts`, importado por nada). Logo, **toda a autenticação/autorização de borda é código morto em runtime**. Cerca de 60 rotas de API dependiam exclusivamente dele e não têm guard próprio; todas usam a `service_role` (que **bypassa a RLS**). Resultado: dezenas de endpoints privilegiados estão abertos à internet, e o "isolamento multi-tenant" repousa apenas em filtros `.eq/.or` no código da aplicação — filtros que, por design (`tenantScopeOrFilter` inclui `tenant_id.is.null`), **vazam entre tenants**.

**Três verdades desconfortáveis que o barômetro de "~90% pronto" esconde:**
1. **O multi-tenant é single-tenant disfarçado.** Sem middleware, com service-role (RLS off), com `tenant_id.is.null` no filtro e com `defaultTenantId()`/`x-vercel-cron` forjáveis, um segundo cliente na plataforma = vazamento de dados no primeiro dia.
2. **O caminho do dinheiro está quebrado por design.** O escrow "libera" de uma custódia que **nunca recebe depósito** (`saldo_custodia = GREATEST(0, 0 - v_valor)` = mentira contábil), a liberação não tem lock (double-spend), a migração de RLS do financeiro usa **sintaxe SQL inválida** (`CREATE POLICY IF NOT EXISTS`) e portanto **falha silenciosamente**, deixando contas a pagar/receber abertas ao `anon`.
3. **A monetização SaaS não existe.** Zero infraestrutura de planos/entitlements/billing. Créditos de IA só debitam (não há como recarregar), o gate só existe em 1 rota e dispara em `< 0` (depois de já ter estourado). Cada tenant não-pagante gera custo direto de tokens ao dono.

**O lado bom (honesto):** o escrow tem dupla-autoridade e idempotência por pagamento; o copiloto usa HMAC + metering + allowlist; o webhook falha-fechado em produção sem secret; H-SEC-1 tirou a chave interna do browser no runtime; há um logger estruturado (embora não adotado); vários módulos (`negocios/[id]`, `obras/[id]`, `usuarios/[id]`, `pessoas/[id]`) já seguem o padrão seguro de tenant-scope — provando que a equipe **sabe** o padrão certo; ele só não foi aplicado uniformemente. **A correção é viável e o caminho é conhecido — mas é grande e não pode ser pulada.**

---

## 2. NOTAS (0–10)

| Dimensão | Nota | Justificativa curta |
|---|---:|---|
| **Arquitetura** | 4.0 | Boa modularidade de domínio, mas fronteira de auth num único ponto morto (`proxy.ts`), 75 cópias de `db()` service-role, god-files (3.896 linhas), 3 APIs de agente paralelas, modelos `*-compat` inacabados. |
| **Segurança** | 1.5 | Middleware não roda → ~60 rotas abertas; JWT de sessão sem verificação de assinatura; service_role de 10 anos viva em OneDrive; cron bypass por header forjável. Colapso sistêmico. |
| **Performance** | 5.0 | Padrões corretos existem (RPC de totais, batch com `.in()`), mas over-fetch sem `limit` + refetch total no realtime + N+1 no motor/agentes + zero virtualização. Degrada abruptamente com volume. |
| **Escalabilidade** | 3.5 | Rate-limit/dedup em `Map` de processo (inútil multi-instância), webhook processa IA inline, fan-out HTTP para si mesmo, saldo O(n) por scan. Não escala horizontal. |
| **UX** | 6.0 | Design coeso e mobile trabalhado, mas zoom desabilitado (a11y crítico), loading infinito no Atendimento, kanban sem teclado, contraste reprovando AA em massa. |
| **Observabilidade** | 3.0 | Logger estruturado existe mas em 2/187 rotas; 358 `catch {}` silenciosos (billing engole erro); `error.message` cru vaza schema em 122 rotas; sem tracing; PII em log. |
| **Qualidade de código** | 4.0 | 666 testes honestos (0 skip) mas ~4% de cobertura de rotas e ~8% no dinheiro; sem ESLint; sem CI; deps vulneráveis (Next 4 advisories, `ws` High). |
| **DevOps** | 3.0 | Workflow que faz `git push` de PII de leads; cron único frágil e sem retry; sem healthcheck; sem CI; segredo interno no bundle; sem rollback declarado. |
| **IA-first** | 5.0 | Motor de agentes real e útil, mas prompt-injection via `pushName`, memory-poisoning cross-lead, RAG cross-tenant, autonomia WhatsApp sem gate, metering cego em ~12/15 pontos. Chatbot bom; "cérebro da obra" ainda é design. |
| **NOTA GERAL** | **3.5 / 10** | Base promissora e recuperável, mas **não apta a produção multi-tenant**. Gate zero: middleware, isolamento de tenant, RLS e núcleo financeiro. |

---

## 3. AS 50 MELHORIAS MAIS IMPORTANTES

> Formato: **#. [Gravidade] Título** — Frente · `arquivo:linha` · esforço aprox.
> Gravidade: 🔴 Crítica · 🟠 Alta · 🟡 Média · 🟢 Baixa

1. 🔴 **Middleware de auth não roda (arquivo é `proxy.ts`, não `middleware.ts`)** — auth/arquitetura/pentest · `proxy.ts` (raiz sem `middleware.ts`) · **2h** (renomear/re-exportar) + verificação.
2. 🔴 **~60 rotas sem guard in-handler, com service-role (RLS off)** — auth/injeção/pentest · `app/api/hub/agentes/**`, `app/api/leads/route.ts`, `app/api/hub/cargos/**` · **24–40h**.
3. 🔴 **Identidade do chamador confia em JWT sem verificar assinatura** — auth · `lib/crm/crm-api-auth.ts:16-40,89-98` · **6h**.
4. 🔴 **`public.users` com policy `USING(true)` FOR ALL → auto-escalação a owner via anon key** — RLS · `supabase/migrations/20260522210000_public_users_app_access.sql:69-71` · **4h**.
5. 🔴 **`tenantScopeOrFilter` inclui `tenant_id.is.null` → vazamento cross-tenant em ~20–41 rotas** — RLS/arquitetura/authz · `lib/tenant-default.ts:51-58` · **8h** + migração backfill.
6. 🔴 **Escrow libera de custódia fantasma (`GREATEST(0, 0 - v)`), sem RPC de depósito** — pagamentos · `supabase/migrations/20260730120000_e6_...escrow.sql:482-485` · **12h**.
7. 🔴 **Race no `rpc_liberar_escrow` sem `FOR UPDATE` → double-spend** — pagamentos/db · `...escrow.sql:424,455-485` · **4h**.
8. 🔴 **RLS do financeiro usa `CREATE POLICY IF NOT EXISTS` (SQL inválido) → migração falha, contas a pagar/receber ficam abertas ao anon** — RLS · `supabase/migrations/20260631120000_seg_rls_financeiro_tenant.sql:38-75` · **3h**.
8b. 🔴 **`hub_pessoas`/`hub_empresas` com policy anon `USING(true)` (PII de todos os tenants)** — RLS · `supabase/migrations/20260523150000_crm_rls_extended.sql:25-37` · **4h**.
9. 🔴 **`hub_pipelines`/`hub_pipeline_estagios`/`hub_negocio_vinculos` `USING(true)` + GRANT ALL anon** — RLS · `20260620180000_hub_pipelines_vinculos.sql:152-162` · **4h**.
10. 🔴 **`hub_fornecedores` (fonte do motor de leads) SEM RLS** — RLS · `20260701120000_hub_fornecedores_espelho_motor.sql:8` · **2h**.
11. 🔴 **`PATCH /api/leads` mass-assignment + IDOR sem auth (`{id,...updates}` → `.eq("id")`)** — pentest/authz · `app/api/leads/route.ts:74-83` · **3h**.
12. 🔴 **IDOR módulo Imóveis (GET/POST/PATCH ignoram tenant)** — authz · `app/api/crm/imoveis/route.ts:28-47`, `[id]/route.ts:46-51` · **4h**.
13. 🔴 **Família `/api/cotacoes/*` sem auth/tenant (caminho do dinheiro)** — pentest/código · `app/api/cotacoes/pedidos/route.ts:8-52` (+`[id]`, `submeter-aprovacao`, `respostas`) · **8h**.
14. 🔴 **BOLA envio WhatsApp + handoff cross-tenant** — authz · `app/api/crm/atendimento/send/route.ts:57-90`, `lib/crm/atendimento-handoff.ts:106-113,203-210` · **6h**.
15. 🔴 **Webhook autenticado por segredo em query string (não HMAC real) → leak em logs + replay ilimitado** — pagamentos/secrets · `app/api/whatsapp/webhook/route.ts:95-99`, `lib/whatsapp/uazapi-webhook-sync.ts:47` · **8h**.
16. 🔴 **`cronRequestAuthorized` confia em `x-vercel-cron:1` forjável (app roda no Render) + secret via query** — secrets/devops/pentest · `lib/cron-auth.ts:10,15` · **2h**.
17. 🔴 **Workflow `backup-auto.yml` faz `git push` de PII de leads ao histórico do Git** — devops · `.github/workflows/backup-auto.yml:20-35` · **1h** (deletar).
18. 🔴 **SUPABASE_SERVICE_ROLE_KEY viva em `.env.local` (pasta OneDrive), JWT válido até 2036** — secrets · `.env.local:8` · **2h** (rotacionar + tirar do OneDrive).
19. 🔴 **RAG cross-tenant (`match_...rag_chunks` sem `tenant_id`, RLS sem policy)** — IA · `lib/hub/rag.ts:561`, `20260606120000_...rag_pgvector.sql:97` · **6h**.
20. 🔴 **Prompt injection via `pushName` do WhatsApp no system prompt** — IA · `lib/crm/sincronizar-contato-whatsapp.ts:142`, `lib/ia/engine.ts:242` · **6h**.
21. 🔴 **Memory poisoning: texto do lead vira memória de agente reinjetada cross-lead** — IA · `lib/ia/engine.ts:422`, `lib/ia/memoria-agente.ts:90` · **8h**.
22. 🔴 **Monetização SaaS/entitlements NÃO existe (zero guard de plano/módulo)** — produto · `app/api/**` (ausência) · **40h+**.
23. 🔴 **Créditos IA: hard-cap só em 1 rota, gate `< 0`, sem caminho de recarga** — produto/pagamentos · `app/api/copiloto/interpretar/route.ts:42`, `lib/ia/metering.ts` · **16h**.
24. 🔴 **Copiloto resolve tenant como `defaultTenantId()` p/ todo usuário (cross-tenant na escrita)** — produto/pentest · `lib/copiloto/copiloto-auth.ts:26-27` · **6h**.
25. 🔴 **`hub_alertas` schema drift (colunas inseridas inexistentes na migração) + sem tenant/RLS** — produto/db · `app/api/whatsapp/webhook/route.ts:628`, `20260523170000_...:193` · **4h**.
26. 🔴 **Zoom desabilitado globalmente (`userScalable:false`)** — UX/a11y · `app/layout.tsx:49-50` · **0.5h**.
27. 🔴 **Loading infinito no Atendimento (fetch sem try/catch/res.ok)** — UX · `app/crm/atendimento/page.tsx:181-208` · **2h**.
28. 🔴 **Tela de Leads: fetch da view inteira sem `limit` + refetch total no realtime** — performance · `app/crm/leads/page.tsx:235,352` · **8h**.
29. 🟠 **Rotas service-role caem em silêncio para ANON_KEY (`|| ANON_KEY`)** — secrets/db/código · `app/api/parceiro/cadastro-publico/route.ts:23` (+~19 rotas) · **6h**.
30. 🟠 **`requireInternalApiKey` fail-open quando chave ausente + `x-caller-auth-id` forjável** — auth/produto · `lib/crm/crm-api-auth.ts:48-67` · **3h**.
31. 🟠 **75 rotas com `function db()` service-role copiado (fallback anon divergente)** — arquitetura · `app/api/hub/cargos/route.ts:9` (+72) · **12h**.
32. 🟠 **Injeção de filtro PostgREST via `busca` em `.or()` (bypass de tenant)** — injeção · `app/api/crm/imoveis/route.ts:42`, `negocios:323`, `leads:163` · **6h**.
33. 🟠 **Endpoints que disparam LLM sem auth → DoS de custo financeiro** — injeção/IA · `app/api/hub/agentes/sugerir-conhecimento/route.ts:31` (+chats) · **6h**.
34. 🟠 **Aprovação dupla do escrow burlável por 1 pessoa; `aprovado_por` = string fixa "humano"** — pagamentos · `lib/ia/aprovacoes.ts:313-337` · **6h**.
35. 🟠 **Dedup/rate-limit em `Map` de processo (inútil multi-instância)** — pagamentos/IA/injeção/produto · `app/api/whatsapp/webhook/route.ts:33`, `lib/copiloto/copiloto-core.ts:244`, `lib/portal-rate-limit.ts:5` · **12h** (Redis/Postgres).
36. 🟠 **Metering sem gate atômico + saldo negativo ilimitado + cego em ~12/15 pontos de IA** — pagamentos/produto · `lib/ia/metering.ts:98-136`, `lib/ia/engine.ts:365` · **12h**.
37. 🟠 **`valor` do pagamento não validado contra orçamento aprovado (superfaturamento)** — pagamentos · `app/api/crm/obras/[id]/financeiro/route.ts:424-478` · **6h**.
38. 🟠 **Autonomia de IA ilimitada no WhatsApp (bypass de hierarquia/limite)** — produto/IA · `lib/ia/router.ts:352` · **4h**.
39. 🟠 **`system_prompt` + PII persistido em `hub_prompt_logs` sem redação/RLS** — IA/observabilidade · `lib/ia/engine.ts:377-393` · **6h**.
40. 🟠 **Ferramenta custom pode mapear qualquer builtin de escrita + `smart_prompt` livre** — IA · `app/api/hub/ferramentas-custom/route.ts:65`, `lib/hub/executar-ferramenta-ia.ts:609` · **6h**.
41. 🟠 **Derivação obra/projeto não-idempotente no DB (duplica entrega) + operações compostas sem transação** — db · `lib/crm/derivar-entrega.ts:48-73`, `app/api/crm/leads/[id]/converter-negocio/route.ts:130-176` · **10h**.
42. 🟠 **Contador de código tenant-blind + fallback COUNT global cross-tenant (dup + leak)** — db · `20260704120000_crm_codigo_rastreio_rpc.sql:22-47`, `lib/crm/codigos-rastreio.ts:74-77` · **6h**.
43. 🟠 **Índices/FK ausentes em `hub_negocios`/`hub_leads_crm` (`pessoa_id`, `lead_id`, `empresa_id`) → seq scan no merge** — db · `20260522120000_ensure_hub_negocios.sql:11-12`, `20260522130000_ensure_hub_leads_crm.sql:29-34` · **3h**.
44. 🟠 **`NEXT_PUBLIC_INTERNAL_API_KEY` ainda declarado (Render/`.env`/README) → chave interna no bundle** — secrets/devops/pentest · `render.yaml:71-72`, `.env.example:15` · **2h**.
45. 🟠 **Sem CI (tsc/vitest/lint/audit) + sem ESLint + deps vulneráveis (Next 16.2.4, `ws` High, `postcss`)** — devops/código · `.github/workflows/`, `package.json:38` · **8h**.
46. 🟠 **Kanban de Negócios: mudar etapa impossível por teclado no desktop** — UX/a11y · `app/crm/negocios/page.tsx:575`, `NegocioKanbanCard.tsx:132` · **4h**.
47. 🟠 **Contraste insuficiente em massa (`#484f58`/`#8b949e`) + sem `prefers-reduced-motion`** — UX/a11y · `app/globals.css:75-76` · **6h**.
48. 🟠 **Motor de distribuição não distribui/redistribui (sugestão sem persistência/SLA)** — produto/performance · `lib/crm/distribuir-lead.ts`, `app/api/crm/distribuicao/fila/route.ts:126` (N+1) · **20h**.
49. 🟠 **`hub_lead_lookup_por_telefone` (auto-exec no copiloto) sem `.eq(tenant_id)`** — IA · `lib/hub/executar-ferramenta-ia.ts:110-157` · **2h**.
50. 🟠 **Logger não adotado (2/187), `error.message` cru vaza schema (122 rotas), 358 `catch {}` silenciosos (billing engole erro)** — observabilidade · `lib/observability/hub-log.ts`, `lib/ia/metering.ts:119` · **16h**.

**Menções honrosas (🟡/🟢, fora do top-50):** reset de senha sem revogação global de sessões (`app/redefinir-senha/page.tsx:58`); cookie `sameSite:lax` + TTL do cliente sem CSRF (`crm-session/route.ts:67`); upload RAG sem magic-number (`rag-documentos/route.ts:129`); sem headers de segurança/CSP (`next.config.ts`); build acoplado à rede + TLS off (`package.json:11`); god-folder `lib/crm` (~150 arquivos); `/office` sobre mocks paralelos; migrações com timestamps duplicados; divergência file×prod institucionalizada; falta de `<main>`/skip-link; error boundaries quase nulas; link de portal de parceiro sem expiração.

---

## 4. ROADMAP POR PRIORIDADE

### 🔴 CRÍTICO — corrigir IMEDIATAMENTE (bloqueia go-live) · ~90–120h

| Ação | Esforço | Impacto |
|---|---:|---|
| Rotacionar `service_role` no Supabase + tirar repo/`.env` do OneDrive + deletar `backup-auto.yml` (PII no Git) | 4h | Fecha vazamento de credencial-mestre e de PII permanente. |
| Criar `middleware.ts` (re-export de `proxy`) **e** adicionar guard in-handler + tenant-scope nas ~60 rotas abertas | 40h | Fecha bypass total de auth/multi-tenant em endpoints privilegiados. |
| Verificar assinatura do JWT de sessão (`fetchAuthUserFromAccessToken`) antes de confiar no `sub` | 6h | Elimina impersonação por cookie forjado nas 127 rotas guardadas. |
| Migração de RLS: corrigir `USING(true)` (users/pessoas/empresas/pipelines/vínculos), ligar RLS em `hub_fornecedores`, corrigir `CREATE POLICY IF NOT EXISTS` do financeiro | 20h | Fecha escalação de role + PII + financeiro abertos ao anon. |
| Backfill `tenant_id NOT NULL` + trocar `tenantScopeOrFilter` por `.eq('tenant_id')` puro (matar `is.null`) | 12h | Fecha vazamento cross-tenant sistêmico. |
| Escrow: bloquear liberação sem custódia suficiente (remover `GREATEST`), criar RPC de depósito, `SELECT ... FOR UPDATE` + UNIQUE parcial de liberação | 16h | Restaura a integridade contábil e mata o double-spend. |
| Cron: remover atalho `x-vercel-cron`, exigir `CRON_SECRET` timing-safe, tirar secret da query | 3h | Fecha disparo remoto de jobs/WhatsApp/IA. |
| Webhook: HMAC real com timestamp+nonce (anti-replay), segredo em header (nunca query) | 8h | Fecha injeção/replay na porta de dinheiro e dados. |

### 🟠 ALTO — antes da produção · ~120–160h

| Ação | Esforço | Impacto |
|---|---:|---|
| Guard + tenant-scope em `/api/cotacoes/*`, `/api/atividades`, `/api/crm/encaminhamentos/*`, IDOR de `imoveis`/`pedidos`/`vinculos`/`nota`/`canais`/`regras`/`liberar` | 30h | Fecha IDOR/BOLA/BFLA cross-tenant remanescentes. |
| Copiloto: resolver tenant real (não `defaultTenantId`) + assinar `userId`+`tenantId` no HMAC | 8h | Fecha escrita cross-tenant e replay de confirmação. |
| Créditos IA: gate atômico `assertSaldo` ANTES de toda chamada LLM + caminho de recarga + saldo materializado | 20h | Estanca custo descontrolado; habilita a 3ª perna de receita. |
| Entitlements SaaS: `hub_planos`/`hub_tenant_assinatura` + `requireModulo()` por módulo | 40h | Torna o produto vendável e com porteira de custo. |
| Prompt-injection/memory-poisoning/RAG cross-tenant: delimitar dados não confiáveis, filtrar RAG por tenant, restringir extração de memória a fontes confiáveis | 20h | Protege o núcleo IA-first e a LGPD. |
| Rate-limit/dedup distribuído (Redis/Postgres) + processar WhatsApp só no worker (`worker_only`) | 16h | Habilita escala horizontal sem dupla-cobrança/dupla-resposta. |
| Remover fallback `||ANON_KEY` (fail-closed), unificar em `crmDb()`, ESLint proibindo service-role fora de `lib/` | 12h | Elimina comportamento de segurança não-determinístico. |
| CI (tsc+vitest+eslint+`npm audit`) bloqueante + subir Next→16.2.9 + healthcheck `/api/healthz` + cron desacoplado | 16h | Barreira automatizada contra regressão; deploy confiável. |
| UX crítico: reabilitar zoom, try/catch no Atendimento, kanban por teclado, contraste AA, `prefers-reduced-motion` | 16h | Remove gate de acessibilidade (LBI/ADA) e loading infinito. |

### 🟡 MÉDIO — próxima sprint · ~80–100h

- Performance: paginação + realtime incremental + memoização + virtualização (`@tanstack/react-virtual`); N+1 do motor/agentes/cron para batch/agregação SQL. **~30h** · destrava telas com volume real.
- Observabilidade: adotar `createHubLogger` em todas as rotas (wrapper `withApiLogger`), redigir `error.message`, corrigir `catch {}` do dinheiro/IA/auth, `LOG_LEVEL`+Sentry no deploy. **~24h**.
- DB: transação/RPC nas operações compostas (converter-negócio, derivar-entrega); UNIQUE em `negocio_id`; índices/FK ausentes; contador de código por tenant; reconciliar file×prod (`supabase db diff`). **~20h**.
- Reset/logout revogando sessões globais; CSRF em mutações + `sameSite:strict`/`__Host-`; validação de posse em vínculos/especialistas; BFLA `tenants/[id]`. **~16h**.
- Portal de parceiro com expiração; upload RAG com magic-number + bucket privado. **~8h**.

### 🟢 BAIXO — contínuo · ~60h

- Refatorar god-files (wizard 3.896 linhas → `useReducer`/passos); consolidar 3 APIs de agente; remover `/office` mock e `agents-mock.json`; fechar migrações `*-compat`.
- Headers de segurança/CSP; tirar `verify:progresso` do build; `.dockerignore`; error boundaries (`app/crm/error.tsx`, `not-found.tsx`); `<main>`+skip-link; `EmptyState` rico.
- Segredos de dev hardcoded → aleatórios; política de rotação trimestral + secret scanning; DR testado (restore + PITR + alerta em falha).

---

## 5. RISCOS SE NADA FOR CORRIGIDO

1. **Vazamento massivo multi-tenant / LGPD:** com um 2º cliente, PII de leads/clientes (nome, telefone, CPF/CNPJ), pipeline comercial e financeiro de um escritório ficam legíveis/graváveis por concorrentes — via anon key direto no Postgres, via rotas abertas e via `tenant_id.is.null`. Risco jurídico direto (LGPD art. 6º) e reputacional terminal.
2. **Comprometimento total por anônimo:** ~60 rotas privilegiadas (criar/editar/deletar agentes, cargos, playbooks; derrubar a linha WhatsApp; disparar crons e IA) acessíveis sem login. CVSS ~9.8.
3. **Escalação de privilégio:** qualquer usuário faz `update(users) role='owner'` (RLS `USING(true)`) ou forja cookie (`sub` não verificado) → impersona qualquer owner.
4. **Perda financeira e fraude:** escrow libera dinheiro que nunca entrou (contabilidade falsa auditável pelo cliente — quebra a "alma do produto"), double-spend por race, superfaturamento sem teto, aprovação dupla burlável por 1 pessoa sem trilha de quem aprovou.
5. **Custo de IA/WhatsApp descontrolado:** endpoints LLM sem auth + créditos sem gate + cron forjável = qualquer um esgota a chave Mistral/Anthropic e o saldo WhatsApp; conta cresce em dinheiro real, sem porteira de plano.
6. **Envenenamento do atendimento ao cliente:** prompt-injection (`pushName`), memory-poisoning cross-lead e RAG cross-tenant fazem o agente mudar de comportamento para todos os clientes e vazar documentos entre empresas.
7. **Indisponibilidade e cegueira operacional:** sem healthcheck/CI/rollback, um deploy quebrado sobe como "saudável"; sem tracing e com 358 `catch {}` silenciosos, incidentes (inclusive de dinheiro) são invisíveis; a fila WhatsApp pode parar sem ninguém saber.
8. **Não escala:** rate-limit/dedup em memória + IA inline no webhook colapsam à primeira rajada real ou à primeira réplica extra.

---

## 6. SUGESTÕES (refatoração · arquitetura · automação IA-first · custo · performance · segurança)

**Refatoração**
- Extrair `crmDb()`/`supabaseAdmin()` único (fail-closed, sem fallback anon) e deletar as 75 `db()` locais; ESLint `no-restricted-syntax` proibindo `createClient(...SERVICE_ROLE...)` fora de `lib/`.
- Wizard de agente e páginas-deus: `useReducer`/máquina de estado + hooks de dados (react-query já é dependência), meta ~400 linhas/componente.
- Consolidar as 3 árvores de API de agente em `/api/hub/agentes`; remover `/api/agents/*` (grava em disco efêmero) e `/office` mock.

**Arquitetura**
- Padrão único de rota: `withCaller(role, handler)` que injeta `ctx.tenantId` e nega por default; allowlist explícita e auditável de rotas públicas; teste de CI que falha se um `route.ts` (fora da allowlist) não referenciar guard nem `.eq('tenant_id')`.
- **Considerar client com RLS real** (anon + JWT do usuário) nas leituras, tornando a RLS o backstop verdadeiro — hoje o service-role torna toda a RLS decorativa.
- Emitir **um único** mecanismo de tenant (`current_user_tenant_id()`), removendo policies `*_auth_claim` órfãs que dependem de um claim JWT nunca emitido.

**Automação IA-first (a alma do produto, hoje só design)**
- Priorizar a capability-mãe: **memorial PDF → planilha de orçamento** sobre a taxonomia existente (humano confirma quantidades v1), medindo tokens desde o 1º token.
- Central de Aprovações que auto-aprova o trivial e **aprende** com a decisão; Gestor de Tarefas universal (verbo→tarefa executada por agente).
- Wrapper único de LLM que **sempre** chama `registrarConsumoIA` — nenhuma chamada de modelo fora dele (fecha o metering cego).

**Redução de custos**
- Gate de saldo ANTES do LLM + rate-limit distribuído; política de modelo por criticidade (barato no trivial, caro só no crítico) em vez de sentinela default.
- Agregação em SQL (`sum`/`count`/`group by`/RPC) em vez de baixar linhas para somar no app (saldo O(1) materializado, pipeline totais, agentes).
- Tirar `verify:progresso` (rede + TLS off) do build → builds determinísticos e mais rápidos.

**Aumento de performance**
- Paginação (`.limit`/`.range`) + realtime incremental (patch da linha, `filter: tenant_id=eq.<id>`) + memoização + virtualização nas listas/kanbans.
- Índices/FK ausentes (`pessoa_id`, `lead_id`, `empresa_id`, `catalogo_id`); processar WhatsApp só no worker dedicado; fan-out do dispatcher in-process com timeout.

**Aumento de segurança**
- Verificação de JWT server-side; fail-closed em toda credencial ausente; HMAC real (timestamp+nonce) no webhook e no copiloto (com `userId`+`tenantId`); revogação global de sessão no reset/logout.
- Headers de segurança/CSP no `next.config.ts`; secret manager (Doppler/Render Secret Files) + rotação trimestral + push-protection no GitHub; redigir PII e `error.message` de todo log/resposta.
- Migrar service-role legado (JWT de 10 anos) para *secret API keys* revogáveis (`sb_secret_...`).

---

## 7. CENÁRIOS DE ATAQUE + TESTES MANUAIS DE PENTEST

> **Modelo de ameaça:** app no Render, service-role em todas as rotas (RLS bypassada), middleware morto → cada handler é o único guarda; muitos não guardam. Degrau mínimo do atacante: uma sessão válida qualquer (até um tenant recém-criado via `/cadastre-se`) — ou, em várias rotas, nenhuma sessão.

**Top-10 ataques mais prováveis (passo a passo + teste):**

1. **Bypass total de rotas privilegiadas.** `curl https://APP/api/hub/cargos` → hoje **200** (deveria 401). *Teste:* após o fix, esperar 401 sem cookie/x-api-key.
2. **Escalação a owner via anon key.** `supabase.from('users').update({role:'owner'}).eq('auth_id', <meu>)` com a anon key pública do bundle. *Teste:* deve dar erro de RLS; hoje passa (`USING(true)`).
3. **Impersonação por cookie forjado.** Montar `obra10_crm_access` com `{"sub":"<UUID-de-owner>"}` e assinatura arbitrária. *Teste:* rota guardada deve rejeitar; hoje `decodeJwtSub` aceita.
4. **`PATCH /api/leads` roubo de lead.** `{"id":"<lead-de-B>","tenant_id":"<meu>","humano_responsavel":"me"}`. *Teste:* deve 403/404; hoje grava (mass-assignment).
5. **Bypass de cron.** `curl -H "x-vercel-cron:1" https://APP/api/ciclos/diretor?ciclo=analise_noite` → dispara IA + WhatsApp em massa. *Teste:* deve 401 no Render.
6. **Vazamento de licitação.** Logado como qualquer tenant: `GET /api/cotacoes/pedidos` → `GET .../[id]` → lê preços de fornecedores de todos; `POST .../respostas` injeta proposta mais barata; `POST .../submeter-aprovacao` escolhe o atacante. *Teste:* isolamento por tenant + auth.
7. **Sequestro/derrubada da linha WhatsApp.** `POST /api/hub/agentes/<slug>/uazapi {"action":"delete_remote"}` sem auth. *Teste:* exigir owner + escopo de tenant do slug.
8. **Prompt-injection persistente.** `POST /api/hub/agentes/<slug>/playbook/upload` (anônimo) reescreve o cérebro do agente de atendimento. *Teste:* guard + sanitização.
9. **Double-spend de escrow.** Disparar `PATCH /api/hub/aprovacoes/[arq]` e `[hub]` em paralelo no instante de ambas aprovadas. *Teste:* `FOR UPDATE` + UNIQUE parcial de liberação devem serializar; hoje o SELECT-sem-lock permite dupla liberação.
10. **Balde compartilhado `tenant_id NULL`/default.** Ler/editar negócio/obra legado por `[id]` a partir de outro tenant (via `tenantScopeOrFilter`). *Teste:* após backfill+`.eq` puro, esperar 404.

**Injeção de filtro PostgREST (bypass de tenant via busca):** `?busca=foo),tenant_id.not.is.null,or(codigo.ilike.%` em `/api/crm/imoveis|negocios|leads` fecha o `ilike` e injeta condições no `.or()`. *Teste:* sanitizar `,()."\\*:%` ou mover para RPC parametrizada.

**Riscos que só se confirmam com a app rodando (validar em ambiente):**
- Se `NEXT_PUBLIC_INTERNAL_API_KEY` está de fato embutida no bundle de produção (`grep` no `.next/static` do deploy) — se sim, extrair a chave e forjar `x-api-key`+`x-tenant-id`.
- Força/entropia reais do `WEBHOOK_SECRET`, do HMAC de `parceiroPortalValido` e rotação.
- Se as RPCs `SECURITY DEFINER` (`rpc_liberar_escrow`, `hub_delete_cargo_catalogo`, `rpc_aprovar_orcamento_frente`) reforçam tenant **dentro** do banco.
- Rate-limit em memória sob múltiplas instâncias Render (o `Map` não é compartilhado → força-bruta/DoS viável).
- Estado REAL do schema vs. migrações (`supabase db diff`) — dada a divergência file×prod institucionalizada e o `hub_alertas` schema drift.

---

## NOTA DE MÉTODO E CETICISMO

Este relatório deduplicou achados que apareceram em múltiplas frentes (o **middleware morto** e o **`x-vercel-cron`** apareceram em 5+ frentes; o **`tenant_id.is.null`** em 5; o **fallback anon** em 4) e os promoveu a raiz. Falsos-positivos rebaixados/anotados: o segredo de dev hardcoded do copiloto é **mitigado** por fail-closed em produção (Baixa); o `/office` com RAF contínuo é **código morto** hoje (Baixa, risco latente); `/api/health` owner-only é defensável (a lacuna real é a **ausência de um `/healthz` público**); o TLS-inseguro é **só dev/scripts**. Achados de RLS/schema dependem de confirmar o **estado real de produção** (o repo não prova o banco vivo — vide divergência file×prod), motivo pelo qual "rodar `supabase db diff`" e um scan de bundle são pré-requisitos antes de fechar tickets. Findings-chave (middleware, cron, `users USING(true)`, escrow `GREATEST`, `CREATE POLICY IF NOT EXISTS`, `leads`/`imoveis` IDOR, `cotacoes` sem auth, `hub_fornecedores` sem RLS, RAG sem tenant, `backup-auto.yml`) foram **reverificados no código real** por este diretor.
