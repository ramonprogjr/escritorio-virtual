# Central de Performance Comercial & Atendimento — Blueprint (Obra10+)

> Destilação da visão de produto do Wendel (24/jun/2026) sobre métricas, eventos, módulos, conectores, APIs e dados de um CRM de vendas/atendimento robusto e IA-first. **Não é para construir tudo de uma vez** — é a referência-mestra que guia B4/B5/B5.5/B6/B8 e a camada de eventos (F4). Princípio central: **"sem evento bem registrado, não existe métrica confiável"** e **"o sistema não mostra relatório passivo — ele alerta e orienta a ação"**.

---

## 0. A ideia-mãe: um MÓDULO "Central de Performance"
Não é "CRM com funil". É um **motor de operação comercial**:
> Lead entra → classifica → acha responsável/fornecedor ideal → inicia SLA → cria próxima ação → acompanha atendimento → mede resultado → aprende → melhora a próxima distribuição.

Blocos do módulo: Tempo & SLA · Atendimento & fila · Follow-ups & tarefas · Funil · Conversão & vendas · Equipe & absenteísmo · Qualidade · Distribuição p/ fornecedores · IA & automações · Alertas & riscos.

**Regra de ouro repetida pelo Wendel:** o alerta tem que ser *acionável* —
> ❌ "Você tem 18 follow-ups atrasados."
> ✅ "18 follow-ups atrasados. Destes, **5 são propostas > R$ 50 mil**, **3 clientes responderam hoje**, **2 com alto risco de perda**. Priorize estes agora."

---

## 1. Camada de EVENTOS (a fundação — F4)
Cada ação vira evento com **schema padrão** (sem isto, métrica não é confiável):
```json
{ "event_id","event_type","tenant_id","user_id","entity_type","entity_id",
  "timestamp","channel","source","metadata":{...} }
```
**Taxonomia** (famílias): `lead.*` (created/qualified/assigned/score_updated/temperature_changed/converted/lost…) · `attendance.*` (started/ended/transferred/abandoned/resolved/rated) · `message.*` (received/sent/read/ai_generated/sentiment_detected) · `call.*` · `followup.*` (created/scheduled/completed/missed/auto_created) · `deal.*` (stage_changed/won/lost/lost_reason) · `proposal.*` (sent/opened/viewed/approved/rejected/expired) · `meeting.*` (no_show…) · `task.*` · `sla.*` (started/warning/breached/resolved) · `user.*` (login/pause/shift/absence) · `supplier.*` (matched/offered/accepted/rejected/sla_breached/ranking_updated) · `ai.*` (classified/suggested/risk_detected/handoff).
→ **Tabela `hub_eventos`** (append-only) + helper `emitirEvento()` server-side. É o keystone que destrava métricas/alertas/diário-de-obra/comunidade-feed.

## 2. Blocos de MÉTRICAS (o que medir)
1. **Entrada de leads:** recebidos, por origem/campanha/região/serviço, qualificados/desqualificados, **taxa de qualificação**, custo por lead (qualificado).
2. **Velocidade/SLA:** tempo até 1º contato, **SLA 1º atendimento (%)**, TMR, maior atraso, não atendidos, fora do SLA, tempo até qualificação/proposta/fechamento.
3. **Follow-up (coração):** agendados/realizados/atrasados, **taxa de execução**, leads sem próxima ação, propostas sem follow-up, follow-ups por venda, conversão pós-follow-up.
4. **Atendimento (call-center):** **TMA, TME, TMR, TMO, TMC, ACW**, fila, abandono, FCR.
5. **Funil:** novos→qualificados→reunião→proposta→negociação→ganho/perdido, conversão por etapa, motivo de perda, valor em aberto, **forecast**, **pipeline ponderado**.
6. **Conversão:** lead→atendimento→qualificação→proposta→venda; geral; por origem/vendedor/campanha. (Origem importa: Instagram gera muito e vende pouco; indicação ao contrário.)
7. **Financeiro:** receita, **ticket médio**, margem, **CAC, ROI, LTV, payback**, desconto médio, perda por preço/prazo, comissão prevista.
8. **Equipe/absenteísmo:** atendimentos/leads/propostas/vendas por colaborador, **absenteísmo, ocupação, ociosidade, aderência à escala, turnover**, atividade diária. (Mostrar "muito movimento × muito resultado".)
9. **Qualidade:** **CSAT, NPS, CES, FCR**, reabertura, reclamações, auditoria de conversa, **sentimento**.
10. **Canal (omnichannel):** conversão + TMA + SLA **por canal** (WhatsApp/telefone/e-mail/Instagram/site/indicação/chatbot-IA).
11. **IA:** atendimentos pela IA, transferência p/ humano, resolução pela IA, precisão de classificação, **sugestões aceitas pela equipe**, follow-ups/alertas auto, score de oportunidade, score de risco de perda.
12. **Carteira/relacionamento:** ativos/inativos, sem contato há X, reativação, upsell/cross-sell, **churn, retenção, recorrência**.
13. **Distribuição/fornecedores:** distribuídos, tempo até aceite, recusados (+motivo), **taxa de aceite**, conversão por fornecedor, **SLA do fornecedor**, **ranking**, score de compatibilidade, mal direcionado. (Fornecedor lento perde prioridade no algoritmo.)
14. **Supervisor:** equipe logada/ocupada/ociosa, leads parados e follow-ups vencidos por vendedor, ranking, alertas críticos.

**Siglas:** TMA·TME·TMR·TMO·SLA·FCR·CSAT·NPS·CES·ACW·CAC·LTV·Churn·ROI·ABS·Turnover·Forecast·Pipeline·Win/Lost Rate.

**SLAs recomendados:** lead quente ≤5min · comum ≤15min · cliente respondeu ≤10min · proposta → follow-up 24h · proposta parada → 48h · lead quente sem retorno → alerta imediato.

## 3. DASHBOARDS por perfil (UI/UX — o ponto-chave)
- **Dono/Hub:** receita da plataforma, leads gerados/distribuídos, conversão por empresa, **ranking de fornecedores**, SLA por empresa, taxa de aceite, reclamações, churn de membros, crescimento.
- **Empresa/membro:** leads recebidos/atendidos, vendas, propostas abertas, follow-ups atrasados, ticket, conversão, desempenho da equipe, atendimento por canal.
- **Gestor comercial:** leads parados, vendedores atrasados, follow-ups vencidos, propostas sem retorno, performance individual, forecast, gargalos.
- **Vendedor/atendente:** minhas tarefas de hoje, meus leads novos, meus follow-ups, minhas propostas, clientes sem resposta, minha conversão, minha meta, **alertas do que fazer agora**.

**Indicadores obrigatórios no dashboard principal:** leads novos hoje · leads sem atendimento · tempo médio 1º contato · SLA · follow-ups atrasados · propostas sem retorno · conversão geral/por vendedor/por origem · vendas/receita · ticket médio · motivos de perda · absenteísmo · TMA · CSAT/NPS · ranking de fornecedores.

## 4. ALERTAS que orientam ação
Lead novo parado · cliente respondeu e ninguém viu · follow-up vencido · proposta aberta pelo cliente · proposta sem retorno 48h · SLA rompido · fornecedor não aceitou → redistribuir · fornecedor baixa performance · cliente insatisfeito (sentimento) · vendedor sobrecarregado/ocioso · absenteísmo alto · queda de conversão.

## 5. MÓDULOS/FUNÇÕES, CONECTORES, APIs, DADOS (resumo)
- **Funções:** captura multicanal · **deduplicação** (telefone/email/CPF/CNPJ) · enriquecimento · **distribuição inteligente** (região/serviço/ticket/disponibilidade/SLA/conversão/qualidade/capacidade/ranking) · funil (vários) · **motor de SLA** · **motor de follow-up** · central omnichannel · propostas/orçamentos · atividades · gestão de equipe/jornada · qualidade · **motor de automações** · relatórios por perfil.
- **Conectores:** WhatsApp Business API · VoIP/telefonia · e-mail · SMS · Instagram/Messenger · Google/Outlook Calendar · Meet/Teams/Zoom · Meta/Google Ads · GA4/Tag Manager · RD/HubSpot · assinatura digital · gateway pagamento · NFe · ConsultaCNPJ/CEP/geo · BI (Power BI/Looker) · Zapier/Make/n8n · LLM/STT/TTS/OCR/embeddings/RAG.
- **APIs internas:** /leads · /deals · /attendances · /messages · /tasks+/followups · /sla · /proposals · /suppliers(+match/offer/accept/reject/ranking) · /users(status/shift/pause/absence) · /metrics+/dashboards · /ai.
- **Dados (entidades):** tenant · usuário(papéis) · **lead** · **contato** (vários por lead: proprietário/cônjuge/arquiteto/eng/financeiro/corretor) · conta/cliente · deal · atividade · conversa · mensagem · proposta · produto/serviço · tarefa/follow-up · SLA · jornada/equipe · fornecedor/membro · origem/campanha(UTM) · avaliação/qualidade.
- **Webhooks:** entrada (whatsapp/email/telephony/forms/meta/google-ads/payment/signature/calendar) e saída (lead.created/deal.won/proposal.approved/supplier.lead_assigned/sla.breached/payment.received).

## 6. Faseamento (MVP → 2 → 3) — alinhado ao manual-first
- **MVP:** multiempresa + usuários/permissões + entrada de leads + funil + distribuição + histórico atendimento + WhatsApp + tarefas/follow-ups + **SLA de 1º contato** + propostas + métricas básicas + **alertas** + IA p/ resumo/classificação/próxima-ação.
- **Fase 2:** telefonia · e-mail completo · calendário · assinatura · ERP/financeiro · BI · automação de marketing · ranking avançado de fornecedores · auditoria · forecast.
- **Fase 3:** data warehouse · ML próprio · score avançado de fornecedor · marketplace de integrações · API pública · IA conversacional completa · roteamento preditivo.

---

## 7. MAPEAMENTO ao nosso roadmap (o que já existe × o que falta)
| Tema do blueprint | Nosso bloco | Estado |
|---|---|---|
| Camada de eventos (`hub_eventos`) | **F4 (fundação)** | a construir — **keystone** |
| SLA engine + alertas acionáveis | B5 + dashboard (B4) | parcial (frescor/alertas existem) |
| Funil/conversão/forecast/pipeline ponderado | B5.5 (KPIs) | parcial (funil existe) |
| Distribuição + ranking fornecedores | **B5** | a construir (depende multi-tenant B3.9) |
| Dashboards por perfil (dono/empresa/gestor/vendedor) | B4 | parcial (dashboard único existe) |
| Equipe/absenteísmo/jornada | novo sub-módulo | a construir |
| Qualidade (CSAT/NPS/FCR/sentimento) | B8 (IA) + pós-venda | futuro |
| Omnichannel + dedup + enriquecimento | B2/B3 + conectores | parcial |
| Carteira/churn/recorrência | pós-venda | futuro |

**Conclusão de arquitetura:** quase tudo aqui depende de **(1) camada de eventos (F4)** e **(2) multi-tenant real (B3.9)** + **distribuição (B5)**. Construir a Central de Performance "de verdade" começa por esses fundamentos. Antes disso, dá para entregar **fatias de UI/UX** sobre os dados que já temos (dashboard acionável por perfil, tela de follow-ups priorizada).
