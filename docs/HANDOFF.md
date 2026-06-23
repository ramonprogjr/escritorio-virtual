# HANDOFF — Maratona Obra10+ (2026-06-23)

Estado para retomar limpo. Detalhe completo em [STATUS_MARATONA.md](STATUS_MARATONA.md); decisões em [PROPOSTA_CONJUNTA.md](PROPOSTA_CONJUNTA.md).

## FEITO e PROVADO (logado)
- **Service role key** carregada no `.env.local` (válida); dev reiniciado → data layer recuperado.
- **Bloco A** (fundação) — `STATUS_MARATONA.md`, `PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`. `_chk23` OK.
- **Bloco B (API)** — varredura logada de **23 endpoints `/api/crm` e `/api/hub` = 23/23 200**. Data layer saudável.
- **Segurança passo 1 (`crm-api-auth`)** — FECHADO: identidade do chamador vem do **cookie de sessão** (não do header `x-caller-auth-id` forjável); estendido às 3 rotas de atendimento (assumir/send/devolver). Validado ao vivo (escalada fechada; sem regressão). Commits: `3ad71db`, `247f5a7`.

## DESCOBERTAS-CHAVE
- **JWT da sessão NÃO tem claim `tenant_id`** → `app_tenant_id()`=NULL no browser. RLS do Bloco E deve resolver tenant por **`auth.uid()`→`public.users`** (helper `current_user_tenant_id()`), não pelo claim.
- **3 schemas no mesmo banco:** `hub_*` (app vivo, com dados) · `crm_*`/genérico (legado quase vazio) · `membros_*`/`profissionais_*` (projeto Membros — INTOCÁVEL). Migrations do repo ≠ aplicadas (drift).
- **RLS heterogêneo (auditoria parcial):** `public.users` 🟢 travada; `hub_leads_crm`/`hub_pessoas`/`hub_contas_receber` 🔴 abertas a anon (`qual=true`).

## TRAVADO (precisa de ferramenta/segredo — não é bug)
- **Bloco E (corrigir RLS aberto)** → precisa **Supabase MCP** reconectar (caiu nesta sessão). Recipe pronta: finir auditoria viva de todas as tabelas `hub_*` (`pg_policies`), criar policies `authenticated` via `current_user_tenant_id()` **antes** de dropar as permissivas, uma tabela por vez, backup + GO, provar por força bruta (anon negado) + app logado lendo.
- **QA visual/console por tela** → precisa **Playwright** reconectar (cold load, botões, console).
- **Bloco H (Anthropic)** → precisa `ANTHROPIC_API_KEY` (secret no `.env.local`/Render) + egress a `api.anthropic.com`.

## COMO RETOMAR
1. `npm run dev` (porta 3001) se não estiver no ar; `node app/_chk23.js` deve dar OK.
2. Re-login de teste e validar via curl (egress do Node→Supabase é intermitente no Windows; se der `fetch failed`, repetir):
   `nice.engemp@gmail.com` / senha conhecida → cookie `obra10_crm_access` → bater `/api/crm/me/context` (200 esperado).
3. Próximo passo recomendado: **Bloco E** (quando MCP voltar) ou **Bloco H** (se o usuário fornecer a chave Anthropic).

## NOTA DE REDE
O `fetch` do Node (dev server → Supabase `/auth/v1/user`) falha de forma **intermitente** no Windows (`TypeError: fetch failed`), mesmo com `NODE_TLS_REJECT_UNAUTHORIZED=0`. `curl` direto funciona. Isso derrubou o MCP e atrapalha validações logadas — retentar quando acontecer.
