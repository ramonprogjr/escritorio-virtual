# Estrutura Unificada da Operação — Design Consolidado

> **Status:** design-only. Nenhum código foi escrito nem nenhuma migração aplicada.
> **Data:** 29/06/2026 · **Branch:** `wendel/dev`
> **Base verificada:** E2/E5/E6 no ar, 456 testes verdes (vitest), `tsc` 0 erros.

Este documento une a síntese das 7 lentes com a crítica adversarial e corrige os fatos
divergentes contra o código/SQL real. Onde síntese e crítica discordaram, o veredito está
marcado **[verificado no código]** com o arquivo e a linha.

---

## 0. Correções de fato (a base honesta)

Onde síntese e crítica discordaram, fui ao SQL/código real. Veredito:

| Afirmação da síntese | Fato no código | Veredito |
|---|---|---|
| "A coluna `hub_obra_frentes_eap.tipo_no` NÃO foi criada — é gap puro" | A migração E0b **cria** `tipo_no TEXT NOT NULL DEFAULT 'frente'` + `CHECK IN ('frente','ambiente','disciplina')` — `20260711120000_e0b...sql` L112-118. Falta **aplicar**, não escrever. | **Síntese errou.** Crítica C4 correta. O gap é não-aplicação. |
| "Elevar ambiente exige `ADD COLUMN tipo_no` de verdade" | O DDL já existe; basta aplicar a migração e popular 2 níveis ao instanciar o preset. | Correção incorporada na Fase 3. |
| "`semearItensPorAmbiente` popula a obra vinda do arquiteto" | O orquestrador `gerar-obra/route.ts` L109-118 **não passa `segmento`** ao `criarObraComEAP`. Sem `segmento`, `semearItensPorAmbiente` não roda nesse caminho. | **Síntese otimista.** Crítica C2 correta. A obra nasce oca. |

Fatos que síntese e crítica acertaram (confirmados no SQL):
- `hub_obra_orcamento_itens.item_id` é `UUID ... ON DELETE SET NULL` (E6 L116) — vínculo frouxo.
- `vw_hub_obra_compatibilizacao` filtra `WHERE oi.item_id IS NOT NULL` (E6 L313) — sem `item_id`, a view retorna zero para o gestor.
- Os 4 tools de IA de maior valor não existem no registry.

---

## 1. Visão e a espinha: o "item de escopo"

### A ideia
A operação inteira gira em torno de **um dado-mãe: o item de escopo** (`hub_obra_itens`, E2,
já no ar). Ele é a célula-tronco. Sem ser copiado, projeta sete artefatos:

1. **Memorial** — a descrição do item.
2. **Orçamento/Proposta** — custo × BDI = preço.
3. **Contrato** — o subconjunto contratado (quantidade > 0).
4. **Compra** — a quantidade e a unidade.
5. **Medição** — avanço × peso.
6. **Pagamento/Escrow** — o peso medido.
7. **Curva-S** — o peso financeiro acumulado.

Cada artefato é um `SELECT` projetado do mesmo registro. Ninguém redigita.

### O problema de fundação (a raiz dos dois maiores riscos)
**[verificado no código]** Hoje não existe "um item". Existem **dois registros paralelos**:

- `hub_obra_itens` (E2) — gestão, avanço, datas, quantidade.
- `hub_obra_orcamento_itens` (E6) — custo, preço, versão da proposta.

Ligados por `item_id` **nullable** com `ON DELETE SET NULL` (E6 L116). Daí nascem:
- **(a)** duas fontes de verdade sobre "o que está no escopo";
- **(b)** o gate de disparidade só compara **valor**, nunca existência/quantidade contra o memorial-mestre.

### Modelo de dados — `hub_obra_itens` (a espinha)

**Campos que já existem** (verificado no SQL):
`codigo`, `nome`, `descricao`, `disciplina_slug`, `area_codigo`/`area_label`,
`ambiente` (TEXT solto, de E0b), `taxonomia_id` (FK), `quantidade`, `unidade`,
`valor_contrato`, `pct_avanco`, `andamento`, `peso` (DEFAULT 0),
`parent_id` (auto-árvore item/subitem), `frente_id`, datas, `responsavel`,
`tipo IN ('contrato','aditivo','servico_extra')`, `ativo`.

**Campos novos que E7 adiciona** (todos nullable ou com default que preserva o legado — `ADD COLUMN` puro):

| Coluna | Tipo | Origem na planilha do dono | Regra |
|---|---|---|---|
| `custo_locacao_frete` | NUMERIC | col K (equipamento/frete) | separa o que E6 escondia em `custo_outros` |
| `custo_material` | NUMERIC | col L | nullable |
| `custo_mao_obra` | NUMERIC | col M | nullable |
| `bdi_fator` | NUMERIC override | — | NULL = herda da obra |

E em `hub_obras`: `bdi_fator NUMERIC(6,4) NOT NULL DEFAULT 1.0` (neutro; a empresa que usa 1.06 seta 1 número).

**Duas colunas GENERATED** (transparência auditável = as zonas K-O / E-I da planilha):
```sql
custo_unitario GENERATED ALWAYS AS
  (COALESCE(custo_locacao_frete,0) + COALESCE(custo_material,0) + COALESCE(custo_mao_obra,0)) STORED,
-- ATENÇÃO PG: GENERATED não pode referenciar outra GENERATED STORED na mesma linha.
-- custo_total REPETE a soma inline; NÃO faz custo_unitario * quantidade.
custo_total GENERATED ALWAYS AS
  (ROUND((COALESCE(custo_locacao_frete,0)+COALESCE(custo_material,0)+COALESCE(custo_mao_obra,0)) * quantidade, 2)) STORED
```
O **preço** (`valor_unitario` com BDI, `valor_total`) continua materializado em E6 ou numa view de margem.

### `peso` é DERIVADO, não gravado
`peso_financeiro = valor_total_item / valor_total_obra`, numa view de leitura
(`vw_hub_obra_item_peso`). **Cuidado já mapeado:** somar só itens raiz
(`parent_id IS NULL`) para não contar pai + subitem em dobro. Sem E4 aplicada, degrada para média simples.

### Regra anti-duplicação (decisão estrutural #1)
- O **item-mãe (E2)** é a verdade do escopo **contratado**.
- O **E6** é a verdade da **versão/proposta**.
- Ao aprovar um orçamento (`rpc_aprovar_orcamento_frente`, já existe), os custos da versão aprovada **copiam (snapshot)** para o item-mãe — **no endpoint, nunca em trigger** (triggers escondem magia; é padrão do projeto).
- O `item_id` passa de nullable frouxo a **1:1 forte**: todo `orcamento_item` nasce com `item_id` setado.

---

## 2. Lifecycle operacional (atravessando as camadas)

| # | Estação | Camada | Estado real | Lacuna |
|---|---|---|---|---|
| 1 | **Levantamento** | Arquitetura | `projetos/page.tsx` é stub: só título + código + negócio | Sem upload de memorial/PDF, sem programa de ambientes com área. O "Programa" (`hub_projetos_fases.tipo='comodo'`) é o embrião do nível-1. |
| 2 | **Handoff "Gerar Obra"** | Arq → Eng | Gate server-side (`gerar-obra/route.ts` L36): só gera se projeto `entregue` OU `aprovado`; idempotente por `obra_id` | **[verificado]** A obra nasce **oca**: o orquestrador não passa `segmento`, então `semearItensPorAmbiente` não roda. Memorial e ambientes não viajam. **O fio se rompe aqui.** |
| 3 | **Orçamento** | E6 | `DrawerNovoOrcamento` é digitação solta | Sem busca no catálogo, sem ambiente/disciplina, sem herdar do memorial, sem BDI. **[verificado]** Cria `orcamento_item` **sem `item_id`** → `vw_hub_obra_compatibilizacao` retorna zero. |
| 4 | **Proposta/Contrato** | leitura | `descricao` = memorial; `valor_total` = proposta; `quantidade>0` = anexo | `tipo_contrato` em `hub_obras` decide a exibição, não o schema. Guard de imutabilidade no PATCH. |
| 5 | **Compras** | E5 | O fluxo **mais maduro** e Click-and-Go do sistema | A SC nasce do catálogo **genérico**, não puxa a quantidade do item de escopo. A ponte Orçamento→Requisição está rompida. |
| 6 | **Execução** | E2 | Aba "Itens & Avanço" (default); excelente no mobile (slider, voz, chips) | A seção só **lê/edita**; **não tem `+ Adicionar item`**. O engenheiro não tem onde montar a árvore. |
| 7 | **Medição** | pagamentos | `hub_obra_pagamentos.tipo='medicao'` ligado a `item_id` | **[verificado]** Não existe `hub_obra_medições` append-only. O tablet do operário não grava `qtd_realizada` + foto rastreável. |
| 8 | **Pagamento/Escrow** | E6 | Gate 2 DUPLO; `rpc_liberar_escrow` só com 2 chaves; extrato append-only | Escrow = custódia **contábil** (`provedor='interno'`), não banco real. A UI deve dizer isso. IA nunca libera; voz proibida. |
| 9 | **Cronograma/Curva-S** | E4 | Só desenhado (migração futura) | Pendura no peso do item. `update_cronograma_from_itens` é o ensaio (liga por nome de fase; v2 por UUID). |
| 10 | **Aprovações & Tarefas** | transversal | Cada gate vira card em `hub_aprovacoes`; Central única priorizada pela IA | `hub_tarefas` a criar: todo verbo que gera espera vira tarefa; a IA orquestra a cadeia em silêncio. |

---

## 3. Fluxo entre camadas (quem cria, quem herda, sem duplicar)

### Quem cria
O **arquiteto é a fonte**. Em Projetos (modo leve, `tipo='nao_contratado'`, sem custo/preço),
ele cria o esqueleto `ambiente → disciplina → item` a partir do executivo + memorial.
**Anti-poluição:** o arquiteto não vê as entranhas financeiras da engenharia.

"Gerar Obra" **copia** a árvore de Projetos → Obras sem redigitar (o mesmo fio). Os itens viram contratáveis.

### Quem herda (zero cópia manual)

| Artefato | Herda de |
|---|---|
| Memorial | `item.descricao` + `taxonomia.descricao_padrao` (parágrafo NBR pronto) |
| Orçamento/Proposta | `item.custo` × BDI = preço + subtotais por ambiente |
| Contrato | subconjunto `quantidade > 0` + `tipo_contrato` decide exibição |
| Compra | `item.quantidade` + `unidade` (SC pré-preenchida, não do catálogo genérico) |
| Cronograma | `item.disciplina_slug` + datas + peso |
| Medição | `item` + `pct_avanco` |
| Tarefa | qualquer verbo sobre o item |

### Fluxo de custo × preço (E2 ↔ E6)
O engenheiro **escreve custo no item-mãe (E2)**; o preço sai por fórmula visível (custo × BDI × qtd).
O E6 grava a **versão** enviada ao Gate 1. Ao aprovar, o snapshot de custo volta ao item-mãe.
A `vw_hub_obra_compatibilizacao` ganha de graça a leitura custo × preço quando E7 popular os custos.

### Fluxo de visibilidade por papel (bifurcação na apresentação, não no schema)

| Papel | Vê |
|---|---|
| **Hub** | sempre custo + preço + margem + as 2 chaves (é o auditor) |
| **Executor** | custo + preço da sua obra |
| **Prestador** | só seu escopo (filtro por `frente`/`responsavel`); só preço do que executa; nunca margem |
| **Cliente** (`preco_fechado`) | **[verificado]** o endpoint nem seleciona `valor_unitario` |
| **Arquiteto** | a faixa-dinheiro inteira some |

### Fluxo de disparidade (o coração do pedido do dono)
O orçamento de qualquer atividade/fornecedor bate contra o **item-mestre** derivado do executivo +
memorial do arquiteto. Item que não existe no mestre, quantidade divergente ou preço fora da base =
**flagado no momento de orçar** → card `disparidade_escopo` em `hub_aprovacoes` → o arquiteto valida o
mestre → o resto herda → a decisão ensina o agente. **Hoje a view só compara valor; falta existência/quantidade.**

### Fluxo medição → pagamento → escrow
Medir não libera dinheiro: enfileira no escrow com aprovação dupla
(`pagamento_obra_arq` = físico, `pagamento_obra_hub` = juiz). O mesmo peso/valor do orçamento
aprovado é o que se mede e se paga = zero divergência físico × financeiro.

---

## 4. Facilidade de uso por verbo + IA integrada

### O core é um componente: `<ArvoreEscopo>`
A "planilha viva". Renderiza a mesma fonte (item de escopo) em **3 níveis colapsáveis**:
`AMBIENTE` (seção com subtotal "COZINHA · 14m² · R$ 38.420") → `DISCIPLINA/FRENTE` (cor da EAP) →
`ITEM` (linha densa no desktop, card aninhado no mobile).

Não é `<table>` bruta (regra eterna: tabela = relatório em `/crm/relatorios`).
Props: `lente` (preco|custo|margem|avanco), `persona` (executor|arquiteto|hub|prestador), `somenteLeitura`.
Mora como **aba "Escopo" de 1ª classe** na obra, antes de "Itens & Avanço" (que vira a lente de execução
da mesma árvore). Generaliza o toggle Ambiente/Disciplina/Andar que `ObraItensSecao` já faz.

### Os verbos

- **ACESSAR** (≤ 3 cliques): Obras → [obra] → aba Escopo. Abre na lente "Avanço" (job mais frequente). Mesmo core em 3 endereços: Projetos (leve, sem dinheiro), Obras (completo), Hub (auditoria). A IA pré-abre a lente certa por persona.
- **VER**: header = cockpit de 4 KPIs vivos (Total orçado · Custo · Margem% · Avanço físico). Colapso agressivo por padrão. A IA resume em linguagem natural: "Elétrica puxa o atraso e come 22% da margem".
- **EDITAR** (inline, salva no `onBlur` — sem modal para mudar quantidade): tocar custo abre os 3 campos (locação/material/MO); o preço **recalcula ao vivo com a fórmula exposta** em micro-texto ("R$ 50 × 1.06 × 17 = R$ 901"). O dono é engenheiro: confia no que vê a conta, nunca num total que "aparece pronto". BDI = seletor no header ("BDI 1.06 ▾", default 1) com override por linha.
- **CONSTRUIR** (3 caminhos, empty-state com 3 botões):
  - **(A) IA-first** "✨ Gerar escopo com IA" (dourado): sobe memorial PDF (MarkItDown lê) ou fala "cozinha 14m², troca de piso, ponto de elétrica novo" → a IA monta a sub-árvore classificando pela taxonomia, com selo "sugerido pela IA, confirme" (gate humano).
  - **(B) Click-and-Go por preset**: "+ Ambiente" → escolhe "Cozinha" → a IA pré-lista disciplinas + catálogo de itens zerados (aditivo em potencial); o usuário só liga a quantidade.
  - **(C) Manual**: "+ item". Reusa a gramática-ouro da SC (E5): segmented, busca, carrinho, steppers ≥ 36px.
- **GERENCIAR** (cockpit por papel): "Itens & Avanço" vira a lente "Avanço". Medição: a faixa-dinheiro vira "medido R$ X de R$ Y" + botão "Medir" por ambiente/frente. Hub vê fila de aprovações + disparidades + consumo de créditos IA.
- **EXTRAIR** (1 botão "⬇ Gerar" → 5 artefatos da mesma fonte): Memorial · Proposta/Contrato (bifurca por `tipo_contrato`) · Planilha orçamentária xlsx · Cronograma. Tudo é projeção da árvore; totais são GENERATED.

### Consistência visual
Reusa 100% dos tokens Obra10+ (dark verde `#003b26`/`#0f1d16`, dourado `#c9a24a`, borda `#1d3a2c`)
e os componentes no ar (`CadastroPremiumSideover`, `EntitySelect`, `CrmToggleSwitch`, `CardItem`,
`SeloSituacao`, `FichaItem`). **Risco de densidade** (obra de 832 linhas): colapso agressivo,
lente-única, virtualização — validar no navegador desktop + mobile com a planilha real **antes de fechar**.

---

## 5. Orquestração por IA

### 3 planos de operação
1. **Leitura** (acessar/ver/extrair): o copiloto despacha para tools de leitura (`hub_obra_resumo`, `hub_obra_hoje`, `hub_obra_item_listar`, `hub_obra_financeiro_resumo`, `arq_resumo`) — `SECURITY DEFINER`, tenant-scoped, zero side-effect, auto-executa.
2. **Escrita** (editar/construir/gerenciar): a IA propõe → card de confirmação dourado → humano confirma na tela. Nunca por voz pura para escrita crítica.
3. **Orquestração autônoma** (gestor de tarefas): a IA detecta o verbo no evento e cria a cadeia sozinha — falta material → cria SC rascunho → gera aprovação → quando aprovada → dispara entrega. Humano só vê a tela quando exige decisão; o resto a IA executa em silêncio e **loga**.

### Registry atual vs. o que falta
**[verificado]** Existem ~31 tools de obra/arquitetura. **Faltam os 4 de maior valor (nenhum existe, nem como stub):**
`hub_obra_orcamento_gerar` · `hub_obra_disparidade_detectar` · `hub_obra_contrato_gerar` · `hub_obra_curva_s_calcular`.
Mais: `hub_obra_aditivo_propor`, `hub_obra_ambiente_listar`, `hub_tarefa_criar`, `hub_tarefa_minha_fila`.

### Régua de autonomia (mapeia sobre `HUB_FERRAMENTA_ACESSO`)

| Nível | Comportamento | Exemplos |
|---|---|---|
| 1 | auto-executa sem mostrar | registrar nota de avanço, status automático, notificar |
| 2 | propõe card + 1 clique | criar SC, registrar bloqueio, marcar avanço, mover estágio, medição proposta |
| 3 | propõe + confirmação textual | criar obra, gerar orçamento-IA, aprovar orçamento de frente, preparar pagamento |
| 4 | **nunca por IA, sempre humano na tela** | liberar escrow, aprovar pagamento Gate 2, aprovar aditivo, resolver bloqueio SST, alterar `tipo_contrato` |

> **Humano aprova o dinheiro; voz é proibida no escrow.**

### Pipeline IA honesto (decisão técnica)
A IA **não inventa** `custo_material`/`MO` do memorial (não está lá). Ela **apenas classifica a estrutura**
(ambiente → disciplina → atividade na taxonomia), extrai quantidade se explícita ou marca "conforme projeto",
e o humano confirma com chips de confiança (🟢 ≥85% / 🟡 60-84% / 🔴 sem preço) que ensinam o agente.
Custo vem de catálogo/base ou manual. Fase 2 = IA-visão lê a planta (OCR) para extrair quantidades.

### Metering
**[verificado]** `registrarConsumoIA()` existe (`lib/ia/metering.ts`), grava `hub_ia_consumo`, modo sombra ligado.
**Falta:** `ref_tipo` padronizado para o fluxo AEC; metering em todos os novos tools de geração;
dashboard de consumo por obra no Hub; gate de saldo antes de chamar Orçamento-IA.

---

## 6. Gates / aprovações + escrow honesto

| Gate | Mecanismo | Estado |
|---|---|---|
| **Handoff "Gerar Obra"** | só gera se projeto `entregue` OU aprovado; server-side; idempotente por `obra_id` | **[verificado]** funciona |
| **Aprovação do cliente (A1)** | `hub_projetos_fases.aprovacao_status` + SLA + motivo de rejeição | existe |
| **Gate 1 — Orçamento da frente** | `rpc_aprovar_orcamento_frente`: libera pagamentos + (NOVA) copia snapshot de custo ao item-mãe | existe; falta o snapshot |
| **Gate 2 — Pagamento/Escrow (DUPLO)** | `rpc_liberar_escrow`: 2 chaves; fail-closed (NULL = não-aprovado); movimento append-only | **[verificado]** funciona |
| **Disparidade** | IA cruza orçamento × memorial-mestre → card na Central | **a construir**; view só compara valor |
| **Compra/SC** | SC nasce rascunho; aprovar é gate humano na tela | **[verificado]** funciona |
| **Aditivo** | ligar quantidade num item "aditivo em potencial" com obra contratada vira card, não edição silenciosa | a construir |
| **Imutabilidade `tipo_contrato`** | guard no endpoint PATCH (não trigger): imutável pós-1º orçamento aprovado | **[verificado]** funciona |

**Regra dura (para o dono confirmar):** o escrow **nunca** libera pagamento de item que não esteja
`contratado` **e** medido — mesmo com as 2 chaves.

**Superfície única = Central de Aprovações**: todos os gates numa fila priorizada pela IA,
por persona × mercado × tipo; auto-aprova trivial; humano no crítico (sempre no dinheiro).
Invariantes de todos: append-only no extrato; `tenant` da sessão como guard explícito em cada RPC/query
(service_role bypassa RLS — precedente do vazamento de 28/jun, já corrigido em `lib/ia/aprovacoes.ts`, **não regredir**).

**Escrow honesto:** até a fase 2 (BaaS), é custódia **contábil** (`provedor='interno'`). A UI deve dizer
"Reserva contábil (sem custódia bancária real — fase 1)", não "em custódia bancária".

---

## 7. Plano de build ADITIVO

**Princípio:** aditivo, em fases, reversível, sem big-bang. Cada fase tem gate:
`tsc` 0 + vitest + build + `_chk23` + navegador desktop + mobile sem botão quebrado.
Tolerância obrigatória: padrão `isMissingPgColumn`/`migracao_pendente=true` + fallback in-code — sem a
migração, a UI mostra aviso honesto e nunca quebra.

> **Reordenação vinda da crítica (importante):** a síntese punha E7 como Fase 1.
> Mas materializar custo sobre uma base onde `item_id` é nullable cria drift imediato.
> **A ordem correta começa por fechar o fio do handoff e o `item_id`, ANTES do E7.**

### Fase 0 — imediato, zero migração (fecha o fio rompido)
1. **R1 — fechar o handoff** (`gerar-obra/route.ts` + `criar-obra-com-eap.ts`): derivar `segmento` de `hub_projetos.tipologia` (o `mapTipologiaParaTipoObra` já existe e roda no route) e **passar `segmento` ao `criarObraComEAP`**. Isso ativa `semearItensPorAmbiente` no caminho Arq → Obra. ~5 linhas no `route.ts`. Fecha a maior lacuna do produto.
2. **R2 — forçar `item_id`** no endpoint de criação de `orcamento_item`: exigir `item_id` ou retornar 400 "Selecione o item de escopo antes de lançar custo". A `vw_hub_obra_compatibilizacao` passa a funcionar de verdade no próximo deploy. **Bug em produção.**
3. **R3 — canonicalizar ambiente** no endpoint: todo write em `hub_obra_itens.ambiente` passa por `value.trim().toLowerCase()`. Elimina a fragmentação de subtotais ("Sala" vs "sala " vs "SALA") sem lista fechada.

### Fase 1 — E7 item-escopo (migração aditiva)
`20260815120000_e7_item_escopo_unificado.sql`, marcador **"⚠️ NÃO aplicar — janela do dono"**.
- `ALTER ADD COLUMN` em `hub_obra_itens`: `custo_locacao_frete`, `custo_material`, `custo_mao_obra`, `bdi_fator` (nullable) + `custo_unitario` e `custo_total` GENERATED (**soma inline — Postgres não encadeia GENERATED**; comentário no SQL explicando, para o próximo dev não tentar `custo_unitario * quantidade` e quebrar a migração).
- `ALTER hub_obras ADD bdi_fator DEFAULT 1.0`.
- 2 views `security_invoker=true`: `vw_hub_obra_item_margem`, `vw_hub_obra_item_peso` (só `parent_id IS NULL`).
- **Nenhum DROP, nenhuma tabela nova.** Rollback = `DROP COLUMN`.
- Teste `e7-item-escopo.test.ts`: `custo_total` correto, BDI 3 camadas (item → obra → 1.0), peso só raiz, sem drift, reversível.

### Fase 2 — 1:1 forte E2 ↔ E6 + tela Escopo
- **Sem alterar a coluna `item_id`** (evita risco em prod). Regra de aplicação no endpoint: todo `orcamento_item` nasce com `item_id` setado.
- Regra de aprovação: `rpc_aprovar_orcamento_frente` copia custo ao item-mãe.
- `status_escopo`: **reusar/estender o `tipo` de E2** (`DROP`+`ADD CHECK`) — menos coluna, menos drift (salvo decisão do dono em contrário).
- Componente `ArvoreEscopo` + aba Escopo de 1ª classe + `DrawerNovoOrcamento` refatorado em Click-and-Go (chips ambiente/disciplina + busca catálogo + 3 campos de custo + BDI no header).

### Fase 3 — ambiente nível real + medição + tools IA
- **Aplicar** a `tipo_no` que **já existe** em E0b (frente/ambiente/disciplina) + `ADD area_m2`/`perimetro_ml`. AMBIENTE = nó `parent_id NULL tipo_no='ambiente'`; DISCIPLINA = filho. Toda frente no ar segue `tipo_no='frente'` (nada muda até a obra optar pelo ambiente-first).
- `hub_obra_medições` (append-only: `obra_id`, `item_id`, `data`, `quantidade_realizada`, `foto_url`, `assinado_em`/`por`).
- `hub_obra_disparidade_detectar` → depois `hub_obra_orcamento_gerar`.

### Fase 4 — E4 Curva-S
Pendura no peso derivado do E7. Tabelas baseline + pontos + `avanco_diario` append-only.
Separar `pct_fisico` e `pct_financeiro`. Sem E4, degrada para avanço-só.

### Tabelas novas (todas aditivas)
`hub_obra_medições` · `hub_tarefas` (irmã de `hub_aprovacoes`) · `hub_tenant_preco_base` (dormente, realimenta a IA).
Opcional: `hub_users.role`, `hub_tenant_config.bdi_padrao`.

### Ordem cronológica de apply (timestamps já garantem)
`multitenant (20260626130000)` → `E0 (0705130000)` → `A0` → `E2 (0710120000)` →
`E0b (0711120000)` → `E5 (0720120000)` → `E6 (0730120000)` → `E4 (0810120000, futuro)` →
`E7 (0815120000, último)`. **E7 não depende de E4.**

### Segurança (invariante)
Todo endpoint/view novo filtra `.eq('tenant_id')` **puro** + guard 404 por posse.
Nunca `.or(...is.null)` em dados de obra. Itens novos nascem `tenant_id NOT NULL`.
Adicionar `tenant_id` ao INSERT em `hub_decision_logs` (`lib/ia/aprovacoes.ts`) — log de decisão de dinheiro não pode ficar fora do tenant.

---

## 8. Decisões pendentes do dono

> Cada uma toca a fundação. Nada abaixo será construído sem o seu OK.

1. **Unificação E2 + E6 (toca o coração financeiro).** Posso tratar `hub_obra_itens` como o **único** item de escopo (carrega custo + preço + avanço + datas) e rebaixar `hub_obra_orcamento_itens` a camada de versão/proposta 1:1 do mesmo item — refatoração de fundação em fases aditivas e reversíveis (rollback = `DROP COLUMN`), sem quebrar o que roda? **Confirma que o item contratado é a verdade e o orçamento é a proposta?**

2. **`status_escopo`.** Reusar o `tipo` que já existe em E2 (`contrato`/`aditivo`/`servico_extra`), estendendo o CHECK (recomendado, menos drift) — **ou** criar campo separado para distinguir "aditivo contratado" de "aditivo em potencial"?

3. **BDI e quem vê a margem.** (a) Confirma 1 fator único por empresa (`hub_obras.bdi_fator` DEFAULT 1.0; a empresa seta 1.06), com override por item só na exceção — ou já quer composição (administração/lucro/risco/tributos) no MVP? A planilha real usa fator único 1.06. (b) **O Hub precisa ver a margem real (custo × preço) de cada empresa para auditar, mesmo no `preco_fechado`, ou a margem da executante é segredo comercial** e o Hub audita só a cobertura de escopo?

4. **Medição / faturamento.** O subtotal por **ambiente** (cozinha, sala) é a unidade de medição e cobrança, ou você mede por **disciplina/frente** (elétrica inteira)? Os dois? Isso decide se ambiente é nível-1 obrigatório da EAP. No `preco_fechado` o escrow libera por **marco** — quem mede (Arquitetura = chave 1 física) e quem aprova (Hub = chave 2)? O cliente aprova antes ou em paralelo?

5. **Disparidade: trava ou aviso?** Quando o orçamento de um fornecedor não bate com seu memorial-mestre, o padrão é (a) **bloqueia** e exige validação na Central, ou (b) **passa com alerta amarelo** e você revisa depois? E: o item "aditivo em potencial" (catálogo zerado por ambiente × disciplina) aparece **sempre** pré-listado (mais Click-and-Go, ensina o escopo, cura o medo, mas adiciona densidade) ou só sob demanda?

6. **Prioridade e aplicação.** Construo primeiro "memorial PDF → IA levanta quantidades → preenche itens" (Orçamento-IA), ou primeiro fecho ambiente-nível-1 + gate de disparidade + a UX Click-and-Go manual (valor imediato sem depender da base de preços histórica)? E **quando aplico as migrações E7/`tipo_no` em PRODUÇÃO** — na sua janela junto com E0-E6 ainda pendentes, ou E7 depois? (aplicar migração em produção é trava que exige seu OK explícito.)

7. **Escrow cross-conta (sem dono no design atual).** No `preco_fechado`, o Gate 2 exige `aprovacao_arq_id` (chave 1 = arquitetura). Quando o arquiteto é de **outro tenant**, quem preenche essa chave? Recomendação técnica: um campo enum em `hub_obras` (`chave1_papel IN ('arquiteto_proprio','hub_auditor','cliente')`) e o `rpc_liberar_escrow` valida o papel antes de aceitar. **Precisa ser fechado antes de qualquer UI de aprovação dupla turn-key.**

8. **Aba Escopo: nova aba ou botão dentro de "Itens & Avanço"?** A aba "Escopo" seria a tela de montagem da árvore; "Itens & Avanço" vira a lente de execução. Aceita uma aba nova de 1ª classe (novo ponto de entrada para o engenheiro aprender) — ou prefere o "+ Adicionar item" **dentro** da aba existente, sem criar aba?

---

## 9. ✅ DECISÕES TRAVADAS pelo dono (29/jun) — fundação aprovada
1. **Unificar E2+E6: SIM.** `hub_obra_itens` = o ÚNICO item de escopo (a verdade, carrega custo+preço+avanço+datas); `hub_obra_orcamento_itens` = proposta/versão 1:1 do mesmo item. Refatoração aditiva, em fases, reversível (rollback = DROP COLUMN).
2. **status_escopo: REUSAR** o `tipo` que já existe em E2 (estender o CHECK; ex.: + `aditivo_potencial` para o catálogo zerado).
3. **(a) BDI = fator único por empresa** (`hub_obras.bdi_fator` DEFAULT 1.0; override por item na exceção). Composição (admin/lucro/risco/tributos) = futuro. **(b) Margem [não batido] → default:** administração = transparente (Hub vê custo×preço); preço-fechado = margem privada da executante, Hub audita só cobertura de escopo. **CONFIRMAR antes das views do Hub.**
4. **Medição/avanço = POR ITEM.** O % de avanço é controlado por ITEM (`peso` + `pct_avanco` no item — E2 já tem). Exibir o avanço **por item E por ambiente** (ambiente = agregação ponderada bottom-up dos itens). Ambiente = nível de árvore/agregação, NÃO a unidade de medição.
5. **Disparidade = AVISA** (alerta amarelo → item na Central de Aprovações; NÃO trava o fluxo). "Aditivo em potencial" (catálogo zerado por ambiente×disciplina): pré-listado mas **colapsado** (não polui).
6. **Prioridade = MANUAL-FIRST** (árvore editável + ambiente + gate de disparidade + Click-and-Go = valor imediato sem depender da base de preços) ANTES do "memorial PDF → IA orça". Migrações = **só-arquivo** até a janela do dono.
7. **Escrow cross-conta: OK** — campo `chave1_papel` (`arquiteto_proprio`/`hub_auditor`/`cliente`) validado no `rpc_liberar_escrow`. Fechar antes de qualquer UI de aprovação dupla turn-key.
8. **Aba "Escopo" NOVA de 1ª classe** (montar a árvore); "Itens & Avanço" vira a lente de execução da MESMA árvore.
