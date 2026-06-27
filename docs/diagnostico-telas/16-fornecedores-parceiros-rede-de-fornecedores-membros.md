# Parceiros (rede de fornecedores/membros)  ·  Fornecedores

**Rota:** 

## Veredito do diretor
A tela acerta a ESPINHA (esteira Captacao -> Homologacao -> Homologado em abas com contagem, codigo unico PAR-, chip "Recebe leads" ligando ao motor de distribuicao, identidade dark verde+dourado) mas erra a CARNE: o nucleo e uma planilha de 11 colunas, o que viola frontalmente a regra ETERNA do projeto ("tabela != tela de trabalho; tabela = relatorio") e a premissa "util e facil de entender". Pior, ha fachada funcional (selecao em massa que nao dispara nenhuma acao) e ZERO IA numa plataforma que se vende como IA-first. O "Convidar" so copia um link fixo e empurra o envio real pra fora do sistema, quebrando o ciclo. Em relacao ao TODO: esta tela e o gargalo de entrada da rede inteira (sem parceiro homologado nao ha quem receba lead, nao ha comissao, nao ha SaaS vendido). Logo ela merece ser uma das mais afiadas do produto, e hoje e uma das mais "planilha". Veredito: NAO esta apresentavel como tela de trabalho IA-first; precisa virar Kanban/cards orientado a acao com a IA dizendo "o proximo passo" e fechando o convite dentro do sistema. Estrutura de abas e os elementos de estado (chip leads, codigo, empty states) sao bons e ficam.

## Cenários trazidos
- CENARIO A - Servir o COMERCIAL do fornecedor (quem usa o CRM): a tela mostra 'meus parceiros/meus especialistas' como base operacional. Foco em contato rapido e proximo passo. Implica cards enxutos + atalho Whats/ligar. Mais simples, e o uso diario.
- CENARIO B - Servir o HUB/rede (quem homologa e distribui): a tela e o painel de recrutamento da rede inteira; foco em mover gente pela esteira, cobrar docs, liberar 'recebe leads'. Implica Kanban por estagio + acoes em lote reais (avancar estagio, marcar homologado). RECOMENDADO como eixo, pois e o job que esta tela nomeia ('homologacao').
- CENARIO C (hibrido, escolhido) - Kanban por estagio (serve o hub) com cards de 3-4 dados-chave e atalho de contato (serve o comercial), e a tabela densa de 11 colunas migrada para /crm/relatorios como visao 'planilha/exportacao'. Resolve as duas audiencias sem duplicar logica.
- TABELA vs CARTOES: manter tabela SOMENTE em /crm/relatorios (visao exportacao/auditoria); na tela de trabalho usar cards/Kanban. Evita conflito com as demais telas do CRM que ja seguem 'tabela=relatorio'.
- O QUE AUTOMATIZAR COM IA: (1) 'proximo passo' por parceiro (ex.: 'cobrar 2 docs', 'agendar call', 'liberar p/ leads') como chip de acao 1-toque; (2) mensagem de convite e de cobranca pre-redigida (Whats/email); (3) priorizacao de quem cobrar hoje (parados ha mais tempo / perto de homologar). Comecar pelo convite redigido (menor risco, fecha o ciclo).
- COLUNAS CONDICIONAIS vs CARDS: alternativa de baixo esforco se o Kanban demorar - tornar colunas condicionais por aba (Modulos/Leads so em suas fases, remover Status e Comissao) ja reduz muito o ruido sem reescrever a tela; serve de ponte ate o Kanban.

## ✅ Manter
- Abas Captacao / Homologacao / Homologados com contagem (sao o funil, navegacao em 1 clique)
- Codigo unico PAR-2026-xxxx (dedup e rateio de comissao; coerente com a premissa de codigo unico) - mas como metadado sob o nome, nao coluna larga
- Coluna/dado Estagio (e o dado-chave do job; vira eixo do Kanban e chip colorido)
- Chip 'Recebe leads' (estado mais importante da rede; liga ao motor de distribuicao) - dar mais destaque na aba Homologados
- EmptyState por aba orientando o proximo passo (boa UX Click-and-Go)
- Estados de Carregando/Erro (honestidade, nao-fachada) - trocar texto cru por skeleton
- Botao Convidar com link publico unico (acao-job principal) - mantido e ampliado com envio
- Busca multi-campo (nome/codigo/telefone/email/especialidade)

## ❌ Remover (ruído)
- Selecao em massa (checkboxes + barra 'N selecionado') ENQUANTO nao houver acao em lote real - hoje e fachada funcional, nao leva a lugar nenhum
- Coluna Status - redundante, a aba ativa ja define o status (informacao zero)
- Coluna Comissao (%) da lista - dado contratual/financeiro, ruido na esteira de recrutamento; mover para o detalhe/aba financeira
- Coluna E-mail da lista - dado-de-planilha raramente acionado dali; mandar para o detalhe
- Trailing redundante 'Y homologados' - ja aparece no contador da aba; deixar so 'X cadastrados'
- Tabela densa de 11 colunas como tela de trabalho - migrar integral para /crm/relatorios

## 🤖 Promover a IA-first / 1-toque
- Convite/cobranca redigido pela IA com botoes diretos 'Enviar por WhatsApp' e 'Enviar por e-mail' (fecha o job dentro do sistema, 1-toque)
- Chip 'Proximo passo' sugerido pela IA por parceiro (ex.: cobrar docs, agendar call, liberar p/ leads) - acao de 1 toque no card
- Priorizacao IA de 'quem cobrar hoje' (parados ha mais tempo / perto de homologar) como ordenacao default do Kanban
- Pre-preenchimento Click-and-Go do parceiro a partir do link publico (IA infere mercado/UF/especialidade do que ja foi enviado, usuario so confirma)

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Remover (ou wire-up) a selecao em massa: como nao ha nenhuma acao em lote ligada, retirar checkboxes/barra agora para eliminar fachada funcional. Reintroduzir somente junto com acoes reais (avancar estagio em lote / marcar homologado).  _(premissa: Funcional nao-fachada + util (nada de UI sem payoff))_
- **P2** · pequeno · risco baixo — Tornar colunas condicionais por aba e podar ruido: remover Status e Comissao da lista; mostrar Modulos so na aba Homologacao e Leads so na aba Homologados; reduzir trailing para 'X cadastrados'. Ponte de baixo custo ate o Kanban.  _(premissa: Util e facil de entender / minimo de ruido)_
- **P3** · medio · risco medio — Adicionar envio de convite dentro do sistema: botoes 'Enviar por WhatsApp' e 'Enviar por e-mail' no painel Convidar, com mensagem pre-redigida pela IA (link publico ja embutido). Mantem o nome 'Convidar parceiro'.  _(premissa: IA-first + max 3 cliques (fecha o ciclo sem sair do sistema))_
- **P4** · grande · risco medio — Evoluir a lista para Kanban/cards por estagio (eixo = Estagio), com 3-4 dados por card (nome, especialidade/mercado, local, chip 'proximo passo' da IA) e atalho de contato (Whats/ligar). Migrar a tabela completa de 11 colunas para /crm/relatorios.  _(premissa: tabela != tela de trabalho + mobile importa + IA-first)_
- **P5** · pequeno · risco baixo — Trocar loading de texto cru por skeleton de cards/linhas, alinhando ao padrao premium do design system (dark verde+dourado).  _(premissa: Bonito e coeso)_
- **P6** · pequeno · risco baixo — Adicionar CTA 'Convidar' inline no EmptyState da aba Captacao e destacar o chip 'Recebe leads' na aba Homologados.  _(premissa: Click-and-Go / orientar o proximo passo)_
