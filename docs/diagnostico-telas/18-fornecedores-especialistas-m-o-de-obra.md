# Especialistas (mão de obra)  ·  Fornecedores

**Rota:** 

## Veredito do diretor
Tela honesta e funcional (CRUD real, lista e não planilha, link de convite rastreado, chips de especialidade) — o esqueleto está certo e respeita "tabela ≠ tela de trabalho". Aprovo manter no ar. Mas ela ainda não cumpre o JOB real desta base dentro do todo: especialistas são o ESTOQUE DE EXECUÇÃO do fornecedor, e o job que importa é "achar e escalar o profissional certo para a obra" (ex.: pedreiro disponível em SP, 5+ anos). Hoje a tela é boa para CADASTRAR e fraca para USAR: sem busca/filtro/ordenação, vira rolagem infinita com 50+ nomes e o "achar" estoura os 3 cliques. E é a tela mais ANÊMICA em IA-first do sistema: zero sugestão/pré-preenchimento (telefone/CPF sem máscara, cidade/UF não derivam do DDD, dedup por CPF prometido mas não visível). Dois ruídos de fachada precisam sair: jargão "(formato da rede Obra10+)" e o selo "Verificado" órfão (sinaliza confiança que nenhum fluxo sustenta — risco direto contra "funcional, não fachada"). Prioridade: primeiro fazer a base ser USÁVEL (busca+filtro), depois fazer o cadastro ser IA-first (máscara + auto-preenchimento por DDD + dedup CPF), depois polir. Cuidado de coesão: NÃO transformar isto num clone do CRM de pessoas — especialista não tem login, não é lead, não é pipeline; é recurso. Reusar os MESMOS componentes de chips/segmented/busca das outras telas, não inventar padrão novo aqui.

## Cenários trazidos
- Servir o COMERCIAL (fornecedor) vs servir o HUB (rede): hoje a tela serve só o fornecedor dono da base (mão de obra própria/terceirizada, single-tenant). Recomendo manter assim no curto prazo — é o job imediato (alocar em obra). O cenário 'rede' (especialista verificado que o Hub recomenda entre fornecedores) é tentador mas PERIGOSO agora: exigiria fluxo de verificação real, consentimento e modelo de compartilhamento. Decisão: adiar o ângulo-rede; por isso o selo 'Verificado' deve sumir até existir esse fluxo, não virar promessa vazia.
- Lista vs cartões: a auditoria sugere cartões, mas para mão de obra (escanear muitos nomes rápido por especialidade/cidade) a LISTA densa é superior a cartões (cartão gasta espaço e reduz quantos cabem na tela). Decisão: MANTER lista; o ganho não está no formato do item e sim em BUSCA+FILTRO+CONTADOR no topo. Cartões só fariam sentido se cada item virasse 'ficha de alocação' com foto/disponibilidade — fora de escopo agora.
- IA-first incremental vs big-bang: derivar cidade/UF do DDD do telefone é IA-first BARATO e determinístico (tabela DDD→UF, sem LLM, sem custo de crédito) — fazer já. Auto-preencher por CEP e validar/dedup CPF são o passo seguinte (depende da migração de coluna CPF já prevista). Enriquecimento via LLM (ex.: inferir especialidade por texto livre) NÃO se justifica aqui e gastaria Tijolos à toa.
- Campo livre 'Observações' vs estruturado: manter como escape opcional rebaixado, mas o valor real de negócio (diferenciais, certificações, disponibilidade) deveria virar chips estruturados e pesquisáveis no futuro, porque é isso que alimenta a alocação inteligente em obra — texto livre não ranqueia.

## ✅ Manter
- Lista (não planilha) com clique-na-linha para editar — respeita 'tabela ≠ tela de trabalho' e o job de escanear rápido
- Chips de especialidade de múltipla escolha — é o melhor elemento da tela e o padrão Click-and-Go a replicar nas outras
- Toggle 'Trabalha sozinho / Tem equipe' + campo condicional Nº pessoas — padrão segmentado sólido, útil para dimensionar alocação
- Botão 'Convidar (link)' com rastreio (cadastro pelo próprio especialista, sem login) — alavanca de escala e descarrega digitação do operador
- Formulário inline (sem trocar de página) e estados de loading/erro reais no salvar
- CPF como chave anti-duplicado / código único — alinhado à diretriz de dedup; manter o conceito e completar a execução
- Subtítulo explicativo que desfaz a ambiguidade 'especialista = mão de obra, sem login' (cortando só o jargão)

## ❌ Remover (ruído)
- Jargão '(formato da rede Obra10+)' do subtítulo — ruído interno, não significa nada para o usuário final
- Selo 'Verificado' órfão — remover até existir fluxo real de verificação (hoje é fachada: sinaliza confiança sem origem nem critério)
- Tooltip/title longo no botão Convidar — inútil em touch/mobile; substituir por toast com a URL e ação
- Placeholder fazendo papel de label no textarea Observações — fere acessibilidade; trocar por label persistente

## 🤖 Promover a IA-first / 1-toque
- Auto-preencher UF (e cidade quando possível) a partir do DDD do telefone — IA-first determinístico, barato, sem crédito; maior ganho Click-and-Go da tela
- Máscara + validação de telefone e CPF em tempo real, com dedup por CPF/telefone visível ('já existe na sua base') no momento de salvar
- Convite em 1 toque: toast com botão 'Enviar no WhatsApp' (wa.me com mensagem pronta) + URL visível como fallback se o clipboard falhar — fecha o ciclo de convite sem sair da tela
- Especialidade PRINCIPAL definível em 1 clique (estrela/badge no chip) em vez da regra implícita 'a 1ª é a principal'
- Busca com sugestão inteligente ('pedreiro em SP') e filtros por chip de especialidade/cidade — transformar 'achar o profissional' em ação de 1 toque

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Adicionar barra de busca + filtros por especialidade e cidade (chips) + contador total no topo da lista, reusando os componentes de busca/chips já existentes em outras telas do CRM.  _(premissa: Máximo 3 cliques: hoje 'achar o profissional certo' em base com volume estoura o limite; é o gap que mais quebra o job real (alocar mão de obra).)_
- **P2** · pequeno · risco baixo — Auto-preencher UF a partir do DDD do telefone (tabela DDD→UF, sem LLM) e aplicar máscara de telefone/CPF com validação em tempo real.  _(premissa: IA-first / Click-and-Go: a IA pré-preenche e o usuário confirma; reduz digitação e erro. Premissa 'prático e fácil'.)_
- **P3** · pequeno · risco baixo — Remover o selo 'Verificado' órfão e o jargão '(formato da rede Obra10+)'; trocar placeholder do textarea por label persistente.  _(premissa: Funcional não-fachada + 'útil e fácil de entender': elimina sinal de confiança sem lastro e ruído de jargão.)_
- **P4** · medio · risco medio — Completar dedup por CPF/telefone no POST (interno e público) após a migração de coluna CPF já prevista, com feedback visível 'profissional já existe na sua base' (oferecer abrir o existente).  _(premissa: Código único / dedup: não duplicar a mesma pessoa na base, base confiável para alocação.)_
- **P5** · pequeno · risco baixo — Convite em 1 toque: toast com a URL copiada + botão 'Enviar no WhatsApp' (wa.me com mensagem pronta) e fallback de URL visível se o clipboard falhar.  _(premissa: Máximo de cliques mínimo + mobile importa: fecha o ciclo de convite sem o operador montar mensagem manualmente.)_
- **P6** · pequeno · risco baixo — Permitir definir a especialidade PRINCIPAL em 1 clique (estrela/badge no chip selecionado) e converter o select 'Tempo de experiência' em chips/segmented para coesão visual com o resto do form.  _(premissa: Coeso e Click-and-Go: elimina inconsistência chips-vs-select nativo e torna a regra da principal explícita.)_
- **P7** · pequeno · risco baixo — Atualizar o empty state para citar as DUAS vias ('Cadastre você mesmo ou envie o link de convite') e destacar o campo inválido (borda vermelha + foco) em vez de erro genérico no topo.  _(premissa: Útil e fácil de entender: guia o primeiro uso e mostra o erro onde ele acontece, importante no mobile.)_
