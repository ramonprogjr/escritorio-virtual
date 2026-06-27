# Visão financeira  ·  Financeiro

**Rota:** 

## Veredito do diretor
Tela FORTE e acima da média do sistema: é um verdadeiro dashboard de decisão (card=ação, listas em vez de tabela densa, estados vazios positivos, disclaimers honestos, FAB mobile). O bloco 'Ação agora' é o melhor embrião de IA-first que temos no CRM e deve virar referência para outras telas. Aprovo a tela como base, mas ela ainda não cumpre três premissas: (1) coesão — a seção Pipeline usa azul #60a5fa e roxo #a78bfa hardcoded, fora dos tokens verde+dourado, e mistura o JOB comercial dentro do JOB de caixa; (2) ≤3 cliques — aprovações e próximos vencimentos linkam para listas genéricas filtradas por status, não para o item específico, forçando reencontro manual; (3) ruído na barra de ações — Exportar CSV (função de relatório, baixa frequência) compete visualmente com o CTA primário e ainda tem questão de segurança (export sem hardening de RLS, observado em 26/jun). O caminho não é remover capacidade, é enxugar, recolorir, deep-linkar e empurrar curadoria/recomendação para a IA. Nada aqui justifica refatoração grande; são quick wins de alto impacto.

## Cenários trazidos
- JOB da tela — Caixa puro vs Caixa+Comercial: a tela se chama 'Visão financeira' mas carrega 3 KPIs de pipeline comercial. Cenário A (recomendado): financeiro foca em CAIXA (pagar/receber/vencido/saldo/aprovações) e o pipeline comercial vive no seu próprio painel comercial; aqui fica no máximo 1 linha-resumo discreta com link, recolorida para a marca. Cenário B: manter os 3 KPIs mas recolorir para tokens e renomear, assumindo que o fornecedor quer ver receita potencial junto do caixa. Decisão de produto: A, porque 'útil e fácil de entender' pede um JOB por tela; receita potencial NÃO é caixa e confunde quem veio pagar conta.
- Comercial vs Hub: como dono do produto preciso lembrar que esta tela serve o FORNECEDOR (quem vende e executa), não o Hub. O Hub não gerencia o caixa do fornecedor. Logo o pipeline comercial aqui é secundário e o caixa é soberano — reforça o Cenário A.
- Navegação pagar/receber — hoje há 4 caminhos (botão topo, card KPI, ação agora, lista vencimentos). Cenário A: card KPI vira o destino canônico e removo os 2 botões do topo (menos ruído, mesmo número de cliques). Cenário B: mantenho botões do topo como navegação 'pesada' e removo o link do card. Decisão: A — o card já é clicável e visualmente mais rico.
- IA-first em 'Ação agora' — Cenário evolutivo: hoje é lista priorizada; promover para recomendação explicada ('cobre o cliente Z, atrasado 5d, R$X — maior impacto no caixa') + ação de 1 toque (gerar cobrança / marcar pago) sem sair da tela. É o maior salto de valor da tela.
- Deep-link vs ação inline em Aprovações: Cenário A (rápido/baixo risco): deep-link por id (?aprovacaoId=...) abre o item direto. Cenário B (ideal): aprovar/recusar inline aqui em 1 clique. Faria A agora e B no roadmap, pois B mexe em fluxo de aprovação e merece sua própria auditoria.
- Saldo projetado sem destino: Cenário A — estilizar como card 'somente leitura' (sem affordance de clique) para não frustrar; Cenário B — dar destino a um fluxo de caixa consolidado (que ainda não existe). A agora, B quando existir a tela de fluxo.

## ✅ Manter
- Bloco 'Ação agora' (CrmFinanceAcaoAgora) — coração IA-like da tela, priorização + estado vazio positivo 'Caixa em dia'
- 4 KPIs de Caixa (A pagar, A receber, Vencido, Saldo projetado) — clicáveis, cor semântica, card=ação
- Disclaimer 'não é saldo bancário' no card Saldo e rodapé 'Valores projetados; confirme no banco' — honestidade, funcional não-fachada
- CTA primário 'Novo lançamento' no topo + FAB mobile — ação de criação clara e mobile-friendly
- Seção Aprovações financeiras e Próximos vencimentos como LISTAS orientadas à ação (não tabela densa)
- Banner de erro com 'Tentar novamente' + degradação resiliente — robustez

## ❌ Remover (ruído)
- Os 2 botões 'Contas a pagar' / 'Contas a receber' do topo — redundantes com os cards KPI (mesmos destinos); reduzir de 4 para 2 caminhos
- Botão 'Exportar CSV' da barra de ações primária — é função de relatório, baixa frequência, polui o CTA e tem export sem hardening de RLS; mover para menu overflow '...' ou para /crm/relatorios
- Sub 'pendentes' redundante com o label nos cards A pagar/A receber (cosmético, opcional)
- A seção Pipeline comercial como está HOJE (3 KPIs em azul/roxo off-brand dentro da tela de caixa) — substituir por 1 linha-resumo na marca, ou remover desta tela e levar ao painel comercial

## 🤖 Promover a IA-first / 1-toque
- 'Ação agora' deve passar de lista priorizada para RECOMENDAÇÃO EXPLICADA pela IA (por que é prioridade) + próxima ação de 1 toque (cobrar / marcar pago / aprovar) sem sair da tela
- Modal 'Novo lançamento' deve ser IA-first: pré-preencher categoria/valor/vencimento/contraparte com confiança, usuário apenas confirma (Click-and-Go) — auditar à parte
- Aprovações: aprovar/recusar inline em 1 toque (roadmap), com a IA destacando risco/urgência de cada item
- Renomear 'sit-down' (jargão) para rótulo autoexplicativo como 'Em fechamento' — IA pode classificar a etapa automaticamente

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Recolorir e reduzir a seção Pipeline comercial: trocar os hardcoded #60a5fa/#a78bfa por tokens da marca (dourado/verde/neutros) e colapsar de 3 KPIs para 1 linha-resumo discreta com link ao painel comercial; renomear 'sit-down' para 'Em fechamento'. Resolve coesão visual e separação de JOB.  _(premissa: Coeso (verde+dourado) e útil/fácil de entender (1 JOB por tela: caixa, não receita potencial))_
- **P2** · pequeno · risco baixo — Enxugar a barra de ações do topo: remover os 2 botões 'Contas a pagar/receber' (cards KPI já são o destino canônico) e mover 'Exportar CSV' para menu overflow '...' ou /crm/relatorios. Deixar no topo só 'Novo lançamento'.  _(premissa: Mínimo de cliques / menos ruído; 'tabela=relatório' (export pertence a relatórios))_
- **P3** · medio · risco baixo — Deep-link por id em Aprovações (?aprovacaoId=...) e em Próximos vencimentos (?lancamentoId=...) para abrir o item específico em vez da lista filtrada genérica; e dedup entre 'Ação agora' (crítico) e 'Próximos vencimentos' (horizonte maior) para não repetir os mesmos itens.  _(premissa: Máximo 3 cliques (resolver sem reencontro manual))_
- **P4** · grande · risco medio — Evoluir 'Ação agora' para recomendação explicada pela IA + ação de 1 toque (cobrar/marcar pago/aprovar inline). Transformar o melhor embrião IA-first do CRM em padrão replicável.  _(premissa: IA-first (Click-and-Go: sugere, usuário confirma) e máximo 3 cliques)_
- **P5** · medio · risco alto — Validar/hardenizar a segurança do fallback Supabase no cliente e do Exportar CSV (RLS por tenant) — export financeiro amplo não pode vazar entre fornecedores (risco multi-tenant já mapeado).  _(premissa: Funcional não-fachada (resiliência sem vazamento multi-tenant))_
- **P6** · medio · risco baixo — Auditar o FinanceiroNovoLancamentoModal à parte para garantir pré-preenchimento por IA e ≤3 cliques; estilizar o card 'Saldo projetado' como somente-leitura (sem affordance de clique) até existir tela de fluxo de caixa consolidado.  _(premissa: IA-first no lançamento + fácil de entender (não frustrar clique em card sem destino))_
