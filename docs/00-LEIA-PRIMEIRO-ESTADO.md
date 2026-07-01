# 📍 00 — LEIA PRIMEIRO: Estado Atual + Índice-Mestre + Ponto de Retorno

> **Este é o ponto de entrada único.** Atualizado: 01/jul/2026. Se algo der errado, comece por aqui.

---

## 🔙 PONTO DE RETORNO (onde voltar se algo der errado)
- **Tag git:** `estado-01jul-pos-auditoria` · **commit:** `43e8177` (branch `wendel/dev` → `feature/escritorio-visual`).
- **Estado bom conhecido:** `tsc 0` · `vitest 666 verdes` · `build 0`. Auditoria enterprise + Batch 1/2/UX de segurança no ar.
- **Como voltar:** `git checkout estado-01jul-pos-auditoria` (ou `git reset --hard 43e8177` na branch, com cuidado). O commit está no remote (durável).
- **Método sempre:** aditivo · gates (tsc+vitest+build) antes de push · `git pull --rebase` · migração só na janela do dono · nada de secret no Git.

## 📊 ESTADO ATUAL (honesto)
- **Núcleo comercial:** no ar e maduro (~90% apresentável).
- **Visão completa (comercial+AEC+Hub+monetização+portal):** ~35–40%. Muita fundação AEC pronta em código mas **latente** (migrações não aplicadas — janela do dono).
- **Segurança:** auditoria enterprise deu **REPROVADO 3.5/10** para produção multi-tenant. Achado-raiz: **middleware de auth é código MORTO** (`proxy.ts` ≠ `middleware.ts`). Correções seguras (guards in-handler) já no ar; críticos de produção esperam a janela do dono.

## 🎯 DOCUMENTOS CANÔNICOS (o que vale AGORA)
| Doc | O que é |
|---|---|
| **este (00-LEIA-PRIMEIRO-ESTADO)** | ponto de entrada, estado, índice, retorno |
| [AUDITORIA-ENTERPRISE.md](AUDITORIA-ENTERPRISE.md) | auditoria completa (50 melhorias, notas, roadmap, pentest) |
| [REMEDIACAO-AUDITORIA.md](REMEDIACAO-AUDITORIA.md) | triagem: o que eu faço x janela do dono |
| [MACRO-PLAN-ATUALIZADO.md](MACRO-PLAN-ATUALIZADO.md) | mapa reconciliado do que falta implantar (fases 0–5) |
| [PLANO-APLICAR-MIGRACOES.md](PLANO-APLICAR-MIGRACOES.md) | plano seguro das migrações p/ a janela do dono *(em construção)* |
| [PENDENCIAS-DONO-INFRA.md](PENDENCIAS-DONO-INFRA.md) | passos de infra do dono (Render/Supabase) |
| [LOG-DEPLOYS.md](LOG-DEPLOYS.md) | log cronológico dos deploys/avanço |

## 🗂️ ÍNDICE POR CATEGORIA (o resto, catalogado p/ não se perder)
- **🔒 Auditorias/segurança:** AUDITORIA-ENTERPRISE · SEGURANCA-H-SEC-1 · E2E-DOMINIO-{H,B,A,C,D,E,F,G,I}-ACHADOS · E2E-AUDITORIA-PLANO · RESUMO-NOITE-E2E-FINALE · MOBILE-AUDITORIA-ACHADOS · AUDITORIA-MOBILE-2026-06-26 · AUDITORIA-47-TELAS · ANALISE-MESTRA-ESCOPO.
- **🗺️ Planos/roadmap:** MACRO-PLAN-ATUALIZADO · REMEDIACAO-AUDITORIA · PLANO-APLICAR-MIGRACOES · PLANO-EXECUTIVO-BLOCOS · PLANO-BLOCOS-ARQ-ENG · PLANO-MACRO-CONCLUSAO · PLANO-ACAO-MACRO-DESIGN · PENDENCIAS · PENDENCIAS-BACKLOG-TRIAGE · DIVIDAS-TECNICAS · BACKLOG-FEATURES.
- **🏗️ Designs AEC/produto:** ESTRUTURA-UNIFICADA-OPERACAO-DESIGN · ORCAMENTARIA-SETOR-DESIGN · E0–E7-DESIGN · A0–A2-DESIGN · PORTAL-CLIENTE-DESIGN · E6-DESIGN(escrow) · EAP-REFINADA-DESIGN · ORCAMENTO-IA-DESIGN · CENTRAL-APROVACOES-DESIGN · MARKETPLACE-DESIGN · CAMPO-DESIGN · PLATAFORMA-DESIGN.
- **📈 Relatórios de rodada:** MARATONA-2H-RELATORIO · RELATORIO-AVANCO-01jul · RESUMO-NOITE-E2E-FINALE · RELATORIO-NOITE.
- **📱 Métricas/UX:** CENTRAL-PERFORMANCE-METRICAS · UIUX-AUDITORIA-E-PLANO · PADRAO-SHELL-TELAS · ui-page-headers · ui-scrollbars.
- **📥 Insumos do dono:** pasta `docs/insumos-do-dono/` (spec de obras, planilha analisada, portal-do-cliente-e-medos, INDICE).
- **🗄️ Históricos/superados (referência):** documento-mestre-obra10-v1 · 01_documento_mestre · HANDOFF* · STATUS* · resumo-2026-05-22 · crm-* (modelo/fluxos/schema antigos) · diagnostico-fase0 · menu-*/inventario-menu.

## 🔴 O QUE PRECISA DO DONO (janela crítica — detalhe em REMEDIACAO-AUDITORIA.md)
1. **🚨 Infra (agora):** ROTACIONAR `SUPABASE_SERVICE_ROLE_KEY` · DELETAR `.github/workflows/backup-auto.yml` (push de PII) · tirar `.env.local`/repo do OneDrive · tirar `NEXT_PUBLIC_INTERNAL_API_KEY` do Render.
2. **Migrações (janela):** RLS `USING(true)`, financeiro (SQL inválido), fornecedores sem RLS, backfill tenant + `.eq` puro; + a série AEC (E0–E7/A0–A2) que liga a obra.
3. **App-wide (comigo):** ligar o middleware (verificar allowlist), escrow (custódia fantasma + FOR UPDATE), webhook/cron HMAC.
4. **Ligar IA + testar login** (Mistral/HMAC/GROQ no Render).

---
*Regra de ouro: dinheiro → dados/multi-tenant → privilégio → IA-custo → resto. Qualidade e controle antes de velocidade.*
