# Tarefas comerciais  ·  Comercial

**Rota:** 

## Veredito do diretor
Esta é uma das telas mais distantes do padrão-alvo: um esboço read-only de 102 linhas que falha nas premissas exatamente onde mais importa. O conceito está CERTO (fila de próximas ações em lista, não tabela; links de contexto pra lead/negócio em dourado) — mas a execução é fachada: não dá pra criar nem concluir tarefa (a API só tem GET), a IA-first está totalmente ausente justamente na tela onde ela seria mais óbvia, e o empty-state vaza linguagem de dev ('crie via API quando a tabela estiver migrada') que para o usuário final significa 'quebrado'. Confirmei no código: a API faz graceful-degradation retornando [] se hub_tarefas_comerciais não existir, ou seja, pode estar 100% vazia sem aviso. Veredito: NÃO é uma tela de trabalho hoje, é um relatório passivo. Decisão de produto: ou a promovemos a uma fila de ação real (criar/concluir/adiar em 1 toque + IA que gera as tarefas) ou a removemos do menu até existir backend — manter um stub quebrado visível ao cliente fere 'funcional não-fachada' e contamina a percepção de todo o CRM. Recomendo promover, porque 'próxima ação' é o coração que move o funil e conecta com leads/negócios/distribuição do hub. Risco de escopo: tarefa é objeto transversal (comercial E obra) — a modelagem precisa nascer já pensando nisso pra não retrabalhar.

## Cenários trazidos
- SERVIR O COMERCIAL vs O HUB: a curto prazo a tela serve o vendedor do fornecedor (to-do do funil). Mas 'tarefa/próxima ação' é o mesmo objeto que o hub usa para SLA de distribuição (lead parado, follow-up estourando). Decisão: modelar hub_tarefas com campo de origem/contexto polimórfico (lead_id, negocio_id e futuro obra_id) e dono, para que a MESMA fila sirva vendedor hoje e alimente SLA/redistribuição do hub depois — sem criar duas tabelas de tarefa.
- TABELA vs CARTÕES: já é lista (acerto). Evolução não é virar tabela — é virar cartões agrupados por urgência (Atrasadas / Hoje / Próximas) com ações inline. Rejeitar qualquer proposta de transformar em tabela com colunas; isso regrediria pro anti-padrão 'tabela = tela de trabalho'.
- O QUE AUTOMATIZAR COM IA — três níveis: (A) IA SUGERE tarefas varrendo leads/negócios parados e prazos estourando, usuário aceita em 1 clique (Click-and-Go); (B) IA PRÉ-PREENCHE título/prazo/prioridade ao criar manualmente a partir do lead/negócio; (C) ambicioso/depois — IA executa a ação simples (ex.: disparar follow-up via WhatsApp) e só marca a tarefa. Começar por A+B; C entra no backlog com a fila WhatsApp já existente.
- CONSTRUIR AGORA vs REMOVER DO MENU: alternativa honesta — se backend de tarefas não cabe no sprint comercial, esconder a tela do menu até existir POST/PATCH, em vez de exibir um stub que manda 'criar via API'. Preferível promover, mas remover é melhor que manter fachada quebrada visível ao cliente.

## ✅ Manter
- A estrutura em LISTA (não tabela) — alinhada a 'tabela != tela de trabalho'; evoluir para cartões, nunca para grade
- Links de contexto pra lead e negócio em dourado (#c9a24a) — navegação de contexto em 1 clique é um acerto Click-and-Go
- A graceful-degradation da API (retorna [] se a tabela não existe) como mecanismo técnico — mas o usuário NUNCA pode perceber isso (ver remover)
- O propósito declarado da tela: fila de próximas ações que move o funil — é o conceito certo, só está mal executado

## ❌ Remover (ruído)
- Subtítulo 'PDF Pt.14' — jargão de spec vazado pra UI; substituir por subtítulo útil ('Sua fila de ações — o que fazer agora pra avançar leads e negócios')
- Empty-state atual ('crie via API quando a tabela estiver migrada') — linguagem de dev/fachada; é o pior elemento da tela e precisa sumir já
- Estilos inline hardcoded (#0a140f, #8b949e, #c9a24a) — trocar pelos tokens --obra-*/--brand-* do design system pra não divergir das outras 46 telas
- Estados loading/erro/vazio como parágrafos cinza nus — remover o tratamento amador (sem skeleton, sem 'Tentar de novo' no erro)
- Status/prioridade como texto cru concatenado com ' · ' no mesmo peso/cor — remover o formato chapado; urgência tem que saltar aos olhos

## 🤖 Promover a IA-first / 1-toque
- Botão 'IA: sugerir próximas ações' que varre leads/negócios parados, prazos estourando e SLA, e propõe tarefas (com prazo+prioridade) pro usuário aceitar em 1 clique — é a premissa #2 no lugar mais natural do sistema
- Modal 'Nova tarefa' com IA pré-preenchendo título/prazo/prioridade a partir do contexto do lead/negócio (usuário escolhe e confirma, não digita do zero)
- 'Concluir' inline em 1 toque (PATCH status) e 'Adiar +1d' / 'Hoje' como ações de 1 toque no cartão — o ciclo de vida da ação tem que caber em 3 cliques
- Vencimento como destaque relativo gerado automaticamente ('Atrasada 3d', 'Vence hoje', 'em 2 dias') com cor semântica — leitura instantânea sem o usuário calcular data

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Corrigir o vazamento de fachada IMEDIATAMENTE (sem backend novo): remover 'PDF Pt.14' do subtítulo e reescrever o empty-state para linguagem de produto ('Você está em dia — nenhuma ação pendente') com CTA placeholder. Custo quase zero, remove o pior dano de percepção.  _(premissa: #5 útil e fácil de entender / funcional-não-fachada)_
- **P2** · medio · risco medio — Adicionar POST/PATCH em /api/crm/tarefas e garantir a tabela hub_tarefas_comerciais (migração ADITIVA) com campos de contexto polimórfico (lead_id, negocio_id, dono, vencimento, status, prioridade) já pensando no uso futuro pelo hub/obra. Sem isso a tela é relatório passivo.  _(premissa: #1 job em 3 cliques / funcional-não-fachada)_
- **P3** · medio · risco baixo — Promover a lista a cartões com ações de 1 toque (Concluir / Adiar +1d / Hoje) e agrupamento por urgência (Atrasadas / Hoje / Próximas), com chips coloridos de status/prioridade e vencimento relativo com cor semântica.  _(premissa: #1 mínimo de cliques + #3 bonito/coeso (hierarquia visual))_
- **P4** · grande · risco medio — Adicionar a camada IA: botão 'IA: sugerir próximas ações' (varre leads/negócios parados e prazos) com aceite em 1 clique, e pré-preenchimento IA no modal 'Nova tarefa'. Aproveitar o motor de IA/fila já existente no sistema.  _(premissa: #2 IA-first / Click-and-Go)_
- **P5** · pequeno · risco baixo — Tokenizar todos os estilos inline para --obra-*/--brand-* e padronizar loading (skeleton) e erro (botão 'Tentar de novo' chamando carregar()), alinhando à referência da Área de Membros.  _(premissa: #3 bonito e coeso)_
- **P6** · pequeno · risco baixo — Trazer o NOME do lead/negócio no link (join no SELECT da API) em vez de rótulo genérico 'Lead'/'Negócio', pra usuário não clicar às cegas.  _(premissa: #5 útil e fácil de entender)_
- **P7** · pequeno · risco baixo — Adicionar toggle leve no header ('Atrasadas | Hoje | Semana | Todas' e 'Minhas | Todas') — só o essencial pro job multi-usuário, evitando filtro avançado (ruído). Fazer só depois que houver volume real de tarefas.  _(premissa: #4 prático e fácil)_
