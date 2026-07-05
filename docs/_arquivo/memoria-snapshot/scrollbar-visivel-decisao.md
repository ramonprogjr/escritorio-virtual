---
name: scrollbar-visivel-decisao
description: Scrollbar global agora é 10px dourado VISÍVEL (não reverter pra 3px transparente do design-lock)
metadata:
  type: feedback
---

O dono relatou que "tinha itens que não se viam, sem barra de rolagem, só via dando zoom out". Causa-raiz: a scrollbar global em `app/globals.css` era 3px com trilho transparente e polegar branco a 22% (tokens `--obra-scrollbar-*`) — praticamente invisível, então o conteúdo abaixo da dobra passava despercebido.

Correção (commit 3f64337): `--obra-scrollbar-size: 10px`, trilho `rgba(255,255,255,0.05)`, polegar dourado `rgba(201,162,74,0.45)` (hover 0.75), thumb com `min-height:36px` e borda transparente com `background-clip:padding-box`.

**Why:** discoverabilidade > estética minimalista aqui — o usuário PRECISA perceber que a tela rola. A auditoria (dashboard, cadastro, relatórios, financeiro, atendimento) confirmou que a arquitetura de scroll está correta (1 região de scroll no layout, zero clippers com overflow:hidden); o único problema era a barra invisível.

**How to apply:** NÃO reverter para "fino/transparente" mesmo que o [[design-system-obra10]] mencione esse estilo do sideover — a barra global deve ficar visível. Os carrosséis mobile com `.scrollbar-none` continuam ocultos (regra mais específica `display:none`, não regrediu).
