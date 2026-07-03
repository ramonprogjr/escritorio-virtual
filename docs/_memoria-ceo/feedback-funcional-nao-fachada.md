---
name: feedback-funcional-nao-fachada
description: REGRA — a apresentação NÃO é só tela bonita; os clientes vão USAR de verdade. Nada de botão que não funciona ou que está feio. Entregar funcional + polido, verificado clicando no navegador
metadata:
  type: feedback
---

Diretriz do Wendel (25/jun/2026): a apresentação não é sobre "tela bonita" — **os clientes/usuários vão USAR o sistema de verdade**. Portanto:

- **Nada de botão que não funciona** (sem placeholder/fachada/"em breve" disfarçado de pronto).
- **Nada feio** — se entregar, tem que estar polido (design system Obra10+).
- **Funcional > vistoso**: cada entrega tem que fazer o trabalho real ponta a ponta.

**Why:** botão quebrado/feio num produto que vai a uso real destrói confiança — pior que não entregar. É um produto que vai a mercado.

**How to apply:** ao entregar qualquer tela/feature, **verificar clicando no navegador** (chrome-devtools/playwright): cada botão executa a ação? estados (hover/disabled/erro/vazio) existem? carrega dados reais? Sem ação que cai em "—"/no-op. Se um botão ainda não tem função, **não mostrar** (ou marcar honestamente "em breve"), nunca fingir. Casa com [[ceo-mandato-produto]] (telas para o job), [[feedback-mesa-redonda-uiux]] e [[feedback-barometro-progresso]]. Verificação no navegador é parte do gate, junto com tsc+vitest+_chk23.
