# Central de Aprovacoes — Design ideal (mesa redonda). F0: fix vazamento tenant lib/ia/aprovacoes.ts e pre-req.

Os documentos-fonte confirmam o requisito e o chão real (bug P0 verificado na observação 9218). Tenho material suficiente para consolidar o design ideal a partir das 4 lentes.

## Central de Aprovações — design ideal

Princípio do dono (peso enorme): **a fila que faz TODAS as frentes andarem**. IA prepara, prioriza e auto-aprova o trivial; o humano fica no checkpoint do crítico; cada decisão ENSINA o agente. Tudo sobre `hub_aprovacoes` (uma verdade), aditivo, nada-se-perde.

> **F0 inegociável (P0 de segurança, confirmado no código — obs 9218):** `lib/ia/aprovacoes.ts` (`buscarAprovacoesPendentes` ln 53-65, `aprovar` ln 156-160, `rejeitar` ln 199-204) e `app/api/hub/aprovacoes/route.ts` rodam SEM `.eq("tenant_id")`. Com service_role, o código é a única barreira — e está ausente. O escrow leva DINHEIRO por esse gate. **Nada da Central vai a multi-tenant real antes deste fix.**

### A fila unificada (agrega todos os gates) por mercado×atividade×tipo

A Central **não é caixa de entrada** — é fila priorizada pela IA. Todo gate de avanço publica o MESMO registro tipado em `hub_aprovacoes` via `criarAprovacao()` — sem tabela paralela. Três eixos, todos derivados de colunas aditivas:

| Eixo | Valores | Origem |
|---|---|---|
| **MERCADO** | imobiliário · arquitetura · engenharia · hub | herda de `negocio_id`/`obra_id`; carrega a COR do mercado (regra cross-conta) |
| **ATIVIDADE/SETOR** | comercial · financeiro · obra · compras · distribuição · atendimento · IA | derivada de `agente_slug` → mapa de setor |
| **TIPO** | medição · aditivo · escopo · marco · escrow_arq · escrow_hub · compra/SC · restrição/SST · orçamento · desconto · encaminhamento_lead · contrato | CHECK existente + extensões |

A UI agrupa por **setor** (cada aba "tocada" pelo seu agente), filtra por mercado e tipo, e ordena por **prioridade-IA** (SLA × valor × risco) — nunca cronológica. Botão agrupar/desagrupar; aprovação em lote para baixo risco.

### Por PERSONA (cliente/arquiteto/engenharia/fornecedor/gestor) — o que aprova + como vê

Dois eixos ortogonais **já no código**: RBAC interno (`crm-permissoes.ts`: owner/gestor/comercial/financeiro/atendente) e ABAC por persona-do-negócio (`hub_negocio_acessos`: papel por `negocio_id`, conjunto EXATO como `ROTA_ROLES_EXATAS` — nunca rank linear). A fila de cada um é o SELECT filtrado por esses dois.

| Persona | Aprova | Como a fila aparece |
|---|---|---|
| **Cliente** (externo, ABAC) | só o seu e simples: medição, aditivo, escopo, marco (A1) | poucos cards grandes, linguagem leiga, selo de auditoria; vê totais OU unitário conforme `tipo_contrato` (admin=unitário / preço_fechado=totais); NUNCA vê custo de fornecedor/margem; "Tenho dúvidas" NÃO rejeita — abre canal mediado pelo Hub |
| **Arquiteto** | compatibilização + **chave 1 do escrow** (`escrow_arq`) | como dono no seu negócio; como envolvido em outro mercado: VÊ (cor original) + comenta, mas NÃO decide |
| **Engenharia/Obra** | medição, avanço, SC/compra (E5), liberação de restrição/SST (E3) | setor "Obra", só obras do tenant |
| **Fornecedor** (tenant próprio) | cotação/pedido do SEU escopo | só a thread do seu negócio; nunca vê outro fornecedor nem margem do Hub |
| **Gestor** (RBAC ≥ gestor) | desconto, encaminhamento de lead, pagamentos internos | fila do SEU tenant nos setores que o RBAC permite (financeiro só com `crm:financeiro`) |

**Regra de ouro cross-conta:** o ENVOLVIDO VÊ (read + comenta), só o DONO do negócio e o HUB DECIDEM. A UI **não renderiza** o botão que o ABAC não autoriza (ausente, não desabilitado). Aba dedicada "Para ciência" (modo leitura) para envolvidos.

### O HUB (juiz) — vê tudo, 2ª chave do escrow, auto-aprova

Camada auditoria / gestão-da-gestão. Papéis exclusivos:
- **2ª chave do escrow** (`escrow_hub`): o pagamento só libera quando arq E hub estão `aprovado` — **dois registros tipados** no mesmo pagamento (não JSONB mutável: cada papel filtra o seu, blast radius menor, idempotência por chave).
- **Auto-aprova o trivial por política** e **vê o que foi auto-aprovado** (transparência, nunca caixa-preta).
- **Dashboards cross-tenant**: todos os negócios/leads/envolvimentos com cor do mercado, dono, etapa, saúde, SLA. Relatórios densos só em `/crm/relatorios`; a fila é acionável.
- Pode **reabrir/estornar** auto-aprovações (escrow tem movimento `estorno` append-only); taxa de reabertura é métrica de saúde da política.

### IA-first (prioriza/recomenda/auto-aprova trivial por nível; decisão ensina o agente) + conversacional

A IA **trabalha antes do humano abrir a tela**: `enriquecerAprovacao()` (background, após `criarAprovacao`) busca contexto + histórico de similares, chama LLM para motivo/recomendação/confiança, calcula `prioridade_ia` e `nivel_autonomia`. CRON re-prioriza (aging: sobe conforme consome o SLA).

**Níveis de autonomia (1→5),** estendendo `hub_autonomia_matriz` (já tem `limite_autonomia_brl`/`exige_aprovacao`):

| Nível | Comportamento |
|---|---|
| 1 SUGERE | IA recomenda, humano faz tudo (default, 1ª vez sempre) |
| 2 RECOMENDA | "IA recomenda — 94%", humano 1 toque |
| 3 PRÉ-APROVA | auto abaixo do limite + janela de reversão; escala acima |
| 4 AUTO+LOTE | auto-aprova rotina auditada; relatório diário |
| 5 ROTINA SEGURA | age sem gerar card; só evento append-only; Hub audita depois |

**Trava absoluta — nunca passa de nível 2:** escrow, qualquer liberação de dinheiro/medição do cliente, contrato, aditivo de escopo, SST, `requer_dupla_aprovacao=true`, valor > limite do owner. Regra config por setor×tipo×valor na tela do owner.

**Loop que ensina (o diferencial — hoje NÃO existe; `hub_memorias_agente` existe mas não é alimentado):** ao decidir, grava `hub_decision_logs` (já feito) E `gravarFeedbackAgente()` → `hub_memorias_agente` (rejeição = sinal forte 0.95) + notifica via `hub_fila_mensagens` (já usado no `rejeitar()`). Detector de padrão: ≥3 rejeições do mesmo tipo/agente em 30d → sugere ao owner ajustar a política ("desconto>15% sempre rejeitado → agente para de propor").

**Conversacional** (reusa CopilotoVoz + gate dourado HMAC + allowlist): "o que precisa de mim hoje?" (lê a fila priorizada do papel), "aprovar medição 3" (resolve por contexto → card → CONFIRMA). **Escrita financeira NUNCA por voz** — redireciona para clique na tela ("Para aprovar pagamento, confirme na tela — vou abrir"). Só auto-aprova por voz tipo não-financeiro + `auto_aprovavel=true` + nível ≥3.

### Dados (unificar em hub_aprovacoes + fix tenant; como cada bloco publica; aprovação dupla)

**F0 — fix + colunas aditivas** (migração `20260801120000_central_aprovacoes.sql`, idempotente, zero DROP de dados):

```sql
-- Eixos
ADD mercado TEXT, atividade TEXT, referencia_tipo TEXT   -- o que referencia_id aponta
-- Elos (espinha; soft FK, LEFT JOIN, sem cascade)
ADD negocio_id UUID, obra_id UUID
-- Priorização / SLA
ADD prioridade_ia INT DEFAULT 50, urgencia TEXT, sla_horas INT, sla_vence_em TIMESTAMPTZ, sla_status TEXT
-- Autonomia
ADD nivel_autonomia INT DEFAULT 1 CHECK(1..5), auto_aprovavel BOOL, auto_aprovado BOOL, auto_aprovado_em TIMESTAMPTZ
-- Roteamento por persona
ADD aprovador_papel TEXT, visivel_para TEXT[] DEFAULT ARRAY['gestor','owner']
-- Dupla aprovação (escrow) — DOIS registros tipados, não JSONB
ADD requer_dupla_aprovacao BOOL DEFAULT false, segunda_aprovacao_tipo TEXT,
    segunda_aprovacao_status TEXT DEFAULT 'pendente', segunda_aprovacao_por TEXT, segunda_aprovacao_em TIMESTAMPTZ
-- Loop / delegação / portal
ADD feedback_aplicado BOOL, delegado_para UUID, delegado_em TIMESTAMPTZ, delegado_por TEXT, selado_hub BOOL DEFAULT false
-- CHECK de tipo: DROP+ADD com os novos (escrow_arq/escrow_hub/medicao_cliente/aditivo_cliente/restricao_sst/...)
-- Índices
DROP idx_hub_aprovacoes_status;
CREATE INDEX idx_hub_aprovacoes_fila ON hub_aprovacoes(tenant_id, status, prioridade_ia DESC, sla_vence_em) WHERE status='pendente';
CREATE INDEX idx_hub_aprovacoes_negocio ON hub_aprovacoes(negocio_id, status) WHERE negocio_id IS NOT NULL;
```
> **Risco de migração (validar em dev):** existem DOIS schemas divergentes de `hub_aprovacoes` nas migrations (v3 rico vivo: `agente_slug/confianca_ia/dados` vs `crm_integral_core` com `titulo`). O código vivo usa o v3. A unificação adiciona `tenant_id/obra_id/mercado` ao schema vivo e mapeia `titulo↔descricao`. Backfill do `tenant_id` legado antes de qualquer constraint NOT NULL.

**Como cada bloco publica** (todos via `criarAprovacao` estendido):

| Gate | mercado | atividade | tipo | aprovador | dupla | SLA |
|---|---|---|---|---|---|---|
| A1 cliente | arquitetura | obra | medicao/aditivo/escopo/marco_cliente | cliente | true (cliente+hub) | 72h |
| E3 SST | engenharia | obra | restricao_sst | gestor | false | 12h |
| E5 SC/compra | engenharia | compras | compra_material/cotacao | gestor | false | 24h |
| E6 escrow | engenharia | financeiro | escrow_arq + escrow_hub (2 registros) | arq → hub | true | 4h |
| E7 medição | engenharia | obra | medicao_cliente + liberacao_escrow | cliente → hub | true | 72h |
| Distribuição | * | distribuicao | encaminhamento_lead | gestor | false | 2h |

**Cascatas:** aprovar dispara `executarAcaoAprovada()` por tipo (escrow libera movimento, SC vira pedido, medição avança obra). Tudo append-only via `hub_eventos`/`registrarEvento` (chamar, não reinventar). **Liberação do escrow:** só quando AMBOS os registros = `aprovado` (RPC `hub_liberar_escrow`).

### Telas (gestor/cliente/Hub) + ASCII

**Fila do Gestor** (interno, vê seu tenant por setor):
```
+--------------------------------------------------------------+
| APROVACOES  7 pend · 2 urgentes  [Conversar: precisa de mim?]|
| Setor:[Todos][Comercial][Financeiro][Obra][Compras][Distrib] |
| Mercado:(o)Eng (o)Arq (o)Imob   Tipo:[v]   Ordenar: IA       |
+--------------------------------------------------------------+
| [OBRA·eng] Medicao #3 — Residencia Lago    R$150.000   ! SLA |
|  Agente Obra · conferido in loco 26/jun · IA 92% -> Aprovar  |
|  [ v Aprovar ]  [ Rejeitar (motivo) ]  [ Ver ]               |
+--------------------------------------------------------------+
| [COMERCIAL] Desconto 18% — Vila Nova       R$9.000           |
|  IA 40%: ACIMA do limite (15%) -> revise                     |
|  [ v Aprovar ]  [ Rejeitar ]  [ Ver ]                        |
+--------------------------------------------------------------+
| ~ auto-aprovados hoje (8) — ver registro (auditoria) ~       |
+--------------------------------------------------------------+
```

**Fila do Cliente** (portal, leigo, selo Hub):
```
+--------------------------------------------------------------+
| Sua obra precisa de voce (1)       [selo: AUDITADO PELO HUB] |
+--------------------------------------------------------------+
| Medicao #4 — Estrutura 75%                      R$38.000     |
| (v) Auditada pelo Hub · visita 26/jun · 3 fotos carimbadas   |
| O que sua aprovacao faz: libera R$38.000 do escrow.          |
| So sai com a SUA aprovacao E a do Hub.                       |
| [ Tenho duvidas · falar com o Hub ]     [ Aprovar v ]        |
+--------------------------------------------------------------+
| Historico: Medicao #3 aprovada 12/jun · R$32.000             |
+--------------------------------------------------------------+
```

**Painel do Hub** (juiz, cross-tenant, 2ª chave):
```
+--------------------------------------------------------------+
| HUB · JUIZ  Todos tenants  [mercado][escritorio][etapa]      |
+--------------------------------------------------------------+
| ESCROW — liberar pagamento Obra Lago (medicao #3)            |
|  Chave 1 arquitetura: v aprovado 09:12                       |
|  Chave 2 Hub: PENDENTE · custodia R$150k · SLA 2h            |
|  [ Liberar (2a chave) ]   [ Reter (motivo) ]                 |
+--------------------------------------------------------------+
| Politicas de auto-aprovacao  [configurar niveis 1-5]         |
| Auto-aprovados (rede, hoje): 41 · 0 reabertos · rejeicao 4%  |
+--------------------------------------------------------------+
```

### Faseamento / MVP · Reuso × novo · Edge cases

**Faseamento** (aditivo, gates tsc+vitest, sugere→confirma):
- **F0 (pré-req, P0):** fix `.eq('tenant_id')` nas 3 funções + route + colunas/índices aditivos + helpers `calcularPrioridade`/`calcularNivelAutonomia` + CRON `sla_status`. **Bloqueante.**
- **F1 (MVP):** RPC `hub_fila_aprovacoes(tenant,papel,negocio_ids[])` + `GET /api/crm/aprovacoes` com filtros mercado/atividade/tipo + tela agrupada por setor, ordenada por IA, badge SLA. Deixa de ser lista única.
- **F2 (MVP):** recomendação IA + motivo no card + chips de motivo obrigatórios na rejeição + `gravarFeedbackAgente()`.
- **F3:** persona CLIENTE (matriz totais×unitário por `tipo_contrato` + selo Hub) via `hub_negocio_acessos` — **diferencial de venda**.
- **F4:** escrow dupla-chave (2 registros, arq+hub) + RPC `hub_liberar_escrow`.
- **F5:** políticas de auto-aprovação (tela owner) + aprovação em lote.
- **F6:** loop decisão→`hub_memorias_agente` + CRON semanal de padrões (o diferencial; por último).
- **F7:** conversacional sobre CopilotoVoz.

**MVP REAL = F0+F1+F2** (fila única por setor/tipo/mercado, IA no card, segura por tenant). F3+F4 destravam a venda (cliente + escrow "somos juízes"). F5+F6 = maturidade.

**Reuso (nada-se-perde):** `hub_aprovacoes` (só colunas aditivas) · `lib/ia/aprovacoes.ts` `criarAprovacao/aprovar/rejeitar/montarCard/executarAcaoAprovada` (estender, fix tenant primeiro) · `/api/hub/aprovacoes` + `/crm/aprovacoes/page.tsx` (shell com cards/toast/realtime — evoluir) · `hub_decision_logs` · `hub_memorias_agente` (alvo do loop) · `hub_autonomia_matriz` (base dos níveis) · `hub_fila_mensagens` · `crm-permissoes.ts`+`ROTA_ROLES_EXATAS` · `hub_negocio_acessos` (ABAC) · `hub_eventos`/`registrarEvento` · CopilotoVoz+HMAC · tokens marca `--obra-*` · campos A1 do Portal.
**Evitar:** tabela paralela `hub_central_aprovacoes` · JSONB mutável p/ dupla-chave (usar 2 registros) · rank linear em persona externa · expor margem/spread a quem ≠ Hub · audit paralelo (usar `hub_eventos`) · SLA em trigger de banco (manter no código, testável) · `tenant_id` via query param.

**Edge cases (decididos):**
- **Aprovação dupla (escrow):** qualquer rejeição encerra o par; o outro registro vira `cancelada`; libera SÓ com ambos `aprovado`; SLA vencido com par incompleto alerta mas **NUNCA auto-aprova por timeout**.
- **Delegação:** delegatário não redelega; revogação só pelo delegante ou owner; owner fixo não delegável; crítico (escrow/SST) só delega a quem tem o papel exato; auditada em `hub_decision_logs`.
- **Expiração/SLA:** `sla_status='vencido'` sobe prioridade e badge vermelho (vermelho só em atraso real); escala ao nível acima (gestor→owner→Hub) ou redistribui; **nunca auto-aprova nem auto-rejeita por timeout**. Cliente vencido → lembrete + ponte do Hub.
- **Rejeição com motivo:** chip de categoria obrigatório (valor_alto/fora_politica/dados_incompletos/fornecedor_invalido/prazo_inviavel/risco_tecnico/outro) + texto livre se `outro`; endpoint 422 sem motivo; alimenta o loop.
- **Conflito de papel:** a ROTA determina o papel de leitura (`/crm`=gestor vs `/portal`=cliente) — nunca mistura; resolução por `negocio_id`+papel (ABAC exato), nunca rank; Hub que também é arquiteto age pelo `aprovador_papel` do card, não pelo papel global.
- **Idempotência:** UPDATE com `.eq('status','pendente')`; já decidido → 409, card vira read-only (sem desfazer; histórico append-only).
- **Selo do Hub (portal):** cliente NUNCA vê card não-selado; estado `rascunho` invisível até `PATCH /api/hub/aprovacoes/[id]/selar`.
- **IA por voz:** financeiro nunca por voz — redireciona para clique.
- **Auto-aprovado indevido:** registro auditável visível; Hub reabre/estorna; taxa de reabertura = saúde da política.

**Arquivos-âncora reais:** `lib/ia/aprovacoes.ts` (fix P0 — 3 funções), `app/api/hub/aprovacoes/route.ts` (fix P0 GET), `app/crm/aprovacoes/page.tsx` (refatorar, não reescrever), `lib/crm/crm-permissoes.ts` (RBAC + `ROTA_ROLES_EXATAS`), `hub_negocio_acessos` (ABAC personas), `hub_autonomia_matriz` (níveis 1-5), `hub_memorias_agente`+`hub_decision_logs`+`hub_fila_mensagens` (loop). Nada foi editado — isto é o desenho. **Confiança ALTA** no modelo e no P0 (bug verificado, obs 9218); **MÉDIA** na reconciliação dos dois schemas (validar em dev) e nas personas externas F3 (dependem do handoff multi-tenant parado + decisões de negócio do dono); **BAIXA** na calibração numérica dos níveis (limiares % e R$ — confirmar com o dono antes de ligar auto-aprovação em prod).