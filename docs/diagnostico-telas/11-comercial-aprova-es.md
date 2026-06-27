# Aprovações  ·  Comercial

**Rota:** 

## Veredito do diretor
Esta é a melhor tela conceitual do sistema e a prova viva do nosso princípio inegociável: a IA propõe, o humano confirma em 1 clique (Click-and-Go). Card-como-tela-de-trabalho, não tabela; funcional de verdade (PATCH, realtime, loading/erro/vazio, mobile próprio); dentro dos 3 cliques. Aprovo a arquitetura como está — NÃO refatorar. Mas tenho UM veto duro: a barra 'IA 85%'. Confirmei no código (app/api/hub/aprovacoes/route.ts:36) que a API faz `confianca_ia ?? 85`, então todo card sem dado mostra o MESMO 85%. Isso é fachada e fere nossa régua máxima ('acima de tudo ÚTIL e fácil de entender' + 'funcional não-fachada'): um número falso e idêntico repetido em vários cards denuncia o teatro e mina a confiança justamente na tela que é o cartão-postal do nosso IA-first. Sai antes de qualquer demo. Segundo: como a tela é o ponto onde a IA aprende com o humano, REJEITAR sem capturar motivo é dinheiro jogado fora — e o backend (app/api/hub/aprovacoes/[id]/route.ts:35) JÁ aceita `motivo`; só falta a UI. Coerência: o Funil já ganhou seletor de motivo no 'Perdido'; Aprovações tem que falar a mesma língua. O resto (ordenar por impacto/valor, desfazer, ver detalhe, rótulos legíveis) é polimento aditivo que leva de 'boa' para 'excelente'. Nenhuma mudança estrutural.

## Cenários trazidos
- SERVIR O COMERCIAL vs O HUB: hoje a fila mistura propostas/campanhas (job do fornecedor-comercial) com ajuste_agente/atendimento_critico (governança da plataforma/hub). Cenário A: manter fila única e resolver por filtro+ordenação por impacto (mais simples, 1 tela, escolhido). Cenário B: separar visualmente 'Decisões do negócio' vs 'Saúde dos agentes' em duas abas — só vale quando o volume crescer; deferir.
- CONFIANÇA DA IA: (A) remover o default 85 e só mostrar a barra quando a IA realmente computou — honesto e barato (recomendado); (B) converter em rótulo qualitativo 'alta/média/baixa' atrelado ao impacto — mais legível mas ainda exige dado real; (C) manter número — REJEITADO, é fachada.
- SEGURANÇA DA APROVAÇÃO: (A) 'Desfazer' no toast por alguns segundos para TODO caso — mantém 1 clique no comum e protege o acidental (recomendado, melhor custo-benefício); (B) confirmação extra só para impacto crítico/valor alto (alçada) — bom para dinheiro, mas adiciona clique; combinar A para todos + B só para valor alto é o ideal de médio prazo.
- FECHAR O LOOP CLICK-AND-GO: quando a IA recomenda aprovar, ou (A) realçar o botão 'Aprovar (recomendado)', ou (B) ir além e oferecer 'auto-aprovar abaixo de X com alta confiança' no futuro — B é poderoso mas só depois que a confiança for um dado REAL e auditável.
- TABELA vs CARTÕES: não há dilema aqui — cartão é o certo e já está implementado. O histórico de aprovadas/rejeitadas (que a API já serve por status) é que deve nascer como relatório/tabela em /crm/relatorios, não nesta tela de trabalho.

## ✅ Manter
- Arquitetura card-como-tela-de-trabalho (não tabela) — é o exemplo de referência do princípio 'tabela ≠ tela'
- Fluxo Aprovar/Rejeitar em 1 clique com loading — dentro dos 3 cliques
- Bloco 'Recomendação da IA' (caixa dourada) — coração do Click-and-Go
- Realtime do canal hub_aprovacoes — fila viva, coerente com IA agindo
- Estado de erro com 'Tentar de novo' — funcional não-fachada
- Filtros por tipo com contadores — filtrar é escolher, não digitar
- Header com badge pulsante de urgência — cria pressão saudável sobre a fila
- Tempo relativo (há Xmin) e autor-agente — deixa claro que quem pediu foi a IA

## ❌ Remover (ruído)
- Default fabricado de confiança: o `?? 85` em app/api/hub/aprovacoes/route.ts:36 — exibir a barra SOMENTE quando houver confiança real (senão, ocultar)
- Duplicação do contador no header: o número no subtítulo OU o badge pulsante, não os dois colados — manter o pulsante
- Fallback que copia descrição no motivo: `row.motivo ?? row.descricao` (route.ts:33) gera bloco 'O que observou' duplicado — não exibir o bloco quando motivo===descricao
- Rótulos crus com underscore/minúsculo nos chips (ex.: 'ajuste_agente') — ruído que fere 'fácil de entender' e 'bonito'
- Vocabulário inconsistente Rejeitar/Reprovado — padronizar (ruído cognitivo)

## 🤖 Promover a IA-first / 1-toque
- Fechar o loop Click-and-Go: quando a IA recomenda aprovar, realçar o botão como 'Aprovar (recomendado)' — a recomendação tem que dirigir o clique
- Rejeição que ENSINA a IA: chips rápidos de motivo ('fora de escopo','valor alto','refazer') alimentando o aprendizado — o backend já aceita `motivo`, é 1-toque
- IA ordena a fila por impacto/valor automaticamente (crítico e alto valor no topo) — o usuário decide o que importa primeiro sem rolar
- Garantir que a IA SEMPRE preencha o campo impacto, para a priorização ser confiável
- Futuro: confiança REAL computada habilita auto-aprovação de baixo risco abaixo de uma alçada — só depois do dado ser auditável

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Remover o default 85 da confiança (API route.ts:36): só retornar/exibir confianca_ia quando a IA realmente computou; caso contrário não renderizar a barra. Mata a fachada na tela cartão-postal do IA-first.  _(premissa: Acima de tudo ÚTIL e honesto; funcional não-fachada)_
- **P2** · pequeno · risco baixo — Capturar motivo na rejeição com chips rápidos (fora de escopo / valor alto / refazer / outro) — o backend já aceita `motivo` em [id]/route.ts:35. Fecha o loop de aprendizado da IA e alinha ao seletor de motivo já adotado no 'Perdido' do Funil.  _(premissa: IA-first (a IA aprende com o humano) + coerência entre telas)_
- **P3** · pequeno · risco baixo — Ordenar a fila por impacto (crítico>alto) e depois valor/data, em vez de só data desc — itens críticos e de alto valor no topo.  _(premissa: Útil e ≤3 cliques: o que importa primeiro, sem rolar)_
- **P4** · medio · risco medio — Adicionar 'Desfazer' no toast de Aprovar/Rejeitar (janela de alguns segundos) — protege o clique acidental sem tirar o 1 clique do caso comum; aprovação de gasto não pode ser irreversível-sem-saída.  _(premissa: Vão USAR de verdade; segurança sem atrito)_
- **P5** · pequeno · risco baixo — Mapear rótulos legíveis dos tipos via dicionário (capitalizado, ordem fixa por prioridade, crítico em vermelho) — fim dos slugs com underscore nos chips.  _(premissa: Bonito e fácil de entender)_
- **P6** · pequeno · risco baixo — Realçar o botão conforme a recomendação da IA ('Aprovar (recomendado)') para fechar o loop Click-and-Go visualmente; e não exibir o bloco de motivo quando motivo===descricao (route.ts:33).  _(premissa: IA-first: a recomendação dirige a ação; sem ruído duplicado)_
- **P7** · medio · risco baixo — Adicionar 'Ver detalhe' abrindo o objeto real (a proposta/campanha) para decisão informada, e link 'Ver decisões recentes' no estado vazio (a API já serve status=aprovado/rejeitado) — esse histórico nasce como relatório, não nesta tela de trabalho.  _(premissa: Útil: aprovar com contexto, não às cegas; tabela=relatório em /crm/relatorios)_
- **P8** · pequeno · risco baixo — Levar o chip 'N aguardando' (vermelho/pulse) também para o cabeçalho mobile e fundir a duplicação do contador no desktop (manter o pulsante, simplificar o subtítulo).  _(premissa: Mobile importa; sem dado repetido lado a lado)_
