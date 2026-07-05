# 🌳 CONTROLE-MESTRE — Obra10+ / Escritório Virtual
> **A raiz da árvore. Fonte única de verdade.** Se algo não está aqui (ou apontado daqui), está em risco de se perder. Atualizado a cada onda.
>
> **Última atualização:** 04/jul/2026 (madrugada) · **Progresso macro estimado: ~56%** · última entrega: **Cadastro do Parceiro Fase 1** (`601b7eb`→`4081ec2`) — ver `docs/00-RELATORIO-MADRUGADA-04JUL.md`

---

## 0. POR QUE ESTE DOCUMENTO EXISTE
O projeto ramifica rápido (um assunto puxa outro quase infinitamente). Já perdemos dados (Asana). Este doc é a **árvore-mestre**: roadmap + cronograma + progresso + índice de tudo + pendências + backups + plano de logs. **Regra:** toda decisão/onda/pendência entra aqui. Sem merges desnecessários; tudo pelo processo (§6).

---

## 1. SAÚDE / ONDE ESTÁ TUDO (integridade dos dados)
| Item | Estado | Onde |
|---|---|---|
| **Repo de trabalho** | `origin` = github.com/ramonprogjr/escritorio-virtual (do dev Ramon) | branches `wendel/dev` (trabalho) → `feature/escritorio-visual` (deploy Render) |
| **Backup próprio** ✅ | Espelho completo (13 branches + 5 tags) | github.com/**wendelnice-dev**/backup-sistema-01-hub |
| **Backup DIÁRIO** ✅ | Tarefa Windows `BackupHubDiario` 13:00 | script `C:\Users\wende\backup-hub-diario.ps1` |
| **Banco** | Supabase `cdjlqsznerdhwqyunodl` (SISTEMA OBRA10+) | prod; migrações = janela do dono |
| **Deploy** | Render `escritorio-virtual-1.onrender.com` | auto de `feature/escritorio-visual` |
| **Memória do CEO** | ~60 fatos (decisões/padrões/regras) | `~/.claude/.../memory/MEMORY.md` |
| **Docs** | **142 arquivos** em `docs/` (+ insumos do dono) | índice em §5 |

---

## 2. PLANO MACRO (a visão — não muda)
Plataforma **IA-first, multi-tenant, API-first**: o **Hub** distribui e audita; cada **fornecedor/escritório** vende (CRM) e executa (obra/projeto) na plataforma. Personas: **HUB(auditor) · comercial · engenharia · arquiteto · cliente · fornecedor · parceiro · MDO**. Alma: **rastreabilidade total** + **escrow dupla-chave** (o dinheiro só anda com 2 autoridades) + **cura dos 5 medos do cliente**. Design **dark verde+dourado**, **Click-and-Go**, **códigos escondidos**, **delete=arquiva**, **nada se perde**.
> Detalhe: `docs/insumos-do-dono/VISAO-DEFINITIVA-SISTEMA-USUARIO-TELA-IA.md`, `SPEC-RASTREABILIDADE-COMPLETA-HUB.md`, `docs/ANALISE-MESTRA-ESCOPO.md`.

---

## 3. ROADMAP + CRONOGRAMA + PROGRESSO
**Legenda:** ✅ feito no ar · 🏗️ em execução · 📋 na fila (desenhado) · 🧊 guardado (janela/decisão do dono)

### 3.1 Progresso por ÁREA (macro)
| Área | % | Estado |
|---|---|---|
| Núcleo CRM (leads/negócios/cadastros/kanban/rastreio) | **85%** | ✅ funcional; polimento |
| Obras/Engenharia (EAP/escopo/medições/cronograma) | **70%** | ✅ base; medições↔financeiro a fechar |
| Arquitetura (projetos/aprovações/cockpit) | **60%** | 🏗️ cockpit ok; **financeiro FALTA** (mesa rodando) |
| Financeiro/Escrow (dupla-chave/contas/tijolos) | **65%** | ✅ escrow por capability no ar; módulo financeiro completo por persona = design |
| **RBAC / Multi-tenant** | **40%** | 🏗️ Onda 1+2 no ar; Ondas 3+ e multi-tenant real pendentes |
| Analytics / Dashboards (TV tempo real) | **35%** | 🧊 framework existe; **"parede de zeros"** — falta alimentar |
| Portais externos (cliente/fornecedor/parceiro) | **30%** | 📋 stubs; cadastro parceiro/link + cliente na fila |
| IA / Copiloto / Agentes | **50%** | ✅ engine; precisa chaves + validação ao vivo |
| Segurança (RLS/backfill/rotação chave) | **60%** | 🧊 muito endurecido; pacote RLS = janela |
| **Logs / Observabilidade** | **30%** | 📋 eventos/decisões existem; sistema unificado a DEFINIR (§7) |
| **TOTAL (estimativa honesta)** | **~55%** | |

### 3.2 ONDAS (sequência de execução)
| # | Onda | Status | Commit/Deploy |
|---|---|---|---|
| — | QA Ondas 1-4 (persona-cego→cockpit, busca nome, escrow dashboard, botões mortos) | ✅ | 2cfd665→4fad7a5 |
| — | "Aprovando já segue" (efeito fiel da cascata) | ✅ | b0ed29e |
| — | Mesa RBAC + multi-tenant (D1-D10 + ressalva escrow universal) | ✅ desenho aprovado | `docs/DESIGN-RBAC-MULTITENANT.md` |
| **1** | RBAC role-map (13 papéis) + fecha 403 + escrow por capability | ✅ **E2E vivo: escrow liberado R$15k** | 63620f2→835c603 |
| **2** | Fila de aprovações **filtrada por persona** + nav persona-aware | ✅ (falta E2E vivo pós-deploy) | 4c7ddad→191cb7a |
| **A** | 🏛️ Mesa: **Tela do Arquiteto** (financeiro + Visão Geral macro/micro + Analytics TV tempo real) | 🏗️ rodando | → `docs/DESIGN-TELA-ARQUITETO.md` |
| **B** | Cadastro do **Parceiro** — Fase 1 (form manual) ✅ + **Fase 2 (link HMAC "quem convidou")** ✅ | ✅ Fase 1 no ar (staging); **Fase 2 código em `wendel/dev` `28822e2`, E2E verde, aguarda deploy** | `601b7eb`→`4081ec2` · Fase 2 `28822e2` |
| **C** | **Configurações** no menu (self-service: empresa cadastra funcionários + permissões = RBAC operável) | 📋 fila | mesa a fazer |
| **3** | RBAC Onda 3 (ABAC fino por rota; endurecer o `comercial` de architect/operation) | 📋 fila | do design |
| **D** | **Sistema de LOGS** unificado (erros + ações) — §7 | 📋 fila | mesa a fazer |
| **E** | Multi-tenant REAL (1º tenant) — só após RLS/backfill | 🧊 dono | do design |

---

## 4. PENDÊNCIAS (a árvore — nada fica solto)
### 4.1 🧊 Janela do dono (SQL/prod — o classificador me barra, e está certo)
- `docs/JANELA-01-cliente-pessoa-cockpit.sql` ✅ RODADO (cliente ligado)
- `docs/JANELA-02-DEMO-escrow-*.sql` ✅ RODADO (demo liberou R$15k)
- `docs/JANELA-03-eng-responsavel-obra.sql` 📋 pronto (coluna eng responsável)
- **Pacote RLS + backfill tenant-NULL** (endurecer USING(true), `.eq` puro, backfill 1 pessoa) — a preparar
- **Rotação da service_role key + reescopo INTERNAL_API_KEY** (D9 do RBAC) — pré-multi-tenant
- **Escrow #5** (GREATEST/FOR UPDATE) + `.env` fora do OneDrive
### 4.2 🧊 Decisões de produto (do dono)
- Dinheiro fluir de verdade (seed recebíveis/medições reais do Consulado)
- Desambiguar fornecedor × parceiro × empresa-cadastro
- `/crm/tarefas`: renomear vs construir o Gestor de Tarefas universal
- Modelo A/B multi-tenant + QUANDO ligar o 1º tenant real
### 4.3 🧹 Limpeza
- Remover login de teste `e2e-arq` (rollback em `…/scratchpad/criar-e2e-arquiteto.sql`)
- Rollback do DEMO escrow (já liberado) quando o dono quiser
- `obradezmais` → owner (hoje admin temporário do teste) · criar login externo (trava)
### 4.4 🐞 Follow-ups de código (do CEO)
- R7: default de papel desconhecido → fail-closed (hoje "comercial")
- Amarrar escrow:chave_tecnica ao RESPONSÁVEL da linha (após JANELA-03)
- Cron dos KPIs (alimenta analytics — anti parede-de-zeros)
- ~~**Parceiro Fase 2:** link de convite "quem convidou" via **HMAC**~~ ✅ **FEITO** (`28822e2`, E2E verde: 401 gate · sig válido credita · forjado recusa; grava em `hub_parceiros_log.dados`). Coluna `cadastrado_por` **DISPENSADA** — a coluna `dados` já existe em prod e persiste a atribuição sem migração. **Resta:** deploy p/ `feature/escritorio-visual` + alinhar dedup do **especialista** ao `.eq` puro (hoje `.or(is.null)`)

---

## 5. ÍNDICE DE DOCUMENTOS (mapa dos 142 — os que importam)
- **Estado/entrada:** `00-LEIA-PRIMEIRO-ESTADO.md` · `INDICE.md` · **este** `CONTROLE-MESTRE.md` · `00-RETOMADA-CHAT-NOVO.md` · **`00-RELATORIO-MADRUGADA-04JUL.md`** · **`MAPA-CONEXOES-CADASTROS.md`** ⭐ (rastreabilidade: como os cadastros se ligam + gaps)
- **Visão/escopo:** `01_documento_mestre.md` · `ANALISE-MESTRA-ESCOPO.md` · `ESCOPO-MVP-V1-V2.md` · insumos-do-dono/`VISAO-DEFINITIVA-*`, `SPEC-RASTREABILIDADE-*`
- **Design por módulo:** `A0..A2-DESIGN.md` (arquitetura) · `E0..E7-DESIGN.md` (engenharia/obra) · `ESTRUTURA-UNIFICADA-*` · `EAP-REFINADA-*`
- **RBAC/atual:** `DESIGN-RBAC-MULTITENANT.md` ⭐ · (em breve) `DESIGN-TELA-ARQUITETO.md`
- **Auditorias:** `AUDITORIA-QA-SINTESE-CEO.md` · `AUDITORIA-47-TELAS.md` · `AUDITORIA-ENTERPRISE.md` · `E2E-DOMINIO-A..I-ACHADOS.md`
- **Financeiro/escrow/central:** `E6-DESIGN.md` · `CENTRAL-APROVACOES-DESIGN.md` · `modelos-contrato-e-escrow.md`
- **Janela (SQL):** `JANELA-01/02/03` · `APLICAR-*`
- **Pendências/dívidas:** `DECISOES-PENDENTES.md` · `DIVIDAS-TECNICAS.md` · `PENDENCIAS-AMANHA.md` · `BACKLOG-FEATURES.md`
> ⚠️ Muitos docs são de fases passadas. **Este CONTROLE-MESTRE é a verdade atual**; em conflito, ele vence.

---

## 6. COMO TRABALHAMOS (processo — evita retrabalho e merge desnecessário)
1. **Toda tela/feature:** E2E ao vivo (chrome-devtools + verdade no banco) → **mesa redonda** (multi-especialista, UI/UX pesado) → **CEO ajusta E aprova** → **cada persona usa** (simulador) → dono traz considerações.  *(memória: processo-aprovacao-tela-e2e-mesa-ceo)*
2. **Git:** trabalho em `wendel/dev`; deploy sincroniza `feature/escritorio-visual` (checkout da árvore, sem merge). **Sem merges desnecessários.** Gate obrigatório: `tsc 0 · vitest · build 0`.
3. **Migração/prod:** sempre janela do dono (§4.1).
4. **Nada se perde:** decisão importante → memória + este doc. Doc do dono → `docs/insumos-do-dono/`. Backup diário roda sozinho.

---

## 7. SISTEMA DE LOGS (erros + ações) — a DEFINIR bem (Onda D)
**Hoje (parcial):** `hub_eventos` (eventos/ações, keystone) · `hub_decision_logs` (decisões de IA/humano) · helpers `registrarEvento`/`registrarDecisao` · `console.warn/error` espalhados · logs de rate-limit. **Gap:** não há **tabela/handler central de ERROS** nem **auditoria de AÇÃO consistente em toda mutação**.
**A definir (design da Onda D):**
- **LOG DE AÇÕES (auditoria):** toda mutação relevante (quem/o quê/quando/tenant/entidade/antes→depois) em `hub_eventos` de forma PADRONIZADA (um helper único obrigatório nas rotas de escrita). Base do "nada se perde" e do Hub-auditor.
- **LOG DE ERROS:** tabela `hub_error_logs` + um handler central (captura server + client) com nível/rota/tenant/stack/correlação; painel no admin. Nunca engolir erro em `catch {}`.
- **Correlação:** um `request_id`/`trace_id` ligando ação↔erro↔evento.
- **Retenção + privacidade:** não logar PII crua/segredos; respeitar tenant.
> Isto vira uma **mesa própria** (Onda D) no processo do §6.

---
*Fim. Este documento é atualizado ao fim de cada onda pelo CEO.*
