# 🌟 Visão-Norte — IA-first: comando universal, multimodal e agêntico

> Documento-norte (não é spec de implementação única — é o mapa). Cada subsistema abaixo terá seu próprio spec → plano. Mantém foco e consistência conforme a visão evolui. 27/jun/2026.

## A tese
A IA é a **interface principal** do Obra10+. O usuário **fala, digita ou envia mídia** (áudio, foto, vídeo, PDF, planta) e a IA **entende e EXECUTA** — através do sistema determinístico, não no lugar dele. Tudo medido em **Tijolos** (pré-pago), o que torna a robustez (Claude, visão, long-context) sustentável: ação cara = mais Tijolos = receita.

## Princípio arquitetural: "RAILS + IA" (não joga as telas fora)
- **Trilhos (determinístico):** as telas fixas e as funções do sistema (criar pedido, consultar estoque, preencher cadastro, gerar relatório) continuam existindo, confiáveis e testáveis. São a verdade operacional.
- **Camada IA (por cima):** ponto de entrada universal (comando + voz + conversa + mídia). A IA **não reimplementa** o sistema — ela **chama as funções existentes como ferramentas** (tool-calling) e **apresenta/customiza** o resultado.
- **Click-and-Go / segurança:** a IA **sugere e o usuário confirma** ações sensíveis (compra, pagamento, corte de acesso). Para leitura de documento, mostra a fonte/confiança antes de agir. Nunca age cego.

### Respostas às perguntas do dono
1. **Telas fixas?** Sim — como trilhos e fallback confiável. A IA gera/customiza por cima, com defaults sãos.
2. **IA-first sendo o principal?** A IA é o ponto de entrada universal e age via tool-calling sobre as funções já existentes. Conversacional em cima, determinístico embaixo.
3. **Planejar ou iniciar?** Ambos: norte documentado (este doc) + começar pelo beachhead (F3 + FAB de comando).

## Decomposição em subsistemas (cada um = spec/plano próprio, em ordem de alavancagem)
- **V1 — Menu simplificado (quick win):** Analytics e Relatórios saem do menu lateral e viram **botões dentro do Dashboard** (Dashboard vira o hub de informação). Ganha espaço, simplifica. *(directo, baixo risco)*
- **V2 — F3: ativar IA-first onde o motor JÁ existe (APROVADO, em andamento):** Distribuição (fila com sugestão+confirmar, reusa `sugerirEncaminhamentoAutomatico`), Atendimento ("Sugerir resposta (IA)" debitando Tijolos), Dashboard ("Ação agora" com recomendação). É o beachhead — prova o padrão sugere→confirma→executa→debita Tijolos.
- **V3 — FAB de comando ("fale com o sistema") [KEYSTONE]:** botão flutuante global. Entrada texto **e voz** (Web Speech / upload de áudio → transcrição) → manda pro engine **com as ferramentas disponíveis** → a IA decide e chama tool(s) → executa → mostra resultado + debita Tijolos. É o unificador de toda a visão: qualquer comando, em qualquer tela.
- **V4 — Workspace conversacional multimodal (Relatórios = "Claude-cowork"):** área conversacional que recebe áudio/vídeo/foto/PDF/planta, **gera na tela** (tabelas, gráficos, documentos) e responde perguntas sobre os arquivos. Inclui o caso do arquiteto: "quantas tomadas a 1,10m na sala?" → Claude lê o projeto (visão/long-context) e responde com a evidência. Precisa: upload + parsing + Claude robusto + medição Tijolos.
- **V5 — Fluxos agênticos (estilo iFood):** "comprar 2 latas de tinta" → IA preenche o pedido, consulta a base de produtos/preços do fornecedor, gera orçamento, emite ordem de compra, envia ao fornecedor para aprovar, usuário paga, IA agenda entrega + faz follow-up até a chegada. Orquestração sobre fornecedores/produtos/pedidos/pagamento. **Trava:** gateway de pagamento.
- **V6 — Dashboard que aprende:** a IA entende o que o membro quer ver, como se comunica e seu padrão visual; aprende e **gera o painel sob demanda** (sobre os trilhos de KPIs reais). Camada de personalização por cima do Dashboard fixo.

## Tecido conector (o que torna tudo um sistema, não features soltas)
1. **Tool-calling:** o sistema expõe suas funções como ferramentas tipadas (`criar_pedido`, `consultar_estoque`, `preencher_cadastro`, `gerar_relatorio`, `ler_documento`…). A IA escolhe e chama. Base já existe (hub tools + engine).
2. **Multimodal:** upload de arquivo + transcrição de voz + Claude vision/PDF para documentos.
3. **Metering Tijolos:** toda ação de IA debita Tijolos (já no ar — Fase 1). Robustez (Claude) é o nível "Turbo". O motor de cobrança já está pronto para sustentar V4/V5.
4. **Provedor:** Mistral para o barato/simples; **Claude para o pesado** (ler projeto, orçar, planejar) — já roteável por tarefa.

## Riscos / travas conhecidas
- **Gateway de pagamento** (V5) — decisão/credencial do dono.
- **Precisão de leitura de documento** — mitigada por "mostrar evidência + confirmar" (nunca agir cego).
- **Custo de tokens** — mitigado pelo pré-pago Tijolos (é o modelo, não o problema).

## Sequência recomendada
V1 (menu, agora) → **V2/F3 (beachhead, agora)** → V3 (FAB de comando — keystone) → V4 (workspace multimodal) → V5 (agêntico/iFood, quando houver gateway) → V6 (dashboard que aprende). Cada um: spec → plano → execução, aditivo e com gates, sempre "sugere→confirma".
