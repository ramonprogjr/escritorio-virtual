# Auditoria E2E — DOMÍNIO I (Relatórios / Analytics / KPIs)

> READ-ONLY. Régua: o melhor para o sistema — crítico, seguro, certeza, sem inventar.
> Data: 2026-06-30. Último domínio do finale.

## Escopo auditado (arquivos reais lidos)
Telas:
- `app/crm/analytics/page.tsx` → componente `components/crm/CrmAnalyticsDashboard.tsx`
- `app/crm/kpis/page.tsx` (apenas `redirect("/crm/analytics")` — legado)
- `app/crm/relatorios/page.tsx`

Endpoints:
- `app/api/crm/analytics/route.ts`
- `app/api/crm/kpis/calcular/route.ts`
- `app/api/crm/relatorios/complementos/route.ts`
- `app/api/crm/relatorios/export/route.ts`

Suporte:
- `lib/crm/analytics-aggregate.ts` (motor das métricas)
- `lib/crm/relatorios-data.ts` (carregamento + truncamento)
- `lib/tenant-default.ts`, `lib/crm/crm-api-auth.ts`, `lib/crm/crm-permissoes.ts`
- `components/crm/FunilOperacionalChart.tsx`, `components/crm/CrmLeadsEntradaPeriodo.tsx`
- `app/crm/layout.tsx` (enforcement de rota)

Fatos de schema confirmados nas migrações:
- `hub_aprovacoes` TEM `tenant_id` (crm_integral_core.sql:150)
- `hub_kpis_resultados` TEM `tenant_id` (crm_integral_core.sql:187)
- `hub_encaminhamentos` TEM `tenant_id` (obra10_runtime_essencial.sql:178)
- `hub_parceiros` TEM `tenant_id` (bloco-e-step2-tenant)
- `hub_alertas` NÃO tem `tenant_id` (obra10_runtime_essencial.sql:193-201)
- `hub_ml_observacoes` NÃO tem `tenant_id` (hub_migration_v4.sql:69)
- `hub_kpis_definicao` NÃO tem `tenant_id` (catálogo global, ok)

---

## 🔴 BLOQUEADORES (segurança — vazamento cross-tenant de NÚMEROS)

O motor de analytics (`aggregateAnalytics`) recebe `tenantId` e filtra a MAIORIA das tabelas
por `.eq("tenant_id", tenantId)` — mas DEIXOU DE FORA quatro agregações cujas tabelas TÊM
coluna `tenant_id`. Como `crmDb()` usa **service-role** (contorna RLS), a falta do filtro na
query soma/conta dados de TODOS os escritórios. Régua do projeto (memória
`tenant-null-leak-pattern`): leitura com service-role exige `.eq('tenant_id')` explícito.

### 🔴 B1 — `hub_aprovacoes` sem filtro de tenant (Aprovações pendentes)
`lib/crm/analytics-aggregate.ts:229-231`
```js
safeCount(
  supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente")
),
```
Conta aprovações pendentes de TODOS os tenants. Vaza no card "Aprovações pendentes"
(`CrmAnalyticsDashboard.tsx:449-452`) e no KPI `aprovacoes_pendentes`. `hub_aprovacoes` tem
`tenant_id` (migração:150), então o filtro é viável.
Ajuste: adicionar `.eq("tenant_id", tenantId)`.

### 🔴 B2 — `hub_kpis_resultados` (kpisCriticos) sem filtro de tenant
`lib/crm/analytics-aggregate.ts:267-273`
```js
safeCount(
  supabase.from("hub_kpis_resultados").select("id",{count:"exact",head:true})
    .neq("nivel_alerta","ok").gte("criado_em", since)
),
```
Conta KPIs críticos de todos os tenants → card "KPIs críticos" (`CrmAnalyticsDashboard.tsx:493-497`).
Tabela tem `tenant_id` (migração:187). Ajuste: `.eq("tenant_id", tenantId)`.

### 🔴 B3 — `hub_kpis_resultados` (histórico + cards de KPI) sem filtro de tenant
`lib/crm/analytics-aggregate.ts:194-199` (`resultadosRes`)
```js
supabase.from("hub_kpis_resultados")
  .select("kpi_slug, valor_medido, valor_meta, nivel_alerta, criado_em, agente_slug")
  .gte("criado_em", since).order("criado_em",{ascending:false}).limit(200),
```
Este `resultadosRes` alimenta DOIS lugares cross-tenant:
1. `latestBySlug` (linhas 326-343) → os **cards de KPI** podem exibir o `valor_medido`/`nivel_alerta`
   gravado por OUTRO tenant (o `.limit(200)` global pode trazer linhas de outro escritório primeiro).
2. `ultimosResultados` (linhas 474-479) → a **tabela "Histórico de medições"**
   (`CrmAnalyticsDashboard.tsx:541-567`) lista medições de qualquer tenant.
Ajuste: `.eq("tenant_id", tenantId)` no select. (Cuidado: linhas legadas podem ter `tenant_id` NULL —
ver nota de consistência abaixo; alinhar com a decisão do dono.)

### 🔴 B4 — `hub_encaminhamentos` sem filtro de tenant (Parceiros)
`lib/crm/analytics-aggregate.ts:249-252`
```js
supabase.from("hub_encaminhamentos").select("lead_id").gte("encaminhado_em", since),
```
`encPeriodo`/`taxaEncaminhamento` somam encaminhamentos de todos os tenants → cards "Encaminhamentos"
e "Taxa encaminhamento" (`CrmAnalyticsDashboard.tsx:459-465`) e o resumo de Relatórios.
Tabela tem `tenant_id` (migração:178). Ajuste: `.eq("tenant_id", tenantId)`.

### 🔴 B5 — `hub_aprovacoes` sem filtro de tenant no endpoint de KPIs
`app/api/crm/kpis/calcular/route.ts:40`
```js
supabase.from("hub_aprovacoes").select("id",{count:"exact",head:true}).eq("status","pendente"),
```
Aqui o `tenantId` JÁ existe (linha 27) e é usado nas outras 5 queries, mas o count de aprovações
GRAVA na medição `aprovacoes_pendentes` (linha 60) um número global → contamina o KPI persistido
de TODOS os tenants. Ajuste: `.eq("tenant_id", tenantId)`.

> Observação técnica de impacto: o ambiente hoje opera quase sempre com 1 tenant (Obra10 default),
> então o vazamento é latente — mas torna-se EXPLORÁVEL no momento em que entrar o 2º escritório
> (que é exatamente a visão multi-tenant do produto). Por isso classifico como bloqueador para o
> go-live multi-tenant, não para o piloto single-tenant.

---

## 🟡 DECISÕES DO DONO

### 🟡 D1 — Tabelas SEM `tenant_id` vazam por design (alertas + ML + ciclos)
- `hub_alertas` (sem `tenant_id`): `analytics-aggregate.ts:277-284` lista os 5 alertas não lidos
  de QUALQUER tenant → seção "Alertas" (`CrmAnalyticsDashboard.tsx:524-538`).
- `hub_ml_observacoes` (sem `tenant_id`): `analytics-aggregate.ts:285-291` → "Observações ML".
- `hub_ciclos_ia`: `analytics-aggregate.ts:292` (`ciclosComFalha`) sem filtro de tenant.
Não é bug de query — é o schema que não tem a coluna. Decisão do dono: (a) adicionar `tenant_id`
a essas tabelas em migração aditiva + backfill, ou (b) aceitar que alertas/ML/ciclos são "globais
do Hub" e NÃO mostrá-los como se fossem do escritório. Recomendo (a) para alertas (são acionáveis e
específicos) e tratar ML/ciclos como insight agregado do Hub (rotular como tal na tela).

### 🟡 D2 — `hub_parceiros`/homologados conta global (parece intencional, confirmar)
`analytics-aggregate.ts:246-248`: `hub_parceiros ... .eq("status","homologado")` SEM tenant.
A tabela TEM `tenant_id`, mas parceiros homologados são a "rede" compartilhada do Hub — pode ser
proposital (todo escritório vê a rede inteira). Confirmar com o dono se "Homologados"
(`CrmAnalyticsDashboard.tsx:458`) deve ser por tenant ou da rede toda. Se for da rede, deixar comentário
explicando (hoje parece omissão, não decisão).

### 🟡 D3 — RBAC da página é só client-side; endpoint analytics aceita `atendente`
- `app/crm/layout.tsx:183-188`: o guard de rota é client-side (`crmPodeVerRota` + `router.replace`).
  `crm-permissoes.ts:186-187` exige `min:"financeiro"` para `/crm/analytics` e `/crm/relatorios`.
  Não há guard server-side da PÁGINA (mas os DADOS vêm de API guardada, então não é vazamento).
- Mismatch: o endpoint `GET /api/crm/analytics` usa `requireCrmSessao` (= `atendente`+,
  `crm-api-auth.ts:208-216`), enquanto a tela pede `financeiro`+. Um `atendente` é redirecionado da
  UI, mas pode chamar `/api/crm/analytics` direto e ver os números. Decisão: elevar o guard do
  endpoint para `requireCrmFinanceiro` (alinhar com a régua da rota) ou aceitar que analytics é
  visível a qualquer sessão. (O `export` financeiro JÁ está correto — usa `requireCrmFinanceiro`.)

### 🟡 D4 — `complementos` usa `tenantScopeOrFilter` (inclui `tenant_id IS NULL`), divergente do resto
`app/api/crm/relatorios/complementos/route.ts:28,34` usa `.or(tenantScopeOrFilter(tenantId))`, que
por design (`tenant-default.ts:51-58`) inclui `tenant_id.is.null` e o tenant Obra10 default. Já os
endpoints `export` e `analytics` usam `.eq("tenant_id")` estrito (NÃO trazem NULL). Resultado: o
mesmo dado pode ser contado em telas diferentes com critérios diferentes (decisões pendentes via
`complementos` inclui registros legados NULL; o resto não). Decisão do dono: padronizar o tratamento
de linhas legadas com `tenant_id NULL` (backfill + `.eq` em todo lado, conforme a memória
`tenant-null-leak-pattern` recomenda) OU documentar por que `complementos` é mais permissivo.

---

## 🟢 AJUSTES AUTÔNOMOS (baixo risco, melhoram sem decisão de negócio)

### 🟢 A1 — "Números não batem" entre cards (live vs. snapshot gravado)
Em `analytics-aggregate.ts:351-366`, cada card de KPI prefere o valor GRAVADO (`stored`, de
`hub_kpis_resultados`) e só cai no `liveValues` se não houver registro. Resultado prático: o card
"Aprovações pendentes" do bloco KPI pode mostrar o valor da última gravação (ex.: 3), enquanto o card
MetricMini "Aprovações pendentes" (`CrmAnalyticsDashboard.tsx:449`, que usa `metricas.aprovacoesPendentes`
= valor LIVE) mostra outro (ex.: 5). Para o gestor, dois números diferentes com o mesmo rótulo na
mesma tela = perda de confiança. Ajuste: ou rotular claramente ("medido em <data>" vs. "agora"), ou
unificar a fonte. Hoje a tela não avisa a diferença.

### 🟢 A2 — Mensagem de sucesso pode mentir a contagem
`CrmAnalyticsDashboard.tsx:242` exibe `"KPIs atualizados (${j.inseridos ?? 6} medições gravadas)"`.
O fallback `?? 6` é cosmético, mas se a API algum dia inserir menos linhas, o texto fixo "6" engana.
Hoje sempre são 6 (`calcular/route.ts:55-73`), então é baixo risco — mas o fallback deveria ser
honesto (ex.: omitir o número se ausente).

### 🟢 A3 — Acessibilidade: gráfico de funil sem alternativa textual / ARIA
`components/crm/FunilOperacionalChart.tsx` desenha barras com `<div>` puro, sem `role="img"`,
sem `aria-label` por barra e sem `<table>` alternativa. O número fica visível ao lado (bom), mas
leitor de tela não anuncia o conjunto como gráfico. Compare com `CrmLeadsEntradaPeriodo.tsx:84-86`
que JÁ usa `role="img"` + `aria-label`. Ajuste: adicionar `role="img"` + `aria-label` resumo ao
container do FunilOperacionalChart.

### 🟢 A4 — Contraste de rótulos abaixo de WCAG AA em texto pequeno
Rótulos usam `#6e7681`/`#484f58`/`#5f8470` sobre fundo `#0f1d16`/`#0a140f` em fontes 8-10px
(ex.: `CrmAnalyticsDashboard.tsx:114` `text-[#484f58]` 10px; `CrmLeadsEntradaPeriodo.tsx:105`
`text-[#484f58]` 8px). `#484f58` sobre `#0f1d16` fica ~2.6:1 — abaixo de 4.5:1 (AA). No celular,
ao sol, esses microtextos somem. Ajuste: subir para `#8b949e`+ em textos <12px informativos.

### 🟢 A5 — Card "Atual" pode estourar/cortar em valores BRL grandes no mobile
`CrmAnalyticsDashboard.tsx:63-76`: o KPI `pipeline_aberto` formata BRL (`formatValor` → `moedaPipeline`).
Em 2 colunas no mobile (`md:grid-cols-2`, mas o grid base é `grid-cols-1` então no celular é 1 col, ok)
o "Atual" e "Meta" dividem a linha (`flex justify-between`). Para valores tipo "R$ 1.234.567,89" o
`text-lg` pode encostar na Meta. Não há `truncate`/`min-w-0` no bloco de valor. Risco de sobreposição
visual em telas estreitas. Ajuste: `min-w-0` + `truncate` no valor ou `flex-wrap`.

### 🟢 A6 — Funil de leads é "snapshot operacional", mas Funil de negócios exige clique e não tem default
`CrmAnalyticsDashboard.tsx:408-411`: o painel "Funil de negócios" mostra
"Selecione um mercado…" até o usuário clicar numa aba de pipeline. Bom que avisa (não é gráfico vazio
mudo), mas para "entender num olhar no celular" o ideal seria pré-selecionar o 1º mercado disponível.
Decisão leve de UX — incluído como autônomo porque não muda dado, só seleciona default.

### 🟢 A7 — `kpis/calcular` apaga e reinsere sem transação (janela de leitura vazia)
`calcular/route.ts:76-87`: faz `DELETE` das medições do dia e depois `INSERT`. Entre as duas, uma
leitura concorrente do analytics veria o período sem medições. Baixíssima probabilidade (ação manual,
1 tenant), mas o ideal é upsert ou ordem insert-then-delete-old. Anotado como melhoria.

---

## ✅ O QUE ESTÁ BOM (sem fachada)

- **Export financeiro guardado por role**: `relatorios/export/route.ts:51-54` exige
  `requireCrmFinanceiro` para `financeiro|contas_pagar|contas_receber` e `requireCrmSessao` para o resto.
  Tenant SEMPRE de `g.ctx.tenantId` (não do header forjável). Correto.
- **Relatórios principais filtram tenant**: `relatorios-data.ts:68-76` aplica `.eq("tenant_id", tenantId)`
  em TODAS as entidades (leads/negócios/empresas/imóveis/financeiro), com fallback honesto para base
  legada sem a coluna. Bom.
- **Truncamento honesto**: `relatorios-data.ts:121-134` expõe `totalCount`/`truncado`/`aviso`; a tela
  (`relatorios/page.tsx:148-156`) mostra "X de Y registos — limitado a 500". Não é fachada.
- **Estados de vazio/loading/erro existem** na tela de analytics (`CrmAnalyticsDashboard.tsx:316-357`,
  362-375) e relatórios (`relatorios/page.tsx:187-235`) — com botão "Tentar novamente". Bom.
- **`tenantIdFromRequest` blindado** contra `x-tenant-id` forjável (`tenant-default.ts:70-87`); o
  endpoint `calcular` usa esse caminho (cron/worker), correto para chamador interno.
- **Marca Obra10+ consistente**: dark verde (`#0a140f`/`#0f1d16`/`#1d3a2c`) + dourado (`#c9a24a`).
  Sem azul/roxo Shadcn nos gráficos. As cores das barras vêm do pipeline/etapa (DB), não hardcoded.
- **`kpis/page.tsx`** é redirect limpo para `/crm/analytics` (não é tela morta).

---

## Resumo executivo
- 🔴 5 bloqueadores: TODOS são vazamento cross-tenant de NÚMEROS no motor de analytics + endpoint de
  KPIs (tabelas que TÊM `tenant_id` mas a query omite o filtro; service-role contorna RLS). Latentes
  hoje (1 tenant), exploráveis no go-live multi-tenant. Correção é cirúrgica: adicionar `.eq("tenant_id", tenantId)`.
- 🟡 4 decisões do dono: tabelas sem `tenant_id` (alertas/ML/ciclos); homologados global; RBAC client-only
  + endpoint analytics aceita atendente; divergência `complementos` (inclui NULL) vs. resto (`.eq` estrito).
- 🟢 7 ajustes autônomos: números divergentes mesma tela (live vs. gravado), acessibilidade do funil,
  contraste de microtexto, overflow de valor BRL no mobile, default do funil de negócios, transação no calcular.
- A camada de **Relatórios** (export/tabela) está sólida e segura; o risco concentra-se no **motor de
  Analytics**, onde o filtro de tenant foi aplicado de forma incompleta.
