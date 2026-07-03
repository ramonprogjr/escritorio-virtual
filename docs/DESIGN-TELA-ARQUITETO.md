# DESIGN — A TELA DO ARQUITETO (COMPLETA, com o Módulo Financeiro)

> Documento de design para o dono aprovar. **Nenhum código aqui** — só a decisão de tela,
> o que reusa do que já existe, o que é novo, o plano de ondas aditivas e as decisões que
> dependem de você.
> Base de identidade: dark **verde + dourado** tokenizado (`--obra-*`), **Click-and-Go /
> Talk-and-Go**, códigos de **identidade escondidos** (o arquiteto sempre vê o **NOME** do
> cliente/projeto/etapa, nunca `PJ`/`OB` cru), **delete = arquiva**, **Hub = juiz/auditor**.
> Data: 03/jul/2026. Persona-alvo: **arquiteto** (`architect`), com recorte por persona
> obrigatório.

---

## 1. RESUMO + O QUE FALTAVA

### 1.1 O que a Tela do Arquiteto é HOJE (verificado no código)
`lib/crm/persona-cockpit-aggregate.ts → buildArquiteto()` entrega **3 cards estáticos**:
- **Projetos** (contagem de `hub_projetos`),
- **Em aprovação** (`hub_projetos_fases` com `aprovacao_status='enviado'`),
- **Disparidade de orçamento** = literalmente `"—" / "chega em breve"` (placeholder).

Mais a ação de topo **"X chaves de pagamento aguardando sua assinatura"**
(`acaoChavesEscrow`, via `contarChavesEscrowPendentes`, href `/crm/aprovacoes`). **Não há
nenhum financeiro.** Não há drill-down: os 3 cards só linkam a lista `/crm/arquitetura`.

### 1.2 O que faltava (o pedido do dono, 03/jul)
1. **Módulo Financeiro** — Geral Hub↔Parceiro; **Tijolos** (créditos de IA); **pagamentos de
   clientes**; **financeiro do escritório**; **pagamentos por PROJETO com o fluxo do cliente
   (paga → escrow → libera)**; **resumo geral** + **aba Financeiro** no menu e na Visão Geral.
2. **Visão Geral (home)** com painéis macro + micro de **todas as áreas** e **drill-down** real.
3. **Analytics tipo TV** por persona, tempo real, big-numbers.
4. **Relatórios** no padrão do Hub (`/crm/relatorios`: tabela + CSV + fonte real).

### 1.3 A regra-mãe de honestidade (inegociável)
O dono **já reprovou "parede de zeros"**. Todo bloco sem fonte **degrada com FRASE
específica por causa** (`"aparece quando a obra registrar"`, `"começa quando a obra for
gerada"`, `"migração pendente"`), com **contorno tracejado**, **nunca R$0 mudo**. Isto é a
promessa que cura os medos "não saber" e "ser enganado".

### 1.4 O que é REAL hoje × o que depende de decisão sua (mapa de honestidade)
| Bloco | Estado hoje | Fonte |
|---|---|---|
| **Financeiro do Escritório** | Código existe (`aggregateFinanceDashboard`) **mas ver §7-D1: hoje só cobre por `tenant_id`, sem coluna de dono do lançamento** | `hub_contas_pagar/receber` |
| **Tijolos** | Real, mas **rota barra o arquiteto** (`requireCrmGestor`) — precisa ajuste | `/api/crm/ia/creditos` |
| **Chaves de escrow pendentes** | Real e vivo | `contarChavesEscrowPendentes` |
| **Projetos / em aprovação / atrasados** | Real e vivo | queries de `hub_projetos*` |
| **Obras vinculadas** | Real (recortar por `projeto.obra_id`) | `obras.emAndamento` |
| **Pagamentos de Clientes / custódia / liberado** | **Vazio** — migração **E6 dormente** em prod | `hub_obra_pagamentos/escrow_*` |
| **Lado ENTRADA do escrow (cliente paga → depósito)** | **Inexistente em código** — não há RPC de depósito | — |
| **Geral Hub↔Parceiro além de Tijolos** | **Inexistente** — sem schema de assinatura/comissão | — |

### 1.5 Correções que este documento aplica sobre a proposta anterior (críticas incorporadas)
- **[Segurança/mecanismo]** As rotas de financeiro **não** gateiam pela capability
  `financeiro:ler` — gateiam por `requireCrmFinanceiro` (= `crmNivel` ∈ owner/gestor/
  financeiro). O arquiteto já é barrado pelo `crmNivel='comercial'`. Logo o risco real **não**
  é "dar financeiro:ler abre as 40 rotas" — é **promover o arquiteto a nível financeiro/
  gestor**. **A rota nova precisa de guard PRÓPRIO por capability nova + recorte de dado**, e
  **não** pode reusar a rota existente do gestor. (§3, §7-D2)
- **[CRÍTICO/dados]** `architect` tem `escopo_tenant='hub'` (é **membro do tenant do Hub**, não
  tenant próprio). `aggregateFinanceDashboard` lê contas **só por `tenant_id`** — **não há
  coluna de dono do lançamento**. Então "a conta do escritório dele" recortada por tenant =
  **a conta INTEIRA do Hub**. Isso **vaza** o financeiro do Hub. **§7-D1 vira a decisão nº1**:
  qual é o modelo de tenant do escritório do arquiteto. Até resolver, **Bloco 4 nasce vazio**,
  não reusa o agregador tenant-wide cegamente.
- **[Sequência]** A dor é "faltou o financeiro" — então **a Onda do financeiro real vem
  primeiro** (ou entrelaçada), não o refactor do payload. (§6)
- **[Anti-parede-de-zeros]** A tira e os 4 pools **crescem por onda**: só renderiza o pool que
  tem fonte real. **Hub↔Parceiro** e **Pagamentos-de-Cliente** só aparecem quando houver
  schema/E6 — **não** como painel permanente de "em breve". (§3)
- **[Core do arquiteto]** **Honorário de projeto** (receita nº1 do arquiteto, muitas vezes
  **pré-obra**) **não** é coberto pela opção A (reuso de `hub_obra_*`). É **core, não rodapé**
  → decisão de produto de alto impacto. (§7-D3)
- **[TV enxuta]** v1 corta cache server-side e carrossel (otimização prematura). Fica
  `liveValues` via COUNT + ticker `hub_eventos` + indicador "atualizado há Ns". (§4)
- **[Relatórios fatiados]** v1 entrega `projetos + entregaveis + tijolos_consumo` (fonte real);
  entidades de escrow/pagamento vão junto da Onda 5/6. (§5.3)
- **[Tijolos]** Rota `/api/crm/ia/creditos` é `requireCrmGestor` → **arquiteto = 403 hoje**.
  Precisa rota/guard por capability, sem baixar o acesso a comercial/atendente. (§3-B2, §7-D6)
- **[hub_eventos]** tenant-scoped **≠** persona-scoped. O ticker precisa **allowlist de tipos
  por persona** + garantir que o payload do evento **não** carrega valor monetário/PII de
  cliente. (§4)
- **[RLS]** `finance-dashboard-aggregate` ainda usa `.or(tenantScopeOrFilter)` (casa
  `tenant_id.is.null`) → sob service-role mistura linhas legadas/de outro tenant. **Padronizar
  em `.eq('tenant_id')` puro é PRÉ-REQUISITO** antes de ampliar o público. (§7-D1)
- **[Cor da custódia]** `lib/obras/financeiro.ts` pinta `em_custodia` de **violeta**
  (`#8B5CF6`, escudo) — o sistema quer **dourado = dinheiro**. Recomendação fechada em §8.

---

## 2. A TELA DO ARQUITETO — VISÃO GERAL (cockpit / home) com drill-down

### 2.1 Contrato visual inegociável (vale para todas as 5 superfícies)
| Cor | Significado — e SÓ ele |
|---|---|
| **Dourado** `#c9a24a` / `#e0b86a` | **dinheiro / valor monetário** |
| **Verde** `#34d399` | saudável / liberado / pago |
| **Vermelho** `#f85149` | atrasado / crítico / disparidade (**nunca dourado aqui — disparidade é RISCO, não dinheiro**) |
| **Tracejado + texto-2** | "sem dado ainda" (distinto de zero real) |
| **Cadeado/escudo dourado** | dinheiro **do cliente** em custódia, protegido pelo Hub — **nunca somado ao saldo do escritório** |

**Regra-mãe dos 4 pools:** Hub↔Parceiro (Tijolos), Escrow em custódia (do cliente),
Aguardando 2ª chave, e Financeiro do Escritório aparecem **sempre lado a lado, com rótulo e cor
próprios — jamais fundidos num único "seu dinheiro"**. Misturá-los quebra o Hub-como-juiz e
reacende o medo "perder dinheiro".

### 2.2 A home passa de 3 cards flat para 5 SEÇÕES em faixas
`app/crm/page.tsx → buildArquiteto`. Cada faixa tem título + 2–4 cards clicáveis
(`CrmMetricCard`). **A ação nº1 continua no topo** (a única ação financeira que o arquiteto
**executa**; o resto é leitura):

> ⚡ **"X chaves de pagamento aguardando sua assinatura"** — `acaoChavesEscrow`, href
> `/crm/aprovacoes`, CTA **Assinar**. (Já existe — mantido intacto.)

**Seção A — PROJETOS** (fonte viva hoje): Na fila · Em aprovação · Atrasados · Entregues no mês.
**Seção B — OBRAS vinculadas** (viva): obras em andamento via `projeto.obra_id`
(`obras.emAndamento` recortado).
**Seção C — FINANCEIRO** (cresce por onda): A receber do cliente · Em custódia · Aguardando 2ª
chave · Saldo do escritório · Tijolos (saldo). **Só renderiza o pool com fonte real** —
selo dourado/cadeado quando depende do E6 ainda dormente.
**Seção D — APROVAÇÕES & CHAVES** (viva): chaves técnicas pendentes
(`contarChavesEscrowPendentes`) + entregáveis a aprovar. Mantidos no **topo** como ação.
**Seção E — ALERTAS** (honestos): fonte vazia, atraso, disparidade — cada um com a **própria
frase de causa**.

### 2.3 Drill-down real (pedido explícito — hoje NÃO existe em nenhuma persona)
Clicar num big-number **abre métricas detalhadas + mini-analytics da área**, não uma lista
solta. Exemplos:
- `Atrasados: 3` → board de projetos **filtrado**.
- `Em custódia: R$42k` → aba **Financeiro › bloco Pagamentos de Clientes** já expandido.
- `Tijolos` → `/crm/creditos` embutido.
- `Chaves: 2` → `/crm/aprovacoes` filtrado às **chaves técnicas do arquiteto**.

**Macro × micro como CONTINUIDADE (Gestalt):** o micro herda **ícone + cor + posição de acento**
do card macro que originou o clique; breadcrumb com a sublinha **na cor do card de origem**;
transição `analytics-enter` (scale 0.97→1). Ao voltar, o card de origem **pisca borda dourada
400ms** — sensação de "zoom na mesma métrica", não "fui para outro lugar".

### 2.4 Mudança técnica necessária no payload (aditiva)
Hoje `PersonaCockpitPayload` é **flat** (`acoes/cards/avisos`) e `CrmPersonaCockpit` renderiza
**um grid único**. Para faixas com destino de clique, **evoluir o payload para SEÇÕES tipadas**
(cada seção = título + cards + `href` de destino), mantendo o degrade honesto por bloco
(`safeCount → aviso`). **Aditivo — não quebra as outras personas.** (Feito na Onda 1, **depois**
do financeiro real — ver §6.)

### 2.5 Regra do semáforo "está tudo bem?" (limiares EXPLÍCITOS — antes faltava)
Um único semáforo cruzando saldo + custódia + chaves, para responder em 1 olhada:
- 🔴 **vermelho** se `contas_vencidas > 0` **OU** `chaves_pendentes ≥ 3`.
- 🟡 **amarelo** se `vence_em_7d > 0` **OU** `1 ≤ chaves_pendentes ≤ 2`.
- 🟢 **verde** caso contrário **E** com pelo menos uma fonte real disponível.
- ⚪ **cinza-tracejado** ("sem dado ainda") se **nenhuma** fonte alimenta o semáforo — nunca
  verde falso sobre vazio.

### 2.6 Primeiro uso / tenant sem nada (antes faltava)
Tenant novo, arquiteto **sem nenhum projeto**: não basta "degrade honesto" por bloco. A home
mostra um **caminho de largada** ("Ainda não há projetos — comece criando um briefing")
com **1 CTA primário**, em vez de 5 seções tracejadas. O mesmo vale para a TV (§4) e os
relatórios (§5).

### 2.7 Mobile
Seções viram **cards empilháveis** (mobile-first), mesmos destinos de clique. Estado-vazio
**sempre específico por causa**: "sem projeto com obra ainda" ≠ "obra sem orçamento aprovado" ≠
"migração pendente".

---

## 3. MÓDULO FINANCEIRO (completo) — reuso vs novo

**Rota nova:** `/crm/arquitetura/financeiro` (aba própria no menu lateral). **Guard próprio**
por capability nova estreita (§7-D2), **não** reuso da rota do gestor. Recorte por persona
**obrigatório**: nunca vaza o financeiro do Hub nem tipos comerciais.

### 3.1 RESUMO GERAL (tira única no topo, estilo boarding-pass)
4–5 números separados por **hairline dourado fino**, lidos como **uma frase financeira**, não
grade de caixas:

> Hub↔Parceiro (Tijolos) | A receber do cliente | Em custódia | Aguardando 2ª chave | Saldo do escritório

+ 1 **semáforo** (§2.5). **NUNCA um total consolidado dos 4 pools.**
**Anti-parede-de-zeros:** a tira **cresce por onda** — só entra o número que tem fonte real.
No dia 1 ela nasce **curta** (Tijolos + chaves + [Escritório, se §7-D1 permitir]) e ganha
colunas conforme as ondas destravam as fontes. **Não** renderizar 60% da tira tracejada.

### 3.2 BLOCO 1 — HUB↔PARCEIRO (a conta do escritório COM o Hub)
- **Real hoje:** só **Tijolos** toca dinheiro Hub↔escritório (e apenas como medição).
- **Assinatura SaaS + comissionamento/split NÃO têm schema.** Este bloco **não** existe como
  painel permanente de "em breve" — ele **só aparece quando houver schema** (§7-D4). Enquanto
  não houver, **não ocupa espaço na tela** (decisão anti-zeros).
- Quando existir: layout dividido por **hairline vertical** — "Hub" à esquerda, "Escritório" à
  direita, **nunca fundidos**. **Nunca simular números** (foi o erro do analytics comercial que
  o dono já sofreu).

### 3.3 BLOCO 2 — TIJOLOS (Carteira de créditos de IA)
- **Reuso** de `GET /api/crm/ia/creditos` → `{ saldo, consumo[origem, modelo, creditos,
  criado_em] }`. Embutir como bloco, sem duplicar lógica.
- **⚠️ Correção obrigatória:** a rota hoje é `requireCrmGestor` → **arquiteto (comercial) toma
  403**. Baixar o guard para "comercial" exporia Tijolos a **comercial/atendente** (over-grant).
  **Solução:** rota nova (ou guard por capability `financeiro:proprio` **na rota**, não só na
  nav), mantendo **`custo_brl` blindado** (já removido do payload — manter). (§7-D6)
- Visual: **medidor segmentado** (blocos dourados = saldo, contorno vazio = consumido) — **não**
  o número-grande de dinheiro (Tijolo não é R$).

### 3.4 BLOCO 3 — PAGAMENTOS DE CLIENTES (cliente paga → escrow → libera)
O coração do pedido. Lista de projetos do arquiteto com barra do fluxo **Previsto → Pago pelo
cliente → Em custódia → Liberado** + badge de quantos aguardam a **2ª chave**.
- A metade **"LIBERA"** já existe (`rpc_liberar_escrow`, Gate 2 duplo arq+hub).
- A metade **"CLIENTE PAGA" NÃO existe**: não há RPC nem endpoint que insira movimento
  `tipo='deposito'` nem incremente `saldo_custodia`. Por isso **"Em custódia" será 0 mesmo após
  a migração E6**. Até o lado-entrada existir (§7-D5, Onda 6), o bloco mostra **estado-vazio
  honesto** ("aparece quando o Hub confirmar o primeiro depósito"), nunca zero disfarçado.
- **⚠️ Honorário de projeto (§7-D3):** a opção A (reusar `hub_obra_*` via `projeto.obra_id`)
  **não cobre honorário de projeto** — a receita nº1 do arquiteto, frequentemente **pré-obra**.
  Isto é **core**, não borda. Decisão de alto impacto para o dono.

### 3.5 BLOCO 4 — FINANCEIRO DO ESCRITÓRIO (a conta dele)
- **Intenção:** reusar `aggregateFinanceDashboard` (`hub_contas_pagar/receber`): a pagar/receber
  em aberto, vencidos, vence em 7 dias, saldo projetado, aprovações de dinheiro. CTA para
  `/crm/financeiro/receber` e `/pagar`.
- **🔴 BLOQUEIO CONCEITUAL (§7-D1):** `architect` tem `escopo_tenant='hub'` — ele é **membro do
  tenant do Hub**, não tenant próprio. `aggregateFinanceDashboard` recorta **só por
  `tenant_id`**, e **não existe coluna de dono do lançamento** (`responsavel/arquiteto_id/
  criado_por`) em `hub_contas_*`. Recortar por tenant = **mostrar a conta INTEIRA do Hub** ao
  arquiteto — exatamente a faixa-dinheiro do Hub que o design jura esconder.
  **→ Bloco 4 depende da decisão de modelo de tenant (§7-D1). Até lá, nasce em estado-vazio,
  NÃO reusa o agregador tenant-wide.**
- **Pré-requisito de RLS:** `finance-dashboard-aggregate` ainda usa `.or(tenantScopeOrFilter)`
  (casa `tenant_id.is.null`, dobra o default) → sob service-role mistura tenants. **Padronizar
  em `.eq('tenant_id')` puro ANTES de expor a qualquer persona nova.**
- Quando liberado: cards sobre painel com leve **tint verde-glow** ("isto é a conta do dono do
  tenant") vs. cards do Hub em dark-3 neutro. **CRÍTICO:** escrow em custódia (dinheiro do
  cliente) **NUNCA soma** ao saldo projetado do escritório — pools separados.

### 3.6 FINANCEIRO POR PROJETO (dentro da ficha — 6ª aba "Pagamentos")
A ficha do projeto hoje tem **5 abas** (Conversar/Programa/Funil/Entregáveis/Engenharia) e a aba
Engenharia **já** linka `/crm/obras/${projeto.obra_id}`. Ganha a **6ª aba "Pagamentos"** = o
**fluxo do cliente dentro do projeto**:
- **Stepper horizontal** `Pago (verde) → Em custódia (dourado, pulse-gold suave enquanto aguarda
  2ª chave) → Liberado (verde/check)` — a assinatura visual do escrow, **idêntica** na ficha do
  projeto, no Bloco 3 e na TV.
- **Reuso 1:1** do componente da obra (`ObraFinanceiroSecao` via `projeto.obra_id`) e dos
  tipos/labels/cores de `lib/obras/financeiro.ts` (`baldePagamento`, `derivarEstadoDupla`,
  `classificarCobertura`, `ResumoFinanceiro`) — **arquiteto e engenharia veem o MESMO dinheiro**.
- **Sem obra → estado-vazio honesto:** "o fluxo financeiro do cliente começa quando a obra for
  gerada". (E, pré-obra, ver honorário em §7-D3.)

### 3.7 RECORTE / SEGURANÇA (bloqueante — verificado no código)
- **Mecanismo real:** as rotas do financeiro gateiam por `requireCrmFinanceiro`
  (`crmNivel` ∈ owner/gestor/financeiro). O arquiteto é `crmNivel='comercial'` → **já barrado**.
  O risco **não** é a capability `financeiro:ler`; é **promover o arquiteto a nível financeiro/
  gestor**. **Por isso a rota nova precisa de guard PRÓPRIO** por capability nova estreita —
  **não** reusar a rota do gestor (que exige nível financeiro).
- **Capability nova e ESTREITA** (ex. `financeiro:proprio`) que libere **só**: resumo por
  projeto/obra vinculada + Tijolos + chaves. **O recorte precisa ser no DADO** (tenant + vínculo
  do arquiteto por projeto/obra), **não só na navegação** — senão as ~40 rotas do gestor ficam
  acessíveis por **URL direta (IDOR de rota)**.
- **Teste de aceite:** arquiteto acessa `/crm/arquitetura/financeiro` sem 403; **NÃO** acessa as
  rotas genéricas do gestor/Hub (403 **mantido**); `custo_brl` **ausente** no payload; outro
  tenant **não** vaza.

### 3.8 Tabela reuso × novo
| Peça | Reusa | Novo |
|---|---|---|
| Financeiro do Escritório | `aggregateFinanceDashboard` (após `.eq` puro) | **coluna/tenant de recorte (§7-D1)** |
| Tijolos | `/api/crm/ia/creditos`, `saldoCreditos` | **guard por capability na rota** |
| Chaves | `contarChavesEscrowPendentes`, `/crm/aprovacoes` | filtro "chaves técnicas do arquiteto" |
| Pagamentos por projeto | `ObraFinanceiroSecao`, `lib/obras/financeiro.ts` | 6ª aba + estado-vazio pré-obra |
| Pagamentos de Clientes (entrada) | `rpc_liberar_escrow` (só saída) | **RPC de depósito (§7-D5, Onda 6)** |
| Hub↔Parceiro | Tijolos | **schema SaaS/comissão (§7-D4)** |

---

## 4. ANALYTICS TIPO TV (por persona, tempo real) + PLANO DE ALIMENTAÇÃO

### 4.1 Modo TV por persona (a TV do arquiteto ≠ Hub ≠ engenharia)
Tela **full-bleed**, sem sidebar/menu/glassmorphism, para monitor grande/projetor.
- Grade de **no máximo 6 hero-numbers** em escala de TV (96–120px, leitura a ~3m, só
  `--obra-texto #e6edf3` ou `--obra-dourado-light`).
- Métricas do arquiteto: Projetos na fila · Em aprovação · Atrasados · Entregues no mês ·
  Chaves pendentes · Em custódia (R$) · Liberado no mês (R$) · Tijolos consumidos hoje.

### 4.2 Fonte = CONTAGEM AO VIVO on-demand (NÃO o KPI armazenado)
Ponto crítico. Os big-numbers vêm de **COUNT/select ao vivo a cada refresh** (mesmo padrão
`safeCount` / `contarChavesEscrowPendentes` / `obras.emAndamento` / `liveValues` que **já**
funciona), refletindo o banco no instante da query.
**NÃO ligar a TV em `hub_kpis_resultados`:** o cron que alimenta essa tabela
(`/api/crm/kpis/calcular`) **só existe em `vercel.json`, que o Render (produção real) IGNORA** —
hoje só enche via botão manual "Atualizar KPIs" e só para o `DEFAULT_TENANT`. Copiar esse
caminho = **a parede de zeros que o dono já reprovou**.

### 4.3 Ticker de eventos ao vivo (a peça mais barata e mais honesta de tempo-real)
`hub_eventos` é keystone, **já é escrito** em todo o app (`registrar-evento.ts`) mas **hoje
ninguém o lê no analytics**. Um `SELECT ... ORDER BY criado_em DESC LIMIT 20` vira um feed
"últimas atividades" **100% real-time**, sem KPI/cron/migração. É o **único pedaço genuinamente
real-time** do sistema hoje.
- **⚠️ tenant-scoped ≠ persona-scoped:** `hub_eventos` recebe eventos de **todas** as personas/
  domínios (comercial, financeiro, obra, escrow). Filtrar só por `tenant_id + tipo` **não** é
  recorte por persona — um evento comercial/de valor apareceria na TV do arquiteto. **Exigir:**
  (1) **allowlist de TIPOS por persona** (arquiteto: entrega, aprovação, chave-assinada,
  projeto-criado); (2) verificação de que **o payload do evento não carrega valor monetário/PII
  de cliente** que o arquiteto não deva ver.

### 4.4 Auto-refresh por polling (30–60s) + honestidade do "ao vivo"
Hoje `CrmAnalyticsDashboard` **não** tem `setInterval`/polling/Realtime. Adicionar **polling
client-side de 30–60s** chamando a mesma rota agregada é o mínimo para "tempo real" honesto (é
**painel de obra**, não trading floor — sub-segundo/Supabase Realtime ficam para Fase 2).
- **Indicador "ao vivo" obrigatório:** timestamp **"atualizado há Ns"** + pulso sutil.
- **Falha-de-fetch ≠ fonte-vazia (antes faltava):** um blip de rede num refresh **não** pode
  ler como "sem dados" (tracejado). Estado próprio: **"última leitura ok há Ns · reconectando…"**
  — não mentir tempo-real ao contrário.

### 4.5 Microinterações event-triggered (nunca idle/looping)
Mudança de valor dispara **UM** ciclo de `number-tick` (já existe em `globals.css`) só no dígito
que mudou, seguido de **UM** `pulse-gold` (valor monetário) ou `pulse-red` (alerta). **Pulso
contínuo em TV lê como "erro piscando"** — single-shot por mudança, acordado com engenharia.

### 4.6 Degradação isolada por bloco
Blocos live (funis, atendimento, obras, chaves, escrow) → "tempo real pleno" (pulso ativo).
Blocos que dependem do cron morto/E6 dormente → tratamento **degradado** (tracejado + "sem dados
ainda", câmbio nunca em dourado). **A TV nunca quebra inteira por uma fonte vazia.**

### 4.7 Guard da TV (antes faltava)
A rota da TV (full-bleed, kiosk) usa o **mesmo guard server-side** (auth + capability) e
`tenantId` **da sessão** (`getCallerContext`), **nunca** de query/param. Aberta horas num
projetor, **não** mantém sessão com privilégio além do necessário.

### 4.8 O que foi CORTADO da v1 (evitar otimização prematura — crítica incorporada)
- **Cache server-side por tenant** e **carrossel de excedente**: só entram **se/quando** houver
  carga real (poucas TVs abertas hoje). Se voltarem, a **chave de cache = `tenantId`** (nunca
  global — não servir dado de um tenant a outro).

### 4.9 Plano de alimentação — 3 classes de dado (anti-parede-de-zeros)
- **CLASSE 1 — computável JÁ** (sem cron/migração): projetos na fila/aprovação/atrasados/
  entregues, chaves pendentes, obras vinculadas, fila/atendimento, Financeiro do Escritório
  (após §7-D1), Tijolos, ticker `hub_eventos`. **Tempo real de fato** via COUNT/select
  on-demand; degrada isolado.
- **CLASSE 2 — não computável sem trabalho novo:** (a) qualquer KPI com **série histórica/
  tendência/delta** depende de `hub_kpis_resultados` (cron morto no Render) → **0 mudo** se
  copiado; por isso a TV usa `liveValues`. (b) custódia/liberado/disparidade dependem da
  **migração E6** (dormente) → estado-vazio explícito.
- **CLASSE 3 — inexistente em código:** lado ENTRADA do escrow (cliente paga → depósito; sem
  RPC; bug conhecido do `GREATEST` gerando custódia fantasma) e Hub↔Parceiro além de Tijolos.
- **Regra de ouro:** "Em custódia" só sai de zero, **nesta ordem**: (1) migração E6 aplicada;
  (2) fix #5 do `GREATEST`; (3) RPC de depósito construída **e** alguém a chamar quando o
  cliente pagar. Até lá a tela diz **"aparece quando o Hub confirmar o primeiro depósito"**.

---

## 5. ABA FINANCEIRO no menu + home; RELATÓRIOS padrão Hub

### 5.1 Aba "Financeiro" no menu lateral esquerdo
Nova entrada de nav para o arquiteto → `/crm/arquitetura/financeiro`, **liberada pela capability
nova** (§7-D2). Ícone/rótulo em dourado (dinheiro). **Não** aparece para personas sem a
capability.

### 5.2 Card "Financeiro" na Visão Geral (home)
A **Seção C** (§2.2) é o atalho de home para o módulo — cada big-number com **destino de clique**
(nunca decorativo), abrindo o bloco correspondente já expandido (drill-down §2.3).

### 5.3 Relatórios (padrão `/crm/relatorios` — tabela + CSV + fonte real)
Reuso 1:1 do molde de `lib/crm/relatorios-data.ts`: `RELATORIO_LIMIT=500`, `count:'exact'` para
total real, **truncado + aviso**, `.eq('tenant_id')` puro (defesa-em-profundidade sob
service-role), **anti-injeção de fórmula no CSV**.
- **v1 (fonte real hoje):** `projetos`, `entregaveis`, `tijolos_consumo`.
- **Adiado p/ Onda 5/6 (tabelas vazias até E6 + RPC):** `pagamentos_projeto` (join
  projeto→obra→`hub_obra_pagamentos`), `escrow_movimentos`. Construir CSV de fonte vazia é
  esforço sem valor imediato.
- **Guard do export (antes faltava):** a exportação usa a **mesma capability** e recorte por
  tenant/projeto; enunciar o teste 403 (arquiteto exporta só as entidades da sua allowlist).

---

## 6. PLANO DE ONDAS ADITIVAS (cada uma com E2E + sinal de adoção)

> **Ordem corrigida (crítica incorporada):** o **financeiro real vem primeiro**; o refactor do
> payload da home vem logo após, mínimo. Cada onda é aditiva e não toca outras personas.
> **Onda 0 é pré-requisito sem código.**

### ONDA 0 — DECISÕES DO DONO (sem código)
Travar as decisões de §7. Bloqueia o schema novo das ondas 3+ e o Bloco 4.
**Aceite:** doc de decisão aprovado.

### ONDA 1 — FINANCEIRO DO ESCRITÓRIO + TIJOLOS + CHAVES (MVP financeiro real)
Rota `/crm/arquitetura/financeiro` + capability `financeiro:proprio` (§7-D2) + entrada na nav.
Blocos vivos: **Financeiro do Escritório** (após decisão §7-D1 e `.eq` puro), **Tijolos** (guard
por capability, `custo_brl` blindado), **resumo-tira** + card de chaves. Hub↔Parceiro e
Pagamentos-de-Cliente **não** entram (sem fonte).
**E2E:** arquiteto acessa Financeiro sem 403; **não** acessa rotas do gestor/Hub (403 mantido);
`custo_brl` ausente; outro tenant não vaza.
**Sinal de adoção:** % de arquitetos que abrem a aba Financeiro ≥1×/semana; nº de cliques em
"Assinar" a partir do card de chaves.

### ONDA 2 — HOME EM SEÇÕES + DRILL-DOWN (leitura, dados já vivos, zero schema)
Evoluir `PersonaCockpitPayload` flat → **seções tipadas** e `CrmPersonaCockpit` para faixas
macro com cards clicáveis → drill-down. `buildArquiteto` ganha Projetos/Obras/Aprovações das
queries que já existem. Primeiro-uso digno (§2.6).
**E2E:** logar como `architect`, ver 5 seções, clicar em cada big-number e cair na métrica
detalhada/lista filtrada correta; degrade honesto com tenant vazio.
**Sinal de adoção:** taxa de clique nos big-numbers (drill-down usado, não decorativo).

### ONDA 3 — ANALYTICS/TV DO ARQUITETO + TICKER (tempo real honesto)
Rota TV full-bleed por persona, até 6 hero-numbers **on-demand**, polling 30–60s, ticker lendo
`hub_eventos` (novo consumidor, `SELECT` tenant-scoped + **allowlist de tipos por persona**),
indicador "atualizado há Ns" + estado "reconectando", pulso single-shot. **NÃO** liga em
`hub_kpis_resultados`. **Sem cache/carrossel na v1.**
**E2E:** abrir TV, números batem com o banco, criar um evento e vê-lo no ticker em <60s, fonte
vazia degrada isolada sem quebrar a tela; guard server-side (query/param não muda tenant).
**Sinal de adoção:** nº de tenants com TV aberta; tempo médio de sessão da TV.

### ONDA 4 — RELATÓRIOS DO ARQUITETO (padrão Hub, fatiado)
Entidades `projetos`, `entregaveis`, `tijolos_consumo` em `relatorios-data.ts` (reuso do molde),
liberadas ao `architect` na allowlist com `.eq('tenant_id')` puro + guard de export.
**E2E:** cada aba lista fonte real tenant-scoped, exporta CSV, respeita LIMIT+aviso, não vaza
outro tenant.
**Sinal de adoção:** nº de exports/mês por arquiteto.

### ONDA 5 — FLUXO DO CLIENTE POR PROJETO (6ª aba "Pagamentos") — depende da janela E6
6ª aba reusando `ObraFinanceiroSecao` via `projeto.obra_id` (stepper Pago→Custódia→Liberado,
`ResumoFinanceiro`); sem obra → estado-vazio. Só mostra números reais após **E6 migrado + fix
`GREATEST`**.
**E2E:** projeto com obra vê o mesmo financeiro da engenharia; projeto sem obra mostra a frase
honesta; chave técnica do arquiteto aparece com CTA Assinar quando pendente.
**Sinal de adoção:** nº de assinaturas de chave feitas a partir da aba.

### ONDA 6 — LADO ENTRADA DO ESCROW + HUB↔PARCEIRO (Fase 2, pós-decisão comercial)
`rpc_registrar_deposito_escrow` (Hub confirma recebimento/Pix, MVP manual; webhook de gateway
depois) → "Em custódia" sai de zero; extrato Hub↔Parceiro quando o modelo de cobrança (SaaS +
comissão/split) for travado em schema (§7-D4). **Só aqui** "cliente paga → escrow → libera" fica
100% real. **Não construir antes da decisão comercial.**
Aqui também entram as entidades de relatório `pagamentos_projeto` e `escrow_movimentos`.
**Sinal de adoção:** nº de depósitos confirmados; % de projetos com custódia > 0.

---

## 7. DECISÕES DO DONO (Onda 0 — pré-requisito)

**D1 — MODELO DE TENANT DO ESCRITÓRIO (a decisão nº1, bloqueante).**
`architect` tem `escopo_tenant='hub'` (membro do tenant do Hub). `aggregateFinanceDashboard`
recorta contas **só por `tenant_id`**, e **não há coluna de dono do lançamento**. Então "a conta
do escritório dele" por tenant = **a conta inteira do Hub** (vaza margem/dinheiro comercial).
- **(A)** O escritório do arquiteto é **tenant próprio** (tem `hub_contas_*` isoladas) → Bloco 4
  é seguro e real. Exige o arquiteto operar dentro do **seu** tenant, não do Hub.
- **(B)** O arquiteto é **membro do tenant do Hub** → **sem ledger próprio**; Bloco 4 fica
  **estado-vazio** até existir uma **coluna de dono do lançamento** para recortar.
**Recomendação da mesa:** decidir A vs B **antes** de renderizar o Bloco 4; e em qualquer caso
**padronizar `.eq('tenant_id')` puro** (remover `tenantScopeOrFilter`) antes de ampliar o
público.

**D2 — CAPABILITY DE ACESSO (segurança multi-tenant).**
Aprovar capability **nova e estreita** (ex. `financeiro:proprio`) para o arquiteto, em vez de
`financeiro:ler` genérico ou de promovê-lo a nível financeiro/gestor. **Correção de justificativa:**
o risco real **não** é a capability abrir as 40 rotas (elas gateiam por `crmNivel`), é a rota
nova **não** ter guard próprio. O recorte tem de ser **na capability + no DADO** (tenant +
vínculo por projeto/obra), **não** só na nav (senão IDOR de rota por URL direta).

**D3 — ESCROW/HONORÁRIO: POR PROJETO vs POR OBRA (alto impacto p/ o arquiteto).**
O dinheiro só existe hoje na **obra** (`hub_obra_*`); o arquiteto trabalha em `hub_projetos`.
- **(A)** Reusar 100% — o projeto só mostra financeiro quando gerar obra (zero schema, mais
  rápido). **Não cobre honorário de projeto (pré-obra)** — que é a **receita nº1** do arquiteto.
- **(B)** Criar `hub_projeto_pagamentos` espelhando o E6 **só para honorários de arquitetura**
  antes de haver obra.
**Recomendação:** (A) agora para o MVP, **mas B não é rodapé** — é core do arquiteto; tratar
como decisão de produto de alto impacto, com data.

**D4 — MODELO HUB↔PARCEIRO (monetização).**
Assinatura SaaS + comissionamento/split **não** existem em código; só Tijolos toca dinheiro
Hub↔escritório (medição). O "Geral Hub↔Parceiro" depende de travar as **2 cobranças** (SaaS +
transacional). Até definir, o bloco **não aparece** (não é painel de "em breve", não inventar
números).

**D5 — LADO ENTRADA DO ESCROW (cliente paga → depósito).**
Não existe RPC de depósito (só `rpc_liberar_escrow`), e há o bug do `GREATEST` (custódia
fantasma). Decidir **quem confirma o recebimento** (o Hub como juiz, manual no MVP? gateway/Pix
na Fase 2?) antes de "Pagamentos de Clientes" ter dado real. **Decisão de produto, não só de
tela.**

**D6 — GUARD DE TIJOLOS.**
`/api/crm/ia/creditos` é `requireCrmGestor` → arquiteto = 403 hoje. Ajustar para o arquiteto ler
Tijolos **via capability** (rota nova ou guard por `financeiro:proprio`), **sem** baixar o
acesso para comercial/atendente. `custo_brl` **continua** fora do browser.

**D7 — JANELA PARA MIGRAÇÃO E6 + FIXES.**
Aplicar em produção (janela do dono — classificador barra apply automático): migração
`20260730120000_e6_financeiro_contrato_escrow.sql` + **fix #5 do `GREATEST`** em
`rpc_liberar_escrow` + **rotação das chaves Supabase (`service_role`)**. Até aplicar, todo card
de custódia/liberado/disparidade nasce em **estado-vazio honesto** — é o estado **normal**, não
exceção.

**D8 — CRON DE KPI (infra; habilita tendência — não bloqueia a TV).**
Autorizar mover o tick de `/api/crm/kpis/calcular` de `vercel.json` para o cron **real** do
Render (`render.yaml`) + **loop por todos os tenants** (hoje single-tenant). Não bloqueia a TV
(que usa contagem ao vivo), mas sem isso qualquer **série histórica/meta/tendência** continua
parede de zeros.

**D9 — RECONCILIAÇÃO DA COR DE CUSTÓDIA (fechar a flag).**
`lib/obras/financeiro.ts` pinta `em_custodia` de **violeta** (`#8B5CF6`, escudo); o sistema
visual quer **dourado = dinheiro**. **Recomendação fechada da mesa:** manter o **chip de STATUS**
violeta-escudo (já em prod, sinaliza "protegido/cofre") **mas** usar **dourado no VALOR
monetário** em custódia nos cards e no stepper — o violeta vira "estado protegido", o dourado
vira "quanto dinheiro". Assim **não** existem dois significados de custódia disputando a mesma
cor. (Se o dono preferir, unificar tudo em dourado — decisão dele.)

**D10 — DISPARIDADE DE ORÇAMENTO (fechar o placeholder "—").**
Hoje o card é `"—" / "chega em breve"`. **Não** prometer como se funcionasse. Quando o E6
estiver migrado, ligar na view `vw_hub_obra_compatibilizacao` filtrada pelo projeto, usando o
semáforo 🟢🟡🔴 de `classificarCobertura` — **nunca dourado** (dourado é dinheiro; disparidade é
RISCO).

---

*Fim do documento. Aprovação do dono destrava a Onda 0 → Onda 1 (financeiro real primeiro).*
