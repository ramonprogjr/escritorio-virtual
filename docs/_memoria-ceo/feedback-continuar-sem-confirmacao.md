---
name: feedback-continuar-sem-confirmacao
description: "Ao concluir uma tarefa, continuar para a próxima automaticamente, sem esperar confirmação do Wendel"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Ao **concluir uma tarefa, seguir para a próxima do plano automaticamente** — **sem parar para pedir confirmação**. O Wendel frequentemente está em outra atribuição e demora a ver o chat; esperar trava o avanço.

**Why:** produtividade — ele quer fluxo contínuo, não ping-pong de aprovação a cada passo.

**How to apply:** terminou um passo (validado: `tsc`+`vitest`+build/commit local) → emende direto no próximo item, relatando o que fez e o que vai fazer. **Não** abrir AskUserQuestion para decisões técnicas de baixo/médio risco — escolher o default sensato e seguir, registrando a decisão. Decisões de produto genuinamente ambíguas: escolher default razoável, sinalizar, e seguir (não bloquear).

**REGRA DOS 10 SEGUNDOS (dono 03/jul):** "se eu não responder em 10 segundos, o CEO prossegue com o que NÃO precisa da minha aprovação." → não ficar esperando; proceder no que é da minha alçada.

**Minha alçada (PROSSIGO sem esperar):** commitar código gate-verde; **subir deploy** de mudança validada (staging feature/escritorio-visual, com logins externos DESLIGADOS); preparar SQL da janela do dono (docs, não aplicar); rodar workflows de análise/E2E; refinar.

**TRAVAS REAIS (ainda preciso do dono):** abrir LOGIN EXTERNO (cliente/fornecedor/MDO — só pós E2E+mesa+segurança); rodar SQL em PROD (janela do dono — classificador barra e está certo); qualquer coisa IRREVERSÍVEL ou custo financeiro/credenciais. Ver [[modo-operacional-code]], [[diretriz-melhor-para-o-sistema]].
