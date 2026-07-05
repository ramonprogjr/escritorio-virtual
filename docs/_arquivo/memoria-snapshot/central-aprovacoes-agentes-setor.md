---
name: central-aprovacoes-agentes-setor
description: Arquitetura — agentes especializados por setor geram as aprovações; humano é o checkpoint; decisão (aprovar/rejeitar) ensina o agente
metadata:
  type: project
---

Decisão de arquitetura do dono (27/jun): num sistema IA-first, a **Central de Aprovações** é o checkpoint humano sobre uma "equipe" de **agentes especializados por setor/atividade**. Cada agente (Financeiro, Comercial, Compras, Distribuição, Obra…) é responsável pelas demandas do seu domínio: **executa o trabalho, gera a aprovação, o humano decide, e o aprovar/rejeitar (+ motivo) é FEEDBACK que melhora o agente** (tarefas criadas/refinadas pelas decisões). A IA opera, o humano decide, o agente aprende.

**Régua:** aprovação NÃO é caixa de entrada — é fila **priorizada pela IA**, agrupada por **setor/agente + tipo**, que **auto-resolve o trivial** (políticas de auto-aprovação por valor/tipo, conectadas ao `verificarAutonomia` do engine) e foca no que exige o julgamento do dono. Inclui aprovação em LOTE e visão por perfil (owner vê tudo; gestor vê o seu setor).

**Gap a construir (o diferencial):** o **loop de feedback** decisão→`hub_memorias_agente`→melhoria do agente NÃO existe ainda (a memória existe, mas não é alimentada pelas decisões). É o item-chave.

**Spec completo:** `docs/superpowers/specs/2026-06-27-central-aprovacoes-agentes-setor.md` (5 fases: layout+agrupamento → recomendação IA no card → políticas de auto-aprovação → lote → loop de feedback). Entra na fila do B junto com a **unificação de layout** de todas as telas (o dono notou que Aprovações tem shell divergente). Conecta [[visao-ia-first-comando-multimodal]], [[agentes-ia-audit-redesign]], [[design-overhaul-deferido]].
