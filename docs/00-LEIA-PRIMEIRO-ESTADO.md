# 📍 00 — LEIA PRIMEIRO · Mapa único do projeto (estado + onde achar cada coisa)

> **Ponto de entrada ÚNICO.** Se tiver dúvida de onde está algo, é aqui. Atualizado: **01/jul/2026 (noite)**.
> Regra: este arquivo é o índice mestre; os outros índices antigos (`INDICE`, `MANIFEST`, `STATUS`,
> `HANDOFF*`) estão **superados** — não confiar neles.

---

## 🗺️ NOSSO MAPA MAIS ATUALIZADO (comece por aqui)
Estes são os documentos que valem AGORA — auditorias de direção + o modelo do produto:

| # | Doc | O que é |
|---|---|---|
| 🧱 | [MODELO-OPERACIONAL-TENANT.md](MODELO-OPERACIONAL-TENANT.md) | **(01/jul noite)** o MODELO do produto: tenant-primeiro, carteira→central, serviço universal, fonte-única/lentes, preditivo. **A "coluna".** |
| 📋 | [insumos-do-dono/LAUDO-DETALHADO-POR-TELA.md](insumos-do-dono/LAUDO-DETALHADO-POR-TELA.md) | **(02/jul)** laudo de produto do dono, 33 telas, funcionalidade-primeiro. |
| 🧭 | [DECISAO-CEO-LAUDO.md](DECISAO-CEO-LAUDO.md) | **decisão de CEO sobre o laudo** (verificado no código): o que já consertei, o que depende de você, o que o laudo errou. |
| 🧮 | [MAPA-NECESSIDADES-SISTEMICAS.md](MAPA-NECESSIDADES-SISTEMICAS.md) | mesa-redonda da planilha real: modelo de dados, cascatas, o que alimenta o preditivo, gaps. |
| 🧭 | [DIAGNOSTICO-PROJETO-ROADMAP-CRONOGRAMA.md](DIAGNOSTICO-PROJETO-ROADMAP-CRONOGRAMA.md) | auditoria de DIREÇÃO (onde estamos, o que falta, cenários) |
| 📅 | [CRONOGRAMA-PROJETO.md](CRONOGRAMA-PROJETO.md) · [ROADMAP-EXECUCAO.md](ROADMAP-EXECUCAO.md) | cronograma + ordem de execução |
| 📊 | [STATUS-MODULOS.md](STATUS-MODULOS.md) · [MAPA-ATIVIDADES.md](MAPA-ATIVIDADES.md) | status por módulo + atividades |
| 🔒 | [AUDITORIA-ENTERPRISE.md](AUDITORIA-ENTERPRISE.md) · [REMEDIACAO-AUDITORIA.md](REMEDIACAO-AUDITORIA.md) | auditoria de segurança (REPROVADO 3.5/10) + triagem |
| 🗄️ | [MASTERPLAN.md](MASTERPLAN.md) | macroplan v2 (7 camadas + 2 espinhas) |

## 📊 ESTADO ATUAL (honesto — 01/jul noite)
- **Núcleo comercial:** no ar, maduro (~90% apresentável).
- **Visão completa** (comercial+AEC+Hub+portal+monetização): ~35–40%. Fundação AEC pronta em código mas **latente** (migrações E0–E7/A0–A2 **não aplicadas**).
- **Segurança:** o crítico de verdade — **bypass de sessão (cookie forjável)** — foi **FECHADO e verificado no ar** hoje. Banco auditado via MCP: **0 ERROS** (87 WARN, 59 INFO). `search_path` de 33 funções **aplicado**. Falta a janela do dono (chave, RLS tenant-scope, escrow).
- **Modelo do produto:** **travado** hoje (ver MODELO-OPERACIONAL-TENANT). Próximo: dono traz auditoria dele (Asana) + planilha atualizada → mesa-redonda → construir de baixo pra cima.

## 🔙 PONTO DE RETORNO (se algo der errado)
- **Tag boa conhecida:** `estado-01jul-pos-auditoria` (`43e8177`). **HEAD atual:** `a9411dc` (branch `wendel/dev` → `feature/escritorio-visual`, no remote).
- **Gates sempre verdes antes de push:** `tsc 0` · `vitest 688` · `build 0`. Aditivo · `git pull --rebase` · migração só na janela do dono · **nada de secret no Git**.

## 🔒 AUDITORIAS (todas, em um lugar só)
- **Direção (mais atual):** DIAGNOSTICO-PROJETO-ROADMAP-CRONOGRAMA · CRONOGRAMA-PROJETO · ROADMAP-EXECUCAO · STATUS-MODULOS · MAPA-ATIVIDADES · PLANO-90-180-365-DIAS.
- **Segurança:** AUDITORIA-ENTERPRISE · REMEDIACAO-AUDITORIA · MOBILE-AUDITORIA-ACHADOS · AUDITORIA-MOBILE-2026-06-26 · E2E-AUDITORIA-PLANO · RESUMO-NOITE-E2E-FINALE · (verificações adversariais desta sessão: registradas em memória `auditoria-enterprise-01jul` + LOG-DEPLOYS).
- **Telas/produto:** AUDITORIA-47-TELAS · UIUX-AUDITORIA-E-PLANO · SIDEQUEST-AUDITORIA-ONBOARDING-E-MENUS · **`docs/diagnostico-telas/`** (33 telas, uma por arquivo) · crm-schema-audit-obra10 · ANALISE-MESTRA-ESCOPO.

## 🗂️ ÍNDICE POR CATEGORIA
- **🏗️ Modelo/Designs AEC:** MODELO-OPERACIONAL-TENANT · ESTRUTURA-UNIFICADA-OPERACAO-DESIGN · E0–E7/A0–A2-DESIGN · PORTAL-CLIENTE-DESIGN · EAP-REFINADA · ORCAMENTO-IA-DESIGN · CENTRAL-APROVACOES-DESIGN · MARKETPLACE/CAMPO/PLATAFORMA-DESIGN.
- **🗺️ Planos/roadmap:** MASTERPLAN · MACRO-PLAN-ATUALIZADO · PLANO-EXECUTIVO-BLOCOS · PLANO-BLOCOS-ARQ-ENG · PLANO-APLICAR-MIGRACOES · PENDENCIAS · DIVIDAS-TECNICAS · BACKLOG-FEATURES.
- **🔑 Infra/segurança do dono:** REMEDIACAO-AUDITORIA · **ROTEIRO-CHAVE-SUPABASE-RENDER** (chave, amanhã) · PLANO-APLICAR-MIGRACOES · PENDENCIAS-DONO-INFRA.
- **📈 Deploys/rodadas:** **LOG-DEPLOYS** (cronológico) · MARATONA-2H-RELATORIO · RESUMO-NOITE-E2E-FINALE.
- **📥 Insumos do dono:** pasta **`docs/insumos-do-dono/`** (planilha analisada + DUMP, spec de obras, portal-do-cliente-e-medos, EAP-orçamento, INDICE). ⚠️ **FALTA o estudo do Asana** (ver protocolo abaixo).
- **🧠 Memória (fora do repo):** `~/.claude/projects/…/memory/MEMORY.md` — índice; 1º item = o contrato de trabalho (CEO honesto).

## 🛟 PROTOCOLO ANTI-PERDA (a regra pra não perdermos mais nada)
1. **Todo insumo do dono** (texto, planilha, estudo, auditoria) → salvar **na hora** em `docs/insumos-do-dono/` + 1 linha aqui no índice. Se vier como texto no chat, eu colo num `.md` imediatamente.
2. **Toda auditoria** → `docs/` + entra na seção **🔒 AUDITORIAS** acima.
3. **Toda rodada/deploy** → 1 linha em `LOG-DEPLOYS.md`; decisão importante → memória.
4. **Este arquivo é a fonte única.** Índices antigos ficam como histórico, não como referência.

## 🔴 PENDÊNCIAS DO DONO (janela)
1. **#2 chave Supabase + Render** (amanhã) — roteiro em `ROTEIRO-CHAVE-SUPABASE-RENDER.md` + toggle leaked-password.
2. **Migrações** (janela, comigo verificando via MCP): RLS tenant-scope (load-bearing — realtime/office; antes do 2º tenant), série AEC (E0–E7) que liga a obra.
3. **Escrow** (custódia fantasma + FOR UPDATE) · **`.env` fora do OneDrive** · ligar IA (Mistral) + testar.
4. **RE-ENVIAR o estudo do Asana** (foi perdido — ver protocolo).

---
*Regra de ouro: dinheiro → dados/multi-tenant → privilégio → IA-custo → resto. Qualidade e controle antes de velocidade. Nada se perde.*
