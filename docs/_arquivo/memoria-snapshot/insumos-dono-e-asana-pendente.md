---
name: insumos-dono-e-asana-pendente
description: "DIRETRIZ \"não perder dados\" (persistir todo insumo do dono) + tarefa PENDENTE de recuperar os documentos de gestão de obras (Asana)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**DIRETRIZ PERMANENTE (dono 29/jun): "organize melhor para não perdermos dados".** Sempre que o dono enviar um DOCUMENTO / spec / transcrito / análise, **persistir IMEDIATAMENTE** num lugar durável: salvar o conteúdo em `docs/` (ex.: `docs/insumos-do-dono/<assunto>.md`) + ponteiro na memória. NUNCA deixar insumo do dono viver só no chat (some entre conversas/projetos). **Why:** o dono enviou documentos do processo de gestão de obras numa conversa anterior e eles não foram persistidos neste projeto → ficaram inacessíveis. Não repetir.

**TAREFA PENDENTE (deferida — "vemos isto mais tarde"): recuperar os documentos de GESTÃO DE OBRAS do dono (estruturados no Asana).** Busca (29/jun) em escritorio-virtual-ramon (projeto+memória+claude-mem) NÃO achou; no projeto anterior `C--Users-wende-Documents-Projetos-Claude-projeto-atual/6772ec13...jsonl` a única menção a "asana" (linha 2103) é uma análise de UX por persona (Ricardo Ferreira, arquiteto que usa Asana) — NÃO é o processo do dono. O Asana real está numa **conta de CONVIDADO inacessível** (MCP "claude.ai Asana" desconectado). **Como recuperar quando retomar:** (a) **Chrome** — dono logado → dirijo o navegador (chrome-devtools/playwright MCP) e leio os boards/campos/fluxo do Asana; OU (b) dono re-envia o documento (e eu PERSISTO na hora). Esse processo é a base do módulo de gestão de obras (Engenharia) e refina o de Arquitetura. Ver [[modulo-engenharia-obra]], [[modulo-arquitetura-requisitos]], [[fluxo-core-captacao-direcionamento]].
