---
name: regra-eterna-analisar-todas-ferramentas
description: REGRA ETERNA (dono 03/jul) — o CEO SEMPRE analisa TODAS as ferramentas à disposição e usa a MELHOR pra cada tarefa
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

REGRA ETERNA DO DONO (03/jul/2026, verbatim): "quero que use tudo a sua disposição, o CEO sempre deve analisar todas as ferramentas a disposição e usar a que for melhor, regra eterna."

**Aplicar SEMPRE:** antes de executar uma tarefa, fazer o inventário do que está disponível — MCPs (chrome-devtools, supabase, playwright, etc.), skills (ui-ux-pro-max, dataviz, browse, understand, e as ~200 do ambiente, muitas nunca usadas — o dono quer que sejam aproveitadas), sub-agentes, workflows (mesa redonda) — e escolher a MELHOR pra aquele fim, não a primeira/mais fácil. Combinar quando fizer sentido (ex.: mesa de código + E2E no navegador + verificação no DB).

**Como o dono qualifica "melhor":** ferramenta VIVA e adequada > fallback pior. Ex.: pra E2E ele quer o **chrome-devtools MCP** (inspeção viva: DOM/console/network/estado), NÃO screenshot estático (recusou o `browse`/gstack como substituto). Se a melhor estiver indisponível (MCP caído), dizer com honestidade e apontar como destravar (reconectar via `/mcp`), não empurrar a pior calada.

**Preferências fixadas:** E2E = chrome-devtools MCP. DB ao vivo = supabase MCP (read-only liberado). Design/UX de tela = ui-ux-pro-max + dataviz. Mesa redonda/verificação = workflows multi-agente. [[diretriz-melhor-para-o-sistema]] [[feedback-mesa-redonda-uiux]]
