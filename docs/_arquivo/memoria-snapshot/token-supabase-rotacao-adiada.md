---
name: token-supabase-rotacao-adiada
description: O dono pediu para NÃO rotacionar o PAT do Supabase agora — lembrar de cobrar a rotação no futuro
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

Um Personal Access Token do Supabase (`sbp_...`) foi usado nesta maratona (colado em texto) para aplicar migrações via Management API. Em 28/jun/2026 o dono decidiu **NÃO rotacionar agora** e pediu explicitamente: **"me lembre novamente no futuro"**.

**How to apply:** NÃO tratar a rotação como pendência ativa nem cobrar a cada turno. Ao reabrir sessões futuras (ou quando a maratona de produção fechar / antes de qualquer go-live amplo), **lembrar o dono de revogar/rotacionar o token** no painel Supabase → Account → Access Tokens. Continua válido o princípio: nunca salvar o token na memória nem no Git. Relacionado: [[sessao-handoff-28jun2026]].
