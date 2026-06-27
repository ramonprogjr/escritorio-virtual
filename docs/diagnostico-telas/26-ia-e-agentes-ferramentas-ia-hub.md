# Ferramentas IA (Hub)  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
Tela bonita e tecnicamente correta, mas é uma VITRINE no lugar errado. Hoje ela explica o que a IA sabe fazer e onde está ligada, sem deixar AGIR ali — o job real (ligar/desligar por assistente) vive em /crm/agentes, o que fura o "máximo 3 cliques" e a expectativa Click-and-Go de "onde vejo, eu ajo". Pior: 80% do que está na tela é vocabulário de engenheiro exposto ao dono de escritório (builtins, custom do tenant, builtin_impl, smart provider, motor+toggle, nomes de função como hub_lead_resumo, Escrita/Só leitura). Para o foco atual (Obra10+ Members / fornecedor que vende e executa), a pergunta honesta é: este fornecedor PRECISA de uma tela de catálogo de ferramentas? Na maioria dos casos, não — ele quer dizer "minha IA pode resumir lead e registrar nota? sim/não". A decisão central não é cosmética, é de POSICIONAMENTO: ou esta tela morre e vira uma seção "Habilidades" dentro de cada Assistente (/crm/agentes), ou ela se mantém mas vira operável e em linguagem de negócio, com a parte custom/tenant escondida atrás de modo avançado/admin. Recomendo a segunda como passo seguro/aditivo agora, com a primeira como visão. Não é stub: tem dados reais (agentes, custom, loading/erro), então o esforço é de refino, não de construção.

## Cenários trazidos
- CENÁRIO A — Servir o FORNECEDOR (comercial), recomendado: a tela vira 'Habilidades da sua IA' — lista de coisas que a IA sabe fazer (resumir lead, registrar nota, buscar por telefone), em linguagem de negócio, com toggle/ação inline 'Ativar em [assistente]' no próprio card. Zero jargão. Custom/tenant some por padrão (gate admin).
- CENÁRIO B — Servir o HUB/operador da plataforma (power-user): mantém o catálogo técnico atual como tela de administração da rede (builtins, custom por tenant, smart provider) — mas então sai do menu do fornecedor e vira tela /admin, não /crm.
- CENÁRIO C — Matar a tela: dissolver Ferramentas como página e mover as 'habilidades' para dentro de cada Assistente em /crm/agentes (aba 'O que esta IA pode fazer'). Elimina a navegação cruzada e o furo dos 3 cliques de vez. É a visão mais limpa, porém mais cara e mexe em outra tela — fazer depois.
- CENÁRIO D — Tabela vs cartões: aqui os CARTÕES estão certos (catálogo escaneável, 'tabela≠tela de trabalho'). Não converter para tabela. O que falta nos cartões é AÇÃO, não densidade.
- CENÁRIO E — IA-first do custom: em vez de drawer técnico, um campo 'Descreva a habilidade que você quer' → a IA monta a ferramenta custom (provider, prompt, base). Transforma a feature de power-user numa de 1 frase. Futuro, atrás de admin.

## ✅ Manter
- Layout em cartões agrupados por categoria (Dados do cliente / Análise / Registros) — escaneável e coeso, alinhado a 'tabela≠tela de trabalho'.
- Badge de nível de acesso (a IA só consulta vs pode alterar dados) — é confiança/segurança IA-first responsável; manter as cores, trocar só o texto.
- Bloco 'Agentes com esta ferramenta ativa' com chips que linkam ao assistente — é o único pedaço hoje acionável e útil para o job real.
- Banner de erro e estado de loading — feedback honesto, funcional-não-fachada.
- Paleta dark verde+dourado dos cartões e ícones — coerente com a marca.

## ❌ Remover (ruído)
- Chip contador 'N builtins' — métrica sem ação e com jargão; ruído puro.
- Código da função exposto (hub_lead_resumo) em <code> azul #93c5fd — identificador interno do dev, polui o card e quebra a paleta. Tirar da UI do usuário (no máximo tooltip em modo dev).
- Linha 'Execução: builtin_impl' nos cards custom — interno, não é vocabulário de negócio.
- Badge 'Inactiva no catálogo' e 'Smart {provider}' na visão padrão — conceitos de plataforma que confundem o fornecedor.
- Jargão de estado vazio 'Nenhum agente activo com motor + toggle ligados' — substituir por CTA em linguagem humana.
- Padronizar removendo PT-PT: activar→ativar, partilha→compartilhamento, gerir→gerenciar, registos→registros, activos→ativos, 'A carregar'→'Carregando'.

## 🤖 Promover a IA-first / 1-toque
- Ação inline no card: 'Ativar em…' (menu/seleção de assistentes) e/ou 'Testar' que dispara a habilidade com dados de exemplo — tornar a tela operável em 1 toque, fim do desvio para /crm/agentes.
- Estado vazio acionável: 'Ainda não usada — Ativar em um assistente' como botão de 1 clique.
- Badge 'Sugerido WhatsApp' vira ação: 'Ativar nos assistentes de WhatsApp' em 1 toque (ou some se ficar só decorativo).
- Criação de habilidade custom por descrição em linguagem natural (a IA monta o provider/prompt) em vez do drawer técnico — atrás de modo avançado/admin.
- Header reescrito em 1 frase de negócio + subtítulo natural ('9 habilidades disponíveis') no lugar dos chips contadores.

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Traduzir TODA a tela para linguagem de negócio e PT-BR: header em 1 frase ('O que sua IA sabe fazer no atendimento. Ative cada habilidade por assistente.'); badge de acesso vira 'Só consulta' vs 'Pode alterar dados'; estado vazio vira 'Ainda não usada'; remover activar/partilha/gerir/registos/activos.  _(premissa: Acima de tudo ÚTIL e FÁCIL DE ENTENDER — fala do dono de escritório, não do engenheiro.)_
- **P1** · pequeno · risco baixo — Esconder identificadores internos da UI padrão: remover o <code> do nome da função (hub_lead_resumo), remover a linha 'Execução: builtin_impl' e o chip 'N builtins'. Manter só em tooltip/modo dev.  _(premissa: 'Essa informação é necessária aqui ou é ruído?' — slug interno é ruído; também corrige a quebra de paleta (#93c5fd azul).)_
- **P2** · medio · risco medio — Tornar o card operável: adicionar ação inline 'Ativar em…' (seleção de assistentes) reusando o backend de toggle já existente em /crm/agentes; estado vazio com botão 'Ativar em um assistente'.  _(premissa: Máximo 3 cliques + Click-and-Go: onde vejo, eu ajo — elimina o desvio para outra tela.)_
- **P2** · pequeno · risco medio — Gate da parte custom/tenant + drawer atrás de modo avançado/admin (role). Renomear botão 'Gerir custom + IA' para 'Personalizar habilidades (avançado)'. Para o fornecedor comum, a tela fica enxuta.  _(premissa: Não desviar do objetivo (Obra10+ Members) com feature de poder; reduzir ruído para 95% dos usuários.)_
- **P3** · pequeno · risco baixo — Unificar paleta e labels entre página e drawer: somente verde+dourado da marca (eliminar azul #3b82f6 e âmbar #f59e0b do drawer e o azul dos códigos), labels de categoria idênticos nos dois lugares.  _(premissa: Bonito e coeso — consistência cross-tela evita conflito visual com o resto do sistema.)_
- **P3** · pequeno · risco baixo — Adicionar botão 'Recarregar' no banner de erro chamando carregar(); trocar loading por skeleton dos cards.  _(premissa: Funcional-não-fachada — dar ação de recuperação e polimento de tela que clientes vão usar.)_
- **P4** · grande · risco alto — VISÃO (decidir depois, não executar agora): avaliar dissolver a página e mover 'Habilidades' para dentro de cada Assistente em /crm/agentes (aba 'O que esta IA pode fazer'), eliminando a navegação cruzada de vez. Requer alinhar com a tela de Agentes para não criar duplicidade.  _(premissa: Máximo 3 cliques de forma estrutural — pensar no todo antes de mexer em outra tela.)_
