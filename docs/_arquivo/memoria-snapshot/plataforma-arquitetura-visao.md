---
name: plataforma-arquitetura-visao
description: "-ramon É a plataforma PRINCIPAL — Hub recebe/distribui leads ao fornecedor que vende (CRM próprio) e executa (Gestão de Obra), tudo no mesmo sistema; multi-tenant, IA-first, API-first; todo membro loga aqui"
metadata: 
  node_type: memory
  type: project
  originSessionId: 635246fa-0a11-4787-bf12-7900cf1c8059
---

Resolução de arquitetura (confirmada pelo Wendel em Jun/2026, "blocos 2–4"):

**`-ramon` NÃO é "só o CRM de captação" — é a plataforma principal.** Modelo único:
- **Hub (CRM mestre)** recebe leads (Meta/Google/WhatsApp/site/indicação/manual/API), a **IA qualifica e distribui** ao **fornecedor homologado de maior score** (ver [[distribuicao-leads-motor]]).
- O fornecedor trabalha o lead **no CRM próprio dele dentro da plataforma**; se fecha, o negócio **vira projeto/obra/serviço** → cai na **Gestão de Obra** (Módulo Engenharia, ver [[modulo-engenharia-obra]]), também dentro da plataforma.
- **Todo membro/fornecedor LOGA aqui** para vender (CRM) e executar (obra). Multi-tenant; o Hub mantém governança, SLA, redistribuição e a jornada ponta a ponta.
- **IA-first e conversacional** (a IA opera o sistema, não só conversa) e **API-first** (integrável: WhatsApp, Google, Meta/Google Ads, RD, Pipedrive, Zapier/n8n/Make, ERP, assinatura, pagamentos).

**Correção importante:** isto SUPERA a ideia antiga de "dois CRMs distintos que integram no futuro". O operacional comercial+obra é **um sistema só: este**. O **Membros** (homologação/onboarding/comunidade/academy, ver [[membros-cadastro-formato]]) continua à parte, mas quem opera o dia a dia faz aqui. Ver [[crm-cliente-final-foco]] e [[estado-sistema-arquitetura]].

**Ponte Membros → plataforma (Jun/2026):** o membro nasce no **Membros** (homologação/onboarding → **comunidade + academy**). Quando fica **ELEGÍVEL**, seus dados **migram para a plataforma como fornecedor ativo** apto a **receber leads** do motor de distribuição. Essa migração/elegibilidade é o vínculo concreto Membros↔`-ramon` (antes vago). Ciclo completo: membro → academy → elegível → migra como fornecedor → recebe lead → vende (CRM) → ganha → vira projeto/obra/serviço → executa (Gestão de Obra) → Hub governa.

**Prioridade do Wendel:** rodar MANUAL primeiro (UI/UX fácil), arquitetura pronta p/ IA, mas **ligar a IA (Bloco H/Anthropic) é futuro** (depende de chave + GO de custo).
