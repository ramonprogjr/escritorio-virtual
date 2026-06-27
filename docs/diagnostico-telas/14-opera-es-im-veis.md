# Imóveis  ·  Operações

**Rota:** 

## Veredito do diretor
Tela funcional, coesa no design system e com guards corretos no backend — não é fachada. Mas, julgada contra o TODO e as premissas, está no formato MAIS FRACO possível para o domínio: imóvel é produto VISUAL e aqui virou planilha sem foto. Isso viola três premissas de uma vez: "tabela ≠ tela de trabalho" (relatório virou tela), "bonito" e "fácil de entender" (o corretor reconhece imóvel por imagem, não por código sequencial na 1ª coluna), e "mobile importa" (tabela 740px com scroll horizontal). Além disso há DOIS bugs reais confirmados no código que corroem confiança: (1) KPIs Venda/Locação contam só a página carregada (page.tsx:118-119 usam imoveis.filter sobre o array paginado), então divergem do Total e MUDAM ao clicar "Carregar mais" — KPI que mente é pior que KPI ausente; (2) o POST nasce com status "captacao" (route.ts:78) que não existe no STATUS_COR (page.tsx:46), caindo no fallback cinza e exibindo texto cru sem acento. Veredito: a tela MERECE ser repensada como grid de cards visual + cadastro IA-first, mas com prudência — primeiro estancar os 2 bugs (baratos, alto retorno de confiança), depois a virada de formato. Coerência com o TODO: como o sistema também serve o HUB que distribui leads, "qualidade do anúncio" (foto + preço + status) não é vaidade estética — é o insumo que torna o imóvel distribuível/vendável. A tabela não morre: vira export em /crm/relatorios, igual ao que já decidimos para outras telas (não criar exceção de padrão).

## Cenários trazidos
- SERVIR O COMERCIAL vs SERVIR O HUB: o comercial (corretor do fornecedor) quer escanear a carteira e mudar status rápido — pede grid visual + status inline. O HUB quer imóveis com anúncio COMPLETO (foto/preço/finalidade) para distribuir/casar com leads — pede KPI de qualidade ('Sem foto/sem preço') e cadastro rico. Não conflitam: o grid de cards serve os dois (capa+preço+status para o corretor; o mesmo card expõe lacunas de qualidade para o hub). Recomendo atender ambos com UMA virada de formato, sem bifurcar a tela.
- TABELA vs CARTÕES: (A) manter tabela e só corrigir bugs — barato, mas mantém a violação de premissa e o mobile quebrado; (B) grid de cards com foto, tabela vira relatório — alinhado ao TODO e ao precedente das outras telas, esforço médio. Recomendo B como destino, mas FASEADO: bugs primeiro (A como passo 0), cards depois. Não fazer um 'híbrido toggle tabela/card' agora — adiciona complexidade sem servir o job.
- O QUE AUTOMATIZAR COM IA: (1) Cadastro por link/foto/voz → IA pré-preenche título/tipo/finalidade/valor/cidade com ConfidenceBadge (Click-and-Go real; o SmartField já suporta 'confianca', a tela só não passa); (2) status sugerido pela IA a partir do contexto do negócio vinculado. Começar por (1), que é a maior dor (cadastro 100% digitação hoje) e o maior diferencial do produto.
- STATUS como eixo vs FINALIDADE como eixo: hoje os FilterPills filtram por finalidade (Venda/Locação), mas o eixo operacional do dia a dia imobiliário é STATUS (Disponível/Reservado/Vendido). E as abas 'Ativos/Arquivados' são um conceito de ciclo de vida fraco que se sobrepõe ao status 'vendido/alugado'. Cenário recomendado: promover STATUS a filtro de 1ª classe (pills) e reavaliar 'Arquivados' como derivado de status, não eixo paralelo.

## ✅ Manter
- Botão '+ Novo' (ação primária, 1 clique, cor coesa) — manter, mas evoluir para IA-first
- SearchBar por título/cidade/bairro (boa cobertura) — manter, adicionar debounce ~300ms
- FilterPills por finalidade (rápido, legível, 1 clique)
- SmartField Tipo e Finalidade em chips — ESTE é o padrão-ouro Click-and-Go da tela; replicar nos demais campos
- Coluna/Badge de Status com STATUS_COR (sinalização visual coesa) — manter após cobrir todos os status
- Valor em BRL dourado (info crítica, bem destacada) — manter, diferenciar venda x /mês
- Botão 'Carregar mais (N restantes)' (barato, bom feedback) — manter
- Código único IMO-ANO-NNNN (trava de dedup/rastreio do TODO) — manter o dado, rebaixar visualmente

## ❌ Remover (ruído)
- KPIs 'Venda'/'Locação' na forma atual — bugados (contam só a página) e pouco acionáveis; substituir por KPIs de decisão (Disponíveis, Valor em carteira, Sem foto/sem preço) calculados no backend
- Tabela de 9 colunas COMO TELA DE TRABALHO — mover para /crm/relatorios como export; ruído visual num domínio que pede imagem
- Coluna 'Código' como 1ª coluna líder — é infra, não decisão; rebaixar para rodapé do card
- Coluna 'Dorms' fixa cheia de '—' (muitos nulls) — remover da visão principal; mostrar só quando existir, dentro do card
- Conceito 'Arquivados' como aba paralela — reavaliar/derivar do status para eliminar sobreposição com 'vendido/alugado'

## 🤖 Promover a IA-first / 1-toque
- Cadastro IA-first: colar link de anúncio / foto / áudio → IA pré-preenche título, tipo, finalidade, valor, cidade com ConfidenceBadge; usuário só confirma os chips (Click-and-Go de verdade; SmartField já tem 'confianca', basta passar)
- Pré-seleção de IA nos SmartField Tipo/Finalidade (vir sugerido, não em branco)
- Mudança de status inline no card (Disponível→Reservado) em ≤2 cliques, sem abrir drawer — o gesto mais frequente da carteira; com sugestão de status pela IA a partir do negócio vinculado
- KPI 'Sem foto/sem preço' acionável (clicar filtra) — IA aponta quais anúncios estão incompletos para distribuição no hub
- EmptyState IA-first: em carteira vazia, sugerir importar anúncios via link (IA preenche), não só texto passivo

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir o BUG dos KPIs: calcular Venda/Locação (e Disponíveis) por COUNT agregado no backend e retornar junto com total, em vez de imoveis.filter sobre a página (page.tsx:118-119). Elimina números que mudam ao paginar.  _(premissa: Útil e confiável — KPI não pode mentir (premissa 'acima de tudo útil'))_
- **P1** · pequeno · risco baixo — Cobrir TODOS os status do domínio no STATUS_COR, incluindo 'captacao' (default do POST em route.ts:78), com rótulo PT-BR amigável e acentuado + cor. Hoje o imóvel nasce cinza com texto cru.  _(premissa: Bonito e coeso + fácil de entender)_
- **P2** · pequeno · risco baixo — Adicionar debounce (~300ms) na SearchBar para não refetchar por caractere; alinhar o placeholder (exibir bairro no card ou tirar da promessa).  _(premissa: Prático e fácil (sem requests excessivos))_
- **P2** · pequeno · risco baixo — Diferenciar valor de locação: sufixo '/mês' quando finalidade=locacao; e corrigir título dinâmico do drawer ('Editar imóvel' ao editar, hoje fixo 'Novo imóvel').  _(premissa: Útil/fácil de entender (não enganar venda x aluguel))_
- **P3** · pequeno · risco baixo — Adicionar 2ª linha de FilterPills por STATUS (Disponível/Reservado/Vendido) — backend já aceita o filtro; é o eixo operacional do dia a dia. Reavaliar 'Arquivados' como derivado de status.  _(premissa: ≤3 cliques no job real de gestão de carteira)_
- **P3** · grande · risco medio — VIRADA DE FORMATO: substituir a tabela por GRID DE CARDS (foto de capa, título, badge de status, preço em destaque, cidade; código pequeno no rodapé). Mover a tabela para export em /crm/relatorios. Resolve domínio visual e mobile de uma vez. Depende de campo de mídia/capa no modelo (migração aditiva se não existir).  _(premissa: 'Tabela ≠ tela de trabalho' + bonito + mobile importa)_
- **P4** · medio · risco medio — Status editável inline no card em ≤2 cliques (Disponível→Reservado) sem abrir o drawer — gesto mais frequente da carteira.  _(premissa: Mínimo de cliques no job mais comum)_
- **P4** · grande · risco medio — Cadastro IA-first: entrada por link/foto/voz → IA pré-preenche com ConfidenceBadge (passar 'confianca' aos SmartField, que já suportam) → usuário confirma. Adicionar status/dorms/área/bairro ao drawer para casar com o que a lista mostra.  _(premissa: IA-first / Click-and-Go (preencher = escolher e confirmar))_
- **P5** · pequeno · risco baixo — EmptyState acionável: '+ Cadastrar primeiro imóvel'; se houver filtro ativo, 'Limpar filtros'; em carteira vazia, sugerir importar via link (IA preenche).  _(premissa: Útil e prático (estado vazio que converte))_
