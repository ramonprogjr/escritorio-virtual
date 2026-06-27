# Canais de entrada  ·  Marketing

**Rota:** 

## Veredito do diretor
Tela honesta e funcional (CRUD real, multi-tenant, auth de gestor, ativar/desativar), bem coesa com a marca dark verde+dourado. Mas tem um problema de PRODUTO mais grave do que a auditoria capturou: o elo com a Distribuição é FICTÍCIO hoje. Confirmei no código que a tela de Distribuição (/crm/distribuicao) monta o select de 'origem' a partir de um array HARDCODED (ORIGENS = whatsapp/meta/google/indicacao/manual/super_cadastro, em distribuicao/page.tsx:82) e NÃO lê os canais cadastrados aqui. Ou seja: o usuário pode cadastrar um canal com origem 'whatsapp_vendas' que nunca aparecerá nas regras, e a copy ainda promete que 'a origem aqui é o valor usado nas regras de Direcionamento' (canais-entrada/page.tsx:94) — com nome ERRADO ('Direcionamento' não existe; o menu/tela é 'Distribuição') e SEM link. Logo, o maior risco não é 'excluir quebra em silêncio'; é que cadastrar JÁ não tem efeito garantido na distribuição. Decisão de Diretor: esta tela só se justifica no TODO se virar a ÚNICA fonte de verdade das origens que a Distribuição consome. Enquanto isso não existir, ela é meio-ruído sofisticado. Veredito: MANTER a tela, mas (a) tornar o cadastro IA-first/1-toque, (b) esconder jargão técnico, (c) corrigir a copy/nome agora (barato), e (d) — prioridade de produto — fazer a Distribuição ler as origens daqui, fechando o elo que dá sentido à tela. Sobre 'comercial vs hub': hoje a tela serve o COMERCIAL (fornecedor cadastra suas fontes). A origem real de leads do HUB vem do pipeline WhatsApp/Meta; cuidar para não criar duas verdades de 'origem'.

## Cenários trazidos
- ELO REAL vs FACHADA: hoje Distribuição usa ORIGENS hardcoded e ignora os canais cadastrados. Cenário A (recomendado): a Distribuição passa a ler as origens cadastradas aqui (Canais vira fonte de verdade) — a tela ganha propósito sistêmico. Cenário B (status quo): manter array fixo e rebaixar esta tela a 'catálogo informativo' — então metade dos campos (origem_slug, identificador) vira ruído e a copy mente. Diretor escolhe A.
- COMERCIAL vs HUB: esta tela é do fornecedor (suas fontes de captação no CRM). O HUB tem sua própria captação (pipeline WhatsApp/Meta→fila→worker). Cenário A: manter uma só taxonomia de 'origem' compartilhada entre captação-hub e canais-fornecedor (evita duas verdades). Cenário B: separar explicitamente 'origem do hub' de 'canal do fornecedor'. Recomendo A com vocabulário único.
- TABELA vs CARTÕES: já é lista de cards-linha (correto, não é planilha). Cenário de evolução: enriquecer cada card com sinal de valor — contagem de leads recebidos por canal nos últimos 30 dias e status de saúde (recebendo / parado há X dias). Isso transforma a lista de 'cadastro' em 'painel de canais', que é o que um gestor quer ver.
- IA-FIRST no cadastro: Cenário A (1-toque): escolher o Tipo já cria o canal com Nome e origem sugeridos ('WhatsApp Vendas' / 'whatsapp'), usuário só confirma — 2 cliques. Cenário B (kit inicial): no empty state, botão 'Criar meus canais comuns' gera WhatsApp+Meta+Site de uma vez. Os dois cabem e atacam a premissa de ≤3 cliques.
- SLUG técnico: Cenário A (esconder): derivar origem automaticamente do tipo, expor só em 'modo avançado'. Cenário B (eliminar): se a Distribuição passar a referenciar o canal por ID (não por string de slug), o slug técnico some da UI por completo — solução mais limpa e à prova de erro de digitação. B é o ideal de produto.

## ✅ Manter
- O formato de lista (cards-linha), não tabela — alinhado a 'tabela ≠ tela de trabalho'
- Header coeso, CTA dourado com estado de loading e disabled
- Toggle ativo/inativo de 1 clique (sem confirmação desnecessária)
- Empty state que guia o 1º cadastro
- Confirmação em ação destrutiva (excluir) — manter o princípio, trocar só o componente nativo
- Parágrafo educativo (educar antes de pedir cadastro) — mas com a copy corrigida
- Mensagem de erro inline e auth de gestor no POST (funcional, não fachada)

## ❌ Remover (ruído)
- Campo 'observação' do grid principal (texto livre de baixo valor que aperta o mobile) — mover para 'mostrar mais' ou cortar
- Exposição do 'slug'/'origem (p/ regras)' como campo digitável no fluxo padrão — derivar automaticamente; só em modo avançado
- window.confirm() nativo (quebra a estética dark premium)
- O termo 'Direcionamento' na copy — é nome inexistente; substituir por 'Distribuição'
- Placeholder genérico único do 'Identificador' (form id/nº/conta) — ou rótulo dinâmico por tipo, ou remover se não for consumido em lugar nenhum (verificar uso real)

## 🤖 Promover a IA-first / 1-toque
- Cadastro 1-toque: escolher Tipo já pré-preenche Nome e origem com confiança; usuário confirma (≤3 cliques)
- Kit inicial no empty state: 'Criar WhatsApp + Meta + Site automaticamente' em 1 clique
- Origem derivada automaticamente do tipo/nome (sem digitar slug)
- Card de canal com contagem de leads recebidos (30d) e alerta de saúde ('parado há X dias') sugerido pela IA
- Sugestão proativa: ao detectar leads chegando por uma origem sem canal cadastrado, a IA sugere 'criar canal' com 1 clique

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir a copy: trocar 'Direcionamento' por 'Distribuição' e transformar em link para /crm/distribuicao (idem 'ficha do agente'). Quick win de clareza e do elo sistêmico.  _(premissa: #5 útil/fácil de entender + coerência entre telas (nomenclatura do menu))_
- **P1** · medio · risco medio — Fechar o elo de produto: fazer a Distribuição (distribuicao/page.tsx:82, array ORIGENS hardcoded) ler as origens dos canais cadastrados aqui, tornando esta tela a fonte de verdade. Sem isso, o cadastro não tem efeito garantido na distribuição.  _(premissa: Coerência do TODO (Hub distribui por origem) + funcional-não-fachada)_
- **P2** · medio · risco baixo — Tornar o cadastro IA-first/1-toque: ao escolher Tipo, pré-preencher Nome e origem com confiança; usuário só confirma. Reduz para ≤3 cliques.  _(premissa: #1 máx 3 cliques + #2 IA-first/Click-and-Go)_
- **P2** · pequeno · risco baixo — Corrigir responsividade: trocar grid fixo repeat(5,1fr) por repeat(auto-fit,minmax(180px,1fr)) e tirar 'observação' do grid principal.  _(premissa: mobile importa + responsividade)_
- **P2** · pequeno · risco baixo — Esconder o slug técnico: derivar origem automaticamente do tipo/nome; expor edição só em 'modo avançado'.  _(premissa: #5 fácil de entender (remover jargão) + reduzir erro silencioso)_
- **P3** · medio · risco medio — Substituir window.confirm() por modal do design system e, antes de excluir, avisar se a origem está em uso em regras de Distribuição (integridade).  _(premissa: #3 bonito/coeso + funcional-não-fachada (não quebrar regras em silêncio))_
- **P3** · pequeno · risco baixo — Trocar select de Tipo por chips com ícone/cor por canal (padrão Membros) e chip de tipo colorido na lista para leitura instantânea.  _(premissa: #2 Click-and-Go (escolher, 1 toque) + #3 coeso)_
- **P4** · grande · risco medio — Enriquecer cada card com contagem de leads recebidos (30d) e status de saúde do canal, transformando a lista em painel de canais.  _(premissa: #5 útil (dado acionável) + valor ao gestor/owner)_
- **P4** · pequeno · risco baixo — Kit inicial no empty state: botão 'Criar WhatsApp + Meta + Site' em 1 clique.  _(premissa: #1 mínimo de cliques + #2 IA-first no onboarding)_
- **P4** · pequeno · risco baixo — Update otimista + toast no toggle ativo/inativo (hoje recarrega em silêncio se falhar).  _(premissa: funcional-não-fachada (feedback real))_
