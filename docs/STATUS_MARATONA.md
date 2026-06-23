# STATUS — Maratona Obra10+ / Escritório Virtual Ramon

> Diário vivo da maratona. Atualizado a cada micro-etapa. Última atualização: **2026-06-23**.

## Objetivo
Sair de *"renderiza e quase funciona"* → **"confiável + espinha dorsal viva + IA Anthropic"**. Fechar o caminho de valor **Lead → Negócio → Obra/Projeto → Financeiro** com segurança real.

## Escopo & travas
- Só este projeto (`escritorio-virtual-ramon`), tabelas **`hub_*`** (+ legado `crm_*`/genérico apenas para *deprecar com trava*). **Membros (`membros_*`/`profissionais_*`) INTOCADO** — confirmado no **mesmo** Supabase.
- Migrações **só aditivas** (sem drop/sem apagar dado). Sem `git push`. Segredo só como secret (nunca no Git/front). **Contato de lead nunca exposto.** Mão de obra sem login. `_chk23` OK + cold load sem branco antes de fechar etapa.
- **Modo loop autônomo** até o critério de aceite ser provado **logado ao vivo**. GO humano só p/ migration em prod e deploy.

## Baseline verificada (2026-06-23)
- Dev server `:3001` no ar. `/api/health` → 200, `/login` → 200, `/crm` → 307 (redirect deslogado).
- `node app/_chk23.js` → **OK**.
- DB vivo (`cdjlqsznerdhwqyunodl`): **3 schemas coexistem** — `hub_*` (app vivo, com dados: `hub_leads_crm` 138, `hub_atividades` 214, `hub_fila_mensagens` 105, `hub_msg_jobs` 246); `crm_*`/genérico (legado quase vazio, 1–3 linhas); `membros_*`/`profissionais_*` (projeto separado, mesmo banco). **Migrations do repo (68) ≠ migrations aplicadas (lineage diferente)** → drift a reconciliar antes de qualquer DDL.

## Blocos
- [~] **A — Fundação de trabalho** (artefatos) — EM ANDAMENTO
- [ ] B — Verdade (QA logado)
- [ ] C — Drift & fronteira
- [ ] D — Segurança · diagnóstico (advisors)
- [ ] E — Segurança · RLS `hub_*`
- [ ] F — Segurança · funções/prova
- [ ] G — Espinha dorsal (migrations PDF aditivas)
- [ ] H — Anthropic · base
- [ ] I — Anthropic · ferramentas
- [ ] J — Caminho de valor
- [ ] K — Higiene de produto
- [ ] L — Fechamento

## Log de execução

### 2026-06-23 — Bloco A (fundação)
- Criados: `docs/STATUS_MARATONA.md`, `docs/PROPOSTA_CONJUNTA.md`, `app/_chk23.js`, `_publicar.ps1`.
- `_chk23` baseline: **OK** (health 200, login 200, crm 307).
- Próximo: Bloco B — QA logado real (read-only) na conta `nice.engemp`.
