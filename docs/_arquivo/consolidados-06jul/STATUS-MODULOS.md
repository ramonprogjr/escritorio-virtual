# STATUS DOS MÓDULOS — inventário com evidência (01/jul/2026)

> Diagnóstico honesto módulo a módulo, com evidência (arquivo/rota/migração). Régua: tela≠pronto · código≠ativado · migração-arquivo≠aplicada-em-prod · design≠implementado. Fontes: verificação direta do código (2 agentes Explore) + docs/MACRO-PLAN-ATUALIZADO.md + docs/AUDITORIA-ENTERPRISE.md.
>
> **Status:** não-iniciado · planejado · design-pronto · documentado · código-parcial · **código-pronto-NÃO-ativado** · funcional-local · **funcional-em-prod** · **funcional-mas-inseguro** · funcional-mas-incompleto · pronto-MVP · pronto-produção · bloqueado.

| # | Módulo | % | Status | MVP? | Prod? | Evidência | O que falta / bloqueador |
|---|--------|--:|--------|:---:|:---:|-----------|--------------------------|
| 1 | **CRM core** (lead/negócio/pessoa/empresa) | 85% | funcional-em-prod | ✅ | ⚠️ | `app/crm/{leads,negocios,pessoas,empresas}`, `lib/crm/garantir-pessoa-lead.ts`, `codigos-rastreio.ts`, testes | KPIs reais (usar hub_eventos); isolamento tenant real (Fase 2) |
| 2 | **Atendimento/WhatsApp** | 80% | funcional-em-prod (IA latente) | ✅ | ⚠️ | inbox realtime `atendimento/page.tsx`, fila `hub_msg_jobs`+worker, webhook HMAC, UAZAPI | **IA respondendo** (chave Mistral, 60 dias parada); webhook HMAC via query (audit) |
| 3 | **Agentes IA / Copiloto de voz** | 70% | código-pronto (latente) | ⚠️ | ❌ | `lib/ia/engine.ts`, `lib/copiloto/*` (HMAC+allowlist), builder/RAG | **MISTRAL_API_KEY** (sem ela não roda); prompt-injection/RAG cross-tenant (audit) |
| 4 | **Obras/Engenharia (E0–E7)** | 75% | **código-pronto-NÃO-ativado** | — | ❌ | rotas `app/api/crm/obras/[id]/**`, `lib/obras/*`, `ArvoreEscopo`, 10 migrações file-only | **aplicar migrações (janela do dono)**; ativar só após a fundação segura |
| 5 | **Arquitetura/Projetos (A0–A1)** | 70% | **código-pronto-NÃO-ativado** | — | ❌ | `app/crm/arquitetura`, `projetos/[id]/programa`, 2 migrações file-only | aplicar migrações; SLA de aprovação |
| 6 | **Compras/Estoque (E5)** | 65% | código-pronto-NÃO-ativado | — | ❌ | `obras/[id]/{sc,estoque,inventario}`, append-only | aplicar migração; fluxo de compra com o dono |
| 7 | **Orçamento/Orçamentária** | 45% | funcional (manual) | — | ❌ | `lib/obras/orcamentaria.ts` (memorial+CSV client-side) | **Orçamento IA (PDF→planilha) NÃO existe** — é a capability-mãe (design pronto) |
| 8 | **Aprovações / Escrow** | 55% | funcional-mas-inseguro + latente | ⚠️ | ❌ | `lib/ia/aprovacoes.ts` (fail-closed, F-D2), E6 file-only | **escrow: `GREATEST(0,0-v)` custódia fantasma + sem `FOR UPDATE`** (audit, confirmado); Central de Aprovações unificada não existe |
| 9 | **Parceiros/Fornecedores** | 75% | funcional-em-prod (fornecedores latente) | ✅ | ⚠️ | `hub_parceiros` vivo; `hub_fornecedores` espelho aplicado mas motor só lê com `MOTOR_FONTE=fornecedores` | flag do motor (dono); `hub_fornecedores` SEM RLS (audit) |
| 10 | **Marketplace / iFood** | 5% | não-iniciado (visão) | — | ❌ | só memória/design | tudo (fase futura) |
| 11 | **Portal do Cliente** | 10% | **design-pronto (zero código)** | — | ❌ | `docs/insumos-do-dono/portal-*`, memória | tudo (a "alma do produto"; depende de AEC+multi-tenant) |
| 12 | **Portal do Parceiro** | 30% | código-parcial | — | ⚠️ | `/api/parceiros/portal/verify` | link sem expiração (audit); jornada incompleta |
| 13 | **Financeiro (pagar/receber)** | 60% | funcional-mas-inseguro | ⚠️ | ❌ | tabelas `hub_contas_*` (vazias), dashboard, RLS file-only | **RLS financeiro não aplicada** (file-only); `USING(true)` inicial |
| 14 | **Config/Usuários/Permissões (RBAC)** | 80% | funcional-em-prod | ✅ | ✅ | `lib/crm/crm-permissoes.ts` (5 níveis), `usuarios/`, owners allowlist (3 emails) | sub-usuários finos (multi-tenant) |
| 15 | **Relatórios/Dashboard/Analytics** | 70% | funcional (KPIs incompletos) | ✅ | ⚠️ | `analytics/route.ts` dado real; **NÃO usa hub_eventos** | KPIs de tempo/SLA são impossíveis sem hub_eventos (Fase 1); vazamento analytics cross-tenant já corrigido no E2E |
| 16 | **Multi-tenant (isolamento)** | 40% | **funcional-mas-inseguro** | ❌ | ❌ | fundação `multitenant_foundation` aplicada; mas `current_user_tenant_id` dinâmica OFF, middleware morto, `USING(true)`, `tenant_id.is.null` | **é single-tenant disfarçado** — go-live blocker (Fase 2) |
| 17 | **Billing / Entitlements SaaS** | 3% | **não-existe** | ❌ | ❌ | ausência em `app/api/**` | planos/assinatura/módulos/guard (Fase 3; monetização) |
| 18 | **Créditos IA / Metering** | 35% | parcial (modo sombra) | — | ❌ | `lib/ia/metering.ts`, tabelas `hub_ia_*` aplicadas | gate atômico ANTES do LLM (hoje `<0`); recarga; cego em ~12/15 pontos |
| 19 | **DevOps / CI / Observabilidade** | 25% | fraco | ❌ | ❌ | sem CI, sem ESLint, logger 2/187, `backup-auto.yml` perigoso | CI (tsc+vitest+audit); healthcheck; logger; **deletar backup-auto.yml (PII no Git)** |
| 20 | **Distribuição de leads** | 65% | funcional | ✅ | ⚠️ | `distribuir-lead.ts` (scoring), persiste `hub_lead_encaminhamentos`, auditor | fila persistida dedicada (`hub_lead_distribuicao` não existe); SLA de redistribuição |
| 21 | **Membros (jornada)** | 90% | funcional-em-prod | ✅ | ✅ | CRM próprio (intocável); membro elegível → fornecedor | elo Comunidade→CRM (parado, dono explica) |

## Leitura rápida
- **No ar e funcional (núcleo comercial):** 1, 2, 9, 14, 20, 21 — mas com **IA desligada** (chave) e **multi-tenant frágil**.
- **Construído mas DORMENTE (só falta a janela de migração do dono):** 4, 5, 6, 8(E6) — a camada AEC inteira.
- **Inseguro até a Fase 0:** 13, 16 + o escrow (8).
- **Só design/visão:** 10, 11, 17.
- **A capability-mãe que falta (maior diferencial):** 7 (Orçamento IA PDF→planilha).

**% geral do produto (visão completa): ~40%. % do MVP seguro+operável: ~70%** (falta a Fase 0 de segurança + ligar a IA).
