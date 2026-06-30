# Setor Orçamentária — Design cross-vertical

> Status: design. Não testei visualmente (o `_chk23` não rodou hoje — o dev server estava
> desligado, não subi o app). As afirmações sobre código abaixo eu verifiquei lendo os
> arquivos reais; marco entre `código:` o que conferi.

---

## 1. O que é o setor Orçamentária

A Orçamentária é um **verbo**, não uma planilha. Ela faz três coisas em qualquer vertical:

1. **Decompõe** o trabalho em itens orçáveis.
2. **Precifica** pelo fator: `custo × BDI = preço`.
3. **Mede** o realizado contra o combinado.

Em Arquitetura, Engenharia, Serviços e Produtos isso é a **mesma conta** aplicada a objetos
diferentes. A prova mora no código: `lib/obras/escopo.ts` faz a matemática inteira
(custo→preço→margem→peso→avanço) e **não decide nada por ser "obra"** — opera sobre
`ItemEscopoInput[]`. O acoplamento à obra é fino e mora em três pontos só:

- **código:** `hub_obra_itens.obra_id UUID NOT NULL REFERENCES hub_obras(id) ON DELETE CASCADE`
  (migração E2, linha 56).
- **código:** as 2 views E7 (`vw_hub_obra_item_margem` / `vw_hub_obra_item_peso`) fazem
  `JOIN hub_obras o` — e usam esse join **só** para ler `o.bdi_fator`
  (`COALESCE(i.bdi_fator, o.bdi_fator, 1.0)`, E7 linhas 111-120).
- O endpoint `/api/crm/obras/[id]/escopo` valida posse via `hub_obras` e filtra por `obra_id`.

Conclusão: o motor **já é genérico**. O setor Orçamentária não é tela nova nem motor novo —
é reconhecer isso e generalizar a ancoragem quando o dono priorizar a 2ª vertical.

### As 4 verticais e o JOB de cada uma

| Vertical | Nível 1 → Nível 2 | "Custo" | Mede por | Entregável |
|---|---|---|---|---|
| **Engenharia** (1ª, em build) | ambiente → disciplina/atividade | material + MO + locação | avanço físico ponderado | planilha + cronograma |
| **Arquitetura** | fase/cômodo → disciplina de projeto | honorário (horas × valor-hora, ou % CUB/obra) | entrega aprovada | proposta de honorários |
| **Serviços** | etapa → item | horas/diárias + insumo | marco | OS |
| **Produtos** | produto → componente (BOM) | itens × qtd | produzido/entregue | pedido |

JOB convergente: o arquiteto "fecha honorário sem subprecificar"; o engenheiro "não estoura
custo e prova avanço"; o prestador "precifica horas e mede entrega"; o vendedor "monta pedido
com margem".

---

## 2. O padrão único = a estrutura unificada

O setor herda a regra-mãe do dono: **um item de escopo, não N**. O que é comum vira o núcleo
neutro (nunca duplicar); o que varia por vertical é **dado**, não código novo.

### Comum (núcleo neutro — já escrito e testado na instância obra)

1. A célula **item de escopo**: unidade orçável com qtd + unidade + parcelas de custo + BDI + avanço.
2. A **árvore** grupo → subgrupo → item, com subtotais e cockpit de 4 KPIs.
3. **BDI/markup** fator único + override por item.
4. **Peso financeiro** derivado e **avanço ponderado** — só nos itens-raiz, nunca contando
   pai+filho em dobro.
5. **Disparidade** contra um mestre (avisa, não trava).
6. **Projeção persona-aware** em Memorial + CSV (Proposta/Contrato no futuro).
7. **Gate de aprovação / snapshot.**

### Específico (a "pele" por vertical — só dado)

- Os **rótulos dos 2 níveis** + ícones (hoje hard-coded no JSX: `AMBIENTE`/`DISCIPLINA`).
- O **preset/taxonomia** plugado no mesmo shape de `taxonomia.ts` (atividade canônica ×
  contexto de uso — "uma Tomada 1,10m é a mesma em qualquer lugar"; a qtd por contexto vive
  no preset).
- A **composição de custo** (3 parcelas configuráveis).
- O **modo de medição** (contínuo / marco / aprovação).
- O **vocabulário de status** (contrato/aditivo é de obra/AEC).

### O alinhamento cross-vertical (o diferencial real)

O orçamento de Arquitetura (honorário) e o de Engenharia (obra) descrevem o **mesmo
empreendimento**. O nível-1 "ambiente/cômodo" é a chave de junção: a metragem do programa de
projeto (`hub_projetos_fases.tipo='comodo'`, já existe) é a área do ambiente da obra. É onde a
disparidade cruza verticais: o que o arquiteto especificou (mestre) × o que a engenharia orçou
× o que o fornecedor cotou.

> **Correção honesta sobre o R1.** A síntese assumia que o fio Arq→Eng estava rompido (a obra
> nascia oca). **Conferi o código e ele já está fechado:**
> `app/api/crm/projetos/[id]/gerar-obra/route.ts` deriva `segmento` de `proj.tipologia` via
> `mapTipologiaParaSegmento` e o passa a `criarObraComEAP` (rotulado "R1 / Fase 0" nas linhas
> 114-130). A obra herda a árvore ambiente→item do arquiteto. O R1 **não é mais pré-condição
> pendente** — está entregue.

---

## 3. Modelo de dados — aditivo, polimórfico

**Fundação: uma tabela genérica com ancoragem polimórfica**, não tabela por vertical.

`hub_obra_itens` ganha:

```sql
ALTER TABLE public.hub_obra_itens
  ADD COLUMN IF NOT EXISTS ancora_tipo TEXT NOT NULL DEFAULT 'obra'
    CHECK (ancora_tipo IN ('obra','projeto','servico','produto','negocio')),
  ADD COLUMN IF NOT EXISTS ancora_id UUID;            -- nullable; backfill = obra_id quando 'obra'
```

`obra_id` **permanece intacto** — é a âncora "obra" materializada e tem a FK CASCADE real
(removê-lo seria destrutivo e quebraria E2/E6/E7c). Tabela por vertical
(`hub_projeto_itens`/`hub_servico_itens`/…) seria 4× schema + views + endpoints e mataria "um
padrão pra tudo" — é o anti-padrão E2×E6 que o dono mandou unificar.

### BDI migra para o tenant

Alinha com o insumo do dono: **fator único por empresa**, não por obra.

```sql
ALTER TABLE public.hub_tenant_config
  ADD COLUMN IF NOT EXISTS bdi_padrao NUMERIC(6,4) NOT NULL DEFAULT 1.0;
```

A leitura vira: `item.bdi_fator ?? ancora.bdi_fator ?? tenant.bdi_padrao ?? 1.0`. Isso é o que
**libera as 2 views E7 do JOIN obrigatório com `hub_obras`** — conferi que esse join existe só
pelo `COALESCE(..., o.bdi_fator, 1.0)`. Sem essa mudança, toda vertical seria forçada a ter uma
linha-espelho em `hub_obras` só pelo BDI.

### Migração E8 — só arquivo, "NÃO aplicar — janela do dono"

Só `ADD COLUMN` + backfill: as 2 colunas de âncora + `ancora_id := obra_id WHERE
ancora_tipo='obra'` + `hub_tenant_config.bdi_padrao`. Zero DROP, zero tabela nova, zero toque em
E0/E2/E6/E7/E7b/E7c. Rollback = `DROP COLUMN`. Espelha o padrão E7 (tolerância
`isMissingPgColumn` → `migracao_pendente`). A coluna `GENERATED custo_total` não referencia
âncora — segue intacta.

### Views

Manter as 2 atuais servindo a vertical "obra" (zero regressão). Verticais novas no MVP usam o
**fallback in-code de `escopo.ts` (`calcularItem`)** — que já existe, já é testado e já é o
caminho quando E7 está pendente. Nenhuma vertical nova depende de view nova; view
ancora-agnóstica é otimização posterior.

### Arquitetura-alvo: 1 core neutro + N adaptadores finos

- Promover `lib/obras/escopo.ts` → `lib/orcamentaria/core.ts` (refactor mecânico de import
  path; os testes travam a regra — zero mudança de lógica).
- `ItemEscopoInput`/`Calc`/`NoAmbiente` viram os tipos canônicos do setor. `ObraMeta` →
  `AncoraMeta` (mesma forma).
- Cada vertical = 1 `Adaptador<Ancora>` com 3 métodos: `validarPosse(ancoraId, tenantId)→404`,
  `bdiDefault(ancora)→number`, `rotularContexto(ancora)→meta + rótulos de nível`.
- Extrair `montarRespostaEscopo(itens, persona, bdiDefault, ancoraMeta)` do endpoint atual;
  cada vertical tem um `route.ts` curto que a chama. **Nunca um endpoint-monstro com
  `switch(vertical)`.**

### Composição de custo configurável (gap nº1)

**código:** hoje `custoUnitario = custo_locacao_frete + custo_material + custo_mao_obra` —
3 parcelas hard-coded de obra (`escopo.ts` linhas 81-90). Honorário (horas × valor-hora) e BOM
(itens × qtd) não cabem nessas 3 colunas sem distorção. Tratar as 3 parcelas como um **perfil
de composição** por vertical sobre o mesmo somatório `custo × fator`. Não instanciar a 2ª
vertical antes de o dono bater este ponto (decisão 1).

### Modo de medição por vertical (gap nº2)

`avancoPonderado()` só sabe avanço físico contínuo 0–100 ponderado por preço. Arquitetura mede
por **entrega aprovada** (`hub_projetos.aprovacao_status` já existe, fora do motor), produto por
**produzido/entregue**, serviço por **marco**. Adicionar um modo (contínuo | marco | aprovação)
por vertical, nullable/default-engenharia. Decisão do dono (decisão 2).

### Segurança — o risco nº1 da generalização

Com `(ancora_tipo, ancora_id)` o guard de posse não pode mais ser "a obra é do meu tenant".
`crmDb()` é service-role e **bypassa RLS**. Se um adaptador esquecer o `.eq('tenant_id')` puro +
guard 404, reabre o vazamento cross-tenant de 28/jun. Mitigação:

- O core **nunca** recebe `ancora_id` sem o adaptador ter retornado posse OK — tipar isso com
  um brand type `AncoraVerificada` para o compilador impedir pular o guard.
- Cada adaptador novo entra com **teste de isolamento obrigatório**.
- Dívida documentada: `ancora_id` sem FK forte (polimorfismo não tem integridade referencial
  nativa). `obra_id` mantém a FK CASCADE; demais validam no endpoint + job de varredura de
  órfãos.

### Nome legado

`hub_obra_itens` permanece (renomear tabela em prod é destrutivo). O que generaliza é a
semântica via `ancora_tipo`. Registrar em `DECISIONS.md`: *"`hub_obra_itens` é, de fato,
`hub_escopo_itens`; o nome legado é dívida cosmética, não estrutural."* Uma view
`vw_hub_escopo_itens` pode ser o ponto de leitura cross-vertical futuro.

---

## 4. Navegação e persona

### Onde a Orçamentária aparece

**É uma aba transversal dentro de cada vertical + um relatório agregado no Hub — não um 5º item
de menu de montagem.** **código:** o menu (`lib/crm-nav-groups.ts`, grupo "Operações") tem
Arquitetura (`/crm/projetos`), Engenharia (`/crm/obras`), Imóveis, Pedidos — **não há rota
`/crm/orcament*`**. Criar um item "Orçamentária" de montagem duplicaria a árvore (4ª superfície
de montagem do mesmo item), confundiria "onde eu orço?" e feriria a regra-eterna (tabela =
relatório). O Hub ganha visão **agregada** (lista de orçamentos com disparidades flagadas), não
tela de montagem.

### Reuso do mesmo componente

O `ArvoreEscopo` hoje só aceita `obraId` e está hard-coded a `/api/crm/obras/[id]/*` e aos
rótulos `AMBIENTE`/`DISCIPLINA`. Generalizar (aditivo, default-obra):

- trocar `obraId` por `{ tipoContexto, refId, endpointBase }`, mantendo `obraId` como alias
  deprecado (zero quebra na obra);
- parametrizar `{ rotuloNivel1, rotuloNivel2, icones, lenteInicial }` via props.

É a **única barreira de UI** ao reuso; o motor puro não muda. Herdam de graça: empty-state de
3 caminhos, editor inline com fórmula exposta, seletor de lente, cockpit 4-KPI, MenuGerar
(Memorial+CSV), tokens Obra10+.

O contexto muda 3 coisas na mesma tela, não na lógica: (1) o rótulo do nível-1; (2) a lente
inicial (obra abre em "avanço"; orçamento novo abre em "preço"); (3) os rótulos do empty-state e
do menu Gerar.

### Primeiro lugar a aplicar = Arquitetura

`/crm/projetos/[id]` ainda não reusa o `ArvoreEscopo` — tem abas próprias e o "Programa" é lista
de cômodos (`hub_projetos_fases.tipo='comodo'`, o embrião do nível-1), mas a árvore **orçada**
com custo/preço só existe na obra. O dono diz "arquitetura depende de orçamento igual a
engenharia" — e na tela isso ainda não aparece. Adicionar a aba "Escopo/Orçamento" em
Arquitetura é o gap mais visível do princípio do dono.

### Persona → acesso (já ~90% pronto)

**código:** a derivação é server-side e autoritativa (`lib/obras/persona-escopo.ts`); o
`/escopo` sanitiza o payload por persona antes de enviar (defesa em profundidade, não
esconder-no-cliente). Mapeamento conferido:

- `owner`/`gestor` → `hub` (vê custo + preço + margem);
- `comercial`/`financeiro`/`atendente` → `executor` (vê custo + preço + margem da sua obra);
- `parceiro` → `prestador` (vê só preço);
- **role desconhecido/vazio → `prestador`** (o mais restrito — nunca `executor` por omissão).

A persona é **ortogonal à âncora** — a régua "telas por persona" não precisa de retrabalho na
generalização.

> **Gap confirmado (trava de design, não de UI).** Não existe role `arquiteto` no RBAC — o
> próprio `persona-escopo.ts` documenta isso. Hoje um usuário de arquitetura cairia como
> `executor`/`gestor` e **veria custo/margem**. Criar o role `arquiteto` **antes** de expor a
> aba Orçamento na Arquitetura, senão vaza margem para quem não deveria ver.

> **Gap mobile a conferir antes do build:** `/crm/obras/[id]` está em `SHEET_PREFIXES` (sub-header
> de voltar); `/crm/arquitetura` pode não estar — a aba Orçamento na ficha de Arquitetura pode
> não receber o sub-header no mobile. Não validei (depende de subir o app).

---

## 5. Plano de build aditivo

O que **reusa a orçamentária da obra**: tudo. O motor (`escopo.ts`), a projeção
(`orcamentaria.ts`), a persona (`persona-escopo.ts`), a taxonomia (`taxonomia.ts`) e o
componente `ArvoreEscopo` já existem na instância obra. As fases abaixo extraem e parametrizam,
não reescrevem.

| Fase | O que faz | Migração? | Quando |
|---|---|---|---|
| **Build agora** | Terminar de provar o núcleo na vertical Obra (árvore editável + ambiente + Click-and-Go + Memorial/CSV, já entregues no commit f8fd7dd). Valida o padrão antes de generalizar. | Não | Em andamento |
| **Fase 0 — R1** | **Já entregue.** Conferi no código: `gerar-obra/route.ts` já passa `segmento` a `criarObraComEAP`. Marcar como concluída, não como pendente. | — | Feito |
| **Fase 1 — core neutro** | `escopo.ts` → `lib/orcamentaria/core.ts` (refactor mecânico); `ObraMeta`→`AncoraMeta`; contrato `Adaptador<Ancora>`; extrair `montarRespostaEscopo`. Proibir reimplementação do cálculo em `DECISIONS.md`. | Não | Quando o dono priorizar a 2ª vertical |
| **Fase 2 — E8 (só arquivo)** | `ADD COLUMN ancora_tipo/ancora_id` + backfill + `hub_tenant_config.bdi_padrao`. Libera as views do JOIN obrigatório. | Sim — "NÃO aplicar" | Só com OK do dono |
| **Fase 3 — parametrizar `ArvoreEscopo`** | props de contexto/rótulos/lente; perfil de composição (3 parcelas); modo de medição. Tudo nullable/default-engenharia. | Não | Após Fase 1 |
| **Fase 4 — 2ª vertical = Arquitetura** | adaptador + `/api/crm/projetos/[id]/escopo` (troca só a tabela de posse para `hub_projetos`) + aba "Escopo/Orçamento". Composição = honorário; medição = entrega aprovada. **Pré-requisito: role `arquiteto` no RBAC.** | Não | Uma vertical por vez |
| **Fase futura** | Serviços (etapa→item, marco) e Produtos/BOM (produto→componente). Cada um = 1 adaptador fino + 1 endpoint curto sobre o mesmo core. | Não | Menor urgência |
| **Relatório agregado (paralela)** | Card "Orçamentos" no Dashboard + página de relatório por vertical com badge de disparidade. Relatório, **não** tela de montagem. | Não | Quando útil |

### Ferramentas de IA (gap confirmado)

**código:** `hub_obra_orcamento_gerar` e `hub_obra_disparidade_detectar` **não existem** no
registry (grep não encontrou). O pipeline honesto está descrito: a IA não inventa custo —
`quantidade=null` + `custo=null` quando o memorial não traz números. Construir "memorial PDF →
IA levanta estrutura" **depois** do manual-first. Padronizar `ref_tipo='orcamento'` no metering
(hoje os callsites usam `'lead'`/`'copiloto'`/`'playbook_ia'` — o custo de IA da obra cairia no
balde genérico).

### Não fazer (anti-aditivo — repete o erro que o dono mandou corrigir)

- Criar `hub_arq_itens`/`hub_servico_itens`/`hub_produto_itens` paralelos.
- Forkar `escopo.ts` por vertical.
- Criar item de menu "Orçamentária" de montagem.
- Instanciar 4 frentes em paralelo.
- Gerar schema especulativo antes de a 1ª vertical-irmã ser priorizada.

---

## 6. Decisões pendentes do dono

1. **Composição de custo por vertical (trava nº1 — destrava a 2ª instância).** Confirma que as
   3 parcelas atuais (locação / material / MO) são o perfil de **Engenharia**, e que Arquitetura
   usa horas × valor-hora (ou % CUB/obra) e Produto usa itens-BOM, todas somando para o mesmo
   `custo × BDI = preço`? Ou o honorário entra como valor único, sem decompor? *(Sem isso, não dá
   para instanciar Arquitetura sem distorcer os dados.)*

2. **Modo de medição por vertical.** Quer um modo (entrega aprovada / marco / produzido) por
   vertical dentro do mesmo motor, ou cada vertical mede do seu jeito fora da árvore? *(O motor
   hoje só sabe avanço físico contínuo ponderado por preço.)*

3. **Âncora-raiz de Serviço/Produto (trava de fundação — sem ela, `ancora_id` fica sem alvo).**
   Numa obra a âncora é a obra; num projeto, o projeto. Num **serviço avulso** ou **produto
   orçado**, qual é o agregador-raiz? Um "pedido"? Um item de catálogo? Um "negócio"? *(Destrava
   todo o polimorfismo.)*

4. **BDI no tenant.** Confirma que o fator único por empresa deve morar em
   `hub_tenant_config.bdi_padrao` (e não mais na obra), para toda vertical herdar o mesmo default
   — mantendo override por item e por âncora? *(É o que libera o orçamento de ser sempre amarrado
   a uma obra só pelo BDI.)*

5. **Sequência do setor.** Depois de provar a Obra, qual a 2ª vertical — Arquitetura/honorários
   (recomendo: é a fonte do escopo e já tem o embrião do nível-1), Serviços ou Produtos? E:
   extraio o core neutro já (em arquivo, sem aplicar), ou mantenho "obra" como única instância no
   MVP e deixo o motor pronto (já está puro) para plugar verticais quando você priorizar?
   *(Recomendo a 2ª: o motor já é genérico; a ancoragem é barata de adicionar quando a vertical
   chegar — evita schema especulativo.)*

6. **Alinhamento cross-vertical.** O "ambiente/cômodo" (metragem do programa de Arquitetura, já
   em `hub_projetos_fases.tipo='comodo'`) é a chave que costura os 3 orçamentos. Confirma que a
   disparidade da IA deve cruzar **verticais** (memorial-do-arquiteto × orçamento-da-obra ×
   cotação-do-produto), e não só dentro da obra? *(O fio Arq→Eng já está fechado — o R1 está
   entregue no código.)*

7. **Vocabulário de status por vertical.** "contrato/aditivo/servico_extra" e os níveis
   "ambiente/disciplina" são de obra (AEC). Para Serviços/Produtos trato como "grupo/subgrupo"
   genéricos rotulados pelo adaptador — ou cada vertical terá vocabulário próprio a desenhar numa
   mesa redonda específica?

8. **Aplicar migração em produção (trava — exige seu OK explícito).** A E8 (cross-vertical) e as
   E0–E7 ainda pendentes: aplico na sua janela junto, ou E8 depois? Aplicar migração em produção
   só rodo com seu OK e com backup, mesmo sendo aditiva e reversível por `DROP COLUMN`.
