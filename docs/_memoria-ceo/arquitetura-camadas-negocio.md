---
name: arquitetura-camadas-negocio
description: "A arquitetura-MÃE do produto (dono 28/jun) — negócio em CAMADAS: Hub (meta) sobre verticais (Arq/Eng/Imob) que compartilham uma COLUNA; construir a coluna primeiro"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono (28/jun/2026) definiu a arquitetura do negócio em CAMADAS:

**HUB (camada META, vocês por cima de tudo):** growth, comercial, gestão/direção, **AUDITORIA**, ecossistema/comunidade, + **auditoria dos projetos e obras**, + **"gestão da gestão"** (o Hub gere e audita a gestão das engenharias/verticais), + mais features depois.

**VERTICAIS (cada módulo ÚTIL PARA a sua vertical, não casca genérica):**
- **Arquitetura** = CRM + vendas + **gestão de projeto**.
- **Engenharia** = gestão de obras.
- **Imobiliário** = pro imobiliário.
- O arquiteto **enxerga a gestão de obras** — seu "gestão de projeto" é um **sub-módulo DERIVADO** do de obras.

**CONEXÕES e PARALELOS:** as verticais compartilham uma **COLUNA** (espinha) → derivam/paralelam umas das outras (projeto↔obra), e o Hub audita/gere por cima. A coluna já existe em grande parte: **copiloto conversacional (voz+texto) + funil editável (hub_pipelines) + engine/ferramentas IA + kanban + os elos lead→negócio→projeto→obra**.

**ESTRATÉGIA (do dono):** construir a **COLUNA primeiro**; depois ir **incluindo funcionalidades** por vertical. Cada módulo genuinamente útil pra si, mas com paralelos/conexões. Ordem: Arquitetura (1ª) → Engenharia → demais. Ver [[modulo-arquitetura-requisitos]], [[modulo-engenharia-obra]], [[fluxo-core-captacao-direcionamento]], [[macro-sequencia-nucleo-primeiro]].
