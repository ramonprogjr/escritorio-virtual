---
name: onboarding-membros-referencia-visual
description: Sistema de onboarding (Área de Membros) é a REFERÊNCIA visual/menu para melhorar o app principal
metadata:
  type: reference
---

O dono tem um **2º sistema, o ONBOARDING / Área de Membros**, em `https://obra10-membros.vercel.app` (projeto Vercel `obra10-membros`, team `team_v87I7ynhqDK8YXYFSOPBfnZe`; login do dono `nice.engemp@gmail.com`). É o lado **Hub**: homologação + onboarding + comunidade + academy (ver [[membros-cadastro-formato]]).

**É a REFERÊNCIA de design/menu** que o dono quer trazer pro app principal (Obra10+ / -ramon):
- Identidade **verde escuro da marca + dourado** (o app principal usa cinza-GitHub `#0d1117` genérico).
- **Um único menu em seções** (sidebar no desktop = sanduíche/drawer no mobile), com ícone+label, badges de contagem, item ativo em verde. **Sem barra inferior.**
- Listas **emolduradas** (card de ação + chips de filtro + status em pílula + ações por linha), não "planilha".

**Regra de acesso (elo Membros↔CRM):** cadastro → Aprovado → **Liberado p/ CRM** = membro ganha acesso ao sistema -ramon. Cria conta pelo link de convite com o MESMO e-mail → o sistema vincula sozinho. A **base de cadastros deve ser a mesma** entre os dois (integração futura, dono disse "depois falamos").

**Problema no app principal (`lib/mobile/nav.ts`):** "Pulso" e "CRM" apontam ambos pra `/crm` (Pulso redundante/inútil); aba "Mais" = lista plana sem hierarquia; mobile (barra inferior `MobileShell`) ≠ desktop (sidebar `CRM_NAV_GROUPS`). Diagnóstico+proposta completos em `docs/SIDEQUEST-AUDITORIA-ONBOARDING-E-MENUS.md`. Plano: unificar menu (sanduíche→drawer em seções) + identidade verde + listas emolduradas.
