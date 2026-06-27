# Precificação & IA  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
APROVADA com correções. Esta é uma das telas mais saudáveis do sistema e a auditoria está certa: não há ruído puro nem fachada — todos os campos servem ao job, que é configurar a economia da IA (Tijolo, markup, câmbio, preço por modelo). Está corretamente posicionada como bastidor de super-admin: NÃO compete com as telas de trabalho do fornecedor e é a única tela com R$, o que é coerente com a regra 'tabela=relatório'. O card 'Exemplo de margem' é o coração da tela e o melhor exemplo de IA-first do app (abstrato vira concreto, feedback imediato) — deve ser preservado e amplificado. PORÉM, julgada contra o TODO, ela tem dois problemas que pesam mais que qualquer questão de UX: (1) RISCO FINANCEIRO REAL confirmado no código — o GET tem catch silencioso (linha 68) que mantém os valores-default se a API falhar, e o Salvar (linha 206) só desabilita enquanto salva, sem dirty-state nem gate de load; logo o owner pode gravar markup=10/câmbio=6/Tijolo=R$0,10 por cima da config real de TODA a rede sem perceber. Isso é inaceitável numa tela que define a cobrança da plataforma e é P0. (2) IA-first fraco — numa tela cujo grupo se chama 'IA e Agentes', a IA não sugere NADA: câmbio e preços de modelo são digitados à mão quando são justamente os dois dados que mais mudam e que existem em fonte externa (cotação do dia, tabela oficial Anthropic/Mistral). Isso é o oposto da premissa #2. As questões de clareza (markup como '×10' em vez de margem %, alerta sem unidade, premissas escondidas do exemplo) são reais mas secundárias. Resumo do diretor: blindar o risco financeiro primeiro, depois injetar IA-first nos dois pontos certos, e só então refinar agrupamento e clareza. Nada de reescrever a tela.

## Cenários trazidos
- COMERCIAL vs HUB (quem é o dono desta tela): esta tela serve ao HUB/owner da rede, não ao fornecedor comercial. Recomendo manter assim e tornar o recorte explícito — esconder o item do menu para não-owners (hoje gera clique morto contra a régua de 3 cliques) e deixar o card de bloqueio só como rede de segurança de rota direta. O fornecedor nunca vê preço de modelo nem markup; ele só vê saldo de Tijolos e consumo nas SUAS telas. Conflito a evitar: não criar uma segunda tela de 'preços' no lado do fornecedor — saldo/consumo do fornecedor é responsabilidade da Central de Performance/carteira, não daqui.
- TABELA vs CARTÕES: já está resolvido do jeito certo — 'Moeda & margem' é formulário e 'Preços por modelo' são cards-linha (não tabela bruta), respeitando 'tabela=relatório'. NÃO transformar em tabela. O ajuste é só de agrupamento dentro do formulário (separar branding raro de câmbio operacional de política de cobrança), não de formato.
- O QUE AUTOMATIZAR COM IA — três níveis: (A) baixo risco e alto valor: câmbio USD->BRL puxado de cotação do dia, sugerido e editável, com selo 'atualizado há X' e alerta de defasagem (Click-and-Go, aceita em 1 toque); (B) médio: 'sincronizar preços da tabela oficial' por modelo, sugerido e editável, com salvar-todos-de-uma-vez; (C) avançado e data-driven: o card de exemplo deixa de usar premissa fixa (1000/500 tokens, pior caso) e passa a puxar o consumo MÉDIO real de hub_eventos, virando margem realizada — isso conecta esta tela ao keystone de métricas (F4/hub_eventos) e fecha o ciclo com a Central de Performance.
- MARKUP: dois caminhos — (i) mínimo: exibir ao lado do campo a margem % equivalente ('10x aprox. 900% de margem') só para tradução; (ii) ideal IA-first: owner define a MARGEM-ALVO em % e a IA calcula o multiplicador. Recomendo começar pelo (i) por ser barato e reversível, deixando (ii) para quando houver dado de consumo real alimentando o exemplo.
- ESCOPO da mudança: refinar in-place vs redesenhar. Veredito: refinar in-place. A tela já é funcional, com 2 endpoints reais e gate de owner. Redesenho seria desperdício e contra a régua de impacto x esforço.

## ✅ Manter
- Header sticky com subtítulo que já declara escopo e público (super-admin) — honesto e orientador
- Gate de permissão owner-only (decisão de negócio do dono da rede; correto e seguro)
- Card 'Exemplo de margem (ação típica)' — peça mais IA-first e mais 'fácil de entender' da tela; é o coração e deve ganhar destaque, não perder
- Formato de cards-linha para 'Preços por modelo' (respeita tabela!=tela de trabalho)
- Edição inline dos preços e checkbox Ativo por modelo (controle legítimo de curadoria)
- Bloco 'Moeda & margem' enxuto, ajustável em poucos cliques — é exatamente o job da tela
- Ser a única tela com R$ — coerência com a regra tabela=relatório em todo o sistema

## ❌ Remover (ruído)
- Item de menu 'Precificação & IA' para usuários NÃO-owner (vira clique morto que conta contra a régua de 3 cliques; o card de bloqueio permanece só como rede de segurança de rota direta)
- Tag 'Turbo/Econômico' derivada de string (startsWith claude) — frágil e pouco informativa; substituir por papel real ('Padrão dos agentes'/'Fallback') vindo da config, não de prefixo
- Premissas invisíveis do card de exemplo (1000/500 tokens, 'modelo ativo mais caro') como números mágicos sem microcopy — remover a opacidade, não o card
- Comportamento de fallback SILENCIOSO (manter os valores-default sem avisar quando o GET falha) — remover o silêncio, mantendo o fallback visível e sinalizado

## 🤖 Promover a IA-first / 1-toque
- Câmbio USD->BRL: sugerir cotação do dia (editável) com selo 'atualizado há X' e alerta de defasagem; aceitar/ajustar em 1 toque (Click-and-Go)
- Preços por modelo: botão 'sincronizar preços da tabela oficial' (sugerido e editável) em vez de digitação manual
- Markup por margem-alvo: owner informa a margem % desejada e a IA calcula o multiplicador (e mostra a equivalência inversa)
- Card de exemplo data-driven: puxar consumo médio real de hub_eventos para mostrar margem REALIZADA, não só o pior caso teórico
- Confirmação inteligente ao salvar markup/câmbio/valor do Tijolo: reaproveitar o card de exemplo para mostrar o DELTA de margem antes de gravar

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Blindar risco financeiro do Salvar: (a) distinguir 'config real carregada' de 'usando padrões' — banner visível quando o GET falhar (hoje catch silencioso na linha 68); (b) bloquear o botão Salvar até o GET confirmar carregamento; (c) habilitar Salvar só com dirty-state (alteração real).  _(premissa: Funcional não-fachada + útil/confiável: impede gravar default por cima da cobrança real de toda a rede)_
- **P2** · pequeno · risco baixo — Esconder o item de menu 'Precificação & IA' para não-owners (manter o card de bloqueio só como guarda de rota direta).  _(premissa: Máximo 3 cliques: elimina clique morto e reforça que a tela é rara/sensível)_
- **P3** · pequeno · risco baixo — Confirmação curta ao salvar markup/câmbio/valor do Tijolo mostrando o DELTA na margem (reusar o card de exemplo); só para esses 3 campos sensíveis.  _(premissa: Útil e fácil de entender: torna visível a consequência financeira antes de gravar)_
- **P4** · medio · risco medio — IA-first no câmbio: buscar cotação USD->BRL do dia como sugestão editável, com selo 'atualizado há X' e alerta de defasagem; aceitar em 1 toque.  _(premissa: IA-first (Click-and-Go): IA sugere, owner confirma; evita operar no prejuízo por câmbio velho)_
- **P5** · pequeno · risco baixo — Clareza do markup: exibir margem % equivalente ao lado do multiplicador ('10x aprox. 900%'); deixar margem-alvo->multiplicador para fase seguinte.  _(premissa: Fácil de entender: traduz jargão de fator bruto para a métrica que o owner pensa)_
- **P6** · medio · risco baixo — Subdividir o grid em 'Moeda & margem' (nome, valor do Tijolo, markup, câmbio) e 'Política de cobrança' (Modo com 2 cards de consequência + Alerta de saldo com unidade 'Tijolos').  _(premissa: Fácil de entender: separa branding raro de câmbio operacional de governança de cobrança)_
- **P7** · pequeno · risco baixo — Microcopy nas premissas do card de exemplo ('estimativa p/ 1000 tokens in + 500 out, modelo ativo mais caro') e permitir alternar o modelo.  _(premissa: Fácil de entender: tira a aparência de número mágico)_
- **P8** · grande · risco medio — IA-first nos preços por modelo: botão 'sincronizar tabela oficial' (sugerido/editável) + 'salvar todos de uma vez'; substituir tag Turbo/Econômico por papel real vindo da config (Padrão dos agentes/Fallback); avisar ao desativar o modelo padrão dos agentes e impedir desativar todos.  _(premissa: IA-first + máximo 3 cliques: elimina digitação manual e o salvar-modelo-a-modelo)_
- **P9** · grande · risco medio — Card de exemplo data-driven: puxar consumo médio real de hub_eventos para mostrar margem REALIZADA além do pior caso.  _(premissa: IA-first + útil: liga a precificação ao keystone de métricas e à Central de Performance)_
