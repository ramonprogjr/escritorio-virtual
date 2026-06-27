# Contas a receber  ·  Financeiro

**Rota:** 

## Veredito do diretor
Tela funcional e madura: acerta o essencial (cards em vez de planilha, mobile-first, job 'Marcar recebido' em 1 toque, sinais de urgencia muito legiveis via labelDias + borda colorida + chip Vencidas). Aprovo a base. Porem ela tem um defeito que para o financeiro e inaceitavel e nao pode ir para apresentacao: o valor da conta e exibido arredondado para 'k/M' sem centavos (R$ 1.999 vira 'R$ 2k'). Numa tela cujo proposito e CONCILIAR e QUITAR, isso destroi a confianca do usuario no numero — e P0. O segundo problema estrutural e que o recebivel hoje nasce digitado a mao e nao mostra QUEM deve (so descricao livre): isso quebra duas premissas (IA-first/Click-and-Go e utilidade real para cobranca) e desconecta a tela do todo, onde o recebivel deveria ser CONSEQUENCIA de um negocio ganho no CRM. Terceiro, ha acoes-fachada e silenciosas (botao 'Negocios' que joga numa lista generica sem id; 'Marcar recebido'/CSV/save sem feedback de loading/erro/undo) — isso viola 'funcional, nao fachada'. O resto e refino. Resumo do diretor: manter a espinha (cards + chips + 1 toque), corrigir JA o valor exato e o feedback de acao, e puxar o recebivel para nascer do negocio. Sem isso, e uma boa fachada de cobranca; com isso, vira o painel de caixa do escritorio.

## Cenários trazidos
- SERVIR O COMERCIAL (escritorio/fornecedor) vs O HUB: Esta tela e do tenant (fornecedor) — e o caixa do escritorio. Decisao: ela serve o COMERCIAL e fica como esta no escopo. O que o HUB precisa (comissao transacional, split por codigo unico) NAO entra aqui como UI — vira um campo/flag derivado ('parte da rede') que alimenta o motor de monetizacao por baixo. Nao transformar esta tela em cobranca-de-comissao; isso confundiria o usuario e misturaria dois donos do dado.
- TABELA vs CARTOES: Manter CARTOES (ja e a escolha certa e coerente com 'tabela != tela de trabalho'). O caso de tabela/planilha (conciliacao em massa, export contabil) ja existe e deve viver em /crm/relatorios, nao aqui. Nao reabrir esse debate — cards venceram.
- ORIGEM DO RECEBIVEL — digitar vs gerar do negocio: (A) manter lancamento manual como hoje; (B) recebivel nasce do negocio ganho, IA pre-preenche descricao/valor/parcelas e o vinculo cliente<->conta vem de graca; (C) hibrido: B como caminho primario, A como fallback. Recomendo C — e o unico que fecha o loop do todo (CRM -> caixa) sem perder o atalho manual.
- HORIZONTE DE FLUXO DE CAIXA — '7 dias' fixo vs configuravel vs 'Este mes': para escritorio, 30 dias / 'Este mes' tende a ser mais acionavel que 7. Cenario: trocar '7 dias' por alternador 7/15/30 + 'Este mes', OU abrir a tela ja em 'Vencidas' (a prioridade real do negocio) com KPI de total vencido no topo.
- MARCAR RECEBIDO — 1 toque puro vs 1 toque + mini-sheet de data/forma: puro e mais rapido mas perde dado contabil (data efetiva, forma de pagamento) e nao tem undo. Cenario recomendado: 1 toque otimista com TOAST + UNDO de 5s; mini-sheet de data/forma so como opcional ('...'), nao bloqueando o caminho feliz.

## ✅ Manter
- Cards acionaveis em vez de tabela (espinha da tela; coerente com todas as outras telas de trabalho)
- Mobile-first: bottom-sheet do modal, safe-area, alvos de toque adequados
- Job principal 'Marcar recebido' em 1 toque
- Chip 'Vencidas' vermelho como prioridade visual + filtros de status em chips (Click-and-Go, melhor que dropdown)
- labelDias ('3d atraso'/'Hoje'/'Em 5d') + borda esquerda colorida — traducao de data em urgencia, otima clareza
- Skeleton de carregamento
- Breadcrump 'Voltar para Visao financeira' (com area de toque/contraste reforcados)
- Botao 'Novo' como CTA dourado (acao primaria), mas evoluido no fluxo (ver promover_ia)

## ❌ Remover (ruído)
- Botao 'Negocios' do card que faz push generico para /crm/negocios sem id — e fachada; remover enquanto nao houver vinculo conta<->negocio, depois reintroduzir como deep-link 'Ver negocio'
- CSV do header da tela operacional — mover para /crm/relatorios (ou recolher em overflow '...'); export e relatorio, nao trabalho
- Arredondamento 'k/M' e maximumFractionDigits:0 no valor do card — REMOVER nesta tela; valor exato com centavos (a abreviacao serve a KPI de dashboard, nao a uma conta a conciliar)
- Toggle pagar/receber visivel/livre dentro do contexto 'A receber' do modal — fixar 'A receber' por contexto para evitar lancamento no lugar errado
- Status cru em uppercase no chip do card — remover texto bruto, mapear via STATUS_RECEBER

## 🤖 Promover a IA-first / 1-toque
- Criar recebivel a partir de um NEGOCIO GANHO: IA pre-preenche descricao, valor, parcelas e ja vincula o cliente — usuario apenas confirma (Click-and-Go). Lancamento manual vira fallback.
- Mostrar QUEM deve no card (cliente/negocio de origem) puxado automaticamente do negocio — IA/sistema preenche, nao o usuario
- Sugestao de descricao e de parcelamento no modal manual (IA propoe, usuario aceita)
- 'Marcar recebido' com captura opcional de data/forma de pagamento pre-sugerida pela IA (data=hoje, forma=ultima usada), confirmavel em 1 toque
- KPIs no topo / contadores nos chips (total vencido em R$, qtd por status) calculados automaticamente — leitura de caixa sem clique

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir exibicao do valor: usar formatador com valor exato e centavos (R$ 1.999,00) nesta tela, removendo o arredondamento k/M nos cards de conta. Manter abreviacao apenas em KPIs de dashboard.  _(premissa: Acima de tudo UTIL e confiavel; tela de conciliacao exige precisao — sem isso o numero perde credibilidade.)_
- **P2** · medio · risco baixo — Adicionar feedback de acao em 'Marcar recebido' (loading + toast de sucesso/erro + UNDO de 5s) e tratar erro do save do modal e do CSV (toast). Nada pode falhar/concluir em silencio.  _(premissa: Funcional nao-fachada; vao USAR de verdade — acao acidental sem undo e erro silencioso sao inaceitaveis.)_
- **P3** · pequeno · risco baixo — Remover o botao 'Negocios' generico do card (fachada). Reintroduzir como deep-link 'Ver negocio' somente quando existir o vinculo conta<->negocio (depende da acao 4).  _(premissa: Minimo de cliques e sem ruido; botao que cai em lista generica nao economiza clique nem contextualiza.)_
- **P4** · medio · risco medio — Exibir QUEM deve no card (cliente/negocio vinculado) e introduzir o vinculo recebivel<->negocio no modelo de dados, preenchido automaticamente quando o recebivel nasce de um negocio.  _(premissa: Util para cobranca + coerencia com o TODO (recebivel e consequencia do negocio fechado no CRM).)_
- **P5** · grande · risco medio — Fluxo 'Gerar recebivel a partir de negocio ganho' com IA pre-preenchendo descricao/valor/parcelas; manter lancamento manual como fallback. Fixar 'A receber' no contexto e adicionar mascara de moeda + selecao de cliente.  _(premissa: IA-first / Click-and-Go (preencher e escolher e confirmar, nao digitar); fecha o loop CRM -> caixa.)_
- **P6** · medio · risco baixo — Adicionar KPI de total vencido (R$) no topo e contadores/valor por chip de filtro (ex.: 'Pendente 12 - R$ 84k'); avaliar abrir a tela ja em 'Vencidas'.  _(premissa: Util e facil de entender; da leitura de caixa e prioridade de cobranca sem clique.)_
- **P7** · pequeno · risco baixo — Mover CSV para /crm/relatorios (ou overflow '...') e trocar horizonte fixo '7 dias' por alternador 7/15/30 + 'Este mes'; mapear status->label amigavel; alinhar verde de status ao token da marca; reforcar area de toque/contraste do breadcrumb.  _(premissa: Coesao visual, tabela!=tela de trabalho e clareza — refinos que tiram ruido sem alterar a logica.)_
