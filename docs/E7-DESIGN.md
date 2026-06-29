# E7 Medicao (boletim + gate medido<=contratado + retencao + margem) — Design (mesa redonda)

Tenho ground truth completo. Confirmo o ponto crítico do encaixe: `rpc_liberar_escrow` leva o pagamento a `autorizado`+escrow liberado, mas NÃO toca em nenhuma tabela de medição (não existe ainda). O E7 precisa que a aprovação dupla, ao liberar o escrow, marque também o boletim como `aprovado` — isso é o ramo novo na cascata. Decidi os pontos divergentes entre as 4 lentes. Produzo o design final.

# E7 Medição com gate — design ideal

> Reescreve `docs/E7-DESIGN.md`. As 4 lentes convergiram no essencial; divergiram em 3 pontos que decido abaixo como CEO/tech-lead, sempre fiel ao dono (medição justa, humano aprova, medido≤contratado) e ao **E6 real** (lido linha a linha: `numero_medicao`, `valor_retencao`, `aprovacao_arq_id/hub_id`, `rpc_liberar_escrow`, `custo_material/mao_obra/outros`, CHECK de `hub_aprovacoes` — todos confirmados no arquivo `20260730120000`).

**O que o E7 cura (o medo nº1 do dono = PERDER DINHEIRO):** hoje o pagamento E6 nasce de um `valor` digitado à mão com `tipo='medicao'` — nada garante que é justo, que não passou do contratado, nem que houve obra. A planilha do dono tem "% avanço SOLTO" (ANALISE linha 50), sem âncora nem prova. O E7 troca isso por um **boletim estruturado** que parte do `pct_avanco` real (E2), aplica o **gate medido≤contratado**, exige **evidência**, mostra **margem por frente**, e só então — com aprovação humana dupla — vira pagamento E6.

**Regra de ouro do encaixe (o E7 NÃO refaz o E6):** o boletim aprovado é a ORIGEM do pagamento. Ele CRIA `hub_obra_pagamentos` (com `tipo='medicao'`, `numero_medicao`, `valor`, `valor_retencao`, `orcamento_id`, `aprovacao_arq_id/hub_id` — campos que JÁ EXISTEM no E6) e daí em diante é 100% E6: gate duplo → `rpc_liberar_escrow` → extrato append-only. Uma só porta de dinheiro.

---

## Decisões de CEO sobre as divergências das lentes

1. **Gate duplo: NÃO inventar tipo novo de pagamento.** As lentes backend e ai-engineer propuseram criar o pagamento já com `aprovacao_arq_id/hub_id` e 2 registros `hub_aprovacoes`. **Correto e fiel ao E6** — mas o tipo do boletim NÃO deve ser `'medicao_aprovada'` solto. Uso o seam real do E6: a medição tem **um gate próprio** (`boletim_medicao`, aprovação interna "esta medição é justa?") que, ao ser aprovado, **cria o pagamento E6 bloqueado + as 2 chaves** (`pagamento_obra_arq`, `pagamento_obra_hub` — que já existem no CHECK do E6). Isso evita teatro: medição justa (1 ato) → pagamento (gate duplo E6, 2 atos). Adoto o faseamento da lente product-owner que torna isso o MVP.

2. **A aprovação dupla, ao liberar escrow, fecha o boletim.** `rpc_liberar_escrow` (E6, lida) NÃO conhece medição. O fechamento do boletim (`hub_medicoes.status='aprovado'`) acontece no **ramo da cascata** em `lib/ia/aprovacoes.ts` / `PATCH /api/aprovacoes/[id]`: após `rpc_liberar_escrow` retornar `ok`, faz `UPDATE hub_medicoes SET status='aprovado' WHERE pagamento_id = ...`. Não modifico `rpc_liberar_escrow` (zero toque no E6).

3. **Retenção: tabela própria `hub_medicao_retencoes` (lente backend), não só coluna.** Porque a retenção tem ciclo de vida próprio (retida→liberada no aceite definitivo, append-only) — uma coluna no boletim não modela a liberação futura. Mantenho `ALTER hub_obra_orcamentos ADD pct_retencao` (aditivo) como a regra configurável por frente.

4. **`custo_realizado` é entrada manual no E7-v1** (degrada honesto "custo não rastreado"). Integração com E5 (custo a partir de SCs) fica para E7-v2 — fiel à confiança MÉDIA das lentes nesse ponto.

---

## Modelo — boletim + gate + retenção + margem por frente + encaixe E6/E2

Migração aditiva `supabase/migrations/20260820120000_e7_medicao.sql`. Ordem real (timestamps): E0(20260705)→E2(20260710)→E5(20260720)→E6(20260730)→**E7(20260820)**. Marcador "NÃO aplicar — janela do dono". Padrão idêntico ao E6: RLS `current_user_tenant_id()`, trigger `hub_atualizar_timestamp()`, RPC `SECURITY DEFINER`+`REVOKE public,anon`+guard de tenant ANTES da mutação, VIEW `security_invoker=true`.

**1. `hub_medicoes` — o boletim (cabeçalho, 1 por período, append-only)**
```
id, obra_id FK CASCADE, tenant_id FK CASCADE,
numero INT,                              -- sequencial por obra · UNIQUE(obra_id,numero)
titulo, periodo_inicio DATE, periodo_fim DATE,
tipo_contrato TEXT,                      -- desnorm. da obra (render)
valor_bruto NUMERIC(14,2) DEFAULT 0,     -- Σ valor_medido dos itens (gravado no fechamento)
valor_retencao NUMERIC(14,2) DEFAULT 0,  -- Σ retenções por frente
valor_liquido GENERATED ALWAYS AS (valor_bruto - valor_retencao) STORED,
status TEXT DEFAULT 'rascunho'
  CHECK IN ('rascunho','em_revisao','submetido','aprovado','rejeitado','cancelado'),
aprovacao_id  FK hub_aprovacoes,         -- gate interno do boletim (tipo='boletim_medicao')
pagamento_id  FK hub_obra_pagamentos,    -- E6: criado no fechamento; link bidirecional
tem_evidencia BOOLEAN DEFAULT false, excede_contrato BOOLEAN DEFAULT false,
observacoes, rejeitado_motivo, criado_por, criado_em, atualizado_em
```
Append-only: boletim `aprovado` nunca é editado; correção = novo boletim N+1.

**2. `hub_medicao_itens` — a linha (o gate central)**
```
id, medicao_id FK CASCADE, obra_id FK, tenant_id FK,
item_id FK hub_obra_itens (E2) SET NULL,            -- a base do avanço
frente_id FK hub_obra_frentes_eap (E0) SET NULL,
orcamento_item_id FK hub_obra_orcamento_itens (E6) SET NULL,  -- o contratado
item_codigo, item_nome, disciplina_slug, unidade,  -- desnorm. p/ auditoria histórica
-- CONTRATADO (congelado na criação da linha — nada muda retroativamente):
valor_contratado NUMERIC(14,2),                     -- de hub_obra_orcamento_itens.valor_total
qtd_contratada NUMERIC(10,3),
-- MEDIDO neste período:
pct_avanco_anterior NUMERIC(5,2) DEFAULT 0,         -- acumulado até o BM aprovado anterior
pct_medido_acum NUMERIC(5,2) DEFAULT 0 CHECK (BETWEEN 0 AND 100),
pct_medido_periodo GENERATED ALWAYS AS
  (GREATEST(0, pct_medido_acum - pct_avanco_anterior)) STORED,  -- nunca negativo
qtd_medida_periodo NUMERIC(10,3),
valor_medido NUMERIC(14,2) DEFAULT 0,               -- pct_periodo × valor_contratado
-- GATE medido≤contratado:
excede_contrato GENERATED ALWAYS AS
  (valor_contratado IS NOT NULL AND valor_medido > valor_contratado) STORED,
aditivo_id FK hub_obra_orcamentos SET NULL,         -- aditivo aprovado libera o excedente
excede_justificativa TEXT,
-- EVIDÊNCIA obrigatória no submit (não no insert → rascunho sem foto é válido):
tem_evidencia BOOLEAN DEFAULT false, evidencia_urls TEXT[],
evidencia_tipo CHECK IN ('foto','laudo','rdo','medicao_topografica','outro'),
-- RETENÇÃO (calculada por frente):
valor_retencao NUMERIC(14,2) DEFAULT 0, pct_retencao_aplicado NUMERIC(5,2) DEFAULT 0,
-- MARGEM por frente (custo previsto × real):
custo_previsto NUMERIC(14,2),                       -- de orcamento_item (mat+mao_obra+outros, E6)
custo_realizado NUMERIC(14,2),                      -- entrada manual E7-v1 (NULL='não rastreado')
margem_real_pct GENERATED ALWAYS AS
  (CASE WHEN custo_realizado>0 AND valor_medido>0
        THEN ROUND((valor_medido-custo_realizado)/valor_medido*100,2) END) STORED,
origem CHECK IN ('manual','ia_sugerido','importado'), ia_confianca NUMERIC(5,2),
flag_ia TEXT, ordem INT, criado_em
CHECK (excede_contrato=false OR aditivo_id IS NOT NULL OR excede_justificativa IS NOT NULL)
```

**3. `hub_medicao_retencoes` — retenção por frente (ciclo próprio, append-only)**
```
id, medicao_id FK CASCADE, obra_id FK, tenant_id FK, frente_id FK SET NULL,
disciplina_slug, pct_retencao, valor_base, valor_retencao,
status CHECK IN ('retida','liberada','devolvida') DEFAULT 'retida',
liberado_em, liberado_por, observacoes, criado_em
```

**4. `ALTER hub_obra_orcamentos ADD COLUMN pct_retencao NUMERIC(5,2) DEFAULT 0`** — regra de retenção por frente (aditivo, `IF NOT EXISTS`, zero colisão com E6).

**5. Expansão do CHECK `hub_aprovacoes.tipo`** — o E6 já tem `boletim`? Não: o CHECK real do E6 (linha 289, lida) é `'proposta','pedido_material','pagamento','desconto','outro','orcamento_frente','pagamento_obra_arq','pagamento_obra_hub'`. E7 faz `DROP+ADD` adicionando **`'boletim_medicao'`** (o gate interno; as 2 chaves do pagamento já existem).

**6. VIEW `vw_hub_obra_margem_frente` `security_invoker=true`** — por `frente_id`: Σ `valor_contratado`/`valor_medido`/`custo_previsto`/`custo_realizado`, `margem_prevista_pct`, `margem_real_pct`, `desvio_margem_pts`, `itens_excedentes`, `alerta_estouro` (real < prevista −5pp). Base = `hub_medicao_itens` JOIN `hub_medicoes` WHERE `status='aprovado'`. `custo_realizado` NULL → margem real NULL ("—", nunca NaN). Endpoint ainda filtra tenant (dupla defesa — precedente do vazamento 28/jun).

**7. RPC `rpc_fechar_boletim_medicao(p_medicao_id, p_tenant_id)`** — o gate central. `SECURITY DEFINER`, guard tenant primeiro. Fail-closed em ordem: (a) boletim não-encontrado/status inválido → erro; (b) `COUNT(excede_contrato AND aditivo não-aprovado)>0` → `422 itens_excedem_contrato_sem_aditivo`; (c) algum item `tem_evidencia=false` → `422 evidencia_obrigatoria_faltando`; (d) `valor_bruto=0` → `422 boletim_sem_valor`. Se passa: consolida totais, popula `hub_medicao_retencoes` (lendo `pct_retencao` do orçamento da frente), cria **1 pagamento E6** (`tipo='medicao'`, `numero_medicao`, `valor=valor_bruto`, `valor_retencao`, `status='bloqueado'`) + **2 registros `hub_aprovacoes`** (`pagamento_obra_arq`/`pagamento_obra_hub`, pendentes), liga `pagamento_id`, status → `submetido`. Idempotente por status. **Não toca em `rpc_liberar_escrow`.**

**8. RPC `rpc_ia_pre_preencher_medicao(p_medicao_id, p_tenant_id)`** — lê `hub_obra_itens.pct_avanco` (E2) + melhor orçamento aprovado (E6) → cria itens em rascunho com `origem='ia_sugerido'`. `pct_avanco_anterior` = `MAX(pct_medido_acum)` dos BMs aprovados anteriores do item; só inclui itens com avanço NOVO (`pct_avanco > anterior`). `pct_medido_acum = LEAST(pct_avanco,100)` (nunca insere >100). `ia_confianca`: 90 (orçamento+evidência) / 70 (só orçamento) / 40 (sem orçamento) / 0 (excede). A IA NÃO submete, NÃO aprova, NÃO fornece evidência.

**Encaixe na cadeia (ASCII):**
```
CAMPO (E8 futuro: voz/foto)
   │
   ▼
hub_obra_itens.pct_avanco (E2) ──── o que aconteceu
   │
   ├─[IA lê: rpc_ia_pre_preencher]─► hub_medicao_itens (rascunho)  ◄─ valor_contratado de
   │                                  hub_medicoes (boletim)           hub_obra_orcamento_itens (E6)
   │                                       │
   │                          [Gestor revisa + GATE medido≤contratado + evidência]
   │                                       │
   │                          [rpc_fechar_boletim_medicao]
   │                            ├ valida gate + evidência + valor
   │                            ├ hub_medicao_retencoes (por frente)
   │                            ├ CRIA hub_obra_pagamentos (tipo='medicao', BLOQUEADO)   ◄── E6
   │                            └ CRIA 2× hub_aprovacoes (arq+hub, pendentes)            ◄── E6
   ▼                                       │
  status='submetido'         [Gate duplo HUMANO: arq aprova · hub aprova]  ── /crm/aprovacoes
                                           │
                              rpc_liberar_escrow (E6 — REUTILIZADO, zero toque)
                                           │
                              hub_obra_escrow_movimentos (liberação append-only)  ◄── E6
                              + ramo cascata: UPDATE hub_medicoes status='aprovado'
```
Nenhuma linha do E6 é modificada. O E7 só usa campos que já existem em `hub_obra_pagamentos` (verificado: `numero_medicao` ln160, `valor_retencao` ln162, `aprovacao_arq_id/hub_id` ln171-172) e reusa `rpc_liberar_escrow` (ln410) sem alteração.

---

## Telas (boletim + gate + financeiro por frente) + ASCII

6ª aba **Medição** em `/crm/obras/[id]` (Hoje·Itens·Cronograma·Financeiro·Compras·**Medição**). Tokens dark verde+dourado (`--obra-*`/`--brand-*`), paleta de `/crm/aprovacoes` (`C.green #003b26`, `C.gold #c9a24a`, `C.red #b3261e`), mobile-first, gate como bottom-sheet, alvos ≥56px.

**T1 — Boletim de Medição (cockpit + gate visual; IA pré-preenche do E2):**
```
┌─ Medição 3 · jun/2026 · Consulado Itália ────────── [🎤][Fechar boletim ★]┐
│ ✨ IA pré-preencheu 23 itens do avanço do campo · confiança 87% · 2 alertas │
│ Período 01–30/jun · Status ◉ EM REVISÃO                                     │
│ Bruto R$84.320 · Retenção 5% −R$4.216 · LÍQUIDO R$80.104                    │
│ [🔴 2 excedem contrato] [📷 3 sem evidência] [✅ 18 OK]                      │
│                                                                              │
│ ▼ CIVIL · A8/A9 ─────────────────────── R$42.000 · 2 excedentes 🔴          │
│  ┌ HAC8.01 · Concretagem A8 · contratado R$120k ───────────────────────┐   │
│  │ Anterior 60% ──► Medido 85% (+25pp) · R$30.000                       │   │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 85%  ┃100% contratado   🟢 OK   📷✅ evidência       │   │
│  ├──────────────────────────────────────────────────────────────────────┤   │
│  │ 🔴 HAC9.01 · Alvenaria A9 · contratado R$80k                         │   │
│  │ Anterior 90% ──► Medido 105% (+15pp) · R$12.000                       │   │
│  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓┃▓▓ 🔴 EXCEDE contrato (+5pp)                       │   │
│  │ ⚠ Medido > contratado. [Limitar a 100%] [Vincular aditivo▸] [Justificar]│ │
│  └──────────────────────────────────────────────────────────────────────┘   │
│ ▼ ELÉTRICA · A8 ───── HAE8.01 Spot · 40%→70% (+30pp) · R$8.500 📷✅          │
│                                                                              │
│ ⚠ Não dá pra fechar com 2 itens excedentes sem aditivo/justificativa        │
│ [Cancelar rascunho]                          [Fechar boletim ★] (inativo)    │
└──────────────────────────────────────────────────────────────────────────────┘
```
Gate visual: a barra tem o marcador do contratado (┃ em 100%); se medido transborda, fica vermelho e "Fechar boletim" desabilita até resolver. **Em preço fechado:** linhas viram "Etapa 65%→80%" (sem unitário; só % e total da etapa — defesa na query, igual E6).

**T2 — Financeiro por Frente (margem prevista × real):**
```
┌─ Financeiro por Frente · Consulado Itália ──── [Física|Financeira]──────────┐
│ ✨ IA: Elétrica com margem real abaixo do previsto (−8pp) · investigar       │
│ Σ Medido R$248k · Custo prev. R$180k · Custo real R$204k                    │
│ Margem prevista 27% · Margem real 18% 🔴 (−9pp)                            │
│ ▼ CIVIL ──────── Medido R$120k │ Prev 30% │ Real 28% 🟡 (−2pp) [dentro]     │
│ ▼ ELÉTRICA ───── Medido R$84k  │ Prev 22% │ Real 14% 🔴 (−8pp)             │
│   Custo prev R$65k · real R$72k · ✨ mão-de-obra +R$7k vs previsto          │
│   [Informar custo real] [Ver orçamento ▸]                                   │
│ ▼ HIDRÁULICA ─── Medido R$44k  │ Prev 31% │ Real — (custo não rastreado)     │
│   [Informar custo real ▸]                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```
`custo_realizado` é entrada do gestor; sem ele, margem real = "—" (honesto, não inventa). Vermelho primeiro (frente que comprime margem sobe ao topo).

**T3 — Fila de Aprovação (reusa `/crm/aprovacoes`, card dourado E6, +filtro medição):**
```
┌─ Aprovações · Medições ─[💊 Medição 2][💊 Medição 3]──────────────────────┐
│ ┌ 💊 MEDIÇÃO 3 · R$80.104 líquido · vence 30/jul ───── borda dourada 3px ──┐│
│ │ ✨ IA: 100% dentro do contrato · todas evidências OK · confiança 92%     ││
│ │ Dupla: 🟢 Resp. Técnico OK · ⏳ falta VOCÊ (Hub)                         ││
│ │ [Ver boletim completo ▸]                    [Aprovar como Hub ✓]         ││
│ ├ 💊 MEDIÇÃO 2 · R$32.000 · 🛡 dupla OK → escrow libera [Liberar ▸] ───────┤│
│ └────────────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────────┘
```
Reusa o pill "Dupla: 🟢 arq · ⏳ Hub" do E6. Só adiciona filtro `dados->>'medicao_id' IS NOT NULL`.

---

## IA (pré-preenche do avanço, flag de estouro, conversacional)

Matemática **local** em `lib/obras/medicao.ts` (puro, testável, funciona 100% sem Mistral); o Mistral só narra o resumo. 3 tools (padrão E2 `hub_obra_item_*`, injetadas com `rotaObra=true`), registradas em `HubAgenteFerramentaId` + `HUB_FERRAMENTA_ACESSO` + dispatcher `executar-ferramenta-ia.ts`:

- **`hub_obra_medicao_preparar`** (ESCRITA, gate dourado SEMPRE) — "monta a medição da elétrica do período" → chama `rpc_ia_pre_preencher_medicao` → card dourado ⟨Medição 3⟩⟨23 itens⟩⟨IA sugerido⟩ → Confirmar. Se houver excedentes, avisa antes ("2 itens excedem o contrato, precisam de revisão"). Entra em `COPILOTO_FERRAMENTAS_ESCRITA_FASE3`.
- **`hub_obra_medicao_resumo`** (LEITURA, auto) — "como está a medição 3?" → status, valor, flags ativas, pendências.
- **`hub_obra_margem_frente`** (LEITURA, auto) — "qual frente está comendo margem?" → lê `vw_hub_obra_margem_frente`, alerta se desvio >5pp.

`flag_ia` determinística (sem LLM): `medido_excede_contrato` (gate vermelho bloqueante) · `estouro_margem` (laranja, não-bloqueia) · `sem_evidencia` (amarelo bloqueante) · `retroativo` (avanço regrediu) · `ok`.

**Regras eternas:** a IA NUNCA fecha o boletim, NUNCA aprova o pagamento, NUNCA fornece evidência (prova é do campo, não suposição). "Aprovar medição por voz" = proibido (não está na allowlist — espelha E5/E6).

---

## Implantação aditiva (não quebrar E6/E2) + faseamento

**Pré-requisito confirmado no código:** o fix de tenant em `lib/ia/aprovacoes.ts` precisa estar aplicado antes de E7 levar dinheiro ao gate (E6 já o exige; obs 9779 alerta que a UI `/crm/aprovacoes` chama `/api/hub/aprovacoes` que ainda não tem a cascata de escrow E6 — **o E7 herda essa pendência: a cascata `boletim_medicao` + `pagamento_obra_*` precisa estar no endpoint que a UI realmente chama**).

**E7.0 — Dados + lógica pura (1 sem):** migração `20260820120000` (3 tabelas + `ALTER pct_retencao` + 2 RPCs + VIEW + CHECK `boletim_medicao`); `lib/obras/medicao.ts` (calcularGate, derivarMargem, classificarFlag — puro) + `lib/crm/medicao-aggregate.ts` (gêmeo de `cockpit-aggregate`); `medicao.test.ts` (gate excede, sem evidência, retenção, pré-preench idempotente, margem). Gate: `SELECT` real validando as 2 RPCs + VIEW no banco (não só tsc/isMissingPgColumn — precedente E1).

**E7.1 — Boletim + Gate (MVP que cura o medo) ★ (1 sem):** `GET/POST /api/crm/obras/[id]/medicoes`, `POST .../[num]/pre-preencher`, `PATCH .../[num]/itens/[id]`, `POST .../[num]/fechar`; aba Medição (T1, rascunho editável + gate visual); evidência obrigatória; cascata `boletim_medicao` → cria pagamento E6 → 2 chaves. Filtros `tenant_id`+`obra_id` puros (crmDb bypassa RLS). Degrada `migracao_pendente` sem quebrar E2/E6. **Entrega sem Mistral nem E5:** medição justa + gate + evidência + vira pagamento auditável.

**E7.2 — Aprovação dupla + fila (3d):** ramos em `executarAcaoAprovada` (`lib/ia/aprovacoes.ts`): `pagamento_obra_arq`/`pagamento_obra_hub` → `rpc_liberar_escrow` + `UPDATE hub_medicoes status='aprovado'` via `pagamento_id`. T3 (filtro medição em `/crm/aprovacoes`). Cockpit E1: campo aditivo `medicoes_pendentes: number|null` (assinatura preservada, null ignora — padrão degradável).

**E7.3 — Financeiro por frente + IA (3d):** `GET .../financeiro-frente`, T2; 3 tools no CopilotoVoz; alertas proativos no E1. `tsc 0` + `vitest` + `build` + `_chk23` + navegador (gate bloqueia, pré-preenche, aprovação dupla, escrow libera) + desktop/mobile.

**Arquivos novos:** `supabase/migrations/20260820120000_e7_medicao.sql`; `lib/obras/medicao.ts`; `lib/crm/medicao-aggregate.ts`; `app/crm/obras/[id]/medicao/page.tsx` + `financeiro/page.tsx`; `components/obras/{MedicaoBoletim,MedicaoItemRow,FinanceiroFrenteCard,MedicaoGateAlert}.tsx`; `lib/hub/executar-ferramenta-medicao.ts`.

---

## Reuso × novo · Edge cases

**Reusa (sem tocar):** `hub_obra_itens.pct_avanco/valor_contrato` (E2, só lê); `hub_obra_orcamento_itens.{valor_total,custo_material,custo_mao_obra,custo_outros}` (E6, só lê); `hub_obra_pagamentos` (E6, INSERT com campos existentes); `rpc_liberar_escrow` (E6, **zero alteração**); `hub_aprovacoes` (+1 tipo `boletim_medicao`; as 2 chaves já existem); `executarAcaoAprovada`+cascata (+ramos); `hub_obra_frentes_eap` (E0, agrupador); `CopilotoVoz`/`acaoPendente`/HMAC; `current_user_tenant_id()`/`hub_atualizar_timestamp()`; `cockpit-aggregate` (+1 bloco degradável); paleta `/crm/aprovacoes`.

**Novo mínimo:** 3 tabelas + 1 ALTER aditivo + 2 RPCs + 1 VIEW + 1 CHECK + 3 tools + `lib/obras/medicao.ts`. Reversível por DROP.

**Edge cases (cobertos):**
- **Medido > contratado sem aditivo:** `excede_contrato` GENERATED; RPC fail-closed → `422`; botão "Fechar" desabilitado (não some). 3 saídas humanas: limitar a 100% / vincular aditivo aprovado (`aditivo_id`→`hub_obra_orcamentos.status='aprovado'`) / justificar override. Nenhuma automática.
- **Sem evidência no submit:** RPC `422 evidencia_obrigatoria_faltando`; rascunho sem foto é válido (só obriga no fechar). A IA não fornece evidência.
- **Medição retroativa (período sobreposto):** `POST` valida sobreposição com BM aprovado → `422 periodo_sobreposto`. Avanço que regride (`pct<anterior`): `pct_medido_periodo=GREATEST(0,…)` nunca negativo; flag `retroativo`, não bloqueia, exige confirmação consciente.
- **Item sem orçamento aprovado:** `valor_contratado=NULL`; `excede_contrato=false` (sem teto); badge "sem orçamento"; gate não bloqueia, só avisa.
- **Retenção:** `pct_retencao` por frente (`hub_obra_orcamentos`, default 0=sem retenção); valor calculado no fechamento; liberação separada (`hub_medicao_retencoes.status='liberada'`) no aceite definitivo da obra (humano decide).
- **Aprovador único (escritório pequeno):** 2 atos conscientes, 2 cliques, 2 registros — nunca 1 clique = 2 chaves (senão o gate duplo é teatro).
- **Boletim rejeitado:** `status='rejeitado'`+motivo, fica no histórico (append-only); pagamento bloqueado vira `cancelado`; novo BM N+1. Boletim sem valor → `422 boletim_sem_valor`.
- **`pct_medido_acum` >100:** CHECK do banco bloqueia; só com aditivo (`excede_contrato`+`aditivo_id`).
- **`custo_realizado` ausente:** margem real NULL → "—" (não NaN, não 0 enganoso).
- **Migração E7 pendente:** `isMissingPgColumn`→`503 migracao_pendente`; aba "chega em breve"; E1/E6 intactos.
- **Concorrência (2 gestores):** MVP "último ganha" (`.eq(id).eq(tenant_id)`, padrão E2); medição é single-editor na prática.
- **Preço fechado:** endpoint do Portal filtra `custo_*`/`margem_*`; cliente vê só `valor_medido`/`valor_retencao` por etapa (dupla defesa: VIEW `security_invoker` + filtro explícito).

**Pendências para o dono (humano decide o dinheiro):** (1) aplicar a migração E7 (banco); (2) política do excedente (recomendo: aditivo+justificativa+gate, nunca silencioso); (3) % de retenção default por contrato; (4) fonte do `custo_realizado` (E7-v1 manual → E7-v2 integra E5); (5) medição retroativa (recomendo permitir com selo "retroativo"); (6) chave Mistral p/ E7.3; (7) **garantir que a cascata viva no endpoint que a UI `/crm/aprovacoes` realmente chama** (obs 9779 — herdado do E6).

**Confiança: ALTA** no encaixe com E6 (li a migração real: `numero_medicao`, `valor_retencao`, `aprovacao_arq_id/hub_id`, `rpc_liberar_escrow` fail-closed, `custo_material/mao_obra/outros`, CHECK `hub_aprovacoes` — todos confirmados); **ALTA** no gate (GENERATED no banco + fail-closed na RPC, não só UI) e no append-only; **ALTA** na IA (matemática local, sem dependência de Mistral); **MÉDIA** no `custo_realizado`/margem (entrada manual no v1; E5 só no v2); **MÉDIA** na performance da subquery `MAX(pct_medido_acum)` (E7-v2 deve desnormalizar em `hub_obra_itens.pct_medido_na_ultima_medicao`). Nada foi editado — design-only. Arquivo-alvo: `c:\Users\wende\Documents\escritorio-virtual-ramon\docs\E7-DESIGN.md`.