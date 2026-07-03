---
name: registros-log-kpi-por-entidade
description: REQUISITO — área de mensagem/log em CADA lead/empresa/negócio/pessoa que registra info/avanços E gera EVENTO estruturado que alimenta os KPIs (é o keystone F4 do blueprint de métricas)
metadata:
  type: project
---

Pedido do Wendel (25/jun/2026): cada **empresa, lead, negócio** (e pessoa) precisa de uma **área de mensagem/registro que gere LOG** — para anotar informações, avanços, andamento. E **já pensando nos KPIs** que combinamos: as funções têm que capturar os dados que dão gestão com qualidade.

**Sacada de produto (como deve ser feito):** o log NÃO é só nota livre. Cada registro deve virar um **EVENTO estruturado** (tipo, autor, entidade, timestamp, payload) → é a **camada de eventos `hub_eventos` (F4)**, keystone de TODAS as métricas ([[central-performance-metricas]]). Assim o "registro que o Wendel quer" e a "fundação dos KPIs" são a MESMA entrega.

**Componente-alvo:** um painel **"Registros"** reutilizável (lead/empresa/negócio/pessoa) com:
- escrever nota/avanço (log livre) + linha do tempo (atividades);
- ações estruturadas do blueprint: **registrar follow-up (com prazo)**, **agendar reunião**, **registrar interação/ligação/proposta** — cada uma emite evento tipado;
- já existe base: `hub_atividades` + `hub_notas` (usadas hoje só no lead). Estender p/ as outras entidades (aditivo) e emitir evento.

**KPIs que isso destrava** (ver blueprint): velocidade/SLA, follow-ups atrasados, TMA/TME/TMR, funil/conversão, atividade por responsável, etc. Sem evento bem registrado, não há KPI confiável.

**Calibração de progresso (correção do Wendel):** medir profundidade FUNCIONAL, não só telas. CRM comercial functionally ~45–50% (telas boas, mas log/KPI/automação faltam). Ver [[feedback-barometro-progresso]], [[crm-prioridade-codigo-unico]], [[ceo-mandato-produto]].
