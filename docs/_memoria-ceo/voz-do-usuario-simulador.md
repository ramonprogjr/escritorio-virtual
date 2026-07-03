---
name: voz-do-usuario-simulador
description: "MÉTODO: incluir um agente 'Voz do Usuário / Simulador de Uso' que role-play a persona usando o sistema e SIMULA o uso passo a passo (tap a tap, no contexto real), achando atrito/becos/quebra no mobile que a revisão de código não pega"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Pedido do dono (29/jun):** incluir um **agente que é a visão do cliente/usuário** — traz o ponto de vista de quem USA o sistema e **simula utilizações**.

**Minha avaliação: SIM, possível e MUITO útil.** É o elo que faltava — pega a diferença entre "o design é arquiteturalmente correto" e "uma pessoa real, estressada, no celular com a mão suja, consegue fazer". Exatamente o que causou o bug do mobile (cadastro não aparecia) — uma auditoria de código não pega, um simulador de USO pega.

**Como aplico (a partir de agora):**
1. **Lente nova nas mesas redondas:** "**Voz do Usuário (simulador de uso)**" — assume uma persona (gestor/arquiteto/cliente/fornecedor/operário) e **percorre o fluxo passo a passo, tap a tap**, no contexto REAL dela (mobile, 10s de paciência, o medo), reportando: atrito, becos sem saída, CTA escondido, rótulo confuso, quebra no mobile, e "uma pessoa real faria/entenderia isso?".
2. **Passo de VALIDAÇÃO de uso simulado** (pós-build / pós-deploy): dirigir a UI real (Playwright/Chrome, **mobile-first**) clicando como a persona — pega bug de verdade (teria pego o cadastro). Entra no método: mesa (com a lente de usuário) → build → auditoria adversarial (código) → **simulação de uso (UX/uso real)** → fix → deploy.

Casa com [[feedback-funcional-nao-fachada]] (vão USAR de verdade), [[portal-cliente-medos-cura]] (a tela cura o medo), [[ux-principio-click-talk-go]] (Click-and-Go), [[metodo-auditoria-adversarial-validacao]] (a auditoria de código tem agora a irmã de UX). **WHY:** sistema é pra usar, não pra ter; o ponto de vista de quem usa é insubstituível.
