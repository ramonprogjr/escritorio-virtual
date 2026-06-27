# Integrações  ·  IA e Agentes

**Rota:** 

## Veredito do diretor
Tela honesta e bem estruturada: usa catálogo de cards (respeita "tabela ≠ tela de trabalho"), tem CTA de 1 clique para a tela de trabalho e status semântico claro. NÃO é fachada — renderiza 6 integrações reais de /api/crm/integracoes/status. Mas falha em duas premissas centrais: (1) "útil e fácil de entender" — vaza jargão de dev (nomes de env vars, "ambiente", "UAZAPI", "Mistral", "defina X") para um arquiteto/fornecedor que não opera deploy; (2) "Click-and-Go / IA-first" — o botão "Configurar" pode levar a becos sem saída (telas sem onde colar a credencial), e metade do grid são cards "Em breve" inertes. Há ainda dívida de robustez: fetch sem catch (risco de "Carregando…" eterno), sem skeleton, status só checa presença de chave (não pinga), então "Conectado" pode mentir. Veredito: MANTER a arquitetura (cards + status + CTA), mas REESCREVER a camada de linguagem para o usuário final, GARANTIR que todo CTA termine em ação real, e SEPARAR a visão técnica (env vars) numa camada admin/owner. Esta é uma tela de baixa frequência de uso (configura-se 1x), então o investimento deve ser proporcional: priorizar não-mentir e não-frustrar acima de polimento estético.

## Cenários trazidos
- CENÁRIO A — Servir o COMERCIAL (fornecedor/arquiteto) vs servir o HUB (owner/admin): a mesma tela hoje atende dois públicos com necessidades opostas. O fornecedor quer 'o que está ligado e como ligo o resto' em linguagem de negócio; o owner quer 'quais env vars faltam no deploy'. Recomendo CENÁRIO HÍBRIDO: visão padrão = negócio (conectado/conecte), e um toggle/seção 'Detalhes técnicos' visível só para perfil owner/admin que revela nomes de env vars. Isso resolve o vazamento de jargão sem perder a utilidade operacional.
- CENÁRIO B — Tabela vs Cartões: já está em cartões, e está CERTO. Não reabrir. A evolução não é mudar o formato, é AGRUPAR por categoria (Atendimento / Tráfego & Ads / IA & Agentes) para dar hierarquia. Anti-cenário: virar tabela seria regressão.
- CENÁRIO C — O que automatizar com IA: a tela é configuração de credencial, território de baixa alavancagem para IA generativa. O 1-toque aqui NÃO é 'a IA escreve' e sim 'a IA testa e diz a verdade': health-check automático ao abrir (a IA/sistema pinga a credencial e reporta 'funcionando' vs 'chave inválida'). IA-first real = o status ser confiável sem o usuário precisar saber nada. Evitar over-engineering de assistente conversacional aqui.
- CENÁRIO D — 'Em breve' como roadmap vivo vs ruído: opção 1 = colapsar numa seção discreta 'Em breve na plataforma'; opção 2 = transformar em captura de intenção ('Quero ser avisado' → sinal de demanda que ajuda a priorizar o roadmap do hub). Recomendo opção 2 light: discreto E com botão de interesse, virando dado de produto em vez de card morto.

## ✅ Manter
- Arquitetura de catálogo de cards (não-tabela) — formato correto, respeita a régua
- Status semântico honesto baseado em estado real (conectado/não configurado/erro/em breve) — é o coração da tela e cumpre 'funcional, não fachada'
- CTA de 1 clique para a tela de trabalho (/crm/canais, /crm/trafego, /crm/agentes) com microcópia adaptativa (Abrir vs Configurar)
- Breadcrumb dourado '← Configurações' (consistência de navegação ≤3 cliques)
- Subtítulo que declara o JOB da tela explicitamente (apenas reescrever a linguagem, não remover)

## ❌ Remover (ruído)
- Nomes de env vars expostos ao usuário final (UAZAPI_BASE_URL, WINDSOR_API_KEY, ANTHROPIC_API_KEY) na linha de detalhe — mover para camada admin/owner
- Jargão técnico no nome do card: '(UAZAPI)', 'Anthropic / Mistral' — provedor técnico sai do destaque, vai para tooltip/detail
- Palavra 'no ambiente' do subtítulo (linguagem de dev)
- Cards 'Em breve' totalmente inertes na forma atual (50% do grid morto) — não remover o roadmap, mas remover o estado-morto: recolher em seção discreta
- Duplo mapa de ícones (ICONS no client + lista no server) — fonte única de verdade; remover o mapa client-side

## 🤖 Promover a IA-first / 1-toque
- Health-check automático ao carregar: o sistema pinga cada credencial e 'Conectado' passa a significar 'funciona de verdade', não só 'chave preenchida' — IA-first = status confiável sem esforço do usuário
- Mensagem acionável no lugar de instrução técnica: em vez de 'Defina UAZAPI_BASE_URL', mostrar 'Conecte para começar' com botão que abre modal/fluxo guiado de 1-toque para colar a credencial pela própria UI
- CTA 'Configurar' sempre terminando em ação real (modal de credencial inline) — eliminar o beco sem saída, garantindo Click-and-Go de ponta a ponta
- 'Em breve' com captura de interesse de 1-toque ('Quero ser avisado') que alimenta o roadmap do hub com sinal de demanda real

## 🎯 Ações priorizadas

- **P1** · pequeno · risco baixo — Tratar erro de fetch (adicionar catch + checar res.ok) e adicionar estado de erro explícito com botão 'Tentar de novo', mais skeleton de 6 cards no loading. Elimina o risco de 'Carregando…' eterno e o CLS.  _(premissa: prático e fácil / funcional não-fachada (não pode travar sem explicação))_
- **P1** · medio · risco medio — Garantir que todo botão 'Configurar' termine em ação real: ou leva a uma tela onde de fato se cola a credencial, ou abre modal inline para colar. Nenhum CTA pode levar a beco sem saída.  _(premissa: máx 3 cliques / Click-and-Go (sem beco sem saída))_
- **P2** · medio · risco baixo — Despoluir a linguagem para o usuário final: subtítulo para 'Veja o que já está conectado e conecte o que falta'; nome de negócio em destaque (WhatsApp, Inteligência Artificial) com provedor técnico só em tooltip; trocar 'Defina ENV_VAR' por 'Conecte para começar'. Env vars passam a aparecer só em visão owner/admin.  _(premissa: acima de tudo ÚTIL e FÁCIL DE ENTENDER (sem jargão de dev))_
- **P2** · medio · risco baixo — Agrupar os cards por categoria com cabeçalho leve — Atendimento / Tráfego & Ads / IA & Agentes — e recolher os 'Em breve' numa seção discreta (opcional: botão 'Quero ser avisado'). Dá hierarquia e libera o destaque para o que está ativo.  _(premissa: bonito e coeso / útil (hierarquia visual, fim do grid 50% morto))_
- **P3** · grande · risco medio — Evoluir status para health-check real: testar a credencial (ping) para que 'Conectado' signifique 'funciona'. Aumentar o indicador (pílula com fundo tonal, não bolinha de 1.5px) para acessibilidade.  _(premissa: funcional não-fachada / IA-first (status confiável = a verdade sem esforço))_
- **P3** · pequeno · risco baixo — Unificar a fonte de ícones: mover o campo 'icon' para o payload da API (fonte única) e trocar emojis por logos SVG das marcas / ícones Lucide tematizados no dourado. Remove dessincronização client/server e o visual improvisado.  _(premissa: bonito e coeso (design premium dark verde+dourado))_
