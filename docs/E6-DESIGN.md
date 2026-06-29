# E6 REVISADO (financeiro + 2 modelos de contrato + ESCROW) — Design ideal (mesa redonda)

> Substitui o E6 generico anterior. tipo_contrato imutavel (admin=unitario/preco fechado=totais) + escrow dual-approval. PRE-REQUISITO: fix do vazamento tenant em lib/ia/aprovacoes.ts.

Tenho os dois documentos. O insumo do dono e o E6 anterior estão claros, e as 4 lentes desenharam o financeiro+escrow com chão de código verificado. Produzo o E6 revisado agora.

## Financeiro + Escrow (E6 revisado) — design ideal

> Reescreve `docs/E6-DESIGN.md`. O E6 anterior estava certo na engenharia (orçamento→pagamento+compatibilização, gate dourado), mas **neutro quanto ao modelo de negócio**. O dono trouxe 2 eixos que mudam o **produto**: (1) `tipo_contrato` imutável bifurca o que cada parte VÊ; (2) ESCROW = custódia + liberação por **aprovação dupla** (arquitetura + Hub). O escrow não é feature financeira — é o mecanismo de **confiança** que vende o produto ("somos juízes"), e o spread tem que ser **honesto** ou dispara o medo que viemos curar.

**Bloqueador herdado e confirmado no código real:** `lib/ia/aprovacoes.ts` — `buscarAprovacoesPendentes()` (ln 53), `aprovar()` (ln 159), `rejeitar()` (ln 202) filtram sem `.eq('tenant_id')`. E6 leva **dinheiro** para esse gate → um tenant aprovaria escrow de outro. **Fix de tenant é pré-requisito de go-live, não opcional.** (CEO: confirmar com o dono — é segurança/dado sensível.)

---

### Eixo tipo de contrato (administração unitário x preço fechado totais)

`tipo_contrato` é atributo da **obra** (`hub_obras`), escolhido no fechamento do contrato, **IMUTÁVEL após o 1º orçamento aprovado**. É vocabulário do dono — eng. civil + corretor que viveu os dois modelos — então aparece com as palavras dele.

| | **ADMINISTRAÇÃO** (campo "gerenciamento") | **PREÇO FECHADO** (turn-key) |
|---|---|---|
| Cliente vê | valor **UNITÁRIO** de tudo (gestão aberta) | só **TOTAIS** por etapa/medição |
| Composição interna | exposta (qtd × unitário) | da executante, **nunca exibida** |
| Paga | cada item aprovado | por avanço × valor da etapa |
| Compatibilização | item a item | por frente/etapa |
| Spread | declarado por linha ("gerenciamento %") | embutido no total (legítimo no turn-key) |

**Decisão de arquitetura (CEO): a bifurcação é na APRESENTAÇÃO, não no schema.** Um campo no dado, duas telas. O schema é único (`hub_obra_orcamentos` existe para ambos); o que muda é (a) `valor_total` derivado de itens (administração) vs. lump sum (preço fechado), (b) o filtro de visibilidade no endpoint do Portal. Isso entrega 2 JOBs distintos sem explodir esforço — rejeita-se duplicar tabelas (a tentação das lentes PO/ai-engineer).

Imutabilidade **sem trigger** (evitar magia oculta): guard no endpoint `PATCH /api/crm/obras/[id]` → se `COUNT(hub_obra_orcamentos WHERE obra_id) > 0` e payload contém `tipo_contrato` → `422 tipo_contrato_imutavel`. Regra visível no código + documentada no `COMMENT` da coluna.

---

### Modelo de dados (orçamento + pagamento + ESCROW custódia/liberação dupla)

Migração aditiva `supabase/migrations/20260730120000_e6_financeiro_contrato_escrow.sql`. Ordem: E0 → E2 → E5 → **E6**.

**1. ALTER hub_obras — o eixo**
```sql
ALTER TABLE public.hub_obras
  ADD COLUMN IF NOT EXISTS tipo_contrato TEXT NOT NULL DEFAULT 'administracao';
ALTER TABLE public.hub_obras DROP CONSTRAINT IF EXISTS hub_obras_tipo_contrato_check;
ALTER TABLE public.hub_obras ADD CONSTRAINT hub_obras_tipo_contrato_check
  CHECK (tipo_contrato IN ('administracao','preco_fechado'));
COMMENT ON COLUMN public.hub_obras.tipo_contrato IS
  'IMUTÁVEL pós-1º orçamento aprovado (guard no endpoint, sem trigger).
   administracao=cliente vê unitário (gestão aberta); preco_fechado=turn-key, só totais.';
```

**2. hub_obra_orcamentos — cabeçalho/frente (unidade de aprovação — Gate 1)**
Mantém a decisão de granularidade do E6 anterior (2 níveis: cabeçalho por frente + linhas por item). Não armazena `tipo_contrato` — lê da obra (fonte única). Campos-chave novos sobre o E6 anterior: `versao` + `orcamento_pai_id` (aditivo), `aprovacao_id` (link ao gate), `escrow_status`.
```sql
CREATE TABLE IF NOT EXISTS public.hub_obra_orcamentos (
  id, obra_id FK CASCADE, tenant_id FK CASCADE,
  frente_id FK hub_obra_frentes_eap(E0) ON DELETE SET NULL,
  titulo TEXT, descricao TEXT,
  versao INTEGER DEFAULT 1, orcamento_pai_id UUID FK self,   -- aditivo
  valor_total NUMERIC(14,2),          -- adm: derivado dos itens; preço fechado: direto
  status TEXT DEFAULT 'rascunho'
    CHECK (status IN ('rascunho','enviado','aprovado','rejeitado','cancelado')),
  aprovacao_id UUID FK hub_aprovacoes, aprovado_em, aprovado_por,
  escrow_status TEXT DEFAULT 'sem_custodia'
    CHECK IN ('sem_custodia','aguardando_deposito','em_custodia','liberado','devolvido'),
  escrow_valor NUMERIC(14,2), escrow_ref TEXT,    -- fase 2
  criado_em, atualizado_em
);
-- RLS USING (tenant_id = current_user_tenant_id()); índices (obra,status)/(tenant)/(frente)
```

**3. hub_obra_orcamento_itens — linha/item (fidelidade unitária)**
Existe nos dois tipos, mas `visivel_cliente` controla exposição. Composição interna (`custo_material`/`custo_mao_obra`/`margem_pct`) preenchida no preço fechado para auditoria do Hub, **filtrada pelo endpoint** antes de chegar ao Portal.
```sql
CREATE TABLE IF NOT EXISTS public.hub_obra_orcamento_itens (
  id, orcamento_id FK CASCADE, obra_id FK, tenant_id FK,
  item_id UUID FK hub_obra_itens(E2) ON DELETE SET NULL,   -- base da compatibilização
  descricao TEXT, unidade TEXT, quantidade NUMERIC(10,3),
  valor_unitario NUMERIC(14,4),
  valor_total NUMERIC(14,2) GENERATED ALWAYS AS (ROUND(quantidade*valor_unitario,2)) STORED,
  spread_pct NUMERIC(5,2) DEFAULT 0,   -- "gerenciamento" honesto (adm); auditável
  custo_material, custo_mao_obra, custo_outros, margem_pct,  -- interno; nunca ao cliente em preço fechado
  visivel_cliente BOOLEAN DEFAULT true, ordem INTEGER, criado_em
);
-- RLS por tenant; índices (orcamento,ordem)/(item)/(tenant)
```

**4. hub_obra_pagamentos — parcela vinculada à frente aprovada (Gate 2 + escrow)**
```sql
CREATE TABLE IF NOT EXISTS public.hub_obra_pagamentos (
  id, obra_id FK, tenant_id FK, orcamento_id FK SET NULL, item_id FK SET NULL,
  titulo TEXT, tipo TEXT DEFAULT 'medicao'
    CHECK IN ('medicao','adiantamento','retencao','aditivo','reembolso','avulso'),
  numero_medicao INTEGER,
  valor NUMERIC(14,2), valor_retencao DEFAULT 0,
  valor_liquido GENERATED ALWAYS AS (valor - valor_retencao) STORED,
  valor_pago NUMERIC(14,2), data_vencimento DATE NOT NULL, data_pagamento DATE,
  -- estado: 'atrasado' é DERIVADO na UI (status liberável + venc<hoje), NÃO coluna (fonte única)
  status TEXT DEFAULT 'bloqueado'
    CHECK IN ('bloqueado','liberado','autorizado','em_custodia','pago','cancelado'),
  -- GATE 2 DUPLO: dois links de aprovação, papéis distintos
  aprovacao_arq_id UUID FK hub_aprovacoes,   -- chave 1: arquitetura
  aprovacao_hub_id UUID FK hub_aprovacoes,   -- chave 2: Hub (juiz)
  escrow_liberado BOOLEAN DEFAULT false, escrow_liberado_em, escrow_liberado_por,
  tipo_contrato TEXT DEFAULT 'administracao',  -- desnorm p/ relatório
  adiantamento_justificativa TEXT,   -- obrigatório se tipo='adiantamento' (CHECK)
  fornecedor_id, fornecedor_nome, criado_por, decidido_por, criado_em, atualizado_em
);
ALTER TABLE ... ADD CONSTRAINT chk_adiantamento_just
  CHECK (tipo <> 'adiantamento' OR adiantamento_justificativa IS NOT NULL);
-- append-only: nunca DELETE → status='cancelado' (soft)
-- índice parcial cockpit: (tenant,status,data_vencimento) WHERE status IN ('liberado','autorizado','em_custodia')
```

**5. ESCROW — extrato imutável (a peça nova, núcleo da confiança)**
A custódia precisa de **lastro append-only** (o "nada se perde" do dono vira extrato que o cliente vê). 1 conta por obra + movimentos só-INSERT.
```sql
CREATE TABLE hub_obra_escrow_contas (   -- 1 por obra
  id, obra_id FK, tenant_id FK,
  saldo_custodia DEFAULT 0, saldo_liberado DEFAULT 0, saldo_pago DEFAULT 0,
  provedor TEXT DEFAULT 'interno',   -- MVP=virtual/contábil; fase2='banco_x'
  criado_em
);
CREATE TABLE hub_obra_escrow_movimentos (   -- APPEND-ONLY, nunca UPDATE/DELETE
  id, conta_id FK, obra_id FK, tenant_id FK,
  tipo TEXT CHECK IN ('deposito','liberacao','pagamento','estorno'),
  valor NUMERIC(14,2), pagamento_id FK SET NULL,
  aprovacao_arq_id FK, aprovacao_hub_id FK,   -- as 2 chaves que liberaram
  origem TEXT, criado_por TEXT, criado_em
);
-- RLS por tenant em ambas; movimentos é o lastro auditável do escrow
```

---

### ESCROW: aprovação dupla (arquitetura + Hub) via hub_aprovacoes + evento

**Reuso do gate dourado.** Confirmado no código: `hub_aprovacoes.tipo` CHECK ainda são os 5 originais (`'proposta','pedido_material','pagamento','desconto','outro'`) — nunca expandido. DROP+ADD:
```sql
ALTER TABLE public.hub_aprovacoes DROP CONSTRAINT IF EXISTS hub_aprovacoes_tipo_check;
ALTER TABLE public.hub_aprovacoes ADD CONSTRAINT hub_aprovacoes_tipo_check
  CHECK (tipo IN ('proposta','pedido_material','pagamento','desconto','outro',
                  'orcamento_frente',     -- GATE 1
                  'pagamento_obra_arq',   -- GATE 2 chave 1
                  'pagamento_obra_hub')); -- GATE 2 chave 2
ALTER TABLE public.hub_aprovacoes ADD COLUMN IF NOT EXISTS obra_id UUID FK SET NULL;
CREATE INDEX idx_hub_aprovacoes_tenant_status ON public.hub_aprovacoes(tenant_id,status);
```

**A aprovação dupla = DOIS registros** em `hub_aprovacoes` ligados ao MESMO pagamento (`aprovacao_arq_id` + `aprovacao_hub_id`), papéis distintos. O escrow só libera (INSERT movimento `liberacao` + `status='autorizado'`) quando **ambos** estão `aprovado`. CEO decide entre as 2 propostas das lentes: **dois registros tipados** (PO) em vez de um registro com `dados.papel_X` (backend) — porque dois registros aparecem naturalmente na fila existente `/crm/aprovacoes`, cada papel filtra o seu, e o blast radius do JSONB mutável fica fora.

**Diagrama de estados do pagamento:**
```
BLOQUEADO ──(Gate 1: orçamento da frente aprovado)──► LIBERADO
                                                          │
                                          (Gate 2 chave 1: ARQUITETURA aprova) ✓
                                                          │  [aguarda 2ª chave]
                                          (Gate 2 chave 2: HUB aprova) ✓
                                                          │
                                                     AUTORIZADO ──► PAGO
                                                          │  (fase 2: EM_CUSTODIA → PAGO)
                                          CANCELADO (a qualquer momento antes de PAGO)
```

**Cascata reusa o ponto de extensão existente** `executarAcaoAprovada()` + `PATCH /api/aprovacoes/[id]` (que já faz cascata para `cotacao_fornecedor`). 3 ramos novos no switch:
- `orcamento_frente` → `rpc_aprovar_orcamento_frente()`: marca orçamento `aprovado` + pagamentos vinculados `bloqueado → liberado`.
- `pagamento_obra_arq` / `pagamento_obra_hub` → ao aprovar, chama `rpc_liberar_escrow()`: se as DUAS chaves estão `aprovado` → libera; senão aguarda a segunda.

**2 RPCs `SECURITY DEFINER` com guard de tenant ANTES de qualquer mutação** (porque `crmDb`/PATCH usam service_role e bypassam RLS):
```sql
rpc_aprovar_orcamento_frente(p_orcamento_id, p_aprovacao_id, p_tenant_id)
  → SELECT ... WHERE id=p_orcamento_id AND tenant_id=p_tenant_id; NOT FOUND → {ok:false}
  → UPDATE orcamento SET status='aprovado'
  → UPDATE pagamentos SET status='liberado' WHERE orcamento_id=... AND status='bloqueado'

rpc_liberar_escrow(p_pagamento_id, p_tenant_id)
  → guard tenant; lê status de aprovacao_arq_id E aprovacao_hub_id (ambos com tenant guard)
  → se arq≠'aprovado' OR hub≠'aprovado' → {ok:false, erro:'aprovacao_dupla_incompleta', arq, hub}
  → UPDATE pagamento SET status='autorizado', escrow_liberado=true, escrow_liberado_por='duplo'
  → INSERT escrow_movimento (tipo='liberacao', as 2 chaves) + INSERT log auditoria (append-only)
```
**Atenção de implementação (achado real):** o PATCH usa `status==='aprovado'/'rejeitado'` mas convém confirmar o CHECK de `hub_aprovacoes.status` antes de codar a RPC — alinhar para o vocabulário que o código já usa, com UPDATE dos dados existentes se necessário.

**A IA NUNCA é nenhuma das 2 chaves.** Prepara o card, enfileira; o humano clica. "Aprovar/liberar escrow por voz" = proibido (espelha E5).

---

### Telas por tipo de contrato + escrow visível + ASCII

Aba **Financeiro** em `/crm/obras/[id]`. Segmented control com rótulos que mudam por tipo. **Faixa-selo de contrato fixa no topo** (cadeado dourado 🔒 = imutável, combate o medo de troca escondida). Tokens dark verde+dourado existentes, mobile-first, gates como bottom-sheet, botões ≥56px. Reusa a paleta canônica de `app/crm/aprovacoes/page.tsx` (`C.green #003b26`, `C.gold #c9a24a`, `C.red #b3261e`).

```
ADMINISTRAÇÃO: [Custos][Aprovações N][Custódia][Pagamentos][Cobertura]
PREÇO FECHADO: [Etapas][Aprovações N][Custódia][Medições][—]
```

**T1a — CUSTOS · ADMINISTRAÇÃO (unitário, livro aberto, spread honesto):**
```
┌─ Financeiro · Consulado Itália ── 🔒 ADMINISTRAÇÃO · livro aberto ──┐
│ [Custos✓][Aprovações 2][Custódia][Pagamentos][Cobertura]            │
│ Previsto R$1.84M · Orçado R$1.20M · Aprovado R$980k                 │
│ ✨ "R$640k esperam aprovação em 3 frentes" [ver fila ▸]            │
│ ▾ CIVIL · A8 ─────────────────────── R$420k · 🟢 Aprovado          │
│   • Revest. cerâmico 120m² × R$85/m²              = R$10.200  🟢    │ ← UNITÁRIO visível
│   • Cabo 2,5mm 400m × R$4,20 (atacado)            = R$1.680   🟢    │
│   ⓘ gerenciamento 8% declarado · -8% vs varejo (R$890 poupados) ✨ │ ← spread HONESTO = economia
│ ▾ ELÉTRICA ───────────────────────── R$310k · 🟡 pendente          │
│   • Quadro QD A9 1un × R$45.000                   = R$45.000  ⏳    │
│   [Enviar p/ aprovação dupla ▸]   ← gate dourado                    │
│ ⚠ Aprovar é ato HUMANO + DUPLO (arquitetura + Hub)                 │
└─────────────────────────────────────────────────────────────────────┘
```

**T1b — ETAPAS · PREÇO FECHADO (só totais, sem composição):**
```
┌─ Financeiro · Res. Alphaville ── 🔒 PREÇO FECHADO · turn-key ──────┐
│ [Etapas✓][Aprovações 1][Custódia][Medições][—]                     │
│ Contrato R$680k · Liberado R$272k · Saldo R$408k                   │
│ ████████████░░░░░░░░░  40% executado · 40% liberado                │
│ Etapa 1 · Fundação+Estrutura ── R$204k · 🟢 pago via custódia 28/mai│ ← SÓ total da etapa
│ Etapa 2 · Alvenaria+Cobertura ─ R$170k · 🟢 em custódia, liberando  │
│ Etapa 3 · Instalações ───────── R$136k · 🟡 65% · aguarda medição Hub│
│ Etapa 4 · Acabamento ────────── R$170k · ⚪ a iniciar              │
└─────────────────────────────────────────────────────────────────────┘
```
(ZERO valor unitário/composição — é da executante. Se o dado vier, o render ignora.)

**T2 — CUSTÓDIA (ESCROW) · a tela que CURA o medo (ambos os tipos):**
```
┌─ Custódia (Escrow) · Consulado Itália ─────────────────────────────┐
│ 🛡 Seu dinheiro fica protegido. Só sai com dupla aprovação.        │
│   ╭ R$420k ╮  ╭ R$180k ╮  ╭ R$272k ╮                              │
│   │EM      │  │AGUARDA │  │LIBERADO│                               │
│   │CUSTÓDIA │  │APROVAÇ.│  │ ✅     │                               │
│   ╰──🔒────╯  ╰──⏳────╯  ╰──✓─────╯                              │
│ Fluxo de cada liberação:                                           │
│   Depósito ─▶ Aprov. Arquitetura ─▶ Aprov. Hub ─▶ Liberado        │
│     🟢          🟢                    ⏳ aqui        ⚪             │
│ Extrato (imutável):                                                │
│  29/jun Liberação · Medição M2 · R$32.000 · 🔑arq✓ 🔑hub✓         │
│  28/jun Depósito  · Aporte cliente        · R$200.000             │
└─────────────────────────────────────────────────────────────────────┘
```
A timeline de 4 passos torna a dupla aprovação tangível ("onde está meu dinheiro agora"). **MVP: os cofres são CALCULADOS dos status de aprovação** (sem banco real) — a tela diz "custódia (controle do Hub)", nunca promete conta bancária até a fase 2 (honestidade, ou vira a mentira que o produto combate).

**T3 — Fila de Aprovações (gate dourado DUPLO — reusa `/crm/aprovacoes` com filtros):**
```
┌─ Aprovações · 3 pendentes ─[💰Orçamento 2][💳Pagamento 1]──────────┐
│ ┌ 💰 ORÇAMENTO · Elétrica · R$310.000 · ADMINISTRAÇÃO ────────────┐│ ← borda dourada 3px
│ │ ✨ IA 88%: dentro do contrato · cobertura 100%                  ││
│ │ ⚠ Aprovar LIBERA os pagamentos desta frente                     ││
│ │ Dupla: 🟢 Arquiteto OK · ⏳ falta VOCÊ (Hub)                    ││ ← estado da dupla no card
│ │ [Rejeitar ✗]                          [Aprovar (Hub) ✓]         ││
│ ┌ 💳 PAGAMENTO · Medição M3 · R$84.000 · vence 5d ───────────────┐│
│ │ Escrow: aguarda aprovação dupla                                 ││
│ │ Aprovado arquitetura: ✅   Aprovado Hub: ⏳                     ││
│ │ [Aprovar como Hub ✓]                                            ││
│ ┌ 💳 PAGAMENTO · Medição M2 ── BLOQUEADO ─────────────────────────┐│
│ │ ⛔ orçamento da frente ainda não aprovado                        ││ ← edge VISÍVEL
│ │ [Ir p/ gate de orçamento ›]      [Autorizar](desabilitado)      ││
└─────────────────────────────────────────────────────────────────────┘
```
O pill "Dupla: 🟢 Arquiteto · ⏳ Hub" é o coração do redesign — mostra em qual das 2 portas o item está; o rótulo do botão roda conforme quem falta.

**T4 — Pagamentos (3 baldes fiéis à planilha + estado escrow; em preço fechado vira "Medições"):**
```
┌─ Pagamentos ─[A pagar R$210k][Vence 7d 🟡 R$84k][Atrasado 🔴 R$32k][Pago]─┐
│ 🔴 ATRASADO 4d · Medição M2 · Civil · R$32.000 · ConstruMax              │
│    🛡 em custódia · 🟢🟢 dupla OK   [Liberar pagamento ▸][Renegociar]    │
│ 🟡 VENCE 5d · Medição M3 · Elétrica · R$84.000 · ⏳ falta Hub            │
│ ⚪ A PAGAR · ART/CREA · R$1.200 · avulso (sem escrow)                    │
│ [+ Lançar] (habilita só com orçamento aprovado OU adiantamento+justif.)  │
└───────────────────────────────────────────────────────────────────────────┘
```
`atrasado` = `status IN ('liberado','autorizado') AND data_vencimento < hoje` — derivado na UI, confirmado por job diário (uma fonte de verdade). Item avulso "sem escrow" explícito (honestidade).

**T5 — Compatibilização/Cobertura (🟢🟡🔴 + %, VIEW; só ADMINISTRAÇÃO):**
```
┌─ Cobertura · 72% coberto ─[🔴 Sem orç. 6][🟡 Pendente 3][🟢 OK 41]──┐
│ ╭ 72% ╮ 132 de 164 itens · gap R$280k sem orçamento                 │
│ 🔴 Esquadrias A9   prev R$120k · orç R$0   · —%  [✨ Orçar][Orçar▸] │ ← CTA fecha o loop
│ 🟡 Quadro elétrico prev R$45k  · orç R$30k · 67% [Completar▸]        │
│ 🟢 Concretagem     prev R$120k · orç R$120k· 100% ✓                  │
│ 🟢 Alvenaria+adit. prev R$80k  · orç R$95k · 119% [aditivo] ← badge  │
└──────────────────────────────────────────────────────────────────────┘
```
Vermelho primeiro (o gap é o motivo da tela existir). 3 estados (não 2): 🟡 evita "orçamento não-aprovado parecer coberto".

---

### Compatibilização (cobertura) + cockpit Pagamentos

**VIEW `vw_hub_obra_compatibilizacao` `WITH (security_invoker=true)`** (padrão de `vw_hub_obra_itens_situacao` do E2). Base = `hub_obra_itens` (E2, `valor_contrato` nullable) `LEFT JOIN LATERAL` melhor-orçamento (aprovado primeiro, senão pendente mais recente) `LEFT JOIN` totais pagos. `WHERE ativo=true AND parent_id IS NULL` (só itens-pai). 3 estados + `pct_cobertura = CASE WHEN valor_contrato IS NULL OR =0 THEN NULL ELSE orçado/contrato*100`. `eh_aditivo = orçado > contratado` (badge, não erro). Endpoints filtram `tenant_id` explicitamente.

**Cockpit E1 acende §4** — confirmado: `cockpit-aggregate.ts` tem `pagamentosAVencer: null` (ln 375) e `temFinanceiro: false` (ln 390) hardcoded, com `ehAusenciaDeSchema` (ln 58) pronto. Adiciona **1 bloco `lerPagamentosResumo()`** no molde de `lerPedidosAbertos` (Promise.all):
- Lê 3 baldes de `hub_obra_pagamentos`, `.eq('tenant_id', tenantId).in('obra_id', obraIds)` puro.
- Schema ausente → `ehAusenciaDeSchema` → `null` → `temFinanceiro` segue `false` → §4 "chega em breve". **Zero quebra.**
- Com dado: **preserva a assinatura `pagamentosAVencer: number | null`** (ln 96) = total; detalhe vai em campo **NOVO aditivo** `financeiro?: {a_pagar, vencendo_7d, atrasado, em_custodia, aguarda_2a_chave}`. (CEO: a lente ai-engineer queria trocar o tipo para objeto — **rejeitado**, quebraria consumidores de E1.)
- §4 também mostra escrow: "R$420k em custódia · R$84k aguardam 2ª chave".

**Regra de ouro no cockpit: §4 nunca tem [Pagar] — só [Abrir] → T4/T3** onde o gate duplo mora. O Hoje mostra, não paga. §4 oculta por papel (cliente vê só os pagamentos dele).

**Job diário** (`0 3 * * *`) é fonte de verdade do balde de vencimento; entre execuções a UI deriva localmente para não enganar o usuário.

---

### Spread honesto

O medo do dono é "ser enganado" — markup escondido dispara exatamente isso. Regra de produto:
- **Administração (gestão aberta):** spread é OBRIGATORIAMENTE visível — `spread_pct` por linha rotulado "gerenciamento", exibido como **economia** ("-8% vs varejo, R$890 poupados", ganho de volume/atacado), nunca como markup. Guard de UI: administração não renderiza item sem o spread declarado.
- **Preço fechado (turn-key):** a composição é da executante; o spread está embutido no total e isso é legítimo — mas `margem_pct` interno é **auditável pelo Hub** (engenharia auditorial: "somos juízes"), nunca exibido ao cliente.

Isso materializa "spread HONESTO (volume/atacado, não markup escondido)" do insumo.

---

### MVP vs fase 2 (custódia bancária)

**MVP (go-live) — entrega a CONFIANÇA com o que já existe; o banco é encanamento, vem depois:**
- `tipo_contrato` + bifurcação de tela (1 enum + 2 modos de render). ALTO impacto, BAIXO esforço.
- Gate DUPLO via `hub_aprovacoes` (2 registros tipados arq/hub) + expansão de CHECK + cascata no `executarAcaoAprovada`.
- **Escrow VIRTUAL/contábil** (`provedor='interno'`): conta + movimentos append-only só no nosso banco; "custódia" é estado contábil, não dinheiro em banco real. Entrega T2 + extrato — a regra de confiança SEM risco financeiro/regulatório.
- `vw_hub_obra_compatibilizacao` + cockpit §4 acende + 4 tools IA + job diário.
- Spread honesto declarado.
- **Fix de tenant em `lib/ia/aprovacoes.ts` (BLOQUEADOR, antes de go-live).**

**FASE 2 (tração + parceiro bancário — exige janela do dono: custo + credencial + compliance):**
- Custódia BANCÁRIA real (BaaS/conta escrow), webhook de depósito → `em_custodia`, repasse automático no gate duplo → `pago`, devolução em cancelamento → `devolvido`, `escrow_ref` (ID externo), QR de depósito no Portal.
- Alçada por valor (ex.: até R$5k gestor / acima diretor) na 2ª chave.
- Split automático do spread.

> O que VENDE é "só paga o aprovado, dupla chave, extrato imutável". 100% entregável SEM banco. A custódia bancária é a evolução, não o pré-requisito.

---

### Reuso x novo · Edge cases

**Reusa (sem tocar):** `hub_aprovacoes` (só expande CHECK + add `obra_id`); `executarAcaoAprovada()` + `PATCH /api/aprovacoes/[id]` (cascata existente, +3 ramos); `hub_obra_itens.valor_contrato`/`parent_id`/`ativo` (E2, só lê); `hub_obra_frentes_eap` (E0, agrupador); `vw_hub_obra_itens_situacao` (padrão de VIEW); `current_user_tenant_id()`/`default_obra10_tenant_id()`/`hub_atualizar_timestamp()`; `cockpit-aggregate.ts` (+1 bloco degradável, assinatura preservada); `CopilotoVoz`/`acaoPendente`; `requireCrmSessao`/`crmDb`/`isMissingPgColumn`/`ehAusenciaDeSchema`; paleta e card dourado de `app/crm/aprovacoes`. `hub_contas_pagar` **não** reusado (CRM genérico sem obra_id), fica intocado.

**Novo mínimo:** `tipo_contrato` em `hub_obras`; 5 tabelas (orcamentos, orcamento_itens, pagamentos, escrow_contas, escrow_movimentos); 1 VIEW; 2 RPCs SECURITY DEFINER com guard tenant; 1 cron; expansão de CHECK; 4 tools; 1 bloco no cockpit. Migração `20260730120000` aditiva, reversível por DROP.

**Edge cases (todos cobertos):**
- **Sem orçamento:** item 🔴 na Cobertura, nunca trava, CTA [Orçar]; pagamento sobre item sem orçamento aprovado → `422 orcamento_nao_aprovado`, botão some.
- **Medição > contratado:** `422 medicao_excede_contrato` + aviso vermelho; override consciente com flag + justificativa, nunca silencioso. Em preço fechado, barra >100% com badge "excedente".
- **Aditivo:** `orcamento_pai_id` + `versao`; cobertura >100% = badge "aditivo" (legítimo, não erro). Em preço fechado, aditivo é o ÚNICO jeito de o total mudar → aprovação explícita.
- **Pagamento sem dupla aprovação = BLOQUEADO** (não some): mostra "falta 2ª chave (arq/Hub)"; `rpc_liberar_escrow` retorna `{ok:false, erro:'aprovacao_dupla_incompleta'}`; endpoint 403; escrow não libera com 1 chave.
- **tipo_contrato imutável:** `422 tipo_contrato_imutavel` se `COUNT(orcamentos)>0`; sem botão de editar na UI (cadeado 🔒).
- **Sem valor_contrato:** `pct_cobertura=NULL` → "—%", nunca NaN.
- **Migração pendente:** `ehAusenciaDeSchema` → `temFinanceiro=false` → "chega em breve"; endpoints 503 `{migracao_pendente:true}`; zero quebra.
- **Double-tap:** guard `WHERE status='pendente'` no RPC → `409 aprovacao_ja_processada`; idempotente.
- **Adiantamento sem orçamento:** permitido APENAS com `tipo='adiantamento'` + justificativa (CHECK); modal de confirmação explícita. **Política (permitir/bloquear/alçada) = decisão do dono.**
- **Preço fechado sem itens:** endpoint retorna `{itens:[]}`; UI não renderiza seção de itens; cobertura por frente.
- **Aprovador único (escritório pequeno = arq+Hub na mesma pessoa):** permitido, mas 2 atos separados em log (2 cliques conscientes), nunca 1 clique = 2 chaves (senão o gate duplo é teatro).
- **Pago excede orçado:** ⚠ badge na linha; não bloqueia (medições parciais legítimas); alertado no cockpit.

**Pendências para o dono (humano aprova dinheiro):** (1) confirmar o **fix de tenant** em `hub_aprovacoes` antes de E6 (bloqueador, segurança); (2) política de adiantamento sem orçamento; (3) alçada por valor na 2ª chave; (4) percentual/regra do spread de gerenciamento; (5) provedor bancário da fase 2; (6) imutabilidade desde a criação vs. tolerante em planejamento.

**Confiança:** ALTA na fidelidade ao dono (os 2 eixos vêm textuais do insumo 29/jun) e no chão de código (CHECK de `hub_aprovacoes` ainda os 5 originais, `cockpit-aggregate` ln 58/375/390, E2 `valor_contrato`, vazamento cross-tenant — todos verificados pelas lentes no código real). MÉDIA na custódia bancária (fase 2, depende de parceiro financeiro). Nada foi editado — é design. Arquivo-alvo da reescrita: `c:\Users\wende\Documents\escritorio-virtual-ramon\docs\E6-DESIGN.md`.