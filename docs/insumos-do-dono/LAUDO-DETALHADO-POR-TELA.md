# LAUDO TÉCNICO DETALHADO DE AUDITORIA DE PRODUTO — OBRA10+
## UX/UI · IA First · Click & Go · Enterprise — Análise tela a tela (versão imparcial, funcionalidade-primeiro)

**Objeto:** Obra10+ · `escritorio-virtual-1.onrender.com` · CRM/ERP para arquitetura, obras e rede de parceiros
**Perfil auditado:** OWNER (usuária "Nice") · **Ambiente:** DEV/demo (Render + Supabase) · **Datas:** 01–02/07/2026
**Método:** navegação real tela a tela; todos os menus e botões clicados; fluxos executados até o fim (criações reais); inspeção de requisições de rede (status HTTP) nos submits; leitura da árvore de acessibilidade.

---

## COMO LER ESTE LAUDO

**Régua de notas (0–10), funcionalidade-primeiro:**
- 9–10 = funciona, é útil, rápido e comprovado ao vivo;
- 7–8 = funciona com ressalvas menores;
- 5–6 = utilizável, mas com atrito relevante ou utilidade parcial;
- 3–4 = existe na tela, porém quebrado, mockado ou de pouca utilidade real;
- 0–2 = inoperante ou danoso.

**Critérios fixos aplicados a TODAS as telas:**
1. **IA só pontua se executar de verdade.** A tela *Integrações* declara: Anthropic API key = **Falta**, MISTRAL_API_KEY = **Falta**, GROQ_API_KEY = **Falta**, WhatsApp base URL/token = **Falta**, Windsor.ai = **Falta**. Portanto, toda "resposta de IA" observada (copiloto do wizard, auditor da rede, score de lead) é tratada como **mock/heurística de demonstração** — arquitetura pronta, entrega NÃO comprovada.
2. **Submit que falha = funcionalidade inexistente** para efeito de nota, por melhor que seja o desenho.
3. **Utilidade real > estética.** Tela redundante ou rasa perde nota mesmo bonita.
4. Cada problema tem ficha completa: Tela · Caminho · Componente/Elemento · Botão/Campo · Fluxo · Severidade (🔴 crítica / 🟠 alta / 🟡 média / ⚪ baixa) · Descrição · Impacto · Usuários afetados · Cliques desperdiçados · Tempo desperdiçado · Carga cognitiva · Como corrigir · Mockup textual · Justificativa · Ganho esperado · Complexidade (B/M/A) · Prioridade (P0–P3).

**Evidências:** códigos de rede citados como `POST /api/... → status`; textos entre aspas são literais da interface.

---

## QUADRO GERAL DE NOTAS POR TELA (resumo antecipado)

| # | Tela | Funciona? | UX | UI | IA real | Click&Go | Utilidade | Confiab. | **Média** |
|---|---|---|---|---|---|---|---|---|---|
| 01 | Dashboard | Parcial | 6,5 | 7,5 | 2,0 | 8,0 | 6,0 | 4,0 | **5,7** |
| 02 | Leads | Parcial | 7,0 | 8,0 | 2,5 | 8,5 | 7,0 | 3,5 | **6,1** |
| 03 | Distribuição | Parcial | 7,0 | 8,0 | 3,0 | 7,5 | 6,5 | 5,0 | **6,2** |
| 04 | Negócios | **Não cria** | 7,0 | 7,5 | 2,5 | 6,0 | 5,0 | 2,0 | **5,0** |
| 05 | Cadastros | Sim | 7,5 | 7,5 | 2,0 | 8,5 | 7,5 | 6,5 | **6,6** |
| 06 | Atendimento | Parcial | 8,0 | 7,5 | 3,0 | 9,0 | 7,0 | 6,0 | **6,8** |
| 07 | Canais | Sim (raso) | 6,0 | 7,5 | 2,0 | 7,0 | 4,0 | 5,0 | **5,3** |
| 08 | Tarefas | Sim (vazio) | 6,5 | 7,5 | 2,0 | 8,0 | 4,5 | 6,0 | **5,8** |
| 09 | Aprovações | **Quebrada** | — | — | — | — | 0 | 0,5 | **0,5** |
| 10 | Arquitetura | Parcial | 7,5 | 8,0 | 2,5 | 9,5 | 6,5 | 4,0 | **6,3** |
| 11 | Engenharia (Obras) | Parcial | 7,0 | 7,5 | 2,5 | 8,0 | 6,0 | 3,5 | **5,8** |
| 12 | Imóveis | **Não cria** | 5,5 | 7,0 | 1,5 | 6,0 | 2,0 | 1,5 | **3,9** |
| 13 | Pedidos | Sim (raso) | 6,0 | 6,0 | 1,5 | 8,5 | 3,5 | 7,0 | **5,4** |
| 14 | Parceiros | Sim | 6,5 | 7,0 | 2,0 | 7,0 | 6,0 | 6,5 | **5,8** |
| 15 | Fornecedores | Sim (duplicada) | 5,5 | 7,0 | 2,0 | 7,0 | 4,0 | 6,5 | **5,3** |
| 16 | Especialistas | Sim | 7,5 | 7,5 | 1,5 | 8,0 | 7,5 | 7,0 | **6,5** |
| 17 | Contas a receber | Sim | 6,5 | 7,0 | 1,5 | 8,0 | 6,0 | 6,5 | **5,9** |
| 18 | Contas a pagar | Parcial | 6,5 | 7,0 | 1,5 | 8,0 | 6,0 | 4,0 | **5,5** |
| 19 | Visão financeira | Sim | 7,0 | 7,5 | 2,0 | 8,5 | 7,0 | 7,5 | **6,6** |
| 20 | Campanhas | Vazia (sem integração) | 5,5 | 7,0 | 1,0 | 7,0 | 2,5 | 5,0 | **4,7** |
| 21 | Canais de entrada | Sim | 6,5 | 7,0 | 1,5 | 7,5 | 5,5 | 6,5 | **5,8** |
| 22 | Agentes IA | Telas sim; IA não | 7,0 | 7,5 | 2,5 | 7,0 | 4,0 | 5,0 | **5,5** |
| 23 | Automações | **0 ativos** | 6,0 | 7,0 | 2,0 | 6,5 | 3,0 | 3,0 | **4,6** |
| 24 | Ferramentas IA | Catálogo sim; execução não | 7,0 | 7,5 | 2,5 | 7,0 | 4,0 | 5,5 | **5,6** |
| 25 | Carteira de Tijolos | Sim (medição) | 6,5 | 7,0 | 2,0 | 7,5 | 4,0 | 6,0 | **5,5** |
| 26 | Precificação & IA | Funciona p/ quem NÃO devia | 5,0 | 7,0 | — | 7,0 | — | 2,0* | **4,0** |
| 27 | Integrações | Sim (é o raio-X) | 7,0 | 7,5 | — | 7,5 | 8,0 | 8,0 | **7,6** |
| 28 | Copiloto (página) | Doc sim; voz não comprovada | 6,5 | 7,5 | 2,0 | — | 4,0 | 5,0 | **5,0** |
| 29 | Config. Geral | Sim | 6,5 | 7,0 | — | 7,0 | 6,5 | 5,0* | **6,0** |
| 30 | Contatos de notificação | **Quebrada** | — | — | — | — | 0 | 0,5 | **0,5** |
| 31 | Usuários & Permissões | Sim | 6,0 | 6,5 | — | 7,0 | 6,5 | 5,5 | **6,0** |
| 32 | Escritórios | Sim (perigosa) | 5,0 | 6,5 | — | 7,0 | — | 3,0* | **4,5** |
| 33 | Analytics / Relatórios | Parcial | 5,5 | 7,0 | 1,5 | 6,5 | 5,0 | 4,5 | **5,0** |

\* nota rebaixada por risco de segurança/RBAC, não por bug visual.

**Média geral ponderada do produto: ≈ 4,8–5,0** (telas críticas quebradas e IA desconectada puxam para baixo; detalhe por tela a seguir).


---
---

# PARTE I — ELEMENTOS GLOBAIS (presentes em todas as telas)

## G0. Shell do aplicativo: Sidebar + Topbar + FABs

### A. Identidade
| Campo | Valor |
|---|---|
| Objetivo | Navegação primária, busca, notificações, criação rápida e acesso ao copiloto de voz em qualquer contexto. |
| Usuário | Todos os perfis, o tempo todo. |
| Frequência | Contínua — é a moldura de 100% das sessões. |
| Importância | Crítica: erro aqui multiplica por todas as telas. |

### B. Inventário completo
- **Sidebar:** logo OBRA10/CRM; busca "Buscar… (Ctrl K)"; 8 grupos colapsáveis (Visão Geral; COMERCIAL/CRM ×8 itens; OPERAÇÕES ×4; FORNECEDORES ×3; FINANCEIRO ×3; MARKETING ×2; IA E AGENTES ×7 + atalho "+" para novo agente; ADMINISTRAÇÃO ×4); card do usuário (avatar iniciais, nome, e-mail truncado, badge OWNER, botão vermelho "Sair da conta"); botão "Recolher menu lateral".
- **Topbar:** botão voltar "<"; título da tela + subtítulo; badge "OBRA10+"; busca global placeholder "PES, LED, NEG…"; sino com badge "9+" (aria-label: "Notificações (15 não lidas)"); botões contextuais (Analytics, Relatórios, Leads no Dashboard; ações da tela nas demais).
- **FAB 1 — "+" Criar** (canto inf. dir.): speed-dial com **Lead · Negócio · Pessoa · Empresa** (4 menuitems) + botão "Fechar menu criar".
- **FAB 2 — Copiloto de voz** (círculo verde com microfone): abre modal "Ouvindo…" com abas **Falar** (default) e **Escrever**, campo "Fale agora…", botão fechar. Página própria informa que é **arrastável**.
- **Tooltip fixo "TENTE DIZER / ESCREVER…"** com 3 sugestões ("resumo deste lead", "métricas do escritório", "adicionar nota ao lead").

### C. Análise visual
- Hierarquia: boa — grupos em caps/letter-spacing, itens com ícone+texto, item ativo com pílula verde e borda dourada. Contraste AA na maioria; itens truncados ("Contatos de notificaç…", "Usuários & Permissõ…", e-mail "nice.engemp@g…") **sem tooltip**, o que força memorização.
- Peso visual: sidebar escura equilibrada; badge OWNER âmbar destaca bem o papel.
- Consistência: ícones lineares coerentes; porém o "+" dourado do grupo IA é o único atalho de criação dentro do menu — padrão isolado.

### D. Análise funcional
- A sidebar existe por boa razão (8 domínios), mas **rótulo ≠ rota** em 4 itens (Engenharia→`/obras`, Carteira de Tijolos→`/creditos`, Campanhas→`/trafego`, Copiloto→`/agentes-reais`) — dificulta suporte, deep-link e treinamento.
- Duas "portas" para Leads (item de menu e botão na topbar do Dashboard) — redundância tolerável, mas mereceria unificação de destino/estado.

### E. Botão a botão (globais)
| Botão | Por que existe | Necessário? | Bem posicionado? | Veredito |
|---|---|---|---|---|
| Busca sidebar (Ctrl K) | achar tela/registro | Sim | Sim | **Manter**; unificar com busca da topbar (hoje são 2 buscas com escopos incertos). |
| Busca topbar "PES, LED, NEG…" | busca por código | Sim | Sim | **Simplificar**: uma única busca global com escopos. |
| Sino notificações | alertas | Sim | Sim | **Corrigir contador** (exibe "9+", anuncia 15). |
| "+" Criar (FAB) | criação rápida | Sim | **Não** — colide com CTAs de rodapé (ex.: Enviar do chat) | **Mover/auto-recuar** quando houver composer/CTA fixo. |
| Copiloto (FAB) | voz em qualquer tela | Sim (conceito) | Parcial — cobre conteúdo à direita | **Manter + tornar arraste descobrível** (dica no 1º hover). |
| Tooltip "Tente dizer…" | educar sobre voz | Não como fixo | Não — sobrepõe cards/menus | **Remover fixação**: mostrar só no hover/1ª visita, com X. |
| Sair da conta | logout | Sim | Sim | Manter (ícone + confirmação leve). |
| Recolher menu | densidade | Sim | Sim | Manter. |

### F. Inputs globais
| Campo | Precisa digitar? | IA poderia? | Veredito |
|---|---|---|---|
| Busca global | Sim | Autocomplete por entidade (já sugere códigos PES/LED/NEG no placeholder) | Adicionar resultados mistos com preview e atalhos ↑↓. |
| Campo do copiloto "Fale agora…" | Voz/texto | — | Sem transcrição visível no teste (IA off) — ver G/H. |

### G. Fluxos e cliques
- Criar entidade de qualquer tela: 2 cliques (FAB → tipo). ✅
- Trocar de módulo: 1–2 cliques (grupo → item). ✅
- Encontrar tela por nome: Ctrl+K → digitar → Enter (3 interações). ✅

### H. IA First (estado real)
- O copiloto abre e alterna Falar/Escrever, mas **sem chave de IA configurada** não há transcrição/execução comprovada. Sugestões do tooltip não são contextuais à tela (mostram "resumo deste lead" fora de leads). **Nota IA real do shell: 2,0.**

### I. Enterprise (100–5.000 usuários)
- Sidebar estática escala razoavelmente; faltam **favoritos/recentes** e permissão por módulo (owner vê tudo — ver telas 26/29/32). Sem tenant-switcher visível para multiempresa.

### J. Mobile
- Não testado em viewport mobile. Risco alto: 2 FABs + tooltip fixo no canto inferior direito competem com o polegar; sidebar de 8 grupos exigirá drawer bem projetado.

### K. Psicologia
- O tooltip fixo gera **irritação/estorvo** ("por que isso não sai da frente?"); o contador de sino divergente gera **desconfiança** sutil que contamina o resto ("se o número simples está errado…").

### L. Problemas — fichas completas

**G0-1 · Tooltip do copiloto sobrepõe conteúdo** 🟠 Alta · P1
- Tela: todas · Caminho: shell global · Componente: tooltip flutuante · Elemento: "TENTE DIZER/ESCREVER…" · Fluxo: leitura/ação em qualquer tela.
- Descrição: tooltip fixo cobre cards e menus à direita (no Dashboard, cobre o card "Modelos IA ativos" e o próprio menu do FAB "+").
- Impacto: oculta informação e ações; Usuários afetados: 100%.
- Cliques desperdiçados: 1–2 por ocorrência (fechar/rolar para desviar); Tempo: 2–5s por tela; Carga cognitiva: média (ruído permanente).
- Como corrigir: exibir apenas no primeiro uso e no hover do FAB; botão X; nunca sobre conteúdo interativo.
- Mockup textual: `FAB copiloto → (hover) balão pequeno acima do botão: "Fale: 'métricas do escritório'" [x]`.
- Justificativa: educação de recurso não pode custar oclusão de UI.
- Ganho: leitura limpa; +descoberta do copiloto sem custo. Complexidade: B.

**G0-2 · FAB "+" cobre CTAs de rodapé** 🟠 Alta · P1
- Tela: todas com composer/CTA fixo (ex.: Atendimento) · Componente: FAB speed-dial · Botão: "+" / "Enviar".
- Descrição: o FAB fica sobre o botão Enviar do chat.
- Impacto: erro de toque no botão mais usado da tela; Usuários: atendentes (uso contínuo).
- Cliques desperdiçados: 1–2 por mensagem errada; Tempo: 3–8s; Carga: alta no pico de atendimento.
- Correção: colisão detectada → FAB recua/encolhe; ou margem reservada no composer.
- Mockup: `[composer.........] [Enviar]   (FAB sobe 72px quando composer visível)`.
- Ganho: zero cliques errados no chat. Complexidade: B. 

**G0-3 · Contador de notificações inconsistente** 🟡 Média · P2
- Tela: todas · Elemento: badge do sino ("9+" vs aria "15 não lidas").
- Impacto: desconfiança; acessibilidade anuncia número diferente do visual. Usuários: todos.
- Correção: um único contador real (99+ como teto). Mockup: `🔔 15`. Complexidade: B.

**G0-4 · Rótulo ≠ rota em 4 itens de menu** 🟡 Média · P2
- Impacto: suporte/onboarding confusos; links compartilhados ilegíveis ("/trafego" para Campanhas).
- Correção: alinhar slugs (`/crm/engenharia`, `/crm/campanhas`, `/crm/tijolos`, `/crm/copiloto`) com redirects. Complexidade: M.

**G0-5 · Duas buscas com escopos indefinidos** ⚪ Baixa · P3
- Correção: uma busca global única (Ctrl K) com abas de escopo. Complexidade: M.

### M. Notas do shell
UX 6,5 · UI 7,5 · IA real 2,0 · Click&Go 8,0 · Confiabilidade 6,0 → **Média 6,0**

---

# PARTE II — COMERCIAL / CRM

## 01. Visão Geral (Dashboard) — `/crm`

### A. Identidade
| Campo | Valor |
|---|---|
| Objetivo | Painel de comando diário: o que exige ação, saúde do funil, últimos movimentos, visão da operação e da "equipe de IA". |
| Usuário | Owner/gestor (visão), comercial (fila de ação). |
| Frequência | Altíssima (primeira tela do dia). |
| Tempo-alvo | ≤ 60s para "entender o dia e agir". |
| Contexto | Chega-se de manhã ou entre tarefas; decisão: "o que faço agora?" |

### B. Inventário completo (6 blocos + topbar própria)
1. **"O QUE PRECISA DE VOCÊ"** — pílula "17 pendentes"; 3 linhas-ação: "6 leads sem resposta há +24h" → **Atender→**; "6 leads aguardando você" → **Abrir→**; "5 alertas não lidos" → **Ver→**; expansor "Ver leads parados (6)".
2. **"Funil comercial"** — subtítulo "Clique numa etapa para abrir o kanban já filtrado"; KPIs: Leads no funil **0**, Pipeline **R$ 0**, Ganhos **0**, Conversão topo→fundo **—**; 7 etapas (Novos→Fecham.) todas **0**; nota "Setas = % que passou da etapa anterior"; badges "Ganhos: 0"/"Perdidos: 0"; CTA "Abrir kanban de leads →"; botões Atualizar/Leads/Negócios.
3. **"Últimos movimentos"** + "Ver todos" — 5 registros (nome + status + data + seta).
4. **"OPERAÇÃO · LEAD → NEGÓCIO → OBRA"** — Negócios abertos **5**; Obras em andamento **0**; Pedidos de material **0**.
5. **"VISÃO COMERCIAL"** — 6 KPIs: Receita potencial **R$0**; Taxa qualificação **100%**; Taxa encaminhamento **0%**; Parceiros ativos **5**; Encaminhamentos hoje **0**; **Modelos IA ativos 2**.
6. **"Equipe IA"** + "Ver todos→" — cards Mari ("Só playbook") e Will ("Coordenador de Obras"), badge N3.

### C. Análise visual
- Hierarquia correta (número grande + label pequena); cor semântica ok (verde/âmbar/vermelho).
- **Problema de dobra:** o bloco 1 (o único acionável) divide a dobra com um funil inteiramente zerado; abaixo, ~3 rolagens de zeros. Em base nova, a tela vira um "muro de zeros" — escaneabilidade alta, **valor informacional baixo**.
- Sobreposição do tooltip global cobre o KPI "Modelos IA ativos" (ver G0-1).

### D. Análise funcional
- Bloco 1 é a alma da tela (fila de trabalho priorizada) — deveria ser dono da dobra e talvez da tela.
- Funil duplica o Kanban de Leads (que já tem KPIs próprios): candidato a colapsar em uma linha-resumo clicável.
- "Equipe IA" na home **promete IA ativa**; com API desconectada, isso é marketing interno — arriscado para a confiança (ver H).

### E. Botão a botão
| Botão | Necessário? | Momento certo? | Veredito |
|---|---|---|---|
| Atender→ / Abrir→ / Ver→ | Sim | Sim | **Manter** — 1 clique para a ação nº1. |
| Ver leads parados (6) | Sim | Sim | Manter; poderia já ofertar "reengajar todos" (IA, quando on). |
| Atualizar (funil) | Não deveria existir | — | **Automatizar** (dados live) e remover. |
| Leads/Negócios (chips do funil) | Duplicados com menu | — | **Simplificar**: uma só porta. |
| Abrir kanban de leads → | Sim | Sim | Manter. |
| Ver todos (movimentos) | Sim | Sim | Manter. |
| Ver todos → (Equipe IA) | Sim | — | Manter. |

### F. Inputs
Nenhum campo digitável no corpo — correto para um painel. A busca global cobre o resto.

### G. Fluxos e cliques (medidos)
| Tarefa | Cliques | Avaliação |
|---|---|---|
| Atender lead mais urgente | **1** | ✅ excelente |
| Ver por que funil=0 com 5 negócios | ∞ | ❌ sem caminho na UI (dados incoerentes) |
| Chegar ao kanban filtrado | 1 | ✅ |

### H. IA First (estado real)
- "Modelos IA ativos: 2" com **Anthropic/Mistral = Falta** nas Integrações → rótulo **enganoso** no estado atual.
- Não há briefing do dia gerado; sugestões do tooltip não contextuais. **IA real: 2,0.**
- Quando conectar: gerar resumo de 2 frases acima do bloco 1 ("Bom dia. 6 leads esfriando, 1 proposta vence hoje…"), com ações de 1 clique.

### I. Enterprise
- Com 5.000 usuários/100k leads, os blocos 2–5 precisam de filtros por equipe/período e agregação por papel (diretor vê % e tendência, operador vê fila). Hoje é uma visão única para todos.

### J. Mobile
- Risco: 6 blocos empilhados + 2 FABs + tooltip = rolagem longa; a fila de ação deve virar a única seção above-the-fold no celular.

### K. Psicologia
- Zeros em série produzem **sensação de produto vazio/abandonado** (mesmo sendo base nova) — empty states acionáveis reduzem essa ansiedade e ensinam o próximo passo.
- Incoerência 0×5 gera **desconfiança nos números** — o pior sentimento possível num painel gerencial.

### L. Problemas — fichas completas

**D1 · Dados incoerentes entre funil e operação** 🔴 Crítica · P0
- Tela: Dashboard · Caminho: `/crm` · Componente: KPIs funil × bloco Operação/Comercial · Fluxo: leitura gerencial.
- Descrição: funil todo 0 e "Receita potencial R$0" convivendo com "Negócios abertos 5" e "Taxa qualificação 100%".
- Impacto: decisões erradas; perda de confiança no produto inteiro. Usuários: gestores (decisão) e vendedores (metas).
- Cliques desperdiçados: n/a (dano é decisório); Tempo: minutos de conferência manual por dia; Carga cognitiva: alta (usuário vira auditor).
- Correção: fonte única de verdade (mesma query/DTO para funil, pipeline e receita); teste de reconciliação automática por deploy.
- Mockup: `Funil: 6 leads · Pipeline R$150k · Ganhos 2 — (fonte única: /api/crm/metricas)`.
- Justificativa: painel que mente é pior que painel ausente. Ganho: confiança restaurada; adoção diária. Complexidade: M.

**D2 · "Modelos IA ativos: 2" com IA desconectada** 🔴 Crítica (honestidade) · P0
- Componente: KPI Visão Comercial · Campo: Modelos IA ativos.
- Descrição: KPI afirma IA ativa; Integrações mostra chaves ausentes.
- Impacto: expectativa falsa; cliente pode contratar/testar acreditando em IA operante. Usuários: todos + prospects em demo.
- Correção: KPI condicionado ao health-check real das integrações; se off → "IA não conectada · Configurar →".
- Mockup: `⚠ IA desconectada — [Conectar Anthropic/Mistral →]` no lugar do número.
- Ganho: credibilidade; menos churn pós-venda. Complexidade: B.

**D3 · Muro de zeros sem empty state acionável** 🟡 Média · P1
- Descrição: 4 blocos zerados em ~3 rolagens; nenhum orienta o próximo passo.
- Impacto: onboarding frio; percepção de produto vazio. Usuários: novas contas (100%).
- Tempo desperdiçado: 30–60s de rolagem inútil/dia. 
- Correção/Mockup: `Funil vazio — [Importar leads] [Criar 1º lead] [Conectar WhatsApp]`.
- Ganho: ativação mais rápida. Complexidade: B.

**D4 · Botão "Atualizar" manual em painel "live"** ⚪ Baixa · P3 — automatizar refresh; remover botão.

**D5 · Truncamentos sem tooltip (menu/e-mail)** ⚪ Baixa · P3 — tooltip + largura mínima.

### M. Notas (funcionalidade-primeiro)
Funciona? Parcial (leitura ok; números não confiáveis). UX 6,5 · UI 7,5 · IA real 2,0 · Click&Go 8,0 · Utilidade 6,0 · Confiabilidade 4,0 → **Média 5,7**


---

## 02. Leads (Pipeline de Leads) — `/crm/leads`

### A. Identidade
| Campo | Valor |
|---|---|
| Objetivo | Triagem e resposta a leads por urgência; qualificação; conversão em negócio; visão por mercado. |
| Usuário | Comercial/atendimento (operação contínua); gestor (filtro/etapas). |
| Frequência | Altíssima — várias sessões/dia. |
| Tempo-alvo | Responder lead urgente em ≤10s da abertura da tela. |
| Contexto | Pressão de tempo; lead esfria por hora parada. |

### B. Inventário completo
- **Header:** título dinâmico "Pipeline de Leads · Pipeline global · 8 leads"; **+ Novo lead**; alternador **Caixa | Kanban | Lista**; busca "Buscar lead…"; select "Todos os estágios" (Novos, Qualificando, Qualificado, Proposta, Negociando, Fechamento, ✓Ganhos, ✗Perdidos); botão "Configurar pipeline" (mesmo drawer da tela 10).
- **Abas de mercado (9):** Pipeline global · Imobiliário · Arquitetura · Reforma e obra · Marcenaria e móveis · Engenharia civil · Serviços · Produtos e materiais · Fornecedor/homologação (+ setas de rolagem).
- **Faixa KPI:** Leads Hoje · Sem Resposta +24h (vermelho) · Em Risco +1h ("—") · Encaminhados · Pipeline Total.
- **Modo CAIXA (default)** — agrupamento por urgência com microcopy: 🔴 "Agora — esfriando, resgate já"; 🟡 "Hoje — no ritmo" (vazio positivo: "Nada aqui — bom sinal."); ⚪ "Aguardando — com outro responsável". Card: nome; chips origem (Google Ads/WhatsApp) + mercado; "Xd parado"; responsável (admin/IA); botões **Responder** (link `wa.me/<fone>`) · **Negócio** · **Ficha**.
- **Modo KANBAN** — colunas por estágio comercial; observado: coluna "Novos" com badge **2** e **nenhum card renderizado**; demais "vazio".
- **Modo LISTA** — colunas: NOME (nome+código LD/LED+fone), ORIGEM, ESTÁGIO, VALOR, **SCORE** (barra+número), AGENTE, ATUALIZADO, "Ver→".
- **Ficha do lead** (`/crm/leads/:id`): header nome + badge estágio (ex.: AGUARDANDO_RESPOSTA) + código + fone/origem; ações **Direcionar** · **Criar negócio** · **Central de atendimento** (laranja); stepper de ciclo de vida: Novo · Em atendimento · Aguardando resposta · Qualificando · Encaminhado · Convertido em negócio · Perdido · Spam ou inválido; abas **Atividades (n)** (timeline + "Registrar uma nota" + Adicionar), **Memórias IA (0)** (com texto explicativo e vazio técnico "0 linhas ou formato não mapeado"), **Propostas** (Título + Valor R$ + "+ Nova proposta"), **Dados** (Registo CRM: código participante, score, origem, e-mail, campanha, mercado(metadata), interesse, cidade/UF, agente, responsável, última mensagem, último contato); rodapé fixo AÇÕES: Central de atendimento · ✓Negócio · ✗Perdido · ←Voltar.
- **Modal "Direcionar lead":** estado 1 "Buscando os melhores fornecedores…"; estado 2 (lead não qualificado): explicação + botão único **"Qualificar e direcionar"**.
- **Drawer "+ Novo lead":** promessa "Só **nome e telefone** já criam o lead. O resto é opcional…"; campos Nome*, Telefone*; expansor "Mais opções — tipo, mercado, origem, valor" → Tipo de interesse (9 chips), DADOS DO INTERESSE (**Cidade\***, **Comprar ou vender\***, Bairro, Tipo de imóvel), MERCADO DO LEAD (8 chips multi; aviso "sem nenhum, o lead entra em **Imobiliário**"), E-mail (opcional), COMERCIAL: Origem (chips; **WhatsApp default**), Valor estimado (R$); rodapé Cancelar / **Criar lead**.

### C. Análise visual
- Modo Caixa é o ponto alto visual do produto: seções com farol de cor, cards de borda lateral colorida, microcopy humana. Escaneabilidade excelente.
- Lista: SCORE com barra é bom; porém colunas VALOR/AGENTE ~100% "—" (ruído) e códigos de DEV (LED-DEV-…) ocupando área nobre.
- Kanban: colunas altas vazias com rótulo "vazio" — na coluna com badge 2, a ausência de cards passa **em silêncio** (nem "vazio" aparece), parecendo bug de CSS/virtualização.

### D. Análise funcional
- Por que existe: é o coração comercial — mantém-se.
- **Conflito estrutural:** a tela opera com DUAS máquinas de estados: (a) estágio comercial do funil (select/Kanban) e (b) ciclo de vida do lead (stepper da ficha: aguardando_resposta, encaminhado…). Leads em estados do ciclo (b) não mapeados em (a) somem do Kanban e zeram o funil do Dashboard. É a **causa-raiz** de D1/L-Kanban.
- "Configurar pipeline" aqui edita o pipeline global — compartilhado com outras telas (ver tela 10): risco de efeito colateral invisível.

### E. Botão a botão
| Botão | Por quê | Necessário? | Veredito |
|---|---|---|---|
| + Novo lead | captura manual | Sim | Manter (corrigir feedback de duplicado — ficha L1). |
| Caixa/Kanban/Lista | 3 modelos mentais | Sim | Manter; Caixa como default é decisão certa. |
| Responder (wa.me) | resposta imediata | Sim | **Manter — referência** (1 clique → WhatsApp). |
| Negócio (card) | conversão rápida | Sim | Manter; pré-preencher wizard com dados do lead. |
| Ficha (card) | detalhe | Sim | Manter. |
| Direcionar (ficha) | rotear p/ fornecedor | Sim | Manter — padrão "Qualificar e direcionar" em 1 passo é exemplar. |
| Criar negócio (ficha) | conversão | Sim | Manter (hoje esbarra no 500 da tela 04). |
| Central de atendimento | ir ao chat | Sim | Manter; unificar com "Responder"? (dois caminhos p/ conversar). |
| ✗Perdido (rodapé) | descarte | Sim | Manter com **motivo obrigatório** (hoje não pede — perde-se aprendizado). |
| Configurar pipeline | editar etapas | Parcial | **Mover** para Admin/por módulo; aqui é perigoso. |
| Setas de rolagem das abas | overflow | Sim | Manter; considerar dropdown "mais mercados". |

### F. Inputs (drawer + ficha)
| Campo | Precisa digitar? | IA poderia (quando on)? | Validação hoje | Veredito |
|---|---|---|---|---|
| Nome* | Sim | Puxar do WhatsApp/contato | ok | Manter. |
| Telefone* | Sim | Autoformatar/DDI; dedup em tempo real | **Sem máscara**; dedup só no submit (409 mudo) | Máscara + verificação assíncrona com aviso inline. |
| Cidade* (em "Mais opções") | **Contradição**: opcional que vira obrigatório | Inferir por DDD/conversa | obrigatória | Tornar opcional de fato (obrigar só ao qualificar). |
| Comprar ou vender* | idem | Inferir da conversa | chip único "Compra" | idem. |
| Mercado | Não (default IMB) | Classificar pelo texto do lead | ok | Manter default explícito. |
| Origem | Não | UTM/canal automático | **Default WhatsApp em cadastro manual** | Default "Manual"; origem automática só via canal real. |
| Valor estimado | Não | Estimar por tipologia/região | sem máscara moeda | Máscara + sugestão IA. |
| "Registrar uma nota…" (ficha) | Sim | Ditado por voz; resumo automático da conversa | ok | Manter + voz. |
| Proposta: Título/Valor | Sim | **Gerar proposta completa** (usar Precificação) | mínimos | Elevar de par de campos a fluxo de proposta. |

### G. Fluxos e cliques (medidos na prática)
| Fluxo | Passos reais | Cliques | Tempo | Status |
|---|---|---|---|---|
| Responder lead urgente | Caixa → Responder | **1** | ~3s | ✅ |
| Criar lead mínimo | +Novo lead → nome → fone → Criar | 4 | ~20s | ✅ cria / ❌ silencioso se duplicado (`POST /api/crm/leads → 409`, 3× sem qualquer feedback) |
| Qualificar e direcionar | Ficha → Direcionar → Qualificar e direcionar | 2 | ~8s | ✅ UI |
| Converter em negócio | Ficha → Criar negócio → (wizard) | 2+ | — | ❌ bloqueado a jusante (500 do wizard) |
| Ver leads no Kanban | alternar Kanban | 1 | — | ❌ cards não renderizam (badge 2, corpo vazio) |
| Mudar estágio na ficha | clicar chip do stepper | 1 | ~2s | ✅ (com recarga pesada) |

### H. IA First (estado real)
- SCORE exibido (94/94/94… e 50 nos novos) sugere **valor fixo/regra**, não modelo — com API off, é cosmético. Memórias IA: vazias ("formato não mapeado"). Responsável "IA" em leads WhatsApp: estrutura pronta.
- **IA real: 2,5.** Quando conectar: auto-qualificação pela conversa; resgate de esfriados em lote com aprovação; dedup inteligente com merge; proposta gerada.

### I. Enterprise
- 100k leads: modo Caixa precisa de paginação/virtualização e SLAs configuráveis por equipe; abas de mercado viram filtro salvo por perfil; auditoria de quem respondeu o quê já existe via timeline — bom.

### J. Mobile
- Cards da Caixa adaptam bem em tese; risco: 3 botões por card lado a lado <44px de alvo; FAB sobre o botão Ficha do último card.

### K. Psicologia
- Microcopy reduz ansiedade ("Nada aqui — bom sinal."). Porém o **409 silencioso** cria o pior sentimento do formulário: "cliquei e nada aconteceu — a culpa é minha?" (auto-atribuição de erro), seguido de duplo clique e frustração.

### L. Problemas — fichas completas

**L1 · Submit de lead falha em silêncio no duplicado** 🔴 Crítica · P0
- Tela: Leads · Caminho: `/crm/leads` → drawer "+ Novo lead" · Componente: form drawer · Botão: "Criar lead" · Campo: Telefone · Fluxo: criação manual.
- Descrição: com telefone já existente, `POST /api/crm/leads → 409` e a UI não reage (sem toast/erro/foco; drawer aberto). Reproduzido 3×.
- Impacto: usuário não sabe se criou; tenta de novo; abandona; base pode ganhar variações do fone p/ "passar".
- Usuários afetados: todo o comercial; Cliques desperdiçados: 2–6 por ocorrência; Tempo: 30–120s + suporte; Carga cognitiva: alta.
- Como corrigir: interceptor de erro + mensagem inline no campo Telefone com link ao lead existente + ação "Mesclar/Abrir".
- Mockup textual: `Telefone já cadastrado para "TESTE AUDITORIA – Claude" · [Abrir lead] [Mesclar dados]`.
- Justificativa: dedup no backend está correto; a falha é 100% de comunicação. Ganho: fim de duplo-clique/duplicatas disfarçadas. Complexidade: B. Prioridade: P0.

**L2 · Kanban não renderiza cards existentes** 🔴 Crítica · P0
- Componente: board Kanban · Elemento: coluna "Novos" (badge 2, corpo vazio, sem rótulo "vazio").
- Impacto: gestor conclui "não há leads novos" — decisão errada de alocação; Usuários: gestores/vendedores.
- Cliques desperdiçados: alternância entre modos p/ conferir (2–4); Tempo: 1–3 min/dia por usuário; Carga: alta (dupla checagem vira hábito).
- Correção: corrigir binding estado→coluna (ver L3) + teste de regressão "contagem do header == cards renderizados".
- Mockup: coluna `Novos (2)` com 2 cards "teste wendel" e "TESTE AUDITORIA – Claude".
- Ganho: visão kanban utilizável. Complexidade: M. P0.

**L3 · Duas máquinas de estados concorrentes (causa-raiz)** 🔴 Crítica · P0
- Componente: modelo de dados/UX de estágio · Fluxo: todo o ciclo comercial.
- Descrição: funil comercial (Novos→Fechamento) × ciclo de vida da ficha (Novo→Spam) sem mapeamento; estados como `aguardando_resposta`/`encaminhado` não têm coluna → somem do Kanban e zeram Dashboard.
- Impacto: é a origem de D1, L2 e do board vazio da tela 10. Usuários: todos.
- Correção: unificar enum OU tabela de mapeamento explícita ciclo→coluna, com validação de exaustividade em CI.
- Mockup (mapa): `aguardando_resposta → coluna "Qualificando" · encaminhado → "Qualificado" · convertido → sai do funil de leads`.
- Ganho: coerência sistêmica em 3 telas de uma vez. Complexidade: M/A. P0.

**L4 · "Mais opções" opcional exige Cidade\*/Comprar-vender\*** 🟡 Média · P1
- Botão/Campo: expansor "Mais opções" · Cidade* · Comprar ou vender*.
- Impacto: quebra a promessa "só nome e telefone"; gera abandono no meio do form. Cliques/tempo: +2 campos e +10–20s por lead.
- Correção: tornar opcionais; exigir apenas na qualificação. Mockup: labels sem `*` no expansor.
- Ganho: promessa de cadastro-relâmpago cumprida. Complexidade: B. P1.

**L5 · Colunas mortas e código DEV na Lista** ⚪ Baixa · P2 — ocultar colunas 100% vazias por default; código só na ficha. Ganho: densidade útil. B.

**L6 · Aba Propostas rasa (Título+Valor)** 🟡 Média · P2 — sem template/PDF/envio; deveria consumir Precificação e mandar pelo WhatsApp. Mockup: `[Gerar proposta c/ IA] → prévia → [Enviar no WhatsApp]`. M.

**L7 · Vazio técnico em Memórias IA** ⚪ Baixa · P3 — trocar "0 linhas ou formato não mapeado" por texto de produto ("As memórias aparecem após o 1º atendimento com IA conectada."). B.

**L8 · KPI "Em Risco +1h" exibe "—" em vez de 0** ⚪ Baixa · P3 — padronizar zero real. B.

### M. Notas
Funciona? Parcial (Caixa/Lista sim; Kanban não; criação com armadilha). UX 7,0 · UI 8,0 · IA real 2,5 · Click&Go 8,5 · Utilidade 7,0 · Confiabilidade 3,5 → **Média 6,1**

---

## 03. Distribuição de Leads — `/crm/distribuicao`

### A. Identidade
| Objetivo | Governar quem recebe cada lead: fila de direcionamento, desempenho/aderência da rede, regras de roteamento e trilha de eventos. |
|---|---|
| Usuário | Gestor do hub/owner. |
| Frequência | Diária (gestor); pico em campanhas. |
| Importância | Alta — é o "cérebro operacional" da rede. |

### B. Inventário completo
- **Fila de direcionamento** ("leads aguardando · o motor já recomendou quem recebe") + botão Atualizar; empty state positivo: "✓ Nenhum lead aguardando direcionamento. Tudo encaminhado."
- **Auditoria da rede · KPIs em tempo real:** 3 distribuídos · 2 entregas · 1 recusas · 1 recolocados · 1 bloqueios (vermelho); alerta "⚠ 1 tentativa(s) de envio barradas por pendência financeira"; botão **"Rodar auditor agora"**.
- **Desempenho por fornecedor** ("aderência decide quem recebe mais leads"): Traço & Forma (•em dia; 2 recebidos·0 recusas; ADERÊNCIA **66**), Studio Áurea (•em dia; 2·1; **51**), Loft 7 (•bloqueado; 0·0·1; **5**; "⚠ Pendência financeira — bloqueado para receber leads") + botões **Liberar** / **Cobrar**.
- **Atividade da rede · "controle total do Hub":** ~18 eventos com ator (humano / ia_auditor / sistema): "Cobrança enviada a Loft 7 Arquitetura · Pendência financeira — bloqueado…" (×6!), "Entrega OBR-2026-0004 gerada · obra (automática ao fechar)", "Lead recolocado para Traço & Forma", "Fornecedor recusou: Studio Áurea — oferecendo ao próximo", "Lead distribuído para Studio Áurea · aderência 68/69"…
- **Regras de roteamento automático** (expansor "▼configurar"): builder `origem: qualquer` · `mercado: qualquer` · `UF (qualquer)` · `→ Agente IA` · `escolha o agente/atendente` + **+ Adicionar regra**; copy "O lead que casa com a 1ª regra ativa (por prioridade) vai direto ao destino. Sem regra, vale a heurística padrão. Deixe um campo em branco (qualquer) para não filtrar por ele."; vazio: "Nenhuma regra ainda — o roteamento usa a heurística padrão. Adicione a 1ª regra **acima**."

### C. Análise visual
- Cards de fornecedor com número de aderência grande e cor de status: leitura instantânea. Log denso mas escaneável por cor de bullet; **faltam timestamps** e filtros.

### D. Análise funcional
- Conceito de **aderência como moeda** é o diferencial estratégico do produto — manter e explicar (tooltip "como calculamos").
- "Rodar auditor agora" dispara ações reais (cobranças) **sem preview** — ação de impacto externo com 1 clique.
- Regras: semanticamente boas (prioridade + branco=qualquer); erro de copy no vazio ("acima" aponta para o lugar errado, o builder fica dentro do expansor).

### E. Botão a botão
| Botão | Necessário? | Veredito |
|---|---|---|
| Atualizar (fila) | transitório | Automatizar (live) e remover. |
| Rodar auditor agora | Sim | **Simplificar com dry-run**: "vai enviar N cobranças — confirmar?". |
| Liberar (fornecedor) | Sim | Manter com confirmação + motivo (auditável). |
| Cobrar | Sim | Manter com limite de frequência (ver DI1). |
| ▼configurar (regras) | Sim | Manter; abrir já expandido quando não houver regra. |
| + Adicionar regra | Sim | Manter. |

### F. Inputs (builder de regras)
| Campo | Veredito |
|---|---|
| origem/mercado/UF | Manter ("qualquer" default claro). |
| → Agente IA / atendente | Manter; exibir carga atual do destino (evitar sobrecarregar um só). |

### G. Fluxos e cliques
- Liberar bloqueado: 1 clique (✅ rápido; ❌ sem confirmação p/ ação financeira-reputacional).
- Criar 1ª regra: 2 cliques + 4 selects ✅.
- Entender "por que o lead X foi para Y": ❌ impossível — log global sem filtro por lead.

### H. IA First (estado real)
- `ia_auditor` como ator registrado é a melhor peça de arquitetura IA do produto; porém com API off, essas entradas são **simulação/heurística**. **IA real: 3,0.**
- Quando on: explicabilidade ("por que este fornecedor? aderência 66 > 51, mesmo mercado, UF igual"), política do auditor (frequência/tom/escalonamento), sugestão de regra a partir do histórico.

### I. Enterprise
- Com 500 fornecedores: ranking paginado, busca, e **rate-limit do auditor** viram obrigatórios; log precisa de retenção/exportação.

### K. Psicologia
- Log com 6 cobranças idênticas passa impressão de **sistema descontrolado** ("vai spammar meu parceiro?") — mina a confiança na automação justamente onde ela deveria brilhar.

### L. Problemas — fichas completas

**DI1 · Auditor em loop: 6 cobranças idênticas ao mesmo fornecedor** 🟠 Alta · P1
- Tela: Distribuição · Componente: motor ia_auditor + log · Fluxo: cobrança de pendência.
- Descrição: 6+ eventos "Cobrança enviada a Loft 7 · Pendência financeira" (atores ia_auditor e humano) sem dedup/intervalo.
- Impacto: desgaste com parceiro real; ruído no log; Usuários: gestor + fornecedor externo.
- Tempo desperdiçado: gestor relendo eventos repetidos; risco reputacional.
- Correção: idempotência por (fornecedor, motivo) com cooldown (ex. 72h) + contador "cobrado 3× — escalar para humano".
- Mockup: `Cobrança enviada a Loft 7 (3ª de 3) · próxima ação: escalar → você`. 
- Ganho: automação confiável. Complexidade: B/M. P1.

**DI2 · Ações reais sem confirmação (Rodar auditor / Liberar)** 🟠 Alta · P1
- Correção: dry-run + confirm; motivo no Liberar. Mockup: `Auditor encontrará: 1 bloqueio, 2 pendências → enviará 1 cobrança. [Cancelar] [Executar]`. B.

**DI3 · Copy do vazio aponta "acima" para builder oculto** 🟡 Média · P2 — trocar por "Clique em ⚙ configurar e adicione a 1ª regra" ou auto-expandir. B.

**DI4 · KPIs sem período explícito** 🟡 Média · P2 — sufixo "hoje/7d" + filtro. B.

**DI5 · Log sem timestamp/filtragem por ator/lead** 🟡 Média · P2 — adicionar hora relativa + filtros; link do evento para o lead. B/M.

### M. Notas
Funciona? Parcial (painel sim; automações simuladas; ações sem guarda). UX 7,0 · UI 8,0 · IA real 3,0 · Click&Go 7,5 · Utilidade 6,5 · Confiabilidade 5,0 → **Média 6,2**

---

## 04. Negócios — `/crm/negocios`

### A. Identidade
| Objetivo | Pipeline de negócios por mercado: criar, avançar etapas, registrar próxima ação, fechar. |
|---|---|
| Usuário | Comercial/gestor. |
| Frequência | Alta. |
| Importância | Crítica — receita. |

### B. Inventário completo
- **Lista:** header "Negócios · Imobiliário · 4 negócios" (abre direto na aba Imobiliário — **não há aba "Todos"**); **+ Novo negócio**; alternador **Kanban | Lista**; busca por título/código; select "Todas as etapas"; 8 abas de mercado; KPIs Negócios Hoje · Qualificados · Negociando · Pipeline Total (R$ 150k); tabela TÍTULO (título + código NGIMB2026009), MERCADO, ETAPA (chips Proposta/Negociando/✓Ganhos), STATUS (**Aberto** — inclusive nos Ganhos), VALOR (R$150k no 1º; demais "—"), PREVISÃO ("—"), ATUALIZADO, Ver→.
- **Detalhe** (`/crm/negocios/:id`): ← Negócios; título+código; **Editar** / **Arquivar**; card RASTREIO (Principal: `NGIMB2026009 · TESTE Auditoria – Negocio Claude · NEGOCIO`); sub-abas "Arquitetura | Obras" (sem efeito visível ao clicar); grid MERCADO/VALOR ESTIMADO/ETAPA/STATUS; PESSOA/DECISOR "Nenhuma pessoa vinculada" + **Vincular**; **chips de etapa** (novo→perdido) clicáveis; painel **PRÓXIMA AÇÃO** (textarea com exemplo + chips QUANDO: Hoje/Amanhã/+3 dias/+7 dias/data + **Definir ação**); **Timeline** ("Registrar uma nota…" + Adicionar; registra "Etapa: proposta → negociando" com data/hora).
- **Wizard "+ Novo negócio"** (drawer, 4 etapas + rodapé Cancelar/Voltar/Próximo/**Salvar negócio**):
  1. *Origem e mercado* — cards-resumo vivos (Mercado/Etapa/Valor/Vínculos); Título* (placeholder "Ex.: Retrofit prédio comercial · fase 1" + helper); Mercado* (9 chips); Etapa inicial (8 chips); painel "Enquadramento do negócio" ("Defina bem mercado, etapa e naming… O copiloto usa isso…").
  2. *Participantes* — **um único campo**: "Busque por nome ou telefone e vincule leads, pessoas, empresas ou parceiros — tudo num campo só" ("Buscar entre 24 participantes…"); resultados com badge de tipo (Lead); contador Vínculos atualiza (0→1 ao vincular Joana Ribeiro). **Vinculados não aparecem como lista/chips.**
  3. *Objeto e financeiro* — Valor estimado (R$), Previsão de fechamento (data), expansor "Completar depois (opcional) — 2 itens para enriquecer", painel "Leitura do negócio" em linguagem natural ("Mercado Imobiliário, etapa Novos, valor não definido e 1 vínculo(s) carregado(s)").
  4. *Próxima ação (IA) — opcional* — resumo (Valor R$250.000 verde; Leads 1/Pessoas 0/Empresas 0/Parceiros 0); "Copiloto opcional de criação" ("Use a IA apenas se quiser ajuda extra… Ela não é obrigatória."); 4 chips de pergunta; chat. **Testado:** "O que está faltando neste negócio?" → resposta com sugestões coerentes (previsão de fechamento; completar envolvidos). *(Com API off ⇒ resposta de heurística/mocks do wizard.)*
- **Bloco repetido** "Visão do cadastro — Dados consolidados do registo no CRM. Alterações em modo edição são auditadas." aparece até **4× na mesma tela** do wizard.

### C. Análise visual
- Wizard com stepper claro e resumo persistente: ótimo. Repetição do bloco "Visão do cadastro" enche a tela de texto idêntico (ruído). Lista limpa; chips de etapa com boa cor semântica.

### D. Análise funcional
- **Wizard é o melhor fluxo desenhado do produto** (busca unificada de participantes + leitura em linguagem natural + IA opcional) — e hoje **não cumpre sua função**: salvar falha.
- Sem aba "Todos": dashboard fala 5 negócios, Imobiliário mostra 4 — o 5º fica invisível até o usuário adivinhar a aba (Arquitetura).
- Padrão "Próxima ação" (activity-based selling) é excelente para disciplina comercial.

### E. Botão a botão
| Botão | Necessário? | Veredito |
|---|---|---|
| + Novo negócio | Sim | Manter; **corrigir o salvar** (N1). |
| Kanban/Lista | Sim | Manter (Kanban não pôde ser validado com dados — etapa/estado ver L3). |
| Ver→ | Sim | Manter. |
| Editar / Arquivar | Sim | Manter; Arquivar com confirmação leve. |
| Vincular (pessoa/decisor) | Sim | Manter; **auto-vincular** lead de origem ao criar a partir do lead. |
| Chips de etapa | Sim | Manter; update otimista (hoje full reload "Carregando…"). |
| Definir ação | Sim | Manter; sugerir texto/data pela IA (quando on). |
| Salvar negócio / Próximo / Voltar | Sim | Manter; desabilitar durante request + spinner. |
| Sub-abas "Arquitetura | Obras" | ? | **Remover ou dar função visível** — hoje clicar não muda nada perceptível. |

### F. Inputs
| Campo | Veredito |
|---|---|
| Título* | Manter (bom helper de naming). IA: sugerir título pelo lead/mercado. |
| Busca de participantes | **Referência** — manter; exibir vinculados como chips removíveis. |
| Valor estimado | Máscara de moeda; IA sugerir por comparáveis. |
| Previsão de fechamento | Manter; IA sugerir pela cadência histórica. |
| Próxima ação (textarea) | Manter; templates rápidos ("ligar", "enviar proposta"). |

### G. Fluxos e cliques (medidos)
| Fluxo | Cliques | Status |
|---|---|---|
| Criar negócio completo (4 etapas) | 8–10 | ❌ **`POST /api/crm/negocios → 500`** (2 tentativas), sem qualquer feedback na UI; drawer permanece aberto. |
| Criar negócio mínimo (salvar na etapa 1) | 3–4 | ❌ mesmo 500 (bloqueado). |
| Mudar etapa no detalhe | 1 | ✅ com trilha na timeline; ❗recarrega página inteira. |
| Definir próxima ação | 3 | ✅ |
| Ver todos os negócios (todas as abas) | — | ❌ inexistente (sem aba "Todos"). |

### H. IA First (estado real)
- Copiloto do wizard respondeu de forma contextual — **porém sem chave de IA ativa, é resposta programática**. Não creditar como IA de produção. **IA real: 2,5.**
- Quando on: pré-preencher do lead (título, valor, participantes), prever probabilidade/data de fechamento, sugerir próxima ação com 1 clique.

### I. Enterprise
- Pipeline por equipe/carteira, permissão por etapa (quem pode marcar "ganho"), motivos de perda obrigatórios — ausentes hoje.

### K. Psicologia
- O usuário completa um wizard caprichado de 4 etapas e o clique final **não faz nada**: é o ponto de maior frustração de todo o produto ("perdi tudo?"). Falta até mensagem de rascunho salvo.

### L. Problemas — fichas completas

**N1 · "Salvar negócio" retorna 500 e a UI silencia** 🔴 Crítica · P0
- Tela: Negócios · Caminho: `/crm/negocios` → wizard · Componente: submit final · Botão: "Salvar negócio" · Fluxo: criação (mínima e completa).
- Descrição: `POST /api/crm/negocios → 500` reproduzido 2×; nenhuma reação visual; dados do wizard ficam "presos".
- Impacto: **impossível criar negócio pela UI** — quebra o núcleo comercial; risco de perda do que foi digitado.
- Usuários: todo o comercial; Cliques desperdiçados: 8–10 por tentativa + repetições; Tempo: 1–3 min perdidos/tentativa; Carga: altíssima.
- Correção: (a) consertar o erro no backend; (b) toast de erro com ID; (c) manter rascunho local (localStorage) e oferecer "tentar novamente".
- Mockup: `⚠ Não conseguimos salvar (erro #A1B2). Seus dados estão guardados como rascunho. [Tentar de novo]`.
- Justificativa: fluxo-chave sem fallback. Ganho: restaura a função nº1 do módulo. Complexidade: M (back) + B (front). P0.

**N2 · Ganhos com STATUS "Aberto"** 🟠 Alta · P1
- Elemento: coluna STATUS × chip ETAPA (✓Ganhos + Aberto em 2 registros).
- Impacto: relatórios e comissões errados; confusão conceitual etapa×status.
- Correção: regra derivada — etapa ∈ {ganho, perdido} ⇒ status "Fechado (ganho/perdido)" automático.
- Mockup: `✓ Ganhos · Fechado`. Complexidade: B. P1.

**N3 · Sem aba/visão "Todos os mercados"** 🟡 Média · P1
- Impacto: contagens divergem do Dashboard (5×4); negócios "somem" por aba. Correção: aba "Todos" default + filtro salvo. B.

**N4 · Bloco "Visão do cadastro" repetido 4×** ⚪ Baixa · P3 — exibir 1× no topo. B.

**N5 · Troca de etapa recarrega a página inteira** 🟡 Média · P2 — optimistic UI + patch. Ganho: fluidez percebida. M.

**N6 · Participantes vinculados invisíveis (só contador)** 🟡 Média · P2 — chips removíveis sob o campo. Mockup: `Vínculos: [Joana Ribeiro ×] [+ adicionar]`. B.

**N7 · Sub-abas Arquitetura|Obras sem efeito** ⚪ Baixa · P3 — remover ou implementar. B.

### M. Notas
Funciona? **Não para criar** (500); detalhe sim. UX 7,0 · UI 7,5 · IA real 2,5 · Click&Go 6,0 · Utilidade 5,0 · Confiabilidade 2,0 → **Média 5,0**


---

## 05. Cadastros — `/crm/cadastro`

### A. Identidade
| Objetivo | Base única de pessoas/empresas (leads, clientes, parceiros): criar, buscar, filtrar, deduplicar, convidar rede. |
|---|---|
| Usuário | Comercial, admin. |
| Frequência | Alta. |
| Importância | Alta (fonte de verdade de contatos). |

### B. Inventário completo
- Header: **+ Convidar** · **Mão de obra** (é LINK p/ `/crm/especialistas`, tooltip "Cadastrar mão de obra / especialistas (sem acesso ao sistema)") · **Duplicatas** · **+ Novo cadastro**.
- Filtros: busca "nome, código, CPF/CNPJ, email ou telefone" · select Contatos · PF e PJ · Todas UFs · Todas origens · Todas áreas · **Limpar filtros** · botão **Colunas** (personalização).
- Tabela: checkbox multi; NOME (nome + código + fone com **ícone copiar**); CÓDIGO (mistura `PS2026003` e `PES-2026-005`); TIPO (PF); PERFIL (lead/cliente); CPF/CNPJ (100% "—"); TELEFONE (badge DDI +55); AÇÕES 👁 ✏ 🗑.
- **Duplicatas** (`/crm/pessoas/duplicatas`): título topbar errado ("Pessoa"); explicação "Pares com o mesmo CPF/CNPJ, telefone ou e-mail. Reveja e mescle — o registo perdedor é **arquivado, nunca apagado**."; banner de flag: "Em homologação — a fusão real está desativada até a aprovação do dono…"; vazio: "Nenhuma duplicata encontrada. Sua base está limpa. 🎉".
- **+ Convidar** → painel "**Link da rede de parceiros**": "Um único link para todos. Cada inscrição gera um código único (ex.: PAR-2026-0001)."; URL exibida; "Token: rede"; **Copiar link** · **Pré-visualizar formulário** · Fechar.
- **+ Novo cadastro** (drawer): "PF ou PJ — identidade, contato, endereço e comercial em um único formulário."; toggle **Pessoa física | Empresa** ("Campos abaixo adaptam-se ao tipo seleccionado"); Identidade ("Opcional na campanha — informe o que o contato passar (mín.: nome, telefone ou e-mail)"): Nome completo, CPF (opcional); Contato: Telefone, E-mail; **Localização** (colapsada: "Opcional — toque para abrir. **Preenche sozinho ao buscar o CNPJ ou o CEP**"); Comercial: "Lead no funil activo por defeito (código LED). Ideal para campanhas Meta, Google, etc."; DESTINO NO CRM: toggle "Lead no funil comercial [VENDAS] — ATIVO" + aviso "Ao guardar, será criado um código LED-2026-#### no funil IMB."; MERCADO/ÁREA DE INTERESSE (chips; "sem nenhum, o lead entra em Imobiliário"); Origem do lead (chips: Outro/manual · Indicação · Site · WhatsApp · **Meta Ads (pré-selecionado)** · Google Ads); **Resumo vivo**: "Resumo: PF — — · Lead (IMB)"; rodapé Cancelar / **Salvar cadastro**.
- **Quick-view 👁** (drawer CONTACTO): "Abrir ficha completa →"; abas Resumo · Dados · Vínculos · Leads e negócios; card com foto/origem; Telefone c/ copiar; seções colapsáveis Identidade / Contato / Endereço / CRM e metadados (Origem meta_ads; Criado em; Mercados); rodapé **Editar** / **Excluir**.

### C. Análise visual
- Tabela densa e legível; copiar telefone inline é detalhe de quem entende operação. Coluna CPF/CNPJ inteira vazia = desperdício de largura. Dois formatos de código na mesma coluna ferem a percepção de ordem.

### D. Análise funcional
- Form único adaptativo PF/PJ com autofill por CNPJ/CEP prometido: **acima da média do mercado**.
- "Mão de obra" como botão-que-é-link confunde o modelo mental da tela (sai do contexto sem aviso).
- Excluir na linha convive com filosofia "nunca apagado" das Duplicatas — política de dados contraditória.

### E. Botão a botão
| Botão | Necessário? | Veredito |
|---|---|---|
| + Novo cadastro | Sim | Manter. |
| + Convidar | Sim | **Manter — referência** (link permanente + preview). |
| Duplicatas | Sim | Manter (flag transparente é boa prática). |
| Mão de obra | Não aqui | **Mover**: virar link textual "Ir para Especialistas →" ou remover (já está no menu). |
| Colunas | Sim | Manter; usar para ocultar vazias por default. |
| 👁 / ✏ | Sim | Manter. |
| 🗑 na linha | Não | **Trocar por Arquivar**; excluir só na ficha com confirmação tipada. |
| Copiar telefone | Sim | Manter. |
| Copiar link / Pré-visualizar (convite) | Sim | Manter. |

### F. Inputs
| Campo | IA poderia (on)? | Veredito |
|---|---|---|
| Nome/CPF/Telefone/E-mail | Enriquecer por CNPJ/telefone | Manter mínimos flexíveis (nome OU fone OU e-mail) — bom. |
| Localização (CEP/CNPJ autofill) | — | **Validar na prática** quando integrado; hoje é promessa de UI. |
| Origem (default **Meta Ads**) | UTM automático | **Corrigir default → "Outro/manual"** em criação manual (atribuição nasce suja). |
| Toggle "Lead no funil" | — | Manter (bom para campanhas), com explicação de código já presente. |

### G. Fluxos e cliques
- Criar cadastro mínimo: 3–4 interações ✅ (submissão não estressada nesta tela).
- Convidar parceiro: 2 cliques ✅✅.
- Ver contato: 1 clique (👁) ✅.
- Mesclar duplicatas: bloqueado por flag (comunicado) ⚠️.

### H. IA First (real)
- Zero IA operante aqui (e é a tela que mais se beneficiaria: dedup em tempo real, enriquecimento). **IA real: 2,0.**

### I. Enterprise
- Import/export em massa ausentes na UI; RBAC de exclusão inexistente (qualquer um com acesso vê 🗑).

### K. Psicologia
- "Sua base está limpa. 🎉" — microcopy que recompensa. Positivo.

### L. Problemas — fichas

**C1 · Mistura pt-PT/pt-BR em todo o módulo** 🟡 Média · P1
- Elementos: "seleccionado", "registo", "activo por defeito", "Ao guardar", título "CONTACTO".
- Impacto: percepção de produto estrangeiro/inacabado (público-alvo BR); Usuários: todos.
- Correção: passada i18n pt-BR completa (glossário + revisão). Complexidade: B (mecânica, extensa). P1.

**C2 · Origem default "Meta Ads" em cadastro manual** 🟡 Média · P1
- Impacto: TODA a análise de canais fica contaminada na origem; decisões de mídia erradas.
- Correção: default "Outro/manual"; Meta/Google só via integração/UTM. Mockup: chip `Outro/manual` pré-selecionado. B. 

**C3 · Excluir a 1 clique da lista (política contraditória)** 🟡 Média · P1
- Correção: Arquivar na linha; Excluir apenas na ficha com digitação do nome. Mockup: `Para excluir, digite "ZZ TESTE…" [____] [Excluir]`. B.

**C4 · Dois formatos de código (PS × PES-)** ⚪ Baixa · P2 — unificar máscara + migração visual. B.

**C5 · "Mão de obra" = link disfarçado** ⚪ Baixa · P2 — ver E. B.

**C6 · Breadcrumb "Pessoa" na tela de Duplicatas** ⚪ Baixa · P3. B.

### M. Notas
Funciona? Sim (fluxos principais). UX 7,5 · UI 7,5 · IA real 2,0 · Click&Go 8,5 · Utilidade 7,5 · Confiabilidade 6,5 → **Média 6,6**

---

## 06. Atendimento (Inbox) — `/crm/atendimento`

### A. Identidade
| Objetivo | Central omnichannel: triagem de conversas, atendimento humano, handoff com IA. |
|---|---|
| Usuário | Atendentes/comercial (uso contínuo). |
| Frequência | Contínua — tela de trabalho. |
| Importância | Crítica. |

### B. Inventário completo
- **Coluna Inbox:** "Inbox — 8/8 conversas" + badge do atendente ("nice"); busca "Buscar lead…"; **filtros nível 1** (carrossel): Todos 8 · Meus · Humano 6 · …; **filtros nível 2**: Todos (8) · Novo · Qualificando · …; itens: bolinha de status (amarela ativa / cinza parada), nome, "WHATSAPP · 28MIN" / "GOOGLE ADS · 38D", badge responsável (Admin/Meus).
- **Painel da conversa:** header nome + estágio + fone + badge **"IA ativa"**; ações **Assumir** · **Ver ficha** · **Info**; corpo (empty: "Conversa pronta para começar — Ainda não há mensagens neste histórico. As novas aparecem aqui em tempo real."); composer.
- **Estados do composer:** (IA ativa) banner "🤖 IA está respondendo por este lead" + link **Assumir**; input bloqueado "Assuma o atendimento para escrever". (Humano) banner "**IA pausada nesta conversa.** Responsável: nice. O agente não responde automaticamente no WhatsApp até clicar em **Devolver à IA**."; header vira "A atender · (você atendendo) · Ver ficha · Info · **Devolver à IA**"; input ativo "(Enter envia · Shift+Enter nova linha)"; **respostas rápidas**: "Olá! Tudo bem? Como posso ajudar?" · "Pode me passar mais detalhes, por favor?" · "Vou verificar e já te retorno." · …
- **Devolver à IA** → "IA reativada. **Peça ao lead para enviar uma nova mensagem no WhatsApp.**"

### C. Análise visual
- Layout 2 colunas clássico e correto; estados sempre anunciados com banner colorido — clareza exemplar. FAB "+" invade o canto do composer (Enviar).

### D. Análise funcional
- **Melhor fluxo do produto em desenho:** posse explícita da conversa (IA×humano), bloqueio de colisão de mensagens, reversão em 1 clique.
- Conversas de Ads paradas há 38d misturadas na mesma fila das ativas — falta arquivamento/segmentação temporal.
- Dois destinos de detalhe (Ver ficha / Info) competem.

### E. Botão a botão
| Botão | Veredito |
|---|---|
| Assumir | **Manter — referência** (1 clique, estado claro). |
| Devolver à IA | Manter; corrigir POSIÇÃO (hoje o conjunto de botões desloca e o usuário erra o clique — reproduzido na auditoria). |
| Ver ficha / Info | **Unificar** num painel único com abas. |
| Respostas rápidas | Manter; permitir personalizar por escritório. |
| Enviar | Manter; **desobstruir do FAB** (G0-2). |
| Filtros nível 1/2 | Manter com **rótulos** ("Responsável:" / "Estágio:") — hoje são 2 fileiras de chips sem título. |

### F. Inputs
| Campo | Veredito |
|---|---|
| Mensagem | Manter atalhos Enter/Shift+Enter (bem documentados no placeholder). IA (on): rascunho sugerido ao assumir + resumo da conversa. |
| Busca | Manter. |

### G. Fluxos e cliques (medidos)
| Fluxo | Cliques | Status |
|---|---|---|
| Assumir conversa | 1 | ✅ |
| Devolver à IA | 1 | ✅ |
| Responder com frase pronta | 2 | ✅ |
| Achar conversas que precisam de humano | 1 (filtro "Humano") | ✅ |
| Enviar mensagem real no WhatsApp | — | ⚠️ **não comprovável** (canal/token = Falta; sem mensagens reais no histórico). |

### H. IA First (real)
- A orquestração IA↔humano está pronta e é excelente; mas **sem WhatsApp/IA conectados**, nenhuma resposta automática real foi observada. "Peça ao lead para enviar nova mensagem" expõe limitação técnica ao usuário. **IA real: 3,0.**

### I. Enterprise
- Faltam: fila por equipe, SLA visível por conversa, supervisor view (espiar sem assumir), métricas de TMA/TMR.

### K. Psicologia
- Posse clara ("Responsável: nice") elimina o medo clássico de "responder por cima do bot". Excelente. A instrução "peça ao lead…" transfere ônus ao usuário — pequena quebra de encanto.

### L. Problemas — fichas

**A1 · FAB "+" sobre o botão Enviar** 🟠 Alta · P1 — (ficha completa em G0-2; nesta tela o dano é máximo: uso contínuo). Cliques errados: 1–2/mensagem no pior caso; Correção: recuo automático do FAB com composer visível. P1.

**A2 · Botões do header mudam de posição por estado** 🟡 Média · P2
- Descrição: ao assumir, o conjunto (Assumir/Ver ficha/Info) vira (A atender/Ver ficha/Info/Devolver) e desloca X px; cliquei "Info" e acertei "Devolver à IA".
- Impacto: devoluções acidentais ao bot **no meio de atendimento humano**; Carga: alta.
- Correção: largura fixa do grupo; "Devolver" ocupa o slot do "Assumir".
- Mockup: `[● Você atendendo] [Devolver à IA] | [Ficha] [Info]` (posições estáveis). B. 

**A3 · Conversas de 38d sem tratamento** 🟡 Média · P2 — auto-arquivar/agrupar "Paradas"; sugerir reengajo (IA on). B/M.

**A4 · "Peça ao lead para enviar nova mensagem"** ⚪ Baixa · P3 — reescrever para linguagem de produto + automatizar ping quando janela permitir. B.

### M. Notas
Funciona? Parcial (orquestração sim; envio real não comprovado). UX 8,0 · UI 7,5 · IA real 3,0 · Click&Go 9,0 · Utilidade 7,0 · Confiabilidade 6,0 → **Média 6,8**

---

## 07. Canais (WhatsApp) — `/crm/canais`

### A/B. Identidade e inventário
- Objetivo: monitor de instâncias WhatsApp por agente. Usuário: admin. Frequência: baixa (status). 
- KPIs: Canais ativos 1 · Conectados 1 · Com instância 1. Explainer: "Visão operacional: só estado da conexão. **Cadastrar instância** (nome, proxy, token WhatsApp) é na ficha do agente; **QR/pareamento** é um passo à parte…". Busca por nome/slug/instância; filtros Todos · Conectados · Sem instância. Card **Mari**: •Conectado; slug `mari`; Instância `obra10-mari`; Modo "Atende no WhatsApp"; **Configurar** + 👁.
- Drawer: Estado da conexão ●CONECTADO; "Só leitura do estado…"; "**Última gravação no sistema: 12/06/2026, 17:57**"; tabela INSTÂNCIA / ID INSTÂNCIA (`rf9dd9e45ca25F2`) / CONEXÃO / **TOKEN WHATSAPP: "Configurado"** (mascarado) / MODO OPERAÇÃO / AGENTE ATIVO: Sim; botão "Configurar canal na ficha do modelo"; link "Prompt, conhecimento e ferramentas na ficha / wizard".

### C–K (síntese analítica)
- Visual limpo; segurança correta (token nunca exibido). Funcional: a tela é 90% redundante com a ficha do agente — 3 KPIs para 1 registro; a ação real mora em outra tela. **Heartbeat de 19 dias atrás** com status "Conectado" e sem alerta = risco de status-mentira (Integrações diz WhatsApp token **Falta** no ambiente — reforça que "Conectado" aqui é estado gravado, não verificado).
- Botões: Configurar (manter), 👁 (remover — duplica), Atualizar (manter). Inputs: só busca (ok).
- Enterprise: com 50 canais a tela passa a fazer sentido como grid + health; hoje, café pequeno.
- Mobile: cards ok. Psicologia: "Conectado" verde acalma — indevidamente, se o heartbeat está velho.

### L. Problemas — fichas
**CA1 · Status "Conectado" com heartbeat de 19 dias e sem alerta** 🟠 Alta · P1
- Impacto: equipe confia num canal possivelmente morto; leads sem resposta.
- Correção: exibir "visto por último há 19 dias" + badge amarela/vermelha por idade + checagem ativa.
- Mockup: `● Desatualizado — última atividade há 19d [Reverificar]`. B/M.
**CA2 · Tela redundante com a ficha do agente** 🟡 Média · P2 — fundir como aba/card em Agentes IA; manter rota como atalho. M.
**CA3 · Jargão (slug, instância, proxy) sem tooltip** ⚪ Baixa · P3. B.
**CA4 · Contradição com Integrações (token Falta × Configurado)** 🟡 Média · P1 — uma única fonte de verdade de credenciais. M.

### M. Notas
Funciona? Sim (leitura). UX 6,0 · UI 7,5 · IA real 2,0 · Click&Go 7,0 · Utilidade 4,0 · Confiabilidade 5,0 → **Média 5,3**

---

## 08. Tarefas — `/crm/tarefas`

### A/B. Identidade e inventário
- Objetivo: agregador de "Próximas ações" ("O que precisa da sua atenção — vencidas e agendadas em um só lugar"). Botão **Atualizar**; empty state 🎉 "**Nenhuma ação pendente** — Tudo em dia. Quando a IA ou você definir uma próxima ação em um lead, ela aparece aqui." + CTA **"Ir para os leads"**.

### C–K (síntese)
- Empty state exemplar (explica origem do conteúdo + oferece saída). Porém: copy fala só de **lead** e o produto também tem próxima ação em **negócio** (tela 04) — ou a agregação é parcial (lacuna funcional) ou a copy é imprecisa. Sem visão de calendário, filtros ou criação de tarefa avulsa; botão Atualizar manual numa tela que deveria ser live.
- Botões: CTA (manter), Atualizar (automatizar). Inputs: nenhum (falta "criar tarefa").
- Psicologia: 🎉 recompensa o zero — bom.

### L. Problemas — fichas
**T1 · Escopo incerto (lead × negócio)** 🟡 Média · P1 — Correção: agregar ambos e ajustar copy ("em um lead ou negócio"). Impacto: ações de negócio invisíveis ⇒ follow-ups perdidos. B/M.
**T2 · Sem criar tarefa avulsa** 🟡 Média · P2 — Mockup: `[+ Nova tarefa] título · quando · vínculo (opcional)`. B.
**T3 · Sem filtros/agenda (hoje/semana/vencidas)** 🟡 Média · P2. B/M.
**T4 · Nome do menu ≠ título da tela** ⚪ Baixa · P3 — "Tarefas" × "Próximas ações". B.

### M. Notas
Funciona? Sim (estado vazio correto). UX 6,5 · UI 7,5 · IA real 2,0 · Click&Go 8,0 · Utilidade 4,5 (hoje) · Confiabilidade 6,0 → **Média 5,8**

---

## 09. Aprovações — `/crm/aprovacoes`

### A/B. Identidade e estado encontrado
- Objetivo: "Central de Aprovações — 0 pendentes — tudo que precisa da sua decisão". Filtro "Todos (0)".
- **Estado real: MÓDULO QUEBRADO.** Corpo exibe erro cru: **`column hub_aprovacoes.tenant_id does not exist`** + botão "Tentar de novo" (refaz e falha igual).

### L. Problemas — fichas
**AP1 · Migração ausente inutiliza o módulo** 🔴 Crítica · P0
- Tela: Aprovações · Caminho: `/crm/aprovacoes` · Componente: query de listagem · Fluxo: qualquer uso.
- Descrição: coluna `tenant_id` inexistente em `hub_aprovacoes` (migração multi-tenant não aplicada); 100% de falha.
- Impacto: fila de decisões inoperante; aprovadores não trabalham; Usuários: gestores/financeiro.
- Cliques/tempo desperdiçados: todos os que chegam aqui; Carga: alta (beco sem saída).
- Correção: aplicar migração + smoke test por rota no deploy (`SELECT 1` por tabela crítica).
- Mockup pós-fix: lista de cartões "Aprovação de proposta R$150k — [Aprovar] [Rejeitar] [Ver]".
- Complexidade: B (rodar migração) + M (pipeline de verificação). P0.

**AP2 · SQL cru exposto ao usuário** 🟠 Alta · P0
- Impacto: quebra de confiança + reconhecimento de schema (nome real de tabela/coluna) → superfície para ataque; Usuários: todos os que virem.
- Correção: error boundary global ("Não foi possível carregar. Nossa equipe foi avisada — código #X") + log interno (Sentry). Mockup incluído. B. P0.

**AP3 · Header "0 pendentes" durante erro** 🟡 Média · P2 — estado de erro deve zerar/ocultar contadores ("—"). B.

### M. Notas
Funciona? **Não.** Utilidade 0 · Confiabilidade 0,5 → **Média 0,5** (não avaliável em UX além do erro).


---
---

# PARTE III — OPERAÇÕES

## 10. Arquitetura (Projetos) — `/crm/arquitetura`

### A. Identidade
| Objetivo | Pipeline de projetos de arquitetura do briefing à entrega, com handoff automático para obra. |
|---|---|
| Usuário | Arquitetos/coordenação. |
| Frequência | Alta (diária). |
| Importância | Alta — produção. |

### B. Inventário completo
- **Board:** header "Arquitetura · Pipeline global · 1 projetos"; **+ Novo projeto**; busca "projeto, cliente ou có…"; **Editar etapas**; KPIs Entregas hoje 0 · Em aprovação 0 · Atrasados 0 · Entregues/mês 0; kanban (colunas: Novos · Qualificando · Qualificado · Propo… — **vocabulário de VENDAS**), todas "vazio" apesar do contador 1.
- **Drawer "Configurar pipeline"** (via Editar etapas): subtítulo revelador "Arquitetura · **Negócios — Pipeline global**"; toggles ATIVO por estágio (Novos [cinza], Qualificando, Qualificado, Proposta, Negociando, Fechamento, ✓Ganhos, ✗Perdidos); aviso "Desative estágios para ocultá-los no kanban. Registros já nesse estágio mantêm-se até serem movidos."; **Novo estágio** (input) + **Adicionar estágio**.
- **Drawer "+ Novo projeto"** — badge **"Click-and-Go · 3 toques"**: "Que tipo de projeto?" chips 🏠Residencial · 🏢Corporativo · 🛋Interiores · 🔨Reforma + "outras tipologias ▾"; "De quem é o projeto? (opcional)" (busca cliente); Nome do projeto (opcional; auto "Projeto — Residencial"); Área (m²) opcional; **Código (automático) PRJ-2026-####**; rodapé-nota "O projeto nasce em **Briefing**. Você poderá montar o programa, mover de estágio e anexar entregáveis na ficha."; CTA **Criar projeto ✓**.
- **Ficha do projeto** (criado ao vivo: **PRJ-2026-0002**; badges "Sem cliente"/"Sem envio"): 5 abas —
  - **Conversar** (default): "Use o copiloto para criar, mover de estágio, montar o programa ou enviar entregáveis para aprovação **por voz ou texto**. **A IA propõe — você confirma. Nada é alterado sem sua confirmação.**" + botão 🎤 "Falar com o copiloto".
  - **Programa:** "0 ambientes · Total 0m²"; input por VOZ (placeholder '"adiciona suíte master, closet e varanda gourmet…"'); "+ Adicionar ambiente" (catálogo, ex.: Cozinha); vazio orientador.
  - **Funil:** chips **Briefing · Estudo · Anteprojeto · Executivo · Aprovação · ✓Entregue · ✗Arquivado** — "Toque num estágio para mover o projeto. Para renomear/reordenar, use 'Editar etapas' no quadro."
  - **Entregáveis:** contadores "0 aguardando · 0 aprovados · 0 a fazer"; input "Novo entregável (ex.: Executivo – Pav 1)" + ➕; vazio: "Os entregáveis (estudos, anteprojeto, executivo) aparecem aqui por etapa."
  - **Engenharia:** "⏳ Aguardando entrega do projeto — **A obra é gerada ao entregar (ou aprovar) o executivo** do projeto. Estágio atual: •briefing" + **"Marcar como entregue →"**.

### C. Análise visual
- Drawer de criação impecável (chips grandes, código automático visível, promessa de toques). Board sofre do mesmo mal do Kanban de leads: colunas vazias com contador>0.

### D. Análise funcional — o conflito central
- **A ficha usa a máquina de estados CERTA** (Briefing→Entregue). **O board usa a ERRADA** (funil de vendas herdado do "Pipeline global de Negócios" — o próprio subtítulo do drawer confessa). Consequências: projeto criado nasce em "Briefing" (sem coluna correspondente) e o board fica eternamente "vazio"; e **editar etapas ali altera o funil de VENDAS global** a partir de uma tela de projetos — efeito colateral gravíssimo em potencial.

### E. Botão a botão
| Botão | Veredito |
|---|---|
| + Novo projeto | **Manter — benchmark Click&Go do produto** (3 toques comprovados na criação do PRJ-2026-0002). |
| Editar etapas | **Reescopar**: deve editar as etapas DE PROJETO deste módulo; jamais o funil comercial global. |
| Chips de tipologia | Manter. |
| Criar projeto ✓ | Manter. |
| Falar com o copiloto | Manter como entrada; rotular "beta/demo" enquanto IA off. |
| Chips do Funil (ficha) | Manter (mover em 1 toque). |
| + Adicionar ambiente / ➕ entregável | Manter. |
| Marcar como entregue → | Manter — dispara handoff p/ obra; adicionar confirmação com resumo ("isso criará a obra OBR-…"). |

### F. Inputs
| Campo | Veredito |
|---|---|
| Busca de cliente (opcional) | Manter; exibiu "Carregando opções…" perceptível — pré-carregar/debounce. |
| Nome/Área | Opcionais bem pensados (auto-nome). |
| Programa por voz | Grande ideia; **inoperante sem IA/ASR** — hoje é promessa. |
| Novo estágio (config) | Manter no lugar certo (ver E). |

### G. Fluxos e cliques (medidos)
| Fluxo | Cliques | Status |
|---|---|---|
| Criar projeto | **3 toques** (tipologia → Criar ✓ → pronto) | ✅ comprovado (PRJ-2026-0002). |
| Mover estágio (ficha) | 1 | ✅ (aba Funil). |
| Ver projetos no board | — | ❌ invisíveis (binding errado). |
| Gerar obra | 1 (Marcar como entregue) | ✅ arquitetura de processo correta (evento visto no log da Distribuição: "Entrega OBR-2026-0004 gerada · obra (automática ao fechar)"). |

### H. IA First (real)
- Governança modelo ("IA propõe, você confirma") é a melhor formulação do produto. Execução: **não comprovável** (voz/copiloto sem backend de IA). **IA real: 2,5.**

### I. Enterprise
- Multi-projeto por cliente, permissões por etapa, prazos por estágio (SLA) — ausentes; KPIs prontos para isso (Atrasados).

### K. Psicologia
- "3 toques" cria momentum e confiança imediata. Board vazio depois de criar o projeto quebra essa confiança na sequência ("cadê ele?") — dissonância dolorosa exatamente após o pico de satisfação.

### L. Problemas — fichas

**AR1 · Board ligado ao pipeline de VENDAS (projetos invisíveis)** 🔴 Crítica · P0
- Tela: Arquitetura · Componente: kanban do board · Fluxo: acompanhamento de projetos.
- Descrição: colunas do funil comercial; projetos nascem em "Briefing" (taxonomia da ficha) → contador 1, board vazio.
- Impacto: gestão visual de projetos impossível; Usuários: arquitetura inteira.
- Cliques desperdiçados: alternâncias e buscas para achar o projeto (3–6); Tempo: minutos/dia; Carga: alta.
- Correção: bind do board às etapas de projeto (Briefing→Entregue) OU mapeamento explícito; validação contagem×cards em CI.
- Mockup: colunas `Briefing(1) · Estudo · Anteprojeto · Executivo · Aprovação · Entregue`.
- Ganho: board funcional no dia 1. Complexidade: M. P0.

**AR2 · "Editar etapas" altera o funil comercial global de dentro de Arquitetura** 🟠 Alta · P0/P1
- Impacto: um arquiteto pode desativar "Proposta" e quebrar o Kanban de vendas sem saber.
- Correção: config por módulo; se compartilhado, aviso explícito de escopo + permissão.
- Mockup: título do drawer `Configurar etapas — Projetos (Arquitetura)` + banner "isso NÃO afeta o funil comercial". B/M.

**AR3 · KPIs não refletem criação (e "1 projetos")** 🟡 Média · P2 — recontagem live + pluralização. B.
**AR4 · Projeto "Sem cliente" sem nudge posterior** ⚪ Baixa · P3 — badge acionável "Vincular cliente". B.
**AR5 · "Sem envio" sem tooltip** ⚪ Baixa · P3. B.

### M. Notas
Funciona? Parcial (criação/ficha SIM e excelentes; board NÃO). UX 7,5 · UI 8,0 · IA real 2,5 · Click&Go 9,5 · Utilidade 6,5 · Confiabilidade 4,0 → **Média 6,3**

---

## 11. Engenharia (Obras) — `/crm/obras`

### A. Identidade
| Objetivo | Carteira de obras: escopo, avanço, cronograma, compras, financeiro e diário por obra. |
|---|---|
| Usuário | Engenharia/gestor de obras; campo. |
| Frequência | Alta. |
| Importância | Crítica (execução = margem). |

### B. Inventário completo
- **Lista:** "Obras — 4 obras"; abas **Carteira | Hoje**; chips: Todas · ⚠Atenção · 🔴Crítica · Ativas · Planejamento · 🏗Construção · 🔨Reforma · 🛠Serviço; **+ Nova obra**; cards: título ("Negócio — Carlos Mendes"), código OBR-2026-000X, badge "Planejamento", "Sem cronograma ainda", botão **"EAP (frentes)"**.
- **Ficha da obra** (aberta OBR-2026-0001): header título + código + "planejamento" + "Endereço não informado"; **6 abas**:
  - **Escopo** ✅: KPIs TOTAL ORÇADO R$0,00 · CUSTO R$0,00 · MARGEM — · AVANÇO 0%; "Monte o escopo da obra — **Ambiente → disciplina → item**. Comece de um jeito:"; 3 entradas: **✨ Gerar escopo com IA (descreva por voz/texto)** · **+ Ambiente** (ex.: Cozinha) · **+ item** (avulso).
  - **Itens & Avanço** ✅ (estrutura pronta, vazia).
  - **Cronograma** ❌: "⚠ **Obra não encontrada**" + Tentar de novo (dentro da própria obra!).
  - **Compras & Estoque** ⚠️: sub-abas **Solicitações de compra | Estoque**; banner "⚠ Compras & estoque ainda não ativos nesta base (**migração E5 pendente — janela do dono**). A tela fica pronta; os dados aparecem após aplicar a migração."; seção "Solicitações de compra" + **+ Nova SC**; vazio "Nenhuma solicitação ainda. Clique em **Nova SC** para pedir material."
  - **Financeiro** ❌: texto vermelho cru "**Obra não encontrada**".
  - **Painel** ✅: cards **Pedidos de material** ("Nenhum pedido.") · **Check-ins** ("Nenhum check-in.") · **Diário de obra** ("Sem registros.").

### C. Análise visual
- Cards de obra bons (status + pendência "Sem cronograma"). Ficha com abas claras; os dois erros crus em vermelho destroem a percepção de solidez.

### D. Análise funcional
- Origem automática das obras a partir de negócios ganhos (nomes "Negócio — X"; evento no log) é automação REAL e valiosa. ✅
- 2 de 6 abas quebradas por fetch com identificador errado (a obra existe — Escopo/Painel a exibem); +1 aba refém de migração. Ou seja: **metade da ficha da obra não opera**.
- "EAP (frentes)" no card promete estrutura analítica — não explorado a fundo por limitação do ambiente; manter em backlog de teste.

### E. Botão a botão
| Botão | Veredito |
|---|---|
| + Nova obra | Manter. |
| Carteira/Hoje | Manter ("Hoje" = visão de campo — boa ideia). |
| Chips de estado/tipo | Manter. |
| EAP (frentes) | Manter; validar conteúdo em ambiente saudável. |
| ✨ Gerar escopo com IA | Manter como entrada principal; rotular demo enquanto IA off. |
| + Ambiente / + item | Manter. |
| Tentar de novo (Cronograma) | Substituir por correção real do fetch. |
| + Nova SC | Manter (pós-migração). |

### F. Inputs
- Escopo por voz/texto (promessa IA); Ambiente do catálogo; item avulso; Nova SC. Estrutura de entrada boa; validar quando ativas.

### G. Fluxos e cliques
| Fluxo | Status |
|---|---|
| Obra nasce de negócio ganho | ✅ automático (0 cliques). |
| Montar escopo | Estrutura em 1–2 cliques por item ✅ (conteúdo IA off). |
| Ver cronograma | ❌ quebrado. |
| Ver financeiro da obra | ❌ quebrado. |
| Pedir material | ⚠️ bloqueado por migração E5. |

### H. IA First (real)
- Escopo por voz é a killer feature prometida do módulo; sem IA conectada, é botão decorativo. **IA real: 2,5.**

### I. Enterprise
- Multi-obra: filtros por engenheiro/região; permissões de campo (check-in); custos por frente — estrutura parece prevista (EAP), execução pendente.

### K. Psicologia
- "Obra não encontrada" DENTRO da obra gera perplexidade ("eu estou nela!") — mina confiança em toda a ficha.

### L. Problemas — fichas

**EN1 · Abas Cronograma e Financeiro: "Obra não encontrada"** 🔴 Crítica · P0
- Tela: Obras/ficha · Caminho: `/crm/obras/:id` → abas · Componente: fetch das abas · Fluxo: gestão da obra.
- Descrição: 2 abas usam id/rota errada e falham; as demais abas acham a mesma obra.
- Impacto: cronograma e custo — os DOIS pilares de gestão — inacessíveis; Usuários: engenharia/gestão.
- Correção: alinhar parâmetro (uuid × código) nas queries das abas; teste e2e por aba.
- Mockup pós-fix: Cronograma com marcos por etapa; Financeiro com orçado×custo da obra.
- Complexidade: B/M. P0.

**EN2 · Migração E5 pendente trava Compras & Estoque** 🟠 Alta · P0 — aplicar migração; enquanto isso o banner (bom) deve oferecer ação ("Avisar dono/aplicar"). B.
**EN3 · Erro cru em vermelho (Financeiro)** 🟠 Alta · P0 — usar error boundary padrão (mesma correção AP2). B.
**EN4 · "Endereço não informado" sem ação** ⚪ Baixa · P3 — transformar em link "adicionar endereço". B.

### M. Notas
Funciona? Parcial (nascimento automático + escopo estrutural sim; gestão profunda não). UX 7,0 · UI 7,5 · IA real 2,5 · Click&Go 8,0 · Utilidade 6,0 · Confiabilidade 3,5 → **Média 5,8**

---

## 12. Imóveis — `/crm/imoveis`

### A/B. Identidade e inventário
- Objetivo: carteira de imóveis (venda/locação). KPIs 0 Total · 0 Venda · 0 Locação; busca "título, cidade ou bairro"; abas Ativos | Arquivados; toggle **Cards | Tabela**; chips Todos · Venda · Locação; vazio "Nenhum imóvel cadastrado."; **+ Novo**.
- **Drawer "Novo imóvel":** Título*; Cidade / UF; Valor (R$); Tipo chips (Apartamento default · Casa · Terreno · Comercial); Finalidade (Venda default · Locação); **Salvar** / Cancelar.

### G. Fluxo executado (evidência)
- Preenchido "Imovel Teste Auditoria" → **Salvar** → erro exibido CRU no drawer: **`new row for relation "hub_imoveis" violates check constraint "hub_imoveis_status_check"`**. Reproduzível. **Impossível criar imóvel.**

### D/E/F (síntese)
- Form minimalista adequado para MVP, mas **sem fotos, endereço completo, características** — para imobiliário, utilidade baixa mesmo se salvasse.
- Botões: +Novo (manter), Cards/Tabela (manter), Salvar (corrigir). Inputs: valor sem máscara; cidade/UF livres.

### L. Problemas — fichas
**IM1 · Check constraint impede QUALQUER criação** 🔴 Crítica · P0
- Componente: submit → `hub_imoveis.status` default inválido versus constraint.
- Impacto: módulo natimorto (0 registros possíveis); Usuários: imobiliário.
- Correção: alinhar valor default do front com o CHECK do banco (ou migração corrigindo o CHECK); mensagem amigável.
- Mockup pós-fix: card do imóvel criado com badge "Venda".
- Complexidade: B. P0.
**IM2 · SQL cru no formulário** 🟠 Alta · P0 — mesma correção padrão de erros. B.
**IM3 · Modelo raso p/ domínio imobiliário** 🟡 Média · P2 — fotos, endereço, m², quartos/vagas, captação/proprietário; integração com Leads (interesse ↔ imóvel). M/A.

### M. Notas
Funciona? **Não cria.** UX 5,5 · UI 7,0 · IA real 1,5 · Click&Go 6,0 · Utilidade 2,0 · Confiabilidade 1,5 → **Média 3,9**

---

## 13. Pedidos — `/crm/pedidos`

### A/B. Identidade e inventário
- Objetivo declarado: "Pedidos de material — Criar e acompanhar pedidos por obra". Vazio: "Nenhum pedido. Crie o primeiro pedido acima."; **+ Novo pedido**.
- **Modal "Novo pedido":** Descrição* (textarea); Obra (opcional) select "Selecionar obra…"; Cancelar / **Criar**. *(Título do modal praticamente invisível — contraste.)*

### G. Fluxo executado (evidência)
- Criado ao vivo: "Pedido teste auditoria - 10 sacos de cimento CP-II" → **PED-2026-0001** aparece com dropdown de status **"rascunho"**. ✅ Submit saudável.

### D/E/F (síntese)
- Funciona, mas o modelo é raso: **sem itens/quantidade/unidade/preço/fornecedor/prazo** — "pedido" é um bilhete de texto com status. Duplica conceito com "Solicitações de compra" da obra (tela 11).
- Botões: +Novo pedido (manter), dropdown status no card (bom padrão inline). Card não clicável para detalhe.

### L. Problemas — fichas
**PE1 · Redundância com Solicitações de compra da obra** 🟡 Média · P1 — dois nomes para a mesma necessidade; consolidar em um fluxo (na obra), mantendo esta rota como visão agregada. M.
**PE2 · Modelo sem itens/fornecedor** 🟡 Média · P1 — evoluir para linhas de item + cotação; conectar ao financeiro. M/A.
**PE3 · Modal com título ilegível e sem centralização** ⚪ Baixa · P3. B.
**PE4 · Sem toast de sucesso** ⚪ Baixa · P3 — card aparece sem confirmação explícita. B.

### M. Notas
Funciona? Sim (raso). UX 6,0 · UI 6,0 · IA real 1,5 · Click&Go 8,5 · Utilidade 3,5 · Confiabilidade 7,0 → **Média 5,4**

---
---

# PARTE IV — FORNECEDORES (REDE)

## 14. Parceiros — `/crm/parceiros`

### A/B. Identidade e inventário
- Objetivo: funil da rede (captação → homologação → homologados). Tabs **Captação (2) · Homologação (0) · Homologados (5)**; "7 cadastrados · 5 homologados"; filtros (busca, Todos estágios, Todos mercados, Todas UFs, Limpar); tabela NOME · CÓDIGO ("—") · STATUS · ESTÁGIO · ESPECIALIDADE · LOCAL · AÇÕES (👁); **+ Convidar** (mesmo link permanente da tela 05).
- Homologados: 5 escritórios (Conceito Vivo, Studio Áurea, Traço & Forma, Habitat, Loft 7) com badges "Recebe leads" + "Arquitetura" e ESPECIALIDADE (Comercial/Projetos residenciais/Reforma/Paisagismo/Interiores).

### Análise e vereditos (síntese)
- Funil de rede claro e conectado à Distribuição (aderência) ✅.
- **STATUS e ESTÁGIO idênticos em 100% das linhas** (Captação/Interessado; Homologado/Homologado) — uma coluna é ruído.
- CÓDIGO vazio em todos (prometido PAR-2026-#### no convite — não aparece).
- Botões: +Convidar (manter — ótimo), 👁 (manter), tabs (manter). Sem ação de "aprovar homologação" visível na lista (onde mora essa decisão? provavelmente na Central de Aprovações — que está quebrada ⇒ **funil de homologação travado indiretamente**).

### L. Problemas — fichas
**PA1 · Homologação sem ação visível + Aprovações quebrada** 🟠 Alta · P1 — o passo central do funil não tem CTA aqui e o módulo de decisão está fora do ar; parceiro fica preso em "Captação". Correção: CTA "Aprovar/Homologar" na linha + consertar tela 09. M.
**PA2 · Colunas STATUS≡ESTÁGIO** 🟡 Média · P2 — manter só ESTÁGIO (com badge). B.
**PA3 · CÓDIGO sempre vazio** ⚪ Baixa · P3 — exibir PAR-2026-#### gerado no convite. B.

### M. Notas
Funciona? Sim (leitura/convite). UX 6,5 · UI 7,0 · IA real 2,0 · Click&Go 7,0 · Utilidade 6,0 · Confiabilidade 6,5 → **Média 5,8**

## 15. Fornecedores — `/crm/fornecedores`

### A/B. Inventário
- "Mercados habilitam a distribuição de leads · homologação por status (formato da rede Obra10+)."; lista com os MESMOS 5 escritórios da tela 14 + Lucas/"Parceiro 6344" (Pendente); badges "((•)) No motor" + "Aprovado"; **+ Novo fornecedor**.

### Análise (síntese)
- **Mesma entidade da tela Parceiros com outra lente** (motor/aprovação). Duas telas para um cadastro = dupla manutenção e confusão ("onde edito?").
- Badge "No motor" é informação boa (participa da distribuição) — deveria ser coluna/aba dentro de uma tela única de Rede.

### L. Problemas — fichas
**FO1 · Duplicação estrutural Parceiros×Fornecedores** 🟠 Alta · P1 — unificar em "Rede" com abas (Funil | Ativos no motor); redirects das rotas antigas. Ganho: -1 tela, -1 conceito. M.

### M. Notas
UX 5,5 · UI 7,0 · IA 2,0 · C&G 7,0 · Utilidade 4,0 · Confiab. 6,5 → **Média 5,3**

## 16. Especialistas — `/crm/especialistas`

### A/B. Inventário
- "Mão de obra · cadastro interno (**sem login**), identificado por telefone (formato da rede Obra10+)."; vazio orientador; **Convidar (link)** + **+ Novo especialista**.
- **Form inline "Novo especialista":** Nome completo* · Telefone/WhatsApp (com DDD)* · CPF ("evita duplicado") · Cidade · UF (select) · **Especialidades\*** — 20 chips de ofícios (Empreiteiro, Pedreiro, Pintor, Eletricista, Encanador/Hidráulica, Serralheiro, Vidraceiro, Gesseiro/Drywall, Azulejista/Ceramista, Marceneiro, Carpinteiro, Instalador de Ar-condicionado, Soldador, Telhadista, Impermeabilizador, Marmoraria/Granito, Pisos e Revestimentos, Forro/PVC/Drywall, Jardinagem/Paisagismo, Limpeza pós-obra, Ajudante/Servente) com regra "**a 1ª é a principal**" · Tempo de experiência (select) · toggle **Trabalha sozinho | Tem equipe** · Observações · **Salvar especialista** / Cancelar.

### Análise (síntese)
- **Melhor formulário de domínio do produto**: vocabulário real da obra, regra de especialidade principal, dedup por CPF anunciado, sem exigir login do trabalhador (correto para o público).
- Botões/campos: todos justificados; único senão é o form abrir inline empurrando a lista (ok nesta densidade).

### L. Problemas — fichas
**ES1 · Sem validação/máscara visível de fone/CPF** 🟡 Média · P2 — máscara + verificação de dígito. B.
**ES2 · Cadastro poderia ser por voz/foto (público de campo)** ⚪ Sugestão P3 — via copiloto quando IA on. M.

### M. Notas
Funciona? Sim (form; submissão não estressada). UX 7,5 · UI 7,5 · IA 1,5 · C&G 8,0 · Utilidade 7,5 · Confiab. 7,0 → **Média 6,5**

---
---

# PARTE V — FINANCEIRO

## 17. Contas a receber — `/crm/financeiro/receber`
### Síntese verificada
- Estrutura idêntica à tela 18 (filtros Todas · Pendente · Pago · Cancelado · Vencidas · 7 dias; + Novo; CSV; cards com badge e CTA "Marcar recebido"). Vazio no período do teste (lançamento de teste foi "A Pagar").
- Vereditos e problemas espelham a tela 18 (aplicar as mesmas correções). Falta: vínculo a negócio/obra/cliente; recorrência/parcelas; conciliação.
### Notas
UX 6,5 · UI 7,0 · IA 1,5 · C&G 8,0 · Utilidade 6,0 · Confiab. 6,5 → **Média 5,9**

## 18. Contas a pagar — `/crm/financeiro/pagar`

### A/B. Inventário
- "← Visão financeira · Contas a pagar"; chips de filtro (Todas ativa); **+ Novo** · **CSV**; card do lançamento real criado: "Teste auditoria - cimento — R$ 150,00 — PENDENTE — Sem vencimento" + CTA largo **"Marcar pago"**.

### G. Fluxo executado (evidência)
- **"Marcar pago" → toast "⚠ Não foi possível marcar como pago."** — escrita falha; PORÉM este módulo possui toast de erro (**prova de que a infraestrutura de feedback existe** e não é usada nos outros módulos).

### E/F (vereditos)
- Botões: Marcar pago (corrigir backend; manter 1 clique + desfazer), +Novo (manter), CSV (manter). Filtro "7 dias" útil.
- Inputs (modal Novo lançamento — testado na tela 19): tabs **A Pagar | A Receber**; Descrição* (ex. "Fornecedor XYZ, parcela 2/3"); Valor (R$)*; Vencimento (date); **sem vínculo/categoria/recorrência**.

### L. Problemas — fichas
**FI1 · "Marcar pago" falha (escrita quebrada)** 🟠 Alta · P0/P1
- Impacto: fluxo de caixa não atualiza; contas pagas seguem pendentes ⇒ risco de pagamento em dobro.
- Correção: consertar endpoint; sucesso com **Desfazer** (5s). Mockup: `✓ Pago hoje · [Desfazer]`. B/M.
**FI2 · Lançamento órfão (sem vínculo/categoria/recorrência)** 🟡 Média · P1 — campos opcionais Obra/Negócio/Fornecedor + categoria + repetição. M.
**FI3 · "Sem vencimento" aceito silenciosamente** ⚪ Baixa · P2 — nudge de data (contas sem vencimento não entram em "Vencidas"/"7 dias"). B.

### M. Notas
Funciona? Parcial (cria não testado aqui/1-clique quebrado). UX 6,5 · UI 7,0 · IA 1,5 · C&G 8,0 · Utilidade 6,0 · Confiab. 4,0 → **Média 5,5**

## 19. Visão financeira — `/crm/financeiro`

### A/B. Inventário
- Header: **+ Novo lançamento** · **Exportar CSV** · atalhos **Contas a pagar** / **Contas a receber**; banner "✅ Caixa em dia no período — sem vencidos nem vencimentos críticos."
- **CAIXA:** A PAGAR (ABERTO) · A RECEBER (ABERTO) · VENCIDO (pagar R$0 · rec. R$0) · **SALDO PROJETADO** ("receber − pagar (não é saldo bancário)").
- **PIPELINE COMERCIAL (LEITURA):** Receita potencial (leads) R$0 · Receita potencial (negócios) **R$150k** · **"NEGÓCIOS SIT-DOWN 0 — etapa pré-conclusão"** (anglicismo obscuro).
- **APROVAÇÕES FINANCEIRAS:** "Nenhuma aprovação financeira pendente." + link "Ver todas as aprovações →" (**leva à tela 09 quebrada**).
- **PRÓXIMOS VENCIMENTOS** + disclaimer "📈 Valores projetados; confirme no banco antes de pagar ou receber."

### G. Fluxo executado (evidência) ✅ O MELHOR DO PRODUTO
- Criado lançamento A Pagar R$150 → **todos os KPIs atualizaram na hora**: A PAGAR R$150; SALDO PROJETADO **−R$150,00** (vermelho); item listado em Próximos Vencimentos. **Feedback-loop instantâneo e correto.**

### E (vereditos)
- Botões todos justificados; link de Aprovações deve checar saúde do destino (hoje aponta para módulo quebrado).

### L. Problemas — fichas
**VF1 · Link para módulo quebrado (Aprovações)** 🟡 Média · P1 — esconder/flag até correção; ou health-aware link. B.
**VF2 · Jargão "SIT-DOWN"** ⚪ Baixa · P3 — renomear ("Negócios em fechamento"). B.
**VF3 · Banner "Caixa em dia" ignora pendência recém-criada sem vencimento** ⚪ Baixa · P3 — considerar pendências sem data na régua do banner. B.

### M. Notas
Funciona? **Sim** — referência de reatividade. UX 7,0 · UI 7,5 · IA 2,0 · C&G 8,5 · Utilidade 7,0 · Confiab. 7,5 → **Média 6,6**


---
---

# PARTE VI — MARKETING

## 20. Campanhas — `/crm/trafego`

### A/B. Inventário
- Subtítulo "Dados Windsor.ai · Meta Ads · Google Ads"; período **7 dias | 14 dias | 30 dias**; KPIs: **Gasto Total R$ 0,00 (VERMELHO)** · Cliques 0 · CPC Médio R$ 0,00 (âmbar) · Conversões 0 (verde); vazio: "📡 Nenhuma campanha encontrada — Conecte suas contas de anúncios no Windsor.ai" + link **Configurar integrações**.

### Análise (síntese)
- Tela 100% dependente de integração **não configurada** (Windsor.ai = Falta) ⇒ hoje é uma casca. O caminho para resolver (link direto a Integrações) está correto.
- **Semântica de cor invertida:** R$0 de gasto pintado de vermelho (vermelho=problema; gasto zero não é erro; e por que CPC zero é âmbar e conversões zero é verde? Regra de cor por métrica, não por significado).
- Rota `/trafego` × rótulo "Campanhas" (ver G0-4).

### L. Fichas
**MK1 · Cores por métrica, não por significado** 🟡 Média · P2 — definir mapa semântico único (neutro para zero-sem-dado). B.
**MK2 · Sem estado "integração pendente" nos KPIs** ⚪ Baixa · P3 — KPIs deveriam exibir "—" com tooltip "sem fonte conectada", não zeros coloridos. B.

### M. Notas
Funciona? Vazia por design (sem fonte). UX 5,5 · UI 7,0 · IA 1,0 · C&G 7,0 · Utilidade 2,5 (hoje) · Confiab. 5,0 → **Média 4,7**

## 21. Canais de entrada — `/crm/canais-entrada`

### A/B. Inventário
- "Registro das fontes de lead (WhatsApp, Meta, Google, site, indicação). O **origem** aqui é o valor usado nas regras de **Direcionamento**. **Tokens/segredos ficam no servidor (nunca aqui)**; a conexão real do WhatsApp é na ficha do agente."
- Form inline "Novo canal": select tipo (WhatsApp) · Nome (ex.: WhatsApp Ve…) · Identificador (nº/conta/f…) · origem (p/ regras) · observação · **+ Adicionar canal**; vazio: "Nenhum canal registrado. Adicione o 1º acima." (aqui a frase "acima" está CORRETA — o form está acima).

### Análise (síntese)
- Conceito bom: catálogo de origens que alimenta as regras de roteamento (tela 03) — elo de dados coerente.
- Colisão de nome com a tela 07 "Canais" (WhatsApp de agentes) — dois "Canais" com significados diferentes no mesmo produto.

### L. Fichas
**CE1 · Nomenclatura colidente (2× "Canais")** 🟡 Média · P1 — renomear: "Fontes de lead" (esta) × "Conexões WhatsApp" (tela 07). B.
**CE2 · Sem validação de identificador/duplicidade visível** ⚪ Baixa · P3. B.

### M. Notas
UX 6,5 · UI 7,0 · IA 1,5 · C&G 7,5 · Utilidade 5,5 · Confiab. 6,5 → **Média 5,8**

---
---

# PARTE VII — IA E AGENTES

## 22. Agentes IA — `/crm/agentes` (+ ficha `/crm/agentes/:slug`)

### A. Identidade
| Objetivo | Criar/gerir "funcionários de IA": cargo, mercados, personalidade, horário, playbook, canal. |
|---|---|
| Usuário | Owner/gestor. |
| Importância | É a tese central do produto. |

### B. Inventário completo
- **Lista:** "Assistentes, playbooks e configuração por agente"; filtros Todos (3) · Ativos (3) · Inativos (0) · Arquivados (0); select "Todos os segmentos"; busca "nome, slug, cargo ou bio"; **Gerenciar cargos** · **+ Novo agente**; cards: **Mari** (mari — "Agente operado pelo playbook publicado em hub-agent-playbooks (sem catálogo de cargo)." — "Só playbook · 3"), **Will** (will — "Gestão operacional de obras e reformas…" — "Coordenador de Obras · 3"), **TESTE Auditoria – Ana** (teste_auditoria_ana — "Atende lead qualificado e conduz até proposta" — "Atendente de Primeiro Contato · 4"); ações por card: ✏ editar · ⏻ ativar/desativar · **🗑 excluir (direto, sem fricção)**.
- **Ficha (Mari):** header avatar M · "Só playbook @mari" · badges Ativo/playbook/N3; ações **AI — Funcionários** · **Playbook — Calibração** · **Limpar memórias** · **Arquivar**; aviso "Cargo, segmento, nível e modelo são definidos na criação e **não mudam depois**. O agente usa o **modelo de IA padrão configurado no sistema**."; CONFIGURAÇÕES FIXAS (Cargo "Só playbook" · Área "playbook" · Nível N3); CONFIGURAÇÕES EDITÁVEIS: Nome; **Mercados** (8 chips todos ativos); **Personalidade** — 5 pares em escala 1–5: Analítico/Criativo=5 · Formal/Informal=1 · Direto/Detalhista=4 · Conservador/Arrojado=3 · Empático/Objetivo=1; **Horário de atendimento** 08:00–22:00; **Dias da semana** (Dom–Sáb chips); **Bio**; Tom de voz; (mais abaixo: canal/whatsapp, playbook…).

### C/D. Análise
- Modelo mental "funcionário digital com cargo/nível/personalidade" é diferenciador real de produto.
- **Dashboard diz "Modelos IA ativos 2"; aqui há 3 ativos** — mais uma reconciliação quebrada.
- "Limpar memórias" a 1 clique ao lado de "Arquivar" — ação destrutiva de conhecimento sem confirmação forte.
- 🗑 na listagem exclui agente (com playbook e memórias?) — risco alto.

### E. Botão a botão
| Botão | Veredito |
|---|---|
| + Novo agente | Manter (wizard já validado na sessão 1: criou "TESTE Auditoria – Ana"). |
| Gerenciar cargos | Manter (catálogo). |
| ✏ / ⏻ | Manter. |
| 🗑 (lista) | **Trocar por Arquivar**; excluir só na ficha + digitação do nome. |
| Limpar memórias | Confirmação com escopo ("apaga N memórias de X leads — irreversível"). |
| AI—Funcionários / Playbook—Calibração | Manter (não avaliados a fundo — dependem de IA on). |

### F. Inputs
- Sliders de personalidade: excelente formulação (pares semânticos); sugerir presets por cargo.
- Horário/dias: bom; validar timezone com tela 29 (America/Sao_Paulo).

### H. IA First (real)
- Tudo aqui configura um comportamento **que hoje não roda** (sem chave). É um "RH de funcionários que ainda não foram contratados". **IA real: 2,5.**

### L. Fichas
**AG1 · Contagem de agentes divergente do Dashboard (2×3)** 🟡 Média · P1 — mesma fonte/critério ("ativos com canal ligado"?). B.
**AG2 · Exclusão/limpeza destrutivas sem fricção** 🟠 Alta · P1 — confirmações tipadas; soft-delete com undo. B.
**AG3 · "Modelo padrão do sistema" invisível ao usuário** ⚪ Baixa · P2 — exibir qual modelo está configurado (e seu status de chave). B.

### M. Notas
Telas: sim; agente operante: não comprovado. UX 7,0 · UI 7,5 · IA real 2,5 · C&G 7,0 · Utilidade 4,0 · Confiab. 5,0 → **Média 5,5**

## 23. Automações (Ciclos) — `/crm/ciclos`

### B. Inventário
- Header: "Fluxos automáticos e ciclos dos agentes"; contadores **0 ativos** · **3 alertas** (vermelho); **Novo ciclo**; tabs **Ciclos (3) · Logs (7) · Alertas (3)**; filtros Todos(3)/Ativos(0)/Inativos(3); busca.
- Cards (3× "Cadência na agenda" — mari, teste_auditoria_ana, will): "Cadência definida ao criar o agente (≈ cada 60 min após dispatch e ativação)"; **"Última exec.: nunca · — · 7 exec."** (mari) / "0 exec." (demais); estado "programado · nunca executado"; ações ▶(desabilitado) ✏ ↺ ⏻ 🗑.
- **Alertas:** 3× "importante — diretor_geral_ia — **Novo interesse de parceiro via WhatsApp** — Lucas perguntou sobre parceria: 'Eu quero me cadastrar'" (37d/43d atrás) + 1 de número 554330326344 (43d) · botões **Resolver**.

### Análise
- Contradição interna no card (nunca × 7 exec.); tudo inativo; alertas parados >1 mês com CTA "Resolver" que ninguém usou. A automação — segunda tese do produto — está **desligada e com dívida operacional**.

### L. Fichas
**AU1 · 0 ciclos ativos + alertas de 37–43 dias** 🟠 Alta · P1 — ativar cadências reais (pós-IA) e criar SLA de alerta (escala para humano após X dias). M.
**AU2 · Contradição "nunca · 7 exec."** 🟡 Média · P2 — corrigir agregação/labels; exibir última execução real. B.
**AU3 · 🗑 excluir ciclo sem confirmação** 🟡 Média · P2 — confirmar. B.
**AU4 · Ator "diretor_geral_ia" sem página/explicação** ⚪ Baixa · P3 — glossário de atores de IA. B.

### M. Notas
UX 6,0 · UI 7,0 · IA real 2,0 · C&G 6,5 · Utilidade 3,0 (nada roda) · Confiab. 3,0 → **Média 4,6**

## 24. Ferramentas IA — `/crm/ferramentas`

### B. Inventário
- "Ferramentas IA (Hub) — Catálogo **built-in** mais ferramentas **custom** do tenant (nome e descrição próprios, mesma execução segura; opcional smart Mistral/Gemini). Ativar por agente em **Modelos**." Header: **Gerenciar custom + IA** · "3 agentes ativos".
- Seções: **Dados do cliente nesta conversa** — cards: *Resumo do cliente (lead)* [SÓ LEITURA · Sugerido WhatsApp · `hub_lead_resumo`] "Consulta estágio, dados de contacto e responsáveis no CRM…" (ATIVA em 1: Mari); *Memórias sobre o cliente* [SÓ LEITURA · `hub_lead_memorias`] (Mari); *Consultar lead por telefone* [SÓ LEITURA · `hub_lead_lookup_por_telefone`] "**só do telefone desta conversa** (isolamento)…" (0 ativos); *Menu WhatsApp (botões, lista, enquete ou carrossel)* [**ESCRITA** · `hub_whatsapp_menu`] "(rede finita OpenAPI: /send/menu e /send/carousel)" (Mari). **Análise e partilha** — *Métricas rápidas do escritório* [SÓ LEITURA · `hub_metricas_escritorio`] (0); *Página HTML + link público* [ESCRITA · `hub_relatorio_html_simples`] "Gera página HTML simples (título + texto em segurança), guarda no armazenamento e devolve um URL para abrir noutra janela." (0).

### Análise
- **Governança de ferramentas por agente com rótulo leitura/escrita é arquitetura de segurança acima da média** — manter como está de conceito.
- Riscos: `hub_relatorio_html_simples` gera **link público** — sem expiração/escopo descritos; jargões (slug, OpenAPI) e pt-PT ("partilha", "contacto", "noutra") na UI.

### L. Fichas
**FE1 · Link público gerado por ferramenta sem política visível** 🟠 Alta · P1 — expiração, escopo, listagem/revogação de links. M.
**FE2 · Terminologia técnica exposta** ⚪ Baixa · P2 — descrever por benefício; detalhes técnicos em tooltip. B.

### M. Notas
UX 7,0 · UI 7,5 · IA real 2,5 · C&G 7,0 · Utilidade 4,0 (sem execução) · Confiab. 5,5 → **Média 5,6**

## 25. Carteira de Tijolos — `/crm/creditos`

### B. Inventário
- "Tijolos 🧱 — a moeda de IA do Obra10+. Cada ação da IA consome Tijolos."; card CARTEIRA: "**Em modo de medição** — sem compras ainda. Os Tijolos consumidos aparecem ao lado."; CONSUMIDO (RECENTE): "**0** Tijolos nas últimas 0 ações de IA"; EXTRATO: "Nenhum consumo ainda. Assim que a IA gerar algo (atendimento, relatório, cronograma…), aparece aqui."; botão Atualizar.

### Análise
- Modelo de monetização transparente e bem explicado. Coerente com IA off: consumo 0. Título da topbar "Creditos" sem acento; "nas últimas 0 ações" (frase estranha no zero).

### L. Fichas
**TJ1 · Sem simulador/preços visíveis ao usuário final** 🟡 Média · P2 — tabela "o que custa 1 atendimento/proposta" (a matriz existe na tela 26, mas é super-admin). B.
**TJ2 · Microcopy do zero** ⚪ Baixa · P3 — "Nenhuma ação de IA ainda." B.

### M. Notas
UX 6,5 · UI 7,0 · IA 2,0 · C&G 7,5 · Utilidade 4,0 · Confiab. 6,0 → **Média 5,5**

## 26. Precificação & IA — `/crm/precificacao`

### B. Inventário (visto como OWNER!)
- Subtítulo-confissão: "**Configuração de negócios (super-admin)**: valor do Tijolo, margem, câmbio e preços por modelo."
- Moeda & margem: Nome da moeda "Tijolos" · **Valor do Tijolo (R$) 0,1** · **Markup (×) 10** · Câmbio USD→BRL 6 · Modo "Pré-pago (hard-cap)" · Alerta de saldo baixo 50; exemplo: "ação típica · claude-fable-5 — **Custo real R$ 0.2100 · cobra 21 Tijolos (R$ 2.10) · margem R$ 1.89**"; **Salvar configuração**.
- **Preços por modelo (USD/1M tokens)**, todos com Input/Output editáveis + checkbox Ativo + **Salvar** por linha: claude-fable-5 TURBO (10/50) · claude-haiku-4-5 (1/5) · claude-opus-4-8 (5/25) · claude-sonnet-4-6 (3/15) · mistral-large-latest ECONÔMICO (2/6) · mistral-small-latest (0,2/0,6).

### Análise
- Tela em si é bem construída (exemplo de margem didático). O problema é **quem a vê**: o cliente (owner do escritório) enxerga e EDITA markup, custo real e margem da plataforma — vazamento comercial e vetor de fraude de preço.

### L. Ficha
**PR1 · Tela super-admin exposta e editável ao OWNER** 🔴 Crítica (RBAC) · P0
- Impacto: (a) cliente vê que paga 10× o custo; (b) pode alterar precificação; (c) desconfiança comercial.
- Correção: guard server-side por papel; para owner, no máximo tabela de preços de consumo (sem custo/margem).
- Mockup (owner): `Tabela de consumo: atendimento ≈ 21🧱 · proposta ≈ 35🧱` (sem custo/margem). Complexidade: B/M. P0.

### M. Notas
Funciona? Sim — **para a pessoa errada**. Confiab./segurança 2,0 → **Média 4,0**

## 27. Integrações — `/crm/integracoes`

### B. Inventário
- "Estado real das credenciais no ambiente." Cards: **WhatsApp** (Canais e inbox) — *Não configurado* — "Defina `UAZAPI_BASE_URL` e `UAZAPI_INSTANCE_TOKEN`" [Configurar]; **Windsor.ai** — *Não configurado* — "Adicione `WINDSOR_API_KEY` no ambiente" [Configurar]; **IA (Anthropic / Mistral)** — *Não configurado* — "`ANTHROPIC_API_KEY` ou `MISTRAL_API_KEY`" [Configurar]; **Meta Ads** — *Em breve* ("OAuth previsto em fase posterior"); **Google Ads** — *Em breve*; **Google Analytics 4** — *Em breve*.

### Análise
- **A tela mais honesta do produto** — e a prova documental do critério deste laudo (IA/WhatsApp/Ads desconectados). Vereditos: manter como health-check central; porém expõe **nomes de variáveis de ambiente** ao owner (informação de infra) e conflita com telas que dizem "Conectado/Configurado" (07) e "Modelos ativos" (01).
### L. Fichas
**IN1 · Divergência de status entre telas (Falta × Configurado/Ativo)** 🟠 Alta · P0 — única fonte de verdade de credenciais + health-check propagado (Dashboard, Canais, Agentes). M.
**IN2 · Env vars expostas a não-devs** 🟡 Média · P2 — instruções técnicas atrás de "ver instruções para desenvolvedor". B.
### M. Notas
UX 7,0 · UI 7,5 · Utilidade 8,0 (diagnóstico) · Confiab. 8,0 → **Média 7,6**

## 28. Copiloto (página) — `/crm/agentes-reais`

### B. Inventário
- "Copiloto — IA operacional global — orquestração de fluxos, playbooks e ciclos"; card **Copiloto de Voz**: "O botão verde flutuante aparece em **qualquer tela**… **Arraste para onde não atrapalhe.** Toque, fale, e ele entende — sempre mostrando a transcrição ao vivo e confirmando antes de agir."; **Como usar**: "Toque para falar (1 toque inicia; toque de novo ou 3s de silêncio para parar)" · "Veja em tempo real (transcrição na hora; ex.: «resumo deste lead», «métricas do escritório»)" · "Confirma antes de mudar (Perguntas respondem direto. **Ações que alteram dados sempre mostram o que vão fazer e pedem sua confirmação.**)"; **Últimos comandos**: "Nenhum comando ainda…"

### Análise
- Documentação de produto exemplar (regras de segurança de ação por voz bem definidas). Mas: transcrição/execução **não comprovadas** (IA off; "Últimos comandos" vazio); o recurso-chave (arrastar) só é revelado AQUI — ninguém lê esta página antes de sofrer com o FAB.
### L. Fichas
**CP1 · Capacidades anunciadas sem backend ativo** 🟠 Alta · P0 (honestidade) — estado "demo/desconectado" visível no próprio FAB. B.
**CP2 · Descoberta do arraste** 🟡 Média · P2 — dica no 1º hover (ver G0-1). B.
### M. Notas
UX doc 6,5 · UI 7,5 · IA real 2,0 · Utilidade 4,0 · Confiab. 5,0 → **Média 5,0**

---
---

# PARTE VIII — ADMINISTRAÇÃO E ANALÍTICOS

## 29. Configurações (Geral) — `/crm/configuracoes`
### B. Inventário
- "Regras operacionais sem precisar de programador — Ambiente, follow-up e horário comercial".
- **Ambiente e integrações** (badge "Atenção"): grade de credenciais com status — Supabase URL **OK** · Supabase anon key **OK** · **Supabase service role OK** · Chave API interna **Falta** · Segredo dos ciclos **Falta** · Segredo do webhook WhatsApp **Falta** · MISTRAL_API_KEY **Falta** · Anthropic API key **Falta** · GROQ_API_KEY **Falta** · WhatsApp base URL **Falta** · WhatsApp token da instância **Falta** · Tenant padrão server **OK** · Windsor.ai **Falta**.
- **Horário comercial** (Início 08:00 · Fim 18:00 · Fuso America/Sao_Paulo · "Guardar horário" · "(requer admin)").
- **Distribuição de leads**: "IA sugere parceiro após qualificação; gestor valida em Leads → Encaminhamentos pendentes." ✔ "Sugestão automática ativa (deste escritório)" · Prazo validação humana (horas): 24 · "Guardar distribuição".
- **Cadência de follow-up**: "Horas entre cada passo do follow-up automático." — por mercado: "arquitetura · passo 1: 2h" (…).
### Análise
- Conteúdo útil e bem organizado; PORÉM exibir **status de service role/segredos** ao owner é informação de infraestrutura (reconhecimento) — pertence a super-admin/devops. Horários daqui (08–18) × agente Mari (08–22): duas fontes de horário sem hierarquia explicada.
### L. Fichas
**CF1 · Painel de segredos visível ao owner** 🟠 Alta · P0 (RBAC) — mover bloco "Ambiente" para super-admin; owner vê só "IA conectada: sim/não". B/M.
**CF2 · Duas fontes de horário (sistema × agente) sem regra clara** 🟡 Média · P2 — documentar precedência na própria UI. B.
### M. Notas → **Média 6,0** (útil, com vazamento de infra).

## 30. Contatos de Notificação — `/crm/contatos`
- "Quem recebe alertas de novos leads e aprovações"; vazio "Nenhum contato configurado…"; **+ Adicionar**.
- **Estado real: QUEBRADA** — toast persistente: **`column hub_contatos_notificacao.tenant_id does not exist`**.
### Ficha
**CN1 · Migração ausente (mesma família da tela 09)** 🔴 Crítica · P0 — idem AP1/AP2 (migração + error boundary). Enquanto isso, alertas do sistema **não têm destinatários configuráveis** — risco operacional silencioso.
### Notas → **Média 0,5**.

## 31. Usuários & Permissões — `/crm/usuarios`
### B. Inventário
- "Colaboradores da equipa — permissão e empresa na criação"; aviso "não confundir com Cadastros de clientes (Vendas)"; **Convidar colaborador**; tabela (19 linhas): NOME (para a maioria, repete o e-mail) · E-MAIL · EMPRESA (Obra10+) · PERMISSÃO ("commercial" minúsculo; "Owner · fixo" ×3 — Ariane OT, Nice, Ramon; dropdown "Gestor / Admin" na linha "Administrador") · STATUS (ATIVO/INATIVO).
### Análise
- Base funcional ok; **3 owners fixos** (sem trilha de por quê); papel "commercial" sem descrição de escopo; sem 2FA/último acesso/logs por usuário; e-mails de teste (tel-…@esp.obra10.app, @teste.com) misturados — higiene.
### L. Fichas
**US1 · RBAC raso (papéis sem matriz de permissões visível)** 🟠 Alta · P1 — matriz papel×módulo×ação; descrição no dropdown. M.
**US2 · Sem 2FA/último login/auditoria por usuário** 🟠 Alta · P1. M.
**US3 · NOME duplicando e-mail** ⚪ Baixa · P3 — pedir nome no convite. B.
### Notas → **Média 6,0**.

## 32. Escritórios — `/crm/empresas`
### B. Inventário
- "Instalações multi-empresa — admins e colaboradores por tenant"; "Escritórios Obra10+ — cada escritório com seus admins e colaboradores próprios."; **+ Novo escritório**; tabela: Obra10+ · slug obra10 · **Ativa** · botão vermelho **Desativar**.
### Análise
- Gestão de TENANTS acessível ao owner com **Desativar a 1 clique, sem confirmação** — pode derrubar a própria operação (ou, num multi-tenant real, a de terceiros). Tela pertence a super-admin.
### Ficha
**EM1 · Desativar tenant 1-clique/OWNER** 🔴 Crítica (RBAC) · P0 — mover a super-admin; confirmação tipada + janela de reversão. B.
### Notas → **Média 4,5** (funciona; perigosa).

## 33. Analytics — `/crm/analytics` · Relatórios — `/crm/relatorios`
### B. Inventário
- **Analytics:** "KPIs e tendências — 24h"; períodos 24h · 7 dias · 30 dias; **Atualizar KPIs**; corpo permaneceu em "**Carregando métricas…**" (>8s no teste; sem skeleton/erro).
- **Relatórios:** "Exportáveis em CSV e análises operacionais — Consulta operacional na tela — dados reais do Supabase"; RESUMO OPERACIONAL: Funil de conversão **75% qualificação** ("2 leads hoje; 0% encaminhamento") · Atendimento **0 mensagens na fila** ("8 leads aguardando ação") · Receita em risco **R$ 0** · Rede de parceiros **5 parceiros ativos** ("0 encaminhamentos hoje") · Auditoria de decisões **0 pendentes** ("0 KPIs fora da meta nas últimas 24h"); rodapé "**Fonte: `/api/crm/metricas`**"; **Detalhamento** com tabs **Leads · Negócios · Empresas · Imóveis · Financeiro** + Atualizar; tabela Leads (8 "registo(s)"): Código · Nome · Telefone · E-mail (lead+leads_imb_12@dev.obra1…) · Origem (whatsapp/google_ads) · Estágio (novo/encaminhado/aguardando_resp…).
### Análise
- Relatórios entrega leitura honesta do banco (bom para auditoria interna) — mas expõe **endpoint técnico** no rodapé e e-mails de DEV; "75% qualificação" contradiz o Dashboard ("100%"/funil 0) — de novo, fontes divergentes. Analytics sem conteúdo observável = não avaliável além do estado de carga.
### L. Fichas
**AN1 · Analytics preso em "Carregando…" sem timeout/skeleton/erro** 🟠 Alta · P1 — skeleton + timeout com retry. B.
**AN2 · Mais uma fonte de % divergente (75 × 100 × 0)** 🟠 Alta · P0 — unificar em `/api/crm/metricas` como fonte única e usar nas 3 telas. M.
**AN3 · Vazamento de detalhes técnicos (endpoint, e-mails dev)** ⚪ Baixa · P2. B.
### Notas → **Média 5,0**.


---
---

# PARTE IX — CONSOLIDAÇÃO TRANSVERSAL

## 9.1 Ranking priorizado das melhorias (consolidado das fichas, 80 itens)

**P0 — Bloqueadores de uso/verdade (14)**
1. AP1/CN1 — Migrações `tenant_id` (Aprovações, Contatos) — destrava 2 módulos.
2. IM1 — Constraint `hub_imoveis_status_check` — destrava criação de imóveis.
3. N1 — `POST /negocios` 500 — destrava criação de negócios + rascunho local.
4. EN1 — Fetch das abas Cronograma/Financeiro da obra.
5. EN2 — Migração E5 (Compras & Estoque).
6. L1 — Feedback do 409 de lead duplicado (inline + mesclar).
7. AP2/EN3/IM2 — Error boundary global: NUNCA SQL cru; toast padrão + ID.
8. L3 — Unificação/mapeamento das duas máquinas de estado (causa-raiz).
9. L2 — Render do Kanban de Leads (contagem=cards).
10. AR1 — Board de Arquitetura ligado às etapas de projeto.
11. D2/CP1/IN1 — Verdade sobre IA: health-check único propagado; sem "IA ativa" com chave faltando.
12. PR1 — RBAC: Precificação fora do owner.
13. EM1 — RBAC: Escritórios/Desativar tenant fora do owner + confirmação.
14. CF1 — RBAC: painel de segredos fora do owner.

**P1 — Alto impacto (20)**
15. D1/AN2 — Fonte única de métricas (Dashboard/Leads/Relatórios).
16. N2 — Regra ganho/perdido ⇒ fechado.
17. N3 — Aba "Todos" em Negócios.
18. FI1 — Consertar "Marcar pago" (+Desfazer).
19. DI1 — Cooldown/idempotência do auditor (cobranças 6×).
20. DI2 — Dry-run/confirm em "Rodar auditor" e "Liberar".
21. AU1 — SLA/escalonamento de alertas (37–43d) + ativar ciclos (pós-IA).
22. AG2 — Fricção em excluir agente/limpar memórias.
23. US1/US2 — Matriz RBAC + 2FA/último acesso.
24. CA1/CA4 — Heartbeat com idade visível + fonte única de credenciais.
25. G0-2 — FAB recua sob composer (Enviar livre).
26. G0-1 — Tooltip do copiloto: hover/1ª visita apenas.
27. A2 — Header do chat com posições fixas.
28. PA1 — CTA de homologação no funil de parceiros.
29. FO1 — Unificar Parceiros+Fornecedores ("Rede").
30. CE1 — Renomear os dois "Canais".
31. T1 — Tarefas agrega leads+negócios.
32. FE1 — Política de links públicos (expiração/revogação).
33. C2 — Origem default "Manual" no cadastro manual.
34. AN1 — Analytics: skeleton+timeout+erro.

**P2 — Médio (24)**
35. L4 · 36. L6 · 37. N5 · 38. N6 · 39. C1 (i18n pt-BR global) · 40. C3 · 41. C4 · 42. DI3 · 43. DI4 · 44. DI5 · 45. A3 · 46. T2 · 47. T3 · 48. AR3 · 49. FI2 · 50. FI3 · 51. MK1 · 52. CE2 · 53. AG1 · 54. AG3 · 55. AU2 · 56. AU3 · 57. FE2 · 58. TJ1 · (+CF2, CA2, IM3, PE1, PE2 = 24 itens)

**P3 — Acabamento (22)**
59–80. D4, D5, L5, L7, L8, N4, N7, C5, C6, A4, CA3, T4, AR4, AR5, EN4, PE3, PE4, MK2, CE2b, TJ2, US3, AN3 + pluralizações/acentos ("Creditos", "1 projetos", "SIT-DOWN").

## 9.2 Inventário-resumo de botões por veredito
- **Manter (referências):** Atender→/Abrir→/Ver→ (Dashboard); Responder→WhatsApp; Qualificar e direcionar; chips de etapa; Definir ação; Assumir/Devolver à IA; + Novo projeto (3 toques); Marcar como entregue→obra; + Convidar (link permanente); Copiar telefone/link; Marcar pago (padrão 1-clique, corrigir backend); Exportar CSV.
- **Automatizar/remover:** Atualizar (Dashboard/fila/Tarefas — dados live); tooltip fixo do copiloto.
- **Mover/reescopar:** Configurar pipeline (fora de Leads/Arquitetura → admin por módulo); "Mão de obra" (link explícito); FAB "+" (recuo contextual); Precificação/Escritórios/Segredos (→ super-admin).
- **Simplificar/unificar:** Ver ficha+Info (chat); 👁 de Canais; buscas duplicadas; STATUS×ESTÁGIO (Parceiros); Leads topbar×menu.
- **Adicionar fricção (destrutivos):** 🗑 cadastro/agente/ciclo; Limpar memórias; Desativar tenant; Liberar fornecedor.
- **Corrigir para funcionar:** Salvar negócio; Salvar (imóvel); Marcar pago; Tentar de novo (Aprovações/Cronograma — substituir pela correção real).

## 9.3 Fluxos — antes/depois (síntese de todos os medidos)
| Fluxo | Hoje (medido) | Otimizado proposto |
|---|---|---|
| Responder lead urgente | 1 clique ✅ | manter |
| Criar lead | 4 cliques; 409 mudo | 4 cliques com dedup inline; (IA on) por voz: 0 telas |
| Criar negócio | 8–10 cliques → **500** | corrigir; salvar mínimo na etapa 1 (3 cliques); IA pré-preenche |
| Mover etapa | 1 clique + reload | 1 clique otimista |
| Criar projeto | **3 toques** ✅ | manter (benchmark) |
| Projeto→Obra | 1 clique ✅ | manter + confirmação com resumo |
| Escopo da obra | estrutura ✅/conteúdo IA off | (IA on) por voz: ditar ambientes |
| Pedir material | bloqueado (E5) | destravar migração; SC com itens |
| Criar lançamento | 3–4 cliques ✅ KPIs reativos | vincular obra/negócio (+1 select) |
| Marcar pago | 1 clique → erro | 1 clique + Desfazer |
| Assumir/Devolver chat | 1+1 cliques ✅ | manter; rascunho IA ao assumir |
| Homologar parceiro | sem CTA + tela quebrada | CTA na linha + Aprovações vivas |
| Auditar rede | 1 clique sem preview | dry-run + confirmar |

## 9.4 Riscos de segurança/governança (consolidado)
1. RBAC: Precificação (PR1), Escritórios (EM1), Segredos (CF1) expostos ao owner.
2. SQL cru em 4 pontos (Aprovações, Contatos, Imóveis, Financeiro da obra).
3. Links públicos de IA sem política (FE1).
4. Ações externas sem confirmação (auditor/cobranças, liberar fornecedor).
5. Sem 2FA/auditoria por usuário (US2).

## 9.5 Dívida de honestidade do produto (IA)
- Rótulos a corrigir enquanto a IA estiver off: "Modelos IA ativos", "IA ativa" (chat), "score", "Memórias IA", ator "ia_auditor", "Copiloto entende voz". Regra única: **status de IA deriva do health-check das integrações** e cada rótulo exibe o fallback "demonstração" quando desconectada.

## 9.6 Plano de evolução (reafirmado com base nas fichas)
- **Fase 1 (1–3 semanas):** todos os P0 → produto "não mente e não quebra". Meta: Confiabilidade 3→7; Média geral ~4,8→~6,2.
- **Fase 2 (1–2 meses):** P1 + i18n + unificações (Rede, Canais, Tarefas) + RBAC matriz + mobile real. Meta: UX 6→7,5; DS 5,5→7,5.
- **Fase 3 (3–6 meses):** IA conectada de ponta a ponta (voz→escopo, auto-qualificação, propostas, briefing diário), automações com SLA, explicabilidade. Meta: IA real 2–3→8+; Média geral → 8–9.

---

## ENCERRAMENTO

Este laudo detalhado substitui a versão resumida anterior. Ele mantém o veredito imparcial — **média geral ≈ 4,8–5,0 no estado atual** — e o fundamenta tela a tela, botão a botão, com evidência de rede e fluxo executado. A distância entre a nota de hoje e um 8–9 não está na visão (que é excelente) e sim em: (1) consertar o que quebra, (2) dizer a verdade sobre a IA até conectá-la, (3) reduzir redundâncias que confundem, e (4) proteger o que é sensível. Tudo isso é executável com o plano de 3 fases acima.

*Fim do laudo detalhado — 33 telas + shell global · 80 melhorias priorizadas · 30+ fichas completas de problema.*
