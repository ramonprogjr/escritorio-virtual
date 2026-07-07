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

## 📚 Documentos canônicos (a fonte da verdade HOJE)

| Doc | O que é | Quando ler |
|---|---|---|
| **[00-PAINEL-DE-CONTROLE.md](00-PAINEL-DE-CONTROLE.md)** | Este painel — o mapa de tudo | Sempre primeiro |
| **[MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md](MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md)** | Doc-mãe: 19 seções ancoradas no código (8.217 linhas) — o estado completo do Hub | Entender o negócio a fundo |
| **[MODELO-DE-NEGOCIO-E-FLUXOS.md](MODELO-DE-NEGOCIO-E-FLUXOS.md)** | A LENTE (1 página): o modelo em resumo | Referência rápida |
| **[ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md](ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md)** | Análise CEO + plano faseado 0→6 | Decidir o que fazer |
| **Auditorias CEO** ([Dashboard](AUDITORIA-DASHBOARD-CEO.md) · [Pipeline Leads](AUDITORIA-PIPELINE-LEADS-CEO.md) · [Ciclo Lead](AUDITORIA-CICLO-LEAD-v1.md) · [Cadastros ProMax](AUDITORIA-CADASTROS-UIUX-PROMAX.md)) | Os laudos das telas já refeitas | Referência |
| Memória do CEO (`.claude/.../memory/`) | Decisões travadas (clawback, linhagem, etc.) | Contexto vivo |

> **Tudo o mais em `docs/` (100+ arquivos: designs E0–E7/A0–A2, planos antigos, sidequests) = HISTÓRICO / referência.**
> Nada se perde — mas não é a fonte atual. Quando um doc antigo conflitar com os canônicos acima, **os canônicos ganham.**

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
