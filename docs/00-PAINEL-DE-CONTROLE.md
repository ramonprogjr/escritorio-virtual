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

### 🔄 FASE 0 — Estancar o irreversível (EU-code + janela do dono)
- ✅ **Código desbloqueado no ar:** MET-01 (markup≥1, app **e** banco) · IA-02 (`ml.ts` roteia com fallback) · EST-03 (CHECK `hub_atividades` blindado + teste 6 mercados) · FIN-03 (aviso `valor_fechado` NULL).
- ✅ **RAS-* aplicados via MCP (07/jul noite):** RAS-01 linhagem (backfill + gatilho `trg_hub_negocios_linhagem` — 0 negócios sem raiz) · RAS-02 (UNIQUE código **já existia**) · RAS-03 (`ator_id`/`ator_codigo` **já existiam**; falta só popular no app — P1).
- **Fase 0 essencialmente FECHADA.** Critério: nenhum negócio novo nasce sem raiz ✅; markup <1 rejeitado (app+banco) ✅; `/api/ml/*` não quebra ✅; ganho sem valor avisa ✅.

### 🔒 FASE 1 — Linhagem (JANELA do dono) — *o único irreversível*
- Migração aditiva `negocio_pai_id`/`negocio_raiz_id` + backfill + wiring em `derivar-negocio`.
- **Decidido:** fechar antes de qualquer dado de rede. **Depende de:** janela de migração.

### 🔒 FASE 2 — IA (chave Mistral)
- Cadastro por voz/colar · busca conversacional · briefing do dia · copiloto · dedup proativa.

### ⏳ FASE 3 — Hardening multitenant (EU-code)
- Deduplicar as 82 rotas · papel de plataforma vivo · guard SELECT-only · auditoria em `hub_eventos`. *Pré-2º-tenant.*

### 🔒 FASE 4 — Altitude 1 + Dinheiro do Hub (JANELA altitude 1)
- Hub lê a rede (RLS Faixa B real) · drill-in "entrar no CRM do tenant" (read-only + auditoria) · bloco Dinheiro do Hub.

### 🔒 FASE 5 — Rede viva
- Comissão da rede realizada · **clawback ativo** (hold + estorno + régua) · escrow ligado (dupla-chave).

### 🔒 FASE 6 — Portal + Cobrança SaaS
- Portal do Cliente (os 5 medos) · planos SaaS/billing (após decisão de preços) · carteira Tijolos cobrando.

---

## 🔑 O que depende de VOCÊ (destrava fases inteiras)

| Item | Destrava | Tipo |
|---|---|---|
| **Chave Mistral** | Fase 2 (IA-first) | Chave |
| **Janela altitude 1** (RLS Faixa B *real*) | Fase 4 (Dinheiro do Hub) | Janela Supabase |
| **Migração da linhagem** | Fase 1 (fundação irreversível) | Janela Supabase |
| **Decisão de preços SaaS** (planos) | Fase 6 (cobrança) | Decisão |
| **Política de hold do clawback** (dias de retenção) | Fase 5 (liberação segura) | Decisão |
| UAZAPI · HaveIBeenPwned · Deploy Hook | WhatsApp · segurança · deploy | Config |

**Decisões já travadas (07/jul):** ✅ clawback = cobrar sempre + mitigações · ✅ fechar a linhagem antes de dado de rede.

---

## ♻️ Processo (como trabalhamos)

Loop curto: **eu construo UMA coisa → mostro (E2E ao vivo no navegador) → você reage → ajusto.** Backup a cada leva
(GitHub de segurança). Mesa Fable só para **decisão grande / código de dinheiro** (não como padrão). Migração em prod =
**sempre na sua janela**. Nada se perde (rastreabilidade + delete só arquiva).
