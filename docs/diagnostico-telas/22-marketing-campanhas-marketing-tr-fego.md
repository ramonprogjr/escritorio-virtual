# Campanhas (Marketing / Tráfego)  ·  Marketing

**Rota:** 

## Veredito do diretor
Tela funcional e bonita, mas hoje é um RELATÓRIO disfarçado de tela de trabalho — exatamente o que a regra eterna do projeto proíbe. Três problemas de fundo frente ao todo: (1) MENTIRA NA TELA: confirmei no código (app/api/windsor/campanhas/route.ts L20) que a chamada Windsor pede fields=campaign,spend,clicks,impressions,cpc,ctr e NÃO pede conversions; logo o KPI e a coluna 'Conversões' mostram sempre 0. A métrica que liga marketing ao funil (o coração do todo Hub->lead->negócio) está morta. Isso é P0: derruba a confiança no produto inteiro. (2) ZERO IA-FIRST E ZERO AÇÃO: a peça central é uma tabela read-only de 7 colunas de mídia, sem ordenar, sem pausar/ativar, sem ajustar budget — apesar de o próprio sistema ter o Windsor MCP (write actions: pause/enable/budget no Meta). Viola 'IA-first' e '3 cliques pra qualquer job': o job aqui é DECIDIR onde investir, e a tela não deixa agir. (3) MÉTRICAS-RUÍDO vs. MÉTRICAS-DECISÃO: mostra Impressões/CTR/CPC (linguagem de mídia) e esconde CPA, ROAS e receita atribuída — o que o fornecedor de fato precisa pra saber 'qual campanha traz cliente que fecha'. Veredito: não é fachada barata, mas está servindo a métrica errada para o público errado. Precisa virar uma tela de DECISÃO acionável, amarrada ao funil, com a IA sugerindo a ação e o Windsor executando em 1 toque. Antes de qualquer redesign, corrigir a mentira das conversões.

## Cenários trazidos
- COMERCIAL vs HUB: a métrica de sucesso muda conforme o dono da tela. Para o FORNECEDOR (comercial), o norte é CPA e ROAS amarrados a lead->negócio fechado ('quanto me custou um cliente, quanto ele me deu'). Para o HUB (dono da plataforma), o norte é qualidade/volume de leads distribuídos e custo por lead que entra no motor de distribuição. Recomendo: ESTA tela serve o comercial (fornecedor decide investimento); o olhar do hub vai para uma central de performance agregada, não aqui. Não duplicar.
- TABELA vs CARTÕES: (A) manter tabela como está — read-only, viola a regra eterna, descartado; (B) virar cartões acionáveis por campanha (insight IA + botão Pausar/Ajustar budget via Windsor + link campanha->leads gerados) — recomendado como tela de trabalho; (C) híbrido: cartões como tela de decisão aqui + a visão tabular crua exportada para /crm/relatorios (onde tabela É o formato certo). Recomendo C: cada formato no seu lugar, sem conflitar com outras telas.
- AUTOMAÇÃO IA — três graus: (1) IA só SUGERE ('CPA alto na campanha X, sugiro pausar') e usuário confirma em 1 toque (Click-and-Go, recomendado para já); (2) IA sugere realocação de budget entre campanhas; (3) piloto automático com regras (pausar abaixo de X ROAS) — só com trava e log, fase futura. Começar no grau 1, que respeita 'usuário escolhe e confirma'.
- ESCOPO DA FONTE: hoje só Facebook/Meta (route.ts hardcoded). Cenário de crescer para Google Ads/TikTok via Windsor (mesmo MCP cobre) — decisão de produto: manter Meta-only e rotular honestamente 'Meta Ads' OU abrir multi-canal. Recomendo rotular Meta-only agora e abrir multi-canal depois, sem prometer o que não entrega.

## ✅ Manter
- Integração Windsor.ai real e funcional (não é mock) — base sólida para construir em cima
- Seletor de período em 1 clique (7/14/30) com alvo de toque min-h-11 no mobile — respeita 3-cliques e mobile
- Cards no mobile em vez de tabela — decisão correta de responsividade
- Estado de erro com SAÍDA acionável em 1 clique para /crm/integracoes, usando o dourado da identidade — funcional, não fachada
- Spinner dourado no loading respeitando a identidade visual
- O conceito do KPI 'Conversões' (depois de corrigido) — é a ponte marketing->funil, deve permanecer como métrica central

## ❌ Remover (ruído)
- Colunas-ruído Impressões, CTR e CPC da visão principal — são linguagem de mídia, não de decisão; recolher atrás de 'detalhes' ou mover para /crm/relatorios
- Tabela densa read-only de 7 colunas como peça central da tela (viola 'tabela != tela de trabalho') — mover a visão tabular crua para /crm/relatorios
- Divergência de nomenclatura: três nomes (rota=trafego, menu=Campanhas, título mobile=Marketing) — eleger UM nome só
- Emoji de antena no estado vazio — trocar por ícone Lucide alinhado ao design premium
- KPI/coluna 'Conversões=0' como estão hoje (mentira) — só voltam depois do fix da API

## 🤖 Promover a IA-first / 1-toque
- Insight IA por campanha: 'Campanha X: CPA alto / ROAS baixo, sugiro pausar' com botão Pausar/Ajustar budget executado via Windsor MCP em 1 toque (usuário confirma — Click-and-Go)
- Recomendação de realocação de budget: IA aponta a campanha vencedora e oferece mover verba da perdedora, em 1 confirmação
- Resumo IA do período no topo: 1 frase ('Você gastou R$X, gerou Y leads, Z fecharam; melhor campanha = A') em vez de o usuário ler 4 KPIs soltos
- Pré-seleção inteligente do período: IA abre já no recorte mais relevante (ex.: onde houve mudança significativa) em vez de fixo em 7d
- Estado vazio inteligente: distinguir 'não conectou' de 'conectado, sem dados no período' e, no 2o caso, sugerir ampliar o período automaticamente

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — P0 — Corrigir a mentira das Conversões: incluir 'conversions' (ou o evento de conversão correto) nos fields da chamada Windsor em app/api/windsor/campanhas/route.ts L20 e tipar c.conversions. Sem isso o KPI mais importante da tela é falso.  _(premissa: Funcional não-fachada + útil/fácil de entender: a métrica que liga marketing ao funil não pode mostrar 0 sempre.)_
- **P2** · medio · risco medio — Trocar/somar KPIs para incluir CPA e ROAS amarrando campanha->lead->negócio fechado (o todo da plataforma), além de variação (delta + seta) vs. período anterior. Aposentar Gasto/Cliques isolados como protagonistas.  _(premissa: IA-first/útil: dar a métrica que DECIDE investimento, não a métrica de mídia; amarra ao funil do todo.)_
- **P3** · grande · risco medio — Converter a tabela em cartões acionáveis por campanha com insight IA-first ('CPA alto, sugiro pausar') + botão Pausar/Ativar/Ajustar budget via Windsor MCP (usuário confirma) + link campanha->leads gerados. Mover a visão tabular crua para /crm/relatorios.  _(premissa: Tabela != tela de trabalho + 3 cliques pra qualquer job + IA-first: o job é DECIDIR e AGIR, não só ler.)_
- **P4** · pequeno · risco baixo — Padronizar UM nome em rota, menu e título mobile (sugiro 'Campanhas'); rotular honestamente a fonte ('Meta Ads') já que a API é Meta-only hoje.  _(premissa: Coerência cognitiva (útil/fácil de entender) e honestidade do produto.)_
- **P5** · pequeno · risco baixo — Diferenciar os estados: 'integração não configurada' (manda configurar) vs. 'conectado, sem dados no período' (sugerir ampliar período) vs. 'falha temporária' (tentar de novo). Hoje sem chave cai no vazio genérico (route.ts L8 retorna []). Trocar emoji por ícone Lucide.  _(premissa: Útil/fácil de entender + onboarding: cada causa tem sua mensagem e seu próximo passo.)_
- **P6** · pequeno · risco baixo — Aproximar a paleta dos KPIs da identidade (dourado para destaque, verde para positivo) e adicionar skeleton nos KPIs/cards para evitar layout shift no carregamento.  _(premissa: Bonito e coeso (dark verde+dourado) — polimento premium.)_
