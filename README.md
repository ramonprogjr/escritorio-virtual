# Escritório Virtual — Obra10+

Plataforma Next.js (App Router) + Supabase para CRM, agentes IA, parceiros e automações WhatsApp.

## Requisitos

- Node.js 20+
- Conta Supabase (URL + anon key + **service role** para rotas server-side)
- (Opcional) Anthropic API, Evolution API, Windsor.ai — conforme features ativas

## Desenvolvimento local

O documento mestre pede **porta 3001+** (evitar conflito com outros serviços na 3000):

```bash
npm install
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001).

## Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente/browser |
| `SUPABASE_SERVICE_ROLE_KEY` | APIs server (`/api/*`, webhooks) — **não** expor no cliente |
| `NEXT_PUBLIC_APP_URL` | URLs absolutas (WhatsApp, links) |
| `CRON_SECRET` | Protege ciclos (`/api/ciclos/*`) e geração de link do portal parceiro em produção |
| `PORTAL_HMAC_SECRET` | (Opcional) Assinatura do link `/parceiro/dashboard`; padrão: `CRON_SECRET` |
| `ANTHROPIC_API_KEY` | Respostas IA |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` | Envio WhatsApp |
| `WEBHOOK_HMAC_SECRET` | Validação HMAC do webhook Evolution — ver `EVOLUTION_SETUP.md` |
| `WINDSOR_API_KEY` | Ciclo de tráfego (métricas de campanha) |
| `INTERNAL_API_KEY` | Chave para rotas `/api/*` (servidor) |
| `NEXT_PUBLIC_INTERNAL_API_KEY` | Mesmo valor exposto ao browser — usado em `lib/internal-api-headers.ts` |
| `DEFAULT_TENANT_ID` | UUID do tenant padrão nas escritas server-side (padrão: Obra10 fixo da migração) |
| `PORTAL_VERIFY_RATE_MAX` / `PORTAL_VERIFY_RATE_WINDOW_MS` | Rate limit do POST `/api/parceiros/portal/verify` |

Modelo de variáveis (sem segredos): copie [`.env.example`](.env.example) para `.env.local`.

## Middleware (`middleware.ts`)

Rotas `/api/*` exigem header `x-api-key` igual a `INTERNAL_API_KEY`, exceto as documentadas em [`proxy.ts`](proxy.ts): WhatsApp webhook, health, verificação do portal parceiro, validação CPF/CNPJ, ciclos agendados e `GET /api/ml/ciclo` (auth própria nas handlers).

## RLS multi-tenant (Supabase)

Após aplicar `20260509120000_*.sql`, rode em ordem:

- `20260510130000_rls_tenant_pilot.sql` — funções `app_tenant_id()` (claim JWT `tenant_id`) e políticas em `hub_leads_crm`, `hub_parceiros`, `hub_agente_identidade`, `hub_fila_mensagens`, `hub_tenants`.
- `20260510140000_hub_cotacoes.sql` — tabelas `hub_cotacoes_*` + RLS.

**Claim JWT:** no Supabase Auth, inclua `tenant_id` no JWT (template de claims) para utilizadores `authenticated` de tenants não padrão. O papel `anon` continua restrito ao tenant Obra10 legado nas políticas piloto.

## Crons (Vercel)

Definidos em `vercel.json`: gerente (relatório matinal), diretor (análises, tráfego), atendente (follow-up, SLA), KPIs horários (`/api/ml/ciclo?acao=kpis`). Em produção a Vercel envia o header `x-vercel-cron: 1`, aceito por `lib/cron-auth.ts`.

Chamadas manuais ou CI: `Authorization: Bearer <CRON_SECRET>` ou query/header `secret`.

### Link do portal do parceiro

O CRM usa `GET /api/parceiros/<uuid>/portal-link` com **`x-api-key`** (`NEXT_PUBLIC_INTERNAL_API_KEY`) ou, para operadores, `Authorization: Bearer <CRON_SECRET>`:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" "$NEXT_PUBLIC_APP_URL/api/parceiros/<UUID>/portal-link"
```

## Banco de dados

Scripts de referência em `lib/supabase/*.sql`. Migração alinhada ao documento mestre:

- `supabase/migrations/20260509120000_hub_ciclos_slugs_e_tenants.sql` — `hub_tenants`, `tenant_id` piloto, slugs `diretor_*` em `hub_ciclos_ia`.
- `supabase/migrations/20260510130000_rls_tenant_pilot.sql` — RLS piloto.
- `supabase/migrations/20260510140000_hub_cotacoes.sql` — cotações fornecedor + RLS.

Aplicar no projeto Supabase (SQL editor ou `supabase db push` se usar CLI).

## Backup

Workflow GitHub Actions: `.github/workflows/supabase-backup.yml`. Configure o secret `DATABASE_URL` (connection string Postgres do Supabase) no repositório.

## Documentação

- `docs/01_documento_mestre.md` — visão e fases do produto
- `docs/diagnostico-fase0.md` — saneamento e checklist Fase 0
- `docs/backlog-fases-6-9.md` — épicos pós 27/05
- `docs/fase5-go-live-checklist.md` — go/no-go e rollback

## Scripts

```bash
npm run build   # build de produção
npm run start   # servir build
npm run test    # Vitest (cron-auth, portal, rate limit)
```
