# HANDOFF — Maratona Obra10+ (2026-06-23)

Documento para **retomar do ponto exato** numa sessão nova. Detalhe em [STATUS_MARATONA.md](STATUS_MARATONA.md); decisões em [PROPOSTA_CONJUNTA.md](PROPOSTA_CONJUNTA.md).

## POR QUE REINICIAR A SESSÃO
O MCP do Supabase está **conectado** (`claude mcp list` → `claude.ai Supabase: ✔ Connected`), mas as ferramentas **caíram no meio desta sessão** e o índice de ferramentas **não reindexa no meio da sessão** (Playwright idem). Não é reinstalar — é **abrir uma sessão nova**, que recarrega as ferramentas conectadas. Sem elas, o Bloco E (RLS, via MCP) e o QA visual (Playwright) não rodam.

## FEITO e PROVADO nesta sessão (13 commits locais, SEM push)
- **Service role key** no `.env.local` (válida) + dev reiniciado → data layer recuperado.
- **Bloco A** (fundação): `STATUS_MARATONA.md`, `PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`.
- **Bloco B (API)**: varredura logada **23/23 endpoints `/api/crm`+`/api/hub` = 200**. Data layer saudável.
- **Segurança passo 1 (`crm-api-auth`)**: identidade vem do **cookie de sessão** (não do header `x-caller-auth-id` forjável); estendido às 3 rotas de atendimento (`assumir`/`send`/`devolver`). Validado ao vivo + **6 testes**.
- **Bloco J**: guardrails perda-motivo/ganho-pessoa **já existiam e ligados** → verificados ao vivo + **17 testes**.
- **Robustez**: RBAC auditado + **15 testes**; `codigos-rastreio` + **5 testes**; `distribuir-lead` (scoring IA-first) + **6 testes**.
- **49 testes novos; suíte total 157/157 verde.** `_chk23` OK.

## DESCOBERTAS-CHAVE
- **JWT da sessão NÃO tem claim `tenant_id`** → `app_tenant_id()`=NULL no browser. RLS deve usar **`auth.uid()`→`public.users`** (helper `current_user_tenant_id()`), não o claim.
- **3 schemas no mesmo banco:** `hub_*` (app vivo, com dados) · `crm_*`/genérico (legado quase vazio) · `membros_*`/`profissionais_*` (**Membros — INTOCÁVEL**). Migrations do repo ≠ aplicadas (drift).
- **RLS aberto a anon** (auditoria parcial): `hub_leads_crm` / `hub_pessoas` / `hub_contas_receber` com `qual=true`. `public.users` já travada.

## PRÓXIMO PASSO: BLOCO E (RLS) — receita pronta
Migration escrita em **[docs/sql/bloco-e-rls-DRAFT.sql](sql/bloco-e-rls-DRAFT.sql)**. Na sessão nova, com Supabase MCP ativo:
1. Auditar `pg_policies` das hub_* restantes (`hub_empresas`,`hub_negocios`,`hub_contas_pagar`,`hub_imoveis`,`hub_msg_jobs`,`hub_fila_mensagens`,`hub_pipelines`,`hub_negocio_vinculos`) → completar o mapa de tabelas abertas.
2. Aplicar a migration **1 tabela por vez** (helper + create-before-drop), **backup antes**, **GO humano por tabela**.
3. Provar por **força bruta** (chave anon → negado) + app logado lendo (curl) + realtime de `hub_leads`.
TRAVAS: só `hub_*`; nunca `users`/`membros_*`/`profissionais_*`; migrações aditivas (dropar POLICY é ok/reversível, não apaga dado); sem push.

## COMO RETOMAR (passo a passo na sessão nova)
1. Dev server: se `:3001` não responder, `npm run dev`; depois `node app/_chk23.js` deve dar OK.
2. Login de teste: conta **`nice.engemp@gmail.com`** (owner; senha conhecida pelo usuário). Egress Node→Supabase é intermitente no Windows (`fetch failed`) — se acontecer, retentar.
3. Diga **"retomar Bloco E"** → executo auditoria + apply table-by-table com GO.

## NOTA DE REDE
`fetch` do Node (dev → Supabase `/auth/v1/user`) falha de forma **intermitente** no Windows (`TypeError: fetch failed`), mesmo com `NODE_TLS_REJECT_UNAUTHORIZED=0`. `curl` direto funciona. Retentar quando ocorrer.
