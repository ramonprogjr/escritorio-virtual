---
name: orcamentaria-setor-cross-vertical
description: "ORÇAMENTÁRIA não é um botão/feature — é um SETOR cross-vertical que abrange TODAS as áreas (arquitetura, engenharia, serviços, produtos): tudo depende de orçamento e haverá UM PADRÃO único pra tudo. A estrutura unificada (item-de-escopo) É esse padrão; a orçamentária da OBRA (planilha+memorial da mesma árvore) é só a 1ª instância concreta; provável módulo de navegação próprio no futuro"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Insumo do dono (29/jun):** ao renomear "Extração" → "Orçamentária", o dono revelou o escopo: **Orçamentária é um SETOR, não uma feature.**

- **Atravessa TODAS as áreas:** arquitetura · engenharia · serviços · produtos. **Tudo depende de um orçamento.**
- **UM PADRÃO único pra tudo** = a [[estrutura-unificada-orcamento-cronograma-escopo]] (o item de escopo: ambiente→disciplina→item + qtd/custo/BDI/preço). A estrutura unificada É o padrão da Orçamentária.
- **Mesmo core, contexto por vertical** ([[crm-cross-conta-visibilidade]] §7 "mesmo core, telas diferentes"): o motor de orçamento é um só; cada área (arq/eng/serviços/produtos) o consome no seu contexto.
- A **orçamentária da OBRA** (planilha orçamentária CSV + memorial, gerados da MESMA árvore — build em andamento, deploy #14) é a **1ª instância concreta** do setor. O setor completo (cross-vertical) é arquitetura futura.
- Provável **módulo de navegação próprio** lá na frente (como o rename Operações/Arquitetura/Engenharia em [[navegacao-renomear-operacoes-arquitetura-engenharia]]).
- **WHY:** padronizar o orçamento de TODA a rede num formato só é o que deixa a [[estrutura-unificada-decisoes-travadas]] valer pra valer — a IA acha disparidade e opera tudo igual (arquiteto=fonte, orçamento=gate). **How to apply:** construir a orçamentária por vertical reusando o MESMO motor/estrutura; nunca um orçamento ad-hoc por área.
