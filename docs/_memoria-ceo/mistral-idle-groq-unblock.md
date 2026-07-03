---
name: mistral-idle-groq-unblock
description: "Mistral deferido p/ amanhã (29/jun): o teste da chave deu 'idle' = conta Mistral dormente, provável SEM billing/plano ativo (não é o código — verificado OK). Bloqueado no código/2FA do dev p/ logar. SAÍDA RÁPIDA = Groq (fallback já fiado em TODOS os paths de IA via completarChatPreferindoMistral; chave FREE em console.groq.com → GROQ_API_KEY no Render contorna o Mistral idle, sem depender do dev)"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Mistral deferido p/ AMANHÃ (dono, 29/jun).** Doc: `docs/MISTRAL-RESOLVER-AMANHA.md`. Liga [[testes-ia-pendentes-validar-com-dono]], [[pendencias-etapa-copiloto-agentes]], [[agentes-ia-llm-anthropic]].

**O teste da chave deu "idle"** → conta/chave Mistral DORMENTE, quase certo **SEM billing/plano** (a API exige). **NÃO é o código** — verificado: `lib/ia/llm-completion.ts` (cadeia Mistral→Anthropic→Groq) + `lib/ia/mistral-chat.ts` + modelo `mistral-small-latest` (válido). Bloqueio: precisa do **código do dev (2FA)** p/ logar em console.mistral.ai.

**SAÍDA RÁPIDA amanhã (sem depender do Mistral nem do dev): GROQ.** Grep confirmou que `completarChatPreferindoMistral` (fallback Mistral→Anthropic→**Groq**) é usado por TODOS os caminhos: copiloto (`app/api/copiloto/interpretar/route.ts`), agentes/WhatsApp (`lib/ia/engine.ts`), `agente-briefing-chat`, playbook (`calibracao-chat`, `gerar-fluxo-ia`). → criar chave FREE em console.groq.com (sem cartão) → `GROQ_API_KEY` no Render → IA funciona via Groq. (Mistral é tentado 1º + timeout antes do Groq; se quiser velocidade, inverter a ordem em llm-completion.ts depois.)

**DEFINITIVO:** código do dev → console.mistral.ai → Billing → ativar plano → Mistral primário de volta. **WHY:** destrava a IA-first (copiloto/agentes) sem esperar o billing do Mistral. **How to apply:** Groq amanhã (5 min) = IA no ar.
