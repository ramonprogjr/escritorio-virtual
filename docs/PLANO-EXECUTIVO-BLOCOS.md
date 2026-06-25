# Plano Executivo em Blocos — Plataforma Obra10+

> 📑 **Índice de todos os documentos: [INDICE.md](INDICE.md)** (ponto de entrada único).

> **O que é.** O roteiro de execução da plataforma, organizado em **blocos sequenciais**. Cada bloco é um incremento **seguro, fechável e que melhora o que já existe** — sem big-bang, sem reescrita. Consolida os dois eixos de planejamento já aprovados:
> - **Backend/arquitetura:** Fases 0–6 da [`INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md`](INSTRUCAO-DEVS-PLATAFORMA-OBRA10.md) §10.
> - **Interface (UI/UX):** Ondas U1–U6 da [`UIUX-AUDITORIA-E-PLANO.md`](UIUX-AUDITORIA-E-PLANO.md) §8.
>
> **Status:** v1 — 2026-06-24. Branch `wendel/dev`. **Tudo local — nada pushado/deployado.**
>
> **Backlog de features de produto** (check-in obra, compras totem/iFood com spread, voz→materiais, notificações, comunidade feed, diário de obra auto): [BACKLOG-FEATURES.md](BACKLOG-FEATURES.md).

---

## Regra de ouro (vale para TODOS os blocos)

1. **Preservar · melhorar · construir** (§14.1 da spec): o que já funciona, mantém e melhora — **não reescreve**. Só se constrói do zero o que não existe.
2. **Toda mudança é aditiva** e **não quebra comportamento existente**.
3. **Gate de fechamento de bloco:** `tsc` + `vitest` (testes) + `_chk23` (smoke do app no ar).
4. **Travas:** mexer só no projeto `-ramon`; **sem push** sem ordem; **sem secrets** no Git/banco; migrações **aditivas e reversíveis**.
5. **Aprovação humana** para: exclusão de dados, mudança irreversível, custo financeiro, credenciais, produção.
6. **Manual-first:** a IA (Bloco 8) só liga depois que o manual estiver bom.
7. **Telas para o JOB, não tabelas** (mandato CEO de produto, 25/jun — memória `ceo-mandato-produto`): toda tela de trabalho é desenhada para a necessidade do negócio — **cards acionáveis, triagem por urgência, conversa/IA-first, Click-and-Go (≤3 toques)**. **Tabela/planilha vive só em Relatórios** (o dono puxa o dump/CSV quando quer). Cada tela passa por **mesa redonda de UI/UX** (ux-director + ui-ux-pro-max + frontend-design). Revolução **ousada, mas aditiva e validada**: o Code **lidera e propõe** como deve ser; o dono traz mercado/processo/dores. Preserva a **lógica que já está certa** — muda a superfície, não o motor.

---

## Mapa dos blocos

| Bloco | Objetivo | Entregas-chave | Depende de | IA? | Risco |
|---|---|---|---|---|---|
| **0 ✅ feito** | Base manual sólida | CRM, cadastros, negócio flexível, roteamento, canais, ficha do negócio, fixes login/drift | — | não | — |
| **1** | **Navegação da plataforma (U1)** | Menu lateral reagrupado no modelo §8 (**só rotas que existem**) + disclosure por papel/plano + **CommandBar** (atalho; voz depois) | design system (existe) | não | baixo |
| **1.5** | **Auditoria de informação (menu ↔ tela)** | cada item no grupo certo; **Cadastros unificado PF/PJ**; resolver colisões de nome (2 "Empresas"); alinhar o conteúdo das telas ao menu | B1 | não | médio |
| **2** | **Cadastros Pipedrive (U2)** | `SmartField` + `ConfidenceBadge` + `QuickAdd`; fichas correlacionadas Pessoa↔Empresa↔Negócio; entidade **Imóvel**; replica o padrão da ficha do negócio | B1 | não | médio |
| **3** | **CRM do Fornecedor (U3)** | pipelines/Kanban **customizáveis por tenant**; inbox unificado + respostas sugeridas; cartão com SLA | B2 | não | médio |
| **3.9** | **Fundação Multi-Tenant** `[pré-req B4/B5]` | `current_user_tenant_id()` dinâmica · `is_hub_owner()` · modelo `fornecedor_id` · provisionar ≥2 tenants | B3 | não | **alto** (auth/RLS) |
| **4** | **Visibilidade & Governança Hub** | regra de visibilidade RLS (`fornecedor_id`; Hub bypassa, §5 spec); **Dashboard do Hub** (cards acionáveis); base da camada Fornecedores | **B3.9** | não | **alto** (RLS) |
| **5** | **Motor de Distribuição (U4)** | score multi-critério; modos auto/semi/manual; SLA + redistribuição; Lead Mestre×Vinculado; fila + `RecommendationCard` | B4 | não | alto |
| **5.5** | **Monetização da rede** | **Licenciamento/Entitlements** (módulo · plano · créditos/tokens; Hub libera) + **Comissão marketplace** (b: % sobre ganho originado de lead do Hub) + **funil 2 níveis · KPIs · SLA** | B4, B5 | não | alto |
| **6** | **Gestão de Obra (U5)** | Wizard 5 passos (click/talk); EAP/escopo prev×exec×saldo; cronograma+Curva S; medição+gates; `EvidenceCapture`; Compras¹ | B2 (Bloco G existe) | não | alto |
| **7** | **Ponte Membros** | gate de elegibilidade + migração idempotente Membros→fornecedor | contrato² | não | médio |
| **8 — [FUTURO]** | **IA-first (U6)** | ativar Anthropic/Bloco H; operacional + conversacional; relatórios generativos; Talk-and-Go pleno | chave + GO custo | **sim** | — |

¹ Módulo **Compras** ainda não detalhado pelo cliente (spec §15.1). ² Contrato Membros→fornecedor em aberto (spec §15.2).

---

## Onda UX-R — Revolução de telas (transversal, regra de ouro #7)

Faixa **cross-cutting** que reveste as telas existentes (B2/B3) com a linguagem "tela para o JOB, não tabela" — **sem tocar na lógica/dados** (que já estão certos). Roda em paralelo aos blocos, tela a tela, com mesa redonda + ui-ux-pro-max, gates e verificação no navegador. Identidade Obra10+ (dark verde+dourado).

| Tela | De → Para | Status |
|---|---|---|
| **Lead "Novo"** | formulário longo → 3 toques (Nome+Telefone; resto em "Mais opções") | ✅ `b95b1d7` |
| **Cadastro PF/PJ** | selects → chips; Localização colapsável (auto-CNPJ/CEP) | ✅ `b95b1d7` |
| **Atendimento (inbox)** | já bom (IA-first) → origem com rótulo | ✅ `4af3310` |
| **Negócios (drawer)** | checklist "falso erro" → opcional; **4 selects → combobox de busca** | ✅ `6f40280`, `19dbe9a` |
| **Leads (tela de trabalho)** ⭐ | **tabela/listão → "Caixa de Oportunidades"** (faixas Agora/Hoje/Aguardando, cards acionáveis, frescor/SLA, resumo IA, barra conversacional) | em curso (fatias) |
| **Cadastros (tela de trabalho)** | colunas → busca + **Ficha 360** (timeline, vínculos, negócios) | ⏳ próxima |
| **Relatórios / Analytics** | tabela atual ruim → **só higiene mínima agora** (tirar ruído/dados de teste/colunas que estouram). **NÃO redesenhar a fundo** | ⏳ (mínimo) |

**Anatomia do card (padrão da Onda):** nome · canal (rótulo) · frescor/SLA · score · resumo IA (1 linha) · 2–3 ações diretas (Responder/Atender · Qualificar · Virar negócio). Sem ruído (R$ 0,00, "—", dados de teste, valores crus, jargão/nome de tabela).

**Dependências:** "resumo IA" e barra conversacional plena amadurecem com o **Bloco 8 (IA)**; até lá, usar última mensagem/heurística. A **distribuição/visibilidade Hub** segue em B4/B5 (multi-tenant real B3.9).

**End-state de Relatórios/Analytics (decisão do dono, 25/jun):** o futuro é **BI generativo** — a IA **gera o relatório, a tela e os dados sob demanda, em tempo real**, conforme o pedido do cliente em linguagem natural (parte do **Bloco 8**, "relatórios generativos / Talk-and-Go"). Por isso a tela estática de Relatórios **tem dias contados**: agora só **higiene mínima**, nada de redesenho profundo. Toda métrica/evento que alimenta isso está no blueprint [CENTRAL-PERFORMANCE-METRICAS.md](CENTRAL-PERFORMANCE-METRICAS.md) (camada de eventos F4 = fundação).

---

## Detalhe por bloco

### Bloco 1 — Navegação da plataforma (U1) `[✅ FEITO]`
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

**Resultado da auditoria (24/jun/2026) — Bloco 1.5 essencialmente FECHADO:**
- ✅ Integrações → IA e Agentes; Onboarding fora do menu; **Empresas → "Escritórios"** (menu + tela) — desfeita a confusão com cadastro PJ.
- ✅ **31/31 itens do menu apontam para telas REAIS; zero mismatch.** Único stub: Copiloto (`/crm/agentes-reais`), já marcado "Em breve".
- ✅ **Cadastros unificado PF/PJ JÁ EXISTE** (não refazer): `/crm/cadastro` é hub com abas **Contatos (PF/PJ, `hub_pessoas`)** + **Empresas-cliente (PJ, `hub_empresas`)**, com `CadastroWizard` (`tipoInicial` PF/PJ) e hooks `useCrmPessoasList`/`useCrmEmpresasList`. → o esforço do B2 vira **enriquecer** (SmartField, ConfidenceBadge, fichas correlacionadas, Imóvel), não construir do zero.

### Bloco 2 — Cadastros Pipedrive (U2)
Componentes-base sobre o design system (`SmartField`, `ConfidenceBadge`, `QuickAdd`); fichas correlacionadas navegáveis em 1 clique; entidade **Imóvel**; replicar o padrão da ficha do negócio (próxima-ação/nota/vínculo). Preenchimento por **escolha (chips)** primeiro; voz incremental.

**Realidade no código (auditado 24/jun) — grande parte JÁ EXISTE:** em `components/crm/cadastro/` já há `CadastroWizard`, `CadastroFichaTabs`, **`CadastroFichaRelacionados`** (fichas correlacionadas), **`CadastroVinculosPessoaEmpresa`** (vínculo PF↔PJ), sideovers premium, lista/filtros/colunas; e `ImovelFormDrawer`, `NegocioFormDrawer`, `PessoaFormModal`, `EmpresaFormDrawer`. → **O net-new do B2 é só a camada de input "Click/Talk-and-Go":** `SmartField` (chip+voz+texto), `ConfidenceBadge`, `QuickAdd` (FAB). Resto é polimento sobre o que existe.
- **Gating:** o valor pleno do SmartField/ConfidenceBadge vem com (a) a decisão de UX **faixas vs valor exato** e (b) a **voz** (on-device vs serviço — custo/privacidade, decisão do Wendel); o pré-preenchimento por IA com confiança é Bloco 8. Até lá, Click-and-Go (chips/faixas) carrega.

**Progresso (24/jun) — U2 net-new entregue (local):**
- ✅ **QuickAdd (FAB)** global e role-aware (`components/crm/CrmQuickAdd.tsx`): "+" flutuante cria Lead/Negócio/Pessoa/Empresa por deep-link nos criadores existentes (`?novo=1` em leads/negócios, `?novo=pf|pj` em cadastro). Não duplica formulário.
- ✅ **Primitivos** `ConfidenceBadge` + `SmartField` (+ `smartfield-faixas.ts` puro, testado): chips/faixa/texto, microfone como STUB.
- ✅ **SmartField v2** (mesa redonda UX): radiogroup + navegação por setas, toque ≥40px, foco visível, hover, `disabled`, voz vira selo "em breve". Aceita opções `readonly`.
- ✅ **Rollout Click-and-Go** nos criadores (mesa redonda mapeou 12 selects seguros): **Lead** (Origem, Tipo de interesse, campos dinâmicos), **Negócio** (Mercado, Etapa), **Empresa** (Mercado, Segmento), **Imóvel** (Tipo, Finalidade). "Área de atuação" (12 opções) fica dropdown (lista longa). Edit-mode sideovers (CadastroEmpresaSideover Mercado/Segmento) = follow-up menor.
- ✅ **Revisão técnica (mesa redonda):** paridade de valor OK, efeitos colaterais preservados, a11y sólida, deep-links sem loop. Achou e **corrigimos** 1 bug latente exposto pelos chips: default de etapa do negócio `"novo_negocio"`→`"novo"` (era inválido).
- ⏳ Pendente: **validação visual** (desktop+mobile) das 4 telas; uniformizar `disabled` durante save (opcional); voz no fim.
- ⏸ **Pendente (gated, decisão do Wendel):** integrar SmartField nos forms (após decidir **faixas vs valor exato**) e ligar a **voz** (on-device vs serviço — custo/privacidade). Integração em forms críticos deve ser feita com o Wendel presente.

### Bloco 3 — CRM do Fornecedor (U3)
Pipelines/Kanban editáveis por tenant; inbox omnichannel unificado com respostas sugeridas; cartões com selo de SLA.

### Bloco 4 — Visibilidade & Governança do Hub
Regra de visibilidade (spec §5): fornecedor vê só o seu (`fornecedor_id`); Hub faz bypass. **Migração de RLS aditiva e revisada** (risco alto — aprovação humana). Dashboard do Hub com **cards acionáveis** (UX §5): leads a direcionar, SLA estourando, ranking, funil, obras em risco, financeiro.

### Bloco 5 — Motor de Distribuição (U4)
Score multi-critério; modos automático/semiautomático/manual; SLA com redistribuição; modelo Lead Mestre×Vinculado; fila com `RecommendationCard` (top-3 fornecedores).

### Bloco 5.5 — Monetização da rede (licenciamento + comissão + performance)
Camada de negócio sobre a base. **O Hub libera tudo.** Três frentes:

**1. Assinatura SaaS / Entitlements** (cobrança recorrente tenant→Hub — **NÃO é comissão, não tem rateio**):
- Eixos de cobrança: **mensalidade** + **por usuário (seat)** + **por módulo** (liga/desliga) + **por plano/pacote** (bundles) + **créditos/tokens** (algumas features de consumo).
- Módulos cobráveis: CRM · Atendimento (WhatsApp) · Projetos · Obras · Serviços · Compras · Financeiro · Marketing · IA/Copiloto · Integrações (+ Produtos, futuro). Base (não cobrada): Cadastros+códigos, Dashboard, Usuários/RBAC, Administração.
- Créditos/tokens: **IA tokens**, **mensagens WhatsApp**, (futuro) armazenamento de evidências, assinaturas digitais.
- Dados (aditivo): `hub_planos`, `hub_tenant_assinatura` (mensalidade + nº seats + plano + validade), `hub_tenant_modulos` (tenant+modulo+ativo → **disclosure por plano** no menu + **guard de rota** por módulo), `hub_tenant_creditos` (saldo+ledger por tipo). **Amarrar tenant ↔ cadastro PJ** (escritório = empresa-cadastro).

**2. Comissionamento multi-fonte com RATEIO (split)** — a monetização **transacional** (≠ assinatura SaaS, que NÃO entra aqui):
- **Fontes de receita** (todas passam pelo mesmo motor de rateio): comissão de **venda de imóvel/serviço/produto** · **aluguel de equipamentos** (marketplace % *e* locação própria) · **treinamentos** (venda direta + comissão de indicação).
- **Rateio:** 1 transação → 1 **evento de comissão** → **N beneficiários**, cada um identificado pelo **código único** do cadastro (é PARA ISSO que o código tipo-CPF existe: rastreabilidade + divisão correta). Cada linha tem **papel** (Hub/indicador/vendedor/executor/parceiro), **% fixo ou variável**, e **direção** (Hub **recebe** = conta a receber; **repasse** = conta a pagar).
- **Percentuais em camadas, sempre editáveis (owner define):** *prefixado* por **tipo × mercado × produto** → *override por acordo* **negócio a negócio / membro a membro** ("muda de acordo para acordo"). Defaults sugeridos por mercado (validar): IMB 1–3% (ou 15–25% da corretagem) · SRV 10–20% · Produto 5–15% · Obra/ENG/ARQ 3–8%.
- **Base = valor do negócio; fatura no GANHO** (decidido). Vale p/ imóvel/produto/serviço; obra usa o valor do negócio.
- Dados (aditivo, generaliza o antigo `hub_comissoes`): `hub_receita_regras` (defaults por tipo×mercado×produto, fixo/variável) · `hub_comissao_eventos` (transação: tipo, base, origem/lead_mestre) · `hub_comissao_rateio` (N linhas: código do beneficiário, papel, %, fixo/variável, direção, valor, status — **editável por evento**, seedado do default). Tudo `tenant_id`+RLS; Hub vê tudo, cada parte vê o seu.

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

## ⭐ Pré-requisito descoberto (mesa redonda 24/jun): Fundação Multi-Tenant Real

A auditoria de arquitetura+segurança revelou que **o sistema é single-tenant de verdade hoje**: a função `current_user_tenant_id()` é **hardcoded** para 1 tenant (`obra10`), não existe `fornecedor_id` nas tabelas operacionais, e `is_hub_admin()` aponta para roles que ninguém tem. Por isso, a regra-mãe do B4/B5 — **"fornecedor vê só o seu; Hub vê tudo"** — **não tem como existir ainda**. Isso vira o **bloco-fundação** que destrava B4 e B5:

### Bloco 3.9 — Fundação Multi-Tenant `[pré-requisito de B4/B5]`
1. **`current_user_tenant_id()` dinâmica** — ler de `users.tenant_id` (adicionar coluna) ou de um JWT claim, em vez do UUID fixo.
2. **`is_hub_owner()` / Hub-vê-tudo** — helper que distingue owner (Hub) de fornecedor, usado nas policies para o Hub bypassar o filtro de tenant.
3. **Modelo de `fornecedor_id`** — decidir: fornecedor = tenant próprio (slug/UUID) **ou** coluna `fornecedor_id` nas tabelas. (Liga ao cadastro PJ = escritório, ver monetização §5.5.)
4. **Provisionar ≥2 tenants reais** para testar isolamento de verdade (hoje só existe `obra10`).
- **Segurança:** já endurecemos as policies tenant-aware (fatia `rls_crm_core_close_holes`); elas passam a "funcionar de verdade" quando o (1) for dinâmico. Migrações aditivas/reversíveis, com mesa redonda.
- **Risco:** alto (toca auth/RLS de produção) → fazer com cuidado, gates, rollback, e o Wendel ciente.

**Re-sequenciamento:** **B3.9 (fundação) → B4 (visibilidade + Dashboard do Hub) → B5 (distribuição Lead Mestre×Vinculado)**. O Dashboard do Hub com cards de direcionamento/ranking só mostra números corretos depois da fundação (cross-tenant real).

---

## Decisões suas que destravam blocos futuros (não bloqueiam o Bloco 1)
- **Voz** on-device vs. serviço — custo/privacidade (B2/B8).
- **Faixas vs. valor exato** nos campos financeiros do comercial (B2).
- **Densidade do dashboard** do Hub — sugestão: começar com 5 cards (B4).
- **Pesos do score** por mercado (B5).
- **Compras** — fluxo/campos (B6). **Contrato Membros→fornecedor** (B7).

Cada uma é resolvida **quando o bloco chegar** — não seguramos o avanço por causa delas.
