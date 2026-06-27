# Automações (Ciclos de IA)  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
Aprovo a tela como FUNDAÇÃO técnica (não é fachada: 2145 linhas reais, cards em vez de tabela na lista, avatar com microinteração, dois pontos de IA-first genuínos), mas REPROVO como produto entregue ao fornecedor. O problema não é estética nem completude — é AUDIÊNCIA ERRADA. Esta tela foi desenhada para o admin-engenheiro (o autor) e exposta ao dono de negócio: pede 'agente_slug' digitado à mão, vaza nomes de tabela/rota (hub_followup_config, hub_ciclos_log, hub_ciclos_ia), exige conversão manual UTC→Brasília e mostra uma tabela de 'merge' com colunas Hub(h)/Após merge(h)/Origem que só um engenheiro lê. Confirmei tudo no código (input livre na L1456, UTC manual L1735-1736, tabelas vazadas L1376/1383, bug de border 'solidrgb' na L896). Cada um desses itens fere a premissa #5 (ÚTIL e FÁCIL DE ENTENDER) e desfaz o ganho do IA-first. O veredito de produto: a automação é o coração da promessa 'IA-first' da plataforma — é a tela onde o fornecedor sente que a IA trabalha por ele. Vendê-la como console de DevOps mata essa percepção. Manter o motor; reescrever a casca para a linguagem do dono de negócio; e decidir conscientemente que Logs/Alertas/merge são vista de operador, não de fornecedor.

## Cenários trazidos
- AUDIÊNCIA (o cenário-mãe): A) servir o FORNECEDOR (dono de negócio) — esconder toda tripa técnica, IA monta o ciclo, ele só escolhe e confirma; B) servir o HUB/ADMIN — manter slug, cron, UTC, merge como ferramenta de operação interna. Recomendo A para /crm/ciclos e mover o nível-B para uma área admin-only (rota /admin ou flag de papel). NÃO tentar servir os dois na mesma tela — é o que gerou o vazamento de jargão.
- TABELA vs CARTÕES no merge: A) manter a tabela Hub/Após-merge/Origem (transparência total, audiência engenheiro); B) timeline visual de lembretes ('Lembrete 1: 2h depois · Lembrete 2: 24h depois') com 1 botão 'Corrigir automaticamente' (audiência dono). Recomendo B na tela do fornecedor; a tabela crua, se necessária, fica no modo admin.
- O QUE AUTOMATIZAR COM IA: A) IA só redige a descrição (estado atual); B) IA monta o ciclo INTEIRO a partir do nome/intenção — escolhe agente, tipo, horário, cadência de follow-up — e o usuário só confirma (Click-and-Go pleno). Recomendo B: é a diferença entre 'campo com botão mágico' e 'a plataforma trabalha por você'.
- LOGS/ALERTAS: A) manter 3 abas (Ciclos/Logs/Alertas); B) Ciclos como única tela de trabalho + Timeline por-ciclo (já existe no drawer) + alertas críticos viram NOTIFICAÇÃO no shell do CRM, e o histórico de execuções vira relatório em /crm/relatorios. Recomendo B — coerente com 'tabela=relatório' das outras telas e evita painel de observabilidade no fluxo comercial.
- ESCOPO DE FUSO: A) UTC em toda a base (atual, hostil); B) UI sempre em horário de Brasília, conversão para UTC nos bastidores. Recomendo B sem ressalva — é correção de usabilidade, não preferência.

## ✅ Manter
- A lista de ciclos em CARDS (não tabela) — é a tela de trabalho correta, escaneável, dark verde+dourado coeso
- Avatar com anel/microinteração (CrmBotRingAvatar) — premium e alinhado à referência de Membros — DESDE QUE o anel passe a representar dado real (taxa de sucesso), não pseudo-progresso
- Ações Executar e Ligar/Desligar em 1 clique — jobs centrais bem resolvidos
- Botões 'Gerar com IA' (descrição) e 'Sugerir com IA' (follow-up) — IA-first real, exatamente a premissa
- Presets em chips (horas de follow-up, arquivar após N dias) — Click-and-Go genuíno
- Timeline por-ciclo dentro do drawer — contextualiza histórico no item certo
- Cron escondido atrás de checkbox e seletor visual de dias/hora — boa progressão de complexidade
- Diálogos de confirmação em ações destrutivas (excluir/limpar) — segurança correta, 'funcional não-fachada'
- Filtros Todos/Ativos/Inativos + busca — coerente com o resto do CRM

## ❌ Remover (ruído)
- Rótulo 'LISTA' em caixa-alta sobre as pílulas — ruído puro, as pílulas se explicam
- Botão 'Editar' no rodapé do card — duplica o clique no próprio card, que já abre edição
- Botão 'Limpar agendamento' (RotateCcw) exposto no card com o mesmo peso de Executar — ação de nicho/perigosa; mover para dentro do editor
- Toda menção a nomes de tabela/rota na UI: hub_followup_config, hub_ciclos_log, hub_ciclos_ia, ciclo_id, /api/ciclos/atendente — é documentação interna vazada ao usuário
- Conversão manual UTC→Brasília ('para 09:00 Brasília indique 12 UTC') — substituir por horário local
- A tabela de merge Hub(h)/Após merge(h)/Origem na visão do fornecedor — substituir por timeline visual
- Chip 'N alertas' como item meramente informativo — ou vira clicável (vai à aba/notificação) ou sai
- Semântica de 'progresso' do anel quando ela é fórmula arbitrária (0.18+exec*0.08) — fachada; trocar por métrica real ou remover o significado de progresso
- Nomes internos de integração no aviso do agente WhatsApp (UAZAPI, dispatch.atendente/followup, webhook) — reescrever em linguagem de negócio

## 🤖 Promover a IA-first / 1-toque
- Seletor de AGENTES por cards/nome amigável (mapa slug→label) pré-selecionado pela IA — os dados já estão carregados (agentesHub); elimina a digitação de slug
- IA monta o ciclo inteiro a partir do nome/intenção: sugere agente + tipo + horário + cadência de follow-up; usuário só confirma (Click-and-Go pleno)
- 'Corrigir automaticamente' como 1 botão no lugar da tabela de merge — a IA resolve a compatibilidade de horários e mostra só o resultado
- Alertas críticos promovidos a NOTIFICAÇÃO 1-toque no shell (resolver em 1 clique de onde o usuário estiver), não escondidos numa aba
- Logs reescritos em linguagem de RESULTADO ('enviei 4 follow-ups, recuperei 1 lead') — a IA traduz eventos técnicos em impacto de negócio
- Anel do avatar mostrando taxa de sucesso recente real (sinal de saúde verdadeiro de 1 relance)

## 🎯 Ações priorizadas

- **P1** · medio · risco baixo — Substituir o input livre 'Agente slug' por um seletor de agentes em cards/nome amigável (mapa slug→label), usando agentesHub já carregado, pré-selecionado pela IA. Elimina a digitação de identificador técnico e o risco de ciclo órfão.  _(premissa: IA-first + Click-and-Go (#2) e ÚTIL/FÁCIL (#5))_
- **P1** · pequeno · risco baixo — Expurgar TODO jargão técnico da UI: remover nomes de tabela/rota (hub_followup_config, hub_ciclos_log, hub_ciclos_ia, ciclo_id, rotas /api), traduzir tipos ('Automático'/'Agendado'/'Sob gatilho') e status, e reescrever avisos do agente WhatsApp em linguagem de negócio. É só copy + labels, alto impacto.  _(premissa: ÚTIL e FÁCIL DE ENTENDER (#5))_
- **P1** · medio · risco medio — Trocar fuso UTC por horário de Brasília na UI, convertendo para UTC nos bastidores (sem mexer no dispatch). Acaba com a conversão manual hostil.  _(premissa: FÁCIL e prático (#5,#4); evita erro do usuário)_
- **P1** · pequeno · risco baixo — Corrigir o bug de border do input de busca: 'solidrgb(13,13,13)' (falta espaço, fora da paleta) → token de borda padrão #1d3a2c. E remover o rótulo 'LISTA'.  _(premissa: Bonito e coeso (#3); funcional não-fachada)_
- **P2** · medio · risco baixo — Enxugar o card para 2 ações visíveis (Executar + Ligar/Desligar) + menu '⋯' com Limpar/Excluir; remover o botão Editar (card já abre edição). Reduz poluição e melhora mobile (alvos maiores).  _(premissa: Mínimo de cliques (#1) + FÁCIL (#5) + mobile importa)_
- **P2** · grande · risco medio — Substituir a tabela de merge Hub(h)/Após merge(h)/Origem por uma timeline visual de lembretes ('Lembrete 1: 2h depois · 2: 24h depois…') com 1 botão 'Corrigir automaticamente' que a IA resolve. Esconder o conceito de merge do fornecedor.  _(premissa: tabela≠tela de trabalho; FÁCIL (#5); IA-first (#2))_
- **P2** · grande · risco medio — Expandir a IA do drawer para montar o ciclo inteiro a partir do nome/intenção (agente + tipo + horário + cadência de follow-up), mantendo o usuário só confirmando.  _(premissa: IA-first + Click-and-Go (#2); ≤3 cliques (#1))_
- **P3** · grande · risco medio — Reposicionar Logs/Alertas: alertas críticos viram notificação no shell do CRM (resolver 1-toque) e o histórico de execuções migra para /crm/relatorios; manter Ciclos como única tela de trabalho + Timeline por-ciclo. Coerência com 'tabela=relatório' das outras telas.  _(premissa: tabela=relatório; coerência do todo; foco no JOB (#5))_
- **P3** · medio · risco baixo — Trocar a semântica de pseudo-progresso do anel do avatar por taxa de sucesso recente real (ou remover o significado de progresso). Anti-fachada.  _(premissa: funcional não-fachada; útil de 1 relance (#5))_
- **P3** · pequeno · risco baixo — Tornar o chip 'N alertas' clicável (leva à notificação/lista) e rotular tipos com acento/ícone ('Crítico'/'Importante'/'Sugestão'). Pequeno, fecha a duplicação chip-vs-aba.  _(premissa: acionável; ≤3 cliques (#1))_
