# ROADMAP DE EXECUÇÃO POR SPRINT — Obra10+

> **O que é.** Plano de execução **por sprint**, começando pela **Fase 0 de segurança** (caminho crítico bloqueante), com a seção de **CAMINHO CRÍTICO** e o que pode correr em **paralelo**. Feito por um trio **PM Sênior + Software Architect + Especialista SaaS**. Constrói sobre `ESCOPO-MVP-V1-V2.md`, `CRONOGRAMA-PROJETO.md`, `MACRO-PLAN-ATUALIZADO.md` e os esforços da `AUDITORIA-ENTERPRISE.md`.
>
> **Data:** 2026-07-01 · **Cenário-base do roadmap:** **B (2–3 devs)**, o recomendado. Ajuste as durações por §CRONOGRAMA para A ou C.

---

## §0 — Sprint de 1 semana (decisão justificada)

**Escolha: sprint de 1 SEMANA.** Justificativa:
1. **Fase 0 é segurança + dinheiro** — mudanças de alto risco exigem **ciclos curtos de validação** (gate `tsc+vitest+build` + auditoria adversarial + deploy) para não acumular raio de explosão.
2. O projeto já opera em **lotes curtos com gates** (Batches 1-2 do E2E, maratonas) — sprint semanal casa com a cadência real e com a régua "aditivo, auditado, sem parar".
3. **Dependência forte do dono** (janelas de infra, decisões) — cadência semanal cria pontos de sincronização frequentes com o dono, evitando bloqueios longos.
4. Sprints de 2 semanas seriam usados só nas frentes grandes de V2 (AEC, orçamento IA) — lá, **agrupamos 2 sprints semanais** num épico, mantendo a régua de 1 semana como unidade de entrega.

> **Convenção:** cada sprint tem **gate de saída** = `tsc + vitest + build verdes` + auditoria adversarial do que mexe em segurança/dinheiro + deploy na branch de produção. Nada fecha sem isso.

---

## §1 — Roadmap por sprint

### BLOCO MVP — Fundação Segura + Núcleo (Sprints 1–4)

| Sprint | Objetivo | Entregas | Critério de PRONTO | Risco |
|---|---|---|---|---|
| **S1 — Infra crítica + janela do dono** | Fechar os vetores de maior gravidade e destravar a base | Rotate `service_role`; tirar `.env`/repo do OneDrive; deletar `backup-auto.yml`; tirar `NEXT_PUBLIC_INTERNAL_API_KEY`; cron `CRON_SECRET` timing-safe; webhook HMAC real; **aplicar as ~19 migrações** (com `db diff` + checagem de duplicatas); ligar IA (Mistral+HMAC+Groq) | `service_role` nova ativa; PII fora do Git; `db diff` limpo; cron rejeita header forjado; IA responde em prod; 3 testes de IA passam com o dono | **Alto** — janela de prod; migração às cegas quebra. Exige **dono presente**. |
| **S2 — Ligar o middleware + guards** | Fechar o bypass de auth de ~60 rotas | Criar `middleware.ts` (allowlist `isPublicApiPath` validada fluxo a fluxo); confirmar guard+tenant-scope nas rotas dos Batches 1-2; **verificar assinatura do JWT de sessão** | `curl` em rota privilegiada sem cookie = 401; cookie forjado rejeitado; login/cadastro público seguem funcionando | **Alto** — ligar às cegas quebra fluxo público. Testar **com o dono**. |
| **S3 — RLS + tenant-scope + escrow** | Fechar vazamento cross-tenant e o dinheiro | Matar `USING(true)` (users/pessoas/empresas/pipelines/vínculos); RLS em `hub_fornecedores`; corrigir `CREATE POLICY IF NOT EXISTS` do financeiro; backfill `tenant_id NOT NULL` + `.eq('tenant_id')` puro; escrow: remover `GREATEST`, RPC de depósito, `FOR UPDATE` + UNIQUE de liberação | Nenhuma policy `USING(true)` em PII; anon key não lê/escreve cross-tenant; escrow não libera sem depósito nem double-spenda (teste automatizado) | **Alto** — migração de RLS + dinheiro; erro deixa dado aberto. |
| **S4 — Núcleo: eventos + intake + UX-gate** | Fechar a gestão real e o furo de duplicação | `hub_eventos` usado de verdade (registros/próxima-ação/timeline nos 4 cadastros); dedup do intake (`garantirPessoaParaLead()` + FK `lead.pessoa_id`); kanban por teclado; contraste AA; higiene de dados de teste (com backup) | KPIs de tempo saem de eventos reais; form não gera lead duplicado; a11y AA passa; base limpa para demo | **Médio** — escopo de UX pode inchar; congelar ao gate. |

> **Marco MVP (fim de S4):** pentest top-10 fecha; auditoria interna sai do 3,5; sistema operável por 1 tenant com segurança. **APROVADO para piloto controlado.**

### BLOCO V1 — SaaS Multi-Tenant Comercial (Sprints 5–9)

| Sprint | Objetivo | Entregas | Critério de PRONTO | Risco |
|---|---|---|---|---|
| **S5 — Multi-tenant real (parte 1)** | Isolamento tenant-aware de verdade | `current_user_tenant_id()` dinâmica (lê `users.tenant_id`); `is_hub_owner()`; validar `tenant_id` server-side sempre | Função de tenant lê do usuário real; header/body de tenant não é confiado | **Médio** — toca o coração do isolamento. |
| **S6 — Multi-tenant real (parte 2) + provisionamento** | Colocar 2 tenants e provar isolamento | Modelo `fornecedor_id`; provisionar ≥2 tenants; suite de teste de isolamento (rotas + Postgres direto) | Tenant A não lê nem grava nada de B (automatizado) | **Médio** — dado legado sem `tenant_id` pode vazar; validar backfill. |
| **S7 — Entitlements + créditos com gate** | Porteira de custo e receita | `hub_planos`/`hub_tenant_assinatura` + `requireModulo()`; gate atômico `assertSaldo` antes de todo LLM + caminho de recarga; wrapper único de LLM (fim do metering cego) | Módulo não contratado é barrado; tenant sem plano não consome IA de graça; saldo negativo bloqueia | **Médio** — decisão do dono sobre markup/quando ligar bloqueio. |
| **S8 — Comissão imutável + Hub** | Integridade financeira + visibilidade | `hub_comissao_eventos` imutável + rateio + snapshot no ganho; B4 Dashboard do Hub (RLS `fornecedor_id`, Hub bypassa) | Comissão ganha é imutável; fornecedor vê só o seu, Hub vê tudo | **Médio** — snapshot exige decisão de negócio (margem). |
| **S9 — IA-security + escala + CI** | Blindar IA e habilitar horizontal | Prompt-injection (`pushName`), memory-poisoning, RAG por tenant; rate-limit/dedup distribuído (Redis/Postgres); CI bloqueante (tsc+vitest+eslint+audit); `/healthz`; observabilidade (logger+redação PII+Sentry) | Agente não é envenenado cross-lead/tenant; sobrevive a 2 réplicas; CI barra regressão | **Médio** — Redis é dependência de infra nova. |

> **Marco V1 (fim de S9):** 2 tenants pagantes isolados, com porteira de custo, CI e observabilidade. **VENDÁVEL e base para captação.**

### BLOCO V2 — Rede + Obra + Moat (Sprints 10–24, agrupados em épicos)

| Épico (≈2–3 sprints) | Objetivo | Entregas | Critério de PRONTO | Risco |
|---|---|---|---|---|
| **E-AEC — Ativar a obra** | Ligar a camada AEC construída | Ativar E0–E7/A0–A2 em prod; Estrutura Unificada F1–4 (`hub_obra_itens` projeta os 7 artefatos); `<ArvoreEscopo>` plena | 1 obra ponta a ponta sem redigitar (escopo→orçamento→medição→pagamento→Curva-S) | **Médio-alto** — épico grande; escopo criativo. |
| **E-FLUXO — Aprovações + Tarefas + Distribuição** | As superfícies que fazem tudo andar | Central de Aprovações unificada (`hub_aprovacoes`, IA auto-aprova trivial); Gestor de Tarefas universal (`hub_tarefas`); B5 distribuição persistida | Central agrega ≥3 gates; distribuição respeita/redistribui SLA | **Médio** — depende de fundação tenant sólida. |
| **E-ORC-IA — Orçamento IA** | A capability-mãe (moat) | Taxonomia controlada + IA classifica memorial PDF → planilha executiva/custos/financeira auditável (humano confirma v1) | Lê 1 memorial real e produz planilha revisável | **Alto** — qualidade de IA depende de dados/prompt; iterativo. |
| **E-PERF — Volume** | Aguentar dados reais | Paginação, realtime incremental, virtualização; N+1 do motor/agentes → SQL agregado; índices/FK ausentes | Telas com 10k+ linhas não travam | **Baixo-médio** — bem delimitado. |

> **Marco V2:** sistema operacional da obra funcionando + orçamento IA demonstrável. **O moat está no ar.**

### BLOCO V3 — Ecossistema (roadmap, pós-V2)
Portal do Cliente pleno · Monetização automática (billing+split+créditos) · Marketplace · Operação de campo · Compliance enterprise (DR, secret manager, CSP). Detalhado em `MACRO-PLAN-ATUALIZADO.md` §Fase 5 e `ESCOPO-MVP-V1-V2.md` §4.

---

## §2 — CAMINHO CRÍTICO

> A cadeia que **não pode ser paralelizada** e determina a data de entrega. Tudo o mais orbita em torno dela.

| Atividade crítica | Por que é crítica | Dependências | Impacto se atrasar | Prazo recomendado |
|---|---|---|---|---|
| **1. Janela de infra do dono** (rotate chave, migrações, IA, tirar PII do Git) | Nada de segurança avança sem a chave rotacionada e as migrações aplicadas; IA-first depende da chave Mistral | **Dono presente** + billing Mistral + backup pré-migração | Todo o MVP escorrega dia a dia; IA fica off | **S1** — concentrar em 1 sessão |
| **2. Ligar o middleware** | Fecha ~60 rotas de uma vez; sem ele, todo guard in-handler é paliativo e o multi-tenant é fake | Allowlist validada (S1) + login testado com dono | Bypass de auth persiste; **não se pode vender** | **S2** |
| **3. RLS + backfill `tenant_id` + `.eq` puro** | É o isolamento real no banco; sem ele o service-role deixa RLS decorativa e vaza cross-tenant | Middleware (S2) + migrações (S1) | 2º cliente = vazamento; V1 impossível | **S3** |
| **4. Escrow correto** | O caminho do dinheiro está contabilmente falso; quebra a alma do produto e permite double-spend | Migração de escrow (S1/S3) | Perda financeira/fraude; confiança destruída | **S3** |
| **5. Multi-tenant real dinâmico** | Pré-requisito de B4/B5/entitlements e do go-live com N clientes | RLS pronta (S3) | V1 comercial trava; sem isolamento não há venda multi | **S5–S6** |
| **6. Entitlements + gate de créditos** | Porteira de custo; sem ela cada tenant não-pagante queima token do dono | Multi-tenant (S6) + decisão de markup (dono) | Escala = prejuízo; produto não é "vendável" de verdade | **S7** |
| **7. Ativação AEC + Estrutura Unificada** | É o moat (V2); sem a fundação tenant/IA, seria "construir no ar" | V1 fechado (S9) | Tese de moat/investidor atrasa | **Épico E-AEC** |

**Regra do caminho crítico:** as atividades 1→4 são **serialmente bloqueantes** e concentram a dependência do dono. **Blindar essa cadeia é o único jeito de garantir a data do MVP.** Se uma delas derrapa, todas as posteriores derrapam junto.

---

## §3 — O que pode ir em PARALELO (sem tocar o caminho crítico)

> Frentes que um 2º/3º dev (ou o dono em janelas ociosas de espera pela infra) tocam sem conflitar com a cadeia crítica. Reduzem o prazo total no cenário B/C.

**Durante o MVP (S1–S4), em paralelo à segurança:**
- **UX-gate não-migratório:** kanban por teclado, contraste AA, `prefers-reduced-motion`, error boundaries, `<main>`/skip-link. (Não toca DB/auth.)
- **`hub_eventos` na camada de aplicação** (timeline/próxima-ação) — não depende de migração nova (tabela já aplicada); só depende de não colidir com S3 no schema.
- **Dedup do intake** — código de aplicação + 1 FK aditiva; corre ao lado da RLS.
- **CI/lint/deps** — preparar pipeline `tsc+vitest+eslint+audit` e healthcheck **antes** de precisar (habilita gates dos sprints seguintes).
- **Documentação/testes de regressão** dos módulos já corrigidos no E2E.

**Durante o V1 (S5–S9), em paralelo:**
- **Aplicar migrações AEC** como aditivo latente (já na S1) — adianta V2 **sem entregar** obra ainda.
- **Observabilidade** (logger em todas as rotas, redação de PII) — independente da lógica de tenant.
- **Performance de listas** (paginação/virtualização) — não depende de entitlements.
- **Design/prototipagem** da Central de Aprovações e Orçamento IA — prepara o épico V2.

**Durante o V2, em paralelo:**
- **E-PERF** roda ao lado de **E-AEC/E-FLUXO** (é bem delimitado).
- **Design/coleta de dados** para Orçamento IA (memoriais reais, taxonomia) antes do épico E-ORC-IA.

> **Não paralelizável (armadilha comum):** não mexer em RLS/tenant enquanto o middleware não está ligado e testado — as duas mudanças interagem e um bug de tenant sob service-role passa despercebido. Serializar 2→3→4 é intencional.

---

## §4 — Sincronização com o dono (pontos de parada obrigatórios)

Estes são os **únicos** momentos em que a execução para e espera o dono (régua "parar só nas travas"):
- **Antes de S1:** billing Mistral ativo + backup pré-migração + OK para rotacionar `service_role`.
- **Dentro de S1/S2:** validar allowlist de rotas públicas + testar login/cadastro **juntos** (auth mudou).
- **Antes de S7:** decisão de markup de créditos e quando ligar bloqueio de saldo negativo.
- **Antes de S8:** decisão de comissão imutável (snapshot) + margem (administração×preço-fechado).
- **Testes de IA ao vivo (S1):** os 3 testes com o dono em prod.

Todo o resto é decisão técnica de baixo/médio risco — segue sem confirmação, com gates e auditoria.
