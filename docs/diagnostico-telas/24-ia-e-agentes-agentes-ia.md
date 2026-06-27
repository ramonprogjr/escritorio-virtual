# Agentes IA  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
Tela madura e bem-acabada (cards + sideover rico, dark verde/dourado coeso) — NÃO é stub e o esqueleto está certo: card como tela de trabalho (não tabela), diagnóstico em linguagem natural (Visão operacional/Saúde) que é exatamente o tipo de elemento IA-first que o sistema quer. Porém ela trai DUAS premissas centrais. (1) NÃO é IA-first onde mais importa — na CRIAÇÃO/EDIÇÃO. Tom, Estilo e 'Instruções base para a IA' são campos em branco que o dono teria de redigir do zero (prompt engineering exposto), quando deveriam ser chips/seletores pré-preenchidos pela IA com botão 'Gerar com IA' + confiança. A tela é IA-first só no diagnóstico, não na ação. Esse é o maior gap. (2) Fere 'útil e fácil de entender' com excesso de jargão e ruído de implementação: slug nos cards, alternância 'Agente'↔'MODELO' (confunde a própria entidade), 'Motor IA = MISTRAL_MODEL no servidor', tokens/ms/custo-R$ por conversa. Some-se a isso uma FACHADA confirmada no código (ring de saúde do card com progress=0.35 hardcoded — o próprio componente admite ser 'demo/placeholder'), o que viola a regra 'funcional, não fachada' num produto que clientes vão usar de verdade. Veredito: manter o esqueleto, MATAR a fachada do ring, padronizar o termo 'Agente', e — prioridade máxima de produto — virar a edição para Click-and-Go com IA. Nenhuma recomendação aqui conflita com outras telas; ao contrário, ela alinha esta tela ao padrão de identidade que o sistema já tem (Membros/onboarding) e à moeda 'Tijolos' (que deve substituir o custo-R$ cru).

## Cenários trazidos
- A QUEM esta tela serve — comercial vs hub: hoje serve o FORNECEDOR (dono do escritório) operando sua própria equipe de IA. Decisão de produto: manter foco no fornecedor e NÃO misturar visão de hub/admin aqui (a saúde agregada da rede é tela de plataforma, não desta). Isso mantém a tela enxuta e os campos de infra (Motor IA) fora do caminho do dono.
- Identidade da entidade — uma palavra só: 'Agente' (recomendado, é o que o menu/cards já usam e é mais humano) vs 'Modelo' (técnico, vaza implementação). Escolher 'Agente' em 100% da tela e banir 'modelo' da UI do cliente.
- Papel do sideover — tela de trabalho vs preview: Cenário A (recomendado) = sideover É a tela de trabalho completa; então enriquecê-lo e REMOVER 'Página completa' (elimina o 'dois lugares pra mesma coisa'). Cenário B = sideover é preview rápido; então enxugá-lo drasticamente e a página dedicada vira o lar do detalhe técnico (ciclos cron, tokens, custo). Recomendo A para o dono operacional e mover SÓ o detalhe de engenharia para a página completa atrás de 'avançado'.
- Edição da personalidade — texto livre vs Click-and-Go: Cenário A (texto livre, atual) = dono escreve prompt, anti-premissa, baixa adesão. Cenário B (recomendado) = IA SUGERE tom/estilo como chips e GERA as instruções base a partir do cargo, com confiança; o prompt cru fica escondido atrás de 'avançado' para quem quiser. B é o que define a tela como IA-first de verdade.
- Saúde no card — dado real vs anel decorativo: Cenário A = fazer o ring refletir saúde real (ok/degradado/parado) reusando o cálculo que já existe no detalhe. Cenário B = remover o anel da listagem e mostrar status textual ('Ativo · resp. há 2h'). Qualquer um serve; o INACEITÁVEL é manter o 0.35 fake. Recomendo A se o dado já está barato de calcular na listagem, senão B.
- Custo/consumo — R$ por linha vs Tijolos agregados: substituir 'R$0.0004 / X tok' por consumo de 'Tijolos' agregado no nível do agente, coerente com a moeda do produto; tokens/ms ficam atrás de 'detalhes técnicos'.
- Filtros — dois mecanismos vs um: busca textual já cobre cargo/bio; o dropdown de segmento e os 4 estados podem virar chips de 1 clique. Cenário recomendado: chips de estado (Ativos default) + chips de segmento aparecendo só acima de ~8 agentes; sem dropdown, sem layout instável.

## ✅ Manter
- Card como tela de trabalho (não tabela) com avatar — esqueleto correto, alinhado a 'tabela≠tela'
- Toggle Power (ligar/desligar) no card — job operacional em 1 clique
- Bloco 'Visão operacional' / chip de Saúde em linguagem natural — exemplar do IA-first em diagnóstico, é o tipo de elemento que o sistema quer
- Botão '+ Novo agente' como CTA primário dourado no header (job primário a 1 clique)
- Barra de filtro por estado com contadores (essência boa; só precisa de poda)
- Campo de busca (atalho universal)
- Contador 'mostrando: N agentes' (feedback de custo zero)
- Empty-states educativos (Atividade recente ensina onde a atividade surge)
- Diálogo de exclusão em cascata com transparência do que cai junto (proteção de dado correta)
- Chips de Mercado na edição — já é Click-and-Go correto

## ❌ Remover (ruído)
- FACHADA: ring de saúde com progress=0.35 hardcoded no card (app/crm/agentes/page.tsx:953 e :1210; CrmBotRingAvatar admite ser 'demo/placeholder') — viola 'funcional, não fachada'
- Vocabulário 'MODELO'/'modelo' na UI do cliente — padronizar tudo para 'Agente'
- Campo 'Motor IA = MISTRAL_MODEL no servidor' — detalhe de infra, ruído puro para o dono
- Custo em R$ com 4 casas por linha de conversa — assusta e é métrica de engenharia (trocar por Tijolos agregados)
- Rótulo 'LISTA' em caixa-alta (a tela inteira já é uma lista)
- 'slug' como subtítulo cru nos cards e no placeholder de busca — jargão técnico
- Duplicação de cadência/labelTimer dentro de cada ciclo (aparece 2x)
- Redundância da grid 'Identidade fixa' que repete Slug/Cargo/Segmento/Nível já presentes no header/card
- Peso visual igual do botão Excluir ao lado do toggle no card — mover para longe (kebab/sideover)
- Possivelmente 'Página completa' se o sideover for adotado como a tela de trabalho (eliminar 'dois lugares pra mesma coisa')

## 🤖 Promover a IA-first / 1-toque
- Tom e Estilo como CHIPS pré-selecionados pela IA (ex.: Formal/Próximo/Direto) com badge de confiança — Click-and-Go em vez de texto livre
- 'Instruções base para a IA': botão 'Gerar com IA a partir do cargo' que pré-preenche; prompt cru editável só atrás de 'avançado'
- Ring/Status de saúde do card refletindo o diagnóstico REAL já calculado no detalhe (1 olhada = ok/degradado/parado)
- No bloco 'degradado', transformar 'Ciclos IA' em link direto = correção em 1 toque
- Consolidar os três feeds temporais (Ciclos como estado; Atividade+Conversas num feed único com filtro de tipo) reduzindo carga cognitiva
- Consumo de IA exposto como 'Tijolos' por agente (não R$ por linha) — conecta à monetização do produto

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Matar a fachada do ring de saúde no card: ou ligar ao cálculo de saúde real já existente no detalhe, ou substituir por status textual ('Ativo · última resposta há Xh'). Remover o 0.35 hardcoded em app/crm/agentes/page.tsx (linhas ~953 e ~1210) e o fallback de demo.  _(premissa: Funcional não-fachada + útil/honesto (clientes vão USAR de verdade))_
- **P1** · pequeno · risco baixo — Padronizar o termo 'Agente' em 100% da tela (header, sideover, textos internos) e banir 'modelo'/'MODELO' da UI do cliente.  _(premissa: Acima de tudo fácil de entender (a entidade não pode ter dois nomes))_
- **P2** · grande · risco medio — Tornar a edição IA-first/Click-and-Go: Tom e Estilo viram chips pré-preenchidos pela IA com confiança; 'Instruções base' ganha botão 'Gerar com IA a partir do cargo'; prompt cru recolhido em 'avançado'.  _(premissa: IA-first (a IA sugere/pré-preenche, usuário escolhe e confirma))_
- **P2** · medio · risco baixo — Esconder métricas de engenharia atrás de 'detalhes técnicos': remover 'Motor IA' da UI do cliente; ocultar tokens/ms/custo-R$ por linha; expor consumo agregado como 'Tijolos' por agente.  _(premissa: Útil e fácil + coerência com a moeda do produto (Tijolos))_
- **P2** · medio · risco baixo — Reduzir risco do Excluir: mover a ação destrutiva do card para um kebab/sideover, longe do toggle; garantir alvos de toque ≥40px no mobile; exigir digitar o nome do agente na confirmação em cascata.  _(premissa: Prático e seguro + mobile importa)_
- **P3** · pequeno · risco baixo — Limpar ruído da listagem: remover rótulo 'LISTA', tirar 'slug' dos cards e do placeholder (placeholder 'Buscar por nome ou função…'), Ativos como default e revelar filtro de segmento só acima de ~8 agentes.  _(premissa: Mínimo de ruído / máximo 3 cliques)_
- **P3** · medio · risco medio — Enxugar o sideover: remover duplicação cadência/timer nos ciclos, mostrar só 'está rodando como esperado?' (nome, ativo, última/próxima execução em linguagem humana), empurrar cron/%período/total para a página completa; decidir sideover = tela de trabalho e remover 'Página completa'.  _(premissa: Tela de trabalho leve (relatório vai pra outro lugar) + sem 'dois lugares pra mesma coisa')_
- **P3** · medio · risco medio — Consolidar feeds temporais: 'Ciclos' = estado/config; fundir 'Atividade recente' + 'Linha do tempo de conversas' num feed único com filtro de tipo.  _(premissa: Fácil de entender (onde olho o quê))_
- **P3** · pequeno · risco baixo — Coesão visual do header: rebaixar 'Gerenciar cargos' para link/ícone discreto (ou kebab) aplicando o padrão de botão secundário do design system dark, mantendo só '+ Novo agente' como primário dourado.  _(premissa: Bonito e coeso)_
