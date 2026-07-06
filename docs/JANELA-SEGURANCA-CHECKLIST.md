# 🔑 JANELA DE PRODUÇÃO — CHECKLIST (fazer JUNTO com o dono)
> Preparado pelo CEO em 06/jul enquanto o dono almoça. **Nada aqui foi aplicado ainda.** Baseado no advisor REAL do Supabase (158 avisos, **ZERO ERRO** — só WARN/INFO) + verificação de uso no código. Ordem: do mais seguro/valioso ao mais nuance.

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
