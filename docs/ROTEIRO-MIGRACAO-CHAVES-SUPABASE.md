# 🔑 ROTEIRO — Migração das chaves Supabase (zero downtime) + remover chave interna pública

> **Objetivo:** trocar a "fechadura" do banco para a **cópia da `service_role` que o dev demitido pode ter parar de funcionar** — SEM deslogar ninguém e SEM risco, usando o **sistema novo de chaves** (`sb_secret_` / `sb_publishable_`). E, de quebra, tirar a chave interna que está exposta ao navegador.
>
> **Projeto (ref, público):** `cdjlqsznerdhwqyunodl`
> **Regra de ouro:** NUNCA colar o **valor** de uma chave no chat. Copiar sempre **direto do Supabase → Render**. Um passo por vez; me avisa o resultado de cada um.

---

## Por que assim (1 parágrafo)
A chave antiga (`service_role`, formato `eyJ...`) não dá pra trocar sozinha — trocá-la exige resetar o segredo do projeto, o que **desloga todo mundo**. O sistema novo permite criar uma chave-mestra nova (`sb_secret_`) que **convive** com a antiga. A gente troca no servidor, testa, e **só então desativa a antiga** — aí a cópia do demitido morre, sem ninguém sentir. (E o Supabase vai aposentar as antigas até o fim de 2026 de qualquer jeito.)

---

## PARTE A — Criar as chaves novas (você, no Supabase)
1. Supabase → **Settings** (engrenagem) → **API Keys** (em alguns projetos é só **API**).
2. Procure a seção **"API keys"** (nova). Pode já existir uma **Publishable key** (`sb_publishable_...`). Se houver botão **"Enable new API keys"** / **"Create new API key"**, use.
3. **Crie uma Secret key nova** → nome sugerido: `server-render` → ela nasce como `sb_secret_...`.
4. Deixe visível pra copiar depois. **NÃO desative as legacy ainda** (as duas convivem).
5. ✋ **Me avisa:** "criei publishable + secret novas" (sem colar os valores).

---

## PARTE B — Trocar no Render (produção)
1. Render → serviço web **escritorio-virtual-1** → aba **Environment**.
2. Edite (copiando **direto do Supabase**, nunca pelo chat):
   - `SUPABASE_SERVICE_ROLE_KEY` → nova **`sb_secret_...`**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → nova **`sb_publishable_...`**
3. **APAGUE** a variável **`NEXT_PUBLIC_INTERNAL_API_KEY`** (ela expõe a chave interna no navegador — é parte do buraco do header que consertamos).
   - `INTERNAL_API_KEY` (sem `NEXT_PUBLIC_`) pode ficar; o gate é fail-closed de qualquer forma.
4. **Save** → o Render faz redeploy sozinho (~2-3 min).
5. ✋ **Me avisa:** "troquei no Render e salvei".

---

## PARTE C — TESTAR (com as duas chaves ainda ativas = seguro)
1. Espere o redeploy.
2. **Faça login de novo** (a sessão pode cair porque a `anon`/publishable mudou — é esperado).
3. **Abra o CRM, navegue e crie 1 lead.**
4. ✋ **Me avisa:** funcionou tudo? 
   - ✅ Sim → seguimos pra Parte D.
   - ❌ Algo quebrou → **é só voltar as 2 variáveis no Render pros valores antigos** (as legacy ainda estão ativas) → **zero dano**, e a gente investiga.

---

## PARTE D — Desativar as chaves LEGACY (só DEPOIS do teste ✅)
1. Supabase → Settings → API Keys → seção **"Legacy API keys"** → **Disable** a `anon` e a `service_role` legacy.
2. É isto que **mata a cópia do dev demitido**.
3. Teste de novo (login + navegar) pra confirmar que nada dependia das legacy.
4. ✋ **Me avisa:** "legacy desativadas, tudo ok".

---

## PARTE E — `.env.local` do seu PC (depois, comigo — não afeta produção)
- Pra dev local continuar funcionando, atualizo o `.env.local` com as chaves novas.
- Eu te dou o comando exato; você cola os valores. Faremos quando você quiser (opcional).

---

## Rollback (enquanto legacy ativas, até a Parte D)
Reverter = voltar `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no Render pros valores antigos. Sem downtime, sem perda.

## O que eu (Code) faço na minha ponta
- Confirmo ao vivo (REST API) que as chaves novas funcionam e as antigas param (quando você desativar).
- Removo referências mortas a `NEXT_PUBLIC_INTERNAL_API_KEY` do `render.yaml` / `.env.example` no código.
- Ajusto o `.env.local` com você (Parte E).
