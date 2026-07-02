# 🧭 Mapa de Necessidades Sistêmicas — planilha real de obra (Consulado Itália)

> Gerado 01/jul (noite) por mesa-redonda de 4 lentes (Execução/EAP · Suprimentos · Financeiro · Produto-UX) sobre o DUMP das 20 abas. Terreno pra ler a auditoria do dono + desenhar o produto. VIVO.

---

# 🧭 Mapa de Necessidades Sistêmicas — planilha real de obra

> **Fonte:** planilha operacional real do dono (contrato `P2K26.100.06.00.REF CGI` — Consulado Geral da Itália, gestor Wendel Cruz), lida por 4 lentes (Engenharia/AEC, Suprimentos, Financeiro, Produto/UX) sobre 13 abas.
> **Propósito:** terreno consolidado para ler a auditoria do dono e desenhar o produto. A planilha **não é um modelo a copiar** — é o retrato honesto da dor: uma **fonte-única com lentes**, movida por **fórmulas frágeis** que já quebram (#REF!, coerção de data, códigos duplicados). Nosso trabalho é preservar os **padrões de ouro** e trocar as fórmulas por **eventos/triggers auditados**.

---

## 1. Resumo executivo — o que a planilha ensina

- **A planilha JÁ é "fonte única + lentes por papel".** `Fornecedores` não é cadastro: C/D/F são `ARRAYFORMULA` que fazem lookup em `Pessoas` (é uma lente do subconjunto PJ/PF). `🏠 Hoje` e `📊 Dashboard` são 100% VIEWS read-only sobre `Gestao`/`Detalhamento` ("não digite nele"). O modelo-alvo (Hub + verticais sobre uma coluna) **confirma-se no dado real**.

- **Padrão de ouro nº 1 — dois status independentes.** `Situação` (Gestao!F) é **AUTOMÁTICA por prazo** (`IF(E<TODAY(),'Atrasado'...)`) e nunca é gravada; `Andamento` (Gestao!G) é **MANUAL**, declarado por humano. O KPI "Finalizados" conta **G**, nunca a situação nem `H>=100`. Devemos desdobrar em `status_prazo` (derivado) + `status_execucao` (manual) — jamais colapsar num campo só.

- **A espinha AEC é de 3 níveis amarrados por código.** `Gestao` = item de contrato (164 itens+aditivos, lente-resumo) → `Detalhamento` = EAP fina (321 subitens `X.Y.N`, a tela de trabalho e **fonte real das datas**) → `Executiva` = orçamento codificado por ambiente×disciplina (`HAC8.01` / `COD_LEGIVEL 08.HALL.DEM.01`). **O código é a chave** que fecha o ciclo orçamento→execução→medição→pagamento.

- **Tudo cascateia por fórmula frágil — e já está quebrando.** `Situação` deriva das datas; bloqueios sobem por `COUNTIFS` subitem→item; estoque cai sozinho quando Status='Entregue'. Mas: `Orcamentos!O6=SUM(#REF!)=0` (MO de empreiteiros some do total), `Fornecedores!D5=COUNTIF(#REF!)`, `Executiva!B` coage `'5.28'`→`datetime(2026,3,2)` quebrando o cross-ref, e códigos `A` duplicam (`HAE8.03` 2×, item `'12'` 2×). É exatamente a fragilidade que o dono pediu para eliminar.

- **O átomo de execução é o SUBITEM/SERVIÇO.** Cada item de contrato explode em N etapas ordenadas reutilizáveis (item 2.2 "Demolição controlada" = 8 subitens 2.2.1→2.2.8; 2.3 e 2.5 "Caçamba 4m³" compartilham as MESMAS 5 sub-etapas). Custo, medição, pagamento, restrição, pessoa e compra **todos penduram no subitem**.

- **A camada AEC E0–E7 já foi desenhada e espelha a planilha quase 1:1 — mas NÃO está aplicada.** As migrações existem no repo (`hub_obra_itens`, `hub_obra_frentes_eap`, `hub_obra_restricoes`, `hub_pedido_itens`/`hub_estoque_mov`, `hub_obra_medicoes`) porém o banco vivo só tem `hub_obras` + `hub_obras_cronograma` + `hub_pedidos_material` (flat). A UI degrada com `migracao_pendente=true`. **Aplicar E0–E7 na janela do dono é o passo 1.**

- **O ouro preditivo (o moat) ainda não existe nem na planilha.** Cobertura orçamentária = **4,2%** (42/996), 57 atrasados no dia 1, consolidações financeiras com #REF! — sinais de que o dado mais valioso (custo previsto×real e avanço por fornecedor/frente) precisa ser **capturado por serviço** para alimentar o preditivo.

- **Duas naturezas de "fornecedor" e uma tabela de LOTAÇÃO faltando.** `hub_fornecedores` nasceu como espelho do motor de leads (rede), mas a planilha usa fornecedor como **executor de frente**. E o grão real de `Pessoas` é "uma linha por pessoa **em cada item**" (lotação pessoa×item×obra) — que hoje não tem tabela.

---

## 2. Modelo de dados consolidado

> Regra-mãe: **o SERVIÇO (subitem da EAP) é o átomo**. Escopo, custo, compra, medição, pagamento, restrição e pessoa são todos **arestas que apontam para o serviço**. O `codigo` estruturado (ambiente.disciplina.seq) é a chave de junção transversal.

### 2.1 Entidades-núcleo (ancoradas no serviço)

| Entidade (nosso modelo) | Aba-fonte | Grão | Campos essenciais (nomes reais → alvo) | Ancoragem ao serviço |
|---|---|---|---|---|
| **Obra / Projeto** | (cabeçalho) | 1 por contrato | contrato `P2K26...`, cliente, gestor, início/fim | raiz |
| **Frente / EAP-disciplina** (`hub_obra_frentes_eap`, E0) | `Dashboard`/`Detalhamento!G` | 1 por disciplina×zona | `Segmento` (Civil, Elétrica, Pintura, Forro…), ambiente/andar, %avanço | agrupa serviços |
| **Item de contrato** (`hub_obra_itens`, `parent_id=NULL`, E2) | `Gestao` | 164 linhas | A=`Item` (WBS), B=`Atividade`, C=`Andar/Área`, D/E=Início/Término, F=Situação(auto), G=Andamento(manual), H=%Avanço, I–M=5 bloqueios, O=Tipo | pai do serviço |
| **⭐ Serviço / Subitem** (`hub_obra_itens`, `parent_id≠NULL`, E2) | `Detalhamento` | **321 linhas** | A=Item(FK), B=`Subitem`(`X.Y.N`), D=Descrição da etapa, E/F=Início/Término (**fonte real**), G=Segmento/disciplina, H=Status, I=Pessoa Resp., J–N=5 bloqueios OK?, O=%Avanço | **o átomo** |
| **Linha de orçamento** (`hub_obra_orcamento_itens` — **a criar**) | `Executiva` | ~416 linhas | A=`CÓDIGO` (`HAC8.01`), B=Item contrato (cross-ref), C=Descrição, D=Quant, E=Unidade, F=Locações/Frete, G=Material, H=MO, I=MAT+MO, J=Total, K7=fator/BDI, L–P=bloco real, Q=`COD_LEGIVEL` | 1..N por serviço (via código) |
| **Pedido/SC** (`hub_pedidos_material`+`hub_pedido_itens`, E5) | `SC` | 1 linha=1 lançamento | A=Item da obra(FK EAP), C=Data entrega, D=Material, E=Categoria, F=Unidade, G=Tipo(Entrada/Saída/Devolução), H=Qtd, I=Origem, J=Valor unit, K=Fornecedor, L=Status | consome/abastece serviço |
| **Movimento de estoque** (`hub_estoque_mov` append-only, E5) | `SC`(deriva) | 1 por movimento | tipo(entrada/saída/devolução/**ajuste**), qtd, catalogo_id, obra_id | por material |
| **Inventário** (`vw_hub_inventario`, E5 — **view**) | `Inventario` | 1 por material | Total Entregue, Saídas, Devoluções, **No Estoque=MAX(0,C−D+E)**, %Estoque, Alerta | derivado |
| **Catálogo** (`hub_catalogo`, E0) | `Catalogo` | 527 itens | nome canônico por categoria (Material/Ferramenta/Equipamento/EPI/EPC) | dedup de material/insumo |
| **Medição / Pagamento** (`hub_obra_medicoes`, E7 — **a aplicar**) | `Pagamentos` | ledger único | A=Tipo, B=Beneficiário, C=Item obra, E=Nº Medição, G=Qtd, H=Valor unit, J=%Avanço, K/L=Retenção, M=Descontos, N=Valor a Pagar, O=Data Prevista, R=Status, S=Data Pgto, T=Comprovante, U=Aprovado por | medição por serviço |
| **Restrição / Bloqueio** (`hub_obra_restricoes`, E3) | `Detalhamento!J–N` | 1ª classe | tipo(falta_pessoa/documento/material/ferramenta/equipamento), impacto, prazo, alerta | trava o serviço |
| **Pessoa** (`hub_pessoas` — CRM) | `Pessoas` | 1 por pessoa | Nome, CPF/CNPJ, Telefone, Função/ofício | quem executa |
| **⭐ Lotação pessoa×item** (**a criar**) | `Pessoas` (grão "1 linha por pessoa **em cada item**") | N:N | pessoa_id, item_id/serviço, função, **Status Docs (liberação)**, anexos | aloca pessoa ao serviço |
| **Fornecedor** (`hub_fornecedores`) | `Fornecedores` | lente de Pessoas PJ/PF | Especialidade, Status Docs; (rede: status_financeiro, comissao_pct, mercados) | executa frente / recebe medição |
| **Contrato / Escrow** (`financeiro_contrato_escrow`, E6) | (Pagamentos+regra) | por obra | modelo (preço-fechado×administração), escrow 2 autoridades (arq+Hub) | libera pagamento do serviço |
| **Evento** (`hub_eventos`) | (todas) | keystone | ator, tipo, payload, timestamp | trilha de auditoria de tudo |

### 2.2 Mapa de relações (amarrado ao serviço)

```
Obra 1──N Frente/EAP 1──N Item de contrato 1──N ⭐SERVIÇO(subitem)
                                                      │
   ┌──────────────────────────────────────────────────┼───────────────────────────────┐
   │                        │                          │                │               │
Orçamento-linha        Restrição               Medição/Pagamento    Lotação          Pedido/SC
(frete/mat/MO,         (falta_*: pessoa/        (qtd×unit×%avanço    (pessoa×item,    (item→material)
 orçado×real, BDI)      doc/mat/fer/eqp)         −retenção; gate)     Status Docs)         │
   │                        ▲                          │                │           Movimento estoque
   │  cobertura 🟢/🔴        │ (falta material dispara) │                │            (append-only)
   └──── Compatibilização ──┘                     Escrow (arq+Hub)   Pessoa/          │
        (escopo×EAP×orçamento×avanço)                                Fornecedor    Inventário (view)
                                                                                        │
   Catálogo ─── normaliza nomes de ── Pedido/SC + Movimento + Inventário          Reorder point
   ────────────────────────── hub_eventos audita CADA transição ──────────────────────────────
```

**Chave de junção transversal:** o `codigo` estruturado — `A` = `[Ambiente 2L][Disciplina 1L][Andar][.Seq]` (ex. `HAD8.01` = Hall·Demolição·8º·01) e `Q` = `[Andar 2dig].[Ambiente].[Disc 3L].[Seq]` (`08.HALL.DEM.01`). É o que amarra Executiva↔Gestao↔Detalhamento↔medição. **No sistema, o código é GERADO server-side** (não digitado, eliminando duplicidade e coerção-data de `Executiva!B`).

---

## 3. Fluxos e cascatas — de fórmula frágil a evento/trigger auditado

> Cada cascata da planilha hoje é uma **fórmula** que roda no cliente e quebra em silêncio. No sistema, vira **evento/trigger sobre `hub_eventos`** (idempotente, auditado, com ator e timestamp).

| # | Cascata na planilha (fórmula real) | Fragilidade hoje | Vira no sistema |
|---|---|---|---|
| **C1** | **Situação** `F=IF(OR(D='',E=''),'Sem data',IF(E<TODAY(),'Atrasado',IF(D>TODAY(),'A iniciar','Em andamento')))` | recalcula no cliente; nunca gravada | **`status_prazo` derivado em view** (`vw_hub_obra_itens_situacao`), nunca persistido; separado do `status_execucao` manual |
| **C2** | **Rollup de bloqueios** item←subitem `COUNTIFS(Detalhamento!J='Pendente')>0 → 'Pendente'` (Pessoa/Docs/Mat/Fer/Eqp) | qualquer subitem contamina o item; booleano solto | **`hub_obra_restricoes` (1ª classe)** com impacto/prazo; trigger de rollup + evento `restricao.aberta` |
| **C3** | **Autonumeração** `B=$A&'.'&COUNTIF($A$9:$A,$A)` (`X.Y.N` cumulativo) | cliente-side; recontagem instável | **gerador de código server-side** (`hub_obra_codigo_contador`, E0), transacional |
| **C4** | **SC→Inventário**: `Status='Entregue'` em `Tipo='Entrada'` → `SUMIFS` alimenta estoque | dupla digitação evitada, mas fórmula frágil | **RPC `hub_sc_registrar_entrega`** (idempotente) grava `hub_estoque_mov` + evento `entrega.registrada` |
| **C5** | **Sinal do movimento** `Tipo`: Entrada `+`, Saída `−`, Devolução `+` | chaves ocultas AA/AB/AC concatenam `Material\|Tipo\|Origem` | `hub_estoque_mov.tipo` tipado + `catalogo_id` (sem string concatenada) |
| **C6** | **No Estoque** `F=MAX(0, Entregue−Saídas+Devoluções)` — trava em zero | `%Estoque=F/Total Entregue` (denominador cai ao consumir) | **`vw_hub_inventario`** (Entrada−Saída+Devolução+Ajuste, GROUP BY obra/catalogo_id) — **⚠ decidir clamp-em-zero** (§7) |
| **C7** | **Alerta estoque** `H=IF(F/C<=10%,'COMPRAR JA',IF(<=30%,'Comprar em breve','OK'))` | limiar 10%/30% sem "casa"; sem estoque mínimo | **reorder point** por item (estoque mínimo/ideal) → evento `estoque.reposicao` → SC automática |
| **C8** | **Valor a Pagar** `N=I*IF(J>1,J/100,J)−retenção(L)−descontos(M)`, com `I=IF(Tipo='Medição',G*H,0)` | sem trava medido≤contratado; retenção sem liberação | **medição append-only** ligada ao serviço; `N` computado; **gate medido≤contratado** + liberação de retenção |
| **C9** | **Aging** KPIs por Status×Data Prevista: `C6=SUMIFS(N,R,'A pagar')`, `G6=SUMPRODUCT((R='A pagar')*(O>=TODAY())*(O<=TODAY()+7)*N)`, `I6` atrasado, `L6` pago | referências deslocam; #REF! | **view de aging nativa** (a pagar / vencendo 7d / atrasado / pago no mês) |
| **C10** | **Gate de aprovação** `Status(R)='Aprovado'` + `Aprovado por(U)` libera pagamento | mora em `Pagamentos`, **não** em `Orcamentos` (doc superestimou) | **escrow 2 autoridades (arq+Hub)** com `aprovado_por`+`aprovado_em`+comprovante; Hub é juiz |
| **C11** | **Compatibilização** `F=IF(E>0,'🟢 Orçado','🔴 Sem orçamento')`, `E=COUNT(Executiva!B=item)` | 100% QUERY derivada; hoje 4,2% cobertura | **view/trigger de cobertura** (escopo Gestao × EAP Detalhamento × orçamento Executiva × avanço) + alerta "executando sem orçar" |
| **C12** | **Consolidação financeira 4 fontes** `N10=SUM(O6:O9)`; MO Fornecedores, SC Materiais, SC Fer/Eqp, Manuais | **QUEBRADA**: `O6/P6/Q6=SUM(#REF!)=0`, `Q9=SUMIFS(#REF!)`, abas renomeadas | **view financeira consolidada append-only** por **joins reais** (sem #REF!) |
| **C13** | **Categoria→Material** (SC) e **AUX_Pessoas** `SORT(UNIQUE(FILTER(...)))` para dropdowns | INDIRECT/named-range frágil | **Click-and-Go server-side** (catálogo LONG filtra por categoria; validação de lista) |
| **C14** | **Dashboard por disciplina** `B=COUNTIF(Detalhamento!G,A)`, `C=AVERAGEIF(...,O)`, bloqueios `COUNTIF(J:J,'Não')`, compras `SUMPRODUCT(SC!H*SC!J)` | produto final da cadeia; sem E0–E7 não há de onde agregar | **endpoint/view por obra E por papel** sobre E0/E2/E3/E5/E7 + `hub_eventos` |

---

## 4. Papéis / lentes — fonte única, recortes por papel

> Mesma obra, **uma fonte**, recortes diferentes. Confirma a diretriz "fonte única, lentes por papel" e a cura dos 5 medos do cliente.

| Papel | O que VÊ (lente) | O que NÃO vê | Ação/escrita |
|---|---|---|---|
| **Arquiteto** | escopo, EAP, aprovação de medição (1ª autoridade do escrow) | custo interno detalhado do prestador | aprova medição/avanço (arq+Hub) |
| **Engenheiro / gestor de obra** | **lente completa**: Gestao (Início/Término, Andamento, Obs), Detalhamento, orçamento previsto×real, desvio (H/I) | — | edita datas, orça (Previsto/Real), lança medição+%avanço |
| **Mestre / encarregado (campo)** | Detalhamento: Status, %Avanço, bloqueios J–N, Pessoa Resp. (mobile/Talk-and-Go) | custo, financeiro | marca avanço, bloqueios, atribui pessoa |
| **Prestador / fornecedor-executor** | **só sua frente/disciplina** (Segmento G): escopo, cronograma, medição e pagamento **dele** | outras frentes, custo interno da obra, SC crua | confirma execução da própria frente |
| **Comprador / almoxarife** | SC (funil Pendente→Comprada→Entregue), "Total a Comprar", Inventário ("COMPRAR JA"/"Comprar em breve") | orçamento de MO, medições | lança SC, move Status, dispara Saídas |
| **Financeiro** | consolidado Previsto/Real/Pago/Saldo, aging (a pagar/vencendo/atrasado), quem aprovou (U) | — | paga (S+comprovante T), puxa contas a pagar |
| **Segurança do Trabalho (SESMT)** | liberação de pessoas (Status Docs = Liberado/Pendente), EPI/EPC do Catálogo, checklist NR-18/NR-35 | financeiro | valida docs → libera acesso ao canteiro |
| **Cliente (portal / Consulado)** | macro: "Avanço da obra" (N5), % por item, marcos, selo "material entregue", **valor de contrato fechado** | subitem, custo interno MO/Material, SC crua, movimentação | consulta (cura: atrasar / não-saber / ser-enganado) |
| **Hub** | agrega N obras (mesa/dashboards cross-conta), **audita quem aprovou** (juiz do escrow) | — | 2ª autoridade do escrow; curadoria do catálogo global |
| **IA-campo / Copiloto** | "o que decidir hoje" (fila de `🏠 Hoje` por papel), gera etapas-padrão | — | auto-executa trivial, recomenda ação, gera subitens/orçamento |

**Padrão a preservar:** o `cliente` bifurca por **modelo de contrato** — em preço-fechado só vê preço; em administração vê custo aberto (cura "ser enganado").

---

## 5. Insumos do preditivo — o moat

> O preditivo nasce de **cruzar** dados que a planilha guarda em silos. Cada linha vira um datapoint reutilizável **apenas se o Catálogo/EAP normalizarem os nomes** (nome livre polui as séries).

| Previsão (saída) | Dados cruzados (entrada real) | Fonte |
|---|---|---|
| **Custo de obra nova (o moat central)** | `Quant × Unidade × custo(Locações/Material/MO)` por `(ambiente, disciplina)` → composição de custo unitário ("porcelanato 90×90 = R$/m²", "demolição alvenaria = R$/m²", "forro mineral preto = R$/m²") | `Executiva` (código `HAD8.01`, `COD_LEGIVEL`) |
| **Estouro de orçamento (EAC / burn-rate)** | `Previsto(F) × Real(G)` por item/categoria/fornecedor, `%vs Previsto(I)`, consolidação Previsto/Real/Pago/Saldo | `Orcamentos` |
| **Lead time por fornecedor + alerta de atraso** | `Data(B)` vs `Data para entrega(C)` vs entrega real (Status=Entregue) por Fornecedor(K) | `SC` |
| **Ruptura de estoque / compra antecipada** | `%Estoque` + faixas 10%/30% (reorder point); taxa de Saídas no tempo; janela "próximos 15 dias" | `Inventario` + `🏠 Hoje` |
| **Produtividade por ofício (benchmark)** | `Segmento(disciplina) × andar × duração planejada × real` ("quanto rende demolição controlada por m²") | `Detalhamento` |
| **Curva S real + caminho crítico** | Início/Término **finos** por subitem + Status + %Avanço (a Gestao só tem data-macro) | `Detalhamento` |
| **Alerta de parada iminente** | `Restrição (falta material L='Pendente') × Término em ≤3d` → dispara compra urgente / iFood-construção | `Detalhamento!J–N` × datas |
| **Score de fornecedor + matching (marketplace)** | atraso de entrega + atraso de pagamento (`O` prevista vs `S` real) + %avanço da medição por fornecedor | `SC` + `Pagamentos` + `Fornecedores` |
| **Previsão de EAP de obra nova (IA-first)** | **decomposições repetidas** = catálogo de etapas-padrão (2.2/2.7 são templates AEC; 2.3=2.5) | `Detalhamento` |
| **Risco de custo não previsto / aditivo** | itens 🔴 (E=0 sem orçamento) com C>0 e D>0 (executando) → "execução sem cobertura financeira" | `Compatibilizacao` |
| **Fluxo de caixa / capital de giro** | Data Prevista(O) × Status(R) = vencendo 7d/atrasado; retenção acumulada(L) = passivo futuro; "Saldo a Comprar" | `Pagamentos` + `SC` |
| **Dimensionamento de equipe + compliance** | Função × Item (lotação/headcount por frente); histórico de liberação (Status Docs) | `Pessoas` |
| **Checklist de segurança preditivo (NR) por fase** | colunas EPI/EPC do Catálogo × fase da EAP | `Catalogo` × `Detalhamento` |

**Baseline honesto que o preditivo já revela:** 57 atrasados no dia 1 = cronograma irreal; 4,2% de cobertura orçamentária = risco enorme de estouro. Ambos são **insumo**, não erro a esconder.

---

## 6. Gaps vs sistema atual

**Legenda:** ✅ aplicado no banco vivo · 🟡 desenhado mas **NÃO aplicado** (migração no repo, `migracao_pendente=true`) · 🔴 **não existe em lugar nenhum** (a modelar).

| Necessidade (da planilha) | Estado | Detalhe |
|---|---|---|
| Obra + status + datas macro | ✅ | `hub_obras` (status enum 5 valores, data_inicio/previsao_fim) — raso |
| Cronograma por fase | ✅ | `hub_obras_cronograma` (fase, percentual, data_prevista, concluida) — **sem subitem, disciplina, responsável, bloqueios** |
| Pedido de material | ✅ | `hub_pedidos_material` **FLAT** (descricao TEXT livre, status, valor_estimado) — **sem itens, qtd/unidade, fornecedor, data entrega, origem, aprovado_por** |
| Pessoas (CRM comercial) | ✅ | `hub_pessoas` (tipo DEFAULT 'lead'; CHECK só PF/PJ) — **sem Função/ofício, sem lotação, sem liberação** |
| Mão de obra | ✅ | `hub_especialistas` — sem login e **sem vínculo a item/serviço** |
| Fornecedor (rede) | ✅ | `hub_fornecedores` = **espelho do motor de leads** (status_financeiro, comissao_pct, mercados JSONB) — **orientado ao Hub, não ao executor de frente** |
| Aprovações | ✅ | `hub_aprovacoes` existe mas **não executa a cascata de escrow** (UI `/crm/aprovacoes` chama API sem o gate) |
| Eventos (keystone) | ✅ | `hub_eventos` — pronto para virar a trilha de auditoria |
| **Item de contrato + subitem/EAP (2 status + 5 bloqueios)** | 🟡 | `hub_obra_itens` (E2, `20260710120000`): `parent_id`, `situacao_override`+view derivada, `andamento` enum, `falta_pessoa/documento/material/ferramenta/equipamento`, `pct_avanco`, `responsavel_id` — **espelha Gestao+Detalhamento 1:1, não aplicado** |
| **Frente/EAP-disciplina + taxonomia** | 🟡 | `hub_obra_frentes_eap` (E0); taxonomia Item→disciplina (AUX_Segmentos → E0b) |
| **Catálogo mestre** | 🟡🔴 | `hub_catalogo` (E0, `20260705130000`) existe mas **CHECK não aceita `ferramenta`/`epi`/`epc`** (colunas reais!) e **seed traz só ~15 disciplinas + ~20 áreas — os ~500 itens NÃO são semeados**. Impedância WIDE(planilha)→LONG(schema) exige ETL (6 col × 527 linhas) |
| **Restrição de 1ª classe** | 🟡 | `hub_obra_restricoes` (E3): promove bloqueios booleanos a restrição com impacto/prazo/alerta — não aplicado |
| **Compras estruturadas + estoque** | 🟡 | `hub_pedido_itens` (catalogo_id, qtd_pedida/entregue, preco_unit, cotacoes_json) + `hub_estoque_mov` append-only + `vw_hub_inventario` + RPC `hub_sc_registrar_entrega` (E5, `20260720120000`) — não aplicado |
| **Medição/pagamento** | 🟡 | `hub_obra_medicoes` (E7c) — não aplicado |
| **Contrato/escrow** | 🟡 | `financeiro_contrato_escrow` (E6) cobre contrato/escrow — **mas não a planilha orçamentária item-a-item** |
| **Curva S** | 🟡 | E4 desenhado, não aplicado |
| **⭐ Orçamento linha-a-linha (Executiva)** | 🔴 | `hub_obra_orcamento_itens`: composição **Frete/Material/MO + orçado×real + fator K/BDI** + **geração do código** `HAxx`/`COD_LEGIVEL` — **não existe nem no E2** (que tem valor_contrato+quant+unidade, mas não os 3 componentes nem o 2º bloco real) |
| **⭐ Lotação pessoa×item×obra** | 🔴 | grão "uma linha por pessoa em cada item" — sem tabela |
| **⭐ Liberação/compliance + anexos** | 🔴 | Status Docs (Liberado/Pendente) sem enum; **sem storage de docs da pessoa**; corrigir mislabel `J='RG'` (guarda flag, não RG) |
| **⭐ Estoque mínimo/ideal + semáforo** | 🔴 | limiar 10%/30% e "Alerta Estoque" **não têm home** na `vw_hub_inventario` |
| **⭐ Compatibilização (cobertura)** | 🔴 | view/trigger escopo×EAP×orçamento×avanço com alerta "executando sem orçar" — não existe |
| **⭐ Consolidação financeira 4 fontes** | 🔴 | view append-only por joins reais (elimina os `SUM(#REF!)`) — não existe |
| **⭐ Trava medido≤contratado + liberação de retenção** | 🔴 | nenhuma coluna de devolução de retenção; sem trava |
| **⭐ Cockpit `Hoje`/`Dashboard` por papel** | 🔴 | endpoint/view por obra E por papel — depende de E0/E2/E3/E5/E7 aplicados |
| **⭐ Seed de presets de decomposição (etapas-padrão)** | 🔴 | `hub_eap_presets` com as 8 sub-etapas de "demolição controlada" etc. — enabler do IA-first |

**Resumo do gap central:** o banco vivo é raso demais (3 tabelas flat); a camada E0–E7 espelha a planilha **quase 1:1 mas não está aplicada**; e 6 necessidades (orçamento linha-a-linha, lotação, liberação, estoque-mínimo, cobertura, consolidação) **não existem em nenhuma camada**.

---

## 7. Pendências / perguntas para o dono

> Decisões que travam a construção. Cada uma tem um **default proposto** para acelerar caso o dono delegue.

**A. Migração / infraestrutura**
1. **Aplicar E0–E7 na janela do dono?** É o passo 1 (sem isso não há EAP fina, restrição, estoque, medição). Migração em prod = janela do dono. *Default: preparar plano aditivo e aplicar juntos.*
2. **Categorias do catálogo:** adicionar `ferramenta`/`epi`/`epc` ao CHECK de `hub_catalogo`? São **colunas reais** da planilha. *Default: sim.*

**B. Regras de estoque**
3. **Estoque negativo:** a planilha **trava em `MAX(0,…)`**; a `vw_hub_inventario` (E5) **permite negativo** (alerta na UI). Qual comportamento? *Default: permitir negativo com alerta (revela furo de lançamento).*
4. **Denominador do %Estoque:** hoje usa "Total Entregue" (cai ao consumir). Migrar para **estoque-alvo/mínimo por item**? Onde mora o mínimo — obra ou catálogo? *Default: estoque-mínimo por (obra, item).*
5. Adotar o tipo **`ajuste`** de movimento (não existe na planilha)?

**C. Taxonomia AEC**
6. **`Andar/Área` (Gestao!C) mistura** fase ("Preliminares"), zona ("Elevadores") e andar ("Andar 8"). Como normalizar? *Default: separar em fase × zona × andar via `hub_catalogo(area_andar)` + `hub_obra_frentes_eap(disciplina)`.*
7. **Fator K/BDI (`Executiva!K7=1.0`):** único por empresa (memória) ou por item? Onde persistir com rastro? *Default: único por empresa, versionado.*
8. Validar o **seed de presets de decomposição** (etapas-padrão que a IA usará para gerar subitens)?

**D. Financeiro / medição**
9. **Retenção:** % padrão e **regra de liberação** (a planilha calcula mas nunca devolve)?
10. **Escrow 2 autoridades (arq + Hub):** quem são as autoridades **por obra**? Trava **medido≤contratado** é obrigatória? *Default: sim, hard block.*
11. **Modelos de contrato** (preço-fechado × administração): o que o cliente vê em cada um (§4)?

**E. Cadastro / pessoas / fornecedor**
12. **Reconciliar as 2 naturezas de "fornecedor"** (parceiro-da-rede `hub_fornecedores` × executor-de-frente): **uma tabela com papéis** ou duas? *Default: uma entidade, dois papéis (rede/executor).*
13. **Validação forte de CPF/CNPJ** (planilha tem malformados `'427.15.668-44'`, `'64.915-148/0001-39'`) e dedup por documento?
14. **Storage de anexos** de docs de pessoa (liberação/compliance) — onde e com que retenção?

**F. Produto / preditivo**
15. Confirmar que **`🏠 Hoje` vira o Copiloto** ("o que decidir hoje" por papel), não só um relatório?
16. Prioridade de captura do dado preditivo mais valioso (custo previsto×real + avanço por fornecedor) — **é o que nem a planilha tem hoje**.

---

> **Conclusão de arquiteto:** a planilha valida o desenho (fonte-única + lentes, serviço como átomo, 2-status, código-chave) e **prova** que E0–E7 é o caminho certo — mas o valor só aparece quando (1) E0–E7 for **aplicado**, (2) as 6 entidades 🔴 forem **modeladas** (com destaque para o **orçamento linha-a-linha** e a **lotação pessoa×item**), e (3) as **cascatas-fórmula** virarem **eventos/triggers auditados** sobre `hub_eventos`. Só então o cockpit e o preditivo (o moat) têm de onde agregar.