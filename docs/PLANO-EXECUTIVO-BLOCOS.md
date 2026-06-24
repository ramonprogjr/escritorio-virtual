# Plano Executivo em Blocos — Plataforma Obra10+

> **O que é.** O roteiro de execução da plataforma, organizado em **blocos sequenciais**. Cada bloco é um incremento **seguro, fechável e que melhora o que já existe** — sem big-bang, sem reescrita. Consolida os dois eixos de planejamento já aprovados:
> - **Backend/arquitetura:** Fases 0–6 da [`INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md`](INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md) §10.
> - **Interface (UI/UX):** Ondas U1–U6 da [`UIUX-AUDITORIA-E-PLANO.md`](UIUX-AUDITORIA-E-PLANO.md) §8.
>
> **Status:** v1 — 2026-06-24. Branch `wendel/dev`. **Tudo local — nada pushado/deployado.**

---

## Regra de ouro (vale para TODOS os blocos)

1. **Preservar · melhorar · construir** (§14.1 da spec): o que já funciona, mantém e melhora — **não reescreve**. Só se constrói do zero o que não existe.
2. **Toda mudança é aditiva** e **não quebra comportamento existente**.
3. **Gate de fechamento de bloco:** `tsc` + `vitest` (testes) + `_chk23` (smoke do app no ar).
4. **Travas:** mexer só no projeto `-ramon`; **sem push** sem ordem; **sem secrets** no Git/banco; migrações **aditivas e reversíveis**.
5. **Aprovação humana** para: exclusão de dados, mudança irreversível, custo financeiro, credenciais, produção.
6. **Manual-first:** a IA (Bloco 8) só liga depois que o manual estiver bom.

---

## Mapa dos blocos

| Bloco | Objetivo | Entregas-chave | Depende de | IA? | Risco |
|---|---|---|---|---|---|
| **0 ✅ feito** | Base manual sólida | CRM, cadastros, negócio flexível, roteamento, canais, ficha do negócio, fixes login/drift | — | não | — |
| **1** | **Navegação da plataforma (U1)** | Menu lateral reagrupado no modelo §8 (**só rotas que existem**) + disclosure por papel/plano + **CommandBar** (atalho; voz depois) | design system (existe) | não | baixo |
| **2** | **Cadastros Pipedrive (U2)** | `SmartField` + `ConfidenceBadge` + `QuickAdd`; fichas correlacionadas Pessoa↔Empresa↔Negócio; entidade **Imóvel**; replica o padrão da ficha do negócio | B1 | não | médio |
| **3** | **CRM do Fornecedor (U3)** | pipelines/Kanban **customizáveis por tenant**; inbox unificado + respostas sugeridas; cartão com SLA | B2 | não | médio |
| **4** | **Visibilidade & Governança Hub** | regra de visibilidade RLS (`fornecedor_id`; Hub bypassa, §5 spec); **Dashboard do Hub** (cards acionáveis); base da camada Fornecedores | B3 | não | **alto** (RLS) |
| **5** | **Motor de Distribuição (U4)** | score multi-critério; modos auto/semi/manual; SLA + redistribuição; Lead Mestre×Vinculado; fila + `RecommendationCard` | B4 | não | alto |
| **6** | **Gestão de Obra (U5)** | Wizard 5 passos (click/talk); EAP/escopo prev×exec×saldo; cronograma+Curva S; medição+gates; `EvidenceCapture`; Compras¹ | B2 (Bloco G existe) | não | alto |
| **7** | **Ponte Membros** | gate de elegibilidade + migração idempotente Membros→fornecedor | contrato² | não | médio |
| **8 — [FUTURO]** | **IA-first (U6)** | ativar Anthropic/Bloco H; operacional + conversacional; relatórios generativos; Talk-and-Go pleno | chave + GO custo | **sim** | — |

¹ Módulo **Compras** ainda não detalhado pelo cliente (spec §15.1). ² Contrato Membros→fornecedor em aberto (spec §15.2).

---

## Detalhe por bloco

### Bloco 1 — Navegação da plataforma (U1) `[em execução]`
**Entrega:** reagrupar o menu lateral no modelo §8 usando **apenas rotas existentes** (zero "menu morto"); grupos sem tela (Central IA, Comunidade) ficam de fora até existirem. Depois: **CommandBar** (atalho de teclado; voz incremental).

Árvore-alvo (todas as rotas já existem):
```
Visão Geral        Dashboard · Analytics · Relatórios
Aprovações         Aprovações                                  (Pilar 2 — destaque)
Comercial / CRM    Leads · Negócios · Cadastros · Atendimento · Canais · Tarefas
Operações / Obras  Projetos · Obras · Pedidos
Fornecedores       Parceiros · Fornecedores · Especialistas · Distribuição
Financeiro         A receber · A pagar · Visão financeira
Marketing          Campanhas · Canais de entrada
IA e Agentes       Agentes IA · Automações · Ferramentas · Copiloto (Em breve)
Administração      Configurações · Integrações · Contatos notif. · Usuários · Empresas · Onboarding
```
**Preserva:** `minRole` por item e o teste `crm-nav-permissoes.test.ts` (comercial sem Financeiro; atendente com Inbox/Leads; `progresso-sistema` fora do menu).

### Bloco 2 — Cadastros Pipedrive (U2)
Componentes-base sobre o design system (`SmartField`, `ConfidenceBadge`, `QuickAdd`); fichas correlacionadas navegáveis em 1 clique; entidade **Imóvel**; replicar o padrão da ficha do negócio (próxima-ação/nota/vínculo). Preenchimento por **escolha (chips)** primeiro; voz incremental.

### Bloco 3 — CRM do Fornecedor (U3)
Pipelines/Kanban editáveis por tenant; inbox omnichannel unificado com respostas sugeridas; cartões com selo de SLA.

### Bloco 4 — Visibilidade & Governança do Hub
Regra de visibilidade (spec §5): fornecedor vê só o seu (`fornecedor_id`); Hub faz bypass. **Migração de RLS aditiva e revisada** (risco alto — aprovação humana). Dashboard do Hub com **cards acionáveis** (UX §5): leads a direcionar, SLA estourando, ranking, funil, obras em risco, financeiro.

### Bloco 5 — Motor de Distribuição (U4)
Score multi-critério; modos automático/semiautomático/manual; SLA com redistribuição; modelo Lead Mestre×Vinculado; fila com `RecommendationCard` (top-3 fornecedores).

### Bloco 6 — Gestão de Obra (U5)
Wizard de obra (5 passos, click/talk); Escopo/EAP (prev×exec×saldo, aditivos); Cronograma+Curva S; Avanço & Medição com gates e `EvidenceCapture`. Conecta ao botão "Gerar obra" (Bloco G) já existente. **Compras pendente de detalhamento.**

### Bloco 7 — Ponte Membros
Gate de elegibilidade + migração idempotente de membro→fornecedor (sem duplicar). Depende do contrato de integração (em aberto).

### Bloco 8 — IA-first (U6) `[FUTURO]`
Ativar Anthropic/Bloco H (depende de chave + GO de custo): IA operacional + conversacional + relatórios generativos; Talk-and-Go pleno. **Não ligar antes do manual estar bom.**

---

## Decisões suas que destravam blocos futuros (não bloqueiam o Bloco 1)
- **Voz** on-device vs. serviço — custo/privacidade (B2/B8).
- **Faixas vs. valor exato** nos campos financeiros do comercial (B2).
- **Densidade do dashboard** do Hub — sugestão: começar com 5 cards (B4).
- **Pesos do score** por mercado (B5).
- **Compras** — fluxo/campos (B6). **Contrato Membros→fornecedor** (B7).

Cada uma é resolvida **quando o bloco chegar** — não seguramos o avanço por causa delas.
