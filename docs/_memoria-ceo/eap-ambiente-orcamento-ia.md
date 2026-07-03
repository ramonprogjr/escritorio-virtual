---
name: eap-ambiente-orcamento-ia
description: "EAP refinada (segmento→ambiente→disciplina→atividade + qtd + descritivo padrão) + a capability-mãe ORÇAMENTO IA: memorial descritivo PDF → IA monta planilha executiva/custos/financeira sozinha, preços de fornecedor, auditável"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Refinamento da EAP + capability-mãe (dono, 29/jun).** Doc: `docs/insumos-do-dono/eap-ambiente-disciplina-e-orcamento-ia.md`.

**EAP ambiente-first:** **SEGMENTO** (residencial/comercial/corporativo/clínicas/PDV) → **AMBIENTE** (sala, cozinha…) → **DISCIPLINA** (civil/elétrica/hidráulica/revestimentos/pintura) → **ATIVIDADE** (ex. elétrica: dados e voz, tomada 1,10m, tomada 0,30m, iluminação LED/plafon) + **qtd** + **descritivo padrão**. Mais fácil de visualizar ("na sala, o que tem"). Refina E0/E2: a árvore (frentes_eap + itens) já suporta; ganha nível Ambiente + Atividade; presets viram **templates por segmento**. Andar/área = dimensão ortogonal.

**Descritivo padrão = TAXONOMIA controlada** (o "modelo a inserir depois") = o ENABLER da IA: ela CLASSIFICA o memorial na taxonomia (tratável) em vez de extrair texto livre.

**ORÇAMENTO IA (a capability-mãe):** IA lê o **memorial descritivo (PDF)** → monta sozinha a **planilha executiva/custos/financeira**, por item, com **preços de fornecedor** (catálogo E5/marketplace). Auditável. Converge EAP + taxonomia + catálogo + E6 + engine IA (MarkItDown p/ PDF).

**Meu veredito (endosso):** a taxonomia padrão é o que destrava. **Faseamento:** v1 = IA monta ESTRUTURA+descritivo do memorial + precifica do catálogo, **humano confirma QUANTIDADES** (quantidade vem da planta, não do memorial — "tomadas conforme projeto"); v2 = IA lê a planta p/ quantidades; norte = 100% sozinha. Auditável (cada linha = atividade padrão + preço rastreável + humano aprova). Ver [[modelos-contrato-escrow-auditoria]], [[spec-gestao-obras-engenharia]].
