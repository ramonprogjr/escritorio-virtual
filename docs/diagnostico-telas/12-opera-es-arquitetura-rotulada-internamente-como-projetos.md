# Arquitetura (rotulada internamente como "Projetos")  ·  Operações

**Rota:** 

## Veredito do diretor
Como diretor, meu parecer é: esta tela NÃO está pronta para o que o nome promete, mas o esqueleto está correto. Ela funciona (lista, cria, navega) e já acerta no princípio "tabela ≠ tela de trabalho" usando cartões e na cadeia navegável negócio→projeto→obra→pedidos — isso eu PROTEJO. Porém ela vive uma crise de identidade: o menu diz "Arquitetura" (módulo de projeto arquitetônico, com plantas, fases, aprovações de cliente) e a tela entrega um CRUD genérico de "projeto como linha de banco". Pior, viola frontalmente nossas duas premissas mais sagradas: (1) IA-first/Click-and-Go — o modal pede DIGITAR um UUID de negócio, o anti-padrão exato que proibimos, ainda por cima ignorando o negocio_id que a própria URL já entrega de graça; (2) 3 cliques úteis — o cartão não permite trabalhar, só navegar, então o usuário precisa sair da tela para fazer qualquer coisa. Há ainda um defeito funcional que mancha a régua "funcional, não fachada": o link "Pedidos" renderiza sempre, gerando /crm/pedidos?obra_id= quebrado quando não há obra. Decisão de produto: NÃO é hora de inflar isto num módulo de arquitetura completo (plantas, BIM, anexos) — isso é grande e fora do foco Obra10+ Members agora. A jogada de PO é: corrigir os 3 P0 que quebram confiança/coesão (custo baixíssimo, valor alto), resolver o nome com uma decisão de escopo consciente, e só então enriquecer o cartão com o mínimo que torna a tela "de trabalho". Refatoração de módulo arquitetônico de verdade fica deferida, como já deferimos gestão de obra para quando houver dados do dono.

## Cenários trazidos
- CENÁRIO DO NOME (decisão de escopo, escolher 1): A) 'Arquitetura' é a ambição real — renomear o módulo no menu para 'Projetos' (o que a tela faz hoje) e reservar 'Arquitetura' para depois, evitando prometer o que não existe; OU B) manter 'Arquitetura' no menu e alinhar o H1, assumindo o compromisso de evoluir a tela para projeto arquitetônico (plantas/fases). RECOMENDO A no curto prazo: honestidade de produto custa zero e remove a quebra de confiança; promover a B só quando houver demanda real do fornecedor por entregáveis de arquitetura.
- SERVIR O COMERCIAL vs SERVIR O HUB: hoje a tela serve nem um nem outro — é um CRUD órfão. Para o FORNECEDOR (comercial/execução) o valor é: 'do negócio fechado, gere o projeto e empurre para a obra em 1 clique' — esta é a leitura que adoto, pois é o JOB que conecta venda→execução. Para o HUB, projeto/obra são insumo de métrica e comissão transacional (código único), não uma tela de operação — logo o HUB consome isto via relatórios, não aqui. Conclusão: otimizar esta tela para o fornecedor operar, não para o hub administrar.
- TABELA vs CARTÕES: já estamos em cartões e isso se mantém (alinhado a 'tabela ≠ tela de trabalho'). A tabela densa de projetos, se alguém quiser, vai para /crm/relatorios, não aqui. Não reabrir esse debate.
- CRIAÇÃO — modal vs 1-toque-do-negócio: A) corrigir o modal trocando o input de UUID por um seletor de negócio com busca + pré-seleção do negocio_id da URL (médio, resolve o anti-padrão já); B) ir além e oferecer 'Gerar projeto' como ação dentro da tela do Negócio fechado, deixando a criação avulsa como fallback. RECOMENDO A agora (desbloqueia a premissa) e B como evolução natural — coerente com o botão 'Gerar obra' que já existe na cadeia.
- O QUE AUTOMATIZAR COM IA (faseado): fase 1 barata — IA pré-preenche título do projeto a partir do nome do negócio e sugere status/fase inicial; fase 2 — IA resume o estado do projeto no cartão ('pendente de aprovação do cliente'); fase 3 (deferida) — IA gera escopo/checklist do projeto. Não tentar a fase 3 agora.

## ✅ Manter
- Padrão de cartão (lista <ul>) em vez de tabela — respeita 'tabela ≠ tela de trabalho'
- A cadeia navegável negócio→projeto→obra→pedidos como espinha dorsal do fluxo venda→execução
- Botão 'Novo' dourado, CTA primário claro com min-h-10 (toque mobile ok)
- Código único do projeto exibido no cartão — coerente com a diretriz de código único do CRM
- Leitura do negocio_id pela querystring para filtrar (a intenção é certa; só a UI que falta)
- O fato de NÃO ser stub: lista, cria e navega de verdade

## ❌ Remover (ruído)
- O input 'ID do negócio (opcional)' que pede DIGITAR UUID — anti-padrão proibido, substituir por seletor com busca
- O link 'Pedidos' quando obra_id é null/undefined (gera /crm/pedidos?obra_id= quebrado) — esconder até existir obra
- A cor azul #60a5fa do link 'Negócio' — fora da identidade verde+dourado, remover/tokenizar
- O subtítulo 'Negócio → projeto → obra → pedidos' como está — é jargão de schema, não o job do usuário
- Hex hardcoded soltos e style inline no EmptyState — migrar para tokens --obra-*/--brand-*
- Exibição de 'null · status' quando código vem nulo — tratar ou ocultar o separador

## 🤖 Promover a IA-first / 1-toque
- Criação do projeto direto do Negócio fechado em 1 clique ('Gerar projeto'), espelhando o 'Gerar obra' já existente — IA pré-preenche título a partir do nome do negócio
- Seletor de negócio com autocomplete (busca por nome/código) pré-selecionado pelo negocio_id da URL — escolher e confirmar, não digitar
- Empty state acionável e IA-first: 'Criar projeto' + sugestão 'Gerar projeto a partir de um negócio fechado'
- Resumo de estado do projeto no cartão gerado por IA ('pendente de aprovação do cliente') quando houver dados
- Chips de tipo/fase do projeto sugeridos pela IA (múltipla escolha), não campos de texto livre

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Corrigir os 3 P0 de confiança/coesão num único PR: (a) alinhar nome menu↔H1 (decisão de escopo: renomear menu para 'Projetos' OU alinhar H1 para 'Arquitetura'); (b) trocar o input de UUID por seletor de negócio com busca, pré-selecionando o negocio_id da URL; (c) esconder os links 'Pedidos' e 'Obra' quando obra_id for nulo.  _(premissa: IA-first/Click-and-Go (não digitar UUID) + 3 cliques úteis + funcional-não-fachada (link quebrado) + coesão (nome divergente))_
- **P2** · pequeno · risco baixo — Tokenizar cores e remover o azul #60a5fa: trocar hex soltos por --obra-*/--brand-*, eliminar style inline do EmptyState, e tratar 'codigo' nulo para não exibir 'null · status'.  _(premissa: Bonito e coeso (identidade dark verde+dourado, trava de design preservada))_
- **P3** · medio · risco baixo — Enriquecer o cartão para virar tela de trabalho: chip de status colorido (semântica verde/dourado/âmbar), nome do negócio e da obra nos atalhos (não rótulos genéricos), e responsável/prazo quando existirem no dado.  _(premissa: Útil e fácil de entender + tela de trabalho (não só navegação))_
- **P4** · pequeno · risco baixo — Empty state IA-first acionável: ícone + 'Nenhum projeto ainda' + botão 'Criar projeto' + dica 'Gerar projeto a partir de um negócio fechado'.  _(premissa: IA-first + útil/fácil (orientar o próximo passo, não vazio passivo))_
- **P5** · pequeno · risco baixo — Expor o filtro fantasma: quando ?negocio_id estiver presente, mostrar chip 'Negócio: {nome} ✕' com ação de limpar e o nome do negócio no topo.  _(premissa: Clareza/transparência (usuário precisa ver que está filtrado e como sair))_
- **P6** · medio · risco medio — Promover criação 1-toque: adicionar ação 'Gerar projeto' na tela do Negócio fechado (espelhando 'Gerar obra'), com IA pré-preenchendo título; manter criação avulsa como fallback.  _(premissa: IA-first/Click-and-Go + servir o JOB do fornecedor (venda→execução))_
- **P7** · grande · risco medio — DEFERIR módulo de Arquitetura real (plantas/anexos/thumbnail, fases formais, % avanço, BIM): registrar no backlog e só priorizar com demanda concreta do fornecedor — fora do foco Obra10+ Members agora.  _(premissa: Priorizar por impacto×esforço; não desviar do objetivo)_
