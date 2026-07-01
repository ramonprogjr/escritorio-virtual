# PLANO EXECUTIVO — 90 / 180 / 365 DIAS (Obra10+)

> **Para quem.** Leitura executiva para o dono e para um potencial **investidor/sócio**. Traduz o estado técnico real (auditoria + macro-plan) em **tese, marcos e riscos** sem jargão. Feito por um trio **PM Sênior + Software Architect + Especialista SaaS** como parte da auditoria de direção.
>
> **Data:** 2026-07-01 · **Regra de honestidade:** só chamamos de "existe" o que está no código/banco. O que é design vira "roadmap", não "pronto". Baseia-se em `MACRO-PLAN-ATUALIZADO.md`, `AUDITORIA-ENTERPRISE.md`, `ESCOPO-MVP-V1-V2.md` e `CRONOGRAMA-PROJETO.md`.

---

## §1 — A tese em 5 linhas

Obra10+ é um **SaaS multi-tenant IA-first** que une, numa só coluna, o que hoje o escritório de arquitetura/engenharia e o corretor fazem em planilhas soltas e WhatsApp: **captar → atender com IA → vender (CRM) → executar a obra → receber com segurança (escrow auditado)**. O diferencial não é "mais um CRM": é o **cérebro preditivo da obra** — uma estrutura de dados unificada onde orçamento, cronograma, contrato e medição são **o mesmo dado**, permitindo que a IA **antecipe** compra, risco e atraso. O produto **já existe e roda** (núcleo comercial vivo, camada de obra construída em código); o gargalo é uma **dívida de segurança conhecida e mapeada** que separa "demo rica" de "produto que aguenta múltiplos clientes".

---

## §2 — Problema e mercado

**A dor (vivida pelo fundador — eng. civil + corretor):**
- O dono da obra tem **5 medos**: vai **atrasar**, **não acabar**, **não saber** o que está acontecendo, **ser enganado** e **perder dinheiro**.
- Do outro lado, arquiteto/engenheiro/prestador vivem de **planilhas desconectadas**: o orçamento não conversa com o cronograma, que não conversa com a medição, que não conversa com o pagamento. Retrabalho, erro e desconfiança nascem daí.

**O mercado:** construção civil e reforma no Brasil — fragmentado, informal, carente de software que junte **gestão comercial + execução de obra + confiança financeira**. O ângulo IA-first e o **escrow auditado** (dinheiro liberado só com dupla aprovação) endereçam diretamente o medo de "ser enganado / perder dinheiro" — que é o que trava a contratação hoje.

**Por que agora:** LLMs baratos o suficiente para atender/orçar; a categoria "sistema operacional vertical + IA" está sendo criada em vários setores; e o fundador tem **autoridade de campo** (constrói a partir da dor real, não de suposição).

---

## §3 — Diferencial (o moat)

1. **Estrutura Unificada** — orçamento = cronograma = gestão = escopo. Um **dado-mãe** (`hub_obra_itens`) projeta 7 artefatos sem redigitar. É a fundação **auditável** que ninguém copia rápido, porque exige a taxonomia certa.
2. **IA preditiva sobre esse dado** — o sistema sabe a **necessidade antes** (material por fase, risco, atraso). O moat não é "entregar rápido", é **prever**.
3. **Escrow com dupla-autoridade** — dinheiro em custódia liberado só com aprovação de arquitetura **+** Hub. Cura o medo de ser enganado; é o "selo de auditoria".
4. **Portal do Cliente honesto** — o cliente final tem usuário próprio e vê avanço/financeiro/diário auditados pelo Hub. Transparência como produto.
5. **Rede com monetização em 3 pernas** — assinatura SaaS + comissão transacional (split por código único) + créditos de IA. Receita composta.

---

## §4 — O que JÁ existe (ativos construídos — auditado no código)

> Isto é **capital técnico real**, não promessa. Reduz risco de execução e tempo-para-mercado.

- **Núcleo comercial vivo em produção (~90%):** CRM PF/PJ com dedup por código único, funil/Kanban editável por mercado, atendimento inbox IA+humano (WhatsApp/UAZAPI), motor de distribuição de leads, agentes de IA (builder + playbooks + copiloto de voz), financeiro a pagar/receber, metering de créditos de IA em modo sombra, ~33 telas.
- **Camada de obra (AEC) construída em código, latente:** ~19 migrações (E0–E7, A0–A2), libs, APIs e telas de obra/arquitetura + componente de árvore de escopo. **Pronta no repositório**, aguardando a janela de migração — ou seja, **meses de trabalho já feitos**, esperando serem "ligados".
- **Fundações de segurança certas em vários módulos** — a equipe **sabe** o padrão seguro (tenant-scope, escrow com dupla-autoridade e idempotência, HMAC no copiloto, webhook fail-closed); só não foi aplicado uniformemente. **A correção é conhecida, não é pesquisa.**
- **~40 documentos de design** cobrindo estrutura unificada, central de aprovações, portal do cliente, orçamento IA, marketplace, campo — o **roadmap de produto já está pensado**.

---

## §5 — O que FALTA (honesto)

- **Fase 0 de segurança (bloqueante):** middleware não roda (código morto em `proxy.ts`); RLS com `USING(true)` e vazamento `tenant_id.is.null`; escrow com custódia fantasma; `service_role` viva até 2036; PII no histórico do Git. **Auditoria: REPROVADO 3,5/10 para produção multi-tenant.** É corrigível (~90–120h) e mapeado.
- **Multi-tenant real:** hoje é single-tenant disfarçado. Isolar de verdade é pré-requisito para o 2º cliente.
- **Monetização SaaS:** entitlements/planos/billing **não existem**; créditos só debitam, sem recarga nem gate atômico. Cada tenant não-pagante gera custo de token ao dono.
- **Camada de obra ativada:** o código existe, mas não está aplicado em prod nem terminado (estrutura unificada F1–4, orçamento IA, central de aprovações unificada).
- **Portal do cliente, marketplace, campo:** design pronto, implementação à frente (V3).

---

## §6 — Riscos antes de captar / vender

| Risco | Por que importa para o investidor | Estado |
|---|---|---|
| **Segurança multi-tenant (LGPD)** | Vender a 2 clientes hoje = vazamento no dia 1. Risco jurídico e reputacional terminal. | Mapeado; **corrigir antes de qualquer venda multi-tenant** (Fase 0). |
| **Caminho do dinheiro (escrow)** | A "alma do produto" (confiança) quebra se a contabilidade é falsa. | Bug conhecido; correção ~16h. |
| **Custo de IA sem porteira** | Sem entitlements/gate de créditos, escala de usuários = escala de custo. | Endereçado em V1. |
| **Dependência do fundador (bus factor)** | Cenário solo = ponto único de falha. | Mitigar com 2º dev + documentação ao entrar em V2. |
| **Repositório é de um dev que saiu** | O repo principal pertence a terceiro (risco de bloqueio). | Backup próprio pendente — resolver **antes de captar** (due diligence). |
| **Migração em prod não testada** | Aplicar às cegas pode quebrar; `db diff` sujo. | Janela controlada com backup. |

> **Recomendação de governança:** não abrir due diligence técnica **antes** da Fase 0 fechar e do backup próprio do repositório estar consolidado. Um investidor competente roda exatamente a auditoria que já temos — melhor chegar com ela **fechada** e como prova de rigor.

---

## §7 — Marcos por horizonte (cenário B: 2–3 devs)

### Próximos 90 dias — "Fundação Segura + Vendável a 1..N"
**Objetivo:** sair do REPROVADO para **APROVADO para produção**, e ter a **primeira versão vendável** (V1) no ar.
- **Semanas 1–4 — MVP (Fundação Segura + Núcleo):** Fase 0 completa (middleware, RLS, escrow, rotate de chave, cron/webhook), IA ligada em prod, `hub_eventos` real, dedup do intake. **Marco: pentest top-10 fecha; auditoria interna sai do 3,5.**
- **Semanas 5–9 — V1 (SaaS Multi-Tenant Comercial):** multi-tenant real (≥2 tenants isolados), entitlements mínimos, gate atômico de créditos, dashboard do Hub, CI bloqueante, observabilidade. **Marco: 2 tenants pagantes isolados, com porteira de custo.**
- **Semanas 10–12 — Piloto pago + início de V2:** 1–2 escritórios reais operando; aplicar migrações AEC (aditivo); começar estrutura unificada. **Marco: primeiro cliente pagando; NPS/feedback do piloto.**

### 180 dias — "Sistema Operacional da Obra (o moat)"
**Objetivo:** ligar a camada que dá defensabilidade.
- Camada AEC ativa: uma obra real gerida ponta a ponta (escopo→orçamento→medição→pagamento→Curva-S) **sem redigitar**.
- Central de Aprovações unificada + Gestor de Tarefas + distribuição de leads persistida (B5).
- **Orçamento IA v1:** memorial PDF → planilha auditável. **É a demo que vende a tese preditiva ao investidor.**
- **Marcos:** (1) 1 obra completa no sistema; (2) orçamento IA rodando em memorial real; (3) 5–10 escritórios ativos; (4) 3 pernas de receita medidas (mesmo manual-first).

### 365 dias — "Rede + Ecossistema + Escala"
**Objetivo:** transformar em plataforma de rede com monetização automática.
- Portal do Cliente pleno (cura os 5 medos, selo de auditoria).
- Monetização automática (billing + comissão com split por código único + créditos pré-pagos).
- Fundação de marketplace + operação de campo (fases regionais/asset-light).
- **Marcos:** (1) receita recorrente com billing automático; (2) split automático numa transação real; (3) portal em uso por clientes finais; (4) base para rodada de crescimento com métricas SaaS reais (MRR, churn, LTV/CAC).

---

## §8 — O que pedir ao capital (se/quando captar)

- **Para acelerar de A→B/C:** contratar 1 tech lead + 1–2 fullstack + 1 QA. Corta o time-to-V2 pela metade e reduz o bus factor.
- **Uso primário do capital:** engenharia (moat AEC + IA) e go-to-market do piloto — **não** infra pesada (a arquitetura é asset-light por design).
- **Prova para due diligence:** esta auditoria + Fase 0 fechada + backup próprio do repo = sinal de rigor incomum para o estágio.

---

## §9 — Resumo de uma página (para pitch)

- **Produto:** SO vertical IA-first para arquitetura/engenharia/obra — capta, atende, vende, executa e recebe com segurança.
- **Tração técnica:** núcleo comercial **vivo**; camada de obra **construída** (latente); ~40 designs de roadmap.
- **Moat:** estrutura de dados unificada + IA preditiva + escrow auditado + portal transparente.
- **Estado:** MVP a 3–4 semanas (cenário B) de "seguro e vendável"; V1 comercial em ~2 meses; moat (V2) no mesmo trimestre.
- **Risco #1:** dívida de segurança **conhecida e mapeada** (não é incógnita) — a fechar antes de multi-tenant.
- **Pedido:** capital converte 1→3 devs e o piloto em rede com métricas SaaS reais em 12 meses.
