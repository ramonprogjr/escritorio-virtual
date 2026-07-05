# 🔒 Auditoria exaustiva — anti-padrão `tenant_id.is.null` (over-share cross-tenant)

> **05/jul/2026.** Workflow adversarial (23 agentes, 0 erros): classifica cada site do padrão `.or(...is.null)` / `.is("tenant_id", null)`, verifica ceticamente + checa o DB de prod (backfill?). **Só auditou — nada foi editado por aqui.** Gatilho: follow-up §4.4 (alinhar dedup ao `.eq` puro). Regra canônica: memória `tenant-null-leak-pattern`.

## Contexto do risco
`crmDb()`/service_role **bypassa RLS** → o filtro app-level `.eq("tenant_id", X)` é a **única** barreira de tenant. `.or("tenant_id.eq.X,tenant_id.is.null")` num read/dedup user-facing **vaza** linhas órfãs/legadas de outro tenant (over-share) ou vira **oráculo de existência**. MAS: `.is("tenant_id", null)` **puro** que busca de propósito os registros GLOBAIS/DEFAULT do sistema é **legítimo** — "corrigir" quebra a feature.

## Placar: 5 leaks reais (todos LATENTES) · 6 intencionais (não mexer)
**Nenhum leak é explorável HOJE** — só 1 tenant provisionado (Obra10) e ~0 linhas `tenant_id NULL` vivas. Mas os 5 **disparam sozinhos** no minuto do multi-tenant go-live ou ao surgir 1 linha NULL. Por isso todos = **medium** (defeito real, regra violada, mas não sangrando agora). Inflar p/ high seria desonesto.

| site | arquivo:linha | tabela | classe | sev | backfill? | fix |
|---|---|---|---|---|---|---|
| ✅ especialista (JÁ FEITO `a2b2566`) | app/api/crm/especialistas/route.ts:24,59 | hub_especialistas (0 linhas) | leak | — | não | `.or→.eq` puro **aplicado** |
| fornecedores-list | app/api/crm/fornecedores/route.ts:27 | hub_fornecedores (7, 0 NULL) | **leak** | medium | não | `.or→.eq("tenant_id",tenantId)` — gêmeo idêntico do especialista |
| alertas-parados | app/api/crm/alertas/parados/route.ts:28 | hub_leads_crm (9, 0 NULL) | **leak** | medium | não | `.or→.eq` — protege PII de lead (nome/tel/valor) |
| canais-entrada | app/api/crm/canais-entrada/route.ts:20 | hub_canais_entrada (0) | **leak** | medium | não | `.or→.eq`; manter `.eq("ativo",true)`; +RLS |
| auditor-autonomo | lib/crm/auditor-autonomo.ts:38 | hub_eventos (33, 0 NULL) | **leak** | medium | não | `q.or→q.eq`; +guarda de tenant no SELECT de hub_parceiros `.in("id",ids)` (l.71-74) |
| **helper→buscar-pessoa** | lib/tenant-default.ts:51 → lib/crm/buscar-pessoa-documento.ts:47 | hub_pessoas (17, **1 NULL**) | **leak** | **SIM** | oráculo de CPF/CNPJ; **precisa janela** (ver Faixa B) |
| obras-estoque | app/api/crm/obras/[id]/estoque/route.ts:83 | hub_catalogo (47/47 NULL) | intencional | none | não | **NENHUM** — catálogo global; espelha RLS `hub_catalogo_sel` |
| ia-config | app/api/crm/ia/config/route.ts:25 | hub_ia_config (1/1 NULL) | intencional | none | não | **NENHUM** — singleton `.is(null)` puro, owner-only |
| projetos-id | app/api/crm/projetos/[id]/route.ts:166 | hub_pipelines (20/20 NULL) | intencional | none | não | **NENHUM** — `.is(null)` puro, slug fixo `projetos-arq` (seed A0), não user-facing |
| exec-estoque | lib/hub/executar-ferramenta-estoque.ts:73 | hub_catalogo | intencional | none | não | **NENHUM** — `.eq` puro zeraria a resolução de material da IA |
| exec-arq | lib/hub/executar-ferramenta-arq.ts:75 | hub_pipelines | intencional | none | não | **NENHUM** — pipeline global de projeto |
| criar-obra-eap | lib/obras/criar-obra-com-eap.ts:119 | hub_obra_taxonomia (16/16 NULL) | intencional | none | não | **NENHUM** — `.eq` puro esvaziaria o mapa código→id (FK `taxonomia_id` nasceria null) |

## Plano: UMA onda RLS/tenant, duas faixas
**FAIXA A — CODE-SAFE (pode ir já, sem janela).** 4 endpoints, troca mecânica `.or→.eq`, risco zero porque `dbTenantNull=0` em todos (o `.eq` puro não esconde nenhuma linha viva): **fornecedores-list, alertas-parados, canais-entrada, auditor-autonomo** (este leva também a guarda de tenant no SELECT de `hub_parceiros`). Um commit, gate `tsc+vitest`, deploy.

**FAIXA B — PRECISA DA JANELA DO DONO (1 item, `backfillNeeded=true`).** `buscar-pessoa-documento` (helper). Aqui o `.or` é **oráculo de existência de CPF/CNPJ** (o helper ainda bakeia um ramo `eq.DEFAULT_OBRA10`) e há **1 linha NULL viva** em `hub_pessoas`. Sequência obrigatória: (1) backfill `UPDATE hub_pessoas SET tenant_id='00000000-0000-4000-8000-000000000001' WHERE tenant_id IS NULL`; (2) `.or→.eq` puro; (3) **reescrever o teste** `buscar-pessoa-documento.test.ts:45-50` (hoje institucionaliza o leak); (4) `UNIQUE(tenant_id, documento)` (hoje unique é global por documento); (5) guarda `row.tenant_id!==tid=>null` em `salvar-super-cadastro` e `garantir-pessoa-lead`.

**DÍVIDA RESIDUAL (rastrear, auditoria própria):** o helper `tenantScopeOrFilter` é a raiz do mesmo padrão em `app/api/leads/route.ts`, `app/api/parceiros/route.ts`, `app/api/parceiros/[id]/route.ts`, `lib/crm/atendimento-handoff.ts`.

**NÃO TOCAR nos 6 intencionais** (hub_catalogo, hub_ia_config, hub_pipelines, hub_obra_taxonomia): master-data `NULL=global`, o `.or/.is(null)` espelha RLS sancionada; `.eq` puro **quebra feature**. Se um dia isolar melhor: coluna `escopo='global'` explícita, nunca atribuir tenant às linhas globais.
