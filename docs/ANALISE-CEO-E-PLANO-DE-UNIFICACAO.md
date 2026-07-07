# Análise CEO & Plano de Unificação — Obra10+ / Escritório Virtual

> **Nota honesta:** a mesa Fable que rodaria esta análise bateu o **limite de sessão** (reseta 12:30pm).
> Este documento é a **síntese direta do CEO técnico**, ancorada no doc-mãe completo
> (`docs/MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md`, 8.217 linhas), no código real e nas decisões travadas.
> Pode ser **expandido/verificado pela mesa** após o reset. Data: 07/jul/2026.

---

## Veredito (a resposta em 6 linhas)

Estamos com **~40% da visão completa e ~70% de um MVP seguro single-tenant**. O que já existe é **honesto
por arquitetura** e o núcleo (CRM, motor de leads, negócios/obras, motor de comissões testado) está de pé —
mas o sistema é **fragmentado e single-tenant disfarçado**. Antes de *avançar*, o trabalho não é criar features
novas: é **unificar a fundação, fechar o irreversível (linhagem) e des-fragmentar**, e então **acender os
interruptores na ordem certa**. Avançar sem isso é construir andar sobre laje trincada.

**A ordem dos interruptores:** des-fragmentar (agora) → **linhagem** (janela) → **Mistral/IA** → **hardening
multitenant** → **janela altitude 1 + Dinheiro do Hub** → **comissão da rede + clawback + escrow** → **Portal +
cobrança SaaS**.

---

## 1. Panorama Real — Onde Estamos

| Módulo | Estado | Observação |
|---|---|---|
| CRM núcleo (leads, negócios, obras, pedidos, cadastros) | ✅ **Construído** | Altitude 2 (dentro do tenant) |
| Motor de direcionamento de leads (MESTRE×VINCULADO, score/SLA) | ✅ Construído | O coração do rail |
| **Sprint de hoje** — Leads reestruturado · Funil do Hub · O que travou · Dashboard andares · Cadastros | ✅ **No ar** | Verificado ao vivo |
| Motor de comissões (4 tabelas + 3 RPCs, cash-basis, append-only) | 🟡 **Construído + testado, GATED** | Não lido por nenhuma tela ainda |
| Escrow / camada AEC (E0–E7) | 🟡 Código pronto, **migrações file-only** | Dormente |
| Metering Tijolos | 🟡 **Modo sombra** (mede, não cobra) | |
| IA / Mistral | 🔴 **Desligada** (sem chave) — degrada p/ determinístico | |
| Altitude 1 (Hub lê a rede + entra no CRM de outro tenant) | 🔴 **Desenhada, não construída** | Papel de plataforma morto no runtime |
| Dinheiro do Hub na tela (MRR + comissão da rede) | 🔴 Zero na tela | Depende da altitude 1 |
| Planos SaaS / billing | 🔴 Desenhado | Nenhuma tabela |

**A verdade dura:** o isolamento é por **filtro de código** (service_role bypassa RLS), **82 rotas duplicam o
client**, há **2 vocabulários de estágio**, e a métrica-mãe (take blended da rede) é **zero na tela**.

---

## 2. Pendências Consolidadas & Priorizadas

Classificadas por **quem destrava**:

**EU (código, desbloqueado — dá pra fazer já):**
- Unificar os **2 vocabulários de estágio** (fonte recorrente de bug).
- **Des-fragmentar**: centralizar o `crmDb`/client (parar as 82 duplicações) — pré-condição do multitenant.
- **Ligar o motor de comissões nas telas** (dentro do tenant): apurar/registrar recebimento/ver split.
- **Clawback**: RPC de estorno + janela de retenção (hold) + régua — o modelo append-only já suporta a linha negativa.
- **Linhagem** (o *wiring* em `derivar-negocio`/`derivar-entrega`) — depois da migração.

**VOCÊ (dono — só você destrava):**
- **Mistral** (chave) → acende a IA de verdade.
- **Janela altitude 1** (RLS Faixa B *real* — não a que já aplicamos) → Hub lê a rede + Dinheiro do Hub.
- **Migração da linhagem** (`negocio_pai_id`/`raiz_id`) — aditiva, na janela.
- **UAZAPI** (WhatsApp) · **HaveIBeenPwned** (toggle) · **Deploy Hook** do Render.

**DECISÃO (sua):**
- ✅ Clawback = cobrar sempre (decidido 07/jul) · ✅ Fechar linhagem (decidido 07/jul).
- ⬜ **Planos SaaS e preços** (FUNDAÇÃO/ESTRUTURA/ACABAMENTO — a validar).
- ⬜ **Política de hold** do clawback (quantos dias segurar a comissão antes de liberar).

---

## 3. O Que Ajustar ANTES de Avançar (as pré-condições)

São as trincas que, se não fecharem, **contaminam todo o futuro**:

1. **Linhagem irreversível** (`negocio_pai_id`/`raiz_id`). É o único gap que **não se recupera depois** — dado
   histórico sem pai/raiz é perda permanente. 7 negócios já entram "sem lead de origem". **Fechar antes de qualquer
   dado de rede.** [decidido ✓ · migração na janela]
2. **Mitigações do clawback** (hold + estorno + régua). Antes de liberar comissão real, o cofre precisa saber
   devolver. [decidido ✓ · construir no motor]
3. **Hardening multitenant** (deduplicar as 82 rotas, papel de plataforma vivo, guard SELECT-only). **Pré-condição
   do 2º tenant e da altitude 1** — ligar um 2º tenant hoje é risco de vazamento cruzado.
4. **Unificar os 2 vocabulários de estágio.** Enquanto existirem dois, todo relatório e funil podem mentir.
5. **IA desligada.** Metade das promessas (IA-first, briefing, copiloto, cadastro por voz) está muda sem a Mistral.

> Regra CEO: **1, 2 e 4 são bloqueantes de qualidade**; 3 é bloqueante do multitenant; 5 é bloqueante de valor
> percebido. Nenhum "avanço" de feature nova vale mais que fechar esses cinco.

---

## 4. A Unificação do Sistema Ideal (a tese)

**O que fragmenta hoje → o alvo unificado:**

| Fragmentação hoje | Alvo unificado |
|---|---|
| Telas repetindo o mesmo dado (pipeline em 2 lugares, etc.) | **Fonte única, várias lentes** — o mesmo dado, fatiado (junto/separado, por mercado/origem) |
| 2 vocabulários de estágio (ciclo-de-vida × kanban) | **Um vocabulário** com mapeamento explícito |
| 82 rotas duplicando o client Supabase | **`crmDb` centralizado** — uma porta, um isolamento |
| Negócio/projeto/obra soltos, 7 negócios sem origem | **Negócio = espinha + linhagem pai/raiz** ("nada se perde") |
| Orçamento, cronograma e gestão como coisas separadas | **Escopo unificado** (orçamento=cronograma=gestão=ESCOPO) |
| Uma altitude (dentro do tenant) | **2 altitudes** (Hub↑ / tenant↓) como a navegação-mãe |
| IA espalhada/desligada | **Uma camada conversacional sobre a fonte única** |

**O sistema ideal unificado** é isto: **uma coluna de dados** (negócio-espinha com linhagem), **uma camada de
lentes** (as telas são vistas da mesma fonte), **duas altitudes** de navegação, **um motor financeiro** (comissão
+ escrow + Tijolos) e **uma camada de IA** conversacional por cima. Unificar = **reduzir fragmentação**, não
adicionar telas.

---

## 5. Plano de Futuro Faseado (a ordem dos interruptores)

Cada fase tem **objetivo · itens · dependência · critério de pronto**. A ordem minimiza retrabalho.

### Fase 0 — Des-fragmentar (AGORA, EU-code, desbloqueado)
- **Objetivo:** fechar as trincas de fundação sem depender de você.
- **Itens:** unificar os 2 vocabulários · centralizar o `crmDb` · ligar o motor de comissões nas telas do tenant ·
  UI de clawback/hold (esqueleto) · continuar limpando telas (Negócios, Financeiro) na lente de fonte-única.
- **Dependência:** nenhuma. **Pronto quando:** vocabulário único no código + client centralizado + comissão visível por negócio.

### Fase 1 — Linhagem (JANELA do dono)
- **Objetivo:** fechar o irreversível antes de qualquer dado de rede.
- **Itens:** migração aditiva `negocio_pai_id`/`raiz_id` + backfill + wiring em `derivar-negocio`/`derivar-entrega`.
- **Dependência:** janela de migração. **Pronto quando:** todo negócio novo nasce com pai/raiz; zero "sem origem".

### Fase 2 — IA (CHAVE Mistral)
- **Objetivo:** acender o IA-first prometido.
- **Itens:** cadastro por voz/colar · busca conversacional · briefing do dia · copiloto ciente-de-rota · dedup proativa.
- **Dependência:** chave Mistral. **Pronto quando:** as telas conversam de verdade.

### Fase 3 — Hardening Multitenant (EU-code)
- **Objetivo:** deixar seguro ligar um 2º tenant.
- **Itens:** deduplicar as 82 rotas · papel de plataforma vivo · guard SELECT-only cross-tenant · trilha de auditoria em `hub_eventos`.
- **Dependência:** Fase 0. **Pronto quando:** um 2º tenant não vaza no 1º (teste adversarial).

### Fase 4 — Altitude 1 + Dinheiro do Hub (JANELA altitude 1)
- **Objetivo:** o Hub ver a rede + o dinheiro na tela.
- **Itens:** leitura cross-tenant (RLS Faixa B real) · drill-in "entrar no CRM do tenant" (read-only + auditoria) ·
  bloco Dinheiro do Hub (MRR + comissão da rede).
- **Dependência:** Fases 1+3 + janela RLS. **Pronto quando:** a métrica-mãe (take blended) aparece de verdade.

### Fase 5 — Rede viva (comissão + clawback + escrow)
- **Objetivo:** o motor financeiro operando na rede.
- **Itens:** comissão da rede realizada · clawback ativo (hold + estorno + régua) · escrow ligado (dupla-chave).
- **Dependência:** Fases 1,2,4. **Pronto quando:** um negócio ganha → split → recebe → (se calote) estorna, ponta a ponta.

### Fase 6 — Portal + Cobrança SaaS
- **Objetivo:** fechar o ciclo com o cliente final e cobrar.
- **Itens:** Portal do Cliente (os 5 medos) · planos SaaS/billing (após sua decisão de preços) · carteira Tijolos cobrando.
- **Dependência:** decisão de preços + Fase 5. **Pronto quando:** o cliente vê a obra e o tenant paga a assinatura.

---

## 6. Decisões & Ações do Dono (o que só você destrava)

| Item | Desbloqueia | Tipo |
|---|---|---|
| **Chave Mistral** | Toda a Fase 2 (IA-first) | Chave |
| **Janela altitude 1** (RLS Faixa B real) | Fase 4 (Dinheiro do Hub + drill-in) | Janela |
| **Migração linhagem** | Fase 1 (a fundação irreversível) | Janela |
| **Decisão de preços SaaS** | Fase 6 (cobrança) | Decisão |
| **Política de hold do clawback** | Fase 5 (liberação segura) | Decisão |
| UAZAPI · HaveIBeenPwned · Deploy Hook | WhatsApp · segurança de senha · deploy | Config |

---

## Recomendação final do CEO

**Não avançar em features novas.** O próximo movimento certo é a **Fase 0 (des-fragmentar)** — 100% desbloqueada,
eu toco já — em paralelo com você abrindo a **janela da linhagem (Fase 1)**, que é a única coisa **irreversível**.
Com a fundação limpa e a linhagem fechada, cada interruptor seguinte (IA → hardening → altitude 1 → rede → portal)
acende sem retrabalho. **A unificação não é um projeto à parte: é a disciplina de fazer cada peça derivar de uma
fonte só, fase a fase.**
