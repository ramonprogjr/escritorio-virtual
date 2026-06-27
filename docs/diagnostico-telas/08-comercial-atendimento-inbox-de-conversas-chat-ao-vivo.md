# Atendimento (Inbox de conversas / chat ao vivo)  ·  Comercial

**Rota:** 

## Veredito do diretor
Esta é uma das telas mais maduras e bem-resolvidas do sistema e é o CORAÇÃO operacional do produto IA-first: o paradigma inbox+chat estilo WhatsApp é o acerto certo (curva zero), o handoff IA-humano (Assumir/Devolver) está bem modelado e funcional, o tempo-real existe e o visual está coeso com o tema verde/dourado. NÃO é fachada. Aprovo a base. Porém, o veredito é claro: a tela hoje é um INBOX HUMANO com IA pausada, quando deveria ser um INBOX PILOTADO POR IA com humano como copiloto. O maior gap é ideológico e contradiz nossa premissa #2: as 'respostas rápidas' são 4 frases fixas de chatbot de 2010 — isso é o OPOSTO de Click-and-Go. O elemento de maior valor faltante (e o que de fato torna a página IA-first) é 'Sugerir resposta (IA)' contextual + 'resumo da conversa/próximo passo' no painel. Em paralelo, há excesso de cromo de filtro (duas fileiras de chips + 4 setas de scroll) que rouba altura do que importa, redundâncias (contador e ações repetidos em 3 lugares, sideover duplica campos) e vazamentos técnicos na copy que quebram a sensação premium. O ganho de UX mais barato e impactante é trocar o timestamp de CRIAÇÃO do lead por ÚLTIMO contato + preview + badge de não-lida no item da lista. Resumo: manter a estrutura, injetar IA de verdade onde hoje há frases fixas, enxugar o cromo, limpar a copy.

## Cenários trazidos
- CENÁRIO A — Servir o operador comercial (foco atual, Obra10+ Members): a tela é a mesa de trabalho de quem responde lead. Implica priorizar 'Meus/IA/Humano', preview de última mensagem, não-lida e sugestão de IA contextual. É o cenário CERTO para agora — recomendo este.
- CENÁRIO B — Servir o hub/distribuição: o inbox vira painel de SLA (quem está sem resposta, redistribuir). Implica trazer filtro por estágio e métricas de tempo. RISCO: vira tabela/gestão, contradiz 'tabela≠tela de trabalho'. Recomendo NÃO trazer isso para o inbox — pertence ao Kanban/Central de Performance. A tela de atendimento serve o operador (A), não o gestor.
- CENÁRIO C — IA como copiloto (recomendado) vs IA como botão escondido: copiloto = ao abrir conversa assumida, a IA JÁ ofereceu 1-3 rascunhos e um resumo; operador só edita e confirma (1 toque). Alternativa fraca = um botão 'gerar' que o operador precisa lembrar de clicar. Recomendo copiloto, mas entregar primeiro a versão 'botão' como quick win e evoluir para automático.
- D — Lista por cartões vs lista densa atual: a lista densa (cor+tempo+responsável) está BOA para triagem; não virar cartões grandes (perderia densidade). O ajuste é de CONTEÚDO (última msg + não-lida), não de formato. Manter densa.
- E — Custo de IA (Tijolos): 'Sugerir resposta' e 'resumo' consomem créditos. Cenário pré-pago: cada sugestão debita Tijolos do fornecedor — alinha monetização, mas exige deixar claro o custo e ter fallback gratuito (rascunho simples) para não travar o atendimento.

## ✅ Manter
- Layout 2 colunas inbox+chat estilo WhatsApp com colapso mobile — é o acerto central, curva zero, mobile-importa
- Busca por lead (nome/telefone) em tempo real
- Chips de modo Todos/Meus/IA/Humano com contadores — é o 'o que é MEU agora' em 1 clique, o filtro que importa aqui
- Item de lista denso (bolinha de status + nome + tempo + origem + badge de responsável) — ótima densidade para triagem
- Cabeçalho do chat com pílula de modo (IA ativa / Você atendendo / Fulano atendendo)
- Botão 'Assumir' no header e na faixa do composer — É o job central em 1 clique
- Botão 'Devolver à IA' — fecha o ciclo handoff, coração do produto
- Composer com bloqueio inteligente (só escreve quem assumiu) e atalhos Enter/Shift+Enter
- Balões de mensagem com 4 temas (lead/IA/você/humano) — distinção visual essencial num inbox híbrido
- Polling 30s + realtime de mensagens via Supabase channels

## ❌ Remover (ruído)
- As 4 'respostas rápidas' fixas hardcoded — substituir por sugestão de IA contextual (não é remover por remover; é trocar fachada por IA real)
- Setas de scroll (ChevronLeft/Right) dos 2 grupos de chips — 4 itens curtos cabem com flex-wrap; é cromo anti-premissa
- Bloco 'Ações' do sideover (Assumir/Devolver/Ver ficha) — redundância total com o header a 2cm de distância
- Chip de identidade do operador (slug) no topo do inbox — duplica o header global e mostra 'slug' técnico, não nome
- Duplicata do contador no header global do CRM (manter o contador só no inbox)
- Filtro por estágio do funil DENTRO do inbox como fileira fixa — colapsar num dropdown 'Filtros' ou remover (pertence ao Kanban)
- Duplicações de campo no sideover: Score (2x), Agente IA (2x), Interesse (2x) — e esconder campos vazios '—'
- Código morto na classificação de remetente (leads.find(()=>false) heurístico)

## 🤖 Promover a IA-first / 1-toque
- 'Sugerir resposta (IA)': botão que gera 1-3 respostas no CONTEXTO da conversa, operador edita e confirma — É o elemento de maior valor faltante e o que torna a tela de fato IA-first (Click-and-Go puro)
- Resumo automático da conversa no painel Info ('em 1 linha: o que o lead quer') + 'Próximo passo sugerido' acionável
- Busca em linguagem natural no inbox ('leads quentes sem resposta hoje', 'quem falou de reforma de cozinha') — médio prazo
- IA retoma sozinha ao devolver, sem depender de nova mensagem do lead — remover a fragilidade técnica do fluxo
- Pré-qualificação visível: score/interesse já preenchidos pela IA no item e no header (ler, não digitar)

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Item da lista: trocar timestamp de CRIAÇÃO do lead por 'último contato' + adicionar 1 linha de preview da última mensagem + badge de não-lidas. Considerar realtime na lista para a não-lida aparecer na hora.  _(premissa: #5 útil e fácil de entender + #1 mínimo de cliques: num inbox o que importa é a última mensagem, não quando o lead nasceu. É o ganho de UX mais barato e impactante.)_
- **P2** · grande · risco medio — Substituir as 4 respostas rápidas fixas por 'Sugerir resposta (IA)': botão que chama a IA e gera 1-3 rascunhos contextuais; operador edita e confirma. Debitar Tijolos com custo visível e fallback gratuito.  _(premissa: #2 IA-first / Click-and-Go: é o elemento que transforma a tela de inbox-humano em inbox-pilotado-por-IA. Hoje a tela contradiz nossa régua central.)_
- **P3** · pequeno · risco baixo — Limpar copy técnica: trocar mensagem de dry-run que cita UAZAPI_BASE_URL, 'histórico não preservado' e 'peça ao lead nova mensagem' por textos neutros e confiantes. Nome de env var nunca aparece ao operador.  _(premissa: #3 bonito e coeso + funcional-não-fachada: vazamento técnico quebra a sensação premium e parece frágil.)_
- **P4** · pequeno · risco baixo — Enxugar o cromo de filtro: remover as 4 setas de scroll (flex-wrap nos chips); colapsar a fileira de estágio num dropdown 'Filtros' (ou remover do inbox), deixando só modo Meus/IA/Humano visível. Recupera altura vertical das conversas.  _(premissa: #1 mínimo de cliques + 'tabela≠tela de trabalho': filtro de funil pertence ao Kanban; duas fileiras criam carga de decisão e roubam área das mensagens.)_
- **P5** · medio · risco baixo — Deduplicar o sideover Info: 1 bloco essencial (telefone, interesse, score, valor, último contato) + 1 bloco 'IA' acionável (resumo da conversa + próximo passo). Remover Score/Agente IA/Interesse repetidos, esconder campos vazios e remover o bloco 'Ações' (já no header).  _(premissa: #5 útil + 'tabela≠tela de trabalho': planilha vertical de leitura com duplicatas é ruído; transformar em contexto + ação de IA.)_
- **P6** · pequeno · risco medio — Corrigir a classificação IA×humano dos balões: usar metadata.feito_por_tipo como fonte autoritativa no backend e remover o código morto heurístico (leads.find(()=>false)).  _(premissa: funcional-não-fachada: rotular errado quem enviou corrói a confiança no inbox híbrido, que é o diferencial da tela.)_
- **P7** · pequeno · risco baixo — Unificar 'Info' (sideover) como caminho primário para 'saber mais' e mover 'Ver ficha completa' para dentro dele; remover a pílula de slug do topo do inbox (manter só no header global, com nome legível).  _(premissa: #1 e #5: dois caminhos para 'saber mais' confundem; sideover não perde a conversa. Reduz ruído e cliques.)_
