---
name: creditos-ia-metering-visao
description: Sistema todo é IA-first; medir tokens por escritório e vender créditos pré-pagos (3ª perna de monetização)
metadata:
  type: project
---

O dono definiu (26/jun/2026) que **todo o sistema é conversacional e IA-first** (relatórios, contratos, pedidos de material, dashboards, cronogramas, planejamento financeiro, compras, check-in/out — a IA gera). **Cada geração consome tokens; o dono repassa 100% do custo + margem, vendido como CRÉDITOS PRÉ-PAGOS** dentro do sistema. É a **3ª perna de monetização** junto de [[monetizacao-licenciamento-rede]] (assinatura SaaS + comissionamento transacional).

**Correção de premissa registrada:** "Claude Code" (a CLI) NÃO é o motor de IA em produção — é dev tool. O motor dos usuários é **Claude via API** e/ou **Mistral** (hoje Mistral-first). O metering é provider-agnostic.

**Fundação que já existe:** o chokepoint `lib/ia/llm-completion.ts` (`completarChatPreferindoMistral`) já retorna `tokensEntrada/tokensSaida/modeloLog` — é onde a medição engata. Multi-tenant real já flipado → carteira/ledger tenant-scoped.

**Moeda decidida: "Tijolos" 🧱** (reconfigurável via `hub_ia_config.nome_moeda`); usuário NUNCA vê R$ nem tokens (base de cálculo oculta). 1 Tijolo = R$0,10, markup 10×, câmbio 6. Modelo de negócio = PRÉ-PAGO (hard-cap; pós-pago = exceção admin). Claude liberado como nível "Turbo" (provider-agnostic, roteia por tarefa via `hub_agente_identidade.modelo_*`). Requisito: painel super-admin de precificação (preços por modelo, markup, câmbio, overrides por escritório).

**Spec:** `docs/superpowers/specs/2026-06-26-creditos-ia-metering-design.md` · **Plano:** `docs/superpowers/plans/2026-06-26-creditos-ia-fase1.md`.

**✅ FASE 1 ENTREGUE (26/jun, no ar):** `lib/ia/metering-calc.ts` (funções puras) + `lib/ia/metering.ts` (recorder best-effort + saldo) + medição sombra ligada em `lib/ia/engine.ts` + rota `GET /api/crm/ia/creditos`. Migração `20260626210000_ia_metering.sql` APLICADA na Supabase (4 tabelas: hub_ia_precos/config/consumo/creditos_mov; RLS tenant-scoped; seed 6 preços + config global; advisors limpos p/ as novas tabelas). 193 testes verdes. Commits no origin/wendel/dev.

**Próximas fases:** 2=carteira/widget+saldo+estimativa na UI → 3=pré-pago+hard-cap+top-up (TRAVA: gateway) → 4=assinatura concede Tijolos + super-admin config + painel previsão.

**Preços de referência (jun/2026, USD/1M):** Opus 4.8 5/25 · Sonnet 4.6 3/15 · Haiku 4.5 1/5 · Fable 5 10/50 · Mistral barato. Prompt caching corta ~90% do contexto repetido (alavanca de margem).
