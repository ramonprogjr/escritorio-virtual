# MACRO-PLAN ATUALIZADO — Obra10+ (mapa do que falta implantar)

> **O que é.** Reconciliação de TODOS os documentos e memórias construídos ao longo do tempo, num mapa único do que **falta implantar** rumo ao produto completo. Docs antigos perdem para decisões novas. Onde não há evidência no código/banco, o status é **"planejado"**, não "feito".
>
> **Data:** 2026-07-01 · **Branch:** `wendel/dev` → `feature/escritorio-visual` (Render auto-deploya esta) · **Método (régua-mãe):** o **melhor para o sistema** — crítico/adversarial, seguro (tenant-isolation), pragmático, cuidadoso, mesa redonda, consistente, sem parar (loop), parando só nas travas do dono. (`diretriz-melhor-para-o-sistema`)
>
> **Fontes reconciliadas:** `MEMORY.md` + ~40 memórias · `PLANO-EXECUTIVO-BLOCOS.md` · `PLANO-BLOCOS-ARQ-ENG.md` · `ANALISE-MESTRA-ESCOPO.md` · `PENDENCIAS.md` · `HANDOFF-DEV-ACOES-PENDENTES.md` · `ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md` · `CENTRAL-APROVACOES-DESIGN.md` · `ORCAMENTARIA-SETOR-DESIGN.md` · `PORTAL-CLIENTE-DESIGN.md` · `RESUMO-NOITE-E2E-FINALE.md` · `MARATONA-2H-RELATORIO.md` · `MOBILE-AUDITORIA-ACHADOS.md` · `docs/insumos-do-dono/*` · estado real do código (`app/crm/**`, `supabase/migrations/`) e do banco (Supabase `list_migrations`).

---

## §1 — Onde estamos (honesto)

O **núcleo comercial está no ar e maduro** (Render, branch `feature/escritorio-visual`): CRM completo com cadastros PF/PJ dedup por código único, funil/Kanban editável por mercado, atendimento inbox IA+humano (WhatsApp via UAZAPI), motor de distribuição de leads, agentes de IA (builder + playbooks + copiloto de voz), financeiro (a pagar/receber), metering de créditos de IA ("Tijolos", em modo sombra) e ~33 telas diagnosticadas. Na virada 29→30/jun houve um **grande finale E2E**: 9/9 domínios auditados adversarialmente, corrigidos e deployados (26 deploys), com tema central de **segurança multi-tenant** (guards de papel server-side, `.eq("tenant_id")` fechando ~dezenas de rotas e o motor de Analytics, escrow blindado, segredos tirados do browser via refactor de auth `H-SEC-1`); e uma **maratona mobile** (auditoria + 6 lotes: zoom-iOS, toque 44px, marca no chrome, grids responsivos, tabelas→cards). Em paralelo, **toda a camada AEC (Arquitetura & Engenharia) foi CONSTRUÍDA em código** — migrações E0–E7 + A0–A2, libs (`lib/obras/*`), APIs (`app/api/crm/obras/**`), telas (`/crm/obras`, `/crm/arquitetura`) e o componente `<ArvoreEscopo>` da estrutura unificada — **mas está latente**: essas ~19 migrações do bloco AEC são **file-only, não aplicadas em produção** (o banco real para em `20260629...parceiros_add_portfolio_jsonb`). Então: núcleo comercial vivo e polido; camada de obra pronta no repo, esperando a janela de migração do dono; e o multi-tenant real, a monetização automática e todo o bloco IA-first pleno seguem planejados.

**Barômetro honesto (2 números):**
- **Núcleo comercial apresentável/usável:** ~90%. Falta ligar a IA em prod (chave), rever visual mobile do dono, e higiene de dados de teste.
- **Visão completa (comercial + AEC + Hub + marketplace + monetização + portal cliente):** ~35–40%. Muita fundação pronta (inclusive AEC em código), mas as camadas que dão o *moat* (obra em prod, estrutura unificada aplicada, central de aprovações/tarefas unificadas, portal do cliente, escrow real, multi-tenant go-live, marketplace/campo) estão à frente.

---

## §2 — Visão macro reconciliada

### 2.1 A sequência-mãe do dono (28/jun — `macro-sequencia-nucleo-primeiro`)
1. **Núcleo rodando PERFEITO** (foco atual): cadastros, cadastro→venda→funil, esteira de vendas/produtos, atendimento, fluxo de IA. *Why:* vendas e marketing serão construídos em cima e dependem que rode liso.
2. **Marketing / tráfego:** IAs de gestão de tráfego Google + Meta (o dono toca; exige núcleo perfeito antes).
3. **Multi-tenant (go-live):** aplicar a janela de migrações (tenant dinâmico, contador por tenant, backfill `tenant_id` legado).
4. **Gestão de usuários** (sub-usuários/funcionários dos tenants).
5. **Arquitetura & Engenharia** (o lado de execução: gestão de projeto/obra).
6. **Os demais** (imobiliário/portal, materiais iFood, cliente final).

> **Reconciliação importante:** a sequência acima é de 28/jun. Nas 29→30/jun o dono **antecipou e amadureceu** a camada AEC (item 5) com um conjunto de **decisões estruturais grandes** e a equipe **já construiu o item 5 em código** (E0–E7/A0–A2). Ou seja, na prática já se avançou no item 5 antes de fechar 2–4. Isso não é conflito: o dono manda "não pular etapa" para o que é **base do núcleo**, mas a construção AEC foi feita **aditiva e latente** (migrações não aplicadas), então nada quebrou. O que falta é **decidir a ordem de ATIVAÇÃO** (ver §5).

### 2.2 As grandes decisões amadurecidas (o que cada uma é e como encaixa)

- **ESTRUTURA UNIFICADA — orçamento = cronograma = gestão = escopo** (`estrutura-unificada-*`; `ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md`). Um **dado-mãe único**, o "item de escopo" (`hub_obra_itens`), projeta 7 artefatos sem redigitar: memorial, orçamento/proposta, contrato, compra, medição, pagamento/escrow, Curva-S. Decisões travadas (29/jun): unificar E2+E6 (`hub_obra_itens` = verdade; `hub_obra_orcamento_itens` = proposta 1:1), BDI fator único/empresa, avanço por item, disparidade **avisa** (não trava, vai à Central de Aprovações), **manual-first**, aba "Escopo" de 1ª classe, build em **4 fases aditivas**. **É a fundação honesta e auditável de toda a camada AEC.**
- **ORÇAMENTÁRIA = SETOR cross-vertical** (`orcamentaria-setor-cross-vertical`; `ORCAMENTARIA-SETOR-DESIGN.md`). Não é botão/feature: é um **setor** que atravessa arquitetura, engenharia, serviços e produtos — **um padrão único de orçamento** para toda a rede (= a estrutura unificada). A orçamentária da obra (planilha CSV + memorial da mesma árvore) é a **1ª instância concreta**; provável módulo de navegação próprio no futuro.
- **CENTRAL DE APROVAÇÕES** (`central-aprovacoes-tela-unificada`; `CENTRAL-APROVACOES-DESIGN.md`). Tela em **todos os usuários + Hub**, a superfície que faz **todas as frentes andarem**. Organizada por **mercado × atividade × tipo**; **unifica TODOS os gates** hoje espalhados (cliente, escrow duplo, compra/SC, restrição/SST, medição) sobre `hub_aprovacoes`. IA prepara/prioriza/recomenda + **auto-aprova o trivial por nível de autonomia (1→5)** + humano no crítico + a decisão **ensina o agente**. Já existe tela `/crm/aprovacoes` (gate do dinheiro E6) — falta a **unificação plena** cross-domínio.
- **GESTOR DE TAREFAS universal** (`gestor-tarefas-universal`). A **espinha de EXECUÇÃO**: todo **verbo/ação vira tarefa** (criador · executor humano-ou-agente · destinatário-aceita · resultado · SLA · vínculo · registro append-only). A IA orquestra a teia; humano só vê o que precisa dele. **Irmã da Central de Aprovações** (tarefa = ação p/ executar; aprovação = ação p/ decidir; mesmo loop de autonomia → provável `hub_tarefas` + `hub_aprovacoes`). Existe `/crm/tarefas` (listão comercial) — falta o **motor universal**.
- **PORTAL DO CLIENTE + os 5 medos** (`portal-cliente-medos-cura`; `PORTAL-CLIENTE-DESIGN.md`). **A alma do produto**: o cliente final tem **usuário próprio**, visão dashboard-first honesta (avanço, relatórios, financeiro, cronograma, diário+fotos, aprovar). Cada elemento cura um dos 5 medos: atrasar, não acabar, não saber, ser enganado (**selo de auditoria do Hub**), perder dinheiro. A ligação arquiteto↔obra passa sempre pelo Hub (auditoria).
- **ESCROW + 2 modelos de contrato** (`modelos-contrato-escrow-auditoria`; `E6-DESIGN.md`). Dois modelos **imutáveis** definidos no fechamento que **bifurcam o financeiro/Portal**: **administração** (cliente vê valor unitário de tudo) × **preço fechado** (cliente vê só totais). **Escrow** = dinheiro em custódia, paga só com **aprovação dupla arquitetura + Hub** (F-D2 já codificado: chave Hub=owner, chave Arq=gestor≠owner, fail-closed). Engenharia auditorial (o "selo/somos juízes"): onboarding → visita in loco → IA de risco → métricas → controle de acesso.
- **INTEGRAÇÃO entre contas — negócio = espinha** (`integracao-contas-negocio-spine`). O **negócio** (origem = venda do imóvel) interliga todas as contas; projeto→obra→financeiro→pedidos derivam dali. Módulos compartilhados com **visão por papel** (RBAC+ABAC). Invariante forte **"nada se perde"**: log append-only + soft-delete + Hub como backstop (recupera mesmo se apagar). Mensageria robusta e logada. **Anti-poluição:** cliente não vê a obra crua; arquiteto não vê as entranhas da engenharia.
- **CRM cross-conta** (`crm-cross-conta-visibilidade`). Negócio/lead/imóvel aparece nos CRMs de **todos os envolvidos**, mas **só o dono do negócio (e o Hub) move na esteira**; o envolvido vê (cor do mercado de origem) + comenta/atribui, não move. Evolução do lead Mestre×Vinculado + ABAC (`hub_negocio_acessos`). Dashboards do Hub "absurdamente bons".
- **MARKETPLACE / iFood da construção** (`marketplace-rede-servicos-ifood`). Cadeia de serviços/ofícios (arq→eng→prestadora→mão de obra) com **spread/split em cada elo**; "iFood" = pedidos de materiais/aluguel de equipamentos compartilhado. **Veredito CEO:** o *moat* não é entregar rápido, é ser **preditivo** (o sistema sabe a necessidade antes, pelo cérebro da obra: EAP+cronograma+estoque). Construir **asset-light**, regional, em fases (E5 = fundação).
- **OPERAÇÃO DE CAMPO — tablet/totem** (`operacao-campo-tablet-totem`). Predição de material por fase; entrega 2 níveis (fornecedor / Lalamove com cotação de frete auto); **tablet por comodato** (check-in/out exclusivo no equipamento do Hub); IA de campo que "toca" e cruza com fotos; **totem de compra por voz** ("comprar tinta" → puxa o projeto). Tudo **fase 2/3** sobre a fundação atual.
- **EAP refinada + ORÇAMENTO IA** (`eap-ambiente-orcamento-ia`; `ORCAMENTO-IA-DESIGN.md`, `EAP-REFINADA-DESIGN.md`). EAP ambiente-first (segmento→ambiente→disciplina→atividade+qtd+descritivo-padrão). O **descritivo padrão = taxonomia controlada = o enabler da IA**. Capability-mãe: IA lê o **memorial PDF → monta sozinha a planilha executiva/custos/financeira**, com preços de fornecedor, auditável. Faseado: v1 humano confirma quantidades; norte = 100% sozinha.
- **CRÉDITOS DE IA / metering** (`creditos-ia-metering-visao`). 3ª perna de monetização. Todo o sistema é IA-first; cada geração consome tokens repassados como **créditos pré-pagos ("Tijolos" 🧱)**. **Fase 1 já no ar** (medição sombra + tabelas `hub_ia_*` aplicadas). Faltam fases 2–4 (carteira/widget → pré-pago/hard-cap/top-up com gateway → assinatura concede Tijolos + super-admin de preços).
- **MONETIZAÇÃO — 2 cobranças separadas** (`monetizacao-licenciamento-rede`; PLANO §5.5). (a) **Assinatura SaaS** (mensalidade + seat + módulo + plano + créditos — **sem rateio**; entitlements `hub_planos`/`hub_tenant_*`) e (b) **comissionamento transacional** com **rateio/split por código único** (1 transação → N beneficiários; `hub_receita_regras`/`hub_comissao_eventos`/`hub_comissao_rateio`). **Manual-first**, billing automático depois.

### 2.3 Como tudo encaixa (a costura)
O **negócio** é a espinha (origem = venda do imóvel). O **código único** garante não-duplicação, comissão e rastreio. Sobre isso, a **estrutura unificada / orçamentária** é o dado-mãe da execução (arq→obra), e a **Central de Aprovações + Gestor de Tarefas** são as duas superfícies gêmeas que fazem tudo **andar** (decidir × executar), com **IA-first** e **autonomia por nível**. O **Portal do Cliente** é a face honesta (cura os 5 medos), o **escrow** é o cofre auditado, o **Hub** é o juiz (auditoria/selo/dashboards). **Marketplace + operação de campo** monetizam a cadeia (spread) sobre o *moat* preditivo. **Créditos de IA + assinatura + comissão** são as 3 fontes de receita. Tudo **multi-tenant** e **API-first**.

---

## §3 — O QUE FALTA (priorizado em fases)

> Legenda de status: **não-começado** · **parcial** (existe base/código, falta terminar/ativar) · **bloqueado-dono** (depende de infra/decisão/teste do dono). Tamanho: P (pequeno) · M · G (grande) · GG (épico multi-bloco).

### FASE 0 — Ativar o que JÁ está pronto (destrava tudo; NÃO depende de código novo, só do dono)
Estes itens **não são desenvolvimento** — são ações de produção/decisão do dono que liberam valor já construído.

| Item | O que é / por quê | Depende de | Tam. | Status |
|---|---|---|---|---|
| **Ligar a IA em prod** | Setar `MISTRAL_API_KEY` (billing Mistral ativo) + `COPILOTO_HMAC_SECRET` no Render → acende agentes/copiloto/gerar-fluxo. É o item #1 do MVP de IA. | Conta Mistral com billing | P | **bloqueado-dono** |
| **Aplicar migrações pendentes** | ~19 migrações file-only no repo (inclui todo o bloco AEC E0–E7/A0–A2, RLS financeiro, escrow, metering-extras). Banco real para em 29/jun. Sem isso, a camada de obra **não existe em prod**. | Janela de `supabase db push` + checagem de duplicatas do índice único de recebível | M | **bloqueado-dono** |
| **Tirar `NEXT_PUBLIC_*` do Render + testar login** | Remover `NEXT_PUBLIC_INTERNAL_API_KEY` e `NEXT_PUBLIC_TENANT_ID` (o refactor H-SEC-1 já os dispensou) e **re-testar login** (auth mudou). | Acesso ao Render | P | **bloqueado-dono** |
| **Setar `CRON_SECRET` / `GROQ_API_KEY` / `MOTOR_FONTE`** | CRON_SECRET protege o cron de KPIs; GROQ desbloqueia fallback quando Mistral ocioso; `MOTOR_FONTE=fornecedores` migra o motor p/ a entidade consolidada (validado lado-a-lado). | Decisão/OK do dono | P | **bloqueado-dono** |
| **Review VISUAL mobile do dono** | 3º header H2 (exige migrar `CrmSessionFooter` p/ MobileShell), affordance de scroll dos kanbans, funil em lista vertical, colapsar botões/rodapé. Precisa do olho do dono no device. | Dono no celular | M | **bloqueado-dono** |

### FASE 1 — Núcleo perfeito (o item 1 do dono; o que NÃO depende do dono)
Fechar as dívidas que a auditoria-mestra e o diagnóstico das 33 telas mapearam. Tudo aditivo, com gates.

| Item | O que é / por quê | Depende de | Tam. | Status |
|---|---|---|---|---|
| **F4 — tabela→cards restantes** | Cadastros (Ficha 360), Tarefas ("ações de hoje"), Pedidos/Imóveis → cards. Régua "tela = JOB". Muito já feito no E2E; restam telas pontuais. | design system (existe) | M | **parcial** |
| **Fundação de gestão — `hub_eventos` / registros / próxima-ação estruturada** | Keystone F4: cada nota/avanço vira **evento** que alimenta KPIs reais (tempo/SLA/ranking/funil). Hoje KPIs de tempo são falsos/impossíveis sem ele. `hub_eventos` **já aplicado** (migração `hub_eventos_keystone`); falta **usar** em toda parte + `hub_registros_interacao` + próxima-ação (tipo+data+status) + timeline nos 4 cadastros. | — | G | **parcial** |
| **Funções que faltam inteiras** | Agendar reunião (calendário), registrar interação (ligação/visita/proposta), follow-up por regra, **motor de SLA real** (hoje só frescor visual). | hub_eventos | M | **não-começado** |
| **Dedup do intake de formulário (código único)** | `garantirPessoaParaLead()` compartilhado nos intakes (`/api/leads`, `/api/crm/leads`, ingestor Meta) + FK `lead.pessoa_id`. Sem isso, form gera lead duplicado sem código PES. | — | M | **não-começado** |
| **Higiene de dados de teste** | Limpar leads/mocks de teste (com backup) antes de qualquer apresentação. | backup | P | **não-começado** |

### FASE 2 — Segurança / go-live blockers (invisível, mas grave; antes de usuários reais / multi-tenant)
> Nota de reconciliação: a **CRÍTICO 1** da análise-mestra (25/jun) — ~32 rotas service-role sem guard de papel — foi **em grande parte fechada** no finale E2E (29–30/jun: guards server-side + `.eq(tenant_id)` + `server-owner-guard.ts`). Confirmar cobertura total antes de dar por encerrado.

| Item | O que é / por quê | Depende de | Tam. | Status |
|---|---|---|---|---|
| **Fundação Multi-Tenant real (B3.9)** | `current_user_tenant_id()` **dinâmica** (ler de `users.tenant_id`, já existe coluna + migrações fase1/fase2 aplicadas), `is_hub_owner()`, modelo `fornecedor_id`, provisionar ≥2 tenants. Hoje o sistema é single-tenant de fato; o isolamento tenant-aware "funciona de verdade" só quando isto virar. | — | G | **parcial** |
| **Backfill `tenant_id` legado + remover ramo `OR tenant_id IS NULL`** | Furo permanente disfarçado de compat; tabelas de analytics (`hub_alertas`/`hub_ml_observacoes`/`hub_ciclos_ia`) sem coluna tenant. | multi-tenant real | M | **parcial** |
| **Validar `tenant_id` server-side sempre (Crítico 2)** | Nunca aceitar de header/body sem checar contra o caller; só owner muda. | — | M | **parcial** |
| **Integridade do split de comissão (Crítico 4)** | `hub_comissao_eventos` (imutável) + `rateio` (auditável) + snapshot no ganho; hoje `comissao_calculada` é editável via PATCH. | — | G | **não-começado** |
| **Avaliar/trancar schema `crm_*` paralelo** | Schema morto no código mas com RLS aberta (superfície de vazamento). Não dropar sem OK. | OK dono | P | **bloqueado-dono** |

### FASE 3 — Governança do Hub + Distribuição + Monetização (a rede)
| Item | O que é / por quê | Depende de | Tam. | Status |
|---|---|---|---|---|
| **B4 — Visibilidade & Dashboard do Hub** | "Fornecedor vê só o seu; Hub vê tudo" (RLS `fornecedor_id`, Hub bypassa) + Dashboard do Hub com cards acionáveis. | B3.9 | G | **parcial** |
| **B5 — Motor de Distribuição persistido** | `hub_lead_distribuicao` (score multi-critério, Mestre×Vinculado, SLA do fornecedor com redistribuição). Hoje só grava `agente_responsavel`; a fila que dá nome à tela não distribui de verdade. | B4 | G | **parcial** |
| **B5.5 — Monetização** | (a) **Entitlements/SaaS** (`hub_planos`/assinatura/módulos/créditos — **não existem**; nem guard de módulo) + (b) **comissão com rateio** (motor + snapshot) + funil/KPIs/SLA em 2 níveis. Manual-first. | B4, B5 | GG | **não-começado** |
| **Créditos de IA fases 2–4** | Carteira/widget/saldo → pré-pago/hard-cap/top-up (trava: gateway) → assinatura concede Tijolos + super-admin de preços. | gateway (dono) | G | **parcial** |
| **Marketing / tráfego (item 2 do dono)** | IAs de gestão de tráfego Google + Meta (o dono toca; provável feature nova downstream). | núcleo perfeito | G | **não-começado / dono** |
| **Gestão de usuários (item 4 do dono)** | Sub-usuários/funcionários dos tenants (RBAC mais fino). | multi-tenant | M | **não-começado** |

### FASE 4 — Arquitetura & Engenharia (item 5 do dono; MUITO já em código, latente)
> **Reconciliação-chave:** a espinha AEC **existe no repo** (migrações E0–E7, A0–A2, E4; libs `lib/obras/*`; APIs `app/api/crm/obras/**`; telas `/crm/obras` c/ abas Carteira/Hoje, `/crm/arquitetura`; `<ArvoreEscopo>`). O que falta é **aplicar as migrações (Fase 0)** + **terminar as 4 fases da estrutura unificada** + as camadas conversacional/campo.

| Item | O que é / por quê | Depende de | Tam. | Status |
|---|---|---|---|---|
| **Aplicar + ativar E0–E7 / A0–A2 em prod** | Ligar toda a camada de obra já codificada (EAP, itens, restrições, compras/estoque, financeiro/escrow, medição, Curva-S, projetos). | migrações (Fase 0) | M | **parcial (código pronto, não aplicado)** |
| **Estrutura unificada — Fases 1–4** | Materializar custo/BDI/status no item-mãe → 1:1 forte E2↔E6 + `<ArvoreEscopo>` plena → ambiente como nível real + medição + tools IA → Curva-S no peso. (Fase 0 fecha o elo E2↔E6 no código.) | E0–E7 aplicado | G | **parcial** |
| **Orçamento IA (memorial PDF → planilha)** | Capability-mãe: taxonomia controlada + IA classifica o memorial → planilha executiva/custos/financeira auditável. | estrutura unificada + IA em prod | GG | **não-começado (design pronto)** |
| **Central de Aprovações unificada** | Elevar `/crm/aprovacoes` a superfície cross-domínio (todos os gates sobre `hub_aprovacoes`, IA prioriza+auto-aprova trivial, ensina o agente). | hub_aprovacoes + fix tenant | G | **parcial** |
| **Gestor de Tarefas universal** | Motor `hub_tarefas` (todo verbo→tarefa, executor humano/agente, SLA, aceite, append-only) irmão da Central de Aprovações. | — | GG | **não-começado (design pronto)** |
| **Portal do Cliente** | Usuário próprio do cliente + dashboard honesto que cura os 5 medos (consome avanço/financeiro/diário/cronograma, curado+auditado pelo Hub). | AEC em prod + multi-tenant | GG | **não-começado (design pronto)** |
| **E8 RDO voz/foto + campo · E9 SST/cadastros · E10 copiloto executivo** | RDO mobile voz-primeiro; SST com poder de bloqueio; copiloto que lê a obra da rota + tools `obra_*`. | AEC + IA em prod | G cada | **não-começado** |

### FASE 5 — Os demais (item 6 do dono; longo prazo, o *moat* de ecossistema)
| Item | O que é / por quê | Tam. | Status |
|---|---|---|---|
| **Marketplace / iFood da construção** | Cadeia de serviços com spread por elo + pedidos compartilhados; asset-light, regional, preditivo. | GG | **não-começado (visão)** |
| **Operação de campo — tablet/totem/entrega** | Predição por fase, totem de compra por voz, entrega Lalamove, check-in exclusivo. | GG | **não-começado (visão)** |
| **CRM cross-conta pleno** | Negócio visível nos CRMs de todos os envolvidos (só dono move); dashboards do Hub. | G | **parcial (base Mestre×Vinculado)** |
| **Ponte Membros → fornecedor (B7)** | Gate de elegibilidade + migração idempotente Membros→fornecedor. | M | **não-começado (contrato aberto)** |
| **Imobiliário / portal / cliente final / materiais** | Verticais restantes sobre a coluna compartilhada. | GG | **não-começado (visão)** |

---

## §4 — Pendências do dono (bloqueios)

### Infra / produção (Render + Supabase)
- **Render env:** setar `MISTRAL_API_KEY` (com billing Mistral ativo) e `COPILOTO_HMAC_SECRET`; **remover** `NEXT_PUBLIC_INTERNAL_API_KEY` + `NEXT_PUBLIC_TENANT_ID`; setar `CRON_SECRET`, `GROQ_API_KEY`; confirmar `WEBHOOK_SECRET`/`UAZAPI_*`/`SUPABASE_*`; (com OK) `MOTOR_FONTE=fornecedores`. **Re-testar login** (auth mudou no H-SEC-1).
- **Supabase:** aplicar as ~19 migrações file-only (`supabase db push`), inclusive **todo o bloco AEC** e o índice único de recebível (rodar antes a checagem de duplicatas). Bucket de Storage p/ evidências de medição.
- **Config Auth (reset de senha):** Redirect URLs sem curinga + SMTP próprio + rate-limit/expiração + password policy; **trocar a senha exposta no chat** (`A12345679`).
- **GitHub próprio de backup:** push pendente para `wendelnice-dev/escritorio-virtual-backup` (repo principal é de outro dev — risco de bloqueio).
- **Token Supabase (`sbp_...`):** rotação **adiada pelo dono** (cuidar no futuro; nunca commitar).

### Decisões de negócio abertas
- **Markup dos créditos:** por escritório ou por mercado; rótulo claro (hoje `10` = 10×/1000%).
- **Escrow — papéis distintos por chave** (F-D2 backlog): gravar `user_id` por chave p/ a RPC recusar `arq==hub`.
- **Comissão imutável no fechamento** (snapshot ao ganhar) + **margem** (administração transparente × preço-fechado privada) antes das views do Hub.
- **Captação pública?** `POST /api/parceiros` e `/api/crm/fornecedores` sem sessão — confirmar se landing cria sem login antes de exigir sessão.
- **Faixas × valor exato** nos campos financeiros do comercial (destrava SmartField pleno) · **Voz** on-device × serviço (custo/privacidade) · **densidade do dashboard do Hub** · **pesos do score** · **Compras** (fluxo/campos) · **contrato Membros→fornecedor**.
- **Saldo de Tijolos negativo:** quando ligar o bloqueio (hoje modo sombra).

### Testes ao vivo (com o dono, em prod)
- **3 testes de IA** (`testes-ia-pendentes-validar-com-dono`): (1) "Gerar fluxo com IA" no editor, (2) atendimento WhatsApp, (3) copiloto de voz — corrigir na hora se der erro. Dependem da chave Mistral ligada.

---

## §5 — Recomendação do próximo passo

Duas opções concretas, ambas alinhadas à régua "o melhor para o sistema":

**Opção A (recomendada) — "Ativar a fundação já paga" + fechar o núcleo.**
Fazer com o dono uma **janela curta de produção** que resolve a FASE 0 quase inteira: (1) aplicar as ~19 migrações (destrava toda a camada AEC que já está no repo), (2) ligar a IA (chave Mistral + HMAC), (3) tirar os `NEXT_PUBLIC_*` e **re-testar login**, (4) rodar os 3 testes de IA ao vivo. Em paralelo (sem depender do dono), o CEO avança a **FASE 1 do núcleo**: usar `hub_eventos` de verdade (registros/próxima-ação estruturada/timeline nos 4 cadastros) e o **dedup do intake de formulário** (código único) — as duas alavancas que destravam KPIs reais e fecham o furo de duplicação. *Por quê:* é o maior retorno por esforço — transforma trabalho **já construído mas latente** (AEC, IA) em valor real, e ataca as duas dívidas de gestão que sustentam tudo (eventos + código único), sem tocar em nada irreversível.

**Opção B — "Blindar antes de escalar" (se o horizonte for multi-tenant/vendas já).**
Priorizar a **FASE 2**: confirmar a cobertura total dos guards de papel do finale E2E, fechar a **Fundação Multi-Tenant real** (`current_user_tenant_id()` dinâmica + `fornecedor_id` + ≥2 tenants) e a **integridade do split de comissão** (eventos imutáveis + snapshot). *Por quê:* é o pré-requisito inegociável de B4/B5/B5.5 e do go-live com usuários reais; a análise-mestra marca isso como "go-live blocker" invisível mas grave.

**Sugestão do CEO:** começar por **A** (destrava o máximo com o mínimo, e o dono precisa estar presente para a janela de infra de qualquer forma), deixando **B** engatada logo em seguida — porque a monetização e o Hub (a receita) dependem da fundação multi-tenant que **B** entrega. Não atacar FASE 4/5 (obra conversacional plena, portal, marketplace) antes de A+B: o design está pronto, mas ativá-los sem a fundação (migrações + tenant + IA) seria construir no ar.
