# CRONOGRAMA DE PROJETO — Obra10+ (3 cenários de equipe)

> **O que é.** Estimativa realista de prazo por versão (MVP/V1/V2/V3) em **3 cenários de equipe**, feita por um trio **PM Sênior + Software Architect + Especialista SaaS**. Constrói sobre `ESCOPO-MVP-V1-V2.md`, `MACRO-PLAN-ATUALIZADO.md` e os **esforços em horas** já estimados na `AUDITORIA-ENTERPRISE.md`.
>
> **Data:** 2026-07-01 · **Moeda de estimativa:** horas de engenharia da auditoria, convertidas em semanas por cenário com fatores explícitos. **Sem "depende" solto** — todo prazo tem premissa e cenário.

---

## §0 — Base de esforço (de onde vêm os números)

A auditoria estimou esforço por bloco. Somando por versão (com folga de coordenação/teste/revisão embutida no fator de cenário):

| Bloco de trabalho | Fonte | Esforço bruto (h-eng) |
|---|---|---|
| 🔴 CRÍTICO (Fase 0 segurança) | Auditoria §4 | **90–120h** |
| Núcleo Fase 1 (`hub_eventos`, dedup intake, funções, higiene) | MACRO-PLAN Fase 1 | **60–90h** |
| UX crítico (zoom✔, atendimento✔, kanban teclado, contraste) | Auditoria 🟠 | **16h** (metade já feita) |
| 🟠 ALTO (multi-tenant real, entitlements, créditos, IA-sec, rate-limit, obs, CI) | Auditoria §4 | **120–160h** |
| 🟡 MÉDIO (perf, observabilidade, DB) | Auditoria §4 | **80–100h** |
| AEC ativação + Estrutura Unificada F1–4 | MACRO-PLAN Fase 4 | **180–260h** |
| Central Aprovações + Gestor Tarefas + Distribuição B5 | MACRO-PLAN Fase 3/4 | **160–240h** |
| Orçamento IA (memorial→planilha) | MACRO-PLAN Fase 4 | **120–200h** |
| Portal + Marketplace + Campo + Monetização automática | MACRO-PLAN Fase 5 | **500–800h+** |

> **Totais aproximados por versão** (h-eng, sem overhead de cenário):
> - **MVP** ≈ 90–120 (crítico) + 60–90 (núcleo) + ~10 (UX restante) = **~160–220h**
> - **V1** (além do MVP) ≈ 120–160 (alto) + ~40 (parte do médio essencial) = **~160–200h**
> - **V2** (além do V1) ≈ 80–100 (médio) + 340–500 (AEC+aprovações+tarefas+distribuição+orçamento IA) = **~420–600h**
> - **V3** (além do V2) ≈ **500–800h+**

---

## §1 — Premissas EXPLÍCITAS (valem para os 3 cenários)

1. **Semana útil = 30h de trabalho focado por dev** (não 40h — descontando reunião, review, contexto, ambiente). PM/DevOps parciais não contam como dev-full.
2. **A base de código existe e é conhecida pela equipe** — não é greenfield. Isso acelera, mas a **dívida** (god-files, 75 cópias de `db()`, migrações file×prod divergentes) **atrita**: aplica-se **fator de atrito de 1,3×** sobre o esforço bruto em áreas tocadas pela dívida (segurança, DB, tenant).
3. **A Fase 0 é serial-crítica e exige o dono presente** para a janela de infra (migrações, rotate de chave, re-teste de login). Ver §5.
4. **Cenário A (1 dev) = o próprio dono orquestrando o Claude Code** — capacidade real ~30–40h/semana de output efetivo, com o dono como revisor/decisor. Não é "1 dev humano sênior full-time".
5. **Ganhos de paralelismo não são lineares.** Aplica-se **eficiência de time**: A=1,0× · B=0,85× por dev · C=0,75× por dev (mais gente = mais coordenação). Já embutido nos prazos.
6. **Migração em produção sempre acontece na janela do dono** — mesmo com "autorizo tudo", o classificador barra e está certo. Isso adiciona **latência de calendário** (esperar o dono), não horas de engenharia.
7. **IA depende de chave Mistral com billing ativo** — item externo do dono; se atrasar, os 3 testes de IA e tudo IA-first escorregam.

---

## §2 — Os 3 cenários

### Cenário A — 1 dev (o dono + Claude Code)
- **Capacidade:** ~30–35h/semana efetivas, com o dono também sendo o decisor de negócio (o que **reduz** o tempo dev líquido, porque decisões param a implementação).
- **Perfil:** ótimo para MVP e V1 (trabalho de segurança/backend, bem definido, adversarialmente auditável). **Gargala em V2/V3** (frentes paralelas grandes, UI + IA + DB simultâneas competem pela única cabeça).
- **Fator efetivo:** 1,0× (baseline).

### Cenário B — 2–3 devs
- **Capacidade:** 2–3 devs × 30h × 0,85 eficiência = **~51–76h/semana** de output.
- **Perfil:** o **sweet spot** para chegar a **V1 comercial rápido** e engatar V2. Um foca segurança/backend/tenant, outro em núcleo/UX/IA. Um 3º (se houver) toca AEC em paralelo (migrações já prontas).
- **Fator efetivo:** ~0,85×/dev.

### Cenário C — Equipe ideal (tech lead + 2 fullstack + 1 UI + 1 QA + DevOps/PM parciais)
- **Capacidade:** ~4,5 devs-equivalentes × 30h × 0,75 = **~100h/semana** de output, com **QA e DevOps removendo risco** (CI, testes, deploy confiável).
- **Perfil:** maximiza **paralelismo real** — segurança, núcleo, AEC, UI e QA correm juntos. Necessário para V2/V3 em prazo agressivo. Custo de coordenação maior, mas **menor risco** (QA+DevOps cortam retrabalho).
- **Fator efetivo:** ~0,75×/dev, **compensado** por menos retrabalho.

---

## §3 — Tabela-mestra (prazo por versão × cenário)

> Prazos **cumulativos a partir de hoje** (semanas de calendário), já incluindo overhead de cenário e latência de janela do dono na Fase 0. `s` = semanas.

| Cenário | MVP | V1 | V2 | V3 | Risco |
|---|---|---|---|---|---|
| **A — 1 dev (dono+Claude)** | **5–7s** | **11–15s** (~3–3,5 meses) | **32–44s** (~8–10 meses) | **+12 meses** (fora de horizonte realista solo) | **Alto** — ponto único de falha; V2/V3 sufoca a única cabeça; decisões de negócio param a implementação |
| **B — 2–3 devs** | **3–4s** | **7–9s** (~2 meses) | **18–24s** (~4,5–6 meses) | **~10–12 meses** | **Médio** — sweet spot; risco vira coordenação + dependências do dono |
| **C — equipe ideal** | **2–3s** | **5–6s** (~1,5 mês) | **11–15s** (~3–3,5 meses) | **~7–9 meses** | **Médio-baixo** — QA/DevOps cortam retrabalho; risco é custo e onboarding inicial |

**Detalhamento do incremento por versão (não cumulativo) no cenário B (referência):**

| Incremento | Esforço (h-eng) | Prazo B (2–3 devs) |
|---|---|---|
| MVP (Fase 0 + núcleo) | ~160–220h | 3–4 semanas |
| V1 (multi-tenant + entitlements + créditos + Hub) | ~160–200h | +4–5 semanas |
| V2 (AEC + aprovações + tarefas + orçamento IA + perf) | ~420–600h | +11–15 semanas |
| V3 (portal + marketplace + campo + billing auto) | ~500–800h+ | +6+ meses |

---

## §4 — Riscos que AUMENTAM o prazo (com mitigação)

| Risco | Efeito no cronograma | Mitigação | Dono do risco |
|---|---|---|---|
| **Migrações file×prod divergentes** (`supabase db diff` sujo, `hub_alertas` schema drift) | +1–2 semanas se aplicar às cegas quebrar prod | Rodar `db diff` **antes**, checar duplicatas do índice único de recebível, aplicar em janela com backup | Dev + dono |
| **Ligar o middleware quebra fluxo público** (ex.: intake `/api/leads` público não-allowlistado) | +dias de firefighting se ligado às cegas | Validar allowlist `isPublicApiPath` **fluxo a fluxo** + testar login/cadastro com o dono antes | Dev + dono |
| **Chave Mistral/billing não configurada a tempo** | Bloqueia os 3 testes de IA e tudo IA-first do MVP | Dono configura billing Mistral **antes** da janela; Groq como fallback | Dono (externo) |
| **Escrow — mudança no dinheiro** exige migração + validação contábil | +1 semana de teste extra (não se pode errar) | Testes automatizados de custódia/double-spend antes de tocar prod | Dev |
| **Dívida técnica nas áreas tocadas** (god-files, 75× `db()`) | Atrito de 1,3× já embutido; pode ser pior se refator vazar de escopo | Congelar refator ao mínimo necessário; ESLint proibindo service-role fora de `lib/` | Tech lead |
| **Decisões de negócio abertas** (markup de créditos, faixas×valor, captação pública, contrato Membros) | Param frentes de V1/V2 até o dono decidir | Lista de decisões pendentes com prazo; agrupar em 1 sessão de decisão | Dono |
| **Ponto único de falha no Cenário A** | Doença/indisponibilidade do dono = projeto para | Documentar tudo; considerar 2º dev para V2 | Dono |
| **Prompt-injection/RAG cross-tenant não fechados antes de N clientes** | Incidente de segurança = retrabalho + reputação | Incluir IA-sec no escopo de V1 (não empurrar para V2) | Dev |

---

## §5 — Dependências externas e itens que exigem o DONO

Estes **não são horas de engenharia** — são **latência de calendário** (esperar o dono) e ficam no caminho crítico da Fase 0. Concentrá-los em **uma janela** encurta o MVP.

### Janela de infra (produção — só com o dono presente)
- Setar `MISTRAL_API_KEY` (billing ativo) + `COPILOTO_HMAC_SECRET` + `CRON_SECRET` + `GROQ_API_KEY` no Render.
- Remover `NEXT_PUBLIC_INTERNAL_API_KEY` + `NEXT_PUBLIC_TENANT_ID` e **re-testar login** (auth mudou).
- Aplicar as ~19 migrações file-only (`supabase db push`) — inclui AEC + RLS + escrow + índice único (rodar checagem de duplicatas antes).
- **Rotacionar `service_role`** + tirar `.env`/repo do OneDrive + deletar `backup-auto.yml`.
- Config Auth de reset de senha (Redirect URLs, SMTP, rate-limit) + trocar senha exposta no chat.

### Decisões de negócio que travam frentes
- Markup de créditos (por escritório × por mercado); quando ligar bloqueio de saldo negativo.
- Faixas × valor exato nos campos financeiros; captação pública (landing cria sem login?).
- Comissão imutável no fechamento (snapshot) + margem administração×preço-fechado.
- Contrato Membros→fornecedor; pesos do score de distribuição; fluxo/campos de Compras.

### Testes ao vivo (com o dono, em prod)
- 3 testes de IA: gerar-fluxo, atendimento WhatsApp, copiloto de voz — dependem da chave Mistral.

> **Regra de ouro do cronograma:** a Fase 0 tem **~90–120h de engenharia** MAS também **N dias de latência do dono**. Se a janela do dono for **uma sessão concentrada**, o MVP fecha no piso do prazo (3s no cenário B). Se as ações do dono ficarem pingando, o MVP escorrega para o teto (4s+), sem que uma linha a mais de código seja necessária.

---

## §6 — Recomendação de cadência

- **Cenário B é o recomendado** para o objetivo declarado (vendável + captável): chega a **V1 comercial em ~2 meses** e engata V2 no mesmo trimestre.
- **Começar como A** (dono + Claude) para a Fase 0/MVP é viável e barato — a Fase 0 é backend/segurança bem-definido, forte para 1 executor auditado. **Escalar para B** ao entrar em V2 (frentes paralelas de AEC + aprovações + IA), quando a única cabeça vira gargalo.
- **C só se compensa** quando há capital de investidor e pressão de time-to-market para V2/V3 — o valor de C é **cortar risco** (QA+DevOps) mais do que cortar semanas.
