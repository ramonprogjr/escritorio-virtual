# 🛠️ Ações pendentes para o DEV — Obra10+ (28/jun)

> **O código está pronto e deployado** na branch `feature/escritorio-visual` (o Render auto-deploya essa branch). O que falta abaixo são **ações de PRODUÇÃO/CONFIG** que exigem credencial ou decisão humana — não precisam de mudança de código (salvo onde indicado). Faça na ordem.

---

## 1. 🔴 LIGAR A IA (prioridade #1) — chave da Mistral

**Sintoma:** ao testar a IA (gerar fluxo / atendimento), retorna erro "API inválida" da Mistral.
**Causa:** a chamada chega na API da Mistral, mas é rejeitada. O código está correto (modelo `mistral-small-latest`; a chave é lida de `process.env.MISTRAL_API_KEY`, com `.trim()`, e enviada para `https://api.mistral.ai/v1/chat/completions`). O problema é **a chave ou a conta Mistral**.

**Passos:**
1. Acessar **console.mistral.ai → Billing / Workspace** → confirmar que há **plano/pagamento ativo**. ⚠️ A API da Mistral exige um workspace com cobrança configurada; chave de conta sem billing retorna **401** ou **429 (quota)**.
2. **API Keys** → gerar/copiar uma chave válida (sem espaços, completa).
3. No **Render → serviço `escritorio-virtual` → Environment** → setar **`MISTRAL_API_KEY`** = `<a chave>` → **Save** (redeploy automático).
4. **Validar:** abrir um agente → "✨ Gerar fluxo com IA"; mandar um WhatsApp para o número do agente. Se ainda falhar, ver os **logs do Render**: o erro aparece como `Mistral HTTP <status>` → **401** = chave inválida · **429** = sem créditos/quota · **422** = modelo/requisição.

> (Opcional, melhoria de código já solicitável: surfaçar o motivo exato da Mistral na tela em vez de "api inválida" genérico.)

**Também conferir no Render (se faltarem):**
- `COPILOTO_HMAC_SECRET` — gerar com `openssl rand -hex 32` e setar. **Sem ela o copiloto de voz retorna 503.**
- `WEBHOOK_SECRET`, `UAZAPI_BASE_URL`, `UAZAPI_ADMIN_TOKEN`, `SUPABASE_*`, `CRON_SECRET` — confirmar que estão setadas.

---

## 2. 🗄️ APLICAR 2 MIGRAÇÕES — Supabase (caminho do dinheiro)

Arquivos já no repo (`supabase/migrations/`):
- `20260702120000_crm_negocios_pipeline_totais_rpc.sql` — RPC de agregação do "Pipeline Total" (hoje o app trunca em 5000 linhas; a RPC soma no banco). **Segura, idempotente** (`CREATE OR REPLACE`).
- `20260703120000_hub_contas_receber_negocio_id_unique.sql` — índice **único parcial** que impede recebível duplicado por negócio.

**Passos (Supabase SQL Editor ou `supabase db push`):**
1. **ANTES do índice único**, rodar a verificação de duplicatas:
   ```sql
   SELECT negocio_id, COUNT(*) FROM public.hub_contas_receber
   WHERE negocio_id IS NOT NULL GROUP BY negocio_id HAVING COUNT(*) > 1;
   ```
   Se retornar linhas → consolidar/apagar os duplicados antes (senão a criação do índice falha).
2. Aplicar os 2 arquivos.

> O código **já é tolerante** (funciona sem as migrações, com fallback + SELECT-first anti-duplicação no backend). Elas são hardening/otimização.

**Migrações JÁ aplicadas nesta sessão (não reaplicar):** `hub_negocios.proxima_acao_em`, `hub_contas_receber.negocio_id`, `hub_agente_identidade.setor_ia`, colunas-espelho de `hub_fornecedores` + backfill dos 7, bucket de storage `playbook-media`.

---

## 3. 🔀 FLIP DO MOTOR — só com OK explícito do dono (Render env)

Faz o motor de distribuição ler `hub_fornecedores` (entidade consolidada) em vez de `hub_parceiros` (legado). **Validado lado-a-lado: 5 candidatos com score idêntico.** Reversível.

**Passo (após o dono confirmar):** Render → `escritorio-virtual` → Environment → **`MOTOR_FONTE`** = `fornecedores` → Save. (Reverter = voltar para `parceiros` ou remover a env; há fallback automático para `parceiros` se `fornecedores` vier vazio/erro.)

**⚠️ Ressalva (decisão de produto):** a carga `total_leads_recebidos` do espelho só sincroniza quando o gestor **edita o parceiro**, não a cada lead distribuído → leve drift possível no termo de carga do score. **Tarefa de código opcional antes do flip:** sincronizar a carga no evento de distribuição (não só na edição).

---

## 4. 🔐 NO FIM — rotacionar o token do Supabase

Um Personal Access Token do Supabase (`sbp_...`) foi usado nesta sessão (colado em texto). Por higiene: **revogar/rotacionar** no painel do Supabase → Account → Access Tokens, quando concluir os passos acima.

---

## 5. 🧠 DECISÕES DO DONO que viram tarefa de código (depois de decididas)

Não bloqueiam; viram PR pequeno quando o dono decidir:
- **Markup:** definir se é por **escritório** ou por **mercado**; rótulo claro no painel ("margem = N× o custo real de IA"; hoje `10` = 10×/1000%, não 10%). Cuidado para não configurar 100× a menos.
- **Bug #2 (segurança):** `POST /api/parceiros` e `POST /api/crm/fornecedores` não exigem sessão — **confirmar que não há captação pública** (landing/portal cria sem login) antes de adicionar `requireCrmSessao`. Se houver, usar API-key interna.
- **Saldo de Tijolos negativo:** definir quando ligar o bloqueio (hoje atendimento/builder não checam saldo; em modo sombra).
- **Comissão imutável no fechamento:** snapshot da comissão ao ganhar o negócio (regra de negócio).
- **Auto-gerar fluxo:** nos modos "Cargo" e "Só playbook", o agente nasce sem fluxo de atendimento — decidir se auto-gera com IA ou só avisa.

---

## ✅ Resumo de prioridade
1. **Mistral (billing + chave no Render)** → acende toda a IA (item #1 do MVP).
2. **2 migrações no Supabase** (com a checagem de duplicatas).
3. **Confirmar o flip do motor** com o dono → setar `MOTOR_FONTE`.
4. Rotacionar o token Supabase.
5. As decisões do item 5 viram PRs quando o dono decidir.
