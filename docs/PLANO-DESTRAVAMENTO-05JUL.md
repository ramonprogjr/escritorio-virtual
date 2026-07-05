# 🔓 PLANO DE DESTRAVAMENTO — Obra10+ / Escritório Virtual
> **05/jul/2026** · Fonte: mesa-redonda de 4 frentes (organização · acoplamento · saúde de código · rede de regressão) lendo o código real. Read-only — nada foi alterado ainda. Este doc é o plano; a execução espera aprovação do dono, frente a frente.
> Aponta daqui: `CONTROLE-MESTRE.md` (§4.5 parqueou as ondas A/C/3/D enquanto isto roda).

---

## 0. O PROBLEMA (nas palavras do dono)
> "O sistema está travado — se atumanmos um botão quebramos outra tela. A partir de agora o trabalho será cirúrgico: mexer num item = mexer só nele."

A mesa confirmou que o sintoma é real e mapeou **4 causas concretas**. Nenhuma é "o código é ruim" — o código tem disciplina de tipos rara (strict, ~zero `any`, zero `@ts-ignore`). O problema é **estrutural e de higiene**, e tem ordem certa de conserto.

---

## 1. DIAGNÓSTICO — as 4 causas do "mexeu aqui, quebrou ali"

### C1 · Ruído: 11,4% do repo é código MORTO (Frente 3)
- **~16.800 linhas / ~67 arquivos** comprovadamente mortos (zero importador, verificado por grep).
  - **Cluster A — "Escritório Virtual"** (produto anterior, desativado 02/jul, `app/office/page.tsx` só faz `redirect("/crm")`): **~13.556 linhas** — `components/office/**` (41 arq.), hooks/lib/mocks associados, e `lib/agent-prompts.ts` (1.644 linhas — um dos "12 gigantes" é, na verdade, morto).
  - **Cluster B — formulários órfãos** pós-refatoração do cadastro: **~2.807 linhas** (`PessoaFormModal` 1.104L, `EmpresaFormDrawer` 447L, `PlaybookFlowVisualBuilder` 739L, etc.).
  - **`lib/hub/delete-agente-completo.ts`** (+ storage) — 141 linhas, substituído por soft-archive já em produção.
- **Por que trava:** todo grep/busca/auditoria/IA tropeça nesse morto; a gente perde tempo entendendo código que não roda e tem medo de mexer em coisa que nem existe mais.

### C2 · Acoplamento REAL (não é onde parecia) — Frente 2
- A hipótese dos "god-files" (arquivos de 2–4 mil linhas) estava **errada**: eles têm fan-in 0–1 (dão medo de mexer, mas não espalham quebra). O acoplamento verdadeiro está em **4 módulos pequenos e invisíveis**:

| Hotspot | Fan-in | Por que é o vilão |
|---|---|---|
| `lib/tenant-default.ts` | **112 telas** | `tenantScopeOrFilter` é ambíguo (privado vs global no mesmo helper) — já **vazou dado cross-tenant real** (5 leaks de 05/jul). Nada no tipo impede o uso errado. |
| `lib/crm/supabase-server.ts` (`crmDb`) | **90** + **82 cópias** | 82 rotas reimplementam o mesmo cliente à mão → correção de segurança num lugar **não se propaga**. |
| `app/crm/layout.tsx` (657 linhas) | **as 52 telas do CRM** | Único layout que envolve tudo: 4 Contexts + guard + nav + busca de papel duplicada, no mesmo arquivo. **Erro aqui derruba as 52 telas juntas** — o "ground zero". |
| RBAC em 3 superfícies | nav · página · API | Já divergiram em produção (o 403 em massa da Ariane). |

### C3 · Nada na rede de testes OLHA pra uma tela (Frente 4)
- `tsc` passa limpo (strict), **766 testes** passam, `next build` passa. **Mas:** 0 testes de tela, 0 E2E, 0 render — a infra de teste (`environment: node`, sem testing-library) nem consegue renderizar um componente. E **`next build` NÃO roda no CI**.
- **Por que trava:** uma quebra de *comportamento* de UI (some um botão, quebra o render) passa por tsc + testes + gate e **chega no deploy sem nada acender**. É a origem literal do "ninguém percebe até depois".
- Ponto forte a preservar: `lib/crm/guard-coverage.test.ts` — gate estático que varre >100 rotas e barra handler sem guard. É o modelo do que falta pra UI.

### C4 · Organização: a informação está certa, mas espalhada (Frente 1)
- **252 docs** onde vivo e morto convivem; **3 documentos** cada um se dizendo "a fonte única"; **56 arquivos** de snapshot de memória que um commit já declarou removidos; **~12 roadmaps/planos** competindo; 2 roteiros duplicados de rotação de chave.
- `CONTROLE-MESTRE.md` é confiável (amostrei 4 afirmações "no ar" — todas batem com o código), mas o *entorno* confunde a navegação.

---

## 2. A ORDEM IMPORTA (a decisão de CEO)
O instinto natural é atacar os arquivos gigantes primeiro. **Errado.** A sequência que torna o trabalho de fato cirúrgico é:

**LIMPAR → PROTEGER → DESTRAVAR → TRAVAR**

1. **Limpar o morto primeiro** (risco zero) — some 11% do ruído; a base fica legível antes de qualquer refatoração.
2. **Construir a rede ANTES de refatorar** — os hotspots de acoplamento (layout, clientes) e os god-files vivos **não têm teste nenhum**. Refatorar sem rede = repetir o erro que estamos consertando. A rede é o que transforma "mexer com medo" em "mexer cirúrgico".
3. **Destravar o acoplamento** — com a rede no ar, isolar os 4 vilões, cada passo reversível.
4. **Travar contra reincidência** — ESLint + padrões, pra casa não voltar a acoplar.

---

## 3. O PLANO (fases sequenciadas — cada passo é independente, reversível e testável)

### 🟢 FASE 0 — LIMPEZA (risco ~zero · ganho de clareza enorme · começar por aqui)
Cada remoção validada com `tsc`/`next build` antes de commitar (import quebrado aparece na hora). Em commits separados p/ rollback fácil.
- **0.1** Apagar Cluster A ("escritório virtual") — ~13.556 linhas, ~55 arquivos. *(1 commit)*
- **0.2** Apagar Cluster B (formulários órfãos) — ~2.807 linhas. *(1 commit)*
- **0.3** Apagar `delete-agente-completo.ts` + storage (141 linhas). *(1 commit)*
- **0.4** Organizar docs: mover o morto p/ `docs/_arquivo/**`, deixar UMA porta de entrada (`CONTROLE-MESTRE`), unificar os 2 roteiros de rotação de chave, resolver `_rumo-memoria/` (56 arq.). *(sem tocar código)*
- **Ganho:** –16.800 linhas, –67 arquivos, 849→~782 arquivos; docs navegáveis.

### 🟡 FASE 1 — REDE DE SEGURANÇA (fazer ANTES de refatorar — é o que garante o "cirúrgico")
- **1.1** `next build` no CI (`.github/workflows/ci.yml`) — ~5 min, ROI altíssimo, fecha o furo de quebra que só o build pega.
- **1.2** Smoke E2E: um teste que **visita cada tela-topo** (login → /crm → pessoas → aprovações → projetos → cadastros → escrow) e afirma: sem 5xx, **sem erro no console**, âncora presente. **Antídoto direto do "quebrou outra tela".**
- **1.3** Render tests dos **componentes compartilhados** (sidebar/nav, header, cockpit, tabelas) — instalar happy-dom + testing-library; asserção mínima "renderiza sem throw". Pega o raio de explosão dos compartilhados.

### 🟠 FASE 2 — DESTRAVAR O ACOPLAMENTO (com a rede no ar)
- **2.1** Unificar os **82 clientes Supabase** copiados → importar `crmDb()`/`crmConfigError()`. Mecânico, baixo risco, em lotes de ~15 com gate a cada lote.
- **2.2** Nomear o perigo do tenant: criar `tenantScopeExact()` (`.eq` puro) + renomear `tenantScopeOrFilter` → `...LegacyGlobal`. Baixo risco, alto valor (a próxima pessoa vê o nome certo). *A troca das 50 call-sites erradas = junto da janela do dono (dado em prod).*
- **2.3** Remover a busca de papel duplicada em `layout.tsx` → usar o `useCrmRole()` que já existe/testado.
- **2.4** Extrair `app/crm/layout.tsx` em `CrmSessionBootstrap` (auth/guard) + `CrmShell` (chrome visual). Risco médio — **por isso vem depois da rede**. Um bug de CSS deixa de poder derrubar a auth.
- **2.5** RBAC ponto único: `lib/rbac/pode-acessar.ts` que nav/página/API consomem (não reescreve a lógica, só para de ter 3 lugares que podem divergir). *Mexe em autorização → por último.*

### 🔵 FASE 3 — TRAVAR (evitar reincidência)
- **3.1** Instalar ESLint (`no-explicit-any`, `no-floating-promises`, regra de fronteira server/client) — trava a disciplina que hoje é só hábito.
- **3.2** Hook genérico `useCrmCrudDrawer<T>()` antes de quebrar as 9 telas de mesma forma (evita fazer o mesmo split 9x).
- **3.3** Índice de docs gerado por script (mata o drift "142 vs 252").
- **3.4** Quebrar os god-files VIVOS incrementalmente (ArvoreEscopo é o mais fácil, ~10 partes já separadas) — **só com a rede da Fase 1**, um por vez, QA por commit.

---

## 4. FORA DO MEU ALCANCE (janela do dono — SQL/prod, preparo e rodamos juntos)
- Troca das 50 call-sites de `tenantScopeOrFilter` incorretas (Faixa B tenant-null) — dado em prod.
- Dropar as RPCs de hard-delete dormentes (`hub_delete_*`).
- Pacote RLS + backfill · escrow #5 (GREATEST) · rotação service_role. *(já em §4.1 do CONTROLE-MESTRE)*

---

## 5. RELAÇÃO COM A ONDA A
O spec da **Tela do Arquiteto v2** está pronto e persistido (`docs/DESIGN-TELA-ARQUITETO-v2.md`), mas o **código segue segurado**. Quando o destravamento chegar na Fase 2, a Onda A vira a **primeira entrega cirúrgica** — construída sobre a base já desacoplada e com a rede da Fase 1. Ela deixa de ser risco e vira a prova de que o destravamento funcionou.

---

## 6. RECOMENDAÇÃO DO CEO
Começar **hoje pela Fase 0** — risco zero, remove ~11% do peso morto e limpa a mesa para todo o resto. É a maior redução de ruído pelo menor risco que existe no projeto agora. Aprovação frente a frente; eu executo em commits pequenos com gate verde e te mostro cada corte.

---

## 7. EXECUÇÃO (05/jul, tarde) — Fase 0 ✅ + Fase 1.1 ✅ no `wendel/dev` (NÃO deployado)
> Dono aprovou "Fase 0 + emenda 1.1" e deu autorização oral p/ executar e verificar depois. **Trava respeitada:** empurrei p/ `wendel/dev` + backup próprio; **sem deploy pra `feature/escritorio-visual`** (Render/prod espera o dono).

**FASE 0 — LIMPAR ✅** (3 commits, cada um com gate `next build` 0 + `vitest 766/766`):
- `98b50b1` **0.1** — Cluster A "escritório virtual" (71 arq, −14.045 linhas). Mantido `/office` como redirect legado (opção A); extraído `getInitials` → `lib/getInitials.ts` (único uso vivo, no `CrmSessionFooter`).
- `906366e` **0.2** — Cluster B (15 formulários órfãos).
- `1bfd6cb` **0.3** — helpers de hard-delete dormentes (`delete-agente-completo` + rag-storage).
- **Total: 88 arquivos, −17.487 linhas.** Minha verificação (não só a do agente) pegou 2 pegadinhas que o "zero importadores" cru não via: `CrmSessionFooter` (vivo) usava `getInitials`, e a rota `/office` tinha refs no middleware/nav/auth-bridge — ambas tratadas antes de apagar.

**FASE 1 — PROTEGER (parcial):**
- `c75b16a` **1.1 ✅** — `next build` no CI (`ci.yml`). Validado rodando o build **sem `.env.local`** (simulação fiel do CI) com placeholders não-secretos. Fecha o furo "quebra que só o build pega chegava ao deploy".
- **1.2 (smoke E2E) e 1.3 (render tests) — DEFERIDOS de propósito.** Exigem decisão de infra melhor tomada com o dono: 1.2 precisa de harness de login no CI (usuário/DB de teste); 1.3 precisa de happy-dom/jsdom + testing-library + estratégia de mock dos providers. Rushed com o dono fora = teste piscando / CI vermelho.

**PRÓXIMO (com o dono):** decidir o harness → fechar 1.2/1.3 → só então Fase 2 (destravar acoplamento) sobre a rede pronta. NÃO pulei pra Fase 2 de propósito — seria repetir o erro de refatorar sem rede.
