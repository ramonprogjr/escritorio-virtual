# Contas a pagar  ·  Financeiro

**Rota:** 

## Veredito do diretor
Tela funcional de verdade (lê hub_contas_pagar real, filtra, dá baixa via API) e acerta o essencial de UI: cards em vez de planilha, hierarquia clara, cores de urgência coerentes com o dark verde+dourado, mobile-first e o job central (filtrar urgência -> marcar pago) em <=3 cliques. APROVO a tela como base, com 1 bloqueador e 2 lacunas estruturais. BLOQUEADOR: o valor do card usa moedaFinanceiro, que arredonda/abrevia (R$ 1.234,56 vira 'R$ 1k', some centavos, pode virar 'R$ 0') — inaceitável no item que vai ser efetivamente pago; precisão vence elegância em tela financeira. LACUNA 1 (a mais importante p/ o todo): NAO é IA-first e NAO tem vínculo a fornecedor/negócio/obra — o financeiro vive isolado, não alimenta código único nem comissionamento, nem aparece na visão de obra. LACUNA 2: ações sem feedback (CSV e Marcar pago falham em silêncio, sem loading nem undo) numa operação irreversível. O job de hoje (controle de caixa do fornecedor) está bom; o que falta é conectar esse financeiro ao motor de valor da plataforma e blindar a precisão/feedback. Sem isso, é uma boa tela de despesa avulsa, não uma peça do sistema.

## Cenários trazidos
- Quem a tela serve primeiro — comercial (fornecedor) vs hub: ela é do FORNECEDOR (controle do caixa dele), e está certo assim. O hub não deve ver contas a pagar de cada fornecedor; o hub só toca aqui no agregado anônimo (saúde financeira) e no comissionamento. Decisão: manter a tela como ferramenta do fornecedor e expor ao hub apenas via métricas/eventos, nunca o item.
- Cadastro manual vs IA-first (origem do lançamento): A) manter digitação manual como fallback; B) lançamento nasce de um VÍNCULO — negócio ganho gera conta a receber, ordem de compra/medição de obra gera conta a pagar, e boleto/foto via OCR pré-preenche valor+vencimento+fornecedor. Recomendado: B como caminho principal, A como exceção. É isso que liga o financeiro ao código único e ao comissionamento (split por transação).
- Cards vs tabela: MANTER cards (decisão de produto 'tabela != tela de trabalho'). A tabela vira export/Relatórios. O que falta no card não é virar tabela, é enriquecer o card (fornecedor/categoria/obra) quando o schema evoluir.
- Precisão do valor: exibir SEMPRE valor exato no item a pagar; reservar a abreviação k/M só para KPIs/cabeçalhos agregados (ex.: 'R$ 42k em 7 dias' no topo). Dois formatadores distintos: moedaExata (item) vs moedaKpi (agregado).
- CSV: A) remover da tela e centralizar em /crm/relatorios (onde a infra já existe); B) rebaixar para item de menu '...'. Recomendado A para não competir com a ação primária e manter coerência com as outras telas do grupo Financeiro.
- Marcar pago — quanto controle: A) baixa total em 1 toque (atual) com undo; B) baixa total OU parcial (registra data e valor pago). Recomendado A agora (preserva o 1-toque) com data/valor de baixa registrados automaticamente; B (parcial) como passo 2 quando houver demanda real.

## ✅ Manter
- Cards de trabalho (FinanceiroContasList) em vez de tabela — decisão de produto correta, com hierarquia e borda colorida por urgência
- Botão 'Marcar pago' por card como job central em 1 clique (excelente Click-and-Go) — só falta feedback/undo e registro de baixa
- Chips de atalho de urgência 'Vencidas' e '7 dias' — alto valor, vão direto ao que dói, 1 clique
- Filtros de status em chips e o breadcrumb '<- Visão financeira' para orientação dentro do grupo
- Skeleton de carregamento e o empty state orientado (sem beco sem saída)
- Botão 'Novo' dourado como CTA primário (identidade coerente) — manter a posição e a cor, mudar o rótulo e o conteúdo do modal
- Paleta dark verde+dourado e alvos de toque mobile (min-h-10/11)

## ❌ Remover (ruído)
- Export 'CSV' do header da tela operacional — mover para /crm/relatorios (export é função de relatório, não de tela de trabalho); compete com a ação primária
- Toggle 'A pagar / A receber' dentro do modal quando aberto a partir de 'Contas a pagar' — ruído e risco de lançar receita na tela de despesa; travar como rótulo fixo
- Abreviação k/M no valor do item a pagar (moedaFinanceiro no card) — remover do item, manter só em agregados/KPIs
- Chip 'Cancelado' sempre visível na barra de filtros — esconder atrás de 'mais' (raramente consultado, infla a barra)
- Destaque vermelho permanente do chip 'Vencidas' mesmo com zero — remover o alarme falso (atenuar/ocultar quando zero)

## 🤖 Promover a IA-first / 1-toque
- Modal de lançamento -> Click-and-Go: selecionar fornecedor/empresa JÁ cadastrado por chips (alimenta código único e vínculo N:N) em vez de descrição texto-livre
- OCR de boleto/foto pré-preenche valor + vencimento + fornecedor com nível de confiança; usuário só confirma (1 toque)
- Lançamento automático a partir de evento: negócio ganho -> conta a receber; ordem de compra/medição de obra -> conta a pagar, já vinculada à obra (liga financeiro ao comissionamento/visão de obra)
- Contador inteligente nos chips ('Pendente 12', 'Vencidas 3', '7 dias R$ X') calculado dos dados já em memória — informação acionável sem clique
- Resumo acionável no H1 ('Contas a pagar · R$ 42k em 7 dias') gerado dos dados carregados
- Categorização sugerida pela IA a partir do fornecedor/descrição (mão de obra, material, taxa) para alimentar relatórios e o split

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir formatação do valor no card: usar formatador de moeda EXATO (R$ com centavos, sem abreviar k/M) para o item a pagar; reservar moedaFinanceiro/abreviação só para KPIs e cabeçalhos agregados. Criar/usar moedaExata vs moedaKpi.  _(premissa: Útil e fácil de entender + funcional-não-fachada: numa tela financeira, precisão do item que será pago é inegociável; 'R$ 0'/'R$ 1k' é bug que gera erro de pagamento.)_
- **P2** · medio · risco medio — Dar feedback e segurança às ações: estado de loading no botão 'Marcar pago', atualização otimista + toast com 'Desfazer' (undo), e toast de erro quando a API falha (hoje falha em silêncio). Registrar data/valor da baixa no PATCH.  _(premissa: Mínimo de cliques sem fragilidade + funcional-não-fachada: ação financeira irreversível precisa de confirmação leve (undo) e nunca pode falhar mudo.)_
- **P3** · pequeno · risco baixo — Rebaixar/mover o export CSV: tirar do header e centralizar em /crm/relatorios (infra já existe) ou jogar em menu '...'. Enquanto estiver na tela, adicionar spinner + toast de sucesso/erro.  _(premissa: Tabela != tela de trabalho: export é relatório; libera o header para a ação primária e mantém coerência com as outras telas do grupo Financeiro.)_
- **P4** · medio · risco baixo — Renomear 'Novo' para 'Nova conta'; no modal aberto a partir de pagar, travar o tipo como rótulo fixo (sem toggle A pagar/A receber); adicionar contadores nos chips ('Pendente 12', 'Vencidas 3') e resumo no H1 ('R$ 42k em 7 dias') a partir dos dados já em memória; esconder 'Cancelado' atrás de 'mais'; atenuar 'Vencidas' quando zero.  _(premissa: Útil e fácil de entender + mínimo de cliques: rótulos claros, sem ruído nem alarme falso, informação acionável sem clique extra.)_
- **P5** · grande · risco medio — Evoluir o modal para IA-first com vínculos: seletor de fornecedor/empresa por chip (código único), campo categoria, máscara de moeda R$, vencimento recomendado, e botão para anexar boleto/foto que pré-preenche via OCR. Empty state ganha CTA primário 'Nova conta'.  _(premissa: IA-first/Click-and-Go + código único: o lançamento deixa de ser digitação isolada e passa a alimentar dedup e relatórios; usuário escolhe e confirma em vez de digitar.)_
- **P6** · grande · risco alto — Conectar o financeiro ao motor da plataforma: evoluir o schema para vincular conta <-> negócio/obra/ordem-de-compra, gerar lançamentos automáticos por evento (negócio ganho -> a receber; medição/compra de obra -> a pagar) e expor ao hub apenas agregados/eventos para comissionamento (nunca o item). Enriquecer o card com fornecedor/categoria/obra.  _(premissa: Visão do todo (multi-tenant + comissionamento + visão de obra): é o que liga o financeiro ao código único e ao split transacional; sem isso a tela é uma ilha.)_
