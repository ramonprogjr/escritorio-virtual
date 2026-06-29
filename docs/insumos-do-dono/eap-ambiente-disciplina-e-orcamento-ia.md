# EAP por Ambiente→Disciplina→Atividade + Orçamento IA (memorial → planilha) — insumo do dono (29/jun)

> Refina a estrutura da EAP (E0/E2) e define a capability-mãe: a IA lê o memorial descritivo e monta a planilha executiva/custos/financeira sozinha. Liga a [[marketplace-rede-servicos-ifood]] (preços de fornecedor) e ao MASTERPLAN.

## 1. Estrutura da EAP (refinada — ambiente-first)
Organizar por **AMBIENTE → DISCIPLINA → ATIVIDADE** (mais fácil de visualizar: "na sala, o que tem"), dentro de **SEGMENTOS**:
- **Segmento:** Residencial · Comercial · Corporativo · Clínicas · PDV (cada um tem um template de ambientes/atividades típico).
- **Ambiente:** ex. Sala, Cozinha, Suíte, Recepção…
- **Disciplina** (dentro do ambiente): Civil, Elétrica, Hidráulica, Revestimentos, Pintura…
- **Atividade** (dentro da disciplina) + **quantidade** + **descritivo padrão**. Ex.:
  - Elétrica → **dados e voz**, **tomada 1,10m**, **tomada 0,30m**, **iluminação** (LED, plafon)…
  - (cada atividade com qtd e o descritivo padrão)

→ Refina o que temos: o `hub_obra_frentes_eap` (E0, árvore com parent_id) e os `hub_obra_itens` (E2) já suportam a árvore. O que muda: a EAP ganha o **nível Ambiente** + o nível **Atividade**, e os **presets viram templates por SEGMENTO** (residencial/comercial/...), com disciplina→atividade + descritivo padrão. (Andar/área continua como dimensão ortogonal: andar → ambiente → disciplina → atividade.)

## 2. O DESCRITIVO PADRÃO = a taxonomia controlada (o enabler da IA)
Um **catálogo padrão de atividades** por disciplina (tomada 1,10m, dados e voz, iluminação LED/plafon, etc.) com **descrição padrão** — "o modelo a inserir depois". **É isto que torna a IA tratável:** em vez de extrair texto livre, a IA **classifica** o memorial nessa taxonomia conhecida. Padrão fácil de auditar e de a IA produzir.

## 3. A capability-mãe: ORÇAMENTO IA (memorial descritivo → planilha executiva)
**A ideia:** a IA pega o **memorial descritivo (PDF)**, lê, e **monta sozinha a planilha executiva, de custos e financeira** — por item, com os **preços dos fornecedores** (do catálogo/marketplace E5). Fácil de auditar.
- Converge TUDO: EAP (E0/E2) + descritivo padrão (taxonomia) + catálogo/preços de fornecedor (E5/marketplace) + orçamento (E6) + IA (engine/MarkItDown p/ PDF). É o ponto onde o sistema inteiro se encontra.

## 4. Minha opinião (pragmática e honesta)
**Endosso forte — e o seu instinto acertou o que destrava:** a **taxonomia padrão** (ambiente→disciplina→atividade + descritivo) é o que faz a IA funcionar de verdade. Sem ela, ler memorial livre é impreciso; com ela, a IA **classifica** (problema tratável) e o catálogo precifica. É um diferencial enorme (orçar é a dor que arquiteto/engenheiro mais teme; horas→minutos).

**O contraponto honesto (faseamento):**
- **Quantidade** muitas vezes NÃO está no memorial ("tomadas conforme projeto") — vem da **planta/projeto**. Então:
  - **v1:** IA monta a **ESTRUTURA** (ambiente/disciplina/atividade) + o **descritivo** a partir do memorial (alta precisão via taxonomia) + **precifica do catálogo**; **humano confirma as quantidades** (Click-and-Go). Já é "IA monta 80%, humano confirma".
  - **v2:** IA lê a **planta** (PDF/CAD) p/ extrair quantidades (contagem de pontos, m²).
  - **norte:** "100% sozinha" — chega lá, mas v1 já entrega o grosso e é auditável.
- **Auditável de verdade:** cada linha = atividade padrão + preço de fornecedor rastreável + humano aprova. Casa com "somos juízes".
- **Onde encaixa no roadmap:** refina E0/E2 (taxonomia + presets por segmento) → alimenta E6 (orçamento) → a "Orçamento IA" é uma capability que pluga sobre tudo isso (fase 2/3, perto do marketplace que dá os preços).

**Resumo:** é a feature que transforma o sistema de "gestão de obra" em "a obra se orça e se gerencia sozinha, com você auditando". Construir — com a taxonomia padrão como fundação, e o faseamento (estrutura+descritivo agora, quantidade da planta depois).
