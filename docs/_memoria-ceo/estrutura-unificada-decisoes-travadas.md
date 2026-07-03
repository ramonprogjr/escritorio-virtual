---
name: estrutura-unificada-decisoes-travadas
description: "DECISÕES TRAVADAS pelo dono (29/jun) sobre a estrutura unificada: hub_obra_itens = ÚNICO item de escopo (unifica E2+E6); status via tipo; BDI fator único/empresa; avanço POR ITEM (exibe por item+ambiente); disparidade AVISA (não trava); manual-first; escrow cross-conta chave1_papel; aba Escopo nova; build em 4 fases aditivas"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Design da estrutura unificada APROVADO pelo dono (29/jun).** Mesa redonda (7 lentes) → design em `docs/ESTRUTURA-UNIFICADA-OPERACAO-DESIGN.md` (§9 = decisões travadas). Liga [[estrutura-unificada-orcamento-cronograma-escopo]].

**As decisões (travadas):**
1. **Unificar E2+E6** → `hub_obra_itens` = o ÚNICO "item de escopo" (verdade, carrega custo+preço+avanço+datas); `hub_obra_orcamento_itens` = proposta/versão 1:1. Aditivo, fases, reversível.
2. **status_escopo = reusar o `tipo`** de E2 (estender CHECK).
3a. **BDI fator único por empresa** (`hub_obras.bdi_fator` DEFAULT 1.0, override por item). 3b. **margem:** default administração=transparente, preço-fechado=privada (Hub audita escopo) — CONFIRMAR antes das views do Hub.
4. **Avanço POR ITEM** (`peso`+`pct_avanco` no item, já em E2); exibir por item E por ambiente (ambiente=agregação bottom-up, não unidade de medição).
5. **Disparidade AVISA** (amarelo → Central de Aprovações, não trava). Aditivo-potencial pré-listado mas colapsado.
6. **MANUAL-FIRST** (árvore + ambiente + disparidade + Click-and-Go) antes do "memorial→IA orça". Migrações só-arquivo.
7. **Escrow cross-conta:** campo `chave1_papel` validado no `rpc_liberar_escrow`.
8. **Aba "Escopo" nova** de 1ª classe; "Itens & Avanço" = lente de execução da mesma árvore.

**Build = 4 fases aditivas** (456 testes verdes, sem big-bang): Fase 0 (zero migração, fecha o elo E2↔E6 no código) → Fase 1 (E7: materializa custo_total+bdi+status no item-mãe) → Fase 2 (1:1 forte E2↔E6 + tela/componente `<ArvoreEscopo>`) → Fase 3 (ambiente nível real + medição + tools IA) → Fase 4 (E4 Curva-S no peso do item). UX = 1 componente `<ArvoreEscopo>` (3 níveis, lente preço/custo/margem/avanço, persona), reusa Click-and-Go da SC (E5). **WHY:** é a fundação honesta e auditável de toda a camada AEC — a planilha=escopo do dono virando dado-mãe único.
