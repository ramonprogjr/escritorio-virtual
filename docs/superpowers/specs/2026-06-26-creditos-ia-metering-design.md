# Spec — Metering de IA + Créditos pré-pagos (Obra10+)

> **Status:** desenho aprovado pelo dono ("CEO aprova, prossiga"); aguarda revisão do spec antes do plano de implementação.
> **Data:** 26/jun/2026 · **Autor:** Code (mesa redonda: arquitetura, backend, produto/monetização, segurança, finanças).
> **Docs irmãos:** [[monetizacao-licenciamento-rede]] (memória) · `docs/PLANO-MACRO-CONCLUSAO.md` · `docs/CENTRAL-PERFORMANCE-METRICAS.md`.

---

## 1. Problema / objetivo (na voz do dono)

Todo o sistema vai ser **conversacional e IA-first**: relatórios, contratos, pedidos de material, dashboards, cronogramas, planejamento financeiro, compras, check-in/out — a IA gera. **Cada geração consome tokens, e o dono quer repassar 100% desse custo + margem**, vendido como **créditos pré-pagos** dentro do próprio sistema. Ex.: a engenharia pede "monte um cronograma de 45 dias lendo os projetos" → a IA faz → o consumo é debitado da carteira de créditos do escritório.

Precisamos de: **(a)** medir o consumo real por ação/escritório, **(b)** precificar com previsibilidade (forecast), **(c)** vender créditos pré-pagos, **(d)** bloquear quando acabar (ou permitir pós-pago controlado).

### Correção de premissa (importante)
"Claude Code" (a CLI) **não** é o motor de IA em produção — é ferramenta de desenvolvimento. O motor dos usuários é **Claude via API** e/ou **Mistral** (hoje Mistral-first; Anthropic integrado mas dormente). O metering é **provider-agnostic**: mede tokens de qualquer modelo e precifica por uma tabela. A visão de negócio não muda.

---

## 2. Premissas técnicas (o que já existe — fundação)

- **Chokepoint único de IA:** `lib/ia/llm-completion.ts` (`completarChatPreferindoMistral`) e `lib/ia/llm-completion-tools.ts` (`...ComFerramentasMistral`) **já retornam** `tokensEntrada`, `tokensSaida`, `modeloLog` — para Mistral E Anthropic. O motor `lib/ia/engine.ts` e features (`lib/hub/sugerir-*`, `lib/playbook/mistral-analysis`) chamam por aí. É onde a medição engata.
- **Multi-tenant REAL já flipado** (`users.tenant_id` + `current_user_tenant_id()`): carteira e ledger são tenant-scoped naturalmente.
- **`hub_eventos`** (event log append-only) — keystone de métricas; o consumo de IA também emite evento.
- **Preços de referência (jun/2026, USD por 1M tokens):** Claude Opus 4.8 5/25 · Sonnet 4.6 3/15 · Haiku 4.5 1/5 · Fable 5 10/50 · Mistral large ~2/6, small mais barato. **Prompt caching** (Anthropic) lê cache a ~0,1× → corta ~90% do custo de contexto repetido (projetos, system prompts) — alavanca-chave de margem.

---

## 3. Modelo conceitual

### 3.1 Unidade vendida = "Crédito Obra10+" (abstrato)
Usuário **não** pensa em tokens. Vê **créditos** e saldo. Internamente:

```
créditos_debitados = ceil( custo_brl_real / valor_credito_brl )
custo_brl_real      = custo_usd_real × fx_usd_brl × markup
custo_usd_real      = (tokens_in × preço_in + tokens_out × preço_out) / 1e6   [preços do modelo usado]
```

- `valor_credito_brl` (ex.: 1 crédito = R$ 0,10) — define a granularidade.
- `markup` (ex.: 5×–10×) — cobre infra, FX, variação de modelo e margem. **Editável sem deploy** (tabela de config).
- Mistral barato + markup → margem saudável; se ligar Claude, o mesmo markup absorve a diferença.

### 3.2 Estimativa antes de rodar (previsibilidade)
Ações caras mostram **faixa estimada** antes ("Gerar cronograma ~ 15–40 créditos"), derivada do histórico (p50/p95 de tokens por tipo de ação). Cobra-se o **real** ao concluir. Isso dá Click-and-Go com transparência e evita susto.

### 3.3 Forecast (a "previsão de gastos" que o dono pediu)
Do ledger: distribuição de tokens por **tipo de ação** × volume projetado → créditos esperados/semana/mês. Alimenta um painel "Previsão de consumo de IA" por escritório e global (Central de Performance).

---

## 4. Arquitetura

### 4.1 Camada de medição (o "pedágio")
Uma função única envolve as chamadas de IA:

```
medirEConsumir({ tenantId, origem, usuarioId, refTipo, refId }, fnQueChamaIA) →
  1. (pré) verificarSaldo(tenantId) → se modo=prepago e saldo<=0 → { bloqueado, motivo, faltaComprar }
  2. roda fnQueChamaIA() (= completarChatPreferindoMistral/...)
  3. (pós) lê tokens+modelo → calcula custo (tabela preços) → debita créditos
  4. grava ledger (hub_ia_consumo) + movimento (hub_ia_creditos_mov) + evento (hub_eventos)
  5. retorna o resultado da IA + { creditosDebitados, saldoRestante }
```

Regra de ouro: **nunca bloquear no meio** de uma ação. A verificação é **antes**; uma ação em voo conclui mesmo que zere o saldo (pode ficar levemente negativo); a **próxima** é bloqueada. Sem cobrança fantasma, sem trabalho perdido.

### 4.2 Esquema de dados (aditivo, tenant-scoped, RLS)
- **`hub_ia_precos`** — `modelo, input_usd_milhao, output_usd_milhao, cache_read_fator, ativo`. Tabela de preços por modelo (mistral-*, claude-*).
- **`hub_ia_config`** — `escopo (global|tenant), tenant_id, markup, fx_usd_brl, valor_credito_brl, modo (prepago|pospago), alerta_saldo_baixo`. Config de precificação (global + override por tenant).
- **`hub_ia_consumo`** — ledger append-only de débito: `id, tenant_id, usuario_id, origem, modelo, tokens_entrada, tokens_saida, custo_usd, custo_brl, creditos, ref_tipo, ref_id, criado_em`.
- **`hub_ia_creditos_mov`** — movimentos da carteira: `id, tenant_id, tipo (compra|bonus|assinatura|debito|estorno), creditos (±), descricao, ref_id, criado_em`. **Saldo = soma dos movimentos.**
- **`hub_ia_creditos_saldo`** (opcional, materializado p/ leitura rápida) — `tenant_id, saldo_creditos, atualizado_em`. Reconciliável a partir de `_mov`.

### 4.3 Código
- `lib/ia/metering.ts` — `registrarConsumoIA()`, `verificarSaldo()`, `estimarCusto(origem)`, `precoDoModelo()`, `creditosDeCusto()`.
- Envolver os 2 chokepoints; cada feature passa `origem` (ex.: `relatorio`, `contrato`, `cronograma`, `pedido_material`, `dashboard`, `chat_atendimento`) + `tenantId` + `usuarioId`.
- Rotas (gestor/owner-guard, tenant-scoped):
  - `GET /api/crm/ia/creditos` — saldo + extrato + consumo por origem.
  - `GET /api/crm/ia/previsao` — forecast (p50/p95 × volume).
  - `POST /api/crm/ia/creditos/comprar` — top-up. **STUB até gateway de pagamento (TRAVA: cobrança real precisa de gateway + aprovação do dono).**
  - `GET/PUT /api/crm/ia/config` — owner-only (markup, fx, valor do crédito, modo).
- UI: widget de carteira no header/config; chip "custo estimado" nas ações de IA; toast/aviso de saldo baixo; bloqueio amigável com CTA "Comprar créditos" quando prepago e saldo 0.

### 4.4 Relação com a monetização existente (3 pernas)
Da memória [[monetizacao-licenciamento-rede]]: assinatura SaaS + comissionamento transacional. Esta spec adiciona a **3ª perna**:
1. **Assinatura SaaS** (mensal + por usuário + plano/módulo) — pode **conceder X créditos/mês** (movimento tipo `assinatura`).
2. **Comissionamento transacional** (split por código único).
3. **Créditos de IA (pré-pagos, medidos)** — consumo, carteira separada; top-ups compram mais.

---

## 5. Fases (shippable e seguro — aditivo a cada passo)

- **Fase 1 — METERING/LEDGER em modo sombra (zero risco, maior valor):** instrumentar o chokepoint; gravar `hub_ia_consumo` com custo em BRL + tabela de preços + config. **Sem bloqueio, sem cobrança.** Já entrega o **forecast** que o dono quer, sem tocar no fluxo do usuário.
- **Fase 2 — CARTEIRA + SALDO + limites suaves:** materializar saldo, avisos de saldo baixo, estimativas na UI. Bloqueio ainda suave/desligável.
- **Fase 3 — PRÉ-PAGO + HARD-CAP + TOP-UP:** bloquear em saldo 0; comprar créditos (**precisa gateway — TRAVA**). Pacotes de crédito.
- **Fase 4 — Assinatura concede créditos + modo pós-pago + painel de previsão** na Central de Performance.

A Fase 1 é a recomendação de partida: dá os dados de previsão com risco nulo.

---

## 6. Segurança / travas
- Tenant-scoped + RLS em todas as tabelas (fundação multi-tenant já flipada); rotas com guard + `g.ctx.tenantId`.
- **Cobrança real (Fase 3) = TRAVA:** gateway de pagamento + aprovação explícita do dono (custo financeiro/credencial).
- Config de markup/fx/valor — **owner-only**.
- Idempotência no débito (1 ação = 1 registro); estorno por movimento, nunca editar ledger.
- Migrações **aditivas**; gates `tsc + vitest` + verificar clicando; sem secrets no Git.

---

## 7. Decisões padrão (CEO aprovou; veto bem-vindo)
- **D1 — Unidade:** crédito abstrato mapeado a BRL (recomendado) — não mostrar tokens crus ao usuário.
- **D2 — Partida:** Fase 1 em **modo sombra** (medir sem cobrar) antes de qualquer billing.
- **D3 — Bloqueio:** pré-pago com hard-cap **antes** da ação; nunca no meio; aviso de saldo baixo.
- **D4 — Markup:** começa configurável (ex. 6×) e calibra com dados reais da Fase 1.
- **D5 — Provider:** segue Mistral-first; metering já precifica Claude p/ quando ligar.

---

## 8. Fora de escopo (agora)
Gateway de pagamento real; split de comissão (perna 2); precificação dinâmica por demanda; revenda de créditos entre escritórios.
