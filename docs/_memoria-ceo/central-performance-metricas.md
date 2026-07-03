---
name: central-performance-metricas
description: Blueprint-mestre de métricas, eventos, SLA, dashboards por perfil e alertas acionáveis do CRM de vendas/atendimento Obra10+
metadata:
  type: reference
---

Blueprint de produto (Wendel, 24/jun/2026) para a **Central de Performance Comercial & Atendimento** — detalhe completo em **`docs/CENTRAL-PERFORMANCE-METRICAS.md`**.

Pontos-chave para manter consistência:
- **Fundação = camada de EVENTOS** (`hub_eventos`, append-only, schema padrão event_id/event_type/tenant_id/user_id/entity/timestamp/channel/source/metadata; famílias lead.*/attendance.*/message.*/followup.*/deal.*/proposal.*/sla.*/user.*/supplier.*/ai.*). "Sem evento bem registrado, não há métrica confiável." = a feature F4 do backlog, **keystone** de tudo.
- **Filosofia de UI/UX:** alertas **acionáveis e priorizados**, não relatório passivo ("18 follow-ups atrasados; destes 5 são propostas >R$50k, 3 responderam hoje — priorize").
- **14 blocos de métricas** (entrada de leads, velocidade/SLA, follow-up, atendimento TMA/TME/TMR, funil, conversão, financeiro CAC/LTV/ROI, equipe/absenteísmo, qualidade CSAT/NPS/FCR, canal, IA, carteira/churn, distribuição/ranking fornecedores).
- **SLAs:** lead quente ≤5min · comum ≤15min · cliente respondeu ≤10min · proposta→follow-up 24h · parada→48h.
- **Dashboards por perfil:** dono/Hub · empresa/membro · gestor comercial · vendedor.
- **Faseamento MVP→2→3** alinhado ao manual-first.

**Dependências:** quase tudo depende de (1) camada de eventos F4 e (2) multi-tenant real B3.9 + distribuição B5. Antes disso, dá p/ entregar fatias de UI/UX sobre dados atuais (dashboard acionável por perfil, tela de follow-ups priorizada). Ver [[plano-executivo-blocos]], [[backlog-features-futuras]], [[distribuicao-leads-motor]], [[monetizacao-licenciamento-rede]].
