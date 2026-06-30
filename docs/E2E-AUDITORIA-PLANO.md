# E2E — Mapa Completo do Sistema + Plano de Auditoria "tela a tela"

> **Fundação da auditoria E2E "tela a tela, funcionalidade a funcionalidade".**
> Documento READ-ONLY de levantamento (nenhum código foi alterado).
> Gerado em 2026-06-30. Stack: Next.js 16 (App Router) + Supabase. Marca: Obra10+ (dark verde+dourado).

---

## 0. Números do sistema

- **63 `page.tsx`** (rotas/telas) + **5 `layout.tsx`** (root, crm, fornecedor, office, cadastre-se).
- **184 `route.ts`** (endpoints API).
- **~178 componentes** em `components/`.
- **9 domínios** de auditoria (abaixo).
- Gate de fumaça do projeto: `app/_chk23.js` (verifica `/api/health`, `/login`, `/crm`, `/cadastre-se` sem 5xx).
- **Tokens da marca** (em `app/globals.css`): `--obra-verde #003b26`, `--obra-dourado #c9a24a`, `--brand-gold #f4cf72`, `--brand-green-deep #00281a`. **Sem azul Shadcn.** A régua de Design abaixo cobra esses tokens.
- **RBAC** (`lib/crm/crm-permissoes.ts`): 5 níveis — `owner` > `gestor` > `comercial` > `financeiro` > `atendente`. Owners fixos por allowlist de e-mail. Guard real = `crmPodeVerRota`. O menu (`lib/crm-nav-groups.ts`) é filtrado pelo mesmo predicado.

### Telas a destacar de cara (redirects/legado/stub/placeholder)
- **Redirects legados (não são tela de trabalho):** `/crm/lead/[id]` (singular → `/crm/leads`), `/crm/pessoas` (→ `/crm/cadastro`), `/crm/parceiros/novo` (→ `?convidar=1`), `/crm/agentes/novo` (→ `?novo=1`), `/crm/kpis` (→ `/crm/analytics`), `/` (→ `/login`), `/office` (→ `/crm`, "opção A desativada").
- **Stub/duplicado:** `/crm/projetos` é um stub minimalista que **duplica** `/crm/arquitetura` (o funil real). Mesmo endpoint `/api/crm/projetos`.
- **Placeholder "Em breve":** `/crm/conteudo` (100% stub), `/crm/integracoes` (status `em_breve`), bloco financeiro de `/crm/obras` ("A vencer (em breve)", "módulo financeiro chega em breve").

---

## MÉTODO da auditoria E2E (a régua de cada tela)

Cada mesa de domínio aplica **6 lentes** por tela, nesta ordem. Para cada lente: veredito (OK / ATENÇÃO / CRÍTICO) + evidência (arquivo:linha) + ação sugerida.

**(1) Funciona E2E?** — O fluxo principal completa de ponta a ponta? Botão morto, handler vazio, submit que não persiste, fluxo que quebra no meio, erro silencioso (catch que só faz `setLoading(false)` sem feedback). Toda ação (verbo) listada na tela deve ter caminho feliz + caminho de erro visível.

**(2) UX / MOBILE** — Layout mobile real (o dono usa no celular). **Textos sobrepostos**, truncamento, overflow horizontal (tabelas que estouram), toque < 44px, Click-and-Go (preencher = escolher e confirmar, não digitar livre). Tem card view no mobile ou só tabela? Sticky header/safe-area OK?

**(3) Consistência / Design** — Tokens da marca Obra10+ (`--obra-verde`/`--obra-dourado`, dark). **Sem azul Shadcn**, sem cara de "IA genérica". Coerência de cores de status, espaçamento, tipografia (Poppins/Playfair/Space Mono). `style={}` inline vs `className` — sinal de dívida. Tabela usada como **tela de trabalho** é proibida pelo projeto (tabela = relatório).

**(4) Segurança** — Tenant/auth/exposição. Toda query escopada por `tenant_id` (padrão do projeto: `.eq('tenant_id')`, nunca `.or(...is.null)`; guarda `!== tenant` = 404). Rota guardada pelo papel certo (`crmPodeVerRota`). Endpoint público/tokenizado valida token e não vaza dado. Sem segredo no client. Sem PII exposta indevidamente (telefone/CPF).

**(5) Acessibilidade** — ARIA labels em botões-ícone, contraste (dourado sobre verde escuro), navegação por teclado (Esc fecha modal, foco visível), `aria-modal`/`role=dialog` em sideovers, `alt` em imagens.

**(6) Voz do Usuário** — Uma pessoa real (corretor, gestor de obra, atendente, parceiro externo) **entende e consegue** fazer o job sem manual? O rótulo diz o que faz? O vazio (empty state) ensina o próximo passo? Simular o uso tap-a-tap no mobile (pega o que a auditoria de código não pega).

---

## Ordem sugerida de auditoria (por valor × risco)

1. **B — Cadastros** (CPF/CNPJ = chave de tudo; prioridade #1 do dono; tabela-como-tela é risco aqui).
2. **A — Comercial / CRM** (núcleo que vai ser apresentado; leads→negócio→atendimento; maior tráfego).
3. **C — Operações / Obras** (maior superfície + duplicação projetos×arquitetura + abas ricas de obra/[id]).
4. **F — Tarefas / Aprovações** (filas de ação do dia; escrow/gates).
5. **D — Financeiro** (dinheiro; recebível ligado ao negócio; risco de leak cross-tenant já mitigado mas reverificar).
6. **E — IA / Agentes** (diferencial do produto; features que dependem de chave Mistral em prod).
7. **H — Auth / Público / Portais** (porta de entrada + endpoints tokenizados = risco de segurança alto, baixo volume de telas).
8. **G — Admin / Config** (owner-only; menor público; inclui ferramentas internas).
9. **I — Relatórios / Analytics** (read-only; menor risco; valida números das outras telas).

---

# DOMÍNIOS E TELAS

## (A) Comercial / CRM — 11 telas

| Rota | Propósito | Ações / Funcionalidades | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm` | Dashboard comercial (hub de informação) | navegar p/ analytics·relatórios·leads, ver "o que precisa de você" | CrmOQuePrecisaDeVoce, CrmPipelineResumo, CrmUltimosLeads, CrmOperacaoResumo, CrmEquipeResumo, grid KPIs | nenhuma óbvia |
| `/crm/leads` | Gerir leads (3 vistas: Caixa/Kanban/Lista) | criar, filtrar, mover estágio (drag-drop), converter p/ negócio, perdido/spam, direcionar a parceiro, assumir/devolver da IA | LeadRapidoSideover, PipelineTabsBar, LeadKanbanCard, DirecionarLeadDrawer, EncaminhamentosPendentesPanel | nenhuma óbvia |
| `/crm/leads/[id]` | Ficha completa do lead | editar, mover estágio, próxima ação (agendar/reagendar/concluir), nota, vincular pessoa, criar negócio, converter p/ obra/projeto, gerar recebível | CrmStickyTabs, LeadPropostasPanel, DistribuirLeadPanel, timeline, FinanceiroNovoLancamentoModal | nenhuma óbvia |
| `/crm/lead/[id]` | **LEGADO** — redirect p/ `/crm/leads?lead=[id]` | redirect | — | **Rota singular duplica `/crm/leads/[id]`; confunde URL strategy; considerar deprecação** |
| `/crm/distribuicao` | Distribuição de leads + auditoria da rede + regras de roteamento | distribuir manual, ver métricas (entregas/recusas/bloqueios), rodar auditor, liberar/cobrar fornecedor, CRUD regra, filtrar | FilaDistribuicao, scorecard fornecedores, timeline eventos, grid de regras | nenhuma óbvia |
| `/crm/negocios` | Pipeline de negócios (Kanban/Lista) | criar, filtrar, mover etapa (drag-drop/modal), paginar, alternar vista | NegocioFormDrawer, PipelineTabsBar, NegocioKanbanCard, PipelineConfigSideover | nenhuma óbvia |
| `/crm/negocios/[id]` | Ficha do negócio | editar valor/desc, mover etapa (motivo obrig. se perdido), próxima ação, vincular pessoa, arquivar, gerar obra/projeto, lançar recebível, nota | seletor 8 etapas, picker pessoa, CrmRastreioCadeia, FinanceiroNovoLancamentoModal | nenhuma óbvia |
| `/crm/atendimento` | Central de atendimento (inbox chat realtime) | selecionar conversa, filtrar (todos/meus/humano/ia), assumir/devolver IA, enviar msg, quick replies, abrir ficha | lista leads, área chat, composer, sideover info | nenhuma óbvia |
| `/crm/canais` | Status operacional de canais WhatsApp | refresh, filtrar por modo, buscar, reconectar/configurar canal | KPI cards, SearchBar, FilterPills, CrmCanalSideover | nenhuma óbvia |
| `/crm/canais-entrada` | Cadastro de fontes de lead | adicionar canal, toggle ativo, excluir | form grid 5 col, lista status, CrmConfirmDialog | nenhuma óbvia |
| `/crm/trafego` | Tráfego/Marketing (Windsor.ai, owner-only) | filtrar período (7/14/30d), ver KPIs, listar campanhas | KPI cards, campanha list (cards mobile/tabela desktop), empty/403 amigável | nenhuma óbvia |

## (B) Cadastros — 12 telas

| Rota | Propósito | Ações / Funcionalidades | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/cadastro` | Hub unificado de contatos (PF/PJ) + empresas | listar, filtrar (tipo/UF/origem/área/segmento/mercado/ativo), buscar, criar PF/PJ, editar (sideover), excluir individual+massa, mesclar duplicatas, vincular pessoa-empresa, convidar parceiro | CadastroListaTable/Cards, CadastroWizard, CadastroContactoSideover, CadastroEmpresaSideover, ParceiroLinkWizard, ColunasMenu, CrmConfirmDialog | **tabela-como-tela** (edit/delete inline em rows); botões de header com `style={}` inline; telefone exposto a clique no card mobile; bulk-delete sem loop de confirmação |
| `/crm/pessoas` | **LEGADO** — redirect p/ `/crm/cadastro?tab=contactos` | redirect | — | nenhuma óbvia |
| `/crm/pessoas/[id]` | Ficha de pessoa (abas: resumo/dados/vínculos/relacionados) | ver, editar inline (nome/tel/email/cidade/UF), navegar abas, ver relacionados | CadastroFichaTabs, CadastroVinculosPessoaEmpresa, CadastroFichaRelacionados | **catch do PATCH silencioso** (só `setSalvando(false)`, sem feedback de erro de rede) |
| `/crm/pessoas/duplicatas` | Revisar e mesclar duplicatas (CPF/tel/email) | listar pares, comparar lado a lado, escolher vencedor, mesclar (perdedor arquivado, reversível) | par cards, modal comparação 2-col, toggle vencedor, botão Mesclar (gated) | merge gated por flag de homologação (intencional); nenhuma óbvia |
| `/crm/contatos` | Contatos de notificação (quem recebe alertas) | listar, criar, editar, remover, toggle ativo, escolher canal (WhatsApp/email/ambos) | form inline, toggle ativo, chips de evento, card list | nenhuma óbvia |
| `/crm/parceiros` | Lista de parceiros (3 status-tabs: captação/homologação/homologados) | listar por status, filtrar, buscar, convidar, abrir detalhe, multi-select | CrmStickyTabs, CadastroListaTable, ParceiroLinkWizard | **multi-select sem botão de bulk-action** (UI incompleta); stats redundantes |
| `/crm/parceiros/[id]` | Ficha gestora do parceiro (perfil/módulos/docs/refs/logs) | editar distribuição (mercado, recebe_leads, status), avançar módulo, copiar link portal | CrmStickyTabs, MercadoLeadPicker (single), toggle, timeline logs | mercado **single-select** aqui vs multi em fornecedores (coexistência de schema); link portal = 401 em prod (curl-only); "Avançar módulo" sem confirmação |
| `/crm/parceiros/novo` | **LEGADO** — redirect p/ `?convidar=1` | redirect | — | nenhuma óbvia |
| `/crm/fornecedores` | CRUD de fornecedores + motor de distribuição | listar, criar, editar, deletar, toggle recebe_leads, mercados (multi), status homologação | form inline, MercadoLeadPicker (multi), toggle, select status | edição direta no form sem confirmação destrutiva; normalização de área legada (OK) |
| `/crm/especialistas` | Mão de obra (sem login; link auto-inscrição) | listar, criar, editar, deletar, copiar link convite, toggle tem_equipe | form inline (especialidades chips, experiência, equipe), card com badge verificado | `verificado` tri-state (UI só mostra se true); form embutido sem modal |
| `/crm/empresas` | **Escritórios** (admin multi-tenant, owner-only) | listar escritórios, criar (nome+admin), ativar/desativar, gerir permissões | modal criar, CrmPermissaoSelect, card tenant, toggle | `window.confirm` p/ desativar; loading infinito se sessão null (mitigado) |
| `/crm/empresas/[id]` | Ficha de empresa cadastro (abas) | ver, editar inline, liberar acesso (acesso_habilitado), navegar abas, ver vínculos | CadastroFichaTabs, CadastroVinculosPessoaEmpresa, CadastroFichaRelacionados | espelha pessoas/[id]; nenhuma óbvia |

> **Atenção de domínio:** `/crm/cadastro`, `/crm/parceiros` e `/crm/empresas` usam tabela como tela de trabalho — a régua de Design do projeto pede telas para o job (conversacional/Click-and-Go), tabela vai p/ `/crm/relatorios`. Cadastro tem fallback de cards no mobile; parceiros/empresas precisam verificar.

## (C) Operações / Obras — 7 telas

| Rota | Propósito | Abas (telas [id]) | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|---|
| `/crm/projetos` (nav "Arquitetura") | **STUB** — lista minimalista de projetos | — | criar (modal), filtrar por negócio, links | ProjetosPageInner, EntitySelect, EmptyState | **DUPLICA `/crm/arquitetura`** (mesmo endpoint); sem funil/EAP/abas; candidato a remover da nav |
| `/crm/arquitetura` | Funil kanban de projetos (Briefing→Entregue) + fila aprovação | 2 segmentos (Carteira/Hoje) | criar (sideover), mover estágio, buscar, abrir fila "Em aprovação", editar etapas | NovoProjetoSideover, ProjetoKanbanCard, PipelineConfigSideover, KPIs | **funil REAL**; drag desabilitado no mobile; pipeline_id pode ser NULL (legado) |
| `/crm/arquitetura/[id]` | Ficha de projeto | **Conversar · Programa · Funil · Entregáveis · Engenharia** | mover estágio, editar cômodos/metragem, CRUD+enviar entregáveis, registrar resposta cliente, gerar obra | ABAS, ComodoChip, CatalogoComodos, EntregaveisAba, GerarObraSideover | gate A2 hardcoded (`estagio==='entregue' \|\| aprovado`); undo local 5s (não salva até expirar); sem validação de cômodo duplicado; abas viram select no mobile |
| `/crm/obras` (nav "Engenharia") | Cockpit de carteira + painel "Hoje" | 2 abas (Carteira/Hoje) | filtrar (saúde/tipo), abrir EAP editor, nova obra, ir p/ Hoje filtrado, concluir fase | CardObra, BarraAvanco, PillAlerta, SecaoHoje, NovaObraSideover, EapEditorSideover | "Pagamentos a vencer" = **placeholder cinza "em breve"**; concluir fase otimista (reload se falha) |
| `/crm/obras/[id]` | Painel de obra | **Escopo(EAP) · Itens & Avanço · Compras & Estoque · Financeiro · Painel** | render por aba, voltar | ArvoreEscopo, ObraItensSecao, ObraComprasEstoqueSecao, ObraFinanceiroSecao, SecaoHistoricoMedicoes | aba **Painel** (Pedidos/Check-ins/Diário) parece bruto/placeholder; dados carregados 1x no load; mobile responsivo parcial (max-w 960px inline) |
| `/crm/imoveis` | Catálogo de imóveis (2 vistas: cards/tabela) | — | buscar, filtrar (finalidade/ativos), editar status inline, criar/editar (drawer), paginar | ImovelFormDrawer, KpiBar, SearchBar, FilterPills, CardObra | tabela pode dar overflow no mobile (sem scroll); fotoCapa read-only (de metadata); paginação por offset |
| `/crm/pedidos` | Pedidos de material (lista) | — | criar (modal), filtrar por obra, mudar status (select), link p/ obra | EntitySelect, EmptyState, modal | carrega **todas** as obras sem paginação no seletor (escala); sem busca/filtro de pedidos; sem totalizador de valor |

> **CRÍTICO de domínio:** decidir o destino de `/crm/projetos` (stub) vs `/crm/arquitetura` (real). A nav aponta "Arquitetura" para `/crm/projetos` — verificar se está enviando o usuário ao stub em vez do funil real.

## (D) Financeiro — 3 telas

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/financeiro` | Visão financeira (overview: saldo/receitas/despesas) | navegar receber/pagar, ver totais | CrmFinanceDashboard, useFinanceDashboard | wrapper mínimo; nenhuma óbvia |
| `/crm/financeiro/receber` | Contas a receber | registrar lançamento, filtrar (status/vencidas/7d), CSV, atualizar | FinanceiroContasList, FinanceiroNovoLancamentoModal | tenant scope mitigado (`tenantScopeOrFilter`); origem ligada a negócio; mobile OK |
| `/crm/financeiro/pagar` | Contas a pagar | registrar lançamento, filtrar, CSV, atualizar | FinanceiroContasList, FinanceiroNovoLancamentoModal | espelha receber; sem vínculo a negócio_id (só contas brutas); mobile OK |

## (E) IA / Agentes — 9 telas

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/agentes` | Lista-mestra de agentes + sidepanel detalhe | criar, buscar/filtrar segmento, ativar/inativar, excluir, editar, ver saúde/ciclos/ações | AgenteNovoWizard, CrmCargosCatalogDrawer, AgenteSideoverCards, CrmBotRingAvatar, SideoverFold | cache em refs 15s TTL; slice hardcoded 12 itens; nenhuma crítica |
| `/crm/agentes/novo` | **REDIRECT** p/ drawer (`?novo=1`) | redirect | — | nenhuma óbvia |
| `/crm/agentes/[slug]` | Editor full-page do agente (identidade/personalidade/horário/ferramentas/playbook) | salvar config, limpar memórias, calibrar playbook, briefing chat, sync Mistral, arquivar | sliders 5 eixos, AgenteBriefingDrawer, AgentePlaybookCalibracaoDrawer, AgenteFerramentasIaBlock, AgenteUazapiBlock | **sync Mistral exige API key (prod-only)** — falha local; preservação personalidade wizard×5-eixos (bem tratada); botões IA fora do header no mobile |
| `/crm/agentes-reais` (nav "Copiloto") | Central do Copiloto de Voz (histórico de comandos) | ver histórico (últimos 20) — **read-only** | cards "como usar", lista histórico | Supabase direto no useEffect sem skeleton; modelo por regex `/claude/i`; **nenhuma ação** (puro read-only) |
| `/crm/ciclos` (nav "Automações") | Automações por agente (3 abas: Ciclos/Logs/Alertas) | CRUD ciclo, executar agora, ativar, limpar cron, sugerir desc/follow-up com IA, resolver alerta | CrmStickyTabs, EntitySelect, FollowupConfigLite, drawer sub-abas | follow-up avançado por heurística de nome; sugestão IA em background; timeline lazy |
| `/crm/ferramentas` | Catálogo de ferramentas IA (built-in + custom) | ver por categoria, ver agentes que usam, owner: gerir custom (drawer) | CrmFerramentasCustomDrawer, grid por categoria | catálogo limpo, read-only p/ gestor; nenhuma óbvia |
| `/crm/creditos` (nav "Carteira de Tijolos") | Saldo + consumo da moeda IA (Tijolos) | atualizar saldo, ver consumo por origem/modelo | card saldo (gradiente dourado / "modo de medição"), extrato | Supabase direto sem retry; `custo_brl` oculto ao usuário (intencional) |
| `/crm/precificacao` (owner-only) | Config de preços super-admin (markup/câmbio/Tijolo/preços por modelo) | salvar config global, salvar preço por modelo | 2 cards (Moeda&margem, grid de preços) | única tela com R$ (resto Tijolos — correto); modelos hardcoded "Turbo/Econômico" |
| `/crm/integracoes` | Status de credenciais (WhatsApp/Windsor/Anthropic/Meta/Google/GA4) | **read-only**; link Abrir/Configurar | cards por integração + status badge | **badge "Em breve"** (contradiz copiloto live); fetch sem retry |

## (F) Tarefas / Aprovações — 2 telas

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/tarefas` | Próximas ações agrupadas (atrasadas/hoje/próximas) | marcar feito, ligar (tel:), WhatsApp, abrir lead, atualizar | CrmStickyPageHeader, cards com border colorido, botões one-tap | realtime via supabase.channel; otimista com reverte; mobile OK |
| `/crm/aprovacoes` | Fila de decisões da IA (por tipo) | aprovar, rejeitar, filtrar por tipo | cards grid com top-border por tipo, toast | fetch tenant-safe via server route; mobile+desktop; nenhuma óbvia |

## (G) Admin / Config — 6 telas

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/configuracoes` | Ambiente, horário comercial, distribuição auto, follow-up | health check (env), editar horário/timezone, toggle distribuição, prazo validação, horas de follow-up | CrmStickyPageHeader, health grid, time inputs | health owner-only; fallback silencioso em erro de save; sem UI p/ criar cadência nova (aponta p/ Automações) |
| `/crm/usuarios` | Usuários & Permissões (colaboradores com login) | convidar por email, editar role, desativar/reativar | modal convite (+ tenant picker se owner), tabela/cards, CrmPermissaoSelect, CrmConfirmDialog | normalização de role só na UI; owner escolhe tenant (gestor/comercial não, sem indicação visual); modal não fecha até refetch |
| `/crm/onboarding-tenant` (owner) | Checklist de onboarding do escritório | ver progresso %, ler passos, "Configurar" (links), ir p/ dashboard | progress bar, lista de steps | endpoint server-side (tenant da sessão); sem refresh automático |
| `/crm/progresso-sistema` (owner, interno) | Tracker interno de build | delegado | ProgressoSistemaDashboard | **ferramenta interna de dev exposta por URL** (fora do menu) |
| `/crm/conteudo` | Módulo de Conteúdo (IA) | — **sem ações** | grid 6 categorias, placeholder central | **100% STUB "Em breve"** — deadweight na nav até release |
| `/crm/relatorios` | Consulta operacional (resumo + tabela detalhada) | ver resumo (5 cards), trocar entidade (abas), atualizar, limite 500 linhas | CrmStickyPageHeader, resumo, tabela scrollável | truncação silenciosa em 500; "Fonte: /api/crm/metricas" impresso (texto de debug?); sem botão exportar visível |

## (H) Auth / Público / Portais — 11 telas

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/` | Landing pública | redirect → `/login` | next/navigation | passthrough |
| `/login` | Autenticação (email/senha + recuperação) | login, recuperar senha, validar sessão, sync token CRM | LoginForm, LoginHeroPanel, Obra10BrandHeader | hash de recovery limpo da URL; workaround de autofill lê DOM; msg neutra anti-enumeração (bom) |
| `/cadastre-se` | Captura de lead público (empresa) | cadastrar empresa (server action) | HubPublicShell, HubLeadFormServer | só lead capture (sem senha); server action não auditada aqui |
| `/redefinir-senha` | Conclusão do reset de senha | redefinir senha (8+ chars), confirmar | strength check, Supabase updateUser | hash limpo da URL; estados expirado/sem_sessão tratados (bom) |
| `/office` | "Escritório virtual" legado | redirect → `/crm` | — | **rota morta** ("opção A desativada") |
| `/fornecedor` | Home do portal do fornecedor (protótipo) | acesso ao fluxo de cotação | nav link simples | landing mínima (Fase 3) |
| `/fornecedor/cotacao` | Workflow de cotação (RFQ) | criar pedido, registrar resposta, submeter p/ aprovação | fetch /api/cotacoes/pedidos, forms | **sem auth guard visível** (depende de internalApiHeaders); status string cru; estilo mínimo |
| `/parceiro` | Home do portal do parceiro | abrir painel (link assinado), cadastro por convite | nav estática | landing mínima |
| `/parceiro/dashboard` | Painel do parceiro (signed-URL) | validar acesso (id+s), ver resumo (status/comissão/leads) | Painel + POST /api/parceiros/portal/verify | **esquema signed-URL custom** (id+s em query, sem OAuth) — verificar robustez da assinatura |
| `/parceiro/cadastro/[token]` | Auto-cadastro de parceiro via token | verificar token, cadastrar PF/PJ, gerar código | validação contra hub_links_cadastro | **token hardcoded `PARCEIRO_LINK_TOKEN_REDE` bypassa DB** (signup público de rede); lógica de expiração presente; estilo inline |
| `/especialista/cadastro` | Auto-cadastro de mão de obra (sem token) | cadastrar, escolher especialidades, experiência, equipe | FormConvite (Suspense), multi-select | **totalmente aberto (sem token)**, só param `por`; valida nome+telefone+1 especialidade |

> **Atenção de segurança (lente 4):** o cluster H concentra o maior risco — `/fornecedor/cotacao` sem guard visível, `/parceiro/dashboard` com assinatura custom, `/parceiro/cadastro/[token]` com token-mestre hardcoded, `/especialista/cadastro` aberto. Auditar profundamente validação de token, rate-limit e escopo de dado retornado.

## (I) Relatórios / Analytics — 3 telas (compartilhadas com Admin)

| Rota | Propósito | Ações | Componentes-chave | Suspeitas |
|---|---|---|---|---|
| `/crm/analytics` | Dashboard de analytics | delegado | CrmAnalyticsDashboard | wrapper; auditar o componente real |
| `/crm/kpis` | **LEGADO** — redirect → `/crm/analytics` | redirect | — | órfão na nav (intencional) |
| `/crm/relatorios` | Relatório operacional (resumo + tabela) | (ver domínio G) | — | (ver domínio G) |

---

## Apêndice — Sinais varridos em `app/` (sweep automatizado)

**TODO/FIXME (apenas 3, todos comentários técnicos, nada acionável):**
- `app/crm/financeiro/receber/page.tsx:35` — guarda de resolução de tenant
- `app/api/crm/negocios/route.ts:342` — nota de cálculo de KPI
- `app/api/crm/obras/[id]/escopo/route.ts:190` — zeragem de campo por persona

**"Em breve" / placeholder / stub (telas inacabadas — priorizar na auditoria):**
- `app/crm/conteudo/page.tsx:28` — "Em breve" (seção 100% stub)
- `app/crm/integracoes/page.tsx:15` — status `em_breve`
- `app/crm/obras/page.tsx:747,908,912` — bloco financeiro/pagamentos "em breve"
- `app/api/copiloto/interpretar/route.ts:99,106` — ações por voz adiadas
- `app/parceiro/cadastro/[token]/page.tsx:285` — texto "entra em contato em breve"

**console.* :** ~45 em `api/` (logging de erro em webhooks/auth/ML — aceitável), 1 em `crm/`, 1 em `cadastre-se/`. Sem ruído relevante no frontend.

**Layouts:**
- `app/layout.tsx` — fonts (Poppins/Playfair/Space Mono), MobileDetector + IOSInstallBanner (dynamic), ToastViewport, PWA (manifest, theme `#003b26`, viewport lock), metadata Obra10+.
- `app/crm/layout.tsx` — shell do CRM: sidebar (mini/expandida/flyout), header universal, drawer mobile, CrmCommandPalette (Ctrl+K), CrmQuickAdd, CopilotoVoz (FAB voz), guard de rota por papel.
- `app/fornecedor/layout.tsx`, `app/office/layout.tsx`, `app/cadastre-se/layout.tsx` — wrappers mínimos (cadastre-se usa HubPublicShell).

---

## Como conduzir cada bloco (operacional)

Para cada domínio, na ordem acima:
1. Abrir o app no navegador (desktop + mobile) e percorrer cada tela da tabela do domínio.
2. Para cada tela, aplicar as 6 lentes; registrar veredito + evidência (arquivo:linha) + ação.
3. Marcar achados como **CRÍTICO** (quebra/segurança), **ATENÇÃO** (UX/design/dívida), **MELHORIA OPCIONAL**.
4. Rodar o gate `node app/_chk23.js` ao fim de mudanças.
5. Correções aditivas, preservando lógica; sem push sem pedido; migrações aditivas.
