# 🔑 JANELA DE PRODUÇÃO — CHECKLIST (fazer JUNTO com o dono)
> Preparado pelo CEO em 06/jul. Baseado no advisor REAL do Supabase (158 avisos, **ZERO ERRO** — só WARN/INFO) + verificação de uso no código.

## ✅ STATUS DA EXECUÇÃO (06/jul, via MCP com o dono)
- **A** (16 tabelas mortas) — ✅ **APLICADO** (verificado 0 policies · 0 grants · RLS on).
- **B** (4 briefing write-policies) — ✅ **APLICADO** (0 escrita aberta).
- **C** (7 funções server-only/trigger) — ✅ **APLICADO** (anon revogado; 5 helpers RLS NÃO tocadas).
- **G** (índice redundante AUT-7) — ✅ **APLICADO** (DROP INDEX).
- Versionado em `supabase/migrations/20260706160000_janela_seguranca_faixaB_APLICADA.sql`.
- **D** (buckets) — ⏸️ deferido (módulo membros — verificar consumidor antes).
- **E** (toggle HaveIBeenPwned) — 🖱️ **dono** no painel Auth.
- **F** (secrets Render) — ⏸️ **dev** (dono sem acesso ao Render).

## Contexto que muda o tom
A segurança do sistema está **em boa forma**. Os 92 avisos "rls_enabled_no_policy" são o **design fail-closed proposital** (RLS ligado, sem policy = só o sistema/service_role acessa) — **não são bug, não mexer.** O que sobra é uma lista curta.

---

## ✅ PASSO A — Fechar 16 tabelas ANTIGAS mortas *(SEGURO, alto valor)*
**O quê:** o schema velho (`leads`, `crm_persons`, `crm_deals`, `crm_partners`, `crm_commissions`, `human_profiles`, `lead_contacts`, `crm_opportunities`, `crm_partner_matches`, `crm_operational_events`, `activity_logs`, `agents`, `departments`, `modules`, `settings`, `tasks`) tem policy `USING(true)` (porta aberta ao `authenticated`). **Verifiquei: ZERO uso no código** — foram substituídas pelas tabelas `hub_*`.
**Risco:** baixíssimo (tabelas mortas). **Reversível:** sim.
**Como:** migração `PREPARADA` (ver `supabase/migrations/*_janela_rls_faixaB_PREPARADA.sql`) — REVOKE de acesso + DROP das policies permissivas → viram fail-closed como o resto. Aplico via MCP **com você**; confirmo com o advisor que fechou.
**Opção do dono:** se quiser **limpeza total**, dá pra `DROP TABLE` essas 16 mortas (remove os dados velhos de vez) — mas isso é decisão sua (apaga dado). O padrão seguro é só fechar.

## ⚠️ PASSO B — 4 tabelas de briefing da IA com escrita aberta *(verificar antes)*
**O quê:** `hub_agente_conhecimento`, `hub_autonomia_matriz`, `hub_crm_agente_briefing_mensagem`, `hub_crm_agente_briefing_sessao` têm policy de INSERT/UPDATE `USING(true)`. Essas SÃO usadas pelo sistema (via service_role), então remover o acesso `authenticated` deve ser seguro — **mas eu confirmo que nenhuma tela escreve direto** antes de fechar.

## ⚠️ PASSO C — 12 funções executáveis sem login *(CUIDADO — nuance)*
**O quê:** funções SECURITY DEFINER com EXECUTE aberto a `anon`.
- **Seguras de revogar `anon`:** as 3 chamadas só pelo servidor (`crm_proximo_codigo`, `hub_msg_jobs_claim_batch`, `crm_negocios_pipeline_totais`) + as de fila.
- **CUIDADO:** as helpers de RLS (`current_app_role`, `current_user_tenant_id`, `is_hub_admin`, `hub_is_service_role`, `current_app_user_id`) podem ser usadas nas policies do módulo **membros** — revogar de `authenticated` pode **quebrar o acesso legítimo** lá. → revogar só de `anon` (não de `authenticated`) OU deixar como está. Decidimos juntos, função por função.

## ⚠️ PASSO D — 3 buckets públicos deixam LISTAR arquivos *(verificar)*
**O quê:** `capas`, `maodeobra`, `playbook-media` permitem listar todos os arquivos (não só abrir por link). O de **mão-de-obra** pode ter documento pessoal.
**Verifiquei:** só `playbook-media` tem `.list()` no código, e é server-side. Restringir a listagem (mantendo abrir-por-link) parece seguro, mas é nuance de storage → testo depois de fechar.

## 🖱️ PASSO E — Botão do painel (você/dev, 1 clique) *(risco zero)*
- **Ligar proteção contra senha vazada** (HaveIBeenPwned): painel Supabase → Authentication → Policies/Password → ativar "leaked password protection".

## 🔌 PASSO F — Secrets no Render *(liga a IA — o coração do MVP)*
No painel do Render → o web service → Environment:
- `MISTRAL_API_KEY` — **liga a IA** (gerar fluxo, atendimento, copiloto).
- `GROQ_API_KEY` — reserva/fallback (opcional mas recomendado).
- `COPILOTO_HMAC_SECRET` — libera a escrita por voz do copiloto.
- `CRON_SECRET` — cron seguro + botão "Executar agora".
- Conferir: `WEBHOOK_SECRET`, `UAZAPI_BASE_URL`, `UAZAPI_ADMIN_TOKEN`, `SUPABASE_*`.
- **Remover** do bundle (se ainda estiverem): `NEXT_PUBLIC_INTERNAL_API_KEY`, `NEXT_PUBLIC_TENANT_ID`.
*(Render não reinicia sozinho ao mudar env — depois de setar, um redeploy/restart. Cheque em `/api/health` se a IA respondeu.)*

## 🧹 PASSO G — Hygiene menor *(opcional, baixo risco)*
- Aplicar o DROP do índice redundante **AUT-7** (migração `20260819120000` já pronta no repo).
- Mover extensões `pg_net` e `vector` do schema `public` (higiene).
- Fixar `search_path` de `membros._norm_tel`.

---

## Ordem sugerida na janela (rápida)
1. **A** (16 tabelas mortas) — o ganho seguro, aplico com você.
2. **E** (botão da senha) — 1 clique seu.
3. **F** (secrets do Render) — liga a IA (se o dev já te deu acesso).
4. **B/C/D** (briefing/funções/buckets) — verificamos e fechamos os seguros.
5. **G** (higiene) — se sobrar tempo.

**Depois de cada mudança de banco:** eu rodo o advisor de novo pra confirmar que fechou e que nada novo apareceu. Ponto de retorno seguro em `1526250` + backups nos 2 GitHubs.

---

## 📎 APÊNDICE — SQL PRONTO (revisado, com os nomes exatos do advisor)
> Extraído do advisor real (nada inventado). Usar na janela, passo a passo, rodando o advisor depois de cada bloco.

### Passo A — já está na migração `20260820120000_janela_rls_faixaB_tabelas_mortas_PREPARADA.sql`. Aplicar essa (fecha as 16 mortas).

### Passo B — 4 tabelas de briefing/config *(só DEPOIS de confirmar que nenhuma tela escreve direto — o app escreve via service_role, então devem ser dispensáveis):*
```sql
DROP POLICY IF EXISTS hub_agente_conhecimento_auth_insert ON public.hub_agente_conhecimento;
DROP POLICY IF EXISTS hub_agente_conhecimento_auth_update ON public.hub_agente_conhecimento;
DROP POLICY IF EXISTS hub_autonomia_matriz_auth_insert    ON public.hub_autonomia_matriz;
DROP POLICY IF EXISTS hub_autonomia_matriz_auth_update    ON public.hub_autonomia_matriz;
DROP POLICY IF EXISTS hub_crm_briefing_msg_auth_insert    ON public.hub_crm_agente_briefing_mensagem;
DROP POLICY IF EXISTS hub_crm_briefing_msg_auth_update    ON public.hub_crm_agente_briefing_mensagem;
DROP POLICY IF EXISTS hub_crm_briefing_sessao_auth_insert ON public.hub_crm_agente_briefing_sessao;
DROP POLICY IF EXISTS hub_crm_briefing_sessao_auth_update ON public.hub_crm_agente_briefing_sessao;
```

### Passo C — funções anon-executáveis: revogar SÓ as SEGURAS; **NÃO tocar nas helpers de RLS**
✅ **SEGURO** (RPCs só-servidor + triggers — o app as chama via service_role, que não depende do grant):
```sql
REVOKE EXECUTE ON FUNCTION public.crm_negocios_pipeline_totais(uuid, text, text, text, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.crm_proximo_codigo(text, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hub_msg_jobs_claim_batch(text, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hub_msg_jobs_try_lock_conversation(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hub_msg_jobs_unlock_conversation(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.hub_audit_trigger() FROM anon, public;
```
⛔ **NÃO REVOGAR** sem antes analisar as policies do módulo **membros** — são helpers usadas DENTRO das policies de RLS; revogar pode **quebrar o acesso legítimo** do authenticated/anon:
`current_app_role()`, `current_app_user_id()`, `current_user_tenant_id()`, `is_hub_admin()`, `hub_is_service_role()`.

### Passo D — buckets (restringir a LISTAGEM, mantendo abrir-por-URL — testar após):
Policies a revisar em `storage.objects`: `capas_pub_sel` (bucket `capas`), `maodeobra_pub_sel` (`maodeobra` — **prioridade**, documentos pessoais), `playbook_media_select_public` (`playbook-media`). O `.list()` no código é só server-side (`playbook-media`), então restringir a listagem pública não quebra o app — mas é nuance de storage, valido ao vivo.

**Verdicto:** só o Passo A é 100% seguro auto-aplicável (migração pronta). B/C/D têm SQL pronto mas pedem 1 verificação minha antes de cada `DROP/REVOKE`. Fazemos juntos, rápido.
