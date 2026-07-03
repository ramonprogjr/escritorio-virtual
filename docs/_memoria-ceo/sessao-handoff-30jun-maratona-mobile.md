---
name: sessao-handoff-30jun-maratona-mobile
description: 30/jun TARDE — H-SEC-1 (auth) + F-D2 (escrow) + maratona mobile (4 lotes); ler ao reabrir
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Continuação do dia 30/jun (depois do finale E2E — ver [[sessao-handoff-30jun2026-e2e-finale]]).** Deploys #28→#34. Registro em docs/MARATONA-2H-RELATORIO.md.

## Decisões do dono (executadas + auditadas GO)
- **H-SEC-1** (#28): tirou `NEXT_PUBLIC_INTERNAL_API_KEY` do browser. Era MAIOR que parecia — não bastava o browser parar de mandar a chave; o LADO QUE RECEBE exigia. **Keystone:** `getCallerContext` (lib/crm/crm-api-auth.ts) agora só exige a chave quando NÃO há cookie (com cookie, autentica pelo sub do JWT validado pelo proxy). 18 rotas /api/crm ajustadas (removido requireInternalApiKey standalone; tenant de g.ctx.tenantId). `kpis/calcular` mantém a chave (é cron). empresas/propostas ganharam guard (fechou buraco). Auditoria provou no build que o proxy valida o cookie via Supabase antes da rota.
- **F-D2** (#29): escrow exige DUAS AUTORIDADES — chave Hub→owner, chave Arq→gestor (≠owner). Gate em `aprovar()` (lib/ia/aprovacoes.ts) antes da cascata, fail-closed. Backlog: gravar user_id por chave p/ a RPC recusar arq.user_id==hub.user_id.
- **G-D1** (#28): /api/health owner-only. **G-D2** (#28): /crm/conteudo escondido do menu.

## Mobile (auditoria + 6 lotes — docs/MOBILE-AUDITORIA-ACHADOS.md, 27🔴+36🟢)
TODOS os 12 cross-cutting + os itens por tela SEGUROS aplicados (sem browser aqui, então só o que não precisa de teste visual):
- #30 B1: zoom-iOS global off; tipografia leitura ≥12px; min-w-0 no CrmMetricCard.
- #31 B2/C: toque 44px; marca substitui azul/verde GitHub no chrome/sideovers/botões.
- #32 A: recuperou 80px (padding-fantasma); mobilePageTitle vem de CRM_NAV_GROUPS; código morto removido.
- #33 D: grids fixos 4/3/2-col → responsivos.
- #35 E/CC-12: tabelas relatório/analytics → cards no mobile (dado acessível no toque).
- #37 F: clareza de valores $ (KPI Vencido abreviado+exato no title); valores das barras visíveis no toque; Enter quebra linha no celular; emoji→texto; toque/grids/tipografia restantes.
- **FALTA (precisa do olho do dono — teste VISUAL):** 3º header H2 (layout.tsx:633, tem logo+drawer avatar/logout — remover exige migrar CrmSessionFooter p/ o MobileShell antes, ~52px); CC-4 (affordance de scroll dos kanbans — memória avisa: não esconder o scroll); D-2/D-3 (funil em lista vertical no mobile); AT-8/CL-3 (colapsar botões/rodapé).

## Pendências do dono (docs/PENDENCIAS-DONO-INFRA.md)
Render: REMOVER NEXT_PUBLIC_INTERNAL_API_KEY + NEXT_PUBLIC_TENANT_ID (saem do bundle) + TESTAR LOGIN (auth mudou no #28). Setar CRON_SECRET + GROQ_API_KEY. Supabase: aplicar 19 migrações (db push). Review visual mobile. Relaciona [[diretriz-melhor-para-o-sistema]], [[tenant-null-leak-pattern]], [[modelos-contrato-escrow-auditoria]].
