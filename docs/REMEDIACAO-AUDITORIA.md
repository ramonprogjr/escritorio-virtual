# 🔧 Plano de Remediação — Auditoria Enterprise

> Triagem CEO dos 50 achados de [AUDITORIA-ENTERPRISE.md](AUDITORIA-ENTERPRISE.md). Régua: qualidade e controle antes de velocidade. Separado por **quem pode fazer com segurança agora** vs **janela do dono** (produção/irreversível/app-wide).

## ✅ Confirmado por verificação própria
- **Middleware é código MORTO** (`.next/server/middleware-manifest.json` → `"middleware": {}`; não há `middleware.ts`; `proxy.ts` exporta `proxy`, não `middleware`, e ninguém o importa). A auditoria H-SEC-1 anterior estava **errada** — o proxy NÃO roda. Portanto as rotas privilegiadas dependem SÓ de guard in-handler; as que não têm, estão abertas.

## 🟢 EU faço agora (código, baixo raio de explosão, testável)
Guards in-handler + tenant-scope nas rotas PRIVILEGIADAS abertas (que são internas — nunca deveriam ser públicas, então adicionar auth não quebra fluxo legítimo). Cada batch: gates (tsc+vitest+build) + auditoria adversarial + deploy.
- **Batch 1:** `/api/hub/agentes/**`, `/api/hub/cargos/**` (podiam deletar a linha WhatsApp / reescrever agentes sem login).
- **Batch 2:** `/api/crm/imoveis` (IDOR — tenant), `PATCH /api/leads` (mass-assignment/IDOR — whitelist + auth), injeção PostgREST via `busca` no `.or()` (sanitizar).
- **Batch 3:** `/api/cotacoes/*` — ANALISAR: parte é interna (CRM→sessão), parte é do fornecedor público (precisa token assinado, como o portal do parceiro). O que for supplier-facing SEM mecanismo de token → **flag pro dono** (decisão de design de auth).
- **Correções de código pontuais seguras:** zoom reabilitado (a11y, `userScalable`), try/catch no Atendimento (loading infinito), `hub_lead_lookup` com `.eq(tenant_id)`, remover `NEXT_PUBLIC_INTERNAL_API_KEY` de `render.yaml`/`.env.example`.

## 🔴 JANELA DO DONO (produção / irreversível / app-wide — NÃO faço sozinho)
- **Ligar o middleware** (renomear `proxy.ts`→`middleware.ts` + função `proxy`→`middleware`): é o fix de maior alavanca (protege ~60 rotas de uma vez), MAS é mudança **app-wide de auth** — pode bloquear um fluxo público não-allowlistado (ex.: intake `/api/leads` público). Preparar + verificar a allowlist `isPublicApiPath` fluxo a fluxo + testar login/cadastro **com o dono**. **NÃO ligar às cegas.**
- **Migrações de RLS** (bloqueadas pelo classificador): matar os `USING(true)` (`users`, `hub_pessoas/empresas`, `pipelines/vínculos`), ligar RLS em `hub_fornecedores`, corrigir `CREATE POLICY IF NOT EXISTS` (SQL inválido → RLS do financeiro nunca aplicou), backfill `tenant_id NOT NULL` + trocar `tenantScopeOrFilter` por `.eq` puro.
- **Escrow** (migração + dinheiro): remover `GREATEST(0, 0 - v)` (custódia fantasma), RPC de depósito, `FOR UPDATE` + UNIQUE de liberação (double-spend).
- **Infra crítica:** **rotacionar a `service_role`** do Supabase (JWT válido até 2036), **tirar o repo/`.env.local` do OneDrive**, **deletar `.github/workflows/backup-auto.yml`** (faz `git push` de PII de leads pro histórico), tirar `NEXT_PUBLIC_INTERNAL_API_KEY` do Render.
- **Webhook/cron:** HMAC real (timestamp+nonce) + `CRON_SECRET` timing-safe (hoje `x-vercel-cron:1` forjável no Render + segredo em query).

## 🟠 Próxima sprint (com o dono no comando)
Entitlements SaaS/planos (não existem), créditos IA com gate atômico + recarga, rate-limit distribuído (Redis), prompt-injection/RAG cross-tenant/memory-poisoning, CI (tsc+vitest+eslint+audit), observabilidade (logger em todas as rotas, redigir PII/error.message).

---
*Ordem de ataque: dinheiro → dados/multi-tenant → privilégio → IA-custo → resto. Aditivo, auditado, com gates.*
