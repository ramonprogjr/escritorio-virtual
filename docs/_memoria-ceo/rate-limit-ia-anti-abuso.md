---
name: rate-limit-ia-anti-abuso
description: Rate limit em TUDO que toca IA — anti-abuso de custo/tokens + segurança (dono 02/jul)
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

DIRETRIZ DO DONO (02/jul/2026): "TER RATE LIMIT EM TUDO O QUE É RELACIONADO COM IA PARA NÃO TER MAL INTENCIONADOS GASTANDO IA E TRAZER SEGURANÇA."

Requisito de segurança + custo: **toda superfície que consome IA precisa de rate limit** por usuário/tenant/IP, senão um mal-intencionado (ou bug em loop) queima tokens/dinheiro. Isso é defensivo (anti-DoS de custo) e entra na esteira de segurança.

**Onde aplicar (mapear na hora de executar):** router de IA (`lib/ia/router.ts`), rotas `app/api/agentes/*`, `app/api/hub/agentes/*`, copiloto de voz, atendimento WhatsApp→fila→worker→IA, geração de fluxo/playbook, qualquer endpoint que chame Mistral/Groq/Anthropic. Rate limit por (tenant + usuário) e também por IP nos endpoints públicos/portais.

**Ponto de partida que já existe:** `lib/portal-rate-limit.ts` (+ teste) — reusar/estender o mesmo mecanismo para os endpoints de IA em vez de criar outro. Amarrar ao metering de créditos (medir tokens por escritório) — mesmo eixo de "quem gastou quanto". [[creditos-ia-metering-visao]]

**Quando:** NÃO é agora (dono disse "para outro momento"); item da Maratona 3 (segurança) ou logo após. Não abrir IA a login externo sem isso. [[auditoria-enterprise-01jul]]
