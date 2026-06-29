# Gestor de tarefas UNIVERSAL — todo verbo vira tarefa (insumo do dono, 29/jun)

> A espinha de EXECUÇÃO: em toda etapa de ação, um gestor de tarefas (IA + conversacional + integrações) onde **agentes E humanos** executam tudo dentro do sistema. Mesa redonda quando chegar a hora (cross-cutting, junto da Central de Aprovações + agentes). Liga a [[central-aprovacoes-tela-unificada]], [[central-aprovacoes-agentes-setor]], [[pendencias-etapa-copiloto-agentes]] (#13 painel de tarefas).

## O requisito (dono)
- Em **toda etapa que envolve AÇÃO**, uma funcionalidade de **gestor de tarefas** (com IA, conversacional e todas as integrações) — para **agentes e humanos executarem tudo dentro do sistema**.
- **Regra-mãe: tudo que for VERBO / gerar uma AÇÃO vira uma TAREFA.**
- **Fluxo base (dono):** **quem criou** · **qual é o resultado** · **quem recebe a tarefa pronta** · **para quando** · **onde** · **o registro**.

## Minha leitura (você perguntou "certo?") — SIM, e é o glue do sistema
É o **básico de qualquer gestor de tarefas** E é o que faz tudo virar rastreável, executável (por humano OU agente) e auditável. Com isto, "todo verbo vira tarefa" transforma o sistema de telas em um **motor de execução**. Endosso — com estas melhorias (você abriu pra melhorar):

**O fluxo, refinado (mantém o seu, separa 1 papel + acrescenta o ciclo):**
- **CRIADOR** (quem pediu — humano/agente/evento do sistema).
- **EXECUTOR** (quem FAZ — humano OU **agente IA** por nível de autonomia). *Distingo do destinatário — o seu "quem recebe a tarefa pronta" é o consumidor do resultado, não necessariamente quem executa.*
- **DESTINATÁRIO DO RESULTADO** (quem recebe pronto e **ACEITA** — fecha o loop).
- **RESULTADO ESPERADO** (o que define "pronto").
- **PARA QUANDO** (prazo/SLA) + **prioridade** (a IA prioriza).
- **ONDE** (o vínculo: a obra/negócio/item/frente/lead — a tarefa pendura na entidade, como tudo pendura no negócio/obra).
- **REGISTRO** (log **append-only** — nada se perde).

**Acrescento (o "básico+"):**
- **Estado/ciclo:** aberta → em execução → concluída → **recebida/aceita** (ou **reaberta** se rejeitada — e a rejeição **ensina o agente**, igual à Central de Aprovações).
- **Origem automática:** todo verbo/evento do sistema **cria a tarefa sozinho** (falta material → tarefa de comprar; medição aprovada → tarefa de pagar; lead novo → tarefa de atender). Não depende de alguém lembrar.
- **Executor humano OU agente:** o agente IA executa o que é seguro (autonomia 1→5); o crítico vira tarefa pro humano. Mesmo motor de autonomia da Central de Aprovações.
- **Dependências:** tarefa A trava B (orquestra multi-passo).
- **Conversacional:** "cria uma tarefa pro João comprar cimento até sexta na obra X"; "o que tenho pra fazer hoje?".
- **Integrações:** a tarefa **dispara** ações (WhatsApp, e-mail, pedido no marketplace, etc.) — o verbo executa de verdade.

## Relação com a Central de Aprovações (são irmãs)
- **TAREFA = ação que precisa de EXECUÇÃO.** **APROVAÇÃO = ação que precisa de DECISÃO.** Juntas = a espinha **ação + decisão**. Provável modelo compartilhado/complementar (`hub_tarefas` + `hub_aprovacoes`, com o mesmo loop de autonomia + log).

## ⭐ Reforço do dono: a IA CONTROLA TUDO por tarefas conectadas e entregues
Literalmente tudo: **pediu material → tarefa; fez solicitação → tarefa; uma ação → tarefa; um follow-up → tarefa.** A **IA controla tudo por tarefas, conectadas e entregues.**

**Minha opinião (CEO):** isto é o que separa "sistema de registro" (telas passivas) de **"sistema de EXECUÇÃO"** — a IA deixa de só sugerir e passa a **orquestrar o fluxo inteiro como uma teia de tarefas conectadas** (falta material → tarefa comprar → tarefa cotar → tarefa aprovar → tarefa entregar → tarefa dar baixa no estoque), cada uma encadeada, entregue e logada. É o "IA-first" levado à conclusão: um **motor de operações autônomo**. Endosso forte.

**O ÚNICO risco (e a regra de design que resolve):** se cada micro-ação virar uma tarefa VISÍVEL, vira spam/ruído (igual à fadiga de alerta do campo). A saída: **a IA orquestra a teia INTEIRA, mas o humano só VÊ as tarefas que precisam dele.** A maioria das tarefas a IA **auto-executa e entrega em silêncio** (por nível de autonomia); só **exceções + o que exige decisão/pessoa** sobem à tela. Mesma régua do cockpit "Hoje" (fila de decisões, não caixa de entrada de tudo). Assim ganhamos a potência da teia sem o ruído.

→ Resultado: a IA é a **gerente de operações** que move tudo; o humano vê só onde é insubstituível. Tarefas conectadas (dependências) + entregues (aceite fecha o loop) + logadas (nada se perde).

## Referência do dono: entre Asana e Bitrix24, mas PERSONALIZADO
O dono pensa em "algo entre as tarefas do **Asana** e do **Bitrix24**" — totalmente personalizado pra nossa necessidade.
- **Do Asana, pegamos:** a UX limpa de tarefa (boards/listas, **dependências**, responsável, prazo, subtarefas, projetos) — clareza, não ERP pesado.
- **Do Bitrix24, pegamos:** a **integração CRM ↔ tarefas** + **automação/gatilhos** (tarefa nasce de evento de negócio) + o "tudo no mesmo lugar" operacional.
- **A nossa personalização (o que nenhum dos dois tem = o moat):** a **IA ORQUESTRA** (não é só manual); as tarefas **penduram nas entidades AEC** (obra/EAP/negócio/medição/compra); **verbo→tarefa automático**; **níveis de autonomia** (agente executa o seguro); e **"o humano só vê o que precisa dele"**. Asana/Bitrix são caixas de tarefa; o nosso é um **motor de operações com IA no controle**.

## Pendência: MESA REDONDA quando chegar a hora
Junto da Central de Aprovações + da camada de agentes (são o mesmo tecido de execução). Pontos a fechar: modelo (tabela própria x reuso), o aceite-do-resultado, a auto-criação por evento (o catálogo de "verbos→tarefa"), e a UI (painel de tarefas por papel + conversacional).
