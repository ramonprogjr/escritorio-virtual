---
name: laudo-produto-02jul
description: "Laudo de produto do dono (33 telas) processado 02/jul — mesa-redonda verificou (8 confirmados/5 refutados); P0 consertados+no ar; N1 (FK negocios) pendente da janela"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono trouxe um **LAUDO tela-a-tela (33 telas, funcionalidade-primeiro)** — `docs/insumos-do-dono/LAUDO-DETALHADO-POR-TELA.md`. Mesa-redonda (Workflow) **verificou cada P0 contra o código/DB real**: 8 CONFIRMADOS, 5 REFUTADOS, 1 parcial. Decisão em `docs/DECISAO-CEO-LAUDO.md`. **Verificar sempre antes de incorporar** — o laudo é bom mas alguns achados estavam desatualizados/errados.

## CONSERTADO e no ar (gated tsc/vitest/build)
- IM1: imóveis não criava (default `'captacao'` viola CHECK) → `'disponivel'`. `8ad24f6`
- AP1/CN1: telas 09 Aprovações e 30 Contatos quebradas (`.eq(tenant_id)` em tabela SEM a coluna → 42703/500) → tolerância `isMissingPgColumn`. `8ad24f6`
- AP2/IM2/EN3: error.message cru do Postgres vazando → mensagem genérica + log. `8ad24f6`
- D2: KPI "Modelos IA ativos" (era contagem de agentes) → relabel honesto. `8ad24f6`
- L2/L3 (causa-raiz): 6/8 leads sumiam do kanban — colunas usam slugs de VENDAS mas `estagioParaColunaKanban` devolvia slugs de CICLO DE VIDA; fix traduz via funilToLegacy(legacyToFunil) + teste. `e87e64c`

## PENDENTE janela do dono
- **N1 (tela 04 Negócios → 500):** `hub_negocios` tem FK LEGADA `hub_negocios_lead_id_fkey→hub_leads` (morta) além da correta `→hub_leads_crm`; leads vivem em hub_leads_crm → viola a legada (23503). **Migração de 1 linha pronta:** `supabase/migrations/20260702001500_fix_negocios_drop_fk_legada.sql` (dropa a FK). Aplicar destrava.
- Migração multi-tenant p/ **adicionar tenant_id** em hub_aprovacoes/hub_contatos_notificacao (hoje toleradas sem escopo; 1 tenant).

## REFUTADOS (não mexer) / DEFERIDOS
Refutados: L1 (409 já tratado no front), AR1/PR1/EM1/CF1 (RBAC — auditado COMO owner/super-admin; acesso é por design). Deferido P1: N2 (Ganhos com status "Aberto"), D1 (funil do Dashboard — mesma raiz do L2, outro componente). Relaciona [[contrato-ceo-honesto-sem-bajulacao]], [[modelo-tenant-first-servico-universal]].
