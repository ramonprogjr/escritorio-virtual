---
name: plano-executivo-blocos
description: Roteiro ativo de execução em blocos (B0–B8) da plataforma Obra10+; doc em repo; B1 (menu §8) entregue
metadata:
  type: project
---

O roteiro de execução ativo é **`docs/PLANO-EXECUTIVO-BLOCOS.md`** (commit `0a722fa`): blocos sequenciais e fecháveis que consolidam as Fases §10 da spec (backend) com as Ondas U1–U6 da auditoria UX. Regra de ouro de todo bloco: **aditivo, preservar > reescrever (§14.1), gate = `tsc` + `vitest` + `_chk23`, sem push/secrets**.

Blocos: B0 base ✅ · **B1 navegação/U1** · **B1.5 auditoria info menu↔tela** · B2 cadastros Pipedrive/SmartField/U2 · B3 CRM fornecedor/U3 · B4 visibilidade+governança Hub (RLS `fornecedor_id`) · B5 motor distribuição/U4 · B6 gestão de obra/U5 · B7 ponte Membros · B8 IA-first/U6 [futuro].

**Entregue (24/jun/2026):** menu reagrupado no modelo §8 em `lib/crm-nav-groups.ts` (Visão Geral · Aprovações · Comercial/CRM · Operações/Obras · Fornecedores · Financeiro · Marketing · IA e Agentes · Administração) — só rotas existentes, `minRole` preservado, 175/175. Ajustes de IA do menu: Aprovações junto de Tarefas (Comercial/CRM); Integrações → IA e Agentes; Onboarding (tenant, tela solta) saiu do menu; grupo **Comunidade reservado** (ponte Membros B7, telas vêm do sistema Membros). CommandBar (⌘K) já existia; falta só a voz.

**Bloco 1.5 FECHADO (24/jun):** Integrações→IA e Agentes; Onboarding fora do menu; **Empresas→"Escritórios"** (menu+tela, é admin multi-tenant `/api/crm/tenants`, ≠ cadastro PJ). Auditoria: **31/31 telas REAIS, zero mismatch**; **Cadastros PF/PJ JÁ unificado** em `/crm/cadastro` (abas Contatos+Empresas, CadastroWizard, fichas correlacionadas, vínculo PF↔PJ — não refazer).

**Bloco 2 / U2 em progresso (24/jun, local, mesa redonda UX+revisão):** ✅ **QuickAdd FAB** (`CrmQuickAdd.tsx`) role-aware, deep-link `?novo=1`/`?novo=pf|pj`. ✅ **SmartField v2** + **ConfidenceBadge** + `smartfield-faixas.ts` (testado): chips seleção única, radiogroup+setas, toque ≥40px, foco/hover/`disabled`, voz=selo "em breve", aceita opções `readonly`. ✅ **Rollout Click-and-Go** nos criadores: Lead (Origem, tipo_interesse, campos dinâmicos), Negócio (Mercado, Etapa), Empresa (Mercado, Segmento), Imóvel (Tipo, Finalidade). "Área de atuação" (12) fica dropdown. ✅ Revisão técnica: paridade OK + corrigido bug latente (etapa negócio `novo_negocio`→`novo`). Suíte **178/178**. Pendente: validação visual desktop/mobile; edit-mode sideovers (follow-up); voz no fim.

**Auth (24/jun):** "Esqueci minha senha" + `/redefinir-senha` + hardening; **fix login intermitente** (retry no `crm-session` por 401 transitório de rede/TLS). Config Supabase (Redirect URLs/SMTP) e troca da senha exposta = pendências do Wendel (docs/PENDENCIAS.md).

**Bloco 3 (fatia segura, decisão do agente diretor) — COMPLETO (24/jun, verificado no browser):** cartão acionável (próxima-ação no negócio + `lib/crm/sla-frescor.ts` testado); config de pipeline já existia/ligada/montada (verificada pós-RLS). **RLS tenant-aware de `hub_pipeline_estagios` APLICADO** (migração `rls_pipeline_estagios_tenant_aware`, autorização explícita do Wendel; service role bypassa → Kanban OK). Faltam no B3 (futuro): reordenar etapa por drag, guard não-destrutivo, inbox+IA (B8).

**⏸ Gated (Wendel):** integrar SmartField em forms (após faixas vs valor exato); voz (on-device vs serviço); **B4 governança/RLS `fornecedor_id`** e **B5 distribuição** = grandes/trava, só com supervisão. Tudo em docs/PENDENCIAS.md (fonte única). Ver [[crm-cliente-final-foco]], [[monetizacao-licenciamento-rede]], [[feedback-mesa-redonda-uiux]].
