---
name: integracao-contas-negocio-spine
description: "Como as contas se integram: o NEGÓCIO (origem = venda do imóvel) é a espinha; módulos compartilhados com visão por papel; 'nada se perde' (Hub recupera); mensagens robustas; anti-poluição"
metadata:
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

**Diretriz de integração entre contas (dono, 29/jun).** Doc: `docs/insumos-do-dono/integracao-contas-negocio-spine-logs.md`.

1. **NEGÓCIO = espinha que interliga TODAS as contas;** origem = **negócio do IMÓVEL (a venda)**; todos os outros (projeto→obra→financeiro→pedidos) **derivam dali**. (Confirma "negócio = centro", agora como eixo ENTRE contas.) Cada conta compartilha, **cada uma com seu acesso e visão** (RBAC+ABAC).
2. **Módulos compartilhados, fonte única:** **Projetos puxa direto da Arquitetura** → força o arquiteto a manter atualizado. **Financeiro e Pedidos = todos veem** (com seu acesso).
3. **"NADA SE PERDE" (invariante FORTE):** registro/log de **absolutamente tudo**; **mesmo se apagar, o Hub recupera** → event log append-only + soft-delete (nunca DELETE físico) + Hub como backstop histórico. Liga ao "somos juízes".
4. **Mensageria robusta** entre as partes, cada um com seu acesso, também logada.
5. **Anti-POLUIÇÃO:** cliente NÃO vê pormenores da obra; arquiteto NÃO vê entranhas da engenharia (salvo necessidade) — visão curada por papel. Ver [[portal-cliente-medos-cura]], [[modelos-contrato-escrow-auditoria]], [[spec-funcional-crm-hub-obra10]], [[schema-rls-alinhamento-mestre]].
