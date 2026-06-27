# Contatos de notificação  ·  Administração

**Rota:** 

## Veredito do diretor
Tela sólida e FUNCIONAL (não é fachada): a tabela hub_contatos_notificacao é realmente consumida pelo webhook do WhatsApp e pelas rotas de ciclos, então os toggles têm efeito real no roteamento de alertas. Acerta o padrão certo (cards escaneáveis, não planilha), o design dark verde+dourado coeso e o Click-and-Go nos toggles. Como diretor, aprovo o esqueleto e NÃO quero refatoração. Mas há um risco funcional de produto que me incomoda mais que tudo: telefone sem validação alimenta DIRETO o disparo de WhatsApp — um dígito errado = alerta de novo lead perdido em silêncio, e perder lead é exatamente o que mata o objetivo Obra10+/hub. Esse é o ponto que faz a diferença entre 'tela bonita' e 'tela confiável'. Em paralelo, o canal E-mail/Ambos parece não ter envio implementado: oferecer uma opção que nunca dispara é fachada parcial e quebra a régua 'funcional, não fachada'. Por fim, é tela de Administração de BAIXA frequência — fez bem em NÃO adicionar KPIs, filtros ou ruído; não deixe ninguém 'enriquecer' essa tela. O salto de qualidade aqui não é mais campo, é confiança ('o alerta vai chegar?') e menos digitação (puxar contatos da equipe já cadastrada em vez de redigitar).

## Cenários trazidos
- QUEM ESSA TELA SERVE — comercial do fornecedor vs. operação do hub: hoje ela serve ao fornecedor (quem da MINHA equipe é avisado de novo lead). Decisão de diretor: manter escopo no fornecedor/tenant; roteamento de alertas do HUB (distribuição de lead entre escritórios) é outra tela/outro dono — não misturar aqui para não inflar a tela. Risco de misturar: quebra multi-tenant e confunde o usuário.
- FORMATO — cards vs. tabela: já está em cards e é o correto pela régua 'tabela≠tela de trabalho'. Não há cenário de voltar para tabela. Cenário só de POLIR o card (mostrar e-mail quando canal inclui e-mail; estado ativo/inativo já resolvido por opacidade).
- CANAL E-MAIL — implementar agora vs. esconder: (A) implementar disparo de e-mail de fato (mais esforço, fecha a promessa); (B) marcar E-mail/Ambos como 'em breve' desabilitado até existir envio (rápido, honesto). Diretor recomenda (B) AGORA para parar a fachada e (A) na fila de backlog quando e-mail virar canal de verdade. Nunca deixar opção que não dispara selecionável.
- IA-FIRST — quanto automatizar: (A) leve — ao adicionar, sugerir contatos da equipe/usuários/membros já no sistema para 'escolher e confirmar' (1 toque) em vez de redigitar; (B) pesado — IA decide sozinha quem deve receber cada evento. Diretor escolhe (A): aderente ao Click-and-Go (IA sugere, humano confirma) e a tela é de baixa frequência, não justifica automação pesada.
- DESTRUTIVO — Remover vs. Desativar: como o toggle Ativo já cobre 'parar de avisar' de forma reversível, Remover pode virar ação secundária (menos proeminente) + confirmação/undo. Cenário alternativo: esconder Remover atrás do Editar. Diretor: manter Remover visível mas secundário, com undo via toast — evita apagar por engano quem recebe alertas críticos.

## ✅ Manter
- Lista em cards (não tabela) — formato correto, escaneável, coeso com dark verde+dourado
- Toggle Ativo inline no card — pausar alguém em 1 clique, reversível, Click-and-Go puro
- Chips de eventos com cores semânticas (novo lead/aprovação/encaminhamento) — comunicam a config sem abrir o form
- Botão '+ Adicionar' dourado no header — ação primária clara em 1 clique
- Formulário inline curto (não modal pesado) com toggles em vez de checkboxes
- Estado vazio com texto explicativo do propósito — fácil de entender (premissa 5)
- AUSÊNCIA de KPIs/filtros/gráficos — acertou ao não poluir uma tela de baixa frequência

## ❌ Remover (ruído)
- A opção 'E-mail' e 'Ambos' do select de canal ENQUANTO o disparo de e-mail não existir (deixar apenas WhatsApp ativo; e-mail volta como 'em breve' desabilitado) — remover a fachada
- Delete imediato sem confirmação no botão Remover (remover o comportamento, não o botão) — substituir por confirmação leve/undo
- Proeminência visual do botão Remover — rebaixar a ação secundária já que Desativar cobre a maioria dos casos

## 🤖 Promover a IA-first / 1-toque
- Ao adicionar contato, sugerir puxar pessoas da equipe já cadastradas (usuários/membros do tenant) — escolher e confirmar em 1 toque em vez de redigitar nome+telefone+cargo (IA-first leve, Click-and-Go)
- Chips de evento clicáveis (toggle inline do evento direto no card) — transforma o ajuste mais comum de 3 cliques (Editar→form→Salvar) em 1 toque
- Auto-validar/normalizar telefone BR no momento da digitação (máscara + checagem) com feedback imediato — a IA/regra 'limpa' o número para garantir que o WhatsApp chega

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Validar e mascarar telefone BR no formulário (máscara + validação de formato) antes de salvar, já que esse número alimenta direto o envio de WhatsApp; bloquear save com telefone inválido e mostrar erro claro.  _(premissa: Funcional não-fachada + acima de tudo ÚTIL: telefone errado = alerta de novo lead perdido em silêncio, o que sabota o objetivo Obra10+ (não perder lead).)_
- **P1** · pequeno · risco baixo — Resolver o canal E-mail/Ambos: desabilitar/marcar 'em breve' enquanto não houver disparo de e-mail comprovado nas rotas (e abrir item de backlog para implementar o envio de fato). Não deixar opção selecionável que nunca dispara.  _(premissa: Funcional, não fachada: o usuário não pode escolher um canal e nunca receber nada sem aviso.)_
- **P2** · pequeno · risco baixo — Exigir e-mail quando o canal incluir e-mail e exibir o e-mail no card quando canal=email/ambos (fechar o loop de confiança 'pra onde o alerta vai').  _(premissa: Útil e fácil de entender: o card deve dizer claramente o destino do alerta.)_
- **P2** · pequeno · risco baixo — Adicionar confirmação leve (ou undo via toast) no Remover e rebaixar sua proeminência visual, já que Desativar cobre a maioria dos casos de forma reversível.  _(premissa: Prático e seguro: evitar apagar por engano quem recebe alertas críticos.)_
- **P2** · pequeno · risco baixo — Micro-feedback no toggle Ativo (estado pendente + sucesso) e acessibilidade (role='switch' + aria-checked) para o usuário saber que gravou em conexão lenta.  _(premissa: Click-and-Go confiável: a ação de 1 clique precisa confirmar que surtiu efeito.)_
- **P3** · medio · risco baixo — Tornar os chips de evento clicáveis (toggle inline do evento no card), espelhando o toggle Ativo.  _(premissa: Mínimo de cliques: o ajuste mais frequente cai de 3 cliques para 1.)_
- **P3** · medio · risco baixo — IA-first leve: ao adicionar, sugerir contatos da equipe/usuários/membros já no sistema para 'escolher e confirmar' em vez de redigitar.  _(premissa: IA-first (Click-and-Go): a IA pré-preenche, o usuário só confirma.)_
- **P3** · pequeno · risco baixo — Incluir CTA dourado 'Adicionar' dentro do estado vazio (não obrigar a achar o '+' no header).  _(premissa: Fácil de usar: o primeiro contato deve nascer de dentro do empty state.)_
