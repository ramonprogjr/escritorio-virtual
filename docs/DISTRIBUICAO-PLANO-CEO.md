# Motor de Distribuição de Leads + Agentes do Membro — Plano CEO

> Base: varredura file-by-file (workflow `distribuicao-ceo-analise`, 25/jun/2026). Reaproveita o estado REAL do código. Princípio: **valor antes da fundação** (entregar o fluxo dentro do Obra10+ antes do multi-tenant pesado).

## Visão do dono (8 vontades)
1. Sistema traz os **5 fornecedores** que casam (similaridade + classificação). 2. Escolher/aprovar/encaminhar fácil. 3. Encaminhado → **entra no CRM do membro**. 4. Hub tem **controle total** do funil do membro. 5. 5 indicações por similaridade+classificação. 6. **Gate de pendência** (financeira/KPI/follow-up/SLA): recebe o lead mas dados bloqueados até sanar; ele+nós sinalizados; liberação automática. 7. IA-first + conversacional. 8. **Agentes do membro** (repetitivo/admin/comercial/atendimento); a IA do Hub audita e cobra. + **Flywheel IAH:** alta aderência → mais leads. + **Notificações robustas** (novos leads etc).

## O que JÁ EXISTE (reaproveitar — citado)
- **Matching 5 (testado):** `lib/crm/distribuir-lead.ts` (`scoreParceiro` mercado+40/esp+25/cidade+30/UF+15/carga+20/homolog+10; `listarCandidatosParceiro` top-5 + motivo). Teste: `distribuir-lead.test.ts`.
- **Sugerir/aprovar/encaminhar:** `lib/crm/sugerir-encaminhamento-auto.ts`, `lib/crm/notificar-parceiro-lead.ts` (`aprovarEEnviarEncaminhamento` → WhatsApp), `app/api/crm/distribuicao/sugerir/route.ts`, `app/crm/distribuicao/page.tsx`.
- **`hub_encaminhamentos`** status `aguardando_validacao|enviado|aceito|recusado|bloqueado` (esqueleto pronto).
- **IA/agentes (~80% reusável):** `lib/ia/engine.ts` (10 etapas), `components/crm/AgenteNovoWizard.tsx` + `app/api/hub/agentes/route.ts` (sem gate de role no arquivo → abrir = policy), 19 tools (`lib/hub/agente-ferramentas-registry.ts`), ferramentas custom por tenant (`lib/hub/ferramentas-custom-db.ts`), **`lib/ia/ml.ts` "propõe nunca altera"** + `lib/ia/aprovacoes.ts` (= espinha do auditor/cobrador).
- **Portal do membro seguro (HMAC):** `lib/parceiro-portal.ts`, `app/parceiro/dashboard/page.tsx`.
- **Financeiro básico:** `hub_contas_pagar/receber` + `lib/crm/finance-dashboard-aggregate.ts` (sem FK a fornecedor / sem gate).

## Gaps (ordem de risco)
1. **Multi-tenant fictício** (`current_user_tenant_id()` hardcoded; `users` sem `tenant_id`; ~36 tabelas RLS aberto). NÃO bloqueia Fatias 1–5.
2. **Distribuição não persistida** (score/motivo descartados; sem `hub_eventos` keystone) → KPI/SLA 0% mensurável.
3. **Gate financeiro / IAH / SLA real = 0%.**

## Decisões de CEO (recomendações)
1. **Multi-tenant: DEPOIS (Fatia 6).** Fase 1 = app-level scoping (`distribuido_para_fornecedor_id`) + portal HMAC. *Valor antes da fundação.*
2. **Matching: HÍBRIDO.** Determinístico decide (auditável p/ comissão), LLM explica/conversa/comanda por voz.
3. **RLS lote 2 (~36 tabelas) é P0 ANTES de qualquer login externo do membro.** Enquanto for portal HMAC, seguro.
4. **Mistral vs Anthropic nos agentes do membro** — hoje tool-calling só em Mistral. (decisão de custo×qualidade — perguntar ao dono na Fatia 5).
5. **Exclusivo vs paralelo** (oferta a 1 vs 2–3 "first-response-wins") — muda schema (`paralelo`) e comissão. Schema da Fatia 1 já acomoda ambos; default exclusivo. (perguntar na Fatia 2).
6. **Gate parcial** (recebe notificação, dados mascarados até sanar, liberação automática) — confirmado pela fala do dono.

## Tabelas novas (todas ADITIVAS)
- `hub_lead_distribuicao(id, lead_id, fornecedor_id, score, motivo, posicao_rank, status, sla_oferta_min, sla_resposta_horas, ofertado_em, respondido_em, sla_rompido, paralelo, tenant_id, criado_em)`
- `hub_eventos(id, event_type, entity_type, entity_id, fornecedor_id, lead_id, ator, payload jsonb, ts, tenant_id)` — **append-only** (keystone KPI/SLA/auditoria).
- `ALTER hub_fornecedores ADD status_financeiro default 'em_dia', total_leads_recebidos int default 0; ALTER hub_contas_pagar ADD fornecedor_id`.

## PLANO EM FATIAS (aditivo, gate tsc+vitest, verificável no navegador)
- **★ FATIA 1 — Sugerir 5 + aprovar, persistindo a decisão.** (1 sessão, demo amanhã; zero multi-tenant). Migração `hub_lead_distribuicao`; `POST /api/crm/distribuicao/[leadId]/aprovar` (reusa sugerir+aprovar); aba/painel "Sugestões" com 5 cards (score+motivo+badge). Pronto: abro lead qualificado → vejo 5 cards → aprovo → linha persiste.
- **FATIA 2** — `hub_eventos` (event log) + cascata de rejeição (recusar oferta ao #2).
- **FATIA 3** — Gate financeiro (`status_financeiro` + FK conta→fornecedor + guard no aprovar + liberação ao pagar).
- **FATIA 4** — Painel do Hub (funil do membro lido de `hub_eventos`) + **IAH** (índice de aderência).
- **FATIA 5** — Agente auditor IA (`jobs_internos` via wizard + tool `hub_auditar_sla` + estende `ml.ts`) + **notificações robustas** multi-canal.
- **FATIA 6 (grande, depois)** — Multi-tenant real (`users.tenant_id` + `current_user_tenant_id()` dinâmico + RLS lote 2) + login do membro.
