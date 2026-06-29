# E1 (cockpit HOJE + carteira) — Design + Auditoria (mesa redonda)

Agora tenho o terreno real completo. Achados decisivos que mudam o design das lentes:

1. **`hub_obras_cronograma` JÁ EXISTE** (não é E2) com colunas reais: `fase` (não "descricao"), `percentual`, `data_prevista`, `concluida` (boolean), `tenant_id`. As lentes 3/4 erraram os nomes de coluna (`descricao` → é `fase`; status finalizado → é `concluida`).
2. **`hub_obras.data_previsao_fim` existe** (E0 só adicionou `data_inicio` no SELECT, mas `data_previsao_fim` está no schema base). É a fonte real de "término contratual".
3. **Não existe** `hub_obra_restricoes`, `hub_pagamentos`/`hub_financeiro` estruturado → bloqueios e pagamentos degradam (proxy: `hub_pedidos_material` + `hub_obras_ocorrencias` severidade crítico).
4. **`hub_pedidos_material` NÃO tem `tenant_id`-filtro-só**: tem, e tem `valor_estimado`, `status`. **Não tem hard FK de fornecedor** — "fornecedor" no card é texto livre.
5. RLS de `anon` usa `default_obra10_tenant_id()`; `crmDb()` é service-role. A escrita "marcar concluído" mira `hub_obras_cronograma.concluida` (existe).

Tenho tudo para o design final fiel ao código real.

## Design final de E1 — o Cockpit de Obras

E1 = **2 superfícies novas + 1 promoção**, disjuntas de E0/A0. `/crm/obras` deixa de ser lista chã e vira **Carteira por urgência**; nova aba/rota **Hoje** é a fila de decisões que vira copiloto. Não toca `/crm/obras/[id]`, EAP, projetos.

**Correção de fundo às 4 lentes (chão real):** as fontes de prazo NÃO dependem de E2. Já existem hoje: `hub_obras_cronograma` (`fase`, `percentual`, `data_prevista`, `concluida`) + `hub_obras.data_previsao_fim`. Portanto o "Hoje" **nasce com atrasados/próximos reais** desde já — não roda só "magro". O que falta de verdade: avanço ponderado por frente (E0 frentes existem mas sem % executado por frente — `percentual` está no cronograma, não na frente) e financeiro estruturado (degrada). Bloqueios = proxy via `hub_obras_ocorrencias` severidade=`critico` (aberta) + `hub_pedidos_material` status `rascunho/cotando`.

### /crm/obras (carteira) + ASCII

- **Rota única `/crm/obras`** com seg-control **[Hoje] [Carteira]**, estado em `?aba=hoje|carteira` (reusa `useSearchParams`, já importado). Default: **Carteira** (decisão conservadora; "abrir no Hoje se houver atraso" fica como flag do dono — ver fim).
- Header sticky: H1 "Obras" + subtítulo dinâmico "{n} obras · {x} pedem atenção". CTAs: **[Hoje ▸]** (dourado) e **[+ Nova obra]** (reusa `NovaObraSideover`, já montado).
- **Chips de filtro** (reusa exatamente o visual dos chips de tipo já em `page.tsx` linhas 105-124): `[Todas] [⚠ Atenção] [🔴 Crítica] [Ativas] [Planejamento]`. Mantém o chip de **tipo_obra** existente como segundo grupo (não jogar fora o que já funciona).
- **Ordenação por urgência derivada** (não alfabética): crítica → atrasada → atenção → ok → planejamento → pausada → encerrada. Buckets `pausada/encerrada` recolhidos no fim.
- Grid reusa `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3` já no arquivo.

**Card de obra** (enriquece o card-link verde existente; mantém borda `#1d3a2c`, bg `#0f1d16`):
- Borda-esquerda **3px = cor de saúde** (vem do `status` macro + derivação por atraso).
- Selo + título + chip `tipo_obra` (reusa `TIPO_META`/ícone já no arquivo) + código mono `#8b949e`.
- **Barra de avanço**: usa **média de `percentual` das fases do cronograma da obra** (real, existe). Sem cronograma → trilho fantasma "Sem cronograma ainda" + micro-CTA "Definir EAP/datas" (abre `EapEditorSideover`, já montado).
- **Próximo marco**: `MIN(data_prevista)` futura entre fases `concluida=false`. ≤2d vermelho, ≤7d âmbar.
- **Pills de alerta** (só se >0, tocáveis → Hoje filtrado por obra via deep-link): `[🔴 N atrasados]` (fases vencidas não concluídas) `[⛔ N ocorrências críticas]` `[📦 N pedidos abertos]`. Pill `💳` só aparece quando financeiro existir.

```
┌─ Obras                         [Hoje ▸][+] ─┐  ← sticky
│ 7 obras · 3 pedem atenção                   │
│ [Todas][⚠4][🔴2][Ativas]  · [Reforma][Constr]│
├─────────────────────────────────────────────┤
┃🔴│ ● Reforma Consulado Itália      [🔨 Reforma]│ ← 3px vermelho
│  │ REF-2026-0004 · São Paulo/SP              │
│  │ ▓▓▓▓▓▓░░░░░░ 47%  (média fases)           │
│  │ ⚑ Próx.: Concretagem · vence em 2d 🔴     │
│  │ [🔴 2 atrasados][⛔ 1 ocorrência][📦 1]    │ ← tocáveis
├─────────────────────────────────────────────┤
┃🟡│ ● Retrofit Hall 9               [🔨 Reforma]│
│  │ ▓▓▓▓▓▓▓▓▓▓░░ 72% · ⚑ Pintura · em 6d 🟡   │
├─────────────────────────────────────────────┤
┃🟢│ ● Casa Alto Pinheiros        [🏗 Construção]│
│  │ ▓▓▓▓░░░░░░ 31% · ⚑ Fundação · em 18d       │
│  ▸ 2 encerradas                              │
└─────────────────────────────────────────────┘
```

### Painel HOJE (fila de decisões) + ASCII

Princípio do dono: "100% automática, não digite nela". Leitura + ação; cada linha = 1 fato + 1 toque.

- Header: "Hoje · {data}" + **4 contadores grandes** (atalho que rola): `[🔴 Atrasados N] [📅 Próx.15d N] [⛔ Bloqueios N] [💳 A vencer R$X]`. Cor = urgência. Chip "Todas as obras ▾" (travado+removível se veio de deep-link).
- **Banner copiloto** dourado sutil: "✨ A IA preparou {N} recomendações" + [Ver ▸] → abre `CopilotoVoz`. Some se chave Mistral ausente.
- **4 seções por gravidade**, vazias colapsam em linha verde "✓ nada aqui":
  - **§1 ATRASADOS** — `hub_obras_cronograma` `data_prevista < hoje AND concluida=false`, ordenado por `data_prevista`. Item: fase · obra · "venceu há Nd" + `[Reprogramar]` `[✓ Concluído]` `[Abrir]`. As duas primeiras = **ação de prazo crítica → passam pelo gate** de confirmação dourado (reusa o padrão `acaoPendente` do CopilotoVoz). `[✓ Concluído]` escreve `concluida=true` (única escrita direta de baixo risco, com otimismo de UI).
  - **§2 PRÓXIMOS 15 DIAS** — `data_prevista` em (hoje, +15d], não concluída, agrupado por "vence em Nd". Top-5 + "ver tudo". Ação: `[Avisar responsável]` (sem gate, baixo risco).
  - **§3 BLOQUEIOS** — proxy real hoje: `hub_obras_ocorrencias` severidade=`critico` ainda abertas + (opcional) pedidos `rascunho`. Item: "⛔ Ocorrência crítica: {descricao} · {obra}" + `[Gerar pedido]`/`[Resolver]`. Mostra impacto. Quando E2 trouxer restrições tipadas (falta material/pessoa/doc), a seção troca o proxy pelo dado fino, sem mudar a UI.
  - **§4 PAGAMENTOS A VENCER** — degradado hoje: financeiro estruturado não existe → seção mostra "Financeiro chega em breve" (cinza, informativo, NÃO erro). `flags.temFinanceiro=false`. Nunca paga direto (regra de ouro).
- **Rodapé "tudo em dia"**: quando tudo zera → ✓ verde "Nada pede decisão agora" + sugestão proativa da IA. Anti-tela-morta.

```
┌─ Hoje · seg, 29 jun       [Todas obras ▾] ─┐
│  3        4         1         —            │  ← contadores 28px
│ 🔴Atras  📅15d    ⛔Bloq    💳(em breve)   │
│ ✨ A IA preparou 3 recomendações  [Ver ▸]  │
├── ATRASADOS · 3 ──────────────────────────┤
│┃ ● Concretagem laje · Itália · venceu há 2d││
│┃   [Reprogramar*][✓ Concluído*][Abrir]    ││  *=gate dourado
├── PRÓXIMOS 15 DIAS · 4 ───────────────────┤
│  vence em 3d  ● Pintura forro · [Avisar]   │
├── BLOQUEIOS · 1 ──────────────────────────┤
│┃ ⛔ Ocorrência crítica: falta cimento      ││
│┃    Itália · [Gerar pedido][Resolver]      ││
├── PAGAMENTOS · financeiro chega em breve ─┤  ← cinza, não erro
└────────────────────────────────────────────┘
DESKTOP: 2 col — esq [Atrasados+Bloqueios], dir [Próx.15d+Pagamentos].
```

### O 'Hoje' como copiloto (IA)

A ponte é **aditiva e degradável** — sem chave Mistral o Hoje funciona 100% (lista calculada + ações manuais).
- O endpoint devolve um bloco `resumo_ia` (ids críticos, contagens). O frontend injeta isso como contexto no `CopilotoVoz` já global (FAB montado no layout — **não duplicar**). Reusa o evento `copiloto:abrir` já existente.
- A IA faz 3 coisas: **(1) resume** a fila no banner/topo; **(2) recomenda** por item ("reprogramar +5d; material chega 2/jul"); **(3) age com gate**. Só executa sozinha o baixo risco (ordenar fila, rascunhar pedido). Prazo/dinheiro/marcar-concluído → **sempre [Confirmar] humano** (mesmo `acaoPendente` dourado do CopilotoVoz, linhas ~645-811).
- Tool de leitura `obra_hoje` (lê a MESMA agregação) e, mais tarde, escrita `obra_criar_pedido` com gate — seguem o padrão de tools existente (`hub_atualizar_lead`). **Recomendo entregar E1 com a tool de LEITURA + injeção de contexto**; a tool de escrita pode vir num passo seguinte (não bloqueia o cockpit).

### Dados/endpoint de agregação (reuso, tolerante)

**NOVO `lib/crm/cockpit-aggregate.ts`** (gêmeo de `dashboard-aggregate.ts`, mesmo `Promise.all` + `safeCount` + `tenantScopeOrFilter` + `inicioDiaUtcISO`). **NOVO `GET /api/crm/obras/cockpit`** + variante leve `?view=hoje`. Auth: `requireCrmSessao` + `g.ctx.tenantId` (nunca header). Padrão de tolerância: `isMissingPgColumn` + `/relation.*does not exist/i` (como em `obras/route.ts`).

Queries reais (todas com `.eq("tenant_id", tenantId)` quando a tabela tem a coluna; `hub_obras_cronograma` e `hub_pedidos_material` têm `tenant_id`):
- **A** `hub_obras` base (status ≠ cancelada).
- **B** `hub_obras_cronograma` por `obra_id IN (...)`: deriva avanço (média `percentual`), próximo marco (`MIN(data_prevista)` futura `concluida=false`), atrasados (`data_prevista<hoje, concluida=false`), próximos-15d.
- **C** `hub_pedidos_material` count aberto por obra (já contado no dashboard — reusar lógica).
- **D** `hub_obras_ocorrencias` severidade=`critico` por obra (proxy de bloqueio).
- **E** `hub_aprovacoes` pendentes (reusa `safeCount` literal do dashboard).
- **F (futuro)** financeiro → `flags.temFinanceiro=false` por ora.

Payload: `{ carteira:[ObraCard], contadores, hoje:{atrasados,proximos15,bloqueios,pagamentos}, resumo_ia, flags:{temCronograma,temFinanceiro,temEap} }`. Cada bloco **independente e degradável**: faltante = `[]`/`0`, nunca derruba os outros. Cache `private, max-age=30`.

**Correções obrigatórias vs. as lentes** (nomes reais): coluna é **`fase`** (não `descricao`); concluído é **`concluida=true`** (não string "Finalizado"); término contratual é **`hub_obras.data_previsao_fim`**; status macro legado pode ser `em_andamento` (pré-E0) — o agregador deve mapear `em_andamento→ativa`/`concluida→encerrada` em leitura (a migração só converte no banco quando aplicada).

### Edge cases

- **Obra sem cronograma** (caso comum hoje): card com barra-fantasma "Sem cronograma ainda" + CTA EAP/datas; **não** entra em atrasados/15d; nunca barra 0% que parece "parada".
- **Obra sem EAP**: idem; micro-CTA "Definir EAP" → `EapEditorSideover`.
- **Zero atrasos**: Hoje vira estado de calma (✓ verde + sugestão IA), seções colapsam mas não somem (gestor confia que checou).
- **Muitas obras (50+)**: carteira pagina/colapsa por bucket (críticas no topo sempre); Hoje agrega cross-obra → cresce com pendências, não com nº de obras (top-5 + "ver tudo").
- **Financeiro ausente**: §4 e pill 💳 → "chega em breve" cinza, nunca erro/spinner.
- **Status legado `em_andamento`** (base não migrou E0): mapeado para "ativa" na leitura; não quebra o selo.
- **Mobile ≤360px**: contadores 2×2; ações inline viram `⋯`; pills truncam com "+N".
- **Ação crítica por engano**: Reprogramar/Concluído **sempre** passam pelo gate dourado.
- **Permissão (papel campo)**: §4 Pagamentos oculta por papel (não só desabilita); a IA não recomenda o que o papel não pode.
- **Deep-link sem pendência** (corrida de dados): Hoje abre na obra com "sem pendências agora" + botão remover filtro.

### Reuso x novo

**Reusa (a coluna):** `dashboard-aggregate` (padrão `Promise.all`/`safeCount`/`tenantScopeOrFilter`/`inicioDiaUtcISO`); `app/crm/obras/page.tsx` (shell, grid, chips, `TIPO_META`, tokens, `NovaObraSideover`, `EapEditorSideover`, `EmptyState`); `hub_obras`+`hub_obras_cronograma`+`hub_pedidos_material`+`hub_obras_ocorrencias` (existem hoje); `requireCrmSessao`/`g.ctx.tenantId`/`crmDb`/`crmConfigError`/`isMissingPgColumn`; `CopilotoVoz` global + evento `copiloto:abrir` + gate `acaoPendente`; cores de status do seed de pipeline (linhas 159-166 da E0 — paleta oficial, não inventar).

**Novo (disjunto):** `lib/crm/cockpit-aggregate.ts`; `app/api/crm/obras/cockpit/route.ts`; o seg-control Hoje/Carteira + os componentes de card/seção/item dentro de `/crm/obras`. Não reescreve `obras/[id]`, EAP, projetos, negocios.

---

## AUDITORIA das decisões

**Riscos altos (corrigir antes de codar):**
1. **Nomes de coluna errados nas lentes 3 e 4** (`descricao`/`hub_obra_restricoes`/`hub_pagamentos`/string "Finalizado"). O schema real é `hub_obras_cronograma(fase, percentual, data_prevista, concluida)`. Se implementado como as lentes escreveram, **o `isMissingPgColumn` mascara o bug** e o Hoje nasce vazio sem ninguém perceber. **Validar com SELECT real** antes de confiar.
2. **"avanço físico ponderado por frente" não existe ainda**: as frentes E0 têm `peso_fisico` mas **não têm % executado**. O % real disponível é `hub_obras_cronograma.percentual` por fase. Decisão: **usar média de `percentual` das fases** como avanço em E1 (honesto), e migrar para ponderado-por-frente quando E2 ligar execução por frente. Não prometer "% ponderado por peso" na UI hoje.
3. **`hub_obras_ocorrencias` não tem flag "resolvida"** no schema (só `severidade`+`descricao`). "Bloqueios abertos" não tem como ser filtrado por resolução ainda → mostrar as `critico` recentes como proxy e rotular claramente "ocorrência" (não "bloqueio tipado"). Não inventar resolução.
4. **RLS**: `crmDb()` é service-role e bypassa RLS — o isolamento depende 100% do `.eq("tenant_id", g.ctx.tenantId)` no código. `hub_obras_ocorrencias`/`_cronograma` têm `tenant_id` mas filtrar **também** por ele (não só por `obra_id IN`) é mandatório — senão repete o vazamento cross-tenant que a auditoria de 28/jun corrigiu no dashboard.

**Tolerância a dados parciais: OK, com 1 ressalva.** O degradar-por-bloco é o padrão certo e já tem precedente. A ressalva: **não degradar silenciosamente o que existe** (cronograma existe → Hoje deve mostrar atrasos reais; se vier vazio, é bug, não "E2 ausente"). Adicionar `flags.temCronograma` derivado de "alguma obra tem linha de cronograma", para distinguir "tudo em dia" de "fonte ausente".

**O que validar (clicando/SQL):** SELECT real em `hub_obras_cronograma` num tenant com dados; render desktop+mobile do cockpit; deep-link pill→Hoje; gate dourado dispara em Reprogramar/Concluído; comportamento com 0 cronograma e com financeiro ausente.

## Critério de PRONTO

- `/crm/obras` abre em **Carteira por urgência** (cards com selo+barra+próximo marco+pills), `?aba` persiste, seg-control Hoje/Carteira funciona, mobile 1 coluna sem scroll-x.
- **Hoje** lista **atrasados e próximos-15d REAIS** de `hub_obras_cronograma`; bloqueios via proxy de ocorrência crítica; pagamentos em "chega em breve" sem erro; estado de calma quando zera.
- Endpoint `cockpit` filtra por `tenant_id` em TODA query, degrada por bloco, `tsc` + `vitest` + `_chk23` verdes.
- Ações de prazo passam pelo **gate dourado**; "✓ Concluído" grava `concluida=true` e some o item (otimista).
- Banner/recomendações IA aparecem só com chave; sem chave, Hoje 100% funcional.
- Verificado no navegador (screenshot desktop+mobile) — sem botão quebrado.

## O que precisa da janela do dono

1. **Migração E0** (`20260705130000`) ainda **não aplicada** — sem ela, `tipo_obra`/`codigo_legivel`/frentes ficam no fallback legado e o status macro fica `em_andamento`/`concluida`. O cockpit **funciona** no fallback (mapeia em leitura), mas os 6 status-cor só ficam fiéis após aplicar. Aplicar é decisão do dono (banco em prod).
2. **Flag de comportamento**: "abrir `/crm/obras` direto no **Hoje** quando houver atrasos" (vs. sempre Carteira) — decisão de produto do dono.
3. **Tool de ESCRITA do copiloto** (`obra_criar_pedido`/reprogramar via IA) e **chave Mistral em prod** — habilitam a camada "age com gate". E1 entrega sem elas (leitura + ação manual); ligar é passo seguinte.
4. **Financeiro estruturado** (pagamentos a vencer) — não existe tabela; §4 fica em "chega em breve" até o dono priorizar o módulo financeiro.

Arquivos reais lidos: `lib/crm/dashboard-aggregate.ts`, `app/crm/obras/page.tsx`, `app/api/crm/obras/route.ts`, `app/api/crm/obras/[id]/route.ts`, `supabase/migrations/20260705130000_e0_obra_eap_catalogo.sql`, `supabase/migrations/20260523120000_crm_integral_core.sql`. Nada foi editado — E1 permanece só desenho.