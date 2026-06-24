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
| **1.5** | **Auditoria de informação (menu ↔ tela)** | cada item no grupo certo; **Cadastros unificado PF/PJ**; resolver colisões de nome (2 "Empresas"); alinhar o conteúdo das telas ao menu | B1 | não | médio |
| **2** | **Cadastros Pipedrive (U2)** | `SmartField` + `ConfidenceBadge` + `QuickAdd`; fichas correlacionadas Pessoa↔Empresa↔Negócio; entidade **Imóvel**; replica o padrão da ficha do negócio | B1 | não | médio |
| **3** | **CRM do Fornecedor (U3)** | pipelines/Kanban **customizáveis por tenant**; inbox unificado + respostas sugeridas; cartão com SLA | B2 | não | médio |
| **4** | **Visibilidade & Governança Hub** | regra de visibilidade RLS (`fornecedor_id`; Hub bypassa, §5 spec); **Dashboard do Hub** (cards acionáveis); base da camada Fornecedores | B3 | não | **alto** (RLS) |
| **5** | **Motor de Distribuição (U4)** | score multi-critério; modos auto/semi/manual; SLA + redistribuição; Lead Mestre×Vinculado; fila + `RecommendationCard` | B4 | não | alto |
| **5.5** | **Monetização da rede** | **Licenciamento/Entitlements** (módulo · plano · créditos/tokens; Hub libera) + **Comissão marketplace** (b: % sobre ganho originado de lead do Hub) + **funil 2 níveis · KPIs · SLA** | B4, B5 | não | alto |
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

### Bloco 1.5 — Auditoria de informação (coerência menu ↔ tela)
Varredura item a item: cada destino no grupo semanticamente certo, **e a tela correspondente coerente** com o que o menu promete (rótulo, conteúdo, permissão). Itens já decididos:
- **Integrações → IA e Agentes** ✅ (feito) — API-first liga IA/automações a sistemas externos.
- **Onboarding (tenant) fora do menu** ✅ (feito) — `/crm/onboarding-tenant` é tela solta de setup; rota acessível por URL (owner). O onboarding do **membro** vem do sistema Membros (Bloco 7).
- **Cadastros unificado PF/PJ** — uma entrada "Cadastros" em Comercial/CRM cobrindo **Pessoa Física** (`hub_pessoas`) e **Pessoa Jurídica / empresa-cliente** (`hub_empresas`), navegáveis e correlacionadas. (Sobrepõe-se ao Bloco 2; aqui define a IA do menu, lá os componentes.)
- **Colisão "Empresas"** ⚠️ — `/crm/empresas` hoje é **admin multi-tenant** (`/api/crm/tenants`, escritórios/tenants), **não** o cadastro de empresa-cliente. **Recomendação:** renomear esse item para **"Escritórios"** e mantê-lo em Administração; o cadastro PJ do cliente vive em Cadastros (acima). *Confirmar com o Wendel.*
- **Varredura dos demais** itens/telas (Tarefas, Canais, Pedidos, Relatórios, etc.): confirmar grupo, rótulo e que a tela entrega o prometido.

### Bloco 2 — Cadastros Pipedrive (U2)
Componentes-base sobre o design system (`SmartField`, `ConfidenceBadge`, `QuickAdd`); fichas correlacionadas navegáveis em 1 clique; entidade **Imóvel**; replicar o padrão da ficha do negócio (próxima-ação/nota/vínculo). Preenchimento por **escolha (chips)** primeiro; voz incremental.

### Bloco 3 — CRM do Fornecedor (U3)
Pipelines/Kanban editáveis por tenant; inbox omnichannel unificado com respostas sugeridas; cartões com selo de SLA.

### Bloco 4 — Visibilidade & Governança do Hub
Regra de visibilidade (spec §5): fornecedor vê só o seu (`fornecedor_id`); Hub faz bypass. **Migração de RLS aditiva e revisada** (risco alto — aprovação humana). Dashboard do Hub com **cards acionáveis** (UX §5): leads a direcionar, SLA estourando, ranking, funil, obras em risco, financeiro.

### Bloco 5 — Motor de Distribuição (U4)
Score multi-critério; modos automático/semiautomático/manual; SLA com redistribuição; modelo Lead Mestre×Vinculado; fila com `RecommendationCard` (top-3 fornecedores).

### Bloco 5.5 — Monetização da rede (licenciamento + comissão + performance)
Camada de negócio sobre a base. **O Hub libera tudo.** Três frentes:

**1. Licenciamento / Entitlements** (confirmado, catálogo fechado):
- 3 eixos: **por módulo** (liga/desliga) · **por plano/pacote** (bundles) · **por créditos/tokens** (consumo).
- Módulos cobráveis: CRM · Atendimento (WhatsApp) · Projetos · Obras · Serviços · Compras · Financeiro · Marketing · IA/Copiloto · Integrações (+ Produtos, futuro). Base (não cobrada): Cadastros+códigos, Dashboard, Usuários/RBAC, Administração.
- Créditos/tokens: **IA tokens**, **mensagens WhatsApp**, (futuro) armazenamento de evidências, assinaturas.
- Dados (aditivo): `hub_planos`, `hub_tenant_modulos` (tenant+modulo+ativo+plano+validade → **disclosure por plano** no menu + **guard de rota** por módulo), `hub_tenant_creditos` (saldo+ledger). **Amarrar tenant ↔ cadastro PJ** (escritório = empresa-cadastro).

**2. Comissão marketplace** (decisão: **opção b**):
- O Hub fica com **% sobre o negócio ganho originado de lead do Hub**. Exige **cadeia de atribuição**: lead Mestre → distribuição → negócio → ganho (origem rastreável; lead não-Hub não gera comissão).
- Dados: `hub_comissoes` (negocio_id, lead_mestre_id, tenant, base_cálculo, %, valor, competência, status) → vira **conta a receber do Hub** (Financeiro do Hub).
- **[Decisões em aberto]** % fixo ou por mercado/plano; base = valor do negócio ou do contrato de obra; cobra no **ganho** ou conforme **medição/recebimento**.

**3. Funil + KPIs + SLA (em 2 níveis)** — "esteira de venda" da rede:
- **Funil do escritório (tenant):** Lead → Qualificado → Negócio → Proposta → Ganho/Perdido; conversão por etapa, ticket médio, taxa de ganho, motivo de perda. *(vive no CRM do fornecedor — B3)*
- **Funil do Hub (rede):** Captado → Distribuído → 1º contato → Negócio → Ganho, por mercado/escritório/canal; onde trava, ranking, leads ociosos. *(Governança — B4, cards do dashboard §5)*
- **KPIs** (mesmas fontes, agregação dupla): tempo de 1º contato, % no SLA, conversão, ticket médio, receita, **comissão gerada**, leads sem resposta, redistribuições.
- **SLA (engine — B5):** relógio por lead distribuído; marcos configuráveis (1º contato 15min · status 24h · proposta 48h); estado ok/atenção/estourado; estouro → alerta + volta à fila + perde score + redistribui.

> Faseamento: licenciamento e comissão **manuais** primeiro (Hub liga módulo e lança comissão na mão), automação (billing, cálculo automático) depois. KPIs/SLA nascem dos dados que B3–B5 já produzem.

### Bloco 6 — Gestão de Obra (U5)
Wizard de obra (5 passos, click/talk); Escopo/EAP (prev×exec×saldo, aditivos); Cronograma+Curva S; Avanço & Medição com gates e `EvidenceCapture`. Conecta ao botão "Gerar obra" (Bloco G) já existente. **Compras pendente de detalhamento.**

### Bloco 7 — Ponte Membros
Gate de elegibilidade + migração idempotente de membro→fornecedor (sem duplicar). Depende do contrato de integração (em aberto).

**Menu (decidido com o Wendel):** o grupo **Comunidade** entra no menu principal com a hierarquia **Comunidade > Homologação > Onboarding**. Essas telas **vêm do sistema Membros** (separado) — o Wendel vai importá-las; não se constroem aqui do zero. Por isso o grupo está **reservado (sem itens)** no menu até a importação (evita 404 / "menu morto"). ⚠️ Não confundir com `/crm/onboarding-tenant`, que é uma **tela solta de setup do tenant** (admin) e fica em Administração.

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
