---
name: crm-cross-conta-visibilidade
description: "CRM cross-conta: o negócio/lead/imóvel aparece nos CRMs de TODOS os envolvidos, mas só o DONO move na esteira; envolvido vê (cor do mercado de origem) + comenta/atribui; Hub vê tudo. Funil obrigatório no mercado principal. Dashboards do Hub absurdamente bons"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Requisito do dono (29/jun).** Doc: `docs/insumos-do-dono/crm-cross-conta-visibilidade-permissao.md`. **Mesa redonda quando chegar a hora** (camada Plataforma/Hub).

- **Hub vê os pipelines/CRM dos usuários** (leads/negócios de todos). Funis **customizáveis** (Hub + membro); **obrigatório** funil no mercado principal.
- **Negócio cross-conta:** quando o arquiteto traz um imóvel ao corretor, o **imóvel + lead + negócio aparecem no CRM de todos os envolvidos** — mas **só o DONO do negócio (e o Hub) edita/move na esteira**; o envolvido (arquiteto) **vê com a cor/info do MERCADO DE ORIGEM**, acompanha o avanço, **só comenta/atribui info, não move**. É a evolução do lead MESTRE×VINCULADO ([[distribuicao-leads-motor]]) + negócio-espinha ([[integracao-contas-negocio-spine]]) + ABAC por papel (`hub_negocio_acessos`).
- **Hub absurdamente bom:** dashboards/analytics/relatórios claros, eficientes, cada número acionável (régua da camada Hub; casa com [[central-performance-metricas]]). Ver [[central-aprovacoes-tela-unificada]].
