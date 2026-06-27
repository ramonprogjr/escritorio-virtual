# 🤖 Auditoria + Redesenho — Agentes de IA (criação e inteligência)

> Auditoria técnica (mapa do código real) + proposta de funcionamento, telas, botões e opções. 27/jun/2026. Conecta com [[visao-ia-first-comando-multimodal]] (rails+IA, presets) e [[creditos-ia-metering-visao]] (Tijolos).

## A tese do dono (validada)
"A IA opera o sistema, mas criamos **agentes para tarefas específicas** com **presets** (comportamento, conduta, processo pré-fixados). Ex.: agente que atende uma campanha do Google; agente de contratos; agente de financeiro. Isso **economiza tokens** e é mais eficiente."

**Veredito: certo, e é o caminho.** O preset é a **instrução fixa gravada no sistema** que o LLM só **lê e ajusta ao pedido** — em vez de re-raciocinar do zero. Um agente especialista (prompt curto + ferramentas certas + playbook do processo) gasta **menos tokens** e erra menos que um generalista. É o "rails + IA" aplicado ao agente.

## Auditoria honesta (o que já existe — ~60% pronto)

### ✅ Sólido / reusável
- **Schema multi-tenant** (`hub_agente_identidade` + memórias + RAG docs + cargos) com `tenant_id`.
- **Engine de 10 etapas** (`lib/ia/engine.ts`): roteia → monta prompt (preset + regras + memória) → chama LLM → **tool-calling REAL** (function-calling Mistral, não toggle manual) → loga → debita Tijolos.
- **9 ferramentas built-in** com **isolamento por telefone/lead** (resumo do lead, memórias, atualizar lead, criar cadastro, nota, menu WhatsApp, métricas, relatório). Tool-calling de verdade: o LLM decide.
- **Metering Tijolos** já plugado no engine (Fase 1, sombra).
- **Playbook runtime** (markdown → flow-engine) existe — o "processo pré-fixado".

### 🔴 Dívida técnica (consertar, não jogar fora)
1. **3 modelos definidos, 0 usados:** `modelo_padrao / modelo_critico / modelo_alto_valor` existem no banco mas o engine **sempre usa o padrão**. A escalação (barato→robusto por valor/criticidade) **não está implementada**. ISSO É EXATAMENTE O QUE O DONO QUER (Mistral barato × Claude pesado) → **implementar**, não remover.
2. **Presets hardcoded em TypeScript** (MARI_CONFIG, FLUXO_IMOBILIARIO em `agentes-config.ts`) — não dá pra criar "agente por tarefa" sem código. Falta **playbook/preset em banco**.
3. **Matriz de personalidade explosiva:** 5 personalidades × 5 níveis = **5^5 ≈ 3.125 presets**. Inútil (ninguém configura, o LLM não distingue nuance tão fina). **Enxugar.**
4. **Memória frágil:** extração por regex (6 padrões), sem feedback loop, sem embeddings de memória. A extração via LLM existe no código mas **não é chamada** pelo engine.
5. **RAG criado mas não ligado:** tabelas de documentos/chunks/embeddings existem, mas o engine **não busca** os chunks na hora de responder. (O "ler o projeto e responder" depende disso.)
6. **Possível over-engineering:** sync com Mistral Agents API (o que ela dá além de chat+tools?); provisão de `hub_ciclos_ia` para agente de WhatsApp (que usa webhook, não cron).

## Proposta — funcionamento correto

### Princípio: agente = TAREFA + CONHECIMENTO + FERRAMENTAS + PROCESSO + MODELO + um fino de PERSONALIDADE
A personalidade é a **camada fina**; o valor está em o que o agente **sabe, pode fazer e o processo que segue**. Hoje a UI super-indexa personalidade e sub-indexa o resto. Inverter.

### Matriz de comportamento — fix do 5^5 (resposta direta ao dono)
Trocar a explosão combinatória por **2 eixos × poucos níveis** (o "5×5" que o dono propôs, com teto):
- **Eixo COMPORTAMENTO (como pensa/age):** 5 opções nomeadas (ex.: Acolhedor · Consultivo · Direto/Closer · Técnico · Formal). Escolhe **1**.
- **Eixo CONDUTA (como se expressa):** 5 opções (ex.: Conciso · Detalhado · Proativo · Cauteloso · Empático). Escolhe **1**.
- Resultado: **5×5 = 25 combinações** nomeadas e compreensíveis (não 3.125). Cada combinação vira **um fragmento de prompt curto e fixo** (preset). Sem "níveis de 1 a 5" por eixo.
- Opcional avançado: 2-3 **dials** (formalidade, tamanho de resposta) só pra quem quiser afinar. Default = não aparece.

### Telas, botões e opções

**1. Lista de Agentes (`/crm/agentes`)** — hub
- Cards por agente: avatar, nome, **tarefa/cargo**, selo de saúde (Ativo · respondeu há Xh · 0 erros), **Tijolos consumidos (7d)**, canal.
- Botões por card: **Conversar (testar)** · **Editar** · **Ligar/Desligar** · **Métricas**.
- Topo: **+ Novo agente** (abre o wizard enxuto).

**2. Wizard "Novo agente" — reordenado por VALOR (6 passos, era 8):**
1. **Tarefa do agente** — escolhe um preset de tarefa (Atendimento · Campanha (Google/Meta) · Contratos · Financeiro · Compras · Suporte…) **ou** descreve em 1 frase ("atende leads da campanha X"). Isso pré-carrega prompt-base + ferramentas + playbook sugeridos. *(É o "preset" do dono.)*
2. **Conhecimento** — o que o agente sabe: **upload de documentos** (RAG: PDF/planta/tabela de preços) + **fatos-chave** (campos fixos que o LLM lê). *(Ex.: lista de produtos/preços do fornecedor para orçar.)*
3. **Ferramentas** — o que ele PODE fazer: toggles claros em linguagem de negócio (Consultar lead · Atualizar cadastro · Criar pedido · Gerar relatório · Enviar no WhatsApp…). Já vêm marcadas as recomendadas pela tarefa.
4. **Comportamento & conduta** — a matriz **5×5** (1 comportamento + 1 conduta). Preview do tom em 1 frase de exemplo.
5. **Modelo (custo × robustez)** — **Econômico (Mistral)** padrão; **Turbo (Claude)** para tarefas pesadas; opção "usar Turbo só em lead de alto valor / tarefa crítica" → **liga o `modelo_critico`/`modelo_alto_valor` que hoje é morto**. Mostra impacto em Tijolos.
6. **Canal & gatilho** — onde atua: WhatsApp (ao vivo) · Interno (sob demanda/comando) · Programado.
- Botão final: **Criar e testar** (já abre o "Conversar" pra validar na hora).

**3. Editar agente (`/crm/agentes/[slug]`)** — mesmas seções em abas + **playbook visual** (passos do processo) + métricas (Tijolos, taxa de resolução, escalações).

**4. "Conversar/testar"** — sandbox pra mandar mensagem e ver a resposta + quais ferramentas a IA chamou + Tijolos gastos. É como o dono valida o preset antes de soltar.

## Consertos de engenharia que destravam tudo (ordem)
1. **Implementar a escolha de modelo** (padrão × crítico × alto_valor) no engine — destrava custo×robustez (Mistral/Claude) que o dono quer e que já tem colunas.
2. **Playbook/preset de tarefa em banco** (`hub_playb/templates`) + link no agente → criar agente por tarefa sem código.
3. **Ligar o RAG no engine** (buscar chunks na hora de responder) → habilita "ler o projeto e responder" (caso do arquiteto) e "atender com todas as informações".
4. **Enxugar a matriz** (5^5 → 5×5) na UI + presets de prompt curtos.
5. **Memória:** chamar a extração via LLM (já existe no código) + um sinal simples de sucesso/falha (feedback loop leve).
6. **Limpar dívida:** avaliar Mistral Agents sync e ciclo-para-WhatsApp (provável remoção/simplificação).

## Resposta final ao dono
Sim — **agente por tarefa com preset é o modelo certo e economiza tokens** (preset = trilho que o LLM lê e ajusta). O que você construiu é uma **base boa (60%)**; o que falta não é refazer, é **ligar o que já existe** (modelo barato×robusto, RAG, playbook em banco) e **enxugar o que inchou** (a matriz 5^5 → 5×5). Aditivo, com gates, "sugere→confirma".
