# CRM Gate 0 — inventário (produção)

Gerado como checklist pré-implementação do plano consolidado Hub Obra10+.

## APIs CRM em uso

- `POST/PATCH/DELETE /api/crm/cadastro`, `/api/crm/pessoas`, `/api/crm/empresas`
- `GET /api/crm/pessoas/[id]/vinculos`, `/api/crm/empresas/[id]/vinculos`
- `POST/DELETE /api/crm/vinculos/pessoa-empresa`
- `POST /api/crm/leads/[id]/converter-negocio`
- Encaminhamentos: `hub_encaminhamentos`, `/crm/aprovacoes`

## Tabelas

`hub_pessoas`, `hub_empresas`, `hub_pessoas_empresas`, `hub_leads_crm`, `hub_negocios`, `hub_negocio_vinculos`, `hub_parceiros`, `hub_encaminhamentos`

## Flags Render (não alterar defaults existentes)

- `CRM_DISTRIBUICAO_AUTO`, `CRM_ENCAMINHAMENTO_V2`, `CRM_PIPELINE_V2`

## Novas flags (plano)

- `CRM_IA_AUTO_CADASTRO` — default `false`
- `CRM_VINCULO_PARCEIRO_AUTO` — default `false`
- `CRM_RASTREIO_BUSCA` — default `true`

## Migração pendente de confirmar

- `20260530120000_hub_pessoas_tenant_backfill.sql` — backfill `tenant_id` NULL → Obra10

## Regressão manual

1. `/crm/cadastro` lista + sideover
2. Converter lead → negócio
3. Encaminhamento / aprovações
4. `npm run build`
