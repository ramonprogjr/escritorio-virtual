# Pedidos de material  ·  Operações

**Rota:** 

## Veredito do diretor
CRUD honesto por baixo (API real, tenant_id da sessão, guards GET=sessão/POST=comercial, usa card e não tabela), mas é a tela que mais destoa da régua do produto. Três pecados confirmados no código: (1) campo 'ID da obra' em texto livre (linhas 121-126) — pede pra colar um UUID, a pior violação de 'escolher, não digitar' do CRM inteiro; (2) valor_estimado existe no type, no SELECT e no insert (linhas 16, 56) mas nunca aparece nem é capturado — o ÚNICO sinal de valor de um pedido de compra está invisível, o que é desperdício puro e mata a monetização/controle de obra do todo; (3) zero IA-first — pedido nasce de textarea vazia, oposto do Click-and-Go. O ?obra_id= é lido mas tratado como string editável (linhas 23, 27), então o contexto da obra que JÁ chega pela URL é jogado fora. Veredito: a tela NÃO precisa ser reescrita nem removida — o esqueleto (card, status inline, modal) está certo. Precisa de três cirurgias pontuais que destravam quase todo o valor: seletor de obra, valor visível+total por obra, e criação assistida por IA. Confirmei que não existe seletor de obra em nenhum lugar do CRM ainda, então criar um componente reusável aqui é movimento aditivo e vira padrão pras próximas telas (não conflita).

## Cenários trazidos
- Servir o COMERCIAL (curto prazo) vs servir o HUB (visão): a tela hoje serve mal os dois. Decisão: priorizar o comprador de obra (quem usa de verdade) com 'quanto vou gastar / o que falta entregar'. O dado de valor agregado por obra é o mesmo que o hub vai consumir depois para comissionamento transacional — então resolver o comprador alimenta o hub de graça. Não há trade-off real: é a mesma fundação.
- Tabela vs cartões: a auditoria sugere 'agrupar por obra com subtotal'. Cuidado — agrupamento com subtotal pode escorregar de volta pra cara de planilha. Cenário escolhido: manter CARDS de pedido, mas introduzir um cabeçalho de grupo por obra (nome da obra + total estimado + nº de itens pendentes) como faixa, não como linha de tabela. Relatório tabular consolidado de gasto fica em /crm/relatorios, não aqui.
- IA na criação — três níveis: (A) 1-toque mínimo: chips de materiais frequentes + obra pré-selecionada do contexto (barato, entrega já o Click-and-Go); (B) ditar/voz → IA estrutura itens (médio); (C) foto da lista/orçamento → OCR+IA → itens com qtd e preço estimado (caro, depende de créditos/Tijolos). Recomendo entregar (A) já e deixar (B)/(C) como evolução guiada por valor, não tudo de uma vez.
- Pedido como string única vs lista de itens estruturada: virar lista de itens (material/qtd/unidade) é o caminho correto pro futuro (cotação item-a-item, totem, comissão), mas é refactor de schema. Cenário pragmático: NÃO migrar schema agora; primeiro tornar valor_estimado e seletor de obra visíveis (esforço pequeno, valor alto), e só depois evoluir descrição→itens quando compras/totem entrarem na fila.

## ✅ Manter
- Estrutura em CARDS de pedido (respeita 'tabela ≠ tela de trabalho') — é o esqueleto certo, não reescrever
- Mudança de status inline no card via PATCH imediato sem recarga — bom Click-and-Go, só falta polimento visual
- Backend real com tenant_id da sessão e guards (GET=sessão, POST=comercial) — fundação sólida, não mexer
- Código único PED-AAAA-NNNN — alinhado à diretriz de código único da plataforma
- Cabeçalho (título + subtítulo do JOB em uma linha) e CTA dourado 'Novo pedido' min-h-10 (toque mobile ok)
- Modal enxuto como container de criação — manter o container, trocar o conteúdo

## ❌ Remover (ruído)
- Campo 'ID da obra' em texto livre (input de UUID) — ruído técnico cru exposto ao usuário; substituir por seletor, NÃO manter nem como fallback
- Rótulos de status crus em minúsculas sem cor ('cotando') no <select> nativo — trocar por chips coloridos capitalizados
- EmptyState com style inline fora dos tokens do design system — migrar pros tokens --obra-*/--brand-*
- Comportamento de fechar o modal silenciosamente após POST sem feedback de erro — remover o 'fecha e reza'; mostrar toast de erro

## 🤖 Promover a IA-first / 1-toque
- Criação 1-toque: ao abrir o modal vindo de uma obra (?obra_id=), obra já vem TRAVADA e pré-selecionada pelo nome — usuário nem escolhe; chips de materiais frequentes pré-sugeridos para montar a descrição em toques
- IA estima valor_estimado a partir da descrição/itens na criação (usuário confirma o número, não digita) — fecha o gap de valor invisível com o princípio 'escolher e confirmar'
- Evolução: 'Ditar pedido' (voz→itens) e 'Foto da lista/orçamento' (OCR→itens com qtd e preço) como caminho principal, manual como fallback — consome créditos/Tijolos, alinhado à monetização
- Seletor de obra com IA pré-selecionando a obra ativa do usuário quando não há contexto na URL

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Substituir o input 'ID da obra' por um SELETOR de obras (busca por nome, consumindo /api/crm/obras). Quando vier ?obra_id= na URL, travar e exibir o NOME da obra, não o UUID. Construir como componente reusável (vira padrão pro CRM).  _(premissa: Click-and-Go / 'escolher, não digitar' + máximo 3 cliques; elimina pedidos órfãos e conserta o vínculo obra↔pedido)_
- **P1** · pequeno · risco baixo — Tornar valor_estimado VISÍVEL: exibir em destaque no card e adicionar o campo no form de criação (com IA sugerindo o valor para o usuário confirmar). O dado já existe no backend.  _(premissa: Acima de tudo ÚTIL — é o principal sinal de valor ('quanto vou gastar'); central pra monetização/controle de obra do todo)_
- **P2** · medio · risco medio — Adicionar cabeçalho de grupo por obra (nome + total estimado + nº pendentes) como faixa sobre os cards, sem virar tabela. Relatório consolidado tabular permanece em /crm/relatorios.  _(premissa: ÚTIL e fácil de entender ('o que falta entregar / quanto por obra') sem violar 'tabela ≠ tela de trabalho')_
- **P2** · pequeno · risco baixo — Trocar o <select> de status por chips/badge coloridos por estado (verde=entregue, dourado=aprovado, etc.), rótulos capitalizados, com confirmação só em 'cancelado'. Enriquecer card com obra (nome), data e solicitante discretos.  _(premissa: Bonito e coeso (dark verde+dourado) + Click-and-Go na ação mais frequente da tela)_
- **P3** · medio · risco medio — Criação assistida por IA nível A: ao abrir 'Novo pedido', chips de materiais frequentes e obra pré-selecionada do contexto; manual vira fallback. Deixar voz/foto (níveis B/C) na fila guiada por valor.  _(premissa: IA-first / Click-and-Go — pedido deixa de nascer de caixa vazia)_
- **P3** · pequeno · risco baixo — Polir o modal: fechar por ESC e clique-fora, foco automático no textarea, bloquear scroll de fundo, toast de erro se o POST falhar, reforçar contraste do botão Cancelar. Migrar EmptyState pros tokens do design system.  _(premissa: Prático e fácil + funcional não-fachada (nada de feedback silencioso ou botão sumido))_
- **P4** · pequeno · risco medio — Trocar geração de código por sequência no banco (em vez de count()+1) para evitar duplicidade sob concorrência. Backend, não bloqueia UX.  _(premissa: Funcional não-fachada — código único confiável é diretriz da plataforma)_
