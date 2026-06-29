# 🧮 ANÁLISE — Planilha REAL de ORÇAMENTO do dono (engenheiro civil)

> Análise técnica + dump da planilha real de orçamento (`orcamento-dono.xlsx`, 112 KB, contrato **P2K25.100.03.04.00.TAG**, cliente "RODRIGO E ALLINE"). Espelha a estrutura EXATA para o nosso modelo unificado. Companheira de [`ANALISE-planilha-gestao-obra.md`](./ANALISE-planilha-gestao-obra.md) (a planilha de GESTÃO, do Consulado Itália) e de [`estrutura-unificada-orcamento-cronograma-escopo.md`](./estrutura-unificada-orcamento-cronograma-escopo.md) (a chave-mestra do dono).
>
> **Veredito de uma linha:** a planilha confirma, na prática e fórmula a fórmula, a tese do dono — **orçamento, escopo e cronograma são UMA estrutura só** organizada por **ambiente → disciplina/frente → item (material + mão de obra + locação/frete)**. É exatamente a EAP-taxonomia (E0.5), agora com o eixo **quantidade × preço unitário** e um **fator BDI** explícito.

---

## 1. As ABAS (2)

| # | Aba | Propósito |
|---|-----|-----------|
| 1 | **`LEVANTAMENTO WENDEL`** | **A planilha de orçamento.** 832 linhas. "GESTÃO DE CENTRO DE CUSTO - OPERACIONAL POR CONTRATO" / "PLANILHA DE ORÇAMENTOS". Lista todo o serviço da reforma, ambiente por ambiente, com quantidade, material, mão de obra e total. É também o **levantamento de quantidades** (daí o nome). |
| 2 | **`CRONOGRAMA`** | **Cronograma físico (Gantt) – "AVANÇO DE OBRA".** ~1004 linhas × 308 colunas. Atividades em sequência de fases, com data início/término, % de avanço e RESPONSÁVEL (a disciplina). As colunas a partir de I são **um dia por coluna** (gera a barra de Gantt). Compartilha a taxonomia de disciplinas com o orçamento. |

A planilha **não** tem aba separada de "BDI", "memorial" ou "proposta": o BDI é um **fator embutido** (ver §2.4) e o escopo/memorial **é a própria lista de itens** (ver §3).

---

## 2. Estrutura EXATA da aba de ORÇAMENTO (`LEVANTAMENTO WENDEL`)

### 2.1 As duas zonas (o "pulo do gato")

A planilha tem **DUAS metades lado a lado** que descrevem o mesmo item:

| Zona | Colunas | Rótulo na planilha | O que é |
|------|---------|--------------------|---------|
| **ENTRADA — custo base** | **K–O** | `INSERIR OS CUSTOS AQUI` (K6) | Onde o engenheiro **digita o custo** (sem BDI). É o levantamento de fornecedor. |
| **SAÍDA — valor orçado** | **E–I** | `VALOR ORÇADO` (F7/K7) | **Calculada por fórmula** = custo × fator BDI (J7). É o **preço de venda** que vai pro cliente. |

Ou seja: **digita em K–O → sai pronto em E–I**, multiplicado pelo BDI. A coluna A/B/C/D (código/descrição/quant/unidade) é compartilhada pelas duas zonas.

### 2.2 As colunas-núcleo (cabeçalho real, linhas 7–8)

| Col | Cabeçalho | Significado | Como é preenchida |
|-----|-----------|-------------|-------------------|
| **A** | `CÓDIGO DO ÍTEM` | Código curto do item: `PP.001`, `GC.01`, `GC.E1`, `GC.L2`, `LV.P1`, `LV.A2`… Prefixo = **ambiente** (GC=Garagem Coberta, LV=Lavanderia…), sufixo = **disciplina+nº** (E=elétrica, L=luminária/iluminação, P=pintura, A=acabamento). | Manual |
| **B** | `DESCRIÇÃO` | Texto do serviço. Padrão: *"Fornecimento de material e mão de obra para a execução/instalação/remoção de …"*. **É o memorial descritivo do item.** | Manual |
| **C** | `QUANT.` | Quantidade levantada | Manual |
| **D** | `UNIDADE` | `m²`, `ml`, `unid`, `vb` (verba), `Mês`, `Verba`, `cj`… | Manual |
| **E** | `LOCAÇÕES E FRETES` (orçado) | `=$J$7*K` → custo de locação/frete × BDI | Fórmula |
| **F** | `MATERIAL` (orçado) | `=$J$7*L` → material × BDI | Fórmula |
| **G** | `MO` (orçado) | `=$J$7*M` → mão de obra × BDI | Fórmula |
| **H** | `MAT+MO` (orçado, unit.) | `=$J$7*N` → (mat+mo) × BDI = **preço unitário** | Fórmula |
| **I** | `TOTAL` (orçado) | `=H × C` → **preço unitário × quantidade = total do item** | Fórmula |
| **K** | `LOCAÇÕES DE FRETES` (custo) | custo digitado de locação/frete | Manual |
| **L** | `MATERIAL` (custo) | custo digitado de material | Manual |
| **M** | `MO` (custo) | custo digitado de mão de obra | Manual |
| **N** | `MAT+MO` (custo, unit.) | `=SUM(K:M)` → soma dos custos unitários | Fórmula |
| **O** | `TOTAL` (custo) | `=N × C` → custo total do item (sem BDI) | Fórmula |
| **J7** | *(fator)* | **`1.06`** → o **BDI / multiplicador** (6%). Célula única referenciada por `$J$7` em todas as linhas. | Manual (parâmetro global) |

> **Separação ambiente / serviço-frente / material / MO / equipamento — explícita:**
> - **Ambiente** = linha de **seção** (subtotal), ex. `GARAGEM COBERTA - Área: 17 m² | Perímetro interno: 18 m.l`.
> - **Serviço/frente (disciplina)** = linha de **título** dentro do ambiente: `DEMOLIÇÕES E REMOÇÕES`, `CIVIL`, `ELÉTRICA - TOMADAS - DADOS E VOZ`, `ELÉTRICA - ILUMINAÇÃO`, `HIDRÁULICA`, `IMPERMEABILIZAÇÃO`, `SERRALHERIA E FECHAMENTO`, `GESSO / DIVISÓRIAS`, `PINTURA`, `REVESTIMENTOS / ACABAMENTOS`, `TELHADO E COBERTURA`.
> - **Material** = col L (custo) / F (orçado).
> - **Mão de obra** = col M (custo) / G (orçado).
> - **Equipamento / locação / frete** = col K (custo) / E (orçado) — é onde entra equipamento/locação (caçamba, andaime etc.).

### 2.3 Como calcula `quantidade × preço unitário = total` (a cadeia de fórmulas)

Para cada item (exemplo da linha 16, Garagem/Demolições):
```
N (custo unit.)   = SUM(K:M)            → locação + material + MO        (ex.: 0 + 15 + 35 = 50)
O (custo total)   = N × C               → custo unit. × quantidade        (ex.: 50 × 17 = 850)
H (preço unit.)   = $J$7 × N            → custo unit. × BDI(1.06)          (ex.: 53,00)
I (total orçado)  = H × C               → preço unit. × quantidade         (ex.: 901,00)
```
**Resumo:** `TOTAL = (locação+material+MO) × BDI × quantidade`. O total orçado de um item é sempre `I = (preço unitário com BDI) × quantidade`.

### 2.4 BDI / encargos / leis sociais

- **Não há planilha de composição de BDI/encargos.** O dono condensa tudo em **um único fator `J7 = 1.06`** (markup de 6%) aplicado linha a linha (`$J$7 * custo`). É o "gerenciamento/administração honesto" — a margem do executor sobre o custo.
- **Leis sociais / encargos da MO não estão separados** nesta planilha (estão embutidos no valor de MO que ele digita em M, ou no fator). Não há colunas de "encargos %", "leis sociais", "ISS".
- Implicação: o nosso modelo deve suportar **BDI como fator** (simples, como o dono faz), mas permitir **composição de BDI por componentes** (administração, lucro, riscos, tributos, encargos) quando a obra exigir — sem obrigar.

### 2.5 Agrupamentos / subtotais / hierarquia (3 níveis)

```
NÍVEL 1 — AMBIENTE (linha de seção + subtotal)
   ex. "GARAGEM COBERTA - Área: 17 m² | Perímetro interno: 18 m.l"
   subtotal: I = SUM(I15:I53)   |   O = SUM(O15:O53)

   NÍVEL 2 — DISCIPLINA / FRENTE (linha de título, sem valor)
      ex. "CIVIL", "ELÉTRICA - ILUMINAÇÃO", "PINTURA"

      NÍVEL 3 — ITEM (linha com código + descrição + quant + custos)
         ex. A=GC.01  B="Fornecimento de material e MO para…"  C=17  D=m²  …

TOTAL GERAL (linha 832):
   I (orçado) = SUM dos subtotais de cada ambiente  = R$ 343.244,47   (COM BDI 1.06)
   O (custo)  = SUM dos subtotais de cada ambiente  = R$ 329.815,54   (SEM BDI)
```

- A planilha tem **~21 ambientes**: SERVIÇOS INICIAIS (canteiro/ART/mobilização), GARAGEM COBERTA, QUINTAL FRENTE E JARDIM, CORREDOR, SALA, DORM BEBÊ, HOME OFFICE, BANHO 01, HOME OFFICE 2, DORM 1, BANHO DORM 1, COZINHA, ÁREA SERVIÇO DESCOBERTA, SALA DE JANTAR, LAVANDERIA, SUÍTE DORM 03, DORM 03 (entre outros).
- Cada ambiente repete o **mesmo conjunto de disciplinas** (uma EAP-matriz ambiente × disciplina — idêntico em espírito à planilha de gestão do Consulado, que era disciplina × andar).
- O **subtotal por ambiente** é a base natural da **medição** e do **faturamento por frente**.
- Cada **ambiente carrega metadados físicos no título**: `Área: 17 m²`, `Perímetro interno: 18 m.linear` — base do levantamento de quantidades.

---

## 3. Como a planilha vira ESCOPO (e alimenta memorial/proposta/contrato)

- **A planilha É o escopo.** Cada **linha de item** descrita (col B: *"Fornecimento de material e mão de obra para…"*) é um item **dentro do escopo**. Regra do dono: **"se está ali, está no escopo; se não está, não está (é aditivo)."**
- **O que marca um item como "no escopo":** existir na lista **com quantidade > 0**. Itens com **C (quant) vazia ou 0** (ex.: várias linhas `GC.E3…GC.E12`, `GC.L1`) **não entram no total** (I = H×0 = 0) — são o **catálogo de possibilidades não contratadas** (placeholders prontos para virar aditivo se o cliente pedir). Isso é poderoso: **o catálogo de disciplina já vem pré-listado por ambiente; o que tem quantidade está contratado, o que está zerado é aditivo em potencial.**
- **Herança para os outros artefatos (o "mesmo fio"):**
  - **Memorial descritivo** = a coluna **B (descrição)** de cada item já é o parágrafo de memorial (padrão "fornecimento de material e MO para…").
  - **Proposta comercial / orçamento** = a coluna **I (total orçado)** e os **subtotais por ambiente**.
  - **Contrato** = a **lista de itens com quantidade** define o objeto/anexo; o **total orçado** define o valor; itens zerados ficam fora (aditivo).
  - **Cronograma** = as **disciplinas** viram **RESPONSÁVEL** e **atividade** (aba CRONOGRAMA usa CIVIL, ELÉTRICA, HIDRÁULICA, GESSO, PINTURA… como responsável), na mesma ordem de fases.

---

## 4. A aba CRONOGRAMA (confirma o "mesmo fio")

| Col | Cabeçalho | Conteúdo |
|-----|-----------|----------|
| B | `ITEM` | Fase/agrupamento, ex. "CONTRATO DE FORNECEDORES" |
| C | `ATIVIDADE` | Texto da atividade ("Remoção de acabamentos antigos…", "Execução dos forros de gesso…") |
| D | `QUANT / DIA` | duração em dias |
| E | `DATA INÍCIO` | data |
| F | `DATA TÉRMINO` | data |
| G | `AVANÇO % / RESPONSÁVEL` | % de avanço **e** a disciplina responsável (NICE, CIVIL, ELÉTRICISTA, HVAC, GESSEIRO, PINTOR, EXTERNO…) |
| I…KV | *(datas, 1/coluna)* | grade diária da barra de Gantt (`=célula_anterior+1`) |

- O **RESPONSÁVEL é a disciplina** — exatamente a mesma taxonomia das frentes do orçamento. **Orçamento e cronograma falam a mesma língua de disciplina.**
- A sequência de atividades é o **fluxo de fases** (levantamento → mobilização → demolição → elétrica/hidráulica → contrapiso → revestimento → esquadrias → gesso → pintura → luminárias → marcenaria → limpeza → entrega) — o template de cronograma da reforma.
- **Gap óbvio na planilha dele:** o cronograma é **textual** (atividade digitada à mão), **não está ligado por fórmula aos itens do orçamento**. As datas existem, mas o **peso/avanço não puxa do orçamento**. É exatamente o que o nosso modelo unificado resolve (peso vem do total orçado do item).

---

## 5. Mapeamento para o NOSSO modelo + GAP

### 5.1 O "item de escopo" unificado — campos que ele precisa ter

Da planilha do dono, o **dado-mãe** (item de escopo) precisa de:

| Campo (nosso) | Vem da planilha (col) | Já temos? Onde |
|---------------|------------------------|----------------|
| `ambiente` (entidade/seção) | seção/subtotal (ex. "COZINHA - Área 14 m²") | **GAP** — hoje só `area_label`/`area_codigo` TEXT em `hub_obra_itens` (E2). Não é entidade nem nível de EAP. |
| `area_m2`, `perimetro_ml` (metadados do ambiente) | título do ambiente | **GAP** — não modelado. |
| `disciplina_slug` / frente | título "CIVIL", "ELÉTRICA"… | ✅ `hub_obra_frentes_eap` + `hub_catalogo` (E0) + `hub_obra_taxonomia` (E0.5) |
| `codigo` do item | col A (`GC.E1`) | ✅ `hub_obra_itens.codigo` / `hub_obra_orcamento_itens` |
| `descricao` (memorial) | col B | ✅ `descricao` (itens e orçamento_itens) + `descricao_padrao` na taxonomia |
| `quantidade` | col C | ✅ `quantidade` (ambas) |
| `unidade` | col D | ✅ `unidade` (ambas) |
| `custo_locacao_frete` | col K | **GAP** — E6 tem `custo_material`, `custo_mao_obra`, `custo_outros`; "locação/frete" cabe em `custo_outros` mas **não é nomeado** (perde semântica de equipamento/frete). |
| `custo_material` | col L | ✅ `hub_obra_orcamento_itens.custo_material` |
| `custo_mao_obra` | col M | ✅ `hub_obra_orcamento_itens.custo_mao_obra` |
| `custo_unitario` (= K+L+M) | col N (`SUM`) | **derivável** (não há coluna; é soma dos 3 custos) |
| `bdi_fator` / `bdi_pct` | célula J7 (1.06) | **GAP** — E6 tem `spread_pct` por item e `margem_pct`, mas **não um fator BDI global** da obra/orçamento. `spread_pct` ≈ markup por item; falta o "1.06 global". |
| `valor_unitario` (preço, c/ BDI) | col H (`$J$7×N`) | ✅ `valor_unitario` em `hub_obra_orcamento_itens` (mas hoje é digitado, não calculado de custo×BDI) |
| `valor_total` (= preço × quant) | col I (`H×C`) | ✅ `valor_total` GENERATED (`quantidade×valor_unitario`) em E6 |
| `custo_total` (= custo unit × quant) | col O (`N×C`) | **GAP** — E6 guarda custos unitários, mas **não materializa o custo total** lado a lado com o preço (a planilha mostra os dois: O e I). |
| `peso` (físico/financeiro) | derivável do total | ✅ `peso` em itens e `peso_fisico`/`peso_financeiro` em frentes (mas hoje não auto-calcula do total orçado) |
| `no_escopo` (flag) | quantidade > 0 vs item zerado | **GAP semântico** — não há flag "no escopo / aditivo em potencial". Hoje `ativo` oculta; precisamos de **`status_escopo`** (contratado / aditivo / não-contratado). |
| `responsavel` (disciplina) | cronograma col G | ✅ `responsavel_nome`/`responsavel_id` em `hub_obra_itens` |
| `data_inicio` / `data_termino` / `pct_avanco` | cronograma E/F/G | ✅ já em `hub_obra_itens` (E2) |

### 5.2 O GAP de ARQUITETURA (o mais importante)

1. **AMBIENTE não é cidadão de primeira classe.** A planilha do dono organiza **tudo por ambiente** (é o nível 1, o que vira subtotal e medição). No nosso schema, a EAP (`hub_obra_frentes_eap`) é por **disciplina**, e ambiente é só `area_label`/`area_codigo` em texto solto no item. **Precisamos elevar AMBIENTE a um nível da EAP** — seja como `parent` na árvore `hub_obra_frentes_eap` (a tabela já tem `parent_id` e a EAP-taxonomia E0.5 prevê `segmento→ambiente→disciplina→atividade`), seja como tabela `hub_obra_ambientes`. A planilha é **ambiente → disciplina**, não disciplina pura. **Sem isto, não há subtotal por ambiente nem medição por cômodo.**

2. **ORÇAMENTO (E6) e ITENS/EAP (E2/E0) são tabelas PARALELAS — a planilha prova que é UMA coisa.** Hoje:
   - `hub_obra_itens` (E2) = item de obra (gestão/avanço) com `valor_contrato`, sem decomposição material/MO.
   - `hub_obra_orcamento_itens` (E6) = item de orçamento com custo material/MO/spread, ligado por `item_id` opcional.
   A planilha do dono **não tem essa divisão**: a MESMA linha tem descrição, quantidade, **custo material+MO**, **preço com BDI**, **total**, e (via disciplina) vira atividade no cronograma. **Recomendação:** o **item de escopo é um só registro** que carrega (a) decomposição de custo material/MO/locação, (b) BDI, (c) preço/total, (d) peso, (e) avanço/datas/responsável. O E6 não deveria ser uma *cópia* do item — deveria ser a **camada de custo/preço do mesmo item de escopo** (ou uma 1:1 forte, não um `item_id` nullable frouxo).

3. **BDI global da obra/orçamento ausente.** O dono usa **um fator único (`1.06`)**. Temos `spread_pct`/`margem_pct` por item, mas falta o **parâmetro de BDI da obra** (com default e override por item). **Adicionar `bdi_fator`/`bdi_pct`** em `hub_obras` (ou `hub_obra_orcamentos`) e fazer o preço = custo × BDI por padrão (igual à fórmula `$J$7`).

4. **Custo e preço lado a lado (transparência auditável).** A planilha mostra **as duas zonas** (custo O e orçado I). É a base da **engenharia auditorial / escrow honesto** (o Hub vê custo e markup). Nosso E6 tem os custos, mas **não materializa o custo total** ao lado do preço total. **Materializar `custo_total` (GENERATED) ao lado de `valor_total`** dá ao Hub a visão custo×preço×margem por item, exatamente como a planilha.

5. **Status de escopo (contratado × aditivo × não-contratado).** A planilha codifica isso por **quantidade 0 vs >0**, com o **catálogo de disciplina já pré-listado por ambiente**. **Adicionar `status_escopo`** (e usar a taxonomia E0.5 para pré-popular itens zerados como "aditivo em potencial") realiza o "se está ali, está; se não, é aditivo" de forma explícita e curável (mata a discussão de escopo + cura o medo de ser enganado).

### 5.3 Convergência (o alvo)

```
EAP-taxonomia (E0.5)         SEGMENTO → AMBIENTE → DISCIPLINA → ATIVIDADE(item)
                                          │            │            │
hub_obra_frentes_eap   ◄── ambiente é parent ─┘            │            │
(árvore, parent_id)        disciplina é nó ────────────────┘            │
                                                                        │
hub_obra_itens (=ITEM DE ESCOPO, dado-mãe) ◄────────────────────────────┘
   ├── custo: locação/frete + material + MO   (cols K,L,M)
   ├── bdi_fator (default da obra; override item)   (J7)
   ├── preço unit. = custo × bdi    +    total = preço × quant   (H, I)
   ├── peso (auto do total)   →   Curva S / E4 pendura AQUI
   ├── status_escopo (contratado/aditivo)   →   contrato + memorial herdam
   └── datas + responsável(disciplina) + avanço   →   CRONOGRAMA é projeção, não tabela paralela
            │
hub_obra_orcamentos / _itens (E6)  =  CAMADA de custo/preço/versão do MESMO item (1:1), não cópia
hub_obra_pagamentos (E6)           =  medição por item/ambiente (já existe; ligar ao peso)
```

**Princípio:** **um único "item de escopo"** projeta linha de orçamento, parágrafo de memorial, cláusula de contrato, barra de cronograma (peso), frente de medição, requisição de compra (quantidade) e tarefa. **Não construir E4/Orçamento-IA/memorial/proposta/contrato isolados** — todos penduram no mesmo item, sobre a EAP-taxonomia (E0.5) com **ambiente como nível**.

---

## 6. Onde está o dump bruto

- Planilha original: `…/scratchpad/orcamento-dono.xlsx` (temporária da sessão).
- Scripts de dump: `…/scratchpad/dump_orcamento.py`, `dump2.py`, `dump3.py`.
- Os trechos-chave (cabeçalho, fórmulas, lista de ambientes/disciplinas, total geral) estão reproduzidos acima nas §2–§4.

---

## 7. Pendências derivadas (para a mesa redonda do Orçamento IA + E4)

1. Elevar **AMBIENTE** a nível da EAP (parent na árvore de frentes **ou** `hub_obra_ambientes`), com `area_m2`/`perimetro_ml`.
2. Unificar **item de obra (E2)** e **item de orçamento (E6)** num **único item de escopo** (ou 1:1 forte), com custo material/MO/locação-frete + BDI + preço + total + custo_total materializado.
3. Adicionar **`bdi_fator`/`bdi_pct`** (obra/orçamento) com override por item — espelhar o `$J$7`.
4. Adicionar **`status_escopo`** (contratado/aditivo/não-contratado) e pré-popular itens zerados via taxonomia E0.5 (catálogo de aditivo em potencial por ambiente×disciplina).
5. Fazer o **peso** auto-calcular do total orçado e a **Curva S/E4** pendurar no item de escopo (não tabela paralela).
6. Fazer o **cronograma** ser projeção do item (responsável=disciplina, datas, avanço) — não lista textual desconectada como na planilha do dono.
