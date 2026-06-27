# Leads  ·  Comercial

**Rota:** 

## Veredito do diretor
Esta é a tela mais madura do CRM e o melhor exemplar das premissas: a "Caixa de Oportunidades" (faixas Agora/Hoje/Aguardando com ações inline) e o painel de Encaminhamentos IA (Aprovar/Recusar) são exatamente o que o sistema deve ser — superfície de trabalho acionável, não tabela, IA sugere e humano confirma em 1 clique. Como DIRETOR, eu protejo esses dois ativos e ataco o que os dilui. O problema central não é qualidade, é FOCO: a tela tenta servir dois donos ao mesmo tempo (o vendedor que precisa agir AGORA e o gestor que quer ver funil/planilha), e ao oferecer 3 views equivalentes + 4 KPIs decorativos + botão de config no header, ela enfraquece a única coisa que faz bem. A Lista desktop (planilha de 8 colunas, ação só "Ver") é a violação mais grave — é o anti-padrão "tabela como tela de trabalho" que a régra eterna proíbe, e seu lugar é /crm/relatorios. O Score 0-100 aparece em 3 superfícies sem significado nem ação: ou vira motor de priorização explicada na Caixa, ou sai da UI. Veredito: consolidar a Caixa como ÚNICA tela de trabalho, rebaixar Kanban a view secundária de funil, exportar a Lista para Relatórios, e transformar os rótulos passivos de IA (Score, responsável, Memórias) em ações de 1 toque. Não é refatoração grande — é poda e foco, tudo aditivo e reversível. Cuidado de coerência entre telas: a definição de urgência (Agora/Hoje), o Score e os motivos de perda devem ser os MESMOS aqui, no detalhe do lead, no Kanban e em Relatórios; hoje há 3 janelas de tempo diferentes (Caixa >24h, KPI +24h, KPI +1h) — isso confunde e precisa de uma régua única.

## Cenários trazidos
- CENÁRIO A — Servir o vendedor (recomendado p/ curto prazo): a tela é a fila de trabalho de quem vende. Caixa default + Kanban secundário, Lista vai p/ Relatórios, KPIs viram atalhos que filtram a Caixa. Maximiza '3 cliques' e 'útil/fácil'. Risco baixo, alinha com o foco Obra10+ Members.
- CENÁRIO B — Servir o Hub/distribuição: a tela vira o cockpit de roteamento de leads (motor de aderência fornecedor↔lead). O painel de Encaminhamentos IA sobe a protagonista, com score de aderência e preview de mensagem. Bom p/ a visão multi-tenant, mas é outra persona (gestor do Hub) — NÃO misturar na mesma superfície; deve ser uma aba/tela própria quando o Hub amadurecer.
- CENÁRIO C — Tabela vs Cartões: manter a tabela como 3ª view (status quo) contradiz a régua eterna e duplica código; o veredito é remover a tabela DESTA tela e, se houver demanda real de visão tabular/export, recriá-la em /crm/relatorios com filtros e export. Cartões (Caixa) ficam como a verdade operacional.
- CENÁRIO D — O que automatizar com IA: (1) priorização explicada no card ('parado 2d, ticket alto, pediu orçamento') usando score+valor+tempo; (2) próxima ação sugerida por lead; (3) motivo de perda pré-selecionado no descarte; (4) preview da mensagem de encaminhamento. Tudo Click-and-Go: IA propõe, humano confirma.
- CENÁRIO E — Modo Foco (futuro): ao expandir uma faixa grande, oferecer '1 lead por vez' com a ação sugerida pela IA, em vez de paginar 50 cards. Reduz carga cognitiva no pico de demanda.

## ✅ Manter
- Caixa de Oportunidades (faixas Agora/Hoje/Aguardando) como coração e default da tela
- Ações inline no card: Responder / Negócio / Ficha
- Painel Encaminhamentos pendentes (IA) com Aprovar/Recusar — melhor exemplo de IA-first da tela
- Botão + Novo lead / LeadRapidoSideover
- Busca e filtro de estágio (ferramentas de trabalho, rápidas)
- Fluxo Perdido/Spam com motivo obrigatório + confirmação (boa qualidade de dado)
- Rótulo de responsável IA vs humano nos cards
- Colapso 'ver todos / ver menos' por faixa
- Toasts de sucesso/erro (feedback claro)

## ❌ Remover (ruído)
- View Lista (tabela de 8 colunas) DESTA tela — mover para /crm/relatorios como relatório com filtros/export
- KPI 'Pipeline Total' do strip de métricas (é número de relatório, não ação)
- Score como número/barra exibido em 3 lugares sem significado nem ação (manter só se virar motor de priorização explicada)
- Botão 'Pipeline' (config) do header de trabalho — mover para engrenagem/config ou para a PipelineTabsBar
- PipelineTabsBar quando houver só 1 pipeline (global) — esconder
- Duplicação de código: headerControls repetido (inline + slot), ORIGENS_LABEL/COLOR, moeda e tempo redefinidos no page e no card — unificar (dívida técnica)

## 🤖 Promover a IA-first / 1-toque
- Priorização EXPLICADA no card da Caixa ('por que este lead é Agora?') usando score+valor+tempo, em vez de só idade de atualização
- Próxima ação sugerida pela IA dentro do card / na ficha (1 toque para executar)
- Chip de responsável clicável para 'Assumir' o lead da IA em 1 clique
- Encaminhamento IA com motivo/score de aderência + preview da mensagem antes de enviar
- Descarte (Perdido/Spam) unificado com motivo provável pré-selecionado pela IA
- Memórias IA deixarem de ser só leitura e virarem ação (confirmar/usar memória)
- KPIs acionáveis: clicar 'Sem Resposta +24h' rola/filtra a faixa Agora

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Tornar a Caixa a ÚNICA view de trabalho e rebaixar Kanban a opção secundária: Caixa default, toggle reduzido para Caixa + Kanban; remover a opção Lista do header.  _(premissa: tabela ≠ tela de trabalho; mínimo de cliques; útil/fácil)_
- **P1** · medio · risco baixo — Mover a tabela (Lista de 8 colunas) inteiramente para /crm/relatorios como relatório com filtros e export; remover o bloco da tela de Leads.  _(premissa: tabela = relatório, não tela de trabalho)_
- **P1** · pequeno · risco baixo — Unificar a régua de urgência: usar a MESMA definição de tempo na Caixa e nos KPIs (hoje há >24h vs +24h vs +1h) para acabar com a inconsistência conceitual entre faixas e métricas.  _(premissa: útil e fácil de entender; coerência entre elementos/telas)_
- **P1** · pequeno · risco baixo — Adicionar micro-confirmação/undo (toast com 'Desfazer') na ação 'Negócio' do card para evitar conversão acidental em massa.  _(premissa: funcional não-fachada; evitar ação destrutiva acidental)_
- **P2** · pequeno · risco baixo — Tornar os KPIs clicáveis (filtram/rolam a Caixa) e remover 'Pipeline Total'; reduzir a 1-2 KPIs realmente acionáveis (Sem Resposta, Em Risco).  _(premissa: 3 cliques; remover ruído decorativo)_
- **P2** · medio · risco medio — IA explica a prioridade no card ('parado 2d, ticket alto, pediu orçamento') e sugere a próxima ação — usando score+valor+tempo.  _(premissa: IA-first / Click-and-Go)_
- **P2** · medio · risco medio — Encaminhamentos IA: mostrar motivo/score de aderência e PREVIEW da mensagem antes de 'Aprovar e enviar'; permitir minimizar.  _(premissa: IA-first com confirmação; não-irreversível sem preview)_
- **P2** · pequeno · risco baixo — CTA primário sempre presente no card mesmo sem telefone (fallback e-mail/abrir ficha), para nenhum lead ficar sem ação.  _(premissa: funcional não-fachada; nenhum botão morto)_
- **P2** · medio · risco medio — Decidir o destino do Score: virar motor de ORDENAÇÃO da Caixa com tooltip 'por que esse score', OU sair da UI. Não exibir o mesmo número em 3 superfícies.  _(premissa: útil/fácil; remover número de vaidade)_
- **P3** · pequeno · risco baixo — Mover botão 'Pipeline' (config) para engrenagem/PipelineTabsBar e esconder PipelineTabsBar quando houver só 1 pipeline; limpar o header.  _(premissa: separar setup de operação; remover ruído)_
- **P3** · pequeno · risco baixo — Chip de responsável clicável para 'Assumir' o lead (humano pega da IA) em 1 clique.  _(premissa: IA-first / Click-and-Go)_
- **P3** · grande · risco medio — Unificar a ficha de detalhe entre mobile e desktop (mesma experiência; hoje mobile usa slide-over e desktop vai p/ rota — dois caminhos de código).  _(premissa: coerência; mobile importa)_
- **P3** · pequeno · risco baixo — Unificar descarte: uma ação 'Descartar' com tipo (perdido/spam) e motivo provável pré-selecionado pela IA, liberando espaço nas quick actions.  _(premissa: IA-first; menos cliques)_
- **P3** · medio · risco baixo — Limpar dívida técnica: deduplicar headerControls, ORIGENS_LABEL/COLOR, helpers de moeda/tempo (extrair para módulo compartilhado).  _(premissa: manutenção sustentável (serve à qualidade entregue ao usuário))_
