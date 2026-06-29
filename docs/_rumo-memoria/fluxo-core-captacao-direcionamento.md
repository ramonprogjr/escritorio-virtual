---
name: fluxo-core-captacao-direcionamento
description: O fluxo CANÔNICO do produto (descrito pelo dono 28/jun) — captação→IA qualifica→direciona por perfil→CRM do parceiro→2 olhares→KPIs
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O fluxo central da plataforma, nas palavras do dono (28/jun/2026), em 2 níveis (Hub × Parceiro):

1. **Captação:** cliente entra por **tráfego (anúncio)** OU **cadastro manual** → cai no CRM do **Hub** (marketing/captação é Hub-only — ver [[macro-sequencia-nucleo-primeiro]]).
2. **IA atende e QUALIFICA:** a IA conversa, qualifica e **PREENCHE o CRM** (pessoa/empresa + lead), montando o **PERFIL** do cliente/empresa. (Acende com a chave Mistral — pendente.)
3. **Direcionamento POR PERFIL:** pelo perfil, o lead vai ao destino certo — **arquiteto**, **engenharia**, **serviços** ou **corretor (imóvel)**. (Serviços às vezes entra direto.) É o motor de score → o redesenho do "Direcionar" 1-toque ([[distribuicao-leads-motor]]).
4. **Handoff pro PARCEIRO:** direcionado (ex. arquiteto), o lead aparece no **CRM DELE**, que ele vê pelo **login dele** (o tenant dele).
5. **DOIS olhares:** o parceiro **acompanha no perfil dele**; o Hub vê a **gestão geral de TODOS os leads + o progresso dele**. Mecanismo: lead **MESTRE (Hub) × VINCULADO (parceiro)** — compartilha, não duplica.
6. **KPI + venda:** o Hub acompanha o funil do parceiro em cada lead pra **cobrar KPIs/SLA** (2 níveis) e **fazer a venda acontecer** ([[central-performance-metricas]], [[monetizacao-licenciamento-rede]]).

**Variantes:** **imóvel** (clicou no anúncio de venda) = fluxo de atendimento mais **CURTO** (IA→CRM→corretor parceiro). **Serviços** pode vir direto.

**Dependências:** o passo 4 (parceiro vê pelo login dele) = **multi-tenant go-live** (deixado p/ "depois" — janela). O passo 2 = **Mistral**. Passos 1 e 3 (Hub) já existem/em construção. Ver [[plataforma-arquitetura-visao]].
