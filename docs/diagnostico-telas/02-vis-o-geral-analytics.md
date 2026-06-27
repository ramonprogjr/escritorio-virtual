# Analytics  ·  Visão Geral

**Rota:** 

## Veredito do diretor
Aprovo a base, reprovo a postura. Visualmente a tela está coesa (dark verde+dourado, seções legíveis) e o bloco Atendimento é EXATAMENTE o padrão da casa: número + cor de alerta + link direto = 3 cliques até a ação. Mas hoje a tela é um PAINEL DE LEITURA, não IA-first nem Click-and-Go: vejo o problema e não tenho o botão para resolver. Três coisas são inegociáveis e barram qualquer apresentação: (1) vazamento técnico para quem vai USAR — confirmei no código os textos 'Reinicie o servidor de desenvolvimento (porta 3001)' (CrmAnalyticsDashboard.tsx:346), 'gravar métricas em hub_kpis_resultados' (linha 365) e 'Windsor.ai não configurado' (linha 477), além de slugs em fonte mono nos cards e na tabela; isso é P0, inaceitável em produção. (2) A IA está no rodapé e passiva quando deveria LIDERAR a tela — fere a premissa IA-first na cara. (3) A tabela 'Histórico de medições' viola frontalmente 'tabela != tela de trabalho' e tem destino claro: Relatórios. Decisão de produto: INVERTER a página — topo = 'O que a IA recomenda + alertas acionáveis'; meio = KPIs e funis TODOS clicáveis com tendência (delta vs período anterior); rodapé = nada de log. Tirar daqui o botão 'Atualizar KPIs' (vira cron) e a tabela de histórico (vai p/ Relatórios). E adaptar por perfil: o HUB vê rede/Parceiros, o fornecedor não. Nada disso é refatoração grande — é reordenar, tornar clicável e limpar texto. Aditivo, alto impacto, baixo risco. É quick win de apresentação.

## Cenários trazidos
- COMERCIAL vs HUB (a tensão central da tela): hoje ela mistura visão-fornecedor (funil, negócios, obras) com visão-rede (Parceiros: Homologados, Encaminhamentos). Cenário recomendado: UMA tela, blocos CONDICIONAIS ao perfil — fornecedor comum NÃO vê 'Homologados' (ele não homologa ninguém); operador do HUB vê o bloco rede. Evita criar duas telas (custo de manutenção) e respeita 'útil e fácil' por perfil. Alternativa descartada: duas rotas separadas /analytics e /analytics-hub — mais código, mais divergência, sem ganho de UX.
- PAINEL DE LEITURA vs PAINEL DE AÇÃO (IA no rodapé vs IA no topo): manter como dashboard de consulta (status quo) contraria a premissa IA-first; promover Observações ML + Alertas ao TOPO com 1 CTA por item ('Click-and-Go') transforma a tela no cérebro do CRM. Escolho o segundo. A IA fala primeiro e leva à ação.
- TABELA vs CARTÕES/DRILL (Histórico de medições): opção A = remover daqui e jogar a tabela bruta em /crm/relatorios (cumpre a regra 'tabela=relatório'); opção B = transformar em mini-gráfico de série histórica que aparece AO CLICAR no card do KPI (drill-down, não tabela na tela-mãe). Recomendo A agora (rápido) e B quando o card virar clicável — as duas convergem, não conflitam.
- DEFAULTS FRIOS vs PRIMEIRA IMPRESSÃO CHEIA: período default '24h' + funil de negócios começando vazio ('Selecione um mercado') dão uma tela quase em branco no primeiro acesso — péssimo para apresentação e para ciclos longos de construção. Cenário escolhido: default 30d e IA pré-seleciona o mercado de maior volume (heurística), usuário só troca. Abas de mercado só aparecem se houver >1.
- KPIs PASSIVOS vs KPIs-ATALHO: cards hoje não são clicáveis. Cenário escolhido: cada card vira link para a tela onde se resolve aquele número (taxa_conversao -> Kanban de negócios; fila -> Atendimento), replicando o padrão que JÁ funciona no bloco Atendimento. Coerência com as outras telas, custo baixo.

## ✅ Manter
- Bloco Atendimento (Fila, Leads aguardando, Agentes IA, Aprovações) — é a REFERÊNCIA de padrão da casa: número + cor + href direto = 3 cliques até a ação. Replicar no resto da página.
- Cards de KPI com valor + meta + badge (Crítico/Atenção/OK) + barra — leitura instantânea e alinhada à régua de metas. Manter o formato; só falta torná-los clicáveis e limpar o tooltip.
- Gráfico 'Leads por dia' (CrmLeadsEntradaPeriodo) — única visão de TENDÊNCIA real e fácil de ler; é o espírito da página.
- Funil de leads por estágio (snapshot) — honesto no rótulo; útil como bússola do volume.
- Bloco Obras (Em andamento, Pedidos material) — coerente com 'vende E executa aqui', minimalista e clicável; manter como semente do lado execução.
- Observações ML e Bloco Alertas como CONCEITO — são o coração IA-first; manter a existência, mudar a posição (topo) e a postura (acionável).
- Identidade visual dark verde+dourado e a organização em seções claras — coesa, premium, não mexer.

## ❌ Remover (ruído)
- Texto 'Reinicie o servidor de desenvolvimento (porta 3001)' no empty state (CrmAnalyticsDashboard.tsx:346) — vazamento de DEV em produção, P0, trocar por mensagem de negócio.
- Menção a 'hub_kpis_resultados' no texto do card (linha 365) — nome de tabela exposto ao usuário; remover/reescrever.
- Texto de fallback 'Windsor.ai não configurado' (linha 477) — nome de ferramenta técnica exposto; trocar por CTA 'Conecte sua conta de anúncios'.
- Tabela 'Histórico de medições' — viola 'tabela != tela de trabalho'; mover para /crm/relatorios (ou virar drill-down do card). Sai da tela-mãe.
- Botão 'Atualizar KPIs' da UI principal — recálculo é trabalho de cron/back-office, não do gestor; mover para automático (e, se preciso, esconder atrás de Avançado/admin).
- 'KPIs críticos' no bloco IA — redundante: a contagem de críticos já está visível nos próprios cards de KPI.
- Slugs técnicos em fonte mono nos tooltips/títulos dos cards e na coluna 'KPI' — substituir por linguagem natural.
- Bloco Parceiros para o perfil FORNECEDOR — ruído para quem não homologa ninguém; remover via condição de perfil (mantém-se só para o HUB).

## 🤖 Promover a IA-first / 1-toque
- Observações ML viram 'O que a IA recomenda hoje' no TOPO da página, com 1 botão de ação por insight (Click-and-Go) — a IA fala primeiro e leva direto ao job. Esconder 'amostras' atrás de 'detalhes'.
- Alertas acionáveis logo abaixo das recomendações: cada alerta com CTA 'Ir para' / 'Resolver' + opção 'Dispensar' — 1 toque do alerta à correção.
- Pré-seleção inteligente do mercado no funil de negócios: IA/heurística escolhe o mercado de maior volume automaticamente; usuário só troca (mata o estado vazio 'Selecione um mercado').
- Pré-preenchimento de metas por tenant: em vez de KPI_METAS_DEFAULT hardcoded igual para todos, IA sugere meta com base no histórico do fornecedor; usuário confirma/ajusta (Click-and-Go).
- IA aponta QUAL fila/lead está estourando o SLA, não só a contagem — destaque do item crítico com link direto, em vez de número agregado.
- Delta de tendência (seta + % vs período anterior) calculado e exibido nos KPIs e na série 'Leads por dia' — leitura de tendência automática, sem o usuário pedir.

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — P0: remover TODOS os vazamentos técnicos para o usuário final — empty state 'Reinicie o servidor...porta 3001' (linha 346) vira 'Ainda não há dados neste período'; remover 'hub_kpis_resultados' (linha 365); 'Windsor.ai não configurado' (linha 477) vira CTA 'Conecte sua conta de anúncios'; trocar slugs mono por linguagem natural nos tooltips/cards.  _(premissa: Acima de tudo ÚTIL e FÁCIL DE ENTENDER / funcional-não-fachada: clientes vão USAR; texto de DEV em produção é inaceitável.)_
- **P2** · medio · risco baixo — Tornar cada card de KPI e cada barra do funil de leads CLICÁVEL, levando à tela onde se resolve o número (taxa_conversao -> Kanban de negócios; barra de estágio -> lista de leads filtrada), replicando o padrão do bloco Atendimento.  _(premissa: Máximo 3 cliques: vejo o problema e tenho 1 clique para ir resolver.)_
- **P3** · medio · risco medio — Inverter a página: subir Observações ML ('O que a IA recomenda hoje') + Alertas para o TOPO, cada item com 1 CTA de ação (e 'Dispensar' no alerta). KPIs/funis no meio, sem log no rodapé.  _(premissa: IA-first / Click-and-Go: a IA fala primeiro e leva à ação, não fica passiva no rodapé.)_
- **P4** · pequeno · risco baixo — Remover a tabela 'Histórico de medições' desta tela e movê-la para /crm/relatorios (drill-down do card como mini-gráfico vem depois).  _(premissa: Tabela != tela de trabalho (tabela = relatório).)_
- **P5** · pequeno · risco baixo — Trocar período default de 24h para 30d e adicionar delta de tendência (seta + % vs período anterior) nos KPIs e na série 'Leads por dia'.  _(premissa: Útil/primeira impressão + a página se chama Analytics: tendência é o seu trabalho; default 24h abre quase vazio em ciclos longos.)_
- **P6** · medio · risco medio — Pré-selecionar automaticamente o mercado de maior volume no funil de negócios (IA/heurística); mostrar abas só se houver >1 mercado, eliminando o estado vazio 'Selecione um mercado'.  _(premissa: IA-first + mínimo de cliques: nada de tela morta exigindo clique antes de mostrar valor.)_
- **P7** · medio · risco medio — Condicionar blocos ao perfil: HUB vê 'Parceiros'/rede; fornecedor não vê 'Homologados'. Dar href ao 'Taxa encaminhamento' e revisar nomenclatura 'Parceiros' conforme spec mestre (parceiro NÃO é entidade).  _(premissa: Útil por perfil + coerência com o todo: não mostrar ruído de rede a quem só vende.)_
- **P8** · medio · risco medio — Mover o recálculo de KPIs para cron automático e remover o botão 'Atualizar KPIs' da UI principal (se mantido, 'Recalcular agora' só-admin, sem citar tabela).  _(premissa: IA-first/Click-and-Go: usuário de negócio não manda o sistema calcular métrica; isso é back-office.)_
- **P9** · medio · risco baixo — Limpar o bloco 'IA e automação': remover 'KPIs críticos' (redundante com os badges), mover 'Leads hoje' para o topo/comercial, renomear 'Ciclos com erro' para 'Automações com falha'. Externalizar os magic numbers de limiar de cor (ex.: filaPendente>5).  _(premissa: Prático e fácil de entender: sem jargão de pipeline nem métricas duplicadas/deslocadas.)_
