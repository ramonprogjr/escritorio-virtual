---
name: estado-sistema-arquitetura
description: Estado atual e arquitetura do sistema Hub Obra10+ (módulos do CRM, maturidade, pipeline de mensagem, hospedagem)
metadata:
  type: project
---

Levantamento completo em 2026-06-23 (4 agentes de exploração). Stack: **Next.js 16 App Router · React · Tailwind v4 · Supabase (auth+Postgres+Realtime) · TanStack Query · @xyflow/react (só no editor de playbooks de agente)**. Tema dark próprio verde/dourado (`#0d1117`/`#003b26`/`#c9a24a`) — NÃO o design system azul/Shadcn do CLAUDE.md global.

**Maturidade ALTA.** A maioria das telas `/crm/*` é funcional com dados reais. Navegação em [lib/crm-nav-groups.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/crm-nav-groups.ts), filtrada por papel (`atendente<comercial<financeiro<gestor<owner`). Auth de borda em [proxy.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/proxy.ts): `/crm/*` e `/office/*` exigem cookie de sessão; autorização por papel é **client-side** (layout) — APIs precisam revalidar role server-side.

**Módulos:** Dashboard/Analytics/Relatórios; Vendas (Cadastros unificado pessoa+empresa em `/crm/cadastro`, **Leads e Negócios com Kanban** drag-and-drop HTML5 nativo por etapa, Tarefas, Parceiros); Imóveis; Obras/Pedidos; Projetos; Financeiro (visão/pagar/receber); Atendimento (Inbox omnichannel realtime, Canais, Aprovações); Marketing (Windsor); IA & Automação (Agentes, Ciclos, Ferramentas); Sistema (Config, Integrações, Usuários, Empresas=tenants, Onboarding). Estágios de funil vêm de `/api/crm/pipelines` (tabelas `hub_pipelines`/`hub_pipeline_estagios`).

**Stubs/incompletos:** `/crm/agentes-reais` (Copiloto "Em breve"), `/crm/conteudo`, `/crm/tarefas` (read-only, migração pendente), `/fornecedor/*` (protótipo), `/comando` linka `/office` morto. `office` e `pessoas` e `kpis` são redirects.

**Pipeline de mensagem (núcleo operacional):** WhatsApp/UAZAPI → webhook ([app/api/whatsapp/webhook](C:/Users/wende/Documents/escritorio-virtual-ramon/app/api/whatsapp/webhook/route.ts), auth HMAC/Bearer/header/query) → cria `hub_pessoas`+`hub_leads_crm` → enfileira em **`hub_msg_jobs`** (fila durável, claim atômico `SKIP LOCKED`, exclusão por telefone, retry/dead) → worker ([lib/workers/whatsapp-job-worker.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/workers/whatsapp-job-worker.ts)) → [lib/whatsapp/inbound-message-processor.ts](C:/Users/wende/Documents/escritorio-virtual-ramon/lib/whatsapp/inbound-message-processor.ts) (gates: handoff humano → playbook de triagem determinístico "Maria" → menu UAZAPI → engine IA) → resposta via UAZAPI `/send/text`. Áudio é transcrito na entrada. Detalhes de IA: ver [[agentes-ia-llm-anthropic]].

**Hospedagem:** Render é o alvo "completo" (web + **worker dedicado** + cron `*/5min` que chama `dispatch-ciclos` e `process-whatsapp-jobs`). Vercel tem 8 crons nativos mas **NÃO agenda a fila WhatsApp** (roda inline no webhook). Cron auth: `CRON_SECRET` em produção; fora de produção tudo é autorizado.

**Integrações** (`/crm/integracoes`, detecção por env var): WhatsApp/UAZAPI ✅, IA (Mistral/Anthropic) ✅, Windsor.ai ✅ (único conector de marketing real, Facebook Ads); Meta Ads/Google Ads/GA4 = placeholders "em_breve" sem código. Schema/RLS e alinhamento ao modelo mestre: ver [[schema-rls-alinhamento-mestre]]. Projeto Supabase/login: ver [[supabase-projeto-e-login-local]].
