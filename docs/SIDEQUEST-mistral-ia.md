# SIDE QUEST — Destravar a IA (resolver a API do Mistral) — pós/durante a maratona

> Pedido do dono: descobrir o bug do Mistral pra destravar a IA (copiloto/agentes/conversacional). **As credenciais NÃO ficam aqui** (senha sensível — o dono dará/rotacionará; segredos vão direto no Render/Supabase, nunca em doc/memória). O dono tem o acesso ao Supabase/Render.

## O que resolver
A IA (copiloto de voz/texto, agentes, conversacional, o futuro Orçamento IA) depende do Mistral. Hoje há um **bug** que trava — descobrir e corrigir.

## Pistas (do contexto)
- O dev empurrou recentemente: `fix(copiloto): força claude-haiku no interpretar` + `fix(copiloto): diagnóstico de chaves no erro da IA` → há atividade recente em torno da **interpretação IA e das chaves**. O "força claude-haiku no interpretar" sugere que o **Mistral estava falhando no `/interpretar`** e fizeram um fallback pro Anthropic/haiku.
- Memória: chave Mistral teria sido ligada no Render (28/jun); provedor é **Mistral-first**, Anthropic dormente.

## Onde investigar (código)
- `lib/ia/llm-completion.ts` (a chamada de completion), `lib/ia/engine.ts`, `lib/ia/ml.ts`, `app/api/copiloto/interpretar/route.ts` (o que o dev mexeu), `lib/ia/ml.ts` / o cliente Mistral, os **model IDs**, o uso da **MISTRAL_API_KEY**, o tratamento de erro (swallow?), o JSON mode, o AbortSignal.
- Candidatos: model ID inválido, chave lida errado/vazia, endpoint, erro engolido sem diagnóstico, rate limit/timeout, JSON mode incompatível.

## A fazer (2 frentes)
1. **CÓDIGO (eu, agora):** ler a integração, achar o bug estrutural, propor/fazer o fix + os testes.
2. **AMBIENTE (com o dono):** confirmar a `MISTRAL_API_KEY` no Render (setada? válida?) + ler os logs do Render do erro real. Feito com o dono vendo (acesso à infra de produção).
