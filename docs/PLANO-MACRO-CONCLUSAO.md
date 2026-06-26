# Plano Macro — Garantia de Conclusão (fonte única)

> Consolida TUDO que combinamos com o dono, com status, para **garantir que será concluído**. Atualizar a cada entrega. Regra: aditivo, gate `tsc + vitest (183) + _chk23`, verificável clicando, mesa redonda UX. Docs irmãos: [PLANO-EXECUTIVO-BLOCOS](PLANO-EXECUTIVO-BLOCOS.md), [ANALISE-MESTRA-ESCOPO](ANALISE-MESTRA-ESCOPO.md), [DISTRIBUICAO-PLANO-CEO](DISTRIBUICAO-PLANO-CEO.md), [FILA-UIUX](FILA-UIUX.md), [PENDENCIAS](PENDENCIAS.md).

## A) Núcleo apresentável — ✅ CONCLUÍDO (verificado clicando)
- FAB não sobrepõe sideover · mercado em chips (sistema) · especialistas (chips + **link convite** + CPF/dedup + atalho em Cadastros) · segurança (críticos 1/2/3 + RLS) · higiene de leads (144→6 mocks, backup) · **CNPJ puxa dados** (verificado) · área de mensagem/log nas 3 entidades (lead/negócio/pessoa-empresa) + KPIs do log · **bug "Criar negócio" consertado** (3 camadas legado) · funil lead→negócio→obra.

## B) Motor de distribuição (keystone da plataforma) — ✅ CONCLUÍDO
- **F1** painel "Quem deve receber este lead?" — 5 fornecedores rankeados (similaridade + classificação) + encaminhar. *(commit be01697)*
- **Esteira de entrega** — obra/projeto/serviço/**marcenaria/marmoraria/vidraçaria** automática ao FECHAR (etapa→ganho), **uma tabela por área** (decisão do dono). *(169f6d2, e21c59b)*
- **F2** `hub_eventos` — event log keystone (KPIs/SLA/gate/IAH/auditoria). *(f6eb2a7)*
- **F4** painel "Atividade da rede · controle total do Hub". *(e1f0882)*
- **F3** gate financeiro (bloqueado não recebe + sinaliza) + **flywheel IAH** (pendência rebaixa ranking) + **liberação** pelo Hub + audit no feed. *(140b257, e86e08b, ebc5f2d, 0357c9e)*
- **F2b** cascata de rejeição — recusar → oferta ao próximo elegível (pula bloqueados). *(c54632a)*

## C) Restante combinado — A CONCLUIR (com caminho)
1. **C.1 — Auditor da rede** — *(a)* **métricas/KPIs ✅ FEITO**; *(b)* **cobrança + aderência (IAH) ✅ FEITO** (scorecards por fornecedor c/ aderência colorida + status + ações **Liberar/Cobrar**; evento `fornecedor_cobrado` flui pro sino — `/api/crm/distribuicao/cobrar` + metricas enriquecido; verificado no banco); *(c)* **agente IA AUTÔNOMO (cron `jobs_internos`) + SLA real (`ts_oferta`/`ts_resposta`) — TODO**.
2. **Notificações robustas** — *(a)* **sino no header do Hub ✅ FEITO** + cobrança/gate fluem pro sino; *(b)* **per-fornecedor + canais (WhatsApp/email/push) + preferências — BLOQUEADO em infra:** in-app per-fornecedor precisa do **login do membro (multi-tenant, item 3)**; WhatsApp precisa **UAZAPI configurado** (no-op neste ambiente); email/push precisam infra própria. **TRAVA (credenciais/serviço externo) — não stubar canal falso.**
3. **F6 — Multi-tenant real** (pesado, RISCO) — `users.tenant_id` + `current_user_tenant_id()` dinâmico + RLS lote 2 (~36 tabelas). **NÃO executado autonomamente (flip de RLS pode quebrar o app sem supervisão = TRAVA).** Plano de rollout supervisionado seguro: (i) `ALTER TABLE public.users ADD COLUMN tenant_id uuid` (aditivo, nullable) + backfill p/ tenant default; (ii) trocar `current_user_tenant_id()` p/ ler de `users.tenant_id` com fallback ao default; (iii) ligar RLS por tabela em LOTES pequenos, testando login + leitura a cada lote (rollback por lote); (iv) só então o membro loga e vê só o CRM dele. Fazer COM o dono, verificando clicando a cada lote.
4. **Segurança long-tail** — filtro `.eq(tenant)` no financeiro (deferido B3.9), GETs, rotas internas (`requireInternalApiKey`), Crítico 4 (comissão imutável/auditada).

## D) Momento oportuno (atribuído, cronograma absoluto)
- ✅ **Vínculos N:N pessoa↔empresa↔negócio** — JÁ implementado (`hub_pessoas_empresas` + `hub_negocio_vinculos` + aba Vínculos nos cadastros) e agora **securizado** (4 rotas com guard + tenant). [[vinculos-nn-pessoa-empresa-negocio]]
- ✅ **Renomear navegação** — FEITO: Operações / Arquitetura / Engenharia (sub-itens aninhados quando as telas existirem). [[navegacao-renomear-operacoes-arquitetura-engenharia]]
- **Relatórios/Analytics → BI generativo** (IA gera relatório/tela on-demand, Bloco 8).

## E) Visão maior (pós-CRM, registrada)
- **Totem/iFood de materiais** (pedir conversacional → comprar → entregar, com SPREAD). · Migração **Membro elegível → fornecedor**. · Monetização (assinatura SaaS + comissionamento transacional com split por código único).

## F) Checagem de consistência (auditor) — ✅ RODADO E CORRIGIDO (commit 9865cbd)
Auditor multi-agente (4 dimensões + síntese) rodou sobre o motor. Veredito: lógica madura (31 OK), mas **5 críticos + 7 atenção**. **Os 5 críticos + 4 atenção corrigidos:**
- **C1/C2 (DRIFT):** `tipo='derivacao'`/`feito_por='sistema'` violavam CHECK de `hub_atividades` → o log da esteira quebrava **silencioso** ao fechar negócio. → `status_change`/`ia`.
- **C3/C4/C5 (multi-tenant):** GET de negócio sem guard + aprovar/recusar sem checar tenant por ID → vazamento cross-tenant. → guard + checagem null-safe.
- **Atenção:** feed cobre recusado/recolocado/sem_proximo; métrica conta sem_proximo; payload do gate enriquecido.
- **Resta (atenção, não-bloqueante):** liberação também no painel de métricas (já existe no painel do lead); C.1b agente IA (ver C.1).

---
**Status macro:** A, B, **auditoria (F) corrigida e verificada**, **C.1a+C.1b (auditor + cobrança/aderência)**, **C.2a (sino)**, **nav renomeada**, **vínculos N:N securizados** concluídos. **Bloqueado em TRAVA (infra/risco, exige dono):** C.2b canais ao membro (multi-tenant + UAZAPI/email) · C.1c agente IA autônomo+SLA · multi-tenant real (flip RLS supervisionado). Barômetro: núcleo ~97% · segurança ~85% · visão completa ~80%.
