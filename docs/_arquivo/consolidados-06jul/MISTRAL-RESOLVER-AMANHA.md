# Mistral / IA — resolver AMANHÃ (deferido 29/jun)

> O dono fez o teste da chave Mistral e **deu "idle"** + não consegue logar de volta sem o **código do dev** (2FA). Deferido p/ amanhã. Liga [[SIDEQUEST-mistral-ia]], [[pendencias-etapa-copiloto-agentes]].

## Diagnóstico (o que "idle" significa)
- **"idle" = a conta/chave Mistral está DORMENTE/inativa** — quase certo **SEM billing/plano ativo** (a API da Mistral exige plano/crédito ativo; conta sem billing fica idle e a API não serve).
- **NÃO é o código.** Verificado nesta sessão: `lib/ia/llm-completion.ts` (cadeia Mistral→Anthropic→Groq) + `lib/ia/mistral-chat.ts` (endpoint/auth/erros corretos) + modelo `mistral-small-latest` (alias VÁLIDO e atual). A chave está "no lugar certo" no Render (dono confirmou).
- Logo o problema é **o VALOR da chave (inválida/expirada)** OU **a conta sem billing/crédito** (idle aponta p/ billing).

## Bloqueio atual
- Pra logar de volta em `console.mistral.ai` e ativar billing, precisa do **código do dev** (2FA). Por isso → amanhã.

## ✅ Caminho RÁPIDO de amanhã (NÃO depende do Mistral nem do dev): GROQ
O outro dev já fiou o **Groq como 3º fallback**, e o grep confirma que `completarChatPreferindoMistral` (que tem o fallback Mistral→Anthropic→**Groq**) é usado por **TODOS os caminhos de IA**:
- `app/api/copiloto/interpretar/route.ts` (copiloto)
- `lib/ia/engine.ts` (agentes / atendimento WhatsApp)
- `lib/agente-briefing-chat.ts`, `lib/playbook/calibracao-chat.ts`, `lib/playbook/gerar-fluxo-ia.ts`

**Passos (5 min):** criar chave FREE em `console.groq.com` (tem free tier, **sem cartão**) → setar **`GROQ_API_KEY`** no Render → a IA volta a funcionar **via Groq**, contornando o Mistral idle.
- Obs de UX: o Mistral é tentado 1º e dá timeout (~30s+retry) antes de cair no Groq. Se quiser velocidade enquanto o Mistral está idle, depois a gente inverte a ordem (Groq/Anthropic primeiro) ou curto-circuita o Mistral até reativar — pequena mudança em `llm-completion.ts`.

## Caminho DEFINITIVO (quando tiver o código do dev)
- Logar em `console.mistral.ai` → **Billing** → ativar plano / adicionar pagamento / comprar crédito → a conta sai do "idle" → a `MISTRAL_API_KEY` volta a funcionar como provedor primário.
- Validar com o curl: `curl -s -o /dev/null -w "%{http_code}\n" https://api.mistral.ai/v1/chat/completions -H "Authorization: Bearer CHAVE" -H "Content-Type: application/json" -d '{"model":"mistral-small-latest","messages":[{"role":"user","content":"oi"}]}'` → **200** = ok.

## Resumo p/ amanhã
1. (rápido) Groq free → `GROQ_API_KEY` no Render → IA funciona já.
2. (definitivo) código do dev → ativar billing no console.mistral.ai → Mistral primário.
