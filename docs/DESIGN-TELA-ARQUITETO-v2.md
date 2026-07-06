<!-- Gerado pela mesa de design da Onda A (workflow onda-a-design-tela-arquiteto, 05/jul/2026).
     4 lentes (produto, financeiro/escrow, analytics, UX) + sintese. Refina docs/DESIGN-TELA-ARQUITETO.md (v1).
     STATUS: DESIGN aprovado para servir de base; CODIGO SEGURADO ate o mapa de destravamento (acoplamento) fechar. -->
---

# DESIGN — TELA DO ARQUITETO v2 (síntese das 4 lentes)

> Refinamento de `docs/DESIGN-TELA-ARQUITETO.md` (03/jul, v1). **Não recomeça** — funde as 4 lentes (produto, financeiro/escrow, analytics, UX) num único spec buildável, resolve os conflitos entre elas e elimina redundância. Travas do produto respeitadas: Click-and-Go, dark verde+dourado (`--obra-*`), delete=arquiva, códigos de identidade escondidos / de documento visíveis, escrow dupla-chave (esta tela expõe a **chave 1 técnica** do arquiteto), arquiteto = fonte do orçamento com gate de disparidade, cura dos 5 medos.
> **Conflitos resolvidos nesta v2** (registrados inline onde ocorrem): ordem das ondas · ordem do stepper de escrow · cor da custódia · reuso de componente · disparidade como gate (não display) · grid da TV · erro por-seção.

---

## 1. PROPÓSITO / JTBD

O arquiteto **não vem ler dashboard — vem destravar dinheiro e trabalho parados**. O job diário é um loop curto: *"o que está esperando por MIM, e resolvo em 1 toque sem digitar?"* (Lente Produto). A v1 montava a tela em torno de 5 superfícies de **leitura**; a v2 inverte: a **fila de decisões do arquiteto** é a espinha, as métricas são o contexto abaixo dela. Ao agir rápido — assinar a chave técnica, aprovar o entregável, aceitar o briefing — ele converte os 5 medos do **cliente** ("ser enganado", "atrasar", "não saber", "não acabar", "perder dinheiro") em fatos auditáveis. A tela é o instrumento dessa conversão, com o Hub como juiz. Financeiro do arquiteto = honorário (receita nº1, pré-obra) + chave 1 do escrow de obra + disparidade de orçamento como gate.

---

## 2. SEÇÕES E CARDS (consolidado — espinha de ação + contexto)

Estrutura em **5 tiers por PESO** (Lente UX substitui a rotulagem alfabética A–E da v1 §2.2, que sugeria peso igual). A antiga "Seção D — Aprovações & Chaves" e a "ação de topo" da v1 se **fundem** no card-mãe (mata a duplicação que existia entre §2.2-linha111 e §2.2-D). A antiga "Seção E — Alertas" **deixa de ser tier próprio** e vira acento (borda-esquerda vermelha + badge) nos cards dos Tiers 1/3 (mata a duplicação "Atrasados" aparecendo em A e em E).

| Tier | Papel | Conteúdo | Peso visual |
|---|---|---|---|
| **0 · Cabeçalho** | temperatura em 1 olhada | título + semáforo 🟢🟡🔴⚪ (§2.5 v1) **pareado com forma/ícone, não só cor** (WCAG 1.4.1, Lente UX) | fino, persistente |
| **1 · CARD-MÃE "O que precisa de você"** | **a espinha — razão de abrir a tela** | fila de decisões acionáveis, 1 CTA Click-and-Go por linha (tabela abaixo) | **hero, maior peso** |
| **2 · Financeiro (tira boarding-pass)** | saldo glanceável | Tijolos · A receber · Em custódia · Aguard. 2ª chave · Saldo escritório — hairline dourado, lida como 1 frase, **nunca total consolidado dos pools** | raso e denso, ~64–72px |
| **3 · Grade operacional** | "o que estou fazendo" | Projetos (fila/aprovação/atrasados/entregues) · Obras vinculadas | **maior área** |
| **4 · Aprovações (rail)** | pendências de terceiros, não-urgentes | entregáveis aguardando outro | estreito |
| **5 · Avisos honestos** | transparência | frases de causa, tracejado | rodapé |

### 2.1 Card-mãe "O que precisa de você" (Tier 1 — a adição central)

Um único card agregador que lista **só o que exige decisão AGORA**. Cabeçalho conta **decisões, não dinheiro** ("3 coisas precisam de você"). Item resolvido **some** (coerente com delete=arquiva — zero lista morta). Cada linha usa **NOME** (cliente/projeto/etapa), nunca código de identidade; OS/medição/proposta/contrato aparecem como etiqueta de rastreio nas linhas de pagamento/honorário.

| # | Linha de ação | CTA | Fonte HOJE | Estado v1 |
|---|---|---|---|---|
| 1 | Chave 1 técnica do escrow aguardando assinatura | **Assinar** → `/crm/aprovacoes` filtrado | `contarChavesEscrowPendentes` — vivo | **REAL** |
| 2 | Entregável/fase aguardando sua aprovação | **Revisar/Aprovar** | `hub_projetos_fases aprovacao_status='enviado'` — vivo (mecanismo) | **REAL** (0 linhas hoje → vazio honesto) |
| 3 | Briefing/projeto novo na fila | **Abrir briefing** | `hub_projetos` na fila — vivo | **REAL** |
| 4 | Disparidade de orçamento acima do limite (você é a FONTE) | **Revisar orçamento** | `vw_hub_obra_compatibilizacao` — existe, dorme até E6 | **degradado honesto** |
| 5 | Honorário atingiu marco / a faturar | **Emitir cobrança** | **sem schema** (D3) | **degradado honesto** |

**Estado-vazio do card-mãe (3 classes distintas — Lentes Produto+Analytics):**
- **"Tudo em dia — nada esperando por você"** em verde (estado BOM do arquiteto, não parede vazia) — quando há projetos mas nada pendente.
- **"Ainda não há projetos — comece por um briefing"** com 1 CTA — tenant novo (§2.6 v1).
- **"sem prazo definido em nenhum projeto"** tracejado — 3ª classe de vazio que a v1 não separava: mecanismo real, **input nunca preenchido** (`proxima_entrega_em` NULL nas 3 linhas reais). Nunca renderizar "Atrasados: 0" — isso mente por omissão.

### 2.2 Anti-poluição por PAPEL (nova — o arquiteto não é comercial)

A v1 protegia contra vazamento de **dado**; faltava proteger o **escopo de papel**. **NÃO entra na tela do arquiteto:** funil de vendas / leads crus (ele recebe briefing já qualificado, nunca lead) · atendimento WhatsApp comercial · comissão/split/assinatura SaaS como número dele · financeiro tenant-wide do Hub (`hub_contas_*`) · métricas de outras personas no card-mãe e no ticker (allowlist por persona).

---

## 3. MODELO DE DADOS — FINANCEIRO DO ARQUITETO

Três eixos, cada um com fonte, estados, ações e o que falta no banco.

### 3.1 Honorário (receita nº1 — **vazio de dados absoluto**, não decisão A/B de reuso)

Lente Financeiro **corrige a v1 §7-D3**: `hub_projetos` (verificado em `a0_arquitetura_projeto.sql:61-82`) não tem nenhum campo de valor/honorário/percentual. `hub_obra_*` é dinheiro do cliente→fornecedor, **nunca receita do arquiteto** — não há o que reusar. Honorário deixa de ser "rodapé opcional" e vira **decisão de dados nº2, depois de D1**.

**Tabelas novas (aditivas) — janela do dono:**
- `hub_projeto_honorarios`: `id, projeto_id, tenant_id, modalidade (fixo/percentual/m2/fase/hora), valor_fixo, percentual, base_ref, valor_m2, valor_hora, valor_total (derivado), status (rascunho→proposto→aceito→cancelado), aceito_em, aceito_por`.
- `hub_projeto_honorario_parcelas`: `id, honorario_id, projeto_id, fase_id (→hub_projetos_fases), tenant_id, titulo, valor, gatilho (fase_aprovada/data/manual), status (previsto→a_receber→recebido / cancelado), vencimento, recebido_em, escrow_status`.

**Estados:** honorário `rascunho→proposto→aceito→[parcelas]→cancelado`; parcela `previsto→a_receber (fase aprovada)→recebido`; `atrasado` sempre **derivado** (a_receber + venc<hoje), nunca coluna (padrão `pagamentoAtrasado`).
**Ações Click-and-Go:** `Definir honorário` (escolher modalidade em chips + confirmar → sistema deriva parcelas) · `Enviar proposta ao cliente` · `Marcar recebida` · `Gerar aditivo` · `Arquivar` (nunca deletar).
**MVP recomendado:** valor fixo + cronograma por FASE, porque `hub_projetos_fases` já existe e já tem `aprovacao_status` — a liberação da parcela reusa um evento que já roda (fase→`aprovado`), zero gatilho novo. `area_m2` também já existe (habilita modalidade por m²).
**SoD (D3-bis, nova):** no honorário o arquiteto é o **recebedor**, não o aprovador — a "chave técnica" da parcela de honorário é a **aceitação do CLIENTE** (ou Hub como juiz), **jamais o arquiteto**. Oposto do escrow de obra.

### 3.2 Chave 1 do escrow de obra (o coração — nova §3.9 no doc)

O que o arquiteto assina: **uma linha de `hub_obra_pagamentos`** via registro `hub_aprovacoes` tipo `pagamento_obra_arq`, capability `escrow:chave_tecnica`. Ele aprova o **mérito técnico** ("executado conforme projeto"), não "o dinheiro". A chave 2 (`pagamento_obra_hub`) aprova o mérito financeiro.

**O gate real (4 camadas, verificado em `validarChaveEscrow` aprovacoes.ts:327-396):** (e) só humano — `INTERNAL_API_KEY`/`ai_agent` nunca assinam · (c) capability `escrow:chave_tecnica` · (d) 2 pessoas físicas distintas (compara `aprovado_por` da chave irmã) · (+) chave sem `pagamento_id` = recusa · liberação só com `rpc_liberar_escrow` retornando ok quando arq E hub aprovados, senão `aprovacao_dupla_incompleta`.

**Card da chave (cura "ser enganado" — mostra as DUAS fechaduras sempre):**
```
Medição 03 · Fornecedor "Marcenaria Silva" · R$ 18.400 (dourado)
🔑 Chave Técnica (você) ● pendente    🔒 Chave Hub ○ aguardando
ⓘ Assinar sua chave NÃO paga. O dinheiro só anda quando o Hub assinar a 2ª chave.
[ Assinar minha chave técnica ]
```
Depois de assinar: sua chave vira ● verde, botão some, card passa a "Aguardando 2ª chave (Hub)" — ele **vê** que travou na outra porta (`derivarEstadoDupla().faltam=['hub']`). Campos: todos já existem (`pagamento.id/titulo/valor_liquido/fornecedor_nome/obra_id` + join `hub_aprovacoes`).

**FURO de segurança encontrado (reforça D2):** hoje a chave 1 é validada só por PAPEL — **qualquer arquiteto do tenant pode assinar a chave de QUALQUER pagamento** (`TODO(ABAC de linha)` em aprovacoes.ts:320-325). Falta amarrar `aprovadorHumano.userId == hub_projetos.responsavel_id` (**coluna já existe**). É só lógica, sem schema — mas mexe em dinheiro, entra na decisão do dono.

### 3.3 Disparidade como GATE (não display — resolve conflito v1 §7-D10)

A v1 tratava disparidade como display futuro. O dono pediu **gate** (memória: "arquiteto=fonte; orçamento=gate de disparidade"). A fonte **já existe** (`vw_hub_obra_compatibilizacao`: `valor_contrato, orcado_aprovado, total_pago, estado_cobertura, pct_cobertura, eh_aditivo`). O placeholder da v1 é de **fiação, não de dados** — e a cor atual `#6e9e8a` verde-água **viola o contrato §2.1** (disparidade = vermelho/risco, nunca verde); corrigir em `persona-cockpit-aggregate.ts:279-285`.

**O gate dispara no momento da chave 1** — o arquiteto não assina no escuro:

| Estado | Regra | Ação no gate |
|---|---|---|
| 🟢 dentro do orçado | `total_pago + valor ≤ orcado_aprovado` | assinatura normal |
| 🟡 aproximando | consumo ≥ 85% | assina, mas avisa "resta R$X" |
| 🔴 estouro | `total_pago + valor > orcado_aprovado` | **exige aditivo/re-orçar ANTES** — chave sai bloqueada |

Cruzamento `pagamento→item` derivável via `hub_obra_pagamentos.item_id` (existe, E6). Disparidade de projeto pré-obra **não tem fonte** (mesmo vazio do honorário).

### 3.4 O que NÃO existe no banco hoje → JANELA DO DONO

| # | Falta | Existe? | Tipo | D |
|---|---|---|---|---|
| 1 | `hub_projeto_honorarios` + `_parcelas` | Não | Tabela nova aditiva | D3 |
| 2 | RPC de depósito (`rpc_registrar_deposito_escrow`) — "Em custódia" nunca acende sem ela | Não (só `rpc_liberar_escrow`) | RPC nova | D5 |
| 3 | Fix `GREATEST` (custódia fantasma, E6 L489) | Bug ativo | Fix + janela | D7 |
| 4 | ABAC de linha da chave técnica → `responsavel_id` | Coluna existe, lógica não | Só código (mexe em dinheiro) | D2 |
| 5 | `.eq('tenant_id')` puro em `finance-dashboard-aggregate` (hoje `.or(is.null)`) | Furo ativo | Fix pré-requisito | D1 |
| 6 | Estado "estouro" derivado + gate na chave | View tem números, falta derivar | Só código | D10 |
| 7 | E6 aplicada em prod (5 tabelas + 2 RPCs + view) | Migration pronta, não aplicada | Janela | D7 |

**Ordem recomendada (Lente Financeiro):** D1 (`.eq` puro) → D2 (ABAC, sem migração) → D10 (gate, view existe) → D7 (E6 + GREATEST) → D5 (RPC depósito) → D3 (honorário, maior esforço). As 3 primeiras entregam valor **sem migração nova**.

---

## 4. ANALYTICS — métrica · gráfico · fonte · estado-vazio

Verificado ao vivo (Lente Analytics, 05/jul): `hub_projetos`=3 (todos `proxima_entrega_em`=NULL) · `hub_projetos_fases`=**0** · `hub_aprovacoes`=3 (todas aprovadas, 0 pendentes é zero **real**) · `hub_eventos`=33 (0 de tipo projeto/fase) · escrow: 1 obra (Consulado), `saldo_liberado=15000` no mês corrente · `hub_ia_consumo`=0 global · `hub_kpis_resultados`=1 (cron morto confirmado).

**Sem lib de gráfico no projeto** (nada de Recharts/D3) — tudo é CSS/SVG artesanal. Reusar `FunilOperacionalChart` (barras horizontais), `CrmLeadsEntradaPeriodo` (sparkbars), `APRESENTACAO_COBERTURA` (badges). Nenhuma métrica pede pizza/donut/radar (categorias sempre ≤5). Novos triviais: medidor segmentado (Tijolos ~30 linhas), semáforo (1 span), stepper (reuso).

### MOSTRA JÁ (fonte viva, zero acoplamento)

| Métrica | Gráfico | Fonte | Estado-vazio honesto |
|---|---|---|---|
| Projetos na fila por estágio | barras horizontais (`FunilOperacionalChart`) | `hub_projetos.estagio GROUP BY` (real: briefing=2, executivo=1) | CTA "criar briefing" se 0 |
| Chaves técnicas pendentes | big number + CTA | `contarChavesEscrowPendentes` (0 real) | 0 real é 0 real |
| Em aprovação | big number cor de risco | `hub_projetos_fases='enviado'` (0 linhas) | "a fila aparece quando a 1ª fase for enviada" (por quê é 0) |
| Obras em andamento | big number | `obras.emAndamento` via `projeto.obra_id` (1 real) | "aparece quando um projeto virar obra" |
| Aguardando 2ª chave | big number + link filtrado | `contarChavesEscrowPendentes` | — |
| Ticker de atividades | feed faixa fixa | `hub_eventos` allowlist `aprovacao_decidida` tipos `pagamento_obra_arq/hub`, `orcamento_frente` (3 reais, sem valor no payload) | — |

### DEPENDE DE ALIMENTAR (mecanismo real, input/instrumentação faltando)

| Métrica | Bloqueio | O que destrava |
|---|---|---|
| Atrasados / Entregues no mês | `proxima_entrega_em` NULL em 100% dos projetos | UX: escolher data ao criar briefing (Click-and-Go). **Sem isso, tracejado para sempre — cortar da TV** |
| Ticker de projeto/fase | nenhum `registrarEvento` para projeto/fase | ~10 linhas em 3 pontos (insert `hub_projetos`, transição `aprovacao_status`) |
| `taxa_aprovacao_primeira` / `taxa_retrabalho` | KPI **definido** em `hub_kpis_definicao` mas não no design; 0 fases hoje | computar **ao vivo** (padrão §4.2, sem esperar cron D8); vazio = "sem entregável decidido ainda", nunca "0%" |
| Em custódia (R$) | E6 dormente | há **1 caso real completo** (Consulado, R$15k liberado no mês) → usar como fixture de aceite E2E, não simular |

### DEPENDE DE DECISÃO (D1)

A pagar/receber, Saldo do escritório → não renderiza até D1. **Segurança (Lente Analytics estende D1 ao escrow):** "Em custódia"/"Liberado no mês" na TV devem somar **só as obras alcançáveis via `hub_projetos.obra_id` do arquiteto**, nunca `SUM(...) FROM hub_obra_escrow_contas WHERE tenant_id=X` cru — senão vaza escrow de outros arquitetos do mesmo tenant Hub.

**Grid da TV (≤6 hero-numbers — resolve conflito com v1 §4.1):** Projetos na fila · Em aprovação · Chaves pendentes · Em custódia (R$, dourado) · Liberado no mês (R$, dourado) · **`taxa_aprovacao_primeira` ao vivo** — substitui "Atrasados"/"Entregues" que nasceriam 100% tracejados. Regra dourado/vermelho: dinheiro sempre dourado; contadores de risco vermelho só se >0.

---

## 5. UX / LAYOUT — composição em componentes isolados

Hierarquia = os 5 tiers da §2. Financeiro é Tier 2 (raso, "saldo de banco checado") e não disputa altura com o Tier 3 operacional — se o dono priorizar o financeiro por causa da dor histórica, é só trocar a ordem Tier 2↔3, a composição não muda.

**Árvore de componentes (substitui o grid único de `CrmPersonaCockpit.tsx`; evita o god-page):**
```
<CrmPersonaCockpit>              orquestrador de LAYOUT só — teto ~150 linhas
 ├── <CockpitAcaoTopo>           card-mãe (extrair OQuePrecisa p/ arquivo próprio)
 ├── <CockpitFinanceiroTira>     NOVO — Tier 2, fetch/skeleton próprios
 ├── <CockpitGradeOperacional>   NOVO — Tier 3 (SecaoProjetos + SecaoObras)
 ├── <CockpitAprovacoesRail>     NOVO — Tier 4
 └── <CockpitAvisos>             mantido — Tier 5
```
**Regras duras (Lente UX):** cada sub-componente recebe **só a fatia de dado que usa** (props, não payload inteiro por prop-drilling) e tem **seu próprio estado carregando/vazio/erro**. Teto ~150–200 linhas/seção; se crescer, vira sub-pasta.

**Correção de resiliência (pré-requisito, não nice-to-have):** hoje `CrmPersonaCockpit` tem **um único** estado `carregando|erro|ok` para a página. A partir do momento em que o financeiro entra, se **uma** query do agregado lançar exceção, a tela **inteira** vira banner de erro — Projetos e Obras saudáveis somem junto. Cada seção do payload deve carregar seu próprio `status: ok|vazio|erro` (servidor já faz por métrica via `safeCount`, falta propagar por SEÇÃO); no cliente, `financeiro.status==='erro'` afeta só o Tier 2.

**Reuso do escrow — NÃO importar `ObraFinanceiroSecao` 1:1 (resolve conflito com v1 §3.6):** esse arquivo tem **1058 linhas** com `DrawerNovoOrcamento`/`DrawerNovoPagamento` (ações de ESCRITA da engenharia) embutidos. Importá-lo inteiro na aba do arquiteto arrasta drawers de escrita no bundle e acopla a tela dele a mudanças visuais da engenharia. **Extrair `EscrowStepper({ resumo, baldePagamento })`** — apresentação pura, cores/labels de `lib/obras/financeiro.ts` — que engenharia e arquiteto **ambos** importam. "Mesmo dinheiro, mesma cor" sem "mesmo arquivo de 1058 linhas".

**Stepper de escrow — ordem corrigida (Lente Financeiro corrige v1 §3.6):** a máquina real (`STATUS_PAGAMENTO`) é `bloqueado→liberado→autorizado→pago`, e `em_custodia` exige um depósito **sem RPC**. Stepper honesto: `Previsto → Em custódia 🛡 (SEM RPC hoje) → 🔑+🔒 duas chaves → Autorizado → Pago`. O passo "Em custódia" nasce em estado-vazio ("aparece quando o Hub confirmar o depósito"), não é decoração dourada que nunca acende.

**Cor da custódia (D9 mantido):** chip de STATUS violeta-escudo (já em prod, "protegido/cofre") + **dourado no VALOR** monetário. Violeta = "estado protegido", dourado = "quanto dinheiro".

**Click-and-Go / mobile / a11y:** assinar chave = toque→lista filtrada→botão único Assinar→folha de confirmação→toast + item some com fade + contador decrementa local e revalida em bg (sem reload). Drill-down: desktop navega com breadcrumb na cor de origem; **mobile expande em acordeão in-place** (preserva scroll). Tira financeira em mobile = scroll-snap horizontal nativo (mantém "1 frase"). Alvo de toque ≥44px. Todo `pulse-*`/`number-tick` dentro de `prefers-reduced-motion`. Semáforo pareado com forma, não só cor. Microinterações reusam `globals.css` (`pulse-gold`, `pulse-red`, `analytics-enter`, `number-tick`) single-shot, nunca em loop. TV reusa a família `CrmMetricCard` como `TvHeroCard` (mesmo contrato `label/valor/sub/cor`, só troca o token de tamanho).

---

## 6. PRONTIDÃO-PARA-BUILD (o mais importante)

**Recomendação de arquitetura:** o financeiro-do-arquiteto deve **nascer como MÓDULO ISOLADO novo** (`/crm/arquitetura/financeiro` com guard próprio por capability estreita `financeiro:proprio` + `EscrowStepper` extraído), **não** boltado num god-page existente (`ObraFinanceiroSecao` 1058 linhas / grid único de `CrmPersonaCockpit`). Isso é o que as Lentes UX e Financeiro convergem em pedir. **Porém a decisão final de ONDE ele vive fisicamente depende do relatório de acoplamento (Frente 2)** — se a auditoria de costuras mostrar que escrow/aprovações já têm um ponto de fusão canônico, o módulo pluga nele em vez de duplicar. Registrar como aberto.

### [PODE JÁ] — independe de acoplamento, fonte viva, zero schema novo

- **Card-mãe "O que precisa de você" (Tier 1), linhas 1–3** — chaves pendentes, fases enviadas, briefings na fila. 100% fonte viva, zero schema, zero decisão do dono. **Maior valor / menor esforço de todo o doc → esta é a NOVA Onda 1** (resolve conflito com a v1, cuja Onda 1 = Financeiro do Escritório estava bloqueada por D1 e nascia vazia).
- **Grade operacional (Tier 3)** — Projetos por estágio, Obras vinculadas. Queries já existem.
- **Ticker `hub_eventos`** com allowlist dos 3 tipos reais de hoje.
- **Componentização isolada** — extrair `CockpitAcaoTopo`, `CockpitFinanceiroTira`, `CockpitGradeOperacional`, `CockpitAprovacoesRail`; **status por-seção** (correção de resiliência); extrair `EscrowStepper` puro. Refactor estrutural, não toca lógica compartilhada.
- **Instrumentar `registrarEvento`** em projeto/fase (~10 linhas, 3 pontos) — destrava ticker e Seção A.
- **`taxa_aprovacao_primeira`/`taxa_retrabalho` ao vivo** (não esperar cron D8).
- **Cor da disparidade** — trocar `#6e9e8a` verde-água por vermelho/âmbar/tracejado (viola contrato §2.1 hoje). Cosmético, sem acoplamento.
- **UX de prazo** — capturar `proxima_entrega_em` ao criar/mover briefing (destrava Atrasados/Entregues).

### [ESPERA DESTRAVAMENTO] — mexe em escrow / aprovações / analytics compartilhados; aguarda o mapa de costuras (Frente 2) + janela do dono

- **Card da chave 1 (as 2 fechaduras + "assinar não paga")** — toca o gate `validarChaveEscrow` e `hub_aprovacoes` compartilhados. **ABAC de linha (D2)** é pré-requisito de segurança (hoje qualquer arquiteto assina qualquer pagamento).
- **Disparidade como GATE na assinatura** — depende de E6 aplicada (D7) + derivar estado "estouro" (D10) + cruzamento `pagamento→item`.
- **6ª aba "Pagamentos" por projeto** — depende de E6 migrado + fix GREATEST + `EscrowStepper` extraído.
- **Honorário (tabelas novas D3)** — decisão de dados nº2 + SoD D3-bis (arquiteto é recebedor, não chave do próprio honorário). Interim leve possível: marco de honorário como tarefa/checkpoint reusando o gestor de tarefas universal, destravando a linha 5 do card-mãe antes do schema completo — **precisa data** (não "algum dia").
- **"Em custódia" saindo de zero** — ordem obrigatória: E6 (D7) → fix GREATEST → RPC de depósito (D5) → alguém chamá-la. Lado-entrada do escrow + Hub↔Parceiro (D4) = Fase 2, pós-decisão comercial.
- **Financeiro do Escritório (Bloco 4)** — bloqueado por D1 (modelo de tenant) + `.eq('tenant_id')` puro. Escopo de escrow na TV também deve passar por `projeto.obra_id`, não `tenant_id` cru.

### Ordem de ondas revisada (resolve o conflito Produto × v1)

**Onda 0** decisões do dono (§7) → **Onda 1 = card-mãe linhas 1–3 + componentização isolada + status por-seção** (era Financeiro-leitura bloqueado; Produto reordena) → **Onda 2** home em seções de contexto + drill-down + instrumentação de eventos + taxa ao vivo → **Onda 3** TV/ticker → **Onda 4** relatórios → **Onda 5** chave 1 + disparidade-gate + 6ª aba (pós-D7) → **Onda 6** honorário + lado-entrada + Hub↔Parceiro. **Sinal de adoção da Onda 1** = % de itens do card-mãe resolvidos no mesmo dia (mede se destrava trabalho, não se "foi aberta").

---

*Síntese das 4 lentes sobre `docs/DESIGN-TELA-ARQUITETO.md`. Nenhum arquivo escrito/alterado — entregue como spec para o dono aprovar. Aberto que depende da Frente 2: onde o módulo isolado do financeiro-do-arquiteto se pluga fisicamente.*
