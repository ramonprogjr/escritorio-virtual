# Produto, Telas & UX

> **Documento VIVO — um dos 5 que o time SEMPRE segue.** Derivado dos 115+ docs originais (arquivados, não seguidos) + do CADERNO-ENGENHARIA-AUDITORIA.md. Atualizado 07/jul/2026. Quando um doc antigo conflitar, este ganha.
> Companheiros: [00-Painel](00-PAINEL-DE-CONTROLE.md) · [01-Negócio](01-NEGOCIO-E-ESTRATEGIA.md) · [02-Produto/UX](02-PRODUTO-TELAS-E-UX.md) · [03-Arquitetura](03-ARQUITETURA-DADOS-E-SEGURANCA.md) · [04-Roadmap](04-ROADMAP-E-PLANO.md).


> Documento vivo, derivado dos 115+ docs de `docs/`; atualizado 07/jul. Fonte diária única para "o que o usuário usa e como a tela se comporta". Onde conflitar com doc antigo, **este ganha**. Onde conflitar com `MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md`, `ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md` ou `00-PAINEL-DE-CONTROLE.md`, aqueles ganham.

---

## 0. Como ler este documento

- **Escopo:** a camada que o usuário toca — mapa de telas/fluxos do CRM (leads, negócios, obras, cadastros, financeiro, dashboard, portais), os princípios de interação, o design system travado e o que já foi refeito no sprint 07/jul.
- **Honestidade estrutural:** cada bloco marca **[CONSTRUÍDO]** (no ar), **[GATED]** (código existe, dorme atrás de decisão/chave/janela), **[DESENHADO]** (spec pronta, zero código) e **[SUPERADO]** (histórico, não seguir).
- **Ressalva-mãe do estado real:** a camada conversacional inteira (Talk-and-Go pleno, analytics generativo, copiloto de voz, orçamento-IA) depende de **IA/Mistral, hoje DESLIGADA**. Logo, o que carrega o dia a dia AGORA é **Click-and-Go (chips)**; voz e IA generativa são roadmap dormente, não fachada viva.

---

## 1. Os princípios de UX (a lei, cruza todas as telas)

### 1.1 Os 3 mandamentos de interação
1. **Click-and-Go** — a ação principal em **≤2 toques**. Nada de formulário-labirinto. É o modo que sustenta o produto hoje.
2. **Talk-and-Go** — microfone onipresente cria/preenche/move por voz ("novo lead, reforma, Vila Mariana, 120 mil"). **[GATED por IA off].**
3. **A IA faz o trabalho chato** (busca, dedup, classificação, próxima-ação, resumo). O humano **decide, não data-entra**. **[GATED por IA off]** — hoje a heurística/regra faz o mínimo.

**Regra-mãe:** *o usuário escolhe e confirma — quase nunca digita.* Todo campo suporta 3 modos: **(a) chips/múltipla escolha** (default), **(b) voz**, **(c) digitação** (fallback). Faixas em vez de número exato (ticket `<50k · 50–120k · 120–300k · 300k+`). Quando a IA pré-preenche, mostra **origem + badge de confiança**; humano confirma em 1 toque; **nunca gravar derivado sem confirmar**.

### 1.2 Honestidade como arquitetura (a evolução de UX mais importante desde jun)
O dono **reprovou "parede de zeros"**. Regra-lei:
- **Número parado é banido.** Todo bloco é **AÇÃO** ou **TENDÊNCIA**.
- Nada de `R$0` mudo nem `0%` falso. Todo bloco sem fonte **degrada com FRASE de causa específica** ("aparece quando a obra registrar", "começa quando a obra for gerada", "migração pendente") + contorno tracejado.
- **3 classes de vazio, nunca colapsar:** (1) **estado bom** ("tudo em dia") ≠ (2) **tenant novo** (CTA de largada) ≠ (3) **input nunca preenchido** (tracejado). **Falha-de-fetch ≠ fonte-vazia** — nunca pintar erro de rede como "sem dados".

### 1.3 Anti-poluição por PAPEL / PERSONA
Cada persona vê **só o seu escopo**. O arquiteto não vê funil de vendas/leads crus; o cliente não vê EAP/margem/custo interno. **O recorte tem de ser NO DADO** (tenant + vínculo de linha), não só na navegação — senão vira IDOR por URL direta (`/portal/[id]`, ficha de negócio, etc.). Lista-negra de colunas nunca entra na projeção da query.

### 1.4 Invariantes de UX que toda tela carrega
- **Espaço vale ouro** — só entra na tela o que pede ação; disclosure progressivo; relatório profundo é generativo sob demanda [FUTURO].
- **Mobile = campo, não desktop encolhido** — voz/foto/evidência, alvos grandes (≥44px, campo ≥72px), 1 mão. Gestão pesada fica no desktop.
- **`delete` = arquiva** — o item resolvido some da tela; o Hub nunca apaga de fato.
- **Códigos de identidade escondidos** — chamar pelo **NOME**; código atômico (`PS2026013`, `NGIMB2026001`) é interno. Ordem/documento (OS) pode aparecer; identidade, não.
- **Hub = juiz/auditor**; **fonte única, lentes por papel** (um atualiza, todos veem; desatualização fica **visível**, não escondida).
- **Não é fachada** — clientes vão USAR; validar cada tela clicando no navegador.

---

## 2. Design System travado (tokens já existem em código)

### 2.1 Tema — dark verde + dourado
Tokenizado em `app/globals.css` (`--obra-*` / `--brand-*`). **Proibido azul/roxo Shadcn** (já varrido; resta sweep de ~97 azuis off-brand na fila).

| Papel | Token / hex | Uso |
|---|---|---|
| Fundo card | `#0f1d16` | superfície padrão |
| Borda | `#1d3a2c` | contorno de card/secundário |
| Verde marca | `#003b26` / `#34d399` | saudável, liberado, pago |
| **Dourado** | `#c9a24a` / `#e0b86a` | **dinheiro / valor / primário** |
| Texto | `#e6edf3` | corpo |
| Muted | `#8b949e` | secundário / "sem dado ainda" |
| Vermelho | — | atrasado, crítico, **disparidade** |

### 2.2 Contrato de cor semântico (inegociável)
- **Dourado = dinheiro/valor.** Sempre.
- **Verde** = saudável / liberado / pago.
- **Vermelho** = atrasado / crítico / **disparidade** (disparidade é RISCO, **nunca** dourado).
- **Tracejado + texto muted** = "sem dado ainda".
- **Cadeado/escudo** = dinheiro do cliente em custódia (**nunca** somado ao saldo do escritório).
- **Conflito aberto D9 — custódia:** hoje `lib/obras/financeiro.ts` pinta custódia de **violeta `#8B5CF6`**. Resolução da mesa: **chip de status violeta-escudo + VALOR monetário em dourado** (violeta = status; dourado = valor).

### 2.3 Shell canônico das telas (`PADRAO-SHELL-TELAS`, norma 27/jun)
- **O header universal já vem do layout** (`CrmUniversalHeader` + `crm-header-defaults`): renderiza título/descrição de ~16 telas; ações da tela via `setSlot`.
- **NÃO** adicionar `CrmStickyPageHeader` onde o universal já aparece (duplica título). `CrmStickyPageHeader` só em telas de detalhe/standalone que escondem o universal (`shouldHideCrmUniversalHeader`).
- Corpo: `min-h-full` + padding. **NUNCA** `minHeight:100vh` / `min-h-screen` (o layout já dá frame + scroll → duplo-scroll). *(Pendência: ~7 telas com `100vh` inline a migrar.)*
- **Card padrão:** `rounded-2xl border-[#1d3a2c] bg-[#0f1d16] p-5`.
- **Empty-state** = card compacto centrado (ícone + título + 1 linha + CTA), não bloco gigante.
- **Botões:** primário dourado · secundário borda `#1d3a2c` · destrutivo vermelho **só no hover**.
- **Scrollbar** (`ui-scrollbars`): trilho transparente, indicador ~3px pill claro; tokens `--obra-scrollbar-*` no `:root` (ajuste único propaga). Visível no desktop, some/3px no mobile.

### 2.4 Componentes-chave do DS
- **Vivos/triviais:** medidor segmentado (Tijolos), semáforo por linha, `FunilOperacionalChart`, `CrmLeadsEntradaPeriodo`, `MercadoLeadPicker` (chips de mercado).
- **A construir [DESENHADO]:** `SmartField` (chip+microfone+texto+confiança), `CommandBar` (⌘K/voz global), `ConfidenceBadge`, `QuickAdd` FAB, `RecommendationCard` (lead + top-3 fornecedores + score), `BottomSheet` mobile, `EvidenceCapture` (foto/medição 2 toques), `EscrowStepper` **puro** (extraído — **NÃO** importar `ObraFinanceiroSecao` de 1058 linhas).
- **Sem lib de gráfico no projeto** — tudo CSS/SVG artesanal. Nenhuma métrica pede pizza/radar (categorias ≤5).

---

## 3. Navegação / Menu

**Fonte de verdade do menu = o código** (`lib/crm-nav-groups.ts` / `CRM_NAV_GROUPS`), não os docs. O menu **implementado** tem **11 gavetas · ~28 rotas**:

| # | Gaveta | Itens |
|---|---|---|
| 1 | Visão Geral | Dashboard (`/crm`), Analytics, Relatórios |
| 2 | Vendas | Leads, Negócios |
| 3 | Cadastros | Pessoas, Empresas, Parceiros |
| 4 | Produtos | Imóveis |
| 5 | Obras | Obras, Pedidos |
| 6 | Financeiro | Visão, Pagar, Receber |
| 7 | Projetos | (funil de arquitetura) |
| 8 | Atendimento | Inbox, Canais, Aprovações |
| 9 | Marketing | Campanhas (`trafego`) |
| 10 | IA & Automação | Agentes, Automações, Ferramentas, Copiloto [badge] |
| 11 | Sistema | Configurações, Integrações, Contatos, Usuários, Onboarding [admin] |

**Decisões de navegação vivas:** `/crm/kpis` → `/crm/analytics` (redirect permanente) · Canais pertence a **Atendimento** · Parceiros em **Cadastros** · Relatórios em **Visão Geral** · Imóveis em Produtos · Copiloto (`/crm/agentes-reais`) placeholder "Em breve" · Onboarding só owner/admin · menu filtrado por papel · toggle expandir/recolher persiste em `localStorage` (`crm-sidebar-expanded`) · mobile = drawer + barra inferior (`lib/mobile/nav.ts`). Entradas globais: logo → `/crm`. Rotas fora do menu: `/portal`, `/fornecedor`, `/parceiro`, `/campo`, `/login`.

**[SUPERADO]** propostas de 7 gavetas (`menu-navegacao-consolidado`, `arquitetura-navegacao-crm`) e o menu legado 6 gavetas (`inventario-menu-crm`). O código de 11 gavetas ganhou.

**⚠ Descompasso com a direção-alvo:** todos os docs de menu são da **era single-tenant (mai)** e falam de papéis `owner/admin/vendedor/atendente`. A direção atual é **navegação recortada por PERSONA/cockpit** (`architect`, `cliente`, campo…). Tratar o menu de 11 gavetas como **inventário do que existe**, não como a arquitetura-alvo. **`/office` (Escritório Virtual) está DESATIVADO** (redireciona `/crm`; ~8.500 linhas de código morto), apesar de docs de mai o descreverem vivo.

---

## 4. Mapa de telas e fluxos por superfície

A espinha do domínio é o **NEGÓCIO** (`hub_negocios`). Fluxo canônico: `lead → negócio → (ganho) → deriva entrega (obra OU projeto)`. Usuário acha tudo pelo **NOME**.

### 4.1 Leads — `/crm/leads` [CONSTRUÍDO · rebuild shipado 07/jul]
- Padrão de tela = **A Caixa** com lanes **Agora / Hoje / Aguardando** + card do lead (o "herói" que ficou certo).
- **Sprint 07/jul (AUDITORIA-PIPELINE-LEADS-CEO):** causa-raiz era `overflow-hidden` que prendia os leads numa caixinha com barra de rolagem interna. Fix-keystone = **desprender o scroll** (documento único). Também: toolbar única sticky ~52px, unificar as 2 buscas, banner de IA → chip, abas de mercado → dropdown, KPIs → tira fina, toque 44px nos 3 botões do card.
- **Ciclo do lead corrigido (AUDITORIA-CICLO-LEAD-v1, 06/jul):** a raiz era confundir **posição no funil** com **prontidão/qualificação** (dois eixos) e **dois vocabulários** vivos (`FUNIL_LEAD_ETAPAS` sem "Qualificado" × `COLUNAS_VENDAS` com "qualificado"). O botão **"Direcionar"** ficava inalcançável porque o gate exigia `estagio==="qualificado"` mas o write-path colapsava em "qualificando". **Fix aplicado:** gate usa `legacyToFunil(estagio) !== "qualificando"`.
- **Fila de distribuição (Hub):** `RecommendationCard` (top-3 fornecedores + score, `lib/crm/distribuir-lead.ts`) → "Direcionar" / "Automático". Decisão determinística e auditável (LLM só explica).

### 4.2 Negócios — `/crm/negocios` [CONSTRUÍDO]
- **Negócio é o centro** (modelo Pipedrive): **Pessoa ↔ Empresa ↔ Negócio** cruzados e navegáveis em 1 clique.
- **A Ficha de Negócio é o "molde-ouro"** que as outras fichas herdam (5 abas, default "Conversar").
- Kanban arrastável entre etapas; cartão com próxima-ação + SLA.
- **[GATED]** `NegocioFinanceiroRedeSection` já renderiza na página (motor de comissões), mas dorme (tabelas vazias).
- **⚠ regra travada:** o "spawn mágico" ganho→obra é **propor + confirmar** (1 clique humano), **nunca** auto-insert no drag do kanban. Onde ainda houver PATCH que auto-cria obra, é P0 a corrigir.

### 4.3 Cadastros — Pessoas / Empresas / Parceiros [CONSTRUÍDO · refino shipado 07/jul]
- Vínculo relacional N:N (`hub_pessoas_empresas`, cargo + principal). Dedup por telefone/CPF/CNPJ (código único imutável por entidade/ano).
- **Sprint 07/jul (AUDITORIA-CADASTROS-UIUX-PROMAX):** 4 problemas-mãe atacados — sem hierarquia (2 verdes idênticos), 4 formas de criar (2 botões + 2 FABs), **código de identidade exposto** (viola "identidade esconde"), copiloto cobrindo a coluna Telefone. **P0 shipados:** esconder código (`defaultOff`), 1 primário dourado (hierarquia), copiloto não cobre a tabela.
- Padrão de criação: **1 botão primário dourado**, chips no corpo, "mais detalhes" recolhido, Salvar sempre ativo (rascunho).

### 4.4 Obras — `/crm/obras` [CONSTRUÍDO · Altitude 2]
- **`/crm/obras` = Carteira por urgência** + aba **Hoje** (fila de decisões → copiloto). Padrão de tela do executor = **CARTEIRA → COCKPIT**, não funil de lead.
- Cockpit da obra sobre a série AEC (E0–E7): Escopo/EAP, Itens & Avanço, Restrições, Compras, Medição, Financeiro.
- **Situação (AUTO, cor + 🔒) × Andamento (MANUAL, chip)** são canais visuais distintos que **nunca colapsam** (o insight da planilha do Consulado). KPI "Finalizados" conta `andamento='finalizado'`, nunca `pct=100`.
- **Nova obra ≤3 toques**; editor de EAP é clone do `PipelineConfigSideover`.
- **Gaps reais não-bloqueantes (AEC-ATIVAÇÃO):** medição sem foto (bucket `medicoes` não existe → evidência perdida) [P1]; card "Previsto" sempre R$0 [P2]; medição não-transacional [P2]; autor da medição = UUID e não nome [P3].

### 4.5 Projetos / Arquitetura — `/crm/arquitetura` [CONSTRUÍDO base · financeiro DESENHADO]
- Funil de projeto (kanban clone de negócios) + ficha 5 abas. Série A0/A1/A2 construída: Programa de necessidades, loop de aprovação do cliente, elo "Gerar Obra" (projeto→obra, `gerar-obra/route.ts` — o **molde canônico arq→eng**).
- **Tela do Arquiteto (`DESIGN-TELA-ARQUITETO-v2`, 05/jul — v1 superada):**
  - **Estado real hoje:** `buildArquiteto()` entrega **3 cards estáticos** (Projetos, Em aprovação, Disparidade = placeholder "—") + ação de chaves de escrow. Sem financeiro, sem drill-down.
  - **v2 inverte a lógica:** a espinha é a **fila de decisões**, não leitura. 5 tiers por peso: (0) cabeçalho + semáforo · (1) **card-mãe "O que precisa de você"** [hero] · (2) tira financeira boarding-pass (**nunca** total consolidado dos 4 pools) · (3) grade operacional · (4) rail de aprovações · (5) avisos honestos. Item resolvido **some**.
  - **[PODE JÁ]:** card-mãe linhas 1–3 + grade + ticker + componentização (fonte viva, zero schema).
  - **[ESPERA]:** chave 1 (ABAC de linha — furo: hoje qualquer arquiteto assina qualquer pagamento), disparidade-gate, aba Pagamentos, honorário, custódia (E6 dormente).

### 4.6 Financeiro — `/crm/financeiro` (Visão / Pagar / Receber) [CONSTRUÍDO base]
- Financeiro base no ar. O motor de rede (comissões/split) e o escrow são tratados no master **Financeiro & Motor** — aqui a UI apenas os expõe quando ligados.
- **Bifurcação por `tipo_contrato`** (imutável) na **apresentação**, não no schema: `administracao` = cliente vê unitário (transparência) · `preco_fechado` = cliente vê só totais (previsibilidade; composição da executante nunca exibida — defesa **na query**).

### 4.7 Dashboard do Hub — `/crm` [CONSTRUÍDO · REFAZER pendente]
- Regra: **só entra o que pede ação.** Cards acionáveis ordenados: (1) leads aguardando direcionamento · (2) SLA estourando · (3) ranking fornecedores · (4) funil global · (5) obras em risco · (6) financeiro · (7) leads sem resposta. Todo card clicável (drill).
- **Sprint 07/jul:** "Funil do Hub", "O que travou", "Dashboard andares" shipados.
- **AUDITORIA-DASHBOARD-CEO (07/jul) — veredito REFAZER:** buracos confirmados — "IA-first" é falso (`CrmOQuePrecisaDeVoce.tsx:22` = "100% por REGRA, sem IA/Mistral"); pipeline duplicado; parede de vaidade; dado de TESTE na home. **Herói que fica:** o card "O que precisa de você".
  - **⚠ CONFLITO importante:** o "Bloco DINHEIRO DO HUB" (MRR/comissão/a-receber da rede) exige **ler acima de um tenant** + Faixa B como leitura de rede. **O estado real é single-tenant disfarçado + comissões gated + Faixa B = só endurecimento.** Portanto esse cockpit é **DESENHADO/BLOQUEADO pelo single-tenant**, não pendência de UI acionável agora.

### 4.8 Atendimento — Inbox / Canais / Aprovações [CONSTRUÍDO · IA em sombra]
- Inbox WhatsApp (UAZAPI) IA+humano: respostas sugeridas + converter → lead/negócio em 1 toque. **[GATED]** a sugestão de IA depende de Mistral.
- **Aprovações** entra na reconstrução da **Central de Aprovações** (fila única sobre `hub_aprovacoes`, priorizada por IA, humano no crítico). Trava absoluta: **nunca passa de nível 2 de autonomia** em escrow/dinheiro/contrato/SST.

### 4.9 Portal do Cliente — `/portal` [DESENHADO, não construído]
- Persona `cliente` nova, isolada por **`negocio_id`** (não é tenant — é vínculo). "Cliente quer DORMIR TRANQUILO." Cada bloco cura 1 dos **5 medos** (atrasar / não acabar / não saber / ser enganado / perder dinheiro).
- Dashboard: veredito honesto em 1 frase → HERO prazo & avanço → Curva-S + Financeiro + Selo → "Esta semana" (diário curado) + "Precisa de você" (aprovações).
- Financeiro **bifurcado por `tipo_contrato`** (defesa na query — preço fechado nunca faz SELECT de unitário). **Selo de auditoria 3 níveis** (ⓥ auditado / ⓘ declarado / ⚠ divergência — nasce ⓘ até haver visita in loco). Nunca botão [Pagar] direto — só aprovação; escrow libera com **dupla chave** (cliente + Hub). Acesso indevido → **404** (não vaza existência). Reuso: `aggregateCockpit(opts.negocioId)` (E1 deployado).

### 4.10 Operação de Campo — `/campo` [DESENHADO, Fase 2/3]
- Shell própria fora do `/crm`, escala +60% (alvos ≥72px, texto ≥20px, voz primária, stateless, offline-first IndexedDB). O valor NÃO está no tablet — está no **cross-check** (declarado × foto/EAP) + follow-up forçado.
- Fluxo: check-in (geo) → IA pergunta só em pausa (teto 3/pessoa/dia) → check-out dispara cross-check → divergência vira pendência auditada reusando `hub_obra_restricoes` (E3, `origem='ia_campo'`). Tom **nunca acusatório**. Hardware faseado: celular+geofence → kiosk fixo → tablet-comodato.

---

## 5. O que já foi refeito (sprint 07/jul) — âncora do "agora"

| Entrega | Fonte da auditoria | Estado |
|---|---|---|
| **Leads rebuild** (scroll desprendido, toolbar única, toque 44px) | AUDITORIA-PIPELINE-LEADS-CEO | ✅ shipado |
| **Funil do Hub** | AUDITORIA-DASHBOARD-CEO | ✅ shipado |
| **"O que travou"** (operação validada com dado real) | Dashboard | ✅ shipado |
| **Dashboard andares** | — | ✅ shipado |
| **Cadastros** (esconder código, hierarquia de botões, copiloto não cobre tabela) | AUDITORIA-CADASTROS-UIUX-PROMAX | ✅ shipado |
| Ciclo do lead — gate "Direcionar" alcançável | AUDITORIA-CICLO-LEAD-v1 | ✅ P0 corrigido |
| Diagnóstico 33 telas — F0 (fachada), F1 (copy/idioma), F2 (blindar ações) | PLANO-ACAO-MACRO-DESIGN | ✅ deployado |

**Próximo na fila de UX:** F3 (injetar IA-first nas telas-âncora — **bloqueado por Mistral off**); sweep dos ~97 azuis off-brand; migrar ~7 telas com `100vh` inline; reconstrução da Central de Aprovações; tabela→cards nas telas restantes.

---

## 6. Conflitos resolvidos (para não reabrir)

| Tema | Vence | Motivo |
|---|---|---|
| Ondas da Tela do Arquiteto | **v2** (card-mãe "o que precisa de você" primeiro) | fonte viva, zero schema; v1 (financeiro-primeiro) estava bloqueada |
| Reuso financeiro do arquiteto | **`EscrowStepper` puro extraído** | evita arrastar `ObraFinanceiroSecao` (1058 linhas) + drawers de escrita |
| Cor da custódia | **violeta = status, dourado = valor** (D9) | contrato de cor: dourado é sempre dinheiro |
| Menu | **11 gavetas (código)** | proposta de 7 é superada; mas alvo é navegação por persona |
| `/office` | **desativado (real)** | docs de mai que o dizem vivo estão superados |
| Cockpit "DINHEIRO DO HUB" cross-tenant | **bloqueado pelo single-tenant** | comissões gated + Faixa B = endurecimento, não leitura de rede |
| Talk-and-Go / analytics generativo | **roadmap dormente** | IA/Mistral off; Click-and-Go (chips) carrega hoje |
| Shell das telas | **norma única `PADRAO-SHELL-TELAS`** | header do layout + corpo rolável; nunca `100vh` inline |

---

## 7. Descartados como fonte diária (constam no histórico)

- `documento-mestre-obra10-v1` / `01_documento_mestre` / `apresentacao-produto-crm-abas` / `menu-lateral-crm-resumo` / `inventario-menu-crm` / `menu-navegacao-consolidado` / `arquitetura-navegacao-crm` — descrevem a era single-tenant/28-agentes/`/office`-vivo de mai. Valor histórico.
- `DESIGN-TELA-ARQUITETO` v1 — superado por v2.
- Propostas de menu de 7 gavetas — o código de 11 ganhou.

---

## 8. Checklist ao criar/alterar qualquer tela

- [ ] Ação principal em ≤2 toques (Click-and-Go); chips antes de digitação.
- [ ] Cores do DS (dark verde+dourado); dourado = dinheiro; sem azul/roxo Shadcn.
- [ ] Shell canônico: header do layout + `min-h-full` (nunca `100vh`); card `rounded-2xl border-[#1d3a2c] bg-[#0f1d16]`.
- [ ] Zero número parado: cada bloco é ação ou tendência; vazio degrada com **frase de causa**; distinguir as 3 classes de vazio.
- [ ] Recorte por persona **no dado** (tenant + vínculo), não só na nav; acesso indevido → 404.
- [ ] `delete` = arquiva; item resolvido some; código de identidade escondido (mostrar nome).
- [ ] Dinheiro nunca por IA/voz — só "Confirmar" humano; escrow = dupla chave.
- [ ] Validado clicando no navegador (desktop + mobile). Não é fachada.

---

*Companheiros dos 5 vivos: `MODELO-DE-NEGOCIO-E-FLUXOS-COMPLETO.md` (doc-mãe), `ANALISE-CEO-E-PLANO-DE-UNIFICACAO.md` (plano faseado), master Arquitetura/Dados/Segurança, master Financeiro & Motor, `00-PAINEL-DE-CONTROLE.md` (estado real).*