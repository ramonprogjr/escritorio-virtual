# 🧭 00 — Painel de Controle (COMECE AQUI)

> O **lugar único** para não se perder. São 115+ documentos em `docs/` (muito é histórico) — este painel
> aponta só o que é **canônico hoje**, o **estado real**, o **roadmap/cronograma vivo** e **o que depende de você**.
> Atualizado: **07/jul/2026**. Mantido vivo a cada marco.

---

## 📍 Onde estamos (em 3 linhas)

**~45% da visão / MVP seguro single-tenant de pé — agora com a IA VIVA e o dinheiro honesto.** O núcleo (CRM, motor
de leads, negócios/obras, motor de comissões testado) está de pé. Nesta sessão (07/jul) três coisas mudaram de estado:
o **dinheiro ficou honesto** (FIN-02 custódia fantasma corrigida + DEMO R$15k desfeito), a **IA ficou viva** (copiloto
fala + navega + abre a ficha do lead + direciona lead a parceiro) e o **deploy destravou** (cache CDN Vercel→Render que
prendia todo deploy no CDN). Ainda é **single-tenant** e restam **decisões do dono** (taxonomia de COMPRAS, reconciliar
masterplan × banco real). Fase atual: **ligar a IA no que já existe** (IA-15) — não construir do zero.

---

## 📚 Os 5 documentos VIVOS (seguimos SÓ estes)

| # | Doc | Finalidade | Quando ler |
|---|---|---|---|
| **00** | **[00-PAINEL-DE-CONTROLE.md](00-PAINEL-DE-CONTROLE.md)** | Estado & decisões — o diário | Sempre primeiro |
| **01** | **[01-NEGOCIO-E-ESTRATEGIA.md](01-NEGOCIO-E-ESTRATEGIA.md)** | Negócio: modelo, verticais, value-chain, monetização | O porquê / quê |
| **02** | **[02-PRODUTO-TELAS-E-UX.md](02-PRODUTO-TELAS-E-UX.md)** | Produto: telas, fluxos, UX, design system | O que o usuário usa |
| **03** | **[03-ARQUITETURA-DADOS-E-SEGURANCA.md](03-ARQUITETURA-DADOS-E-SEGURANCA.md)** | Técnico: dados `hub_*`, RBAC, segurança, altitudes, invariantes | O como |
| **04** | **[04-ROADMAP-E-PLANO.md](04-ROADMAP-E-PLANO.md)** | Roadmap: fases + backlog de WIs + sprints | O quando / ordem |

**Referência profunda (salva para análise eventual — NÃO seguida no dia a dia):**
[PLANO-DE-NEGOCIO](PLANO-DE-NEGOCIO.md) (mercado SP + beachhead + matriz de receita + unit economics — base do 01) · [CADERNO-ENGENHARIA](CADERNO-ENGENHARIA-AUDITORIA.md) (backlog técnico WI detalhado — base do 04) · [MODELO-…-COMPLETO](MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md) (doc-mãe, 8k linhas) · [ANALISE-CEO](ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md) · Auditorias CEO ([Dashboard](AUDITORIA-DASHBOARD-CEO.md)·[Pipeline](AUDITORIA-PIPELINE-LEADS-CEO.md)·[Ciclo Lead](AUDITORIA-CICLO-LEAD-v1.md)·[Cadastros](AUDITORIA-CADASTROS-UIUX-PROMAX.md)) · Memória do CEO (`.claude/.../memory/`).

> **Estratégia de entrada (do Plano de Negócio):** beachhead = **Reforma & Arquitetura de alto padrão na Zona Oeste/Sul de SP**, escrow como wedge de confiança, **você é o tenant zero**. **Meta: MVP (Fases 0–3) em ~1 trimestre; depois ligar a receita.**

> **Os outros 110+ docs em `docs/` = HISTÓRICO / arquivo.** Nada se perde — mas não é a fonte atual.
> Quando um doc antigo conflitar com os 5 acima, **os 5 ganham.** Os 5 são atualizados a cada marco.

---

## 🗺️ Roadmap / Cronograma vivo (a ordem dos interruptores)

Legenda: ✅ feito · 🔄 em curso · ⏳ próximo · 🔒 depende do dono

### ✅ SPRINT ATUAL — concluído e no ar (07/jul)
| Entrega | Commit |
|---|---|
| Leads — rebuild estrutural (barra de comando única, 1ª dobra, 44px) | `6ac1e57` |
| **Funil do Hub** (coorte de leads na rede, fatias mercado/origem) — *dono aprovou* | `1c62e9c` |
| **O que travou** (operação por exceção, R$ + clique) | `6809cd1` |
| Dashboard em **andares de decisão** (ação primeiro) | `6c83f12` |
| Cadastros — **filtros colapsáveis no desktop** + **"Ver" redundante removido** | `dd6b1da` · `7109304` |
| Doc-mãe completo + Análise CEO + decisões (clawback/linhagem) | `21daff6` · `8724ded` |
| **Fase 0 código (Sprint 1):** MET-01 markup≥1 · IA-02 ml.ts fallback · EST-03 CHECK+teste 6 mercados · FIN-03 aviso valor_fechado | `6a67b2e` · `89a9fae` · `5471526` · `ff6a24e` |
| **Sessão NOITE (07/jul) — Supabase via MCP direto:** RAS-01 linhagem aplicada+verificada (0 órfãos + gatilho) · MET-01 CHECK no banco · **FIN-02 escrow corrigido + DEMO R$15k desfeito** · **Mistral IA-01 VIVA** · **Copiloto de voz ligado** (HMAC + Tijolos) · **Copiloto: resposta escrita + navegação** · Backup GitHub 3h · **Auditoria de realidade** | `d2e60bf`·`262ce9c`·`9672ed6`·`0c7158b`·`dc95ae3`·`c5457d9` |

### 🧾 PENDÊNCIAS ABERTAS — pontas soltas capturadas (07/jul noite; "não deixar nada solto")

**IA-first / Copiloto — a "IA viva" (trilha do plano, NÃO side-quest):**
- ✅ **Copiloto AGIR/RESOLVER (increment 3)** — tool de voz `hub_lead_encaminhar` no ar (`b77285e`): a IA **DIRECIONA o lead** a parceiro/especialista (a ação-mãe do funil). Mesa Fable + verificação adversarial (dinheiro E compras = seguro). SEGURO: cria PROPOSTA pendente (`status=sugerido_ia` forçado), **não envia** ao parceiro (2ª chave humana na tela). **Verificado E2E ao vivo** (LLM classificou → tool executou → todos os invariantes OK). Flag default=true, sem dono.
- ⬜ **Mais ações + conectar aos AGENTES (IA-15):** próximas ações do copiloto (criar lead? próxima ação?) + injetar a IA nas telas-âncora (negócio/lead/atendimento) e no Agent Builder.
- ⬜ **Conectar a IA aos AGENTES do sistema** + a tudo que depende de IA (visão do dono). Mapeia à **IA-15** (IA nas telas-âncora: negócio/lead/atendimento) + Agent Builder. É a trilha IA-first do plano.

**Produtos / COMPRAS — ⚠️ taxonomia (decisão do dono):**
- 🔒 **"Compras" é POLISSÊMICO:** compra de produto · dentro de projeto · Tijolos/moedas · dentro de serviço · compra-de-projeto no CRM · imóvel · "iFood" de produtos · dentro de produtos · e mais. **NÃO construir nem atribuir compra sem a definição da taxonomia pelo dono.** `hub_produtos` não existe; `hub_catalogo` (47 itens) é só master de dropdowns.

**Comissões:**
- ⬜ Motor **está ligado** (UI `NegocioFinanceiroRedeSection` + API `financeiro-rede` + 3 RPCs) mas **0 uso** — falta uma **apuração real** (demo E2E) pra provar ponta-a-ponta.

**Reconciliação do plano (dívida DECISÃO-35):**
- ⬜ **Masterplan × banco REAL:** a auditoria por MCP mostrou o banco **muito à frente do plano** (AEC/escrow/comissões/`hub_acoes_ia`/`hub_error_logs`/`hub_proximas_acoes`/`hub_contas_*` já existem). Reconciliar o masterplan com a realidade. Laudo: `docs/AUDITORIA-REALIDADE-BANCO-07JUL.md`.

**Config do dono ainda aberta:** UAZAPI (WhatsApp) · HaveIBeenPwned · preços SaaS · rotação de segredos (chave do dev demitido) · contas Apple/Google (lojas) · janela altitude 1.

> **Numeração canônica das fases = [04-ROADMAP](04-ROADMAP-E-PLANO.md).** Este painel espelha o ESTADO; o Roadmap manda na ordem. (Reconciliado 08/jul — antes os dois docs divergiam na numeração.)

### ✅ FASE 0 — Estancar o irreversível (código + linhagem) — FECHADA
- **Código no ar:** MET-01 (markup≥1, app **e** banco) · IA-02 (`ml.ts` fallback) · EST-03 (CHECK `hub_atividades` blindado) · FIN-03 (aviso `valor_fechado` NULL).
- **Linhagem via MCP (07/jul):** RAS-01 ✅ (gatilho `trg_hub_negocios_linhagem` — 0/16 sem raiz) · RAS-02 ✅ (UNIQUE código já existia) · RAS-03 🟡 (colunas `ator_*` existem; falta **popular no app** — P1, code-only).
- **Resta (P1, sem janela):** app escrever `negocio_pai_id` na derivação (cross-sell) — hoje ~7 negócios entraram sem pai (o gatilho preenche a raiz, não o pai).

### 🔄 FASE 1 — IA no ciclo do lead **("o 2")** — ~90%, resta OPS + 1 E2E
- Engine cabeada ponta-a-ponta: WhatsApp → engine → **Mistral-first** (fallback). **Mistral VIVA** (07/jul).
- **Pronto =** "lead WhatsApp → qualificado por IA → confirmado em 1 toque".
- **Resta (NÃO é build):** confirmar envs no Render (`/api/health`) + **1 E2E ao vivo com o dono**. Gap de código conhecido: o "1 toque" fecha automático só pelo playbook **Maria**; no engine genérico exige `interesse`+`valor` — blindar p/ o E2E cair no caminho que fecha.

### 🔒 FASE 2 — Janela grande (obra + dinheiro real) — precisa da SUA janela
- FND-01 (baseline migration: schema reprodutível, **incorpora a linhagem aplicada à mão**) · OBR-01 (camada AEC E0–E7/A0–A1) · OBR-02 (RPC medição append-only) · FIN-01 (motor de comissões em prod).
- **FIN-02 (escrow) ✅ JÁ FEITO** e verificado no banco (rpc sem GREATEST + guards + DEMO R$15k desfeito) — **saiu desta fase**.
- **Exige:** 1 janela Supabase (aditiva/reversível, backup antes) + você validar 1 pagamento real pela dupla-chave.

### ⏳ FASE 3 — Operar sem planilha (código)
- LEAD-02 (vocabulário de estágio) · EST-01 (funis por mercado) · EST-02 (entrega IMB/FOR/PRO) · LEAD-01 (SLA+cron) · RAS-04/05 · EVT-01 (analytics+UTM+CAC) · FND-02 (centralizar `crmDb`). **Critério-mãe do MVP:** próximo cliente roda sem planilha.

### 🔒 FASE 4 — Cobrar (billing)
- MET-02 (consumo IA atômico) · MET-03 (carteira + top-up PIX) · MET-04 (régua 7/3/1 + `IA_HARD_CAP`) · MET-05 (billing SaaS/MRR). Depende de **decisão de preços**.

### 🔒 FASE 5 — Endurecer p/ a rede
- TEN-01..04 · RBAC-01..05 · LGPD-01. **Gate do 2º tenant:** nenhum tenant lê outro.

### 🔒 Depois — Fase 6 (piloto de rede) · Fase 7 (Altitude 1 + Portal) · Fase 8 (escala)
- Altitude 1 = Hub lê a rede (RLS Faixa B real) + Dinheiro do Hub · Portal do Cliente (os 5 medos) · clawback ativo (hold+estorno+régua).

---

## 🔑 O que depende de VOCÊ (destrava fases inteiras)

| Item | Destrava | Tipo |
|---|---|---|
| **1 E2E ao vivo do WhatsApp** (você manda a msg) | **Fase 1 (IA) — fecha "o 2"** | 5 min |
| **Janela grande de migração** (FND-01+OBR-01+OBR-02) | Fase 2 (obra + comissões em prod) | Janela Supabase |
| **Validar 1 pagamento real** pela dupla-chave | Fase 2 (prova FIN-02 E2E) | 5 min |
| **Decisão de preços SaaS** (planos) | Fase 4 (cobrança) | Decisão |
| **Política de hold do clawback** (dias) | Fase 5 (liberação segura) | Decisão |
| **Janela altitude 1** (RLS Faixa B *real*) | Fase 7 (Dinheiro do Hub) | Janela Supabase |
| UAZAPI · HaveIBeenPwned · rotação de segredos · contas Apple/Google | WhatsApp · segurança · deploy · lojas | Config |

**Já destravado:** ✅ Chave Mistral posta (IA viva) · ✅ migração da linhagem aplicada (RAS-01).
**Decisões travadas (07/jul):** ✅ clawback = cobrar sempre + mitigações · ✅ fechar a linhagem antes de dado de rede.

---

## ♻️ Processo (como trabalhamos)

Loop curto: **eu construo UMA coisa → mostro (E2E ao vivo no navegador) → você reage → ajusto.** Backup a cada leva
(GitHub de segurança). Mesa Fable só para **decisão grande / código de dinheiro** (não como padrão). Migração em prod =
**sempre na sua janela**. Nada se perde (rastreabilidade + delete só arquiva).
