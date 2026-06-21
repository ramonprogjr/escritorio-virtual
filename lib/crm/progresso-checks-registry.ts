import { allProgressoItens, DEPLOY_CHECKLIST, type ProgressoItem, type ProgressoStatus } from "./progresso-sistema-data";
import type { ProgressoCheckDef } from "./progresso-checks-types";

const PIPE = "lib/crm/pipelines.ts";

function grepSlug(slug: string): ProgressoCheckDef {
  return {
    id: `slug-${slug}`,
    type: "grep",
    path: PIPE,
    pattern: slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    required: true,
  };
}

function grepMercado(slug: string): ProgressoCheckDef {
  return {
    id: `mercado-${slug}`,
    type: "grep",
    path: PIPE,
    pattern: slug,
    required: true,
  };
}

function file(path: string, id?: string): ProgressoCheckDef {
  return { id: id ?? `file-${path}`, type: "file_exists", path, required: true };
}

function route(rota: string): ProgressoCheckDef {
  const seg = rota.replace(/^\/crm\/?/, "").split("/").filter(Boolean);
  const page = seg.length ? `app/crm/${seg.join("/")}/page.tsx` : "app/crm/page.tsx";
  return { id: `route-${rota}`, type: "file_exists", path: page, required: false };
}

function migration(file: string): ProgressoCheckDef {
  return {
    id: `migration-${file}`,
    type: "grep",
    path: "supabase/migrations",
    pattern: file.replace(/\.sql$/, ""),
    required: true,
  };
}

/** Checks extra por item — cobre os ~88 requisitos além de codigo/rota/migration base. */
const ITEM_EXTRA_CHECKS: Record<string, ProgressoCheckDef[]> = {
  "ent-lead": [file("lib/crm/hub-insert-crm.ts"), { id: "tbl-leads", type: "supabase_table", table: "hub_leads_crm", required: true }],
  "ent-pessoa": [{ id: "tbl-pessoas", type: "supabase_table", table: "hub_pessoas", required: true }],
  "ent-empresa": [{ id: "tbl-empresas", type: "supabase_table", table: "hub_empresas", required: true }],
  "ent-fornecedor-class": [file("lib/crm/empresa-cadastro.ts"), { id: "grep-segmento", type: "grep", path: "lib/crm/empresa-cadastro.ts", pattern: "segmento", required: false }],
  "ent-homologado-status": [file("app/crm/parceiros/page.tsx")],
  "ent-parceiro-relacao": [file("app/api/crm/parceiros/route.ts", "api-parceiros")],
  "ent-vinculo-pe": [file("app/api/crm/vinculos/pessoa-empresa/route.ts")],
  "ent-imovel": [{ id: "tbl-imoveis", type: "supabase_table", table: "hub_imoveis", required: true }],
  "ent-produto-servico": [
    { id: "tbl-servicos", type: "supabase_table", table: "hub_servicos", required: true },
    file("app/crm/produtos/page.tsx", "ui-produtos"),
  ],
  "ent-negocio-centro": [{ id: "tbl-negocios", type: "supabase_table", table: "hub_negocios", required: true }],

  "nav-vendas": [
    { id: "grep-leads", type: "grep", path: "lib/crm-nav-groups.ts", pattern: "/crm/leads", required: true },
    { id: "grep-pipeline", type: "grep", path: "lib/crm-nav-groups.ts", pattern: "Pipeline", required: false },
  ],
  "nav-produtos": [file("app/crm/produtos/page.tsx", "catalogo-produtos")],
  "nav-projetos-obras": [file("app/crm/obras/page.tsx")],

  "fl-novo": [grepSlug("novo"), migration("20260628120000_hub_pipeline_estagios_pdf_seed.sql")],
  "fl-em-atendimento": [grepSlug("em_atendimento"), file("app/crm/atendimento/page.tsx")],
  "fl-aguardando": [grepSlug("aguardando_resposta"), file("app/api/hub/followup-config/route.ts", "followup-api")],
  "fl-qualificando": [grepSlug("qualificando")],
  "fl-encaminhado": [grepSlug("encaminhado"), file("components/crm/leads/LeadEncaminharModal.tsx")],
  "fl-convertido": [grepSlug("convertido_negocio"), file("app/api/crm/leads/[id]/converter-negocio/route.ts")],
  "fl-perdido": [
    { id: "motivos-perda", type: "grep", path: PIPE, pattern: "MOTIVOS_PERDA", required: true },
    { id: "col-motivo", type: "supabase_column", table: "hub_leads_crm", column: "motivo_perda", required: true },
    { id: "valida-api", type: "grep", path: "app/api/crm/leads/[id]/route.ts", pattern: "motivo_perda", required: false },
  ],
  "fl-spam": [grepSlug("spam_invalido")],
  "fl-card-kanban": [
    { id: "kanban-comp", type: "grep", path: "app/crm/leads/page.tsx", pattern: "kanban", required: true },
    { id: "score", type: "grep", path: "app/crm/leads/page.tsx", pattern: "score", required: false },
  ],
  "fl-separacao": [
    { id: "tbl-leads", type: "supabase_table", table: "hub_leads_crm", required: true },
    { id: "tbl-neg", type: "supabase_table", table: "hub_negocios", required: true },
  ],

  "fn-imob": [grepMercado("imobiliario"), { id: "http-pipelines", type: "http", url: "/api/crm/pipelines?tipo=negocio", jsonMinLength: 1, required: false }],
  "fn-arq": [grepMercado("arquitetura")],
  "fn-obra": [grepMercado("obra_reforma"), file("app/crm/obras/page.tsx")],
  "fn-eng": [grepMercado("engenharia")],
  "fn-marc": [grepMercado("marcenaria_moveis")],
  "fn-srv": [grepMercado("servicos")],
  "fn-pro": [grepMercado("produtos_materiais")],
  "fn-for": [grepMercado("fornecedor_homologacao")],
  "fn-card": [{ id: "neg-page", type: "grep", path: "app/crm/negocios/page.tsx", pattern: "valor", required: false }],
  "fn-derivados": [
    { id: "auto-obra", type: "grep", path: "app/api/crm/negocios", pattern: "obra", required: false },
    file("app/api/crm/negocios/[id]/converter-obra/route.ts", "converter-obra"),
  ],

  "rf-log-etapa": [file("lib/crm/audit-log.ts"), { id: "fn-log", type: "grep", path: "lib/crm/audit-log.ts", pattern: "registrarLogCrm", required: true }],
  "rf-perda-motivo": [
    { id: "motivos", type: "grep", path: PIPE, pattern: "MOTIVOS_PERDA", required: true },
    { id: "block-api", type: "grep", path: "app/api/crm/leads/[id]/route.ts", pattern: "motivo_perda.*obrigat", required: false },
  ],
  "rf-ganho-validacao": [
    { id: "grep-ganho", type: "grep", path: PIPE, pattern: "fechado_ganho", required: true },
    file("app/api/crm/negocios/[id]/marcar-ganho/route.ts", "marcar-ganho"),
  ],
  "rf-alerta-parado": [
    { id: "col-prox", type: "supabase_column", table: "hub_leads_crm", column: "proxima_acao", required: true },
    file("app/api/crm/alertas/parados/route.ts", "alertas-parados"),
  ],
  "rf-ia-limites": [file("app/crm/aprovacoes/page.tsx")],
  "rf-ia-sugere": [file("app/api/crm/distribuicao/sugerir/route.ts")],

  "cl-imob": [file("lib/crm/lead-campos-por-tipo.ts"), file("components/crm/leads/LeadRapidoSideover.tsx")],
  "cl-arq": [{ id: "grep-arq", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "arquitetura", required: true }],
  "cl-obra": [{ id: "grep-obra", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "obra", required: true }],
  "cl-servico": [{ id: "grep-srv", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "servico", required: false }],
  "cl-produto": [{ id: "grep-pro", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "produto", required: false }],
  "cl-homolog": [{ id: "grep-hom", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "homolog", required: false }],
  "cl-dinamicos": [{ id: "grep-metragem", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "metragem", required: false }],
  "cl-canais": [{ id: "grep-origem", type: "grep", path: "lib/crm/lead-campos-por-tipo.ts", pattern: "origem", required: true }],

  "ng-participantes": [file("app/api/crm/negocios/[id]/route.ts")],
  "ng-drawer": [{ id: "grep-drawer", type: "grep", path: "app/crm/negocios/page.tsx", pattern: "participante", required: false }],
  "ng-vinculos-neg": [file("app/api/crm/negocios/[id]/vinculos/route.ts", "vinculos-neg")],
  "ng-seguranca": [file("lib/crm/crm-permissoes.ts")],

  "enc-registro": [file("app/api/crm/encaminhamentos/route.ts", "enc-api")],
  "enc-status": [{ id: "grep-enc", type: "grep", path: "app/api/crm/encaminhamentos/route.ts", pattern: "status", required: false }],
  "enc-ia-first": [
    { id: "flag-enc", type: "env", env: "CRM_ENCAMINHAMENTO_V2", equals: "true", required: false },
    file("app/api/crm/encaminhamentos/[id]/aprovar/route.ts"),
  ],
  "enc-criterios": [file("app/api/crm/distribuicao/sugerir/route.ts")],

  "pa-tipos": [{ id: "tbl-acoes", type: "supabase_table", table: "hub_proximas_acoes", required: false }],
  "pa-obrigatoria": [
    { id: "flag-pa", type: "env", env: "CRM_PROXIMA_ACAO_OBRIGATORIA", equals: "true", required: true },
    { id: "grep-flag", type: "grep", path: "lib/crm/feature-flags.ts", pattern: "proximaAcaoObrigatoria", required: true },
  ],
  "pa-tarefas-ui": [
    file("app/crm/tarefas/page.tsx"),
    { id: "edit-ui", type: "grep", path: "app/crm/tarefas/page.tsx", pattern: "editar", required: false },
  ],
  "pa-atraso": [file("app/api/crm/alertas/atrasadas/route.ts", "alertas-atraso")],
  "pa-ia-sugere": [{ id: "grep-sugere", type: "grep", path: "lib/ia", pattern: "proxima", required: false }],

  "po-proj-ficha": [
    file("app/api/crm/projetos/[id]/route.ts"),
    { id: "ui-briefing", type: "grep", path: "app/crm/projetos", pattern: "briefing", required: false },
  ],
  "po-obra-ficha": [
    file("app/crm/obras/[id]/page.tsx"),
    { id: "diario", type: "grep", path: "app/crm/obras", pattern: "diario", required: false },
  ],
  "po-comissoes": [file("app/crm/comissoes/page.tsx", "mod-comissoes")],
  "po-fin-entidade": [{ id: "grep-fin-tab", type: "grep", path: "app/crm/negocios/[id]/page.tsx", pattern: "financeiro", required: false }],

  "ix-ia-preenche": [file("app/api/whatsapp/webhook/route.ts", "webhook-wa")],
  "ix-confianca": [{ id: "ui-conf", type: "grep", path: "components", pattern: "confianca", required: false }],
  "ix-3-cliques": [file("components/crm/leads/LeadRapidoSideover.tsx")],
  "ix-duplicidade": [file("app/api/crm/verificar-documento/route.ts")],
  "ix-permissoes": [file("app/crm/usuarios/page.tsx"), file("lib/crm/crm-permissoes.ts")],
  "ix-logs": [file("lib/crm/audit-log.ts"), file("app/crm/auditoria/page.tsx", "ui-auditoria")],
  "ix-copiloto": [
    file("app/crm/agentes-reais/page.tsx"),
    { id: "copiloto-real", type: "grep", path: "app/crm/agentes-reais/page.tsx", pattern: "copiloto", required: false },
  ],

  "inf-auth": [file("lib/auth/crm-session.ts"), file("proxy.ts")],
  "inf-tenant": [{ id: "tbl-tenant", type: "supabase_table", table: "hub_tenants", required: true }],
  "inf-render": [{ id: "render-yaml", type: "file_exists", path: "render.yaml", required: true }],
  "inf-pipeline-v2": [{ id: "flag-pipe", type: "grep", path: "lib/crm/feature-flags.ts", pattern: "CRM_PIPELINE_V2", required: true }],
  "inf-migrations-pdf": [
    migration("20260628120000_hub_pipeline_estagios_pdf_seed.sql"),
    { id: "col-estagio", type: "supabase_column", table: "hub_leads_crm", column: "estagio_funil", required: false },
  ],
  "inf-whatsapp": [
    file("app/api/whatsapp/webhook/route.ts"),
    { id: "env-uazapi", type: "env", env: "UAZAPI_BASE_URL", required: false },
  ],
  "inf-analytics": [
    file("app/crm/analytics/page.tsx"),
    { id: "http-analytics", type: "http", url: "/api/crm/analytics/funil-leads", jsonMinLength: 1, required: false },
  ],
  "inf-relatorio-diario": [
    file("app/api/crm/relatorio-diario/route.ts"),
    file("lib/crm/relatorio-diario-aggregate.ts"),
    file("lib/crm/relatorio-diario-pdf.ts"),
    file("lib/crm/relatorio-deploy-resumo.ts"),
    file("lib/crm/relatorio-git-entregas.ts"),
    file("scripts/collect-relatorio-entregas-git.ts"),
    file("lib/crm/relatorio-entregas.generated.json"),
    {
      id: "ui-relatorio-dia",
      type: "grep",
      path: "components/crm/ProgressoSistemaDashboard.tsx",
      pattern: "Relatório do dia",
      required: true,
    },
  ],
  "inf-legado-office": [{ id: "legado", type: "manual", manualStatus: "legado", required: true }],
};

export const DEPLOY_CHECKS: Record<string, ProgressoCheckDef[]> = {
  "mig-refinement": [migration("20260528120000_hub_crm_pdf_refinamento.sql")],
  "mig-pipeline-seed": [migration("20260628120000_hub_pipeline_estagios_pdf_seed.sql")],
  "flag-pipeline": [{ id: "env-pipe", type: "env", env: "CRM_PIPELINE_V2", equals: "true", required: true }],
  "flag-encaminhamento": [{ id: "env-enc", type: "env", env: "CRM_ENCAMINHAMENTO_V2", equals: "true", required: true }],
  "smoke-kanban": [{ id: "http-pipe-lead", type: "http", url: "/api/crm/pipelines?tipo=lead", jsonMinLength: 1, required: true }],
  "smoke-analytics": [{ id: "http-funil", type: "http", url: "/api/crm/analytics/funil-leads", jsonMinLength: 1, required: true }],
  "smoke-negocios": [{ id: "http-neg", type: "http", url: "/api/crm/analytics/funil-negocios", jsonMinLength: 1, required: true }],
};

function resolveCodigoPath(codigo: string): string {
  if (codigo.endsWith(".ts") || codigo.endsWith(".tsx") || codigo.endsWith(".sql")) return codigo;
  return codigo;
}

function checksFromItemMeta(item: ProgressoItem): ProgressoCheckDef[] {
  if (item.id === "inf-legado-office") {
    return [{ id: "legado", type: "manual", manualStatus: "legado", required: true }];
  }

  const checks: ProgressoCheckDef[] = [];
  const seen = new Set<string>();

  function add(c: ProgressoCheckDef) {
    if (seen.has(c.id)) return;
    seen.add(c.id);
    checks.push({ required: c.required ?? true, ...c });
  }

  if (item.codigo) add(file(resolveCodigoPath(item.codigo), `codigo-${item.id}`));
  if (item.rota) add(route(item.rota));
  if (item.migration) add(migration(item.migration));

  for (const extra of ITEM_EXTRA_CHECKS[item.id] ?? []) add(extra);

  if (checks.length === 0) {
    add({
      id: `titulo-${item.id}`,
      type: "grep",
      path: "lib/crm/progresso-sistema-data.ts",
      pattern: item.id,
      required: true,
    });
  }

  return checks;
}

export function getProgressoChecksRegistry(): Record<string, ProgressoCheckDef[]> {
  const registry: Record<string, ProgressoCheckDef[]> = {};
  for (const item of allProgressoItens()) {
    registry[item.id] = checksFromItemMeta(item);
  }
  return registry;
}

export function getDeployChecksRegistry(): Record<string, ProgressoCheckDef[]> {
  const registry: Record<string, ProgressoCheckDef[]> = {};
  for (const row of DEPLOY_CHECKLIST) {
    registry[row.id] = DEPLOY_CHECKS[row.id] ?? [
      { id: `deploy-${row.id}`, type: "grep", path: "lib/crm/progresso-sistema-data.ts", pattern: row.id, required: true },
    ];
  }
  return registry;
}

export function deriveStatusFromChecks(
  checks: { ok: boolean; required: boolean }[],
  manualStatus?: ProgressoStatus
): ProgressoStatus {
  if (manualStatus === "legado") return "legado";
  if (checks.length === 0) return "gap";
  const required = checks.filter((c) => c.required);
  const pool = required.length > 0 ? required : checks;
  const passed = pool.filter((c) => c.ok).length;
  if (passed === pool.length) return "ok";
  if (passed > 0) return "parcial";
  return "gap";
}
