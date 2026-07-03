---
name: ondas-2-4-qa-remediado-03jul
description: Remediação QA em ondas (03/jul) — cockpit por persona, busca por nome, escrow no dashboard, botões mortos — no ar; delete-físico REFUTADO
metadata:
  type: project
---

Remediação da auditoria QA ([[laudo-produto-02jul]]) executada em ondas sequenciais no dia 03/jul (manhã), cada uma com gate verde (tsc/vitest/build) + revisão + commit + deploy staging. Logins externos seguem OFF.

- **Onda 2 — COCKPIT por persona (P0#1, fix-mãe)** — commit 1cbbea9, deploy 18feee4. `/crm` deixa de ser persona-cego: `aggregateDashboard(persona)` mantém comercial/HUB VERBATIM e dá recorte próprio a engenharia/arquiteto/cliente/fornecedor. Arquivos-chave: `lib/crm/persona-cockpit.ts` (mapa role→persona, puro), `lib/crm/persona-cockpit-aggregate.ts` (server), `components/crm/dashboard/CrmComercialDashboard.tsx` (extraído), `CrmPersonaCockpit.tsx`. Route trocou `requireCrmSessao`→`getCallerContext` (papéis do ecossistema em inglês davam 403). **Pendência R7** (follow-up): default de role desconhecido cai em "comercial" (fail-open aceitável hoje, endurecer p/ fail-closed). **R3**: `hub_obras.cliente_pessoa_id` NULL em todas as obras → cockpit do cliente vazio até janela do dono ligar.
- **Onda 3** — commit 9022abb, deploy d11c6de. (1) Busca do cabeçalho por NOME real (`/api/crm/rastreio?q=` aditivo; `lib/crm/rastreio-busca.ts` tenant `.eq` puro + `sanitizarBuscaNome` anti or-injection). (2) Escrow voltou ao dashboard: `finance-dashboard-aggregate` filtrava tipos inexistentes (`pagamento`/`financeiro`) → fonte única `lib/crm/aprovacoes-tipos.ts` (orcamento_frente/pagamento_obra_arq/hub/cotacao_fornecedor). (3) Botão Exportar CSV em /crm/relatorios + hardening anti CSV formula injection.
- **Onda 4** — commit 4ea4854, deploy 4fad7a5. Parceiro "Abrir painel" (sem HMAC, erro 100%) → copy honesto. Imóveis `STATUS_EDITAVEIS` alinhado ao CHECK real (tinha captacao/inativo inválidos → 23514; faltava alugado/indisponivel). Arquitetura KPI "Atrasados" → filtro-toggle do board.

**Descartados com honestidade (contrato [[contrato-ceo-honesto-sem-bajulacao]]):** "pessoas/empresas Editar grava campo obsoleto" NÃO se reproduz (saves enviam campos atuais + recarregam). "4 telas dão DELETE físico" REFUTADO — contatos/canais/distribuição/cadastro já são "só arquiva" ([[delete-so-arquiva-nunca-apaga]]) desde 9881fdc.

**Guardado p/ o dono (depende dele):** portal fornecedor real (login externo OFF) · dinheiro fluir + MEDIÇÃO + escrow dupla-chave (SQL/janela) · pacote RLS/backfill tenant-NULL (inclui trocar `tenantScopeOrFilter`→`.eq` no resolver de código `?codigo=`) · cron KPIs (Render) · desambiguar fornecedor×parceiro×empresa · tarefas rename-vs-build. Detalhe em docs/PENDENCIAS-AMANHA.md.
