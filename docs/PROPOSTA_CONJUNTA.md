# Propostas conjuntas (mesa-redonda) — Obra10+

> Registro das decisões da mesa-redonda. Formato: data · decisão · porquê · quem assina.

## 2026-06-23 — D1: Plano da Maratona + modo de trabalho
- **Decisão:** executar em 12 blocos (A–L), etapas pequenas e isoladas, **modo loop autônomo** até o critério de aceite ser provado logado ao vivo. `executive-director` aprova; **GO humano só p/ migration em prod e deploy.**
- **Design:** é inspiração aprovada — **pode melhorar para melhor**, sem estragar o que funciona nem degradar a identidade (dark verde+dourado, `globals.css`). Screenshot antes/depois em toda mudança de UI.
- **Escopo:** só `hub_*` (+ `crm_*` legado para deprecar com trava). **Membros intocado** (mesmo Supabase).
- **Migrações:** só aditivas, uma por vez, backup antes, GO humano.
- **Assinam:** chief-architect (impacto/deps), product-owner (valor), security-guidance (escopo/Membros/segredos).

### D1.1 — Bloco A (fundação)
- **Hipótese/necessidade:** o fluxo exige artefatos que não existiam (`STATUS_MARATONA.md`, `PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`).
- **Decisão:** criar os 4 (arquivos novos, zero risco, sem tocar código/banco/design). `_chk23` é o gate de saúde de todas as etapas seguintes; `_publicar.ps1` é pré-voo sem push.
- **Critério de aceite:** os 4 existem e `node app/_chk23.js` retorna OK no estado atual. — **ATENDIDO.**

## 2026-06-23 — D2: Segurança (Bloco D→E) — achados vivos + plano validado pelo security-reviewer
- **Achados VIVOS (2× CRÍTICO):** (1) RLS aberto a anon (`qual=true`) em `hub_leads_crm`/`hub_pessoas`/`hub_contas_receber` — leitura **e escrita** não-autenticada, cross-tenant, contato de lead exposto (inclusive via `vw_hub_leads_crm_enriquecido`); (2) `lib/crm/crm-api-auth.ts` confia em `x-caller-auth-id` forjável + `INTERNAL_API_KEY` no-op → impersonation/escalada sobre rotas que usam service role.
- **security-reviewer: PROCEDE, método correto, mas NO-GO até:** criar policies `authenticated`+`app_tenant_id()` e validar ANTES de dropar as permissivas (o browser lê `hub_*` direto pelo client+realtime — dropar sem a policy nova quebra leads/financeiro/contatos/realtime); confirmar que `app_tenant_id()` resolve sob o JWT do browser; corrigir `crm-api-auth` no MESMO bloco (RLS sozinho é falsa segurança, pois `/api/*` usa service role).
- **Ordem aprovada:** 1) fix `crm-api-auth` (código, reversível, sem DDL); 2) confirmar `app_tenant_id()` sob JWT; 3) por tabela `hub_*`: CREATE policy → validar logado + força bruta anon → DROP permissiva (backup + GO humano); 4) validar realtime/views.
- **Decisão:** dropar POLICY permissiva é exceção justificada à trava "só aditivo" (policy ≠ dado/coluna; RLS é OR, então a permissiva PRECISA sair). Escopar só `hub_*`, nunca tocar `users`/`membros_*`/`profissionais_*`.
- **Assinam:** security-reviewer (validou), chief-architect (impacto), executive-director (aprova execução), product-owner (trava de contato de lead).
