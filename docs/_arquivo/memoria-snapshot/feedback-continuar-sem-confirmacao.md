---
name: feedback-continuar-sem-confirmacao
description: Ao concluir uma tarefa, continuar para a próxima automaticamente, sem esperar confirmação do Wendel
metadata:
  type: feedback
---

Ao **concluir uma tarefa, seguir para a próxima do plano automaticamente** — **sem parar para pedir confirmação**. O Wendel frequentemente está em outra atribuição e demora a ver o chat; esperar trava o avanço.

**Why:** produtividade — ele quer fluxo contínuo, não ping-pong de aprovação a cada passo.

**How to apply:** terminou um passo (validado: `tsc`+`vitest`+`_chk23`, commit local) → emende direto no próximo item do `docs/PLANO-EXECUTIVO-BLOCOS.md`, relatando o que fez e o que vai fazer. **Não** abrir AskUserQuestion para decisões técnicas de baixo/médio risco — escolher o default sensato e seguir, registrando a decisão. **Ainda parar e pedir aprovação humana** só para as TRAVAS: exclusão de dados, mudança irreversível, custo financeiro, credenciais, deploy/produção, push (sem ordem). Decisões de produto genuinamente ambíguas: escolher default razoável, sinalizar, e seguir (não bloquear). Ver [[modo-operacional-code]], [[plano-executivo-blocos]].
