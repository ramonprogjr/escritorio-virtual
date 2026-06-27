# Negócios  ·  Comercial

**Rota:** 

## Veredito do diretor
APROVADA com correções obrigatórias antes da apresentação. Esta é uma das melhores telas do sistema: o Kanban com drag-and-drop, contagem e soma por etapa É a tela de trabalho correta para o funil, cumpre o limite de 3 cliques e respeita "tabela não é tela de trabalho". O núcleo está certo e deve ser preservado. Porém há TRÊS problemas que ferem premissas inegociáveis e precisam ser tratados: (1) FACHADA — `fallbackProgress=0.42` é uma barra de progresso fixa/fake no card (confirmado linha 116) e há etapas/cores hardcoded (ETAPA_COR, KPIs 'qualificado'/'negociando') que divergem do pipeline configurável; isso viola "funcional, não fachada" e é o mais grave porque o cliente VAI usar. (2) MÉTRICA QUE MENTE — todos os KPIs e somas de coluna são calculados no client sobre a página paginada (LIMIT 20, confirmado): com mais de 20 negócios o "Pipeline Total" e as somas subnotificam o dinheiro em jogo, corroendo a confiança no número que mais importa para a monetização. (3) RUÍDO no card — 'Mercado' aparece 3x e 'Etapa' aparece no InfoGrid sendo que o card já está NA coluna daquela etapa (confirmado linhas 211-212). A maior oportunidade desperdiçada é o bloco 'Próxima ação': hoje é texto morto; deveria ser o ponto IA-first da tela (sugestão de próximo passo com data, 1 toque para concluir/reagendar). Veredito: manter o esqueleto, matar a fachada, levar agregados para o backend, limpar o card e ativar a IA na próxima ação. Não inflar a tela com features novas antes de corrigir o que mente.

## Cenários trazidos
- SERVIR O COMERCIAL vs O HUB: esta tela é a visão do FORNECEDOR (vender o lead que o Hub distribuiu). Recomendo mantê-la 100%% focada no job comercial do fornecedor — o pulso do Hub (origem do lead, SLA de resposta, leads não trabalhados) pertence a um painel do Hub/distribuição, não aqui. Misturar os dois polui a tela de trabalho. Ponte sutil: um KPI/CTA 'Leads para converter' que leva da fila do Hub para criar negócio.
- TABELA vs CARTÕES: decisão recomendada — Kanban é a ÚNICA tela de trabalho; a visão Lista vira leitura rápida com ação inline de mover etapa (NÃO uma tabela morta). A tabela completa (ordenar/exportar/filtrar) migra para /crm/relatorios, coerente com as outras telas do sistema onde 'tabela = relatório'. Evita conflito com a régua e com a tela de Relatórios.
- KPIs: cenário A (conservador) = manter só 'Pipeline Total', porém vindo do backend e real; cenário B (recomendado) = substituir os KPIs redundantes/hardcoded por métricas que o Kanban NÃO mostra — Forecast (valor x probabilidade da etapa), Ganhos no mês e Negócios parados/sem próxima ação. KPI deve responder pergunta que a coluna não responde.
- PRÓXIMA AÇÃO / IA: cenário A = só tornar o bloco acionável (concluir/reagendar com data); cenário B (recomendado, IA-first) = a IA SUGERE a próxima ação a partir do estágio + histórico do lead, usuário confirma em 1 toque (Click-and-Go). Consome créditos (Tijolos), alinhado à monetização.
- PAGINAÇÃO DO KANBAN: cenário A = scroll infinito por coluna; cenário B (mais simples e recomendado) = colunas mostram contagem/soma TOTAL do backend e carregam mais cards sob demanda, sem nunca exibir somas parciais. O essencial é que badge e soma nunca mintam, independente do que está carregado.

## ✅ Manter
- Kanban como tela de trabalho do funil (núcleo correto, ≤3 cliques)
- Drag-and-drop entre etapas com update otimista + toast (desktop) e bottom-sheet 'Mover etapa' (mobile, 2 toques)
- Cabeçalho de coluna com nome + contagem + soma por etapa (a leitura que o gestor quer) — desde que os números virem totais reais
- KPI 'Pipeline Total' como conceito (dinheiro em jogo é o número que importa p/ monetização) — mas corrigido p/ vir do backend
- Botão '+ Novo negócio' herdando pipeline/mercado da aba ativa (bom Click-and-Go) e deep-link ?novo=1
- Barra de abas de pipeline por mercado (1 clique troca de funil, coerente com multi-mercado)
- Bloco 'Próxima ação' no card — é o gancho IA-first ideal (manter o lugar, evoluir a função)
- Lista mobile com cards compactos e 1 toque para abrir

## ❌ Remover (ruído)
- fallbackProgress=0.42 (barra de progresso fixa/fake no card) — substituir por progresso real do pipeline (ordem da etapa / total) ou remover
- Linha 'Etapa' do InfoGrid do card (o card já está NA coluna da etapa) e as duplicatas de 'Mercado' (aparece 3x → deixar 1x)
- KPIs 'Qualificados' e 'Negociando' hardcoded por slug (mostram 0 em pipeline customizado e duplicam a contagem das colunas)
- Coluna 'Ver →' da tabela (a linha inteira já é clicável)
- Filtro 'Todas as etapas' quando view=kanban (filtrar etapa esvazia o board — manter só na Lista)
- Tabela pura como destino de trabalho no desktop — migrar para /crm/relatorios OU rebaixar a leitura rápida com ação inline
- Status como texto cru com underscore ('em negociacao') — usar label amigável

## 🤖 Promover a IA-first / 1-toque
- Bloco 'Próxima ação' do card: IA sugere o próximo passo a partir da etapa + histórico do lead, com data e responsável, e usuário confirma/reagenda em 1 toque (Click-and-Go, consome Tijolos)
- Drawer '+ Novo negócio' IA-first: pré-preencher título, valor estimado e etapa a partir do lead vinculado, usuário só confirma
- Empty state acionável: '+ Criar primeiro negócio' e 'Ver leads para converter' (IA pode listar os leads mais quentes da fila do Hub)
- KPI 'Negócios parados / sem próxima ação' alimentado pela IA, que também sugere a ação de retomada em 1 toque
- Forecast por IA: valor ponderado pela probabilidade da etapa exibido ao lado do Pipeline Total

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Remover a barra de progresso fake (fallbackProgress=0.42) do NegocioKanbanCard: trocar por progresso real do pipeline (índice da etapa / total de etapas) ou remover o elemento. Mata a fachada mais visível da tela.  _(premissa: Funcional, não fachada (régua inegociável))_
- **P1** · medio · risco medio — Mover o cálculo de KPIs e somas de coluna para o BACKEND: a API de listagem deve devolver agregados reais (pipeline total, forecast, ganhos no mês, contagem/soma por etapa) sobre TODO o pipeline, não sobre a página de 20. Eliminar o cálculo client-side sobre negocios paginados.  _(premissa: Acima de tudo ÚTIL e fácil de entender — KPI não pode mentir)_
- **P2** · pequeno · risco baixo — Limpar o card: remover linha 'Etapa' do InfoGrid e as 2 duplicatas de 'Mercado' (deixar 1x), e exibir Status com label amigável em vez de slug com underscore.  _(premissa: Essa informação é mesmo necessária aqui, ou é ruído?)_
- **P2** · medio · risco baixo — Substituir os KPIs hardcoded 'Qualificados'/'Negociando' por métricas que o Kanban NÃO mostra: Forecast (valor x probabilidade) e Negócios parados/sem próxima ação. Manter 'Pipeline Total' (já corrigido para backend).  _(premissa: IA-first / utilidade — KPI responde pergunta que a coluna não responde)_
- **P2** · grande · risco medio — Tornar 'Próxima ação' acionável e IA-first: IA sugere o próximo passo com data/responsável; usuário confirma ou reagenda em 1 toque. Pré-requisito: definir fonte da sugestão (etapa + histórico do lead).  _(premissa: IA-first (Click-and-Go) — a IA sugere, o usuário confirma)_
- **P2** · medio · risco medio — Decidir o destino da Lista/tabela: migrar a tabela completa (ordenar/exportar/filtrar) para /crm/relatorios e transformar a Lista local em leitura rápida com ação inline de mover etapa. Remover coluna 'Ver →' e exibir Etapa com label.  _(premissa: Tabela não é tela de trabalho (régua))_
- **P3** · pequeno · risco baixo — Ocultar o filtro 'Todas as etapas' quando view=kanban (manter só na Lista), pois filtrar etapa esvazia o board.  _(premissa: Mínimo de ruído / clareza)_
- **P3** · pequeno · risco baixo — Adicionar debounce (~300ms) ao campo de busca e expandir o escopo para nome de pessoa/empresa vinculada (coerente com vínculos N:N); mostrar contador de resultados.  _(premissa: Prático e fácil)_
- **P3** · pequeno · risco baixo — Rollback otimista no drag-and-drop: se o PATCH de etapa falhar, reverter a posição do card na UI além do toast de erro, para a tela não ficar inconsistente com o servidor.  _(premissa: Funcional, não fachada (confiabilidade))_
- **P3** · medio · risco baixo — Encadear o seletor de motivo de perda (já existente) ao mover para 'perdido'/'ganho' em TODAS as formas de mover etapa (drag desktop e bottom-sheet mobile), eliminando a inconsistência de fluxo.  _(premissa: Coeso e consistente entre telas)_
- **P3** · pequeno · risco baixo — Empty states com CTA: '+ Criar primeiro negócio' e 'Ver leads para converter', com a IA listando os leads mais quentes da fila do Hub.  _(premissa: IA-first / guiar o usuário)_
- **P3** · pequeno · risco baixo — Rebaixar o botão 'Pipeline' (config) para ícone de engrenagem discreto ou menu '...', tirando peso de CTA de uma ação rara.  _(premissa: Hierarquia: ação rara não compete com trabalho diário)_
- **P3** · medio · risco baixo — Adicionar mini-badge de contagem por aba de pipeline (ex.: 'Imóveis 12') e garantir cores do card/lista vindas do pipeline ativo (etapasKanban) em vez de ETAPA_COR fixo.  _(premissa: Bonito, coeso e fiel ao dado real)_
