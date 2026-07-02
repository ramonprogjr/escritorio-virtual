# 🔑 ROTEIRO — Rotacionar a service_role comprometida (SEM downtime) — fazer AMANHÃ

> Contexto: a `service_role` legacy (JWT `eyJ…`) pode estar comprometida (esteve no repo do dev demitido).
> No sistema legacy NÃO dá pra rotacionar só ela — o jeito certo e sem derrubar ninguém é **migrar
> pras chaves novas** (`sb_secret_` / `sb_publishable_`), que convivem com as antigas. Só depois de
> confirmar que a nova funciona é que se desativa a legacy. (O Supabase apaga a legacy no fim de 2026
> de qualquer forma — então isso teria que ser feito mesmo.)
>
> **Regra de ouro:** a `sb_secret_` é SEGREDO — copie direto Supabase→Render, **nunca** cole em chat/email.

## Parte A — Criar as chaves novas (Supabase, ~2 cliques)
1. Abrir: https://supabase.com/dashboard/project/cdjlqsznerdhwqyunodl/settings/api-keys
2. Se ainda não existir uma **Secret key**: botão **"Create new secret key"** → nome **`server-render`** → **copiar** o valor `sb_secret_…` (guardar no gerenciador de senhas; NÃO colar em chat).
3. Na mesma tela, anotar a **Publishable key** (`sb_publishable_…`) — essa não é segredo.

## Parte B — Trocar no Render (Environment) + redeploy
No serviço web do Render → **Environment**:
1. `SUPABASE_SERVICE_ROLE_KEY` = a nova **`sb_secret_…`**
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` = a nova **`sb_publishable_…`**
3. **Remover** `NEXT_PUBLIC_INTERNAL_API_KEY` (item da auditoria — expõe a chave do gate ao browser; o código já não depende dela)
4. **Save changes** → aguardar o **redeploy**.
5. Atualizar o **`.env.local`** local com os mesmos 2 valores (pra dev bater com prod).

## Parte C — VERIFICAR antes de desativar a legacy (Claude + você)
- **Claude (via Supabase MCP / curl):** confirma que o app conecta com a chave nova (leitura + auth respondendo).
- **Você:** login no CRM + criar 1 lead (como você fez hoje). Se entrar e salvar → chave nova OK.

## Parte D — Desativar a legacy (SÓ depois de C = OK)
1. Supabase → Settings → API Keys (ou API) → **desativar/revogar** as chaves **legacy** (`anon` + `service_role` JWT).
2. A partir daí, a cópia do dev demitido **para de funcionar**. Zero downtime, porque o app já está nas novas.

## Se algo der errado
- App começa a dar 401/erro de Supabase depois do redeploy → **reverter no Render** (voltar os 2 valores pras chaves legacy) e me chamar. A legacy continua válida até a Parte D.

## Parte E — Quick-wins de segurança (aplicar JUNTO, opcional, baixo risco)
Advisors do Supabase = 0 ERROS; só WARN/INFO.
1. ✅ **search_path das funções — JÁ APLICADO** (01/jul via MCP): 35 WARN → 2 (as 2 são da
   extensão pgvector, lang C — deixadas de propósito). Migração
   `supabase/migrations/20260701235500_harden_function_search_path.sql`. **Nada a fazer.**
2. **Leaked Password Protection (1 WARN) — FALTA (toggle seu):** no painel →
   **Authentication → Policies/Providers → "Prevent use of leaked passwords"** = ON.
   (É config de Auth, não SQL — só no painel; 1 clique.)

> #3 "grande" (RLS `USING(true)`) fica pra um passe dedicado e testado ANTES do 2º
> tenant — é **load-bearing** (realtime + writes diretos do office no Supabase), então
> o fix é *escopar por tenant*, não remover. Baixa urgência (1 tenant hoje).

---
*Pré-verificado 01/jul: o Supabase MCP conecta a este projeto (project-ref cdjlqsznerdhwqyunodl); Claude confirma a chave nova ao vivo antes da Parte D. Advisors: 0 ERROR, 87 WARN, 59 INFO.*
