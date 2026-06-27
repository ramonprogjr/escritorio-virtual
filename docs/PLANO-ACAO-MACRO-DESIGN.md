# 🗺️ Plano de Ação Macro — Design/UX (CEO)

> Síntese do CEO sobre TODO o sistema, a partir do diagnóstico das 33 telas ([docs/diagnostico-telas/](diagnostico-telas/README.md)). A incorporar ao plano macro. 27/jun.

## ▶️ STATUS DE EXECUÇÃO (27/jun — atualizado)
- **F0 (fachada/mentira de dado) — ✅ COMPLETO + deployado.** Barra fake 0.42, confiança 85%, ring 0.35, KPIs sobre página paginada (Negócios/Imóveis→agregado backend), Conversões=0 (Campanhas), valor financeiro arredondado→exato, status sem cor (captacao).
- **F1 (copy/vazamento/idioma/cor) — ✅ COMPLETO (itens seguros) + deployado.** UAZAPI→WhatsApp, MISTRAL_MODEL/Supabase/nomes de tabela/porta 3001→linguagem de negócio, PT-PT→PT-BR (A carregar/activo/gerir/contacto/equipa/acção), links azuis Shadcn→dourado, botão Sair no padrão, traço "—" fora dos headers, botão "+ Parceiro" removido do Dashboard. **Decisões CEO:** Parceiros→Fornecedores **deferido** (rename estrutural, precisa migração); azuis **semânticos mantidos** (são código de cor, não chrome).
- **F2 (blindar ações sensíveis) — ✅ COMPLETO + deployado.** Toast ganhou "Desfazer" (reutilizável). Financeiro pagar/receber (loading+erro+undo), Contatos (telefone mascarado+validado), Distribuição Liberar/Cobrar (confirmação+toast nominal), Usuários cortar acesso (confirmação "desativa não exclui"+toast). Negócios/Aprovações já eram seguros. Cadastro bulk-delete já confirmado (remover = item de F4, não pendência).
- **F3 (ativar IA-first onde o motor já existe) — PRÓXIMO.**
- F4 (tabela→cards + KPIs duplicados), F5 (separar plataforma×tenant), F6 (financeiro/obra ao motor) — na fila.

### ⚠️ DIRETRIZ DO DONO (27/jun) — revisão de design COMPLETA (F4/F5, deferida até agentes 100%)
O dono cobrou que **todas as telas ainda têm azul/roxo fora da marca** e quer revisão completa: cores na identidade, layouts, cards, botões e **apresentação da informação**. **Reverte a decisão anterior** de "manter azuis semânticos" — agora é harmonizar TUDO na paleta da marca (dourado+verde+âmbar+vermelho+neutro, SEM monocromático). Escopo: 97 ocorrências de azul/roxo em 29 arquivos; tokens `--obra-*`/`--brand-*` já existem. Ver memória `design-overhaul-deferido`. **Ordem combinada:** terminar a tarefa dos AGENTES primeiro (#4 RAG, #3 playbook), depois esta revisão.

---

## Parecer do CEO
O sistema está mais maduro do que parece à primeira vista: há um esqueleto correto e repetível em quase toda parte (cards em vez de planilha, estados de erro/vazio honestos, identidade dark verde+dourado coesa, backend real e multi-tenant). Telas como Leads, Atendimento, Aprovações, Visão financeira e Distribuição já provam que sabemos fazer "tela de trabalho" no nosso padrão. O problema NÃO é arquitetura — é três dívidas que se repetem e corroem a régua do produto.

PRIMEIRA DÍVIDA (a que mais dói e a única que bloqueia QUALQUER apresentação): fachada e mentira de dado. Barra de progresso fake 0.42 em Negócios; confiança "IA 85%" fabricada em Aprovações; ring de saúde 0.35 hardcoded em Agentes e Ciclos; KPIs calculados sobre a página paginada que mudam ao clicar "carregar mais" em Negócios e Imóveis; valor financeiro arredondado para "R$ 2k" em telas que existem para CONCILIAR e PAGAR; "Conversões=0" sempre em Campanhas porque a API não pede o campo; selo "Verificado" sem fluxo em Especialistas. Num produto que clientes VÃO USAR DE VERDADE, número que mente é pior que número ausente — destrói a confiança no sistema inteiro. Isso é P0 e tem que sair antes de tudo.

SEGUNDA DÍVIDA (a promessa central não cumprida): somos "IA-first" no diagnóstico e "formulário de 2010" na AÇÃO. A IA mostra, observa, exibe contagem — mas raramente SUGERE e executa em um toque. Pior: temos telas que pedem para DIGITAR UUID (Pedidos, Projetos, Ciclos com slug), texto livre que quebra o motor (área de atuação em Fornecedores, UF em Distribuição) — o anti-padrão exato que proibimos. A maior oportunidade do produto está parada: "Ação agora" do Dashboard, "Sugerir resposta" no Atendimento, "Próxima ação" em Negócios, a fila de distribuição que dá nome à própria tela de Distribuição. Onde já existe motor pronto (sugerir-encaminhamento, DistribuirLeadPanel), nem ligamos na UI.

TERCEIRA DÍVIDA (público errado / vazamento técnico): dezenas de telas falam a língua do engenheiro com o dono de escritório — nomes de env var (UAZAPI, WINDSOR_API_KEY, ANTHROPIC), nomes de tabela (hub_kpis_resultados, hub_followup_config), slugs, "porta 3001", instruções de SQL, UTC manual, jargão "parceiro" divergente do modelo-mestre, PT-PT ("registo", "activar"). E telas de plataforma/admin (precificação, env vars, distribuição-hub) misturadas com as do fornecedor. Isso não é cosmético: fere "acima de tudo ÚTIL e FÁCIL DE ENTENDER" e mata a percepção premium.

DIREÇÃO: não há refatoração grande a fazer — há PODA, HONESTIDADE e ATIVAÇÃO DE IA, tudo aditivo e reversível. A sequência correta é: (1) estancar as fachadas e mentiras de dado em todo o sistema (rápido, alto retorno de confiança); (2) limpar vazamento técnico e nomenclatura (copy, barato, eleva tudo); (3) fechar os jobs IA-first onde o motor já existe (Distribuição, Atendimento, Dashboard, Tarefas, criação obra/projeto a partir de negócio); (4) virar formatos pesados (tabelas de trabalho) onde resta planilha; (5) deferir conscientemente o que depende de dados do dono (gestão de obra, módulo de arquitetura real). Respeitar sempre verde+dourado, aditivo, com gates (tsc+vitest+_chk23). O sistema está a um esforço de poda e ativação de virar genuinamente premium e IA-first — não de uma reescrita.

## Temas transversais (padrões em várias telas)
- FACHADA / MENTIRA DE DADO (P0 sistêmico): números fabricados ou inconsistentes que corroem a confiança — progresso 0.42 (Negócios), confiança 85% (Aprovações), ring 0.35 (Agentes/Ciclos), KPIs sobre página paginada que mudam ao paginar (Negócios, Imóveis), Conversões=0 sempre (Campanhas), selo Verificado órfão (Especialistas). Regra: número que mente é pior que ausente.
- VALOR FINANCEIRO ARREDONDADO em telas de conciliação: 'R$ 2k' onde precisa ser R$ 1.999,00 (Contas a pagar, Contas a receber). Precisão vence elegância no item que será efetivamente pago. Dois formatadores: exato (item) vs abreviado (KPI agregado).
- IA-FIRST SÓ NO DIAGNÓSTICO, AUSENTE NA AÇÃO: a IA mostra/observa mas não SUGERE+EXECUTA em 1 toque. Falta o Click-and-Go real em Dashboard (Ação agora), Atendimento (sugerir resposta), Negócios (próxima ação), Tarefas, Distribuição (fila com confirmar), Pedidos/Obras/Projetos (nascer do negócio).
- DIGITAR EM VEZ DE ESCOLHER (anti-padrão proibido): UUID/slug/texto-livre digitados à mão — ID de obra (Pedidos), ID de negócio (Projetos), agente_slug (Ciclos), UF livre (Distribuição), área de atuação livre (Fornecedores). Substituir por seletor/chips com IA pré-selecionando.
- VAZAMENTO TÉCNICO PARA O USUÁRIO FINAL: env vars (UAZAPI, WINDSOR_API_KEY, ANTHROPIC), nomes de tabela (hub_kpis_resultados, hub_followup_config), slugs, 'porta 3001', SQL de migração, UTC manual, código de função (hub_lead_resumo). Esconder atrás de modo admin ou traduzir para linguagem de negócio.
- TABELA COMO TELA DE TRABALHO (régua eterna violada): planilhas onde deveria haver cards/Kanban — Cadastros (21 colunas default), Parceiros (11 colunas), Imóveis (sem foto num domínio visual), Lista de Leads, Canais. A tabela densa vai para /crm/relatorios como export.
- NOMENCLATURA E IDIOMA INCOERENTES: 'parceiro' divergente do modelo-mestre (é fornecedor/empresa), PT-PT ('registo','activar','partilha','gerir'), e azuis Shadcn (#60a5fa, #93c5fd, #a78bfa) fora da trava verde+dourado em várias telas.
- MÉTRICAS DUPLICADAS / TRÊS FONTES DA VERDADE: os mesmos KPIs aparecem em Dashboard, Analytics, KPIs e Relatórios (mesmo useMetricas); 'Receita potencial'=Pipeline; 'Mercado' 3x no card de Negócios. Eleger fonte única por número.
- DOIS DONOS NUMA TELA SÓ (comercial vs hub): telas misturam o fornecedor que vende com o operador da rede que distribui/homologa/precifica. Condicionar blocos por perfil em vez de bifurcar telas; esconder o que é admin/hub do fornecedor comum.
- AÇÃO SEM FEEDBACK / SEM UNDO em operações sensíveis ou financeiras: Marcar pago/recebido, Cobrar, Liberar, cortar acesso, excluir — disparam em silêncio, sem toast/loading/desfazer. Vão usar de verdade; clique acidental com efeito financeiro ou de acesso é inaceitável.
- CONFIRMAÇÃO/SELEÇÃO EM MASSA QUE É FACHADA: checkboxes de seleção múltipla que só servem para excluir ou não disparam nada (Cadastros, Parceiros). Remover até haver ação de valor (distribuir, atribuir, exportar).
- CRIAÇÃO DESCONECTADA DO TODO (deveria nascer de evento): obra/projeto/recebível/pagável nascem de digitação avulsa em vez de derivar de negócio ganho / medição / compra — quebrando código único, comissão e a cadeia venda→execução.

## Telas prioritárias (ordem)
- Negócios — fachada (progresso 0.42) + KPI que mente (paginação) + ruído no card; tela central do funil, P0
- Aprovações — confiança 85% fabricada na tela cartão-postal do IA-first; P0 trivial de matar
- Contas a pagar / Contas a receber — valor arredondado em tela de pagamento + ações sem undo; P0 financeiro
- Campanhas (Tráfego) — Conversões=0 sempre (métrica que liga marketing ao funil está morta); P0
- Distribuição de leads — a tela não deixa DISTRIBUIR (motor pronto, não ligado); fechar o JOB que dá nome a ela
- Fornecedores — não habilita o fornecedor para o motor (mercados+recebe_leads+status ausentes na UI); sem ela o Hub não distribui nada
- Dashboard — excesso/duplicação de KPIs e ausência de recomendação IA no topo; é a porta de entrada
- Atendimento — respostas fixas de chatbot onde deveria haver sugestão de IA; coração operacional
- Agentes IA + Automações (Ciclos) — fachada do ring + edição não-IA-first + jargão de DevOps exposto ao dono
- Cadastros + Parceiros + Imóveis — tabela como tela de trabalho num domínio que pede cards/foto/Kanban
- Configurações — secrets de plataforma misturados com regras do tenant + bug de loading compartilhado
- Tarefas comerciais — stub read-only com empty-state vazando 'crie via API'; promover ou esconder

## Fases do plano de ação

### Fase 1 — Fase 0 — Estancar fachada e mentira de dado (P0, apresentável)  _(risco baixo)_
**Objetivo:** Remover de TODO o sistema os números fabricados e inconsistentes que destroem a confiança, para que nenhuma tela minta numa apresentação. Sem isso, nada mais importa.
**Telas-alvo:** Negócios, Aprovações, Agentes IA, Automações/Ciclos, Imóveis, Campanhas/Tráfego, Contas a pagar, Contas a receber, Especialistas, Analytics, Relatórios

**Ações:**
- Negócios: remover a barra de progresso fake (fallbackProgress=0.42) — usar índice-da-etapa/total ou remover o elemento.
- Negócios e Imóveis: calcular KPIs e somas de coluna por COUNT/agregado no BACKEND sobre todo o pipeline/carteira, nunca sobre a página de 20 — eliminar números que mudam ao paginar.
- Aprovações: remover o default '?? 85' de confianca_ia (route.ts:36) — só renderizar a barra quando a IA realmente computou; senão ocultar.
- Agentes IA e Ciclos: matar o ring de saúde hardcoded (0.35 e fórmula 0.18+exec*0.08) — ligar ao cálculo de saúde real existente ou trocar por status textual ('Ativo · resp. há Xh').
- Campanhas: incluir 'conversions' nos fields da chamada Windsor (route.ts L20) e tipar c.conversions — a métrica que liga marketing ao funil não pode ser sempre 0.
- Contas a pagar e a receber: usar formatador de moeda EXATO com centavos no item (R$ 1.999,00); reservar abreviação k/M só para KPIs agregados de cabeçalho.
- Especialistas: remover o selo 'Verificado' órfão até existir fluxo real de verificação.
- Analytics e Relatórios: cobrir status faltantes em STATUS_COR (ex.: 'captacao' default do POST de Imóveis) para não nascer cinza com texto cru.
**Critério de pronto:** Nenhuma tela exibe número fabricado, default disfarçado de dado real, ou KPI/soma que muda ao paginar; valores financeiros de item exibidos com centavos; gates tsc+vitest+_chk23 verdes; verificação clicando no navegador.

### Fase 2 — Fase 1 — Limpar vazamento técnico, idioma e coesão visual (copy/poda)  _(risco baixo)_
**Objetivo:** Elevar a percepção premium e a clareza em todo o sistema removendo jargão de dev, nomenclatura errada, PT-PT e azuis fora da marca. Barato, amplo, baixíssimo risco.
**Telas-alvo:** Analytics, Relatórios, Dashboard, Canais, Atendimento, Tarefas, Ciclos, Ferramentas IA, Integrações, Configurações, Canais de entrada, Projetos/Arquitetura, Fornecedores, Pedidos

**Ações:**
- Remover todo vazamento técnico ao usuário final: 'porta 3001', nomes de tabela (hub_kpis_resultados, hub_followup_config), env vars (UAZAPI, WINDSOR_API_KEY, ANTHROPIC), slugs, código de função (hub_lead_resumo), instrução SQL de migração e string crua do Postgrest — trocar por linguagem de negócio ou esconder atrás de modo admin/owner.
- Padronizar nomenclatura ao modelo-mestre: 'parceiro/parceiros' → 'fornecedor/empresa' nas telas comerciais; remover botão '+ Parceiro' do Dashboard.
- Padronizar PT-BR: 'registo'→'registro', 'activar'→'ativar', 'partilha'→'compartilhamento', 'gerir'→'gerenciar', 'A carregar'→'Carregando'.
- Repintar azuis Shadcn (#60a5fa, #93c5fd, #a78bfa, #58a6ff) e laranja #f97316 para tokens verde+dourado (--obra-*/--brand-*, dourado #c9a24a) em Canais, Projetos, Relatórios, Visão financeira, Ferramentas IA.
- Corrigir copy enganosa/inflada: 'KPIs em tempo real'→'da rede / últimos 30 dias' (Distribuição), 'controle total do Hub'→'últimos eventos', 'Direcionamento'→'Distribuição' (Canais de entrada) com link real.
- Ciclos: trocar UTC manual por horário de Brasília na UI (conversão nos bastidores); corrigir bug de border 'solidrgb' e remover rótulo 'LISTA'.
- Substituir window.confirm() nativo por dialog do design dark em Canais de entrada e Escritórios.
**Critério de pronto:** Nenhuma env var, nome de tabela, slug ou SQL aparece na UI do usuário final; zero PT-PT; zero azul/laranja fora da paleta nas telas-alvo; nomenclatura alinhada ao modelo-mestre; gates verdes.

### Fase 3 — Fase 2 — Blindar ações sensíveis e financeiras (feedback + undo)  _(risco baixo)_
**Objetivo:** Garantir que toda ação que vão USAR DE VERDADE — pagar, receber, cobrar, liberar, cortar acesso, excluir, aprovar — tenha loading, confirmação leve e desfazer, eliminando clique acidental com efeito real.
**Telas-alvo:** Contas a pagar, Contas a receber, Distribuição de leads, Aprovações, Usuários & Permissões, Cadastros, Parceiros, Contatos de notificação, Negócios, Escritórios

**Ações:**
- Marcar pago/recebido: loading no botão + atualização otimista + toast com 'Desfazer' (5s) + toast de erro (hoje falham em silêncio); registrar data/valor da baixa no PATCH.
- Distribuição: blindar 'Cobrar' e 'Liberar' com confirmação leve + toast ('Cobrança enviada a X'); aumentar área de toque mobile.
- Aprovações: adicionar 'Desfazer' no toast de Aprovar/Rejeitar e capturar motivo na rejeição via chips (backend já aceita 'motivo').
- Usuários & Permissões: micro-confirmação antes de cortar acesso/rebaixar papel; toast de sucesso próximo da ação; deixar explícito que desativa, não exclui.
- Cadastros e Parceiros: remover a seleção em massa enquanto a única ação for excluir (fachada funcional); reintroduzir só com ação de valor.
- Negócios: rollback otimista no drag-and-drop se o PATCH falhar; encadear seletor de motivo de perda em todas as formas de mover para perdido/ganho.
- Contatos de notificação: validar/mascarar telefone BR antes de salvar (alimenta disparo de WhatsApp); confirmação leve/undo no Remover.
**Critério de pronto:** Toda ação financeira/destrutiva tem loading + confirmação ou undo + toast de erro; nenhuma seleção-em-massa-fachada visível; telefone de notificação validado; verificado clicando no navegador.

### Fase 4 — Fase 3 — Ativar IA-first onde o motor JÁ existe (Click-and-Go)  _(risco medio)_
**Objetivo:** Cumprir a promessa central do produto: a IA SUGERE e o usuário CONFIRMA em 1 toque, ligando UIs ao motor já pronto e ao contexto que já chega de graça (URL, negócio, evento).
**Telas-alvo:** Distribuição de leads, Atendimento, Dashboard, Tarefas comerciais, Negócios, Pedidos de material, Projetos/Arquitetura, Engenharia/Obras, Fornecedores

**Ações:**
- Distribuição: montar a FILA DE DISTRIBUIÇÃO no topo — cada lead com sugestão da IA (top-1 + 2 alternativas + motivo/score) e 'Confirmar' em 1 toque, reusando sugerirEncaminhamentoAutomatico, /api/crm/distribuicao/sugerir e DistribuirLeadPanel.
- Atendimento: substituir as 4 respostas fixas por 'Sugerir resposta (IA)' contextual (1-3 rascunhos, operador edita e confirma), debitando Tijolos com custo visível e fallback gratuito.
- Dashboard: fundir 'Ação agora' + 'Alertas' + 'Leads parados' em um painel único 'O que precisa de você' com 1 frase de recomendação da IA no topo e botão de 1 toque.
- Tarefas: adicionar POST/PATCH + tabela hub_tarefas_comerciais (migração aditiva, contexto polimórfico lead/negócio/obra); botão 'IA: sugerir próximas ações' (aceite em 1 clique) e cartões com Concluir/Adiar/Hoje.
- Negócios: tornar 'Próxima ação' acionável e IA-first (sugere próximo passo com data, confirma/reagenda em 1 toque).
- Pedidos e Projetos e Obras: substituir input de UUID/ID por seletor com busca pré-selecionado pelo contexto da URL; criação nasce de negócio ganho ('Gerar obra/projeto') com IA pré-preenchendo; tornar valor_estimado visível em Pedidos.
- Fornecedores: trocar 'área de atuação' texto-livre por chips de mercados; busca por CNPJ pré-preenche e IA sugere mercados pelo CNAE.
**Critério de pronto:** Cada tela-alvo tem ao menos um job IA-first executável em ≤3 cliques (IA sugere, usuário confirma); fim dos campos de UUID/texto-livre digitado; criação de obra/projeto/pedido parte do contexto; gates verdes.

### Fase 5 — Fase 4 — Virar formatos pesados e podar ruído (tabela→cards/Kanban, KPIs duplicados)  _(risco medio)_
**Objetivo:** Aplicar a régua 'tabela ≠ tela de trabalho' onde ainda resta planilha, eliminar KPIs duplicados/de vaidade e definir fonte única por número, melhorando densidade, mobile e clareza.
**Telas-alvo:** Cadastros, Parceiros, Imóveis, Leads, Canais, Dashboard, Analytics, Relatórios, Negócios

**Ações:**
- Cadastros: inverter o default de colunas para conjunto enxuto (Nome+telefone, E-mail, Área/Segmento, UF, Origem) e tornar o resto opt-in; remover Tenant/UUID, 6 colunas de endereço, JSON Extras, datas de auditoria do padrão.
- Parceiros: tornar colunas condicionais por aba como ponte, depois evoluir para Kanban/cards por estágio; migrar a tabela de 11 colunas para /crm/relatorios.
- Imóveis: virada de formato para GRID DE CARDS com foto de capa, status e preço; tabela vira export em Relatórios; status editável inline no card.
- Leads: consolidar a Caixa como única view de trabalho, rebaixar Kanban a secundário, mover a Lista de 8 colunas para Relatórios.
- Canais (WhatsApp): trocar tabela 720px por cards (nome + badge + CTA Reconectar); banner IA-first quando canal cair.
- Definir FONTE ÚNICA por KPI: funil é a verdade dos números comerciais (remover 'Receita potencial'/'Negócios abertos' duplicados); mover histórico/tabelas de medição para Relatórios; tornar cards/funis clicáveis levando ao job.
- Relatórios: expor botão Exportar (CSV/Excel) já suportado no backend; tornar linha clicável; ocultar abas com 0 registros; cards no mobile.
**Critério de pronto:** Nenhuma tela de trabalho usa tabela densa como peça central (tabela só em Relatórios); cada KPI tem fonte única e é clicável; Imóveis com cards+foto; mobile sem scroll horizontal; gates verdes.

### Fase 6 — Fase 5 — Separar plataforma de tenant e condicionar por perfil  _(risco medio)_
**Objetivo:** Resolver o 'dois donos numa tela' tirando o que é admin/hub da frente do fornecedor, sem bifurcar telas — condicionando blocos por perfil e movendo diagnóstico de plataforma para área super-admin.
**Telas-alvo:** Configurações, Integrações, Ferramentas IA, Precificação & IA, Analytics, Escritórios, Usuários & Permissões, Distribuição

**Ações:**
- Configurações: corrigir o bug de loading compartilhado (estados separados para horário e distribuição); adicionar confirmação de sucesso; remover o painel de 13 env vars da tela do tenant (mover para super-admin); follow-up vira CRUD real com cadência sugerida pela IA.
- Integrações: tratar erro de fetch + skeleton; garantir que todo 'Configurar' termine em ação real (sem beco sem saída); env vars só em visão owner; agrupar por categoria.
- Ferramentas IA: traduzir para linguagem de negócio, esconder identificadores internos, tornar o card operável ('Ativar em…') e colocar custom/tenant atrás de modo avançado.
- Precificação & IA: blindar o Salvar (dirty-state + bloquear até GET confirmar + banner quando usar defaults) para não gravar markup/câmbio default sobre a config real da rede; esconder item de menu para não-owner.
- Analytics e Distribuição: condicionar blocos de rede/Parceiros ao perfil HUB; fornecedor não vê 'Homologados'.
- Escritórios: tornar a linha clicável (painel do tenant já existe); trocar coluna 'Slug' por métrica útil; esconder item do menu para não-owner.
- Usuários & Permissões: adaptar coluna Empresa e busca por perfil (só owner/multi-tenant).
**Critério de pronto:** Fornecedor comum não vê secrets, env vars, precificação nem blocos de rede; telas de plataforma protegidas por perfil/menu; Precificação não grava default por cima de config real; gates verdes.

### Fase 7 — Fase 6 — Conectar financeiro/obra ao motor da plataforma e deferir o que falta dado do dono  _(risco alto)_
**Objetivo:** Ligar financeiro e execução à cadeia venda→execução (código único, comissão, vínculos) e registrar formalmente o que fica deferido até existirem dados reais do dono, mantendo o sistema honesto sobre o que está pronto.
**Telas-alvo:** Contas a pagar, Contas a receber, Visão financeira, Engenharia/Obras, Projetos/Arquitetura, Negócios

**Ações:**
- Financeiro: vincular conta↔negócio/obra/ordem-de-compra; gerar lançamentos automáticos por evento (negócio ganho→a receber; medição/compra→a pagar); expor ao hub apenas agregados/eventos (nunca o item).
- Recebível/pagável IA-first: nascer de negócio ganho com IA pré-preenchendo descrição/valor/parcelas e vínculo de cliente; manual como fallback; mostrar QUEM deve no card.
- Obras: bloquear criação por texto livre (gera dados-lixo órfãos); obra nasce de negócio ganho amarrando negocio_id/imovel_id; painel [id] honesto ('em construção') com 1 ação real, não fachada.
- Visão financeira: 'Ação agora' evolui para recomendação explicada pela IA + ação de 1 toque; hardenizar export CSV (RLS por tenant) contra vazamento multi-tenant.
- DEFERIR formalmente no handoff (não apresentar como pronto): módulo de Arquitetura real (plantas/BIM/fases), reconstrução completa de Engenharia (Escopo/Cronograma/Curva S/Avanço&Medição, wizard 5 passos), gestão de obra detalhada — priorizar só com demanda/dados concretos do dono.
**Critério de pronto:** Financeiro alimenta código único/comissão via eventos; nenhuma obra nasce órfã por texto livre; painéis incompletos marcados honestamente como 'em construção'; itens deferidos registrados no handoff; export sem vazamento entre tenants; gates verdes.

