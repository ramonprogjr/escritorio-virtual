# Dashboard  ·  Visão Geral

**Rota:** 

## Veredito do diretor
A espinha dorsal está CERTA e deve ser preservada: "Ação agora" no topo, funil clicável que abre o kanban filtrado em ≤2 cliques, tratamento honesto de erro/vazio. Isso é tela de trabalho de verdade, não fachada, e atende as premissas de poucos cliques. O problema NÃO é a arquitetura — é EXCESSO e RUÍDO. Hoje a página tem ~15 blocos e três centros de gravidade de KPI (funil, Operação, Saúde comercial) que repetem "Negócios abertos", "Pipeline/Receita potencial" e contagens de leads em 2-3 lugares, empurrando o que é acionável para baixo da dobra e gerando fadiga. Pior: é uma tela que MOSTRA números mas quase nunca SUGERE a próxima ação — o maior débito frente à premissa IA-first/Click-and-Go. Há ainda ruído de vaidade que não serve a nenhum job do dono que quer vender (Modelos IA ativos, Equipe IA detalhada, data por extenso, Últimos movimentos) e nomenclatura "parceiro" divergente do modelo-mestre (que trata parceiro como NÃO-entidade; o correto é fornecedor/empresa). Veredito: manter o esqueleto, cortar agressivamente a duplicação, fundir os três blocos de "leads que precisam de você" em um único painel com recomendação de IA, e mover métricas de sistema para suas telas próprias. A tela deve responder "o que faço agora?" antes de "como está a operação?" — hoje ela inverte essa ordem na segunda metade da página.

## Cenários trazidos
- SERVIR O COMERCIAL (fornecedor) vs SERVIR O HUB: hoje a tela mistura os dois públicos. 'Encaminhamentos hoje' e 'Taxa encaminhamento' são métricas de HUB (distribuição de leads à rede), não do fornecedor que quer vender. Cenário recomendado: este é o dashboard DO FORNECEDOR — manter foco em vender/executar e EXTRAIR as métricas de rede para um dashboard de Hub separado (ou um toggle de perfil). Não pode haver dois donos numa tela só.
- PAINEL ÚNICO DE AÇÃO vs TRÊS BLOCOS SEPARADOS: hoje 'Ação agora' + 'Alertas' + 'Leads parados' competem e se sobrepõem (aprovações aparecem em dois). Cenário recomendado: fundir num único painel 'O que precisa de você', com a recomendação de IA no topo e a lista priorizada por urgência abaixo. Um só centro de gravidade para ação.
- KPIs ESPALHADOS vs UM BLOCO DE SAÚDE SEM DUPLICATA: hoje os mesmos números aparecem no funil, na Operação e na Saúde comercial. Cenário recomendado: o funil é a fonte de verdade dos números comerciais; a seção Saúde vira só o que o funil NÃO mostra (taxas de conversão/qualificação). 'Receita potencial' e 'Negócios abertos' saem por serem cópias de Pipeline e do KPI da aba Negócios.
- DASHBOARD QUE MOSTRA vs DASHBOARD QUE RECOMENDA (IA-first): hoje só exibe contagens. Cenário recomendado e diferencial do produto: o card de topo abre com 1 frase do agente ('Priorize o lead João, parado há 2h, alto valor') + botão de 1 toque. Mostrar números é commodity; recomendar a ação é a promessa IA-first do Obra10+.
- MÉTRICAS DE SISTEMA NO DASHBOARD vs NA TELA DE AGENTES: 'Modelos IA ativos' e 'Equipe IA' detalhada são diagnóstico técnico. Cenário recomendado: no dashboard fica no máximo um selo de saúde ('Equipe IA: 4 ativas, 0 com erro') que só vira destaque quando há erro; o detalhe vive em /crm/agentes.

## ✅ Manter
- Card 'Ação agora' (dourado, esconde zeros, ≤1 clique para o job) — é o coração da tela e a melhor expressão das premissas; preservar e evoluir, não substituir
- Funil comercial com abas Leads/Negócios e etapas clicáveis que abrem o kanban filtrado — núcleo da visão geral, tela de trabalho real
- KPIs do funil (Leads no funil / Pipeline / Ganhos / Conversão) — números certos para a decisão comercial, mantidos como FONTE ÚNICA desses dados
- Banner de erro + 'Tentar novamente' — tratamento honesto de estado (funcional, não fachada); manter
- Bloco 'Leads parados' com priorização por dias (amarelo/vermelho ≥7d) — acionável e leva ao job em 1 clique; manter a lógica, fundindo-o ao painel único de ação
- Card 'Operação · lead→negócio→obra' como MAPA da cadeia da plataforma (vender→executar) — conta a história do todo; manter, sem o número duplicado

## ❌ Remover (ruído)
- Data por extenso no header mobile (linha 134) — decorativa, ocupa espaço nobre, não serve a nenhum job
- Botão '+ Parceiro' do header desktop (linhas 55-61) — job de cadastro não pertence à tela de leitura/decisão; além disso usa rota /crm/parceiros/novo com terminologia divergente do mestre
- Métrica 'Modelos IA ativos' (linhas 80-85) — vaidade técnica no meio de KPIs comerciais; pertence a /crm/agentes
- 'Receita potencial' na Saúde comercial (linhas 110-116) — duplicata literal de 'Pipeline' já mostrado no funil
- Seção 'Hoje' como container (linhas 175-190) — fragmenta a página com só 2 cards; 'Encaminhamentos hoje' migra para contexto de Hub e o resto sai
- Botão 'Leads' do header desktop (linhas 47-54) — duplica os vários 'Ver todos'/'Abrir kanban' já presentes nos blocos
- Card 'Últimos movimentos'/'Últimos leads' — feed de leitura de baixa ação que se sobrepõe a 'Leads parados'; remover ou fundir em 'Leads que precisam de você'

## 🤖 Promover a IA-first / 1-toque
- Card 'Ação agora' → recomendação do agente em linguagem natural ('Priorize o lead João, parado há 2h, alto valor') com botão de 1 toque que executa a ação (responder/encaminhar). É o melhor candidato a Click-and-Go de todo o sistema
- Painel único 'O que precisa de você' (fusão Ação agora + Alertas + Leads parados) com a IA ordenando por urgência e sugerindo o motivo provável da paralisação + microação por item ('Retomar'/'Cobrar' em 1 toque)
- Rótulos de conversão traduzidos pela IA para a língua do dono ('Quantos viram cliente') em vez de jargão ('topo→fundo', 'briefing→sit-down')
- Selo de saúde da Equipe IA gerado automaticamente ('4 ativas, 0 com erro'), só virando alerta destacado quando há ciclo com erro

## 🎯 Ações priorizadas

- **P1** · medio · risco medio — Fundir 'Ação agora' + 'Alertas' + 'Leads parados' em um único painel 'O que precisa de você', removendo duplicação de aprovações e restringindo alertas ao que as contagens não cobrem (SLA estourado, lead redistribuído). Um só centro de gravidade para ação no topo.  _(premissa: Máximo de cliques mínimo + acima de tudo útil e fácil de entender (foco em ação antes de leitura))_
- **P2** · grande · risco medio — Adicionar 1 frase de recomendação da IA no topo do painel de ação ('Priorize o lead X, parado há 2h, alto valor') com botão de 1 toque que executa a ação. Primeiro Click-and-Go real do dashboard.  _(premissa: IA-first / Click-and-Go (a IA sugere, o usuário confirma))_
- **P3** · pequeno · risco baixo — Eliminar duplicação de KPIs: remover 'Receita potencial' (=Pipeline) e 'Negócios abertos' do card Operação (mantê-lo só no funil). Funil vira fonte única dos números comerciais.  _(premissa: Prático e fácil; cortar ruído ('essa informação é mesmo necessária aqui?'))_
- **P4** · pequeno · risco baixo — Remover do dashboard do fornecedor as métricas de sistema/rede: 'Modelos IA ativos' e a seção 'Hoje'; reduzir 'Equipe IA' a um selo de saúde que só destaca quando há ciclo com erro. Detalhe vai para /crm/agentes.  _(premissa: Útil e fácil de entender (sem vaidade técnica no painel comercial))_
- **P5** · pequeno · risco medio — Corrigir nomenclatura 'parceiro/parceiros' → 'fornecedor/empresa' em toda a tela (labels e rota '+ Parceiro') para alinhar ao modelo-mestre, e remover o botão '+ Parceiro' do header (cadastro não pertence à tela de visão geral).  _(premissa: Coesão do produto e não desviar do modelo-mestre (parceiro NÃO é entidade))_
- **P6** · pequeno · risco baixo — Limpar o header: mobile abre direto no painel de ação (remover data por extenso); desktop reduz para 1 CTA primária coerente com o job ('Ir para atendimento'/'Novo lead') e 'Tendências' vira secundário.  _(premissa: Foco em ação agora; topo não compete com o job principal)_
- **P7** · pequeno · risco baixo — Subir o piso tipográfico das etapas do funil para ~11-12px e garantir que todas as etapas caibam (ou indicar o scroll horizontal). Acessibilidade e legibilidade no mobile.  _(premissa: Bonito e coeso + mobile importa)_
- **P8** · medio · risco medio — Consolidar a camada de dados: unificar as subscriptions realtime duplicadas (funil + hook do dashboard escutam hub_leads_crm/hub_negocios) e os 3 fetches independentes num só, removendo o botão de refresh manual redundante (realtime cobre) e o layout shift.  _(premissa: Funcional não-fachada (sem layout shift) e prático)_
