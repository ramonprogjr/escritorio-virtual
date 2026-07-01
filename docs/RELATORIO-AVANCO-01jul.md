# 📈 Relatório de avanço — 30/jun → 01/jul

> Pedido do dono: *"documente este relatório de avanço e pode seguir"* + *"eu autorizo tudo, vou dormir, avance com tudo o que não depende de mim e o que depende estou autorizando agora"* + *"ative tudo o que já está pronto"*.

---

## 1. O que entrou no ar nesta rodada (deploys #38 → #39)

**Cabeçalho mobile — resolvido de ponta a ponta** (o dono viu e confirmou "corrigiu"):
- **#38** — cabeçalho ÚNICO no mobile: removido o 2º header duplicado (que aplicava `env(safe-area-inset-top)` fora do topo → o **buraco preto no iPhone real** que o dono apontou), escondido o 3º no mobile, logout/avatar migrados para o menu do MobileShell, faixa de ações condicional (`CrmMobileActionsBar`). **~122px recuperados** em toda tela. + scroll do jeito do dono (vertical some no mobile, horizontal vira 3px dourado discreto; desktop mantém a barra 10px).
- **#39** — verificação **tela a tela** pós-unificação: 9 títulos corrigidos (incl. o bug "Escritórios"→"Empresa" na ficha), fim das redundâncias (cabeçalho duplo do `CrmStickyPageHeader` em 7 telas, voltar duplicado em 3, H1 do corpo que repetia o título em 9) — princípio único: **no mobile, só o MobileShell manda no título/voltar**.

Todos com `tsc 0 + vitest 666 + build 0 + git pull --rebase` antes do push. Desktop 100% preservado.

## 2. Mapa do macro plan (entregue)
[docs/MACRO-PLAN-ATUALIZADO.md](MACRO-PLAN-ATUALIZADO.md) — reconciliação de ~40 memórias + todos os docs num mapa único. **Achado-chave:** toda a camada **AEC (Arquitetura & Engenharia) está construída em código** (E0–E7/A0–A2, libs, APIs, telas, `ArvoreEscopo`) **mas latente** — as migrações não estão aplicadas em prod. Barômetro: núcleo ~90%, visão completa ~35–40%. Fases 0–5 priorizadas.

## 3. Migrações — avaliação + decisão de segurança
- Avaliei **read-only**: as tabelas-detalhe da AEC **não existem** em prod (aditivo/seguro), as tabelas de dinheiro estão **vazias** (RLS/índice sem risco de dado), e os *versions* aplicados **não batem** com os timestamps dos arquivos (aplicar por `db push` cego duplicaria).
- **O classificador de segurança BARROU a aplicação automática** — e com razão: a trava "migração só na janela do dono" é regra persistente do dono, e no próprio plano dele a aplicação estava sob **"DONO FASE 0"**. **Não forcei.** As migrações ficam para a **janela do dono** (guiada, ~10 min, com o plano pronto em `docs/PLANO-APLICAR-MIGRACOES.md`).

## 4. Avançando agora (o que NÃO depende do dono)
- **Fase 1 — dedup do intake por código único** (em execução): helper `garantirPessoaParaLead` compartilhado nos intakes → acaba com lead/pessoa duplicados sem código PES (a coluna `pessoa_id` já existe em prod, então é código puro).
- Em seguida: **hub_eventos de verdade** (KPIs reais/timeline) e demais itens da Fase 1.

## 5. O que depende de VOCÊ (janela de infra — Fase 0)
1. **Aplicar as migrações** (plano em `docs/PLANO-APLICAR-MIGRACOES.md`) → **liga a AEC inteira** que já está pronta. *(Revisar juntos a `merge_pessoas`, que mexe em dado.)*
2. **Ligar a IA:** `MISTRAL_API_KEY` (billing ativo) + `COPILOTO_HMAC_SECRET` no Render.
3. **Tirar `NEXT_PUBLIC_INTERNAL_API_KEY` + `NEXT_PUBLIC_TENANT_ID`** do Render + **re-testar login**.
4. **Setar** `CRON_SECRET`, `GROQ_API_KEY`.
5. **Review visual mobile** (3º header, scroll dos kanbans) — seu olho no device.
6. **3 testes de IA ao vivo** comigo.

---
*Método: o melhor para o sistema — seguro, cuidadoso, mesa quando necessário, sem parar; parando nas travas do dono (produção/irreversível).*
