# ESCOPO — MVP / V1 / V2 / V3 (Obra10+)

> **O que é.** Definição de fronteiras de produto por versão, feita por um trio **Project Manager Sênior + Software Architect + Especialista SaaS** como parte da auditoria de direção. Constrói **em cima** de `MACRO-PLAN-ATUALIZADO.md` (fases 0-5), `AUDITORIA-ENTERPRISE.md` (REPROVADO 3.5/10; middleware morto) e `REMEDIACAO-AUDITORIA.md` (triagem CEO). Não reinventa: reorganiza o que já foi decidido em **versões vendáveis**.
>
> **Data:** 2026-07-01 · **Premissa-chave:** a **Fase 0 de segurança** (ligar middleware, RLS, rotate `service_role`, escrow, backfill `tenant_id`) é o **caminho crítico bloqueante**. Nada de produção multi-tenant antes dela. Grande parte da camada AEC já está **em código, latente** (migrações file-only, não aplicadas) — o gargalo é a **janela de migração do dono**, não desenvolvimento novo.
>
> **Régua de decisão.** O melhor para o sistema: seguro (tenant-isolation), auditável, vendável, apresentável a investidor. Quando "impressiona a demo" conflita com "segura o dado do cliente", **segurança ganha**.

---

## §0 — Mapa das 4 versões (visão de 1 tela)

| Versão | Nome interno | Pergunta que responde | Estado de partida | Pode vender para |
|---|---|---|---|---|
| **MVP** | *Fundação Segura + Núcleo* | "Um escritório consegue operar seu CRM+atendimento+IA sem vazar dado e sem quebrar o dinheiro?" | ~90% do núcleo pronto; **bloqueado pela Fase 0 de segurança** | 1 cliente-âncora (o próprio dono / 1 parceiro de confiança), piloto controlado |
| **V1** | *SaaS Multi-Tenant Comercial* | "Dá para colocar 2..N escritórios pagantes na mesma plataforma com isolamento real e cobrança?" | Depende de MVP + fundação multi-tenant real + entitlements | Primeiros clientes pagantes; base para captação |
| **V2** | *Rede + Obra + Preditivo* | "A plataforma vira o *sistema operacional da obra* e da rede de fornecedores, com o moat de IA?" | Depende de V1 + camada AEC ativada + Central de Aprovações/Tarefas | Escala de rede; tese de moat para o investidor |
| **V3** | *Ecossistema Enterprise* | "Marketplace, campo, portal do cliente pleno, monetização automática, compliance enterprise?" | Depende de V2 maduro | Grandes contas; expansão de ecossistema |

> **Leitura para o investidor (uma frase):** o produto já **existe e é rico** (MVP a poucos passos), mas está travado por uma **dívida de segurança conhecida e mapeada** (Fase 0). V1 é o que torna vendável a múltiplos clientes; V2 é onde mora o *moat* (obra preditiva). O risco é de **execução**, não de descoberta.

---

## §1 — MVP obrigatório — *Fundação Segura + Núcleo Comercial*

### Objetivo
Ter um sistema **operável por 1 escritório real, com dados reais, sem vazamento e sem contabilidade falsa**. Não é sobre features novas — é sobre **fechar os gates que impedem qualquer uso sério** e polir o núcleo já construído. É o piso ético do produto: nada abaixo disto pode ir para um cliente.

### Módulos INCLUÍDOS
1. **Fase 0 de Segurança (caminho crítico — o coração do MVP):**
   - Ligar o **middleware** (`proxy.ts` → `middleware.ts`) com allowlist de rotas públicas validada fluxo a fluxo.
   - Guard in-handler + tenant-scope nas ~60 rotas privilegiadas abertas (grande parte já feita nos Batches 1-2 do E2E; **confirmar cobertura total**).
   - **Verificar assinatura do JWT de sessão** (hoje `sub` é confiado sem verificação).
   - Corrigir RLS: matar `USING(true)` (`users`, `hub_pessoas/empresas`, pipelines/vínculos), ligar RLS em `hub_fornecedores`, corrigir `CREATE POLICY IF NOT EXISTS` (SQL inválido → financeiro nunca protegido).
   - Backfill `tenant_id NOT NULL` + trocar `tenantScopeOrFilter` por `.eq('tenant_id')` puro (matar o vazamento `is.null`).
   - **Escrow correto:** remover custódia fantasma (`GREATEST(0, 0 - v)`), RPC de depósito, `FOR UPDATE` + UNIQUE de liberação (anti-double-spend).
   - **Infra crítica:** rotacionar `service_role`, tirar repo/`.env` do OneDrive, deletar `backup-auto.yml` (PII no Git), tirar `NEXT_PUBLIC_INTERNAL_API_KEY` do bundle.
   - **Webhook/cron:** HMAC real (timestamp+nonce) + `CRON_SECRET` timing-safe.
2. **Núcleo comercial (já vivo, ~90%):** CRM PF/PJ com dedup por código único, funil/Kanban editável, atendimento inbox IA+humano (WhatsApp/UAZAPI), motor de distribuição (nível atual), financeiro a pagar/receber.
3. **IA ligada em prod:** `MISTRAL_API_KEY` + `COPILOTO_HMAC_SECRET` + `GROQ_API_KEY` (fallback) — acende agentes/copiloto/gerar-fluxo. Os 3 testes de IA ao vivo validados com o dono.
4. **Fundação de gestão (`hub_eventos`):** cada nota/avanço vira evento que alimenta KPIs reais (hoje KPIs de tempo são falsos). Timeline + próxima-ação estruturada nos 4 cadastros.
5. **Dedup do intake de formulário** (`garantirPessoaParaLead()` compartilhado + FK `lead.pessoa_id`) — fecha o furo de leads duplicados.
6. **UX-gate de acessibilidade:** zoom reabilitado, loading infinito do Atendimento corrigido (ambos já feitos), kanban por teclado, contraste AA.
7. **Higiene de dados de teste** (com backup) antes de qualquer demo.

### Módulos EXCLUÍDOS do MVP (intencionalmente)
- Multi-tenancy **real** com N clientes (fica em V1 — MVP roda **1 tenant** de forma segura).
- Entitlements/planos/billing SaaS.
- Camada AEC ativada em prod (obra, orçamento, medição, Curva-S) — o **código existe**, mas ativar exige multi-tenant + IA maduros.
- Central de Aprovações unificada / Gestor de Tarefas universal.
- Portal do Cliente, marketplace, operação de campo.
- Orçamento IA (memorial PDF → planilha).

### Critério de PRONTO (Definition of Done do MVP)
- [ ] `middleware.ts` ativo; `curl` em rota privilegiada sem cookie retorna **401** (hoje 200).
- [ ] Nenhuma policy `USING(true)` em tabela com PII; `supabase db diff` limpo (file == prod).
- [ ] Escrow: teste automatizado prova que **não libera sem depósito** e **não double-spenda** (2 aprovações paralelas serializam).
- [ ] `service_role` rotacionada; `.env` fora do OneDrive; `backup-auto.yml` deletado; nenhum `NEXT_PUBLIC_INTERNAL_*` no bundle (`grep` no `.next/static`).
- [ ] JWT de sessão verificado (assinatura) — cookie forjado é rejeitado.
- [ ] Os 3 testes de IA passam ao vivo com o dono.
- [ ] KPIs de tempo/SLA saem de `hub_eventos` reais (não mais placeholders).
- [ ] Pentest manual do top-10 da auditoria: todos os 10 fecham.
- [ ] `tsc + vitest + build` verdes em CI bloqueante.

---

## §2 — V1 comercial — *SaaS Multi-Tenant Vendável*

### Objetivo
Colocar **2..N escritórios pagantes** na mesma plataforma com **isolamento real** e uma **porteira de custo/receita** (entitlements + gate de créditos de IA). É a versão que se **vende** e que sustenta a **captação** — o primeiro cliente pagante mora aqui.

### Módulos INCLUÍDOS
1. **Fundação Multi-Tenant REAL (B3.9):** `current_user_tenant_id()` **dinâmica** (lê `users.tenant_id`), `is_hub_owner()`, modelo `fornecedor_id`, provisionar ≥2 tenants e **testar isolamento lado a lado**.
2. **Validação `tenant_id` server-side sempre** (nunca de header/body sem checar; só owner muda).
3. **Integridade do split de comissão (Crítico 4):** `hub_comissao_eventos` imutável + rateio auditável + snapshot no fechamento (hoje `comissao_calculada` é editável via PATCH).
4. **Entitlements SaaS mínimos:** `hub_planos` / `hub_tenant_assinatura` + `requireModulo()` por módulo. Manual-first (dono ativa plano na mão; billing automático fica em V2/V3).
5. **Créditos de IA — gate atômico:** `assertSaldo` **antes** de toda chamada LLM + caminho de recarga + saldo materializado. Estanca custo descontrolado por tenant não-pagante.
6. **B4 — Visibilidade & Dashboard do Hub:** "fornecedor vê só o seu; Hub vê tudo" (RLS `fornecedor_id`) + dashboard do Hub acionável.
7. **Endurecimento IA-security:** prompt-injection (`pushName`), memory-poisoning cross-lead, RAG cross-tenant filtrado por tenant.
8. **Rate-limit/dedup distribuído** (Redis/Postgres) — hoje em `Map` de processo, inútil multi-instância.
9. **Observabilidade mínima:** logger em todas as rotas, redigir `error.message`/PII, healthcheck `/healthz`, Sentry.
10. **CI completo bloqueante** (tsc+vitest+eslint+audit) + Next atualizado + deps vulneráveis fechadas.

### Módulos EXCLUÍDOS de V1
- Camada AEC plena em prod (fica em V2 — pode-se ativar as **migrações** em V1 como aditivo latente, mas o produto de obra não é foco comercial de V1).
- Central de Aprovações unificada / Gestor de Tarefas / Orçamento IA.
- Portal do Cliente, marketplace, campo.
- Billing automático com gateway (V1 é manual-first).

### Critério de PRONTO (DoD do V1)
- [ ] 2 tenants provisionados; teste automatizado prova que tenant A **não lê nem grava** nada de B (rotas + Postgres direto via anon key).
- [ ] `requireModulo()` barra acesso a módulo não contratado; tenant sem plano não consome IA de graça.
- [ ] Comissão: uma vez ganho, o valor é **imutável** (snapshot); PATCH não altera histórico.
- [ ] Gate de saldo dispara **antes** do LLM; saldo negativo bloqueia (fim do modo sombra, se o dono aprovar).
- [ ] Dashboard do Hub mostra os N tenants; fornecedor logado vê só o seu.
- [ ] CI bloqueante verde; deploy com rollback declarado; `/healthz` público responde.
- [ ] Rate-limit sobrevive a 2 réplicas (não dupla-cobra/dupla-responde).

---

## §3 — V2 escalável — *Rede + Obra + Moat Preditivo*

### Objetivo
Transformar a plataforma no **sistema operacional da obra** e da **rede de fornecedores** — onde vive o *moat* (IA preditiva sobre a estrutura unificada). É a tese que se conta ao investidor para justificar **escala e defensabilidade**.

### Módulos INCLUÍDOS
1. **Camada AEC ativada em prod:** aplicar/ligar E0–E7 / A0–A2 (EAP, itens de escopo, restrições, compras/estoque, financeiro/escrow, medição, Curva-S, projetos). Código já existe.
2. **Estrutura Unificada — Fases 1–4:** dado-mãe único (`hub_obra_itens`) projeta memorial/orçamento/contrato/compra/medição/pagamento/Curva-S sem redigitar. `<ArvoreEscopo>` plena; ambiente como nível real.
3. **Central de Aprovações unificada:** elevar `/crm/aprovacoes` a superfície cross-domínio (todos os gates sobre `hub_aprovacoes`; IA prioriza + auto-aprova o trivial por nível de autonomia; a decisão ensina o agente).
4. **Gestor de Tarefas universal:** motor `hub_tarefas` (todo verbo→tarefa; executor humano/agente; SLA; aceite; append-only). Irmão da Central de Aprovações.
5. **B5 — Motor de Distribuição persistido:** `hub_lead_distribuicao` (score multi-critério, Mestre×Vinculado, SLA com redistribuição real).
6. **Orçamento IA (capability-mãe):** memorial PDF → planilha executiva/custos/financeira auditável (v1: humano confirma quantidades).
7. **Performance para volume:** paginação, realtime incremental, virtualização, N+1 do motor/agentes para SQL agregado.
8. **Gestão de usuários (sub-usuários dos tenants)** — RBAC mais fino.

### Módulos EXCLUÍDOS de V2
- Portal do Cliente pleno (fica em V3 — pode entrar um MVP de portal se o mercado puxar).
- Marketplace/iFood da construção.
- Operação de campo (tablet/totem/Lalamove).
- Billing automático com gateway pleno.

### Critério de PRONTO (DoD do V2)
- [ ] Uma obra real é gerida ponta a ponta: escopo → orçamento → contrato → medição → pagamento (escrow) → Curva-S, **sem redigitar**.
- [ ] Central de Aprovações agrega ≥3 tipos de gate; IA auto-aprova o trivial e registra a decisão.
- [ ] Distribuição de leads persiste, respeita SLA e **redistribui** quando estoura.
- [ ] Orçamento IA lê 1 memorial PDF real e produz planilha auditável revisável.
- [ ] Telas com 10k+ linhas não travam (virtualização + paginação).

---

## §4 — V3 enterprise — *Ecossistema + Automação Total*

### Objetivo
Fechar o **ecossistema** (marketplace, campo, portal do cliente que cura os 5 medos) e a **monetização automática** (3 pernas: assinatura + comissão + créditos), com **compliance enterprise**. É a visão de longo prazo que amplia o TAM.

### Módulos INCLUÍDOS
1. **Portal do Cliente pleno:** usuário próprio do cliente + dashboard honesto (avanço, financeiro, diário+fotos, cronograma, aprovar) — cura os 5 medos; selo de auditoria do Hub.
2. **Monetização automática (B5.5 completo):** billing com gateway, assinatura concede créditos, comissão com rateio automático por código único, super-admin de preços; créditos IA fases 3-4 (pré-pago/hard-cap/top-up).
3. **Marketplace / iFood da construção:** cadeia de ofícios com spread por elo; pedidos de materiais compartilhados; asset-light, regional, preditivo.
4. **Operação de campo:** RDO voz/foto (E8), SST com poder de bloqueio (E9), copiloto executivo (E10), tablet comodato, totem de compra por voz, entrega Lalamove.
5. **CRM cross-conta pleno** + dashboards do Hub "absurdamente bons".
6. **Compliance enterprise:** LGPD completa, DR testado (restore + PITR), secret manager + rotação trimestral, headers/CSP, error boundaries, política de retenção.
7. **Marketing/tráfego** (IAs Google + Meta — o dono toca).

### Critério de PRONTO (DoD do V3)
- [ ] Cliente final opera o Portal e aprova pelo próprio usuário.
- [ ] Uma transação real gera split automático para N beneficiários por código único.
- [ ] Pedido de material via campo/totem puxa o projeto e cota frete.
- [ ] DR testado (restore com PITR); auditoria de segurança externa passa.

---

## §5 — Chamadas de julgamento (o que a auditoria pede que se diga em voz alta)

### 5.1 — O que NÃO pode ficar fora do MVP (inegociável)
Estes não são "features": são o **piso de existência** do produto. Cortar qualquer um = vender algo perigoso.
1. **Ligar o middleware** — sem ele, ~60 rotas privilegiadas ficam abertas à internet (CVSS ~9.8).
2. **Matar os `USING(true)` + o `tenant_id.is.null`** — sem isso, o 2º cliente lê o 1º no primeiro dia (LGPD).
3. **Escrow correto (custódia real + anti-double-spend)** — o caminho do dinheiro está contabilmente falso; é a "alma do produto" (os 5 medos) que quebra.
4. **Rotacionar `service_role` + tirar `.env`/PII do Git** — credencial-mestre viva até 2036 e PII no histórico do Git são vazamentos permanentes.
5. **Verificar a assinatura do JWT** — sem isso, qualquer um forja um cookie de owner.
6. **`hub_eventos` de verdade** — sem ele, todo KPI de tempo/SLA é mentira; a gestão que se vende não existe.

### 5.2 — O que PARECE importante mas pode esperar
- **Multi-tenant real com N clientes** — parece o produto todo, mas o MVP roda **1 tenant** com segurança; multi-tenant é V1. (Não confundir "isolar de verdade" com "ter muitos" — MVP isola, V1 multiplica.)
- **Entitlements/billing SaaS** — necessário para **vender a muitos**, não para **provar valor a um**. Manual-first até V1/V3.
- **Camada AEC plena, Orçamento IA, Central de Aprovações unificada** — é o *moat* (V2), não o piso. Impressiona o investidor como **roadmap**, não precisa estar no MVP.
- **Portal do Cliente, marketplace, campo** — visão de ecossistema (V3). Grande valor narrativo, esforço enorme; não bloqueia venda inicial.
- **Refatorar god-files (wizard 3.896 linhas), consolidar 3 APIs de agente** — dívida de manutenção real, mas não bloqueia go-live. Baixo/contínuo.

### 5.3 — O que PARECE pequeno mas é BLOQUEADOR
Itens de esforço baixo (horas) cujo **não-fazer** invalida tudo à volta:
- **`CREATE POLICY IF NOT EXISTS` (SQL inválido) — 3h.** Faz a RLS do financeiro **falhar em silêncio**; contas a pagar/receber ficam abertas ao `anon`. Um typo que abre o dinheiro.
- **`x-vercel-cron:1` forjável — 2h.** Um header trivial dispara IA + WhatsApp em massa (custo real + spam ao cliente).
- **Zoom desabilitado — 0.5h.** Gate de acessibilidade (LBI/ADA); reprova antes de qualquer venda a conta grande.
- **`|| ANON_KEY` como fallback — 6h.** Rota "segura" cai para anon silenciosamente quando a env falta; segurança não-determinística.
- **Deletar `backup-auto.yml` — 1h.** Enquanto existir, **cada push** grava PII de leads no histórico do Git para sempre.
- **`hub_fornecedores` sem RLS — 2h.** É a **fonte do motor de leads**; sem RLS, a rede inteira vaza.
- **Índices/FK ausentes (`pessoa_id`, `lead_id`) — 3h.** Não é bug, é seq-scan; o merge de dedup degrada e o "código único" fica lento sob volume.

### 5.4 — Maior valor com menor esforço (fazer primeiro dentro de cada fase)
Ordenado por **impacto ÷ esforço** (dados de esforço da auditoria):
1. **Ligar o middleware (2h) + deletar `backup-auto.yml` (1h) + rotate `service_role` (2h) + cron secret (3h).** ~8h fecham os vetores de maior gravidade (bypass total, PII no Git, credencial-mestre, disparo remoto).
2. **Zoom (0.5h) + loading do Atendimento (2h)** — já feitos; remove gate de a11y e trava de UX por quase nada.
3. **`hub_lead_lookup` com `.eq(tenant_id)` (2h) + `hub_fornecedores` RLS (2h)** — fecha vazamento no ponto mais sensível (motor de leads).
4. **`hub_eventos` de verdade + timeline (parte de G)** — destrava **todos** os KPIs reais de uma vez; alavanca de produto altíssima.
5. **Gate atômico de créditos (V1)** — poucas horas de wrapper único de LLM estancam custo descontrolado em **todos** os pontos de IA.

---

## §6 — Rastreabilidade (de onde vem cada versão)

| Versão | Fases do MACRO-PLAN | Blocos da AUDITORIA |
|---|---|---|
| **MVP** | Fase 0 (parte) + Fase 1 + Fase 2 (parte crítica) | 🔴 CRÍTICO inteiro (~90–120h) + UX crítico |
| **V1** | Fase 2 (multi-tenant real) + Fase 3 (B4, entitlements, créditos) | 🟠 ALTO (~120–160h) + parte do 🟡 |
| **V2** | Fase 3 (B5) + Fase 4 (AEC, aprovações, tarefas, orçamento IA) | 🟡 MÉDIO (perf, DB) + IA-first pleno |
| **V3** | Fase 5 (marketplace, campo, portal, cross-conta) + monetização automática | 🟢 BAIXO (hardening) + compliance enterprise |

> **Nota honesta:** as fronteiras são **guias, não muros**. Migrações da AEC podem ser **aplicadas** já na janela do MVP (são aditivas e latentes) sem "entregar" o produto de obra — isso adianta V2 sem custo. O que **não** se antecipa é ativar obra/portal/marketplace **antes** da fundação (middleware + tenant + IA), sob pena de "construir no ar".
