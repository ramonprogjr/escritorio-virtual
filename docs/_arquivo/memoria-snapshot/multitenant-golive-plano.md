---
name: multitenant-golive-plano
description: Plano de go-live multi-tenant (PARADO — dono foi pro módulo Arquitetura); retomar daqui. Inclui furo do header forjável + decisão do modelo de parceiro
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Análise de prontidão multi-tenant (28/jun, workflow wuhz7p135).

**▶️ STATUS / PONTO DE RETOMADA (28/jun noite):** dono ESCOLHEU o modelo **(A) TENANT PRÓPRIO (isolamento real)** e mandamos começar a **Fase 1 (isolamento)**. JÁ FEITO + verificado (tsc+vitest+build verdes) + **commitado LOCAL `9be8fe7` (NÃO pushado)**: a BLINDAGEM de `lib/tenant-default.ts` (`tenantIdFromRequest` só honra `x-tenant-id` com `x-api-key`=INTERNAL — fecha o furo forjável) + 2 rotas via sessão (`alertas/parados`, `analytics`). PARAMOS porque a **internet do dono estava instável** (derrubou subagentes + Google Fonts no build). **RESUME EM 1 COMANDO:** `git push origin wendel/dev:feature/escritorio-visual` (build já passou) → depois COMPLETAR Fase 1 (restam ~14 rotas + encaminhamentos + gerar-por-ia + copiloto-auth — ver lista "FAÇO AGORA" abaixo). Produção intocada (estado bom `0204edf`); backups `backup-sistema-ok-28jun` e `backup-pre-multitenant-28jun` no GitHub. Prontidão: **~55% p/ 1 tenant, ~25% p/ ligar o 2º com segurança.** A sessão já resolve tenant pelo cookie (`getCallerContext`), mas o ISOLAMENTO não está fechado.

**⚠️ MAIOR RISCO (furo real, hoje LATENTE em single-tenant):** `tenantIdFromRequest` (`lib/tenant-default.ts:69`) honra `x-tenant-id` forjável **mesmo sem a chave interna**, e `NEXT_PUBLIC_INTERNAL_API_KEY = INTERNAL_API_KEY` (a chave vai ao browser) → qualquer um forja o tenant. **10 rotas** usam esse header (algumas SEM guard de sessão); `encaminhamentos` está 100% aberto. Impacto hoje é baixo (só existe o tenant default), mas é **pré-requisito fechar antes do 2º login**.

**FAÇO AGORA quando voltar (autônomo, aditivo/reversível, NÃO liga o 2º tenant):** blindar `tenantIdFromRequest` (só honra header com `x-api-key`=INTERNAL server-side); trocar header→sessão (`g.ctx.tenantId`) em ~16 rotas (mapa no output: alertas/parados, analytics, atendimento, cadastro, empresas, kpis/calcular, leads/[id]/propostas, obras, ferramentas-custom, financeiro/contas com `header||ctx`, etc.); fechar `encaminhamentos` (auth+tenant); `gerar-por-ia` ignora `body.tenantId`; `copiloto-auth` mapeia user→tenant (não `defaultTenantId()`); escrever (sem aplicar) as migrações; preparar handoff (`hub_negocio_vinculos`+`parceiro_id`) sem ligar.

**JANELA (irreversível, com o dono):** `tenant_id` em hub_alertas/hub_ciclos_ia; UNIQUE por-tenant `CONCURRENTLY` (doc/cnpj/telefone/codigo) → validar em prod → **só então DROP** os globais; backfill `tenant_id NULL→default` → remover `is.null` do scope; contador PK por tenant + RPC com `p_tenant_id`. Ordem: CREATE→validar→DROP. Pré-voo = queries de duplicata (esperado 0; P0 anterior deu 0).

**⭐ DECISÃO DO DONO (a mais importante):** modelo do parceiro — **(A)** tenant PRÓPRIO que recebe o lead VINCULADO (mestre×vinculado real, isolamento total, sprint maior) **vs (B)** dentro do Hub com view escopada por `parceiro_id` (entrega em horas, menos isolamento). Também: parceiro vê só leads ou negócio+obra? como criar/convidar o tenant-parceiro? alertas/ciclos/agentes são globais-do-Hub? quando virar a chave do isolamento. Ver [[fluxo-core-captacao-direcionamento]], [[macro-sequencia-nucleo-primeiro]].
