# Relatórios  ·  Visão Geral

**Rota:** 

## Veredito do diretor
Tela honesta e funcional (dados reais, trata erro/tabela ausente, formata moeda/data, header PT-BR), mas hoje é um VISUALIZADOR de tabelas read-only com um mini-dashboard colado em cima — não uma ferramenta de relatório. Como Diretor, meu veredito é: esta tela tem UM job e deve fazê-lo bem — CONSULTAR e EXPORTAR a base operacional. O 'Resumo operacional' é a maior falha de produto: os mesmos KPIs vêm de useMetricas e já alimentam /crm/analytics e /crm/kpis (mesmo grupo Visão Geral) — são TRÊS fontes da verdade para os mesmos números. Isso é ruído e risco de inconsistência, não valor. A régua das premissas reprova em 4 pontos: (1) caminho até o job quebrado — nem KPI nem linha são clicáveis, então 'consulta operacional' nunca vira ação em ≤3 cliques; (2) IA-first ausente — zero leitura/anomalia/sugestão; (3) falta o básico de relatório (busca, filtro de período/status, ordenação e sobretudo EXPORTAR, que o backend já suporta e a UI esconde); (4) desvios de identidade e profissionalismo — laranja #f97316 fora da paleta verde+dourado, 'parceiros' contra a spec-mestre (é fornecedor), PT-PT 'registo', e vazamentos técnicos ao cliente final (caminho da API, erro cru do Postgrest, instrução de SQL de migração). Nada disso é refator grande: são quick wins de alto impacto. A decisão: esta vira a tela de RELATÓRIO/EXPORTAÇÃO acionável (a casa dos KPIs analíticos é Analytics/KPIs), e cada linha/insight leva de volta ao trabalho.

## Cenários trazidos
- Servir o COMERCIAL (fornecedor/escritório) vs servir o HUB: a tela está no tenant do fornecedor, então o público é o comercial — relatório da SUA carteira (leads/negócios/financeiro), não métricas de rede. KPIs de rede/distribuição são job do hub, em outra superfície. Decisão: focar 100% no comercial; remover 'Rede de parceiros' e 'Auditoria de decisões' (são visão hub/admin).
- Papel da tela — RELATÓRIO puro (consulta+exportação, enxuga KPIs) vs MINI-DASHBOARD acionável (mantém cards, torna-os clicáveis). Recomendo RELATÓRIO puro: já existem Analytics e KPIs no mesmo grupo; manter mini-dashboard aqui duplica e confunde. Os 5 cards saem ou viram 1 faixa fina de contexto não-duplicada.
- Tabela vs cartões: no DESKTOP a tabela é legítima (a régua diz tabela=relatório e esta É a tela de relatório) — manter, mas com linha clicável, busca, filtro e ordenação. No MOBILE a tabela apertada (truncar 220px + title no hover, que não existe em toque) falha — virar cartões. Decisão: responsivo, tabela no desktop / cartões no mobile.
- O que automatizar com IA: faixa de insight no topo da tabela ('3 negócios sem follow-up há 7+ dias', '2 contas a receber vencem esta semana') com 1 toque para abrir a lista filtrada; e 'Exportar' com resumo gerado pela IA. A IA LÊ o dataset e aponta a ação, em vez de só listar linhas.
- Entidades exibidas: ocultar abas vazias para o tenant (ex.: Imóveis sumir se 0 registros, em vez de parecer quebrado) vs fixar abas por mercado do fornecedor. Decisão: ocultar quando 0 registros (mais simples, evita falsa sensação de bug); reavaliar fundir/separar contas a pagar/receber conforme uso.

## ✅ Manter
- Card 'Detalhamento — {entidade}' como coração da tela (consulta na tela = útil e coeso)
- Tabela com headers traduzidos e formatação de moeda/data — aqui tabela é legítima (tabela=relatório)
- Abas de entidade (Leads/Negócios/Empresas/Imóveis/Financeiro) — Click-and-Go, 1 clique troca o dataset
- Botão 'Atualizar' com estado de loading correto (bom padrão)
- Tratamento de erro e estados de loading/vazio (funcional, não fachada) — mas com texto amigável
- Header sticky coeso no dark verde/dourado

## ❌ Remover (ruído)
- Bloco 'Resumo operacional' com 5 KPIs como está — duplica Analytics/KPIs (mesmo useMetricas, mesmo grupo); remover ou reduzir a 1 faixa fina não-duplicada
- Cards 'Rede de parceiros' e 'Auditoria de decisões' — visão de hub/admin, não do comercial-fim desta tela
- Cor laranja #f97316 nos valores — fora da paleta inegociável; trocar por dourado #c9a24a
- Rótulo 'Fonte: /api/crm/metricas' — detalhe de implementação vazando à UI
- Banner com instrução SQL de migração ('Execute: docs/sql/...') — instrução de dev exposta ao cliente; mover para logs/admin
- String crua do Postgrest no banner de erro — pode vazar nomes de tabela/coluna; trocar por mensagem amigável
- Termo 'parceiros' (usar 'fornecedores', conforme spec-mestre) e PT-PT 'registo' (usar 'registro')
- Subtítulo 'dados reais do Supabase' (jargão técnico) — trocar por linguagem de negócio

## 🤖 Promover a IA-first / 1-toque
- Faixa de insight da IA no topo da tabela: anomalias/atrasos do dataset ativo ('3 negócios sem follow-up há 7+ dias', '2 recebimentos vencem esta semana') com 1 toque para abrir a lista já filtrada
- Linha clicável: 1 toque na linha abre o lead/negócio/conta — fecha o caminho até o job em ≤3 cliques
- Botão 'Exportar' (CSV/Excel) no slot actions do header, respeitando entidade+filtros ativos; backend já suporta — só expor
- Filtro de período/status + busca + ordenação por coluna pré-sugeridos pela IA (ex.: já abrir Negócios ordenado por 'parados há mais tempo')
- Empty state com CTA acionável ('Nenhum lead ainda — capte o primeiro') em vez de texto seco

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Decisão de produto e execução: tornar esta a tela de RELATÓRIO/EXPORTAÇÃO. Remover/encolher o 'Resumo operacional' (KPIs vivem em Analytics/KPIs) — no máximo 1 faixa fina de contexto não-duplicada, sem 'Rede de parceiros' nem 'Auditoria de decisões'.  _(premissa: Útil e fácil de entender / evitar duplicação (3 fontes da verdade) / 3 cliques)_
- **P1** · pequeno · risco baixo — Expor botão 'Exportar' (CSV/Excel) no slot actions do header, respeitando entidade e filtros ativos. Backend /api/crm/relatorios/export já suporta; é só ligar à UI.  _(premissa: Útil — job clássico de uma tela 'Relatórios' que hoje está oculto)_
- **P2** · medio · risco baixo — Tornar cada linha da tabela clicável para abrir o registro (lead/negócio/empresa/conta), fechando o caminho até o job.  _(premissa: 3 cliques / consulta que leva à ação)_
- **P2** · pequeno · risco baixo — Saneamento de UI ao cliente final: trocar laranja #f97316 por dourado #c9a24a; remover 'Fonte: /api/crm/metricas'; substituir banner de SQL e erro cru do Postgrest por mensagem amigável (detalhe técnico só em log); padronizar PT-BR ('registro'); renomear 'parceiros'->'fornecedores'; subtítulo em linguagem de negócio.  _(premissa: Bonito e coeso / fácil de entender / sem vazamento técnico (percepção premium))_
- **P3** · medio · risco baixo — Adicionar busca + filtro de período/status + ordenação por coluna (1 clique) sobre o dataset ativo.  _(premissa: Prático — básico de relatório operacional hoje ausente)_
- **P3** · medio · risco medio — Faixa de insight da IA no topo da tabela (anomalias/atrasos) com 1 toque para abrir a lista filtrada.  _(premissa: IA-first / Click-and-Go — a IA lê e aponta a ação)_
- **P4** · medio · risco baixo — Responsividade: ocultar abas com 0 registros para o tenant; no mobile renderizar cartões em vez da tabela apertada (sem depender de hover).  _(premissa: Mobile importa / evitar falsa sensação de tela quebrada)_
