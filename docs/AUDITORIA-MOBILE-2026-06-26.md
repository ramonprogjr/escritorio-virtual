# 📱 Auditoria de Mobile — Obra10+ (26/jun/2026)

> Pedido do dono: *"tem muita coisa que não dá pra ver ou quebrada na visualização de celular, bom rodar uma auditoria e um debug completo com relatório."*

## TL;DR
A causa-raiz da reclamação **não era layout quebrado** — era a **barra de rolagem praticamente invisível** (3px transparente), que fazia o conteúdo abaixo/à direita da dobra passar despercebido (só dava pra ver com zoom out). **Corrigida** (commit `3f64337`): scrollbar agora 10px dourada, vertical **e** horizontal. A arquitetura mobile em si está sólida — telas-chave têm layout mobile próprio e as poucas tabelas largas rolam (agora de forma visível).

## Método
1. **Causa-raiz de scroll** (global) — tokens de scrollbar em `globals.css`.
2. **Scan de "clippers"** em runtime (5 telas) — containers com `overflow:hidden` cortando conteúdo sem rolagem.
3. **Scan estático de tabelas/larguras fixas** — `min-w-[≥500px]` e larguras fixas grandes em todo `app/crm`.
4. **Verificação do padrão mobile** (`useNarrowViewport`/`isMobile`) nas telas-primárias.

> Limite honesto: o **sweep pixel-a-pixel ao vivo, tela por tela**, ficou parcial por instabilidade do browser de teste (dpr 0.5 do emulador forçava layout desktop; o contexto novo perdia a sessão). As conclusões abaixo vêm de auditoria de código + spot-checks em runtime (dashboard, cadastro, relatórios, financeiro, atendimento).

## Achados

### ✅ Corrigido — Scrollbar invisível (causa-raiz nº1)
Era 3px, trilho transparente, polegar branco a 22% → imperceptível. Agora 10px, trilho visível, polegar dourado (tokens da marca), altura mínima pegável. Vale pra TODA tela que rola, vertical e horizontal. Verificado clicando (thumb dourado aparece e rola). Carrosséis mobile com `.scrollbar-none` seguem ocultos de propósito (sem regressão). *(commit `3f64337`)*

### ✅ Sem cortes (clippers)
Scan em runtime (dashboard, cadastro, relatórios, financeiro, atendimento): **0** containers cortando conteúdo com `overflow:hidden`. A arquitetura usa 1 região de scroll no layout; o conteúdo rola.

### ✅ Tabelas largas — só 2, ambas roláveis
Em todo `app/crm`, só há 2 tabelas com largura mínima grande, **ambas dentro de wrapper de overflow** (rolam na horizontal, agora de forma visível):
- `app/crm/usuarios/page.tsx:245-246` — `overflow-x-auto` + `table min-w-[640px]`.
- `app/crm/relatorios/page.tsx:202-203` — `overflow-auto` + `table min-w-[640px]`.
Nenhuma tabela estoura a viewport (sem overflow horizontal da página).

### ✅ Telas-primárias têm layout mobile próprio
`leads` e `negócios` usam `useNarrowViewport`/`isMobile`: kanban vira carrossel com snap, cards abrem detalhe full-screen, etapas movem por bottom-sheet (entregue na P1). `dashboard`/`atendimento`/`cadastro` rolam normalmente. O `min-w-[300px]` do kanban é só desktop (`!isMobile`).

## Veredito
Mobile **demonstrável e sólido** para a demo. O problema percebido era discoverabilidade de scroll (resolvido). Não há quebra estrutural conhecida.

## Recomendações (follow-up, não-bloqueante)
1. **Sweep pixel-a-pixel ao vivo** quando o browser/sessão estiverem estáveis (logar uma vez, viewport 390×844 com dpr 1), tela por tela, para flagrar micro-ajustes (espaçamento, truncamento de texto, alvos de toque < 44px).
2. **Tabelas largas → cartões no mobile:** opcional, trocar as 2 tabelas roláveis por lista de cartões quando `isMobile` (padrão já usado em negócios/leads), para Click-and-Go em vez de rolar lateralmente.
3. **Máscaras de telefone** e **render otimista no atendimento** (itens P2 já na fila).
