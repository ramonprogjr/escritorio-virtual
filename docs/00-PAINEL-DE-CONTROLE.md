# 🧭 00 — Painel de Controle (COMECE AQUI)

> O **lugar único** para não se perder. São 115+ documentos em `docs/` (muito é histórico) — este painel
> aponta só o que é **canônico hoje**, o **estado real**, o **roadmap/cronograma vivo** e **o que depende de você**.
> Atualizado: **07/jul/2026**. Mantido vivo a cada marco.

---

## 📍 Onde estamos (em 3 linhas)

**~40% da visão / ~70% de um MVP seguro single-tenant.** O núcleo (CRM, motor de leads, negócios/obras, motor de
comissões testado) está de pé e **honesto por arquitetura**, mas o sistema ainda é **fragmentado e single-tenant
disfarçado**. Fase atual: **des-fragmentar a fundação** antes de avançar em features novas.

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

### 🔄 FASE 0 — Des-fragmentar (EU-code, desbloqueado)
- 🔄 **Ligar o motor de comissões nas telas** do negócio (apurar/receber/split) — *mesa de spec seguro rodando*
- ⏳ Unificar os 2 vocabulários de estágio · centralizar o `crmDb` · UI clawback/hold
- **Critério de pronto:** dinheiro tem uma fonte só na tela; vocabulário único no código.

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
