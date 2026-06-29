---
name: crm-prioridade-codigo-unico
description: PRIORIDADE #1 do Wendel — fechar o CRM (cadastros pessoa/empresa/lead/negócio com CÓDIGO ÚNICO, vínculos N:N, atendimento só-Meta com cadastro automático, multi-tenant p/ distribuir leads a empresas homologadas) ANTES de avançar p/ totem/obra
metadata:
  type: project
---

Diretriz explícita do Wendel (24–25/jun/2026): **terminar o CRM 100% antes de avançar** para os outros módulos (totem de materiais, obra). É a prioridade declarada.

**Codificação única (confirmada com ele):**
- Toda parte (pessoa PF / empresa PJ) existe **uma vez** e ganha um **código interno único** estável. **CPF/CNPJ é a chave natural** que ancora identidade *quando existe* e serve p/ **deduplicar/mesclar**.
- Lead da Meta costuma chegar **sem documento** (só nome+telefone) → cria cadastro único na hora com o que tem, usando **telefone/e-mail como chave secundária de dedup**; quando CPF/CNPJ aparece, **merge no mesmo código** (nunca duplica).
- **Lead não é entidade duplicada** — é porta de entrada/estado ligado ao cadastro único; pode ser de pessoa OU empresa.
- **Relações N:N:** pessoa↔empresa (sócio/contato/responsável), pessoa↔negócio, empresa↔negócio. "Colocar todo mundo no negócio" = anexar N partes pelo código.
- **Negócio = centro.** O código único destrava: (1) não-duplicação, (2) histórico consolidado (base de logs/follow-up/métricas nos cards), (3) rateio de comissão, (4) **redirecionamento multi-tenant** (Hub roteia lead → empresa homologada/tenant; Hub vê tudo = controle total).

**Sequência a fechar (ordem acordada):**
1. Fundação do cadastro único (modelo pessoa/empresa/lead/negócio + N:N + código + dedup doc/telefone).
2. Telas de cadastro nos **3 toques** (PF/PJ unificado, IA pré-preenche) — onde está a dor de UI.
3. Vínculos (pessoa↔empresa; anexar partes ao negócio).
4. **Atendimento + cadastro automático — só canais Meta** (Lead Ads + DMs IG/FB; Google Ads como origem). 90% dos clientes vêm de Meta+Google. Tem que funcionar 100% (já há empresas/pessoas reais p/ cadastrar).
5. **Multi-tenant no CRM** (B3.9 fundação): tenant por empresa homologada; `current_user_tenant_id` real; RLS; Hub vê tudo, empresa vê só o dela. É a parte estrutural mais delicada — fazer aditivo, sem quebrar o single-tenant atual.
6. **Distribuição** lead → empresa homologada (motor score/SLA) = controle total.
7. **Métricas/eventos** em cima dessa base (camada de eventos → cards com log/follow-up/agendamento).

Passos 1–4 dá p/ atacar já (single-tenant); 5–6 é a virada multi-tenant (cuidado cirúrgico). Doc-fonte de métricas: [[central-performance-metricas]]. Ver também [[spec-funcional-crm-hub-obra10]], [[distribuicao-leads-motor]], [[plataforma-arquitetura-visao]], [[plano-executivo-blocos]], [[crm-cliente-final-foco]].

**Visão de produto que isso serve (não esquecer):** o alvo grande é um "**iFood/totem de materiais para obra**" (escolher conversando como pedir comida → compra → entrega), com **spread** como receita; alimentado pelo **orçamento/escopo da obra** (lista de materiais nasce do projeto, não é digitada). É pós-CRM. Ver [[backlog-features-futuras]] (F2) e [[monetizacao-licenciamento-rede]].
