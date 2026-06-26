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
1. **C.1 — Auditor da rede** — *(a)* **métricas/KPIs ✅ FEITO**; *(b)* **cobrança + aderência (IAH) ✅ FEITO** (scorecards por fornecedor c/ aderência colorida + status + ações **Liberar/Cobrar**; evento `fornecedor_cobrado` flui pro sino — `/api/crm/distribuicao/cobrar` + metricas enriquecido; verificado no banco); *(c)* **agente IA AUTÔNOMO ✅ FEITO** (`lib/crm/auditor-autonomo.ts` + `POST /api/crm/distribuicao/auditor`: cobra pendência/alta-recusa sozinho, idempotente cooldown 12h; roda por **cron** (Bearer CRON_SECRET) ou botão "Rodar auditor agora"; verificado: pulou Loft 7 por cooldown). *Agendar:* cron 30–60min batendo o endpoint. **Resta:** SLA real per-fornecedor (tempo de resposta) precisa de eventos do lado do MEMBRO (futuro).
2. **Notificações robustas** — *(a)* **sino no header do Hub ✅ FEITO** + cobrança/gate fluem pro sino; *(b)* **per-fornecedor + canais (WhatsApp/email/push) + preferências — BLOQUEADO em infra:** in-app per-fornecedor precisa do **login do membro (multi-tenant, item 3)**; WhatsApp precisa **UAZAPI configurado** (no-op neste ambiente); email/push precisam infra própria. **TRAVA (credenciais/serviço externo) — não stubar canal falso.**
3. **Multi-tenant real** — ✅ **FUNDAÇÃO FLIPADA E VERIFICADA CLICANDO** (26/jun, supervisionado): descoberta-chave = as ~36 tabelas **já tinham RLS tenant-scoped** (`tenant_id = current_user_tenant_id() OR null`, role authenticated) — então o "flip" não foi reescrever policies, só **ligar a fonte real**: (i) `users.tenant_id` aditivo + backfill; (ii) `current_user_tenant_id()` dinâmica (`SECURITY DEFINER`, fallback default). App verificado pós-flip (login + dashboard "6 leads" + lista de negócios OK; advisors: só 1 WARN esperado do padrão). Migração: `supabase/migrations/20260626130000_multitenant_foundation.sql`. DB + app leem a MESMA fonte (`users.tenant_id`). **RESTA (aditivo, SEM o risco do flip):** (a) **onboarding de membro** — criar `hub_tenants` + `public.users` com o `tenant_id` do membro → membro loga e vê só o dele; (b) faxina das **26 policies `rls_policy_always_true`** pré-existentes (advisor) nas tabelas sensíveis.
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
**Status macro:** A, B, **auditoria (F) corrigida e verificada**, **C.1a+C.1b+C.1c (auditor + cobrança/aderência + agente autônomo)**, **C.2a (sino)**, **nav renomeada**, **vínculos N:N securizados**, **multi-tenant real (fundação flipada + isolamento provado + tenant-scoping no app)** concluídos. Barômetro: núcleo ~97% · segurança ~93% · visão completa ~85%.

---

## 🤝 HANDOFF — ESTADO PARA A PRÓXIMA SESSÃO (26/jun ~18h)

**Pra retomar rápido:** ler este doc + `docs/AUDITORIA-47-TELAS.md`.

**✅ NO AR (produção, verificado):** Render `https://escritorio-virtual-1.onrender.com` — build novo confirmado (rota de export blindada retorna 401). Deploy = push em `feature/escritorio-visual` (produção, repo `ramonprogjr/escritorio-virtual`) → Render auto-deploya. Login do app: `nice.engemp@gmail.com`. *(Cold start ~30-60s no plano starter.)* **Próximo deploy combinado: domingo.**

**✅ Auditoria de 47 telas RODADA** (workflow multi-agente; média 6.8/10; 36 reais, 8 parciais, 3 stubs). Relatório: `docs/AUDITORIA-47-TELAS.md`. **P0 100% corrigido e live:**
- Segurança (8 rotas blindadas guard+tenant): negocios/[id]/nota, especialistas/[id], atendimento/mensagens, pedidos, imoveis/[id], parceiros/[id]/modulo, relatorios/export (CSV).
- Fachada: botão Ligar (leads), loading infinito (empresas), aba Registros morta (cadastro removida).
- UX: Perdido com seletor de motivo + confirmação (chip e botão).

**📋 FILA P1/P2 (pro deploy de domingo, na `wendel/dev`) — nada perdido:**
- ✅ **P1 COMPLETO (26/jun, sessão 2):** toasts nas escritas silenciosas (`91cb799`) · mover etapa no mobile via bottom-sheet Click-and-Go (`6c9695d`) · ações por linha em Escritórios (ativar/desativar tenant + endpoint PATCH, `687e653`) · seletor de destino na distribuição (fim do slug cru + endpoint `/destinos`, `0052edd`). Todos com gate (tsc + 183/183) e verificados clicando.
- P2 (resta): **sweep de tokenização** (dezenas de telas com paleta GitHub-dark → tokens verde+dourado — inconsistência visual nº1) · máscaras CPF/telefone · render otimista no atendimento · `/crm/trafego` filtro de período fachada (backend ignora). *(mojibake no AgenteNovoWizard já estava corrigido — 0 ocorrências.)*
- Debug visual mobile + desktop tela a tela.

**⏸️ DEFERIDO (aguarda DADOS do dono):** Gestão de **Obra/Engenharia/Arquitetura** (módulo de execução — obras 5.5, obra/[id] 3.5, projetos 5.5). Só esse fica pra depois; resto = "CEO aprova, prossiga".

**Regras vivas:** aditivo · gate `tsc + vitest(183) + _chk23` · verificável clicando · mesa redonda · sem secrets na memória · push só autorizado (foi p/ este deploy).
