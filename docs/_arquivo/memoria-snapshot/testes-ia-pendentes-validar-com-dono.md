---
name: testes-ia-pendentes-validar-com-dono
description: LEMBRAR o dono ao retornar — validar a IA ao vivo em PRODUÇÃO (a chave Mistral foi ligada no Render 28/jun). 3 testes combinados. NÃO esquecer de lembrar.
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono pediu EXPLICITAMENTE (28/jun, ao sair p/ ~10h): "me lembre destes testes, faremos depois". A chave `MISTRAL_API_KEY` JÁ está no Render → a IA acendeu (atendimento, agentes, geração de fluxo, copiloto, Agent Builder). Validar JUNTO com o dono quando ele voltar:

## ⚡ Os 3 testes (em PRODUÇÃO — onde está a chave; não no localhost)
1. **Geração de fluxo (a estrela):** App prod → IA E AGENTES → Agentes IA → abrir um agente com cargo/playbook (ex. Marina) → "Playbook — Calibração" → "Editar fluxo visual" → botão "✨ Gerar fluxo com IA" → a IA monta o fluxo de verdade e abre no editor (reativado: flag ligada, cores na marca, nós PDF/áudio/split do Batch 3). Se já tiver fluxo, abre direto.
2. **Atendimento:** mandar um WhatsApp pro número conectado de um agente → ver se responde (UAZAPI pago+conectado).
3. **Copiloto de voz:** FAB verde (canto inferior) → falar "resumo deste lead".

Se qualquer um der erro, é o ajuste-fino típico da PRIMEIRA ativação da IA — corrigir na hora (logs + código disponíveis). Conecta [[copiloto-voz-global]], [[agent-builder-ia-fase1]], [[sessao-handoff-28jun2026]].

## Contexto técnico (já verificado)
- O app lê `MISTRAL_API_KEY` da env do RENDER (`process.env`, não do Supabase) — confirmado em lib/ia/mistral-chat.ts etc.
- O editor visual de fluxo EXISTIA, estava só desligado por flag em prod; reativado (commits da sessão). Bucket `playbook-media` criado p/ PDF/áudio.
- Localhost (dev) provavelmente NÃO tem a chave (.env.local) — por isso o teste é em prod.
