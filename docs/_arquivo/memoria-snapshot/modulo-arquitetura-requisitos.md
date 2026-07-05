---
name: modulo-arquitetura-requisitos
description: "Requisitos do dono p/ o MÓDULO DE ARQUITETURA (1º módulo, base p/ Engenharia) — IA-first, conversacional como base, CRM próprio com funil editável"
metadata: 
  node_type: memory
  type: project
  originSessionId: 35674bb1-5490-4d72-a299-d5103c9a38bd
---

O dono (28/jun/2026) decidiu construir **por módulo**, e o de **ARQUITETURA primeiro** — "porque ele serve de BASE para o de Engenharia e assim por diante" (o projeto precede/alimenta a obra). Pediu: "pense MUITO BEM, em TUDO, antes".

**Requisitos NÃO-negociáveis do módulo de Arquitetura:**
- **IA-first** — a IA é o motor do módulo, não enfeite.
- **Fácil de usar.**
- **CONVERSACIONAL como BASE** — a forma PRIMÁRIA de operar é CONVERSANDO (voz+texto): o arquiteto fala/escreve e a IA executa (criar projeto, mover no funil, montar programa de necessidades…). A UI visual existe, mas o conversacional é a espinha. Reusar o COPILOTO (CopilotoVoz/useCopilotoVoz/interpretar/executar) + a engine + ferramentas.
- **CRM PRÓPRIO com FUNIL EDITÁVEL** — é o CRM do arquiteto, com seu próprio funil/pipeline cujas ETAPAS o usuário EDITA (reusar hub_pipelines/hub_pipeline_estagios + PipelineConfigSideover). Funil do PROJETO (ex.: Briefing→Estudo→Anteprojeto→Executivo→Aprovação→Entrega, editáveis).
- Click-and-Go + Talk-and-Go, telas para o JOB (não tabela), marca verde+dourado dark, mobile-first.

**Elo:** projeto pronto → base da OBRA (módulo de Engenharia, já parcialmente desenhado — ver [[modulo-engenharia-obra]]). Fluxo: ver [[fluxo-core-captacao-direcionamento]]. Dependência: a IA conversacional acende com a chave Mistral (pendente). Diretriz: mesa redonda + checkpoint do dono ([[feedback-mesa-redonda-e-checkpoint-negocio]]). Próximos módulos depois: Engenharia → demais; multi-tenant na janela.
