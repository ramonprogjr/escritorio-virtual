---
name: modelos-contrato-escrow-auditoria
description: "DOIS modelos de contrato (administração×preço fechado, imutáveis) que bifurcam o financeiro/Portal; ESCROW (paga só com aprovação dupla); engenharia auditorial (Hub é juiz)"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Resposta do dono (eng. civil) ao Portal do Cliente — reescreve E6 + Portal.** Doc: `docs/insumos-do-dono/modelos-contrato-e-escrow.md`.

**DOIS modelos de execução, definidos no fechamento do contrato, IMUTÁVEIS — o financeiro/Portal BIFURCA por eles:**
- **Administração ("gerenciamento"):** engenheiro gerencia, cliente paga, arquiteto acompanha; cliente vê o **valor UNITÁRIO de tudo** (gestão aberta).
- **Preço fechado (turn-key):** executante assume mão de obra/material/impostos; cliente vê só **TOTAIS** (sem composição interna).
Tipo = atributo imutável da obra, escolhido no cadastro.

**ESCROW (conta custódia, módulo financeiro a implantar):** o dinheiro fica em custódia; **cliente só paga MEDIANTE aprovação dupla — arquitetura + o Hub ("o mais importante, a gente")**; protege fornecedor (não toma calote) e cliente (só paga o aprovado). É a evolução do "Aprovado libera pagamento" de E6.

**Engenharia auditorial (o "selo", "somos juízes"):** onboarding qualifica fornecedor → visitas IN LOCO (garante avanço/medida/prazo) → IA de análise de risco/gargalos → escrow → forçar métricas + controle de chegada/acesso/permanência/execução. Tudo **previsto, nada reativo**.

**Cliente aprova:** medição, aditivo, mudança de escopo, marco — cada um no seu momento, simples; o Hub faz a **ponte e comunicação clara entre todas as partes**. Ver [[portal-cliente-medos-cura]], [[monetizacao-licenciamento-rede]], [[central-aprovacoes-agentes-setor]].
