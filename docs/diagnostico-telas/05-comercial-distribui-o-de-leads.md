# Distribuição de leads  ·  Comercial

**Rota:** 

## Veredito do diretor
Tela madura e funcional, mas com uma falha de identidade: ela se chama "Distribuição de leads" e na prática só MONITORA a distribuição — não deixa você DISTRIBUIR. O verbo do JOB está ausente. O Hub existe para captar e ROTEAR leads aos fornecedores homologados; o ato central (chegou lead novo, a IA sugere o melhor fornecedor por score, eu confirmo em 1 toque) não está nesta tela, apesar do motor já existir e estar pronto (lib/crm/sugerir-encaminhamento-auto.ts, app/api/crm/distribuicao/sugerir/route.ts, components/crm/DistribuirLeadPanel.tsx, docs/DISTRIBUICAO-PLANO-CEO.md). Hoje a tela é um excelente PAINEL DE AUDITORIA (KPIs, scorecard por fornecedor como tela-de-trabalho, feed humanizado, regras colapsadas) — o que está ali é bom e respeita o design dark verde+dourado. Mas falta o topo da tela: a fila de leads aguardando distribuição com a proposta da IA e botão Confirmar. Sem isso, a premissa IA-first e o "máximo 3 cliques pro JOB" não são atendidos no job mais importante. Segundo problema de gravidade média: ações de efeito financeiro (Cobrar) e de desbloqueio (Liberar) disparam sem confirmação nem toast — para um Hub que cobra dinheiro de fornecedores, isso é risco real de clique acidental e quebra de confiança. Terceiro: microcopy infla o que a tela faz ("KPIs em tempo real" sem realtime, "controle total do Hub" num feed read-only) — fere a premissa 5 (honestidade/clareza). O resto são vazamentos de dado cru (UF texto-livre, mercado/destino como código, sem timestamp) que são quick wins de polimento. Coerência com o todo: a sugestão de IA aqui DEVE reusar o mesmo motor e linguagem do encaminhamento de lead já presente em LeadEncaminharModal.tsx, para não criar duas IAs de distribuição divergentes.

## Cenários trazidos
- SERVIR O HUB (operador da rede) vs SERVIR O COMERCIAL (fornecedor que recebe): esta tela está no grupo Comercial mas o JOB é de operação do Hub. Decisão: assumir que é a CABINE DO HUB (quem distribui e fiscaliza), não a caixa de entrada do fornecedor. O fornecedor vê os leads que recebeu no seu próprio CRM/Kanban; aqui é o lado de quem ROTEIA. Isso elimina ambiguidade e justifica a fila de distribuição no topo.
- DISTRIBUIR vs MONITORAR como foco da tela: Opção A (recomendada) = tela vira 'Distribuição' de verdade — topo com fila de leads + sugestão IA + Confirmar (o JOB), e abaixo a auditoria atual como contexto. Opção B = manter só monitoramento e mover o ato de distribuir pro Kanban/lead. Risco da B: a tela continua mentindo o nome e o Click-and-Go fica escondido. Escolho A.
- IA SILENCIOSA (auto) vs IA ASSISTIDA (semi) vs MANUAL: o motor já suporta os 3 modos. Cenário recomendado: padrão SEMI (IA sugere top-1 com score + 2 alternativas, humano confirma em 1 toque) com opção de ligar AUTO por regra. Evita tanto o 'botão Rodar auditor' jargão quanto a digitação manual de regras como única via.
- REGRAS digitadas à mão vs REGRAS sugeridas pela IA: hoje o form de 6 campos é o oposto de IA-first. Cenário: IA observa o histórico e propõe a regra ('leads WhatsApp/SP fecham mais com X — criar regra?'), o humano aceita. Mantém o form manual como fallback avançado (já colapsado).
- TABELA vs CARTÕES: já resolvido bem — scorecard é cartão (tela-de-trabalho), feed é conversacional, regras são frases. NÃO regredir pra tabela. Manter o padrão e estendê-lo à nova fila de distribuição (cada lead = um cartão com a sugestão).

## ✅ Manter
- Header orientado ao job (título + subtítulo que explica o JOB em uma frase)
- Scorecard 'Desempenho por fornecedor' como cartões (tela-de-trabalho, não tabela) — é o melhor elemento da tela e conecta direto à distribuição por score
- Ações no contexto Liberar/Cobrar por fornecedor (Click-and-Go) — manter o padrão, só blindar com confirmação+toast
- Feed de atividade humanizado (descreverEvento) com bolinha colorida — conversacional, não-planilha
- Bloco de regras COLAPSADO por padrão — decisão de UX correta, esconde complexidade
- Estados vazios educativos (explicam heurística padrão) — ótimo para 'fácil de entender'
- 5 KPIs escaneáveis em 1 olhada (zero clique)

## ❌ Remover (ruído)
- Microcopy inflada 'KPIs em tempo real' (sem realtime real) — trocar por 'da rede' ou 'últimos 30 dias'
- Rótulo 'controle total do Hub' no feed read-only — marketing vazio, trocar por 'últimos eventos'
- Botão 'Rodar auditor agora' como gatilho de PRIMEIRA classe — é jargão e dispara cobrança sem aviso; rebaixar a 'forçar verificação' discreto OU remover se o cron já roda
- Campo UF como input de texto livre — fere Click-and-Go e aceita lixo; substituir por dropdown (remoção do texto-livre)
- Exibição de mercado e destino_valor como código/id cru (IMB, parceiro: a1b2-...) — remover o cru, mostrar nome legível
- 'ator' técnico cru no feed quando não for nome humano — omitir ou substituir por horário

## 🤖 Promover a IA-first / 1-toque
- FILA DE DISTRIBUIÇÃO no topo: 'leads aguardando distribuição', cada um com a sugestão da IA (melhor fornecedor por score + 2 alternativas + motivo) e botão Confirmar em 1 toque — reusar sugerirEncaminhamentoAutomatico / DistribuirLeadPanel. ESTE é o Click-and-Go do JOB.
- Regras sugeridas pela IA a partir do histórico ('notei que X fecha mais com Y — criar regra?') em vez do form 100% manual
- Tooltip explicando o score de aderência (IAH) in-place — IA-first transparente: por que esse fornecedor recebe mais
- Alertas clicáveis que levam direto à ação (Liberar/Cobrar) — a rede te diz o problema E o caminho da solução

## 🎯 Ações priorizadas

- **P1** · medio · risco medio — Montar a FILA DE DISTRIBUIÇÃO no topo da tela: lista de leads aguardando roteamento, cada cartão com a sugestão da IA (top-1 + 2 alternativas + motivo/score) e botão 'Confirmar distribuição' em 1 toque. Reusar o motor já pronto (sugerirEncaminhamentoAutomatico, /api/crm/distribuicao/sugerir, DistribuirLeadPanel) e a linguagem do LeadEncaminharModal para não divergir. Este é o JOB que dá nome à tela.  _(premissa: IA-first (Click-and-Go) + máximo 3 cliques pro JOB + útil/fácil de entender)_
- **P2** · pequeno · risco baixo — Blindar ações financeiras: 'Cobrar' e 'Liberar' ganham confirmação leve + toast de sucesso ('Cobrança enviada a X'); aumentar área de toque (mobile importa). Renomear/clarificar 'Rodar auditor agora' para 'Verificar SLA e cobrar pendências' com microcopy do efeito, ou rebaixá-lo a ação discreta se já roda por cron.  _(premissa: funcional não-fachada + útil/fácil (evitar clique acidental com efeito financeiro))_
- **P3** · pequeno · risco baixo — Limpar microcopy enganosa: 'KPIs em tempo real'→'da rede / últimos 30 dias' (com período/seletor visível nos KPIs), 'controle total do Hub'→'últimos eventos'. Adicionar janela de tempo aos 5 KPIs para virarem acionáveis.  _(premissa: acima de tudo útil e honesto/fácil de entender (premissa 5))_
- **P4** · pequeno · risco baixo — Eliminar vazamentos de dado cru: UF vira dropdown; mercado mostra nome legível ('Imobiliário (IMB)'); destino_valor resolve para o nome do parceiro/agente (reusar a lista de destinos já carregada); feed mostra timestamp relativo ('há 5 min') e garante 'ator' humano.  _(premissa: Click-and-Go (escolher, não digitar) + bonito/coeso + útil/fácil)_
- **P5** · pequeno · risco baixo — Tornar o monitoramento acionável: alertas clicáveis que levam à ação correspondente (Liberar/Cobrar) e tooltip '?' explicando como a aderência (score IAH) é calculada, separando visualmente qualidade/aderência de situação financeira no cartão.  _(premissa: máximo 3 cliques + IA-first transparente)_
- **P6** · medio · risco baixo — Responsividade: substituir o grid fixo de 6 colunas do form de regra por layout que empilha no mobile (e migrar estilos inline críticos para classes), garantindo a tela utilizável no celular.  _(premissa: mobile importa + bonito e coeso)_
- **P7** · medio · risco medio — IA sugere regras a partir do histórico (CTA 'criar regra?') dentro do bloco colapsado, mantendo o form manual como fallback; adicionar badge com nº de regras ativas no header do acordeão.  _(premissa: IA-first (a IA propõe, o usuário confirma))_
