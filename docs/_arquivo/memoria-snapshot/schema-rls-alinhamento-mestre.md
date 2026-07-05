---
name: schema-rls-alinhamento-mestre
description: "Schema Supabase do Hub Obra10+ — entidades, alinhamento com o documento mestre e RISCOS CRÍTICOS de RLS multi-tenant"
metadata: 
  node_type: memory
  type: project
  originSessionId: 14f09c39-1513-461c-9ff4-53a1d5d43425
---

Análise 2026-06-23 (71 migrações em `supabase/migrations/`). O projeto mantém um tracker próprio de alinhamento ao PDF mestre em [lib/crm/progresso-sistema-data.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/crm/progresso-sistema-data.ts).

**Entidades centrais (alinhadas ao mestre):** `hub_leads_crm`, `hub_pessoas`, `hub_empresas` são **3 tabelas separadas** ✅; `hub_negocios` é o centro com `lead_id` FK→leads e `hub_negocio_vinculos` (polimórfico pessoa/empresa/parceiro/lead com `papel`) ✅; `hub_obras`/`hub_projetos` têm `negocio_id` (mas **sem FK**); `hub_imoveis` ✅. Funis em tabela: `hub_pipelines`(`tipo` lead|negocio, `mercado_sigla`) + `hub_pipeline_estagios`, seeds dos 8 mercados (IMB/ARQ/RFM/MRC/ENG/SRV/PRO/**FOR**=homologação). `proxima_acao` existe em leads, negócios e tabela `hub_proximas_acoes` ✅. Auditoria: `hub_logs`(valor_anterior/novo/motivo), `hub_decision_logs`.

**DIVERGÊNCIAS vs mestre (o próprio tracker reconhece como "parcial"):**
- **Parceiro:** há tabela própria `hub_parceiros` + 4 subtabelas (`_captacao`,`_homologacao`,`_modulos`,`_log`) — contraria "parceiro = relação, não entidade". 🔴
- **Homologado:** existe **tabela separada** `hub_parceiros_homologacao` + `hub_parceiros.status='homologado'`(TEXT livre) — contraria "homologado = status". 🔴
- **Fornecedor:** sem tabela própria mas duplicidade conceitual com `hub_parceiros`; classificação por segmento só parcial. 🔴
- **Produto:** NÃO existe `hub_produtos` (só `hub_servicos`). 🔴 gap.
- **Códigos:** formato `PREFIXO-AAAA-####` (`PES-2026-0001`, não `PS2026001`), gerados em TS via `COUNT(*)+1` ([lib/crm/codigos-rastreio.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/crm/codigos-rastreio.ts)) — **sem sequence/lock (corrida → colisão) e sem trigger de imutabilidade**. 🟡

**⚠️ CORREÇÃO 2026-06-23 (verificação no banco VIVO):** os riscos de RLS abaixo foram derivados dos `.sql` do REPO, mas há **drift repo↔prod** — em prod as políticas podem ser MELHORES. Verificado ao vivo: `public.users` em prod NÃO é `true/true` (é `ALL` via `is_hub_admin()` + `SELECT` via `auth_id=auth.uid()`). **Antes de qualquer fix de RLS, reverificar a política VIVA de cada tabela via Supabase MCP (`pg_policies`)** — não confiar nesta lista derivada do repo. (Auditoria viva ficou parcial: MCP instável; só `users` confirmado.)

**RISCOS CRÍTICOS DE RLS (segurança multi-tenant) — DERIVADO DO REPO, REVERIFICAR EM PROD:** o isolamento real depende HOJE da camada de aplicação (rotas usam service role, que ignora RLS). No banco (segundo o repo):
- **Políticas `true/true` sem filtro de tenant** em `public.users`(RBAC!), `hub_contas_pagar`/`receber`(financeiro!), `hub_pipelines`/`_estagios`, `hub_negocio_vinculos`, `hub_pessoas`, `hub_empresas` → todas as linhas expostas a anon/authenticated. 🔴
- **RLS NÃO habilitada** (ou só policy anon permissiva) em `hub_decision_logs`, `hub_proximas_acoes`, `hub_logs`, `hub_encaminhamentos`, `hub_imoveis`, `hub_projetos`, `hub_msg_jobs`, `hub_memorias_agente`, `hub_servicos`, `hub_notas`, `hub_propostas`, `hub_parceiros_*`. 🔴 vazamento cross-tenant via chave anon.
- Só `hub_cotacoes_*` e `hub_obras` usam `app_tenant_id()` (claim JWT) corretamente para `authenticated` — são o modelo a replicar.
- `tenant_id` sem DEFAULT e sem FK em pessoas/empresas/negócios/contas; FKs ausentes em vários `negocio_id`/`pessoa_id`/`entidade_id` (órfãos possíveis).
- **Schema base fora do versionamento:** `hub_ciclos_ia`, `hub_mensagens`, `hub_prompt_logs`, `hub_leads`(legado), `hub_cargos_catalogo` NÃO têm CREATE nas `migrations/` (vêm de `lib/supabase/*.sql` + TS) → risco de drift entre ambientes.

**DESCOBERTA 2026-06-23 (decisiva p/ qualquer RLS):** o JWT de sessão dos usuários **NÃO carrega claim `tenant_id`** (verificado decodificando o access_token do owner: só claims padrão Supabase — iss/sub/aud/exp/email/app_metadata/user_metadata/role=authenticated; sem `tenant_id` em nenhum nível). Logo `app_tenant_id()` (que lê o claim) retorna **NULL** para reads autenticados do browser → políticas `authenticated AND tenant_id=app_tenant_id()` casam **ZERO linhas** e **quebram as telas**. As policies de `hub_obras`/`hub_cotacoes` que usam `app_tenant_id()` só "funcionam" porque essas tabelas são lidas via **service_role** (server), não pelo browser. **Design correto p/ tabelas lidas pelo browser (leads/pessoas/financeiro): resolver tenant por `auth.uid()`→`public.users` via helper `current_user_tenant_id()` (SECURITY DEFINER, STABLE), NÃO pelo claim.** Auditoria viva parcial confirmou: `public.users` 🟢 travada; `hub_leads_crm`/`hub_pessoas`/`hub_contas_receber` 🔴 abertas a anon (`qual=true`). Passo 1 de segurança (`crm-api-auth`, escalada `x-caller-auth-id`) já FECHADO e validado logado. Varredura de 23 endpoints logados: 23/23 = 200 (data layer saudável após carregar a service role key).

Funções RLS: `app_tenant_id()`(claim JWT `tenant_id`), `default_obra10_tenant_id()`=`00000000-0000-4000-8000-000000000001` (DEFAULT_TENANT_ID). Enums: `app_role`(owner/admin/gestor/comercial/financeiro/atendente/parceiro/vendedor), `record_status`(Ativo/Inativo/Arquivado). Modelo-alvo: ver [[spec-funcional-crm-hub-obra10]].

---

**ATUALIZAÇÃO 2026-06-23 (auditoria VIVA completa + Bloco E lote crítico aplicado) — corrige suposições acima:**
- **Auditoria viva concluída** (MCP voltou). Workaround do socket que cai em payloads multi-linha: **agregar em 1 linha com `string_agg`** (`pg_get_expr(qual)` derruba a cada >1 linha; `select 1`/`count(*)`/agregados de 1 linha passam). Resultado: **~45 policies permissivas (`qual=true`) em ~40 tabelas hub_***. Moldes: `anon_select`(SELECT true, ~30) e `hub_acesso_total`/`*_service`/`*_anon`(ALL true p/ `public`, ~15). **Todas as 93 hub_* têm RLS ON** (nenhuma aberta por RLS-off — corrige o item "RLS NÃO habilitada" acima, que era do repo).
- **CORREÇÃO CRÍTICA do design de helper:** `public.users` **NÃO tem coluna `tenant_id`** (provado: `pg_attribute` count=0). Logo o helper `current_user_tenant_id()` que "lê `users.tenant_id`" (recomendado no parágrafo acima) **não compila/funciona**. E **só existe 1 tenant** (`hub_tenants`=1; 138 leads todos no tenant default, 0 NULL). ⇒ Não há mapa user→tenant; tenant-scoping real está **bloqueado** (precisaria de coluna em `users`, que é INTOCÁVEL por trava). Helper aplicado retorna o **tenant default constante** (`SECURITY INVOKER`) — hoje é **authenticated-only + filtro default**, não isolamento cross-tenant.
- **`hub_pessoas` não tinha `tenant_id`** (era contatos globais) → coluna **adicionada (aditiva) + backfill** no lote crítico.
- **Linhas legadas com `tenant_id` NULL** → predicado RLS precisa tolerar (`or tenant_id is null`), espelhando `tenantScopeOrFilter` em [lib/tenant-default.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/tenant-default.ts).
- **APLICADO e provado (set role no banco): `hub_leads_crm`, `hub_pessoas`, `hub_contas_receber`, `hub_contas_pagar`** — anon 138/5/0/0 → **0/0/0/0**; authenticated intacto (138 leads, 5 pessoas). Cliente browser lê como **authenticated** (bridge [lib/supabase/crm-auth-bridge.ts] hidrata sessão). Commit local `4d925da`. SQL: `docs/sql/bloco-e-rls-APPLIED.sql` + `…-ROLLBACK.sql`.
- **LOTE 2 (2026-06-23, commit `321da2a`) — Bloco E essencialmente FECHADO:** aplicado nas ~38 tabelas restantes em 3 migrations (`groupA_tenant_scoped`: hub_negocios/hub_negocio_vinculos/hub_pipelines/hub_agente_identidade; `groupB_select_only`: 24; `groupB_all_access`: 10). Regra capability-preserving: origem `anon_select`(SELECT)→`authenticated SELECT`; origem ALL→`authenticated select+insert+update`, DELETE→service. **Prova: `anon_or_public_open = 0` em TODAS as hub_*** (nenhuma policy `qual=true` p/ anon/public). `set role`: anon 0; authenticated lê real (atividades 214, mensagens 15, conversas 5, parceiros 2, mercados 8). QA logado (Playwright): dashboard/leads(138)/financeiro/negocios/atendimento(138 conversas) renderizam, **0 erros console**.
- ⚠️ **Nota p/ futuras auditorias:** o advisor `rls_policy_always_true` agora lista ~34 hub_* — são as **authenticated-only `using(true)`** (intencional, tabelas sem `tenant_id`), **NÃO** furo anon. O check de furo real é `qual=true AND role∈{anon,public}` (=0). O guardrail do Code bloqueia apply em massa (>poucas tabelas) → precisa re-autorização do usuário "em lotes".
- **Refinamento futuro (não-bloqueante):** adicionar `tenant_id` + escopar as authenticated-only que são por-lead/negócio (mensagens, conversas, oportunidades, memorias_lead, propostas, parceiros, atividades, notas). Catálogos (mercados, cargos_catalogo, scripts, perfis, servicos, pipeline_estagios) podem ficar authenticated-only de propósito (são compartilhados). Bug pré-existente achado: rota `encaminhamentos/pendentes` seleciona coluna inexistente `encaminhado_para` (500; tabela vazia).

---

**ATUALIZAÇÃO 2026-06-26 — MULTI-TENANT FUNDAÇÃO FLIPADA (supervisionado; dono autorizou "vamos seguir com as travas"):** o item antes marcado BLOQUEADO/INTOCÁVEL (linha 36: "`public.users` sem `tenant_id` → scoping real bloqueado; helper retorna constante") foi **DESBLOQUEADO**:
- **`public.users.tenant_id` ADICIONADA** (aditivo) + backfill (19/19 no default) + DEFAULT. (era a coluna "intocável".)
- **`current_user_tenant_id()` agora dinâmica:** resolve `auth.uid()→users.auth_id→tenant_id`, **SECURITY DEFINER** (lê `users` ignorando RLS → sem recursão com `is_hub_admin`/lockout) + fallback ao default. (era SECURITY INVOKER retornando constante.)
- As ~36 hub_* já estavam authenticated-only + tenant-scoped (`tenant_id=current_user_tenant_id() OR null`, Bloco E) → **só faltava a função apontar pra fonte real. Agora o isolamento cross-tenant está ATIVO** (basta `users.tenant_id` distinto). Behavior-preserving (todos no default) → verificado clicando: login + dashboard (6 leads) + negócios OK.
- Migração registrada no repo: `supabase/migrations/20260626130000_multitenant_foundation.sql`. Advisor novo: só 1 WARN esperado (`authenticated_security_definer_function_executable` — RLS PRECISA executar a função; aceitável). As ~34 `rls_policy_always_true` seguem authenticated-only intencionais (anon=0).
- **`crm-api-auth.ts` já carimba `ctx.tenantId` de `users.tenant_id`** (lib lê a coluna; só precisava existir) → DB e app na MESMA fonte.
- **RESTA p/ multi-tenant USÁVEL:** onboarding de membro = criar `hub_tenants` + `public.users`(auth_id, tenant_id do membro) → membro loga e vê só o dele. Commit `4d8ffa8`.
