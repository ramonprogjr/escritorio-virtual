# 🧭 Proposta Inicial vs. O Que o Sistema Virou — Auditoria de Direção

> **O que é.** Reconstrução da **proposta inicial** do Obra10+ (a partir da evidência mais antiga do repositório e do banco) e comparação honesta com o estado atual, para responder à pergunta de direção: *o projeto ainda está no caminho certo, ou o escopo cresceu de forma descontrolada?*
>
> **Autor:** CPO (auditoria de direção) · **Data:** 2026-07-01 · **Método:** só evidência (arquivo/commit/tabela/migração). Onde não há prova, marca-se **"não confirmado"**.
>
> **Fontes primárias:** commit inicial `80579b2` (2026-05-03); `docs/01_documento_mestre.md` (v1.0, 08/05/2026 — o blueprint escrito do dono para os 2 devs); `docs/STATUS.md` (snapshot 03/05); schema original `lib/supabase/migrations.sql` do commit inicial; `docs/MACRO-PLAN-ATUALIZADO.md` e `docs/ANALISE-MESTRA-ESCOPO.md` (estado reconciliado, 25/jun–01/jul); `git log` (672 commits); `supabase/migrations/` (97 migrações); memórias ⭐ de arquitetura/visão.

---

## 1. Proposta inicial reconstruída

### 1.1 Objetivo original
> *"O Obra10+ é uma **agência de marketing/growth com uma plataforma de intermediação de parceiros acoplada**. O diferencial: tudo é orquestrado por agentes de Inteligência Artificial que fazem o trabalho operacional de uma equipe humana inteira."* — `docs/01_documento_mestre.md` §1.1.

O produto-âncora era o **"Escritório Virtual"**: uma interface visual (canvas isométrico) onde os agentes de IA aparecem como funcionários de uma empresa real, trabalhando 24/7. **Evidência:** commit inicial `80579b2` — o próprio título é *"Obra10+ - Escritorio Virtual + CRM + Supabase + Mobile"*; `app/office/page.tsx` (428 linhas) e `components/office/OfficeCanvas.tsx` (795 linhas) já existem no primeiro commit.

### 1.2 Público-alvo original
Empresas **pequenas e médias** dos setores de **construção, arquitetura e imobiliário** que não têm budget para uma equipe completa de marketing + atendimento + comercial e "contratam o Obra10+ e ganham instantaneamente uma equipe de IA". **Evidência:** `docs/01_documento_mestre.md` §1.2.

### 1.3 Atores previstos (6)
CEO humano único (Wendel) · Empresas clientes (multi-tenant) · Parceiros (imobiliárias/corretores) · Fornecedores (arquitetura, engenharia, empreiteiras, materiais…) · Operários (PF, só WhatsApp) · Clientes finais. **Evidência:** `docs/01_documento_mestre.md` §4.1.

### 1.4 Três pilares filosóficos (a "alma" original — permanecem intactos)
1. **Parâmetros pré-fixados** por agente (cargo/área/nível/modelo) → prompt cacheável, operação barata.
2. **IA observa, sugere, prepara — humano aprova** (Central de Aprovações; IA nunca executa dinheiro/contrato/irreversível sozinha).
3. **CEO Humano Único** — não existe agente com cargo de CEO; regra absoluta.

**Evidência:** `docs/01_documento_mestre.md` §1.3.

### 1.5 MVP original (a "Fase 1" com deadline 27/05/2026)
Meta escrita e datada: *"até 27 de Maio de 2026, ter a plataforma 100% funcional para parceiros e fornecedores"*, com 2 devs seniors. Cronograma em 6 fases (`docs/01_documento_mestre.md` §13):

- **Fase 0 (08–10/05):** saneamento — GitHub remote, deploy automático, backup, ligar `ANTHROPIC_API_KEY`, reativar HMAC, corrigir 3 ciclos com slug quebrado.
- **Fase 1 (10–13/05):** IA operacional — 8 ciclos rodando, leads respondidos < 30s, KPIs calculados, aprovações reais, mobile mínimo.
- **Fase 2 (13–17/05):** Parceiros — cadastro/homologação, login restrito, distribuição de leads, comissões.
- **Fase 3 (17–22/05):** Fornecedores — cadastro por área, cotação, workflow pedido→cotação→aprovação.
- **Fase 4 (22–25/05):** Multi-empresa básico — `tenant_id` em todas as tabelas `hub_*`, RLS, onboarding, 1 cliente piloto.
- **Fase 5 (25–27/05):** polimento, testes E2E, go-live.

Explicitamente **fora** do MVP (Fases 6–9, jun–ago+): check-in de operário por WhatsApp, pedido de material por voz, painel visual de obra, workflow imóvel→projeto→obra→produto, setores financeiro/compras/projetos, marketplace de parceiros. **Evidência:** `docs/01_documento_mestre.md` §13.3.

### 1.6 Fluxo de uso inicial
WhatsApp (cliente) → Evolution API (Railway) → webhook Next.js → identifica intenção/mercado → cria/acha lead → escolhe agente → monta prompt em 7 camadas → Anthropic Claude → grava observabilidade → responde via WhatsApp. **Evidência:** `docs/01_documento_mestre.md` §3.3–3.4; `app/api/whatsapp/webhook/route.ts` (presente desde os primeiros dias).

### 1.7 Arquitetura inicial
- **Stack:** Next.js 16 + React 19 + TypeScript + Tailwind 4 + Supabase (Postgres) + **Anthropic Claude** (Haiku/Sonnet/Opus) + **Evolution API** (WhatsApp) + Windsor.ai (marketing) + **Vercel** (app) + Railway (WhatsApp). **Evidência:** `docs/01_documento_mestre.md` §3.1.
- **Schema original (commit `80579b2`, `lib/supabase/migrations.sql`):** tabelas no schema `public` **sem prefixo e sem `tenant_id`**: `pessoas`, `campanhas`, `leads`, `negocios`, `oportunidades`, `parceiros`, `conversas`, `mensagens`, `agentes`, `decisoes`, `decision_logs`. **Evidência verificada:** `grep -c tenant_id` no schema original = **0** (multi-tenancy era visão futura, §8.1/§12, não implementada).
- **28 agentes IA** em 5 níveis hierárquicos + **8 ciclos** (cron/webhook). **Evidência:** `docs/01_documento_mestre.md` §5.

### 1.8 Prioridades declaradas (na ordem do dono)
IA operacional em prod (a IA nunca tinha respondido — faltava a API key) → Parceiros → Fornecedores → Multi-tenant → polimento. Segurança e "nunca DELETE / migrações reversíveis / não commitar secrets" eram **regras supremas** desde o dia 1. **Evidência:** `docs/01_documento_mestre.md` §13, §15.

---

## 2. Tabela — Itens da proposta inicial e status atual

| Item da proposta inicial | Descrição | Evidência | Status atual | Observação |
|---|---|---|---|---|
| Escritório Virtual (canvas de agentes) | Interface visual isométrica, agentes como funcionários | commit `80579b2`; `app/office/`, `components/office/OfficeCanvas.tsx` | **Mantido / vivo** | Continua sendo a assinatura visual; `/office` ainda existe |
| CRM (leads, atendimento, KPIs, parceiros) | Núcleo comercial | `app/crm/*` desde `80579b2` | **Muito ampliado** | De ~6 telas para **~40 sub-rotas** em `app/crm/` |
| Motor de IA (7 camadas, 28 agentes, 8 ciclos) | Prompt em camadas, agentes por cargo | `docs/01_documento_mestre.md` §3.4/§5; `lib/agent-prompts.ts` | **Mantido + evoluído** | Virou agent-builder + playbooks + RAG pgvector + copiloto de voz |
| Atendimento WhatsApp | Webhook recebe, IA responde | `app/api/whatsapp/webhook/` | **Mantido, provedor trocado** | Evolution API → **UAZAPI**; inbox IA+humano |
| LLM = Anthropic Claude | Haiku/Sonnet/Opus | `docs/01_documento_mestre.md` §3.1 | **Trocado** | Hoje **Mistral-first** (+ Groq fallback); Anthropic dormente (memória `agentes-ia-llm-anthropic`) |
| Hospedagem = Vercel | Deploy do app | `docs/01_documento_mestre.md` §2.3; `vercel.json` | **Trocado** | Migrou para **Render** (`render.yaml`; branch `feature/escritorio-visual`) |
| IA respondendo leads em prod | Item #1 do MVP | §5.4, §7.2 | **Ainda bloqueado** | Falta chave da LLM em prod (era `ANTHROPIC_API_KEY`, hoje `MISTRAL_API_KEY`) — **60 dias depois, o item #1 do MVP segue pendente** |
| Central de Aprovações | Humano aprova o crítico | §1.3, §8.4; `app/crm/aprovacoes/` | **Mantido, a unificar** | Existe tela; falta unificação cross-domínio (MACRO §Fase 4) |
| Multi-tenant (`tenant_id` em tudo + RLS) | Fase 4 do MVP | schema original sem `tenant_id`; migração `20260626130000_multitenant_foundation.sql` | **Parcial** | Fundação existe, mas **single-tenant de fato**; `current_user_tenant_id()` ainda estática (ANALISE-MESTRA §C) |
| Hub de Parceiros (imobiliárias/corretores) | Fase 2 do MVP | commit `186f9bd` "11 tabelas parceiros"; `app/crm/parceiros/` | **Feito, base** | CPF/CNPJ, homologação, código de rede |
| Fornecedores por área + cotação | Fase 3 do MVP | `app/crm/fornecedores/`; migração `hub_cotacoes` | **Parcial** | Cadastro sim; cotação automática ponta-a-ponta não |
| Distribuição de leads | Fase 2 do MVP | `app/crm/distribuicao/` | **Parcial** | Tela existe; motor persistido (`hub_lead_distribuicao`, score) não (ANALISE-MESTRA §C) |
| Financeiro (contas a pagar/receber) | Setor futuro (§9.1) | migração `hub_financeiro_tables`; `app/crm/financeiro/` | **Feito, base** | Antecipado da Fase 8 |
| Check-in operário por WhatsApp | Fase 6 (futuro) | §10.6 | **Não começado** | Design pronto (MACRO §Fase 5) |
| Pedido de material por voz / totem | Fase 6–7 (futuro) | §10.4 | **Não começado** | Vira "operação de campo tablet/totem" (visão) |
| Painel visual de obra | Fase 7 (futuro) | §8.3, §11.7 | **Não começado** | Design pronto (Portal do Cliente) |
| Workflow imóvel→projeto→obra→produto | Fase 7 (futuro) | §4.2 | **Construído em código, latente** | **Camada AEC** E0–E7/A0–A2 no repo, **migrações não aplicadas em prod** |
| Setores financeiro/compras/projetos/obras | Fase 8 (futuro) | §9 | **Parcial / latente** | Financeiro no ar; compras/obra codificados mas não aplicados |
| Backup automático + GitHub remote | Débitos 6/7 (Fase 0) | §2.7 | **Parcial** | Repo é de **outro dev (demitido)**; backup próprio pendente (memória `github-backup-proprio-lembrete`) |
| Segurança (HMAC, RLS, sem secrets) | Regras supremas | §15.8 | **Endereçado, ainda com dívida** | Auditoria de 25/jun–01/jul achou **4 críticos** (guards de papel, split de comissão); grande parte fechada no finale E2E |
| Monetização (assinatura + comissão) | Visão longo prazo | não no doc mestre original | **Não começado (nova visão)** | Entitlements/SaaS `hub_planos` **não existem** (ANALISE-MESTRA §D) |
| Créditos de IA / metering ("Tijolos") | **Não previsto no doc mestre** | migração `ia_metering`; `app/crm/creditos/` | **Novo — fase 1 no ar (sombra)** | 3ª perna de receita inventada depois |
| Estrutura Unificada (orçamento=cronograma=escopo) | **Não previsto no doc mestre** | `<ArvoreEscopo>`; migração `e7_item_escopo_unificado` | **Novo — design + código, latente** | Grande decisão estrutural de 29/jun |
| Portal do Cliente + "5 medos" | **Não previsto no doc mestre** | memória `portal-cliente-medos-cura`; `PORTAL-CLIENTE-DESIGN.md` | **Novo — design pronto** | Elevado a "alma do produto" depois |
| Marketplace / iFood da construção | Fase 9 mencionada de leve | memória `marketplace-rede-servicos-ifood` | **Novo/expandido — visão** | Moat preditivo; asset-light |

---

## 3. O que o sistema virou hoje

O Obra10+ deixou de ser "uma **agência de marketing com intermediação de parceiros** movida a IA" e virou a ambição de uma **plataforma multi-tenant tipo Hub para todo o ciclo AEC** (Arquitetura-Engenharia-Construção): um Hub distribui leads para empresas fornecedoras homologadas (tenants) que **vendem no CRM e executam a obra** dentro do mesmo sistema — com estrutura unificada (orçamento=cronograma=contrato=medição=escrow), Portal do Cliente que "cura 5 medos", central de aprovações e gestor de tarefas universais, três fontes de receita (assinatura SaaS + comissão transacional com split + créditos de IA "Tijolos") e, no horizonte, um marketplace preditivo da construção. O **núcleo comercial original** (CRM + Escritório Virtual + atendimento IA por WhatsApp) está **no ar e maduro (~90%)**, mas a **visão completa está em ~35–40%** (`docs/MACRO-PLAN-ATUALIZADO.md` §1).

Concretamente, em números: de **11 tabelas `public.*`** sem `tenant_id` no commit inicial para **97 migrações** e ~113+ tabelas `hub_*`; de **~6 telas CRM** para **~40 sub-rotas**; de **1 commit** para **672**; e uma stack repontuada (Anthropic→Mistral, Vercel→Render, Evolution→UAZAPI). Três das grandes camadas de hoje — **estrutura unificada, portal do cliente e monetização/créditos** — **nem existiam no documento mestre de 08/05**; nasceram de decisões amadurecidas em junho. E, revelador da direção: **o item #1 do próprio MVP (a IA respondendo leads em produção) segue bloqueado por falta de chave de API há ~60 dias**, enquanto uma camada AEC inteira foi construída em código à frente dela.

---

## 4. Comparativo — Proposta inicial vs. estado atual

| Área | Proposta inicial | Estado atual | Mudança | Impacto | Recomendação |
|---|---|---|---|---|---|
| **Posicionamento** | Agência de marketing/growth + intermediação de parceiros, por IA | Plataforma Hub multi-tenant do ciclo AEC completo (venda + execução de obra) | **aumentou-valor** (mas beira scope creep) | Alto — muda o produto, o TAM e a complexidade | Ancorar a visão grande num MVP monetizável estreito; não construir todas as verticais antes de 1 vender |
| **Núcleo CRM + Escritório Virtual** | Núcleo do produto | No ar, ~90%, ~40 telas | **melhorou** | Alto positivo — é o ativo real e vivo | Fechar a FASE 1 (eventos reais, dedup de formulário); higiene de dados |
| **Motor de IA / agentes** | 7 camadas, 28 agentes, 8 ciclos | Agent-builder + playbooks + RAG + copiloto de voz | **melhorou / aumentou-valor** | Alto — vira diferencial | Manter; **ligar em prod** (bloqueio de chave) antes de expandir |
| **LLM (Anthropic→Mistral)** | Claude Haiku/Sonnet/Opus | Mistral-first + Groq | **manteve-escopo** (troca de fornecedor) | Médio — custo/lock-in | OK pragmático; documentar custo por token (metering já ajuda) |
| **Infra (Vercel→Render, Evolution→UAZAPI)** | Vercel + Evolution/Railway | Render + UAZAPI | **manteve-escopo** | Baixo/médio | OK; garantir crons e backup próprios |
| **Multi-tenant** | `tenant_id` em tudo + RLS (Fase 4) | Fundação existe, single-tenant de fato; função de tenant estática | **manteve-escopo, incompleto** | **Crítico** — é go-live blocker | Priorizar a fundação real (`current_user_tenant_id()` dinâmica + `fornecedor_id` + ≥2 tenants) |
| **Segurança** | Regras supremas (HMAC/RLS/sem secrets) | 4 críticos achados (guards de papel, split, RLS `USING(true)`, secrets no browser) — em grande parte fechados | **manteve-escopo, dívida real** | **Crítico** | Confirmar cobertura total dos guards antes de usuários reais |
| **Parceiros / Fornecedores / Distribuição** | Fases 2–3 do MVP, ponta-a-ponta | Cadastro+homologação feitos; cotação e distribuição persistida parciais | **desviou-do-MVP (parcial)** | Médio — era o coração da entrega de 27/05 | Terminar o motor de distribuição e a cotação — é a promessa original ao parceiro/fornecedor |
| **Camada AEC (obra/projeto/escopo)** | Fases 7–8 (futuro explícito) | **Construída em código** (E0–E7/A0–A2), **não aplicada em prod** | **virou-escopo-futuro trazido para o presente** | Alto — grande esforço latente, sem valor entregue ainda | Não expandir; **aplicar só quando o núcleo+tenant+IA estiverem prontos** (MACRO Opção A) |
| **Estrutura Unificada** | Não existia | Design + código + `<ArvoreEscopo>`, latente | **aumentou-valor** (fundação honesta) mas **aumentou-complexidade** | Alto — é elegante e é a base do AEC | Boa aposta conceitual; risco de over-engineering antes de 1 obra real rodar |
| **Portal do Cliente + 5 medos** | Não existia | "Alma do produto", design pronto, 0 código | **aumentou-valor** | Alto potencial | Manter como norte; construir **depois** do AEC em prod |
| **Monetização (SaaS + comissão + créditos)** | Não no doc mestre | Créditos fase-1 (sombra); entitlements/SaaS inexistentes | **aumentou-valor / aumentou-complexidade** | Alto — é a receita | Definir 1 trilha de receita cobrável cedo (manual-first); não construir 3 antes de faturar 1 |
| **Marketplace / operação de campo** | Fase 9 (leve) | Visão detalhada, 0 código | **virou-escopo-futuro** | Longo prazo | Deixar explicitamente parqueado; não desviar foco |
| **Prazo de entrega** | 27/05/2026, plataforma "100% funcional p/ parceiros e fornecedores" | 01/07 — núcleo 90%, visão 35–40%, item #1 do MVP ainda bloqueado | **desviou-do-MVP** | Alto — sinal de direção | Redefinir um "Definition of Done" curto e datado (ligar IA + fechar núcleo + 1 tenant piloto) |

---

## 5. Veredito — O projeto ainda está no caminho certo?

### **PARCIALMENTE.**

**A tese e a alma continuam intactas** (isso é o mais importante): o Escritório Virtual, o motor de IA em camadas, o "IA prepara / humano aprova", o CEO humano único e o foco em construção/arquitetura/imobiliário estão **preservados e, no núcleo comercial, melhores do que a proposta original** (de ~6 telas para ~40, agent-builder, RAG, copiloto de voz). Nesse recorte, o crescimento foi **saudável**: aditivo, com gates, mesa-redonda de UX, migrações reversíveis. O núcleo está a ~90% e é um ativo real.

**Mas a direção deu sinais claros de scope creep de visão, não (ainda) de scope creep de execução destrutiva.** Três evidências:

1. **O item #1 do próprio MVP — a IA respondendo leads em produção — segue bloqueado há ~60 dias** por falta de uma chave de API (antes `ANTHROPIC_API_KEY`, hoje `MISTRAL_API_KEY`). Era literalmente a Tarefa 5 da Fase 0, estimada em "5 min". Que ele ainda não esteja resolvido enquanto **uma camada AEC inteira foi construída à frente** é o sintoma mais forte de desvio de prioridade. (`docs/01_documento_mestre.md` §7.2; `MACRO-PLAN` §Fase 0)

2. **O prazo do MVP (27/05, "100% funcional para parceiros e fornecedores") passou** e as entregas que eram o *coração* dele — distribuição de leads persistida e cotação automática ponta-a-ponta — continuam **parciais**, enquanto se avançou em camadas que o próprio dono havia colocado como Fases 7–8 (obra, escopo unificado).

3. **Três das maiores camadas de hoje não existiam na proposta original** (estrutura unificada, portal do cliente, monetização em 3 pernas). São **boas ideias** e **aumentam valor** — mas foram amadurecidas como design e, no caso do AEC, **construídas em código antes** de o núcleo estar fechado e antes de a fundação multi-tenant existir de verdade. Muito esforço virou **valor latente** (migrações não aplicadas), não valor entregue.

### O crescimento foi saudável ou descontrolado?
**Meio a meio, com um freio importante que salvou o projeto:** a disciplina de "**aditivo e reversível, migrações latentes, nada quebra**" fez com que o scope creep de visão **não corrompesse o que funciona**. O AEC construído à frente não derrubou o núcleo porque foi feito file-only. Isso é maturidade de engenharia. O problema não é a qualidade — é a **sequência de valor**: construiu-se profundidade (AEC, estrutura unificada) antes de fechar a largura mínima vendável (IA ligada + distribuição/cotação + 1 tenant real pagando).

### Mudanças positivas (manter)
- Núcleo CRM + Escritório Virtual expandido e polido (**melhorou**).
- Motor de IA (builder/playbooks/RAG/copiloto) (**aumentou-valor**).
- Disciplina aditiva/reversível e as auditorias adversariais de segurança (**salvaram o projeto de dívida irreversível**).
- Estrutura unificada e Portal do Cliente como **norte conceitual** (**aumentou-valor**) — desde que construídos no momento certo.

### Mudanças que aumentaram complexidade sem retorno claro (revisar timing)
- **Camada AEC inteira em código, não aplicada** — grande esforço sem valor entregue; risco de apodrecer/drift se ficar latente por muito tempo.
- **Três pernas de monetização** desenhadas antes de **uma** cobrar de verdade.
- **Marketplace/operação de campo** ocupando espaço mental enquanto o item #1 do MVP não roda.

### Recomendação de direção (1 linha)
Seguir a **Opção A do MACRO-PLAN**: uma janela curta de produção para **ligar a IA, aplicar as migrações e re-testar login**, e em paralelo fechar a **FASE 1 do núcleo** (eventos reais + dedup de formulário) — ou seja, **converter o valor latente já construído em valor entregue e faturável antes de abrir qualquer nova frente** (portal, marketplace, obra conversacional plena). O caminho volta a ser "certo" no dia em que **um parceiro/fornecedor real usar o núcleo com a IA ligada** — que é, ironicamente, exatamente o que a proposta de 08/05 pedia para 27/05.

---

*Documento de auditoria de direção. Read-only sobre o código; baseado em evidência de commit/arquivo/migração/tabela. Onde a evidência foi insuficiente, o item foi marcado no texto.*
