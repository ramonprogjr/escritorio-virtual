# 🫀 SPEC — COMPRAS, o coração do sistema

> **Documento decisório único** de Compras. Fundido de mesa Fable-max (15 agentes: domínio → UI/UX → roleplay
> dono/comprador → adversarial → síntese CEO), ancorado no **código e no banco reais** (09/jul/2026).
> Substitui qualquer desenho anterior de compras. Ratificado pelo dono ("pode seguir com compras, o CEO aprova").

---

## 0. A decisão de fundo (ratificada)

Existem **duas "compras"**, direções opostas, mesmo Hub no meio:
- **VENDA / entrada** — o cliente contrata o escritório (serviço, projeto, obra, imóvel). ⇒ é o **NEGÓCIO**
  (`hub_negocios`, código NEG). Dezenas/centenas por ano. **Compra NÃO vira negócio** (62 mil/ano destruiriam o funil).
- **SUPRIMENTO / saída** — o escritório adquire de terceiros dentro daquele projeto. ⇒ é a **SC** (documento filho,
  `hub_pedidos_material`, código SC-2026-0001). Dezenas de MILHARES por ano (~1.200/semana na empresa do dono).

**A concatenação (linhagem):** imóvel → projeto de arquitetura → serviços (marcenaria, engenharia, vidraçaria,
empreiteira) → cada serviço tem suas SCs. Cada elo é um **negócio-filho** (`negocio_pai_id`/`negocio_raiz_id`); a SC
pendura no negócio via âncora. "De qual venda nasceu esta ferramenta no canteiro?" — rastreável da folha à raiz.
**Menos tela, mais IA:** o motor é IA-first; a IA prepara tudo e leva o humano ao que precisa da assinatura dele.

---

## 1. FASE 0 — correções de segurança SEM janela (feitas 09/jul, deploy #28)

Três buracos **já em produção**, verificados no código, corrigidos code-only:
1. **Porta legada `/api/crm/pedidos`** criava SC já `aprovado` pelo body (pulando toda validação) e gerava código
   com `COUNT(*)` cross-tenant. → allowlist `{rascunho,cotando}` + `gerar_codigo_sc` (atômico por tenant).
2. **`aprovar`/`cancelar` da SC** reabria compra cancelada/entregue e perdia a corrida de dois cliques. →
   `.in("status", …)` no WHERE (UPDATE atômico) + 409.
3. **Dashboard lia `hub_alertas` sem tenant** (tabela sem `tenant_id`, service_role bypassa RLS) = vazamento
   cross-tenant na tela mais nobre. → leitura neutralizada até o Bloco G da janela.

---

## 2. FASE 1 — decisões do dono ANTES da janela (mudam o schema)

| # | Decisão | Resolução do dono | Status |
|---|---|---|---|
| a | Contraparte do **freelance PF** | **Cadastro-espelho `tipo='pf'` em `hub_fornecedores`** (reusa OC, conta, teto; PIX=CPF auto-verifica) | ✅ ratificada |
| b | **Medição** de serviço | **Quantidade física real, na UNIDADE DA PLANILHA ORÇAMENTÁRIA** (un, m linear, m², m³ — depende do escopo, não fixo em m²); a % é derivada. O item de compra **herda a unidade do orçamento** → amarra Compras ↔ Orçamento. Aprofundar levantamentos+orçamentos em frente própria. | ✅ ratificada |
| c | **Delegação** | Regra por faixa + delegação temporária com rastro; **tetos configuráveis pelo tenant** | ✅ ratificada |

> **Consequência p/ o schema (Bloco E) — item EDITÁVEL, IA-first, máximo automatizado (lei de desenho do dono):**
> `unidade` e `tipo_item`/`modelo_precificacao` do item têm **default AUTOMÁTICO herdado da linha do orçamento**
> (rodapé→m linear, piso→m², mão de obra→diária/hora), mas são **SEMPRE editáveis por MÚLTIPLA ESCOLHA** (lista de
> um toque — nunca texto livre que digita errado). O item pode ser **qualquer coisa**: material, serviço, mão de
> obra, equipamento, ferramenta, freelance. `modelo_precificacao` e `unidade` são eixos independentes — "piso 800
> m² por medição" = modelo `medicao` + unidade `m²`. Regra: **a IA propõe tudo pronto (herdado/inferido); o humano
> confirma num toque OU troca na lista.** Frente futura: **levantamentos + orçamentos** (a planilha orçamentária é
> a fonte da unidade e do escopo que a SC consome).

---

## 3. FASE 2 — JANELA DO DONO (~1h): migração única aditiva, rollback por bloco

Arquivo `supabase/migrations/20260801120000_e7_compras_cadeia_po_contas.sql` (timestamp posterior à E6). Blocos:
- **A — Âncoras da SC:** `negocio_id/projeto_id/servico_id` NULL + `obra_id` DROP NOT NULL + CHECK `num_nonnulls=1`.
- **B — Cadeia:** `hub_sc_validacoes` (append-only, etapas técnico→engenharia→compras→diretor) + `hub_sc_politicas`
  (regras assinadas: faixa, teto_fornecedor_dia, janela móvel, amostra 5%, kill_switch, delegação temporária).
- **C — PO:** `hub_ordens_compra` (código OC via contador atômico) + `hub_pedido_itens.ordem_compra_id`.
- **D — Contas (anti-golpe, prioridade nº 1):** `hub_fornecedor_contas` append-only + trigger de imutabilidade +
  RPC só p/ revogar/substituir. Carência 72h + quatro-olhos + titularidade + máscara + alerta de troca <7d.
- **E — Item polimórfico:** `tipo_item`, `modelo_precificacao` (unitario|diaria|empreitada|medicao|hora|verba),
  `precificacao_json`, `retornavel`, `contratado_pessoa_id`, `unidade_cobranca`. DEFAULTs backfillam o legado.
- **F — Elo SC→financeiro:** `hub_obra_pagamentos` ADD `pedido_id/ordem_compra_id/fornecedor_conta_id` + tipo 'compra'.
- **G — `tenant_id` em `hub_alertas`** + backfill + índice.
- **H — Guard da cascata:** `hub_sc_registrar_entrega` com parênteses explícitos (serviço/diária/locação NUNCA
  viram estoque) + `qtd_fisica` p/ retornável. Preserva gate de status + idempotência da 20260711120000.
- **I — Índices de escala.**

---

## 4. Regras da casa no motor (inviolável)

- **A IA PREPARA TUDO · O HUMANO DECIDE NA TELA · DINHEIRO E CONTA NUNCA POR VOZ.** Score/anti-fatiamento/duplicata/
  teto/histórico = SQL determinístico (0 tokens); LLM só redige parecer, assíncrono, fora do caminho crítico.
- **Aprovar compra ≠ liberar pagamento** (2 atos). Pagamento segue a dupla chave do E6.
- **SoD** (separação de pessoas): a mesma pessoa não valida 2 etapas da mesma rodada.
- **1.200/semana** dissolve por **regra assinada + lote + exceção**, nunca por afrouxar o gate. Diretor decide o dia
  em ~18–22 toques. Cold-start (dia 1 sem regras): Modo Despacho 1-card-por-vez + modo sombra + rule-mining.
- **Anti-golpe bancário** = processo, não criptografia: cofre separado, imutável, mascarado, carência + quatro-olhos.
- **Risco trabalhista** do freelance/diária: alerta determinístico de recorrência (não bloqueia; informa e data).
- **Fila = projeção**, nunca tabela nova. **Uma verdade, N superfícies resolutivas**; resolver numa some nas outras.

---

## 5. Ordem de execução

`FASE 0 (segurança, feito)` → `FASE 1 (3 decisões)` → `FASE 2 (janela ~1h)` → `FASE 3 (motor: cadeia+regras+OC+contas)`
→ `FASE 4 (telas de decidir)` → `FASE 5 (balcão do comprador: fila+lote+lançador de SC)` → `FASE 6 (prova de carga:
5.000 SCs sintéticas)` → `FASE 7 (GO 1.200/semana, kill-switch + amostra 5%)`. Cada fase entrega algo usável e
reversível; nada quebra o E5/E6 no ar; migração sempre na janela do dono, via MCP, com SQL+resultado mostrados.

**Estimativa honesta:** janela ~1h + **5–7 semanas de build**. As 2 primeiras semanas de operação são mais pesadas
que a planilha (o sistema aprende as regras); da 3ª em diante é o ganho. E-commerce nasce daqui (SC+âncora+fornecedor
+quem-paga+código já é o pedido) — **zero tela agora, nada bloqueado**.

> Spec completa (200 KB, 15 agentes) preservada no journal do run `wf_c1bb3274-a73`.
