# 🗂️ Central de Aprovações — agentes especializados por setor + feedback que ensina

> Spec de design (não implementação). Como organizar aprovações de alto volume e multi-setor num sistema IA-first. 27/jun/2026. Conecta [[visao-ia-first-comando-multimodal]] (rails+IA), [[agentes-ia-audit-redesign]] (agentes por tarefa, já prontos) e [[creditos-ia-metering-visao]] (Tijolos).

## ⏸️ DEFERIDA (decisão do dono, 27/jun)
A Central concentra MUITAS frentes — **envio/distribuição de leads, onboarding, academy, atendimento, projeto, arquitetura, obra/engenharia, financeiro, compras, homologação de fornecedor** e o que mais surgir. Por ser tão transversal, o dono decidiu **deixar a reconstrução para depois** — quando chegar a hora dela no planejamento — pra **não ir-e-voltar e travar o avanço atual** (layout/consistência). Este spec fica pronto pra esse momento. (Quando for: validar a lista de frentes/tipos reais + limiares de auto-aprovação com o dono.)

## O modelo (decisão do dono)
Cada **setor/atividade tem um AGENTE ESPECIALIZADO** responsável pelas demandas dali. O agente **executa** o trabalho do seu domínio, **gera a aprovação** quando precisa de aval, e o **humano é o checkpoint**. O **aprovar/rejeitar (+ motivo) vira FEEDBACK que melhora o agente** — as tarefas/processos do agente são criados e refinados com base nas decisões. *A IA opera, o humano decide, o agente aprende.*

Exemplos:
- Agente **Financeiro** → prepara pagamento/cobrança → aprovação.
- Agente **Comercial** → propõe desconto/condição → aprovação.
- Agente **Compras** → monta pedido de material (estilo iFood) → aprovação.
- Agente **Distribuição** → encaminha lead a fornecedor → aprovação.
- Agente **Obra/Engenharia** → medição/avanço → aprovação.

## Por que não pode ser "lista única"
Vai ter **MUITAS** aprovações, de setores e tipos diferentes. Lista infinita = fadiga → o dono ignora → o checkpoint perde valor. A Central tem que **triar, agrupar, priorizar e auto-resolver o trivial**.

## Arquitetura da Central

### 1. Agrupar por SETOR (= por agente) + TIPO
Abas/seções por setor (cada uma "tocada" pelo seu agente): Comercial · Financeiro · Obra · Compras · Distribuição · IA. Dentro, por tipo (cobrança, contrato, pagamento, desconto, encaminhamento, medição…). O dono vê o painel todo; um gestor de setor vê só o seu (multi-tenant + setor).

### 2. Cada card de aprovação mostra
- **Qual agente** gerou (avatar + nome do setor) e **o que é** (tipo).
- **Valor/risco envolvido** e **motivo** (por que precisa de aval).
- **Recomendação da IA** ("Aprovar — dentro da política" / "⚠ Acima do limite — revise") + o raciocínio curto do agente.
- Ações **em 1 toque**: Aprovar · Rejeitar (com chips de motivo) · Ver detalhe.

### 3. Priorização pela IA (não cronológica)
Topo = mais urgente/caro/arriscado. A IA ordena por SLA, valor e risco — não por ordem de chegada.

### 4. Auto-aprovação por POLÍTICA (a chave pra não afogar)
Regras configuráveis por setor/tipo/valor: *abaixo de R$ X e dentro da política → o agente aprova sozinho e só registra; acima → escala pro humano.* Assim **só chega ao humano o que exige julgamento.** O motor já tem `verificarAutonomia` no engine — a Central expõe essas políticas como tela de configuração (owner).

### 5. Aprovação em LOTE
Selecionar vários itens parecidos e de baixo risco → aprovar de uma vez (com confirmação). Mata a fadiga da rotina.

### 6. Feedback que ENSINA o agente (o diferencial)
Toda decisão (aprovar/rejeitar + motivo) é gravada como **sinal de aprendizado do agente** que gerou a demanda:
- Rejeições recorrentes de um tipo → o agente ajusta o processo/limiar (ex.: "descontos acima de 15% você sempre rejeita → o agente para de propor").
- Vira memória/regra do agente (`hub_memorias_agente` já existe). **Gap honesto:** o *loop de feedback decisão→melhoria* ainda NÃO existe (a memória existe, mas não é alimentada pelas decisões de aprovação). É o principal item a CONSTRUIR aqui.

## Consistência de layout (parte do B)
A Central (e todas as telas) passam a usar o **mesmo shell**: header padrão, sistema de cards, espaçamento e hierarquia. Hoje a Aprovações tem layout divergente — unificar.

## O que já existe vs o que falta
- ✅ Tabela `hub_aprovacoes`, tela `/crm/aprovacoes` (filtro por tipo, aprovar/rejeitar, loading+toast), `verificarAutonomia` no engine, agentes por setor (cargos), memória do agente.
- ⬜ **Construir:** agrupamento por setor/agente; recomendação da IA no card; **políticas de auto-aprovação (tela)**; aprovação em lote; **o loop de feedback decisão→memória do agente**; unificação de layout.

## Fases sugeridas (aditivo, com gates, sugere→confirma)
1. **Layout + agrupamento por setor/tipo** (UI, baixo risco) — a Central deixa de ser lista única.
2. **Recomendação da IA + motivo no card** (liga o agente gerador à decisão).
3. **Políticas de auto-aprovação** (tela owner + gate no fluxo) — reduz o volume.
4. **Aprovação em lote.**
5. **Loop de feedback** (decisão → `hub_memorias_agente` → agente melhora). O diferencial, por último.

## Régua
**Aprovação não é caixa de entrada — é uma fila priorizada pela IA, por setor/agente, que auto-resolve o trivial e foca no que exige o julgamento do dono; e cada decisão ensina o agente daquele setor.**
