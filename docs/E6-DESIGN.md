# E6 (orcamento -> pagamento + compatibilizacao) — Design + Auditoria (mesa redonda)

NOTA CRITICA: a auditoria achou vazamento cross-tenant LIVE em lib/ia/aprovacoes.ts (buscarAprovacoesPendentes/aprovar/rejeitar sem .eq tenant). CORRIGIR no build de E6.

All key audit points confirmed against real code:
- `hub_aprovacoes.tipo` CHECK = `('proposta','pedido_material','pagamento','desconto','outro')` — needs DROP+ADD for new types.
- `cockpit-aggregate.ts`: `pagamentosAVencer: null` (ln 375), `temFinanceiro: false` (ln 390), `ehAusenciaDeSchema` degradation pattern (ln 58) — all real.
- E2 `hub_obra_itens.valor_contrato NUMERIC(14,2)` (ln 90), `parent_id` (ln 59), `ativo` (ln 99) — all real.
- **CONFIRMED CRITICAL**: `buscarAprovacoesPendentes()` (ln 53) filters only `.eq("status","pendente")` — **NO tenant_id filter**. The `aprovar`/`rejeitar` functions filter only `.eq("id", ...)`. The cross-tenant leak is real and confirmed in the live code.

I have enough ground truth. Producing the final audited design.

---

## Design final de E6 — Orçamento → Pagamento + Compatibilização

As 4 lentes convergiram fortemente. Onde divergiram (nomes de tabela, snapshot vs. desnorm, 1-orçamento-por-frente vs. 1-linha-por-item), o CEO decide abaixo. **Veredito: aprovado para construção, com 1 bloqueador de segurança (tenant em `hub_aprovacoes`) que é pré-requisito de go-live.**

### Modelo + o gate 'Aprovado'→libera pagamento (via hub_aprovacoes + evento)

**Decisão de granularidade (resolvendo a divergência das lentes):** orçamento em **2 níveis** — cabeçalho por frente + linhas por item. A planilha tem "1 linha = 1 item", mas o gate do dono é "Aprovado **libera a frente** para pagamento". Cabeçalho dá a unidade de aprovação (1 card no gate por frente, não 18); as linhas dão a fidelidade item-a-item e a base da Compatibilização. (Backend-architect acertou; product-owner/ai-engineer simplificaram demais ao colar valor no item.)

3 tabelas físicas + 1 VIEW + reuso total do gate:

| Peça | Decisão | Fato no código |
|---|---|---|
| `hub_obra_orcamentos` (cabeçalho/frente) | **NOVA** | unidade de aprovação; `status` espelha a coluna 'Aprovado' |
| `hub_obra_orcamento_itens` (linha/item) | **NOVA** | `item_id` FK → `hub_obra_itens` (E2, confirmado ln 90); `valor_total` GENERATED STORED |
| Gate 'Aprovado libera' | **REUSA `hub_aprovacoes`** | tipo novo `orcamento_frente`; CHECK confirmado ln 141 → DROP+ADD |
| `hub_obra_pagamentos` | **NOVA** | tem `orcamento_id`/`item_id`/`aprovacao_id` que `hub_contas_pagar` não tem |
| Compatibilização | **VIEW `security_invoker=true`** | derivada de E2.valor_contrato; nunca tabela |
| Cascata Aprovado→libera | **EVENTO via RPC**, não trigger | mesma decisão de E3/E5; auditável e atômico |

**O gate em 2 estágios (a regra de ouro vira 2 portas):**

```
ORÇAR → [GATE 1: humano aprova orçamento da frente] → LIBERA
(rascunho)   hub_aprovacoes tipo='orcamento_frente'    (status='aprovado')
             = coluna 'Aprovado' da planilha                  │
                                                              ▼
                               [Gerar pagamento] habilita só se orçamento aprovado
PAGAR ← status='pago' ← [registrar baixa] ← [GATE 2: humano autoriza pagamento]
                                              hub_aprovacoes tipo='pagamento_obra'
A IA NUNCA fecha NENHUM dos 2 gates.
```

A cascata reusa o ponto de extensão **`executarAcaoAprovada()`** (lib/ia/aprovacoes.ts) + o PATCH em `app/api/aprovacoes/[id]` que **já faz cascata** para `cotacao_fornecedor`. E6 só adiciona um ramo `tipo='orcamento_frente'` → `UPDATE hub_obra_orcamentos SET status='aprovado'` → pagamentos vinculados ficam liberáveis. **Não há trigger de cascata** (frágil, não-auditável).

**Por que `bloqueado BOOLEAN` (ai-engineer) é redundante e foi REJEITADO:** a liberação é derivada de `orcamento.status='aprovado'`. Um flag `bloqueado` separado cria 2 fontes de verdade que dessincronizam. O guard do endpoint de pagamento valida o status do orçamento no momento do INSERT — fonte única.

### Compatibilização (cobertura 🟢/🔴) como VIEW

VIEW `vw_hub_obra_compatibilizacao`, `security_invoker=true` (padrão de `vw_hub_obra_itens_situacao`, confirmado E2). Base = `hub_obra_itens` (E2) LEFT JOIN orçamento-item LEFT JOIN totais de pagamento. **3 estados, não 2** (refinamento sobre a planilha — o 🟡 evita o erro de "ter orçamento mas não-aprovado parecer coberto"):

- 🟢 `com_aprovado` — item tem orçamento-item de orçamento `status='aprovado'`
- 🟡 `com_pendente` — tem orçamento mas aguarda gate
- 🔴 `sem_orcamento` — `valor_contrato` existe, orçamento = 0 → **o gap que a tela existe para mostrar**

`pct_cobertura = valor_orcado / valor_contrato * 100`, com `CASE WHEN valor_contrato IS NULL OR =0 THEN NULL` (guarda divisão por zero — confirmado necessário pois `valor_contrato` é nullable em E2). Filtro `WHERE ativo=true AND parent_id IS NULL` (só itens-pai/contrato, confirmado E2 ln 59/99). LATERAL pega o orçamento aprovado mais recente (`ORDER BY status='aprovado' THEN criado_em DESC LIMIT 1`) — resolve aditivo corretamente.

### Telas (orçamento, fila de aprovação, pagamentos, compatibilização) + ASCII

Navegação: **aba "Financeiro"** dentro de `/crm/obras/[id]` (3ª aba ao lado de Itens|Painel, confirmado pelas lentes UX), com segmented `[Orçamento][Aprovações][Pagamentos][Cobertura]`. Não é página solta — financeiro é por obra (regra "financeiro por frente"). Tokens dark verde+dourado existentes, mobile-first, gates como bottom-sheet.

**T1 — Orçamento (por frente, expande em itens):**
```
┌─ Financeiro · Consulado Itália ─────────────┐
│ [Orçamento✓][Aprovações 2][Pagamentos][Cobertura]│
│ Previsto R$1.84M · Orçado R$1.20M · Aprov.R$980k │ ← faixa-saúde
│ ✨ "R$640k esperam sua aprovação em 3 frentes"   │ ← banner IA (leitura)
├─ ▾ CIVIL (Andar 8) ──────── R$420k · 🟢 Aprovado ┤
│   • Revest. cerâm.  120m² R$85/m²  R$10.200 🟢   │
├─ ▾ ELÉTRICA ─────────────── R$310k · 🟡 pendente ┤
│   • Quadro QD A9        R$45.000  ⏳ aguardando  │
│   [Enviar p/ aprovação ▸]  ← gate dourado        │
│ ⚠ Aprovar orçamento é ato HUMANO (faixa dourada) │
└──────────────────────────────────────────────────┘
```

**T2 — Fila de aprovação (NÃO é tela nova — reusa `/crm/aprovacoes`):**
```
┌─ Aprovações · 2 pendentes ─[💰Orçamento][💳Pagamento]┐
│ ┌ 💰 ORÇAMENTO · Elétrica/A9 · R$310.000 ──────────┐│ ← borda dourada 3px
│ │ ✨ IA 88%: dentro do contrato, cobertura 100%     ││
│ │ ⚠ Aprovar LIBERA pagamento desta frente           ││ ← efeito explícito
│ │ [Rejeitar ✗]                    [Aprovar ✓]       ││
│ ┌ 💳 PAGAMENTO · Medição M3 · R$84.000 · vence 5d ─┐│
│ │ ⛔ BLOQUEADO: orçamento da frente não aprovado    ││ ← edge visível
│ │ [Aprovar orçamento primeiro ›]  [Autorizar](off) ││
└──────────────────────────────────────────────────────┘
```

**T3 — Pagamentos (3 baldes fiéis à planilha):**
```
┌─ Pagamentos ─[A pagar R$210k][Vence 7d R$84k🟡][Atrasado R$32k🔴][Pago]┐
│ 🔴 ATRASADO 4d · Medição M2 · Civil · R$32.000 · ConstruMax           │
│    [Autorizar pagamento ▸] [Renegociar]   ← gate dourado              │
│ 🟡 VENCE 5d · Medição M3 · Elétrica · R$84.000 · ✅ orçam. aprovado   │
│ ⚪ A PAGAR · ART/CREA · R$1.200                                        │
│ [+ Lançar] (só habilita se há orçamento aprovado OU manual-avulso)    │
└───────────────────────────────────────────────────────────────────────┘
```

**T4 — Compatibilização (🟢/🔴 + % — vermelho primeiro):**
```
┌─ Cobertura · 72% coberto ─[🔴 Sem orç. 6][🟡 Parcial 3][🟢 OK 41]┐
│ ╭ 72% ╮ 132 de 164 itens cobertos · gap R$280k sem orçamento      │
│ 🔴 Esquadrias A9  prev R$120k · orç R$0 · 0%   [✨ orçar][Orçar▸] │ ← CTA fecha o loop
│ 🟡 Quadro elétr.  prev R$45k · orç R$30k · 67% [Completar▸]      │
│ 🟢 Concretagem    prev R$120k · orç R$120k · 100% ✓             │
└───────────────────────────────────────────────────────────────────┘
```

### Como o cockpit E1 acende a seção Pagamentos

Confirmado no código real: `cockpit-aggregate.ts` tem `pagamentosAVencer: null` (ln 375) e `temFinanceiro: false` (ln 390) **hardcoded**, com o helper `ehAusenciaDeSchema` (ln 58) já pronto para degradar. E6 adiciona **1 bloco `lerPagamentosResumo()`** no mesmo molde dos `lerPedidosAbertos` (Promise.all + `ehAusenciaDeSchema → return []`):

- Lê 3 buckets de `hub_obra_pagamentos` (a_pagar com venc>hoje / vencendo ≤7d / atrasado), `.eq('tenant_id', tenantId).in('obra_id', obraIds)` puro.
- Se a tabela não existe → `ehAusenciaDeSchema` → retorna vazio → `temFinanceiro` continua `false` → §4 segue "chega em breve". **Zero quebra** (filosofia degrada-não-derruba já no arquivo).
- Com dados: `pagamentosAVencer` deixa de ser `null`, `temFinanceiro` vira `true`, a §4 vira painel real com os 3 pills. O contador "A vencer" no topo do Hoje recebe `totalAPagar + totalAtrasado`.
- **Regra de ouro no cockpit:** §4 nunca tem botão [Pagar] direto — só [Abrir] → leva à T3 onde o gate mora. O Hoje mostra, não paga. §4 oculta por papel (não só desabilita).

### Conversacional/IA (humano aprova)

4 tools registradas nos 4 pontos canônicos (`HubAgenteFerramentaId`, `HUB_FERRAMENTA_ACESSO`, `COPILOTO_FERRAMENTAS_ESCRITA_FASE3`, `ESCRITA_SEM_LEAD` — operam sobre `obra_id`):

- **`hub_financeiro_resumo`** (leitura, auto-exec): "quanto falta pagar na obra X" → 3 buckets + total.
- **`hub_orcamento_listar`** (leitura): "o que falta orçar" → 🔴 da compatibilização.
- **`hub_orcamento_criar`** (escrita, gate sempre): cria **rascunho** via card dourado `acaoPendente`. Nunca submete nem aprova — aprovar é 2º gate na tela com papel.
- **`hub_financeiro_aprovar`** (escrita crítica): "aprova o orçamento da Elétrica" → **NÃO executa**; prepara o card e/ou **enfileira** em `hub_aprovacoes`, depois deep-link para `/crm/aprovacoes`. Espelha E5 "aprovar compra por voz = proibido". A decisão de dinheiro é sempre clique humano com papel.

Ambíguo (2 frentes Elétrica) → chip-picker antes do gate. Confiança <0,7 → aviso amarelo (já no CopilotoVoz).

### Edge cases

Consolidados das 4 lentes (todos cobertos): item sem orçamento (🔴, nunca trava, CTA [Orçar]); pagamento sem orçamento aprovado (HTTP 422 + botão some na UI; exceção `adiantamento` com flag explícito → decisão do dono); aditivo (`orcamento_pai_id` + status próprio gate; cobertura >100% legítima = badge "aditivo", não erro); medição > contratado (422 `medicao_excede_contrato` + aviso vermelho + override consciente, nunca silencioso); pagamento parcial (N linhas mesmo `orcamento_id`, VIEW soma; "pago excede orçado" = ⚠); status atrasado (job diário fonte-de-verdade + derivação local na UI entre execuções); item sem `valor_contrato` (pct=NULL → "—%", não NaN); migração não aplicada (degrada via `ehAusenciaDeSchema`, endpoints 503); double-tap idempotente (guard `status='pendente'`).

### Reuso/reconciliação x novo

**Reusa (sem tocar):** `hub_aprovacoes` (gate dourado, só expande CHECK); `executarAcaoAprovada()` + PATCH `/api/aprovacoes/[id]` (ponto de cascata existente); `hub_obra_itens.valor_contrato` (E2, base da VIEW); `hub_obra_frentes_eap` (E0, agrupador); `vw_hub_obra_itens_situacao` (padrão de VIEW); `current_user_tenant_id()`/`default_obra10_tenant_id()`/`hub_atualizar_timestamp()`; `cockpit-aggregate.ts` (+1 bloco degradável); `CopilotoVoz`/`acaoPendente`; `requireCrmSessao`/`crmDb`/`isMissingPgColumn`. **Reconcilia previsto×real:** previsto=`valor_contrato` (E2) × orçado=`hub_obra_orcamento_itens` × comprado=`hub_pedidos_material` (E5) × pago=`hub_obra_pagamentos` (E6). `hub_contas_pagar` **não** é reusado (CRM genérico sem obra_id) — fica intocado. **Novo mínimo:** 3 tabelas + 1 VIEW + 2 RPCs (SECURITY DEFINER c/ guard tenant) + 1 cron de atraso + expansão de CHECK + 4 tools + 1 bloco no cockpit. Migração: `supabase/migrations/20260730120000_e6_orcamento_pagamento.sql` (aditiva, reversível).

---

## AUDITORIA das decisões

**🔴 CRÍTICO 1 — Vazamento cross-tenant em `hub_aprovacoes` (CONFIRMADO no código, não suposto).** Li `lib/ia/aprovacoes.ts`: `buscarAprovacoesPendentes()` (ln 53) filtra **só** `.eq("status","pendente")` — sem `tenant_id`. `aprovar`/`rejeitar` filtram só `.eq("id", ...)`. As 3 lentes sinalizaram (memória obs 9218) e a 4ª (ai-engineer) propôs contornar pelo endpoint. **Veredito do CEO: contornar não basta.** E6 amplia o blast radius desse gate para DINHEIRO — um tenant veria/aprovaria orçamento e pagamento de outro. **`.eq('tenant_id')` puro + guard 404 em `buscarAprovacoesPendentes`/`aprovar`/`rejeitar` é PRÉ-REQUISITO de go-live de E6, não opcional.** Fix cirúrgico (passar `tenantId` como argumento), não refactor. **Bloqueador.**

**🟡 ATENÇÃO 2 — Conflito de naming/ordem entre lentes.** Backend-architect usa `20260730120000`; ai-engineer usa `20260712000000` (colidiria com E2 `20260710120000` por proximidade e quebraria a ordem E2→E5→E6). **Decisão: `20260730120000`** (depois de E5). Nomes de tabela: padronizar `hub_obra_orcamentos`/`hub_obra_orcamento_itens`/`hub_obra_pagamentos` (prefixo `hub_obra_*`, consistente com E2/E0), **não** `hub_orcamento_itens`/`hub_pagamentos` soltos (product-owner).

**🟡 ATENÇÃO 3 — Conflito com E1 (cockpit).** O bloco `lerPagamentosResumo` deve seguir EXATAMENTE o tipo já declarado: `pagamentosAVencer: number | null` (ln 96 — é `number|null`, **não** objeto). A lente ai-engineer propôs trocar para objeto `{a_pagar, vencendo_7d, atrasado}` — isso **muda a assinatura do tipo** e pode quebrar consumidores de E1. **Decisão:** manter `pagamentosAVencer: number` (o total) e adicionar os detalhes em campo NOVO `financeiro?: {...}` aditivo, preservando E1. Verificar o componente consumidor antes de codar (médio risco, confirmar com `tsc`).

**🟢 Conflito com E2/E5 — nenhum real.** E6 só LÊ `valor_contrato` (E2) e referencia E5 para reconciliação; ambas FKs nullable → E6 degrada se E2/E5 ausentes. Aditivo puro.

**Regra de tenant:** todas as tabelas novas com RLS `tenant_id=current_user_tenant_id()` + policy anon `default_obra10_tenant_id()`; VIEW `security_invoker=true`; RPCs SECURITY DEFINER com guard `WHERE tenant_id=p_tenant_id` antes de qualquer mutação; endpoints `.eq('tenant_id')` puro + 404. Conforme. **Exceto** o furo herdado de `hub_aprovacoes` (Crítico 1).

**Regra de ouro (humano aprova):** preservada em 2 gates (orçamento E pagamento), ambos por `hub_aprovacoes`, IA nunca fecha, voz só enfileira. Fiel à planilha ("Aprovado libera") e à spec ("Pagamento exige aprovação humana"). Conforme.

## Critério de PRONTO

1. Migração `20260730120000` aplicada (aditiva, reversível por DROP); `tsc` + `vitest` + `_chk23` verdes.
2. **Fix de tenant em `hub_aprovacoes` aplicado e testado** (bloqueador — sem ele não vai a prod).
3. Criar orçamento (rascunho) → enviar → aprovar na fila (gate) → status vira `aprovado` → pagamento vinculado fica liberável; pagamento sem orçamento aprovado retorna 422. Verificado clicando no navegador.
4. Cockpit E1 §4 acende com dado real quando há pagamentos; volta a "chega em breve" sem a tabela (degradação testada).
5. Compatibilização mostra 🟢/🟡/🔴 + % correto, incluindo item sem `valor_contrato` ("—%", não NaN).
6. Conversacional: leitura auto-exec responde "quanto falta pagar"; "aprova o orçamento" NÃO executa, só enfileira/abre fila.
7. Mobile: gates como bottom-sheet, 3 baldes em grid, botões ≥56px.

## O que precisa da janela do dono

1. **Aplicar a migração em prod** (única ação irreversível-sem-rollback-trivial → backup antes). Bloqueio de aprovação humana.
2. **Adiantamento sem orçamento aprovado**: permitido com flag explícito (design) ou bloqueado? Decisão de negócio.
3. **Alçada por valor** (ex.: até R$5k gestor, acima diretor): o modelo suporta via `papel` na aprovação, mas a regra precisa ser configurada.
4. **Política de aditivo**: cobertura >100% = 🟢 "aditivo" (design) vs. alerta?
5. **Confirmar o fix de tenant em `hub_aprovacoes` antes de E6** (é segurança/dado sensível — o dono sempre verifica achados de integridade).

Arquivos-âncora (design-only, nada editado): `supabase/migrations/20260523120000_crm_integral_core.sql` (hub_aprovacoes ln 139-141), `supabase/migrations/20260710120000_e2_obra_itens.sql` (valor_contrato ln 90), `lib/ia/aprovacoes.ts` (furo de tenant ln 53/159/202 — FIX pré-requisito), `app/api/aprovacoes/[id]/route.ts` (cascata existente), `lib/crm/cockpit-aggregate.ts` (pagamentosAVencer:null ln 375, temFinanceiro:false ln 390), `docs/insumos-do-dono/ANALISE-planilha-gestao-obra.md` (Orcamentos/Pagamentos/Compatibilizacao). Migração-alvo: `supabase/migrations/20260730120000_e6_orcamento_pagamento.sql`.