/** Matriz viva: PDFs Hub Obra10+ vs implementação atual. Status vem do verify no deploy. */
export const PROGRESSO_SISTEMA_REVISAO = "2026-06-22";

export type ProgressoStatus = "ok" | "parcial" | "gap" | "legado";
export type ProgressoFase = "F0" | "F1" | "F2" | "F3" | "F4" | "F5";
export type ProgressoPrioridade = "P0" | "P1" | "P2";

export type ProgressoItem = {
  id: string;
  pdfRef: string;
  titulo: string;
  status: ProgressoStatus;
  fase: ProgressoFase;
  prioridade: ProgressoPrioridade;
  oQueTemos: string;
  oQueFalta: string;
  rota?: string;
  codigo?: string;
  migration?: string;
};

export type ProgressoBloco = {
  id: string;
  titulo: string;
  descricao: string;
  itens: ProgressoItem[];
};

export type ProgressoFaseInfo = {
  id: ProgressoFase;
  label: string;
  periodo: string;
  escopo: string;
};

export const PROGRESSO_FASES: ProgressoFaseInfo[] = [
  { id: "F0", label: "F0 — Concluído", periodo: "até hoje", escopo: "Base operacional: auth, cadastros, leads, negócios, atendimento, agentes, analytics, deploy Render" },
  { id: "F1", label: "F1 — Estabilização PDF", periodo: "2–3 semanas", escopo: "Funis + BD: migrations PDF em prod, kanban 8 colunas, motivos perda, encaminhamento completo" },
  { id: "F2", label: "F2 — Operação comercial", periodo: "3–4 semanas", escopo: "Próxima ação obrigatória, tarefas editáveis, follow-up automático, transição WhatsApp" },
  { id: "F3", label: "F3 — Módulos de entrega", periodo: "4–6 semanas", escopo: "Fichas projeto/obra, negócio ganho → obra/projeto, comissões/repasses" },
  { id: "F4", label: "F4 — Catálogo e homologação", periodo: "4–6 semanas", escopo: "UI produtos/serviços, homologação como filtro pessoa/empresa" },
  { id: "F5", label: "F5 — Governança e IA", periodo: "contínuo", escopo: "Auditoria UI, confiança IA, duplicidade/mesclagem, copiloto global" },
];

export type DeployCheckItem = {
  id: string;
  label: string;
  local: boolean;
  staging: boolean;
  producao: boolean;
};

export const DEPLOY_CHECKLIST: DeployCheckItem[] = [
  { id: "mig-refinement", label: "Migration 20260528120000_hub_crm_pdf_refinement.sql", local: true, staging: false, producao: false },
  { id: "mig-pipeline-seed", label: "Migration 20260628120000_hub_pipeline_estagios_pdf_seed.sql", local: true, staging: false, producao: false },
  { id: "flag-pipeline", label: "CRM_PIPELINE_V2=true", local: true, staging: false, producao: false },
  { id: "flag-encaminhamento", label: "CRM_ENCAMINHAMENTO_V2=true", local: false, staging: false, producao: false },
  { id: "smoke-kanban", label: "Smoke kanban leads (8 etapas)", local: false, staging: false, producao: false },
  { id: "smoke-analytics", label: "Analytics funil leads (8 linhas)", local: false, staging: false, producao: false },
  { id: "smoke-negocios", label: "Analytics funil negócios por mercado", local: false, staging: false, producao: false },
];

function item(partial: ProgressoItem): ProgressoItem {
  return partial;
}

export const PROGRESSO_BLOCOS: ProgressoBloco[] = [
  {
    id: "entidades",
    titulo: "1. Modelo de dados e entidades",
    descricao: "PDF Consolidado Partes 3–10, 15 — lead, pessoa, empresa, negócio, ativos",
    itens: [
      item({ id: "ent-lead", pdfRef: "Consolidado P3", titulo: "Lead separado de pessoa e negócio", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_leads_crm, /crm/leads, /crm/atendimento", oQueFalta: "—", rota: "/crm/leads", codigo: "lib/crm/hub-insert-crm.ts" }),
      item({ id: "ent-pessoa", pdfRef: "Consolidado P6", titulo: "Pessoa PF permanente com código PS", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_pessoas, ficha /crm/pessoas/[id]", oQueFalta: "Abas completas (comissões, documentos) parciais", rota: "/crm/cadastro", codigo: "app/api/crm/pessoas" }),
      item({ id: "ent-empresa", pdfRef: "Consolidado P7", titulo: "Empresa PJ permanente com código EMP", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_empresas, ficha /crm/empresas/[id]", oQueFalta: "Códigos segmento EMP-ARQ etc. parciais", rota: "/crm/cadastro", codigo: "app/api/crm/empresas" }),
      item({ id: "ent-fornecedor-class", pdfRef: "Consolidado P1", titulo: "Fornecedor como classificação (não cadastro)", status: "parcial", fase: "F4", prioridade: "P1", oQueTemos: "Segmento em pessoa/empresa", oQueFalta: "Remover duplicidade conceitual com hub_parceiros", codigo: "lib/crm/empresa-cadastro.ts" }),
      item({ id: "ent-homologado-status", pdfRef: "Consolidado P9", titulo: "Homologado como status em pessoa/empresa", status: "parcial", fase: "F4", prioridade: "P1", oQueTemos: "hub_parceiros + status", oQueFalta: "Filtros Homologação/Homologados sem entidade separada", rota: "/crm/parceiros" }),
      item({ id: "ent-parceiro-relacao", pdfRef: "Consolidado P1", titulo: "Parceiro como relação comercial", status: "parcial", fase: "F4", prioridade: "P2", oQueTemos: "Módulo Parceiros operacional", oQueFalta: "Alinhar modelo ao PDF (relação, não entidade principal)", rota: "/crm/parceiros" }),
      item({ id: "ent-vinculo-pe", pdfRef: "Consolidado P8", titulo: "Vínculo pessoa–empresa com função", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "hub_pessoas_empresas, APIs vinculos", oQueFalta: "UI completa função/departamento/cargo no vínculo", codigo: "app/api/crm/vinculos/pessoa-empresa" }),
      item({ id: "ent-imovel", pdfRef: "Consolidado P15", titulo: "Imóvel como ativo imobiliário", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "/crm/imoveis, hub_imoveis", oQueFalta: "Status captado/vendido completo na ficha", rota: "/crm/imoveis" }),
      item({ id: "ent-produto-servico", pdfRef: "Consolidado P15", titulo: "Produto e serviço separados do fornecedor", status: "gap", fase: "F4", prioridade: "P1", oQueTemos: "hub_servicos no BD", oQueFalta: "UI catálogo produtos/serviços no app principal", codigo: "supabase/migrations/20260523120000_crm_integral_core.sql" }),
      item({ id: "ent-negocio-centro", pdfRef: "Consolidado P10", titulo: "Negócio como centro comercial", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_negocios, kanban /crm/negocios", oQueFalta: "Ficha detalhada incompleta", rota: "/crm/negocios" }),
    ],
  },
  {
    id: "menu",
    titulo: "2. Menu e navegação",
    descricao: "PDF Consolidado Parte 2 — estrutura de menus",
    itens: [
      item({ id: "nav-vendas", pdfRef: "Consolidado P2", titulo: "Vendas: Leads, Negócios, Atendimento, Pipeline, Tarefas", status: "parcial", fase: "F0", prioridade: "P1", oQueTemos: "Leads, Negócios, Atendimento, Tarefas no menu", oQueFalta: "Pipeline como item dedicado (hoje embutido em leads/negócios)", codigo: "lib/crm-nav-groups.ts" }),
      item({ id: "nav-cadastros", pdfRef: "Consolidado P2", titulo: "Cadastros: Pessoas e Empresas", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "/crm/cadastro unificado", oQueFalta: "—", rota: "/crm/cadastro" }),
      item({ id: "nav-homologacao", pdfRef: "Consolidado P2", titulo: "Fornecedores em homologação / Homologados", status: "parcial", fase: "F4", prioridade: "P1", oQueTemos: "/crm/parceiros", oQueFalta: "Filtros por segmento (arquiteto, corretor, etc.) como no PDF", rota: "/crm/parceiros" }),
      item({ id: "nav-produtos", pdfRef: "Consolidado P2", titulo: "Produtos e ativos (catálogo amplo)", status: "gap", fase: "F4", prioridade: "P1", oQueTemos: "Imóveis no menu", oQueFalta: "Marcenaria, marmoraria, revestimentos, etc." }),
      item({ id: "nav-projetos-obras", pdfRef: "Consolidado P2", titulo: "Projetos e Obras", status: "parcial", fase: "F3", prioridade: "P1", oQueTemos: "Menus /crm/projetos e /crm/obras", oQueFalta: "Fichas operacionais completas", rota: "/crm/projetos" }),
      item({ id: "nav-financeiro", pdfRef: "Consolidado P2", titulo: "Financeiro completo", status: "parcial", fase: "F3", prioridade: "P1", oQueTemos: "Visão + pagar/receber", oQueFalta: "Comissões, repasses, histórico por entidade", rota: "/crm/financeiro" }),
      item({ id: "nav-progresso", pdfRef: "Plano interno", titulo: "Progresso sistema (cronograma PDF vs código)", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "Esta página + PDF do dia (commits Git + operação + estado)", oQueFalta: "Manter matriz atualizada ao fechar gaps", rota: "/crm/progresso-sistema" }),
    ],
  },
  {
    id: "funil-leads",
    titulo: "3. Funil de leads (8 etapas)",
    descricao: "PDF Funil Partes 2–3 + Consolidado P11",
    itens: [
      item({ id: "fl-novo", pdfRef: "Funil P2", titulo: "Etapa Novo — entrada automática", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "slug novo em pipelines.ts + kanban", oQueFalta: "Validar seed BD em prod", codigo: "lib/crm/pipelines.ts", migration: "20260628120000_hub_pipeline_estagios_pdf_seed.sql" }),
      item({ id: "fl-em-atendimento", pdfRef: "Funil P2", titulo: "Etapa Em atendimento", status: "parcial", fase: "F2", prioridade: "P0", oQueTemos: "Slug em_atendimento definido", oQueFalta: "Transição automática na 1ª resposta WhatsApp", rota: "/crm/atendimento" }),
      item({ id: "fl-aguardando", pdfRef: "Funil P2", titulo: "Etapa Aguardando resposta + follow-up", status: "gap", fase: "F2", prioridade: "P0", oQueTemos: "Slug aguardando_resposta", oQueFalta: "Tarefa automática de follow-up por prazo", codigo: "app/api/hub/followup-config" }),
      item({ id: "fl-qualificando", pdfRef: "Funil P2", titulo: "Etapa Qualificando", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "Slug + kanban", oQueFalta: "—", rota: "/crm/leads" }),
      item({ id: "fl-encaminhado", pdfRef: "Funil P2", titulo: "Etapa Encaminhado", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "Slug + modal encaminhar", oQueFalta: "Sincronizar estágio ao encaminhar", codigo: "components/crm/leads/LeadEncaminharModal.tsx" }),
      item({ id: "fl-convertido", pdfRef: "Funil P2", titulo: "Etapa Convertido em negócio", status: "parcial", fase: "F0", prioridade: "P0", oQueTemos: "API converter-negocio", oQueFalta: "Estágio visual após conversão", codigo: "app/api/crm/leads/[id]/converter-negocio" }),
      item({ id: "fl-perdido", pdfRef: "Funil P2", titulo: "Etapa Perdido com motivo obrigatório", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "MOTIVOS_PERDA (14) + coluna motivo_perda", oQueFalta: "Validação API/UI obrigatória", codigo: "lib/crm/pipelines.ts" }),
      item({ id: "fl-spam", pdfRef: "Funil P2", titulo: "Etapa Spam ou inválido", status: "ok", fase: "F0", prioridade: "P2", oQueTemos: "Slug spam_invalido", oQueFalta: "—" }),
      item({ id: "fl-card-kanban", pdfRef: "Funil P14", titulo: "Card ideal do kanban (score, botões rápidos)", status: "parcial", fase: "F2", prioridade: "P2", oQueTemos: "Card básico no kanban", oQueFalta: "Score, tempo sem resposta, botões abrir/encaminhar/converter" }),
      item({ id: "fl-separacao", pdfRef: "Funil P1", titulo: "Separação obrigatória Lead vs Negócio", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "Tabelas e funis separados", oQueFalta: "—" }),
    ],
  },
  {
    id: "funil-negocios",
    titulo: "4. Funis de negócio por mercado",
    descricao: "PDF Funil Partes 4–11 — 8 mercados com etapas próprias",
    itens: [
      item({ id: "fn-imob", pdfRef: "Funil P4", titulo: "Mercado Imobiliário (10 etapas)", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "ETAPAS_NEGOCIO_POR_MERCADO.imobiliario", oQueFalta: "Validar kanban + seed BD em prod", rota: "/crm/negocios", codigo: "lib/crm/pipelines.ts" }),
      item({ id: "fn-arq", pdfRef: "Funil P5", titulo: "Mercado Arquitetura (11 etapas)", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "Spec completa em código", oQueFalta: "Kanban por mercado validado em prod" }),
      item({ id: "fn-obra", pdfRef: "Funil P6", titulo: "Mercado Obra e reforma (11 etapas)", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "Spec + etapa Obra criada", oQueFalta: "Automação negócio → módulo Obra", rota: "/crm/obras" }),
      item({ id: "fn-eng", pdfRef: "Funil P7", titulo: "Mercado Engenharia civil (12 etapas)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Spec em pipelines.ts", oQueFalta: "UI kanban validada" }),
      item({ id: "fn-marc", pdfRef: "Funil P8", titulo: "Mercado Marcenaria e móveis (11 etapas)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Spec em pipelines.ts", oQueFalta: "Fornecedor sugerido + cotação na UI" }),
      item({ id: "fn-srv", pdfRef: "Funil P9", titulo: "Mercado Serviços (10 etapas)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Spec em pipelines.ts", oQueFalta: "Execução agendada na UI" }),
      item({ id: "fn-pro", pdfRef: "Funil P10", titulo: "Mercado Produtos e materiais (10 etapas)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Spec em pipelines.ts", oQueFalta: "Entrega em andamento na UI" }),
      item({ id: "fn-for", pdfRef: "Funil P11", titulo: "Fornecedor em homologação (12 etapas)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Spec fornecedor_homologacao", oQueFalta: "Pipeline dedicado no kanban parceiros" }),
      item({ id: "fn-card", pdfRef: "Funil P15", titulo: "Card ideal negócio (valor, alerta atraso)", status: "parcial", fase: "F2", prioridade: "P2", oQueTemos: "Card básico kanban", oQueFalta: "Participantes, origem, alerta atraso" }),
      item({ id: "fn-derivados", pdfRef: "Funil P4/P5", titulo: "Fechado ganho → negócios derivados", status: "gap", fase: "F3", prioridade: "P0", oQueTemos: "Links manuais na UI", oQueFalta: "Automação criar obra/projeto/produto" }),
    ],
  },
  {
    id: "regras-funil",
    titulo: "5. Regras gerais de funil",
    descricao: "PDF Funil Partes 12–13, 16–17",
    itens: [
      item({ id: "rf-log-etapa", pdfRef: "Funil P12", titulo: "Log em toda mudança de etapa", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_logs + registrarLogCrm", oQueFalta: "—", codigo: "lib/crm/audit-log.ts" }),
      item({ id: "rf-perda-motivo", pdfRef: "Funil P12", titulo: "Perda exige motivo (lista padrão)", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "MOTIVOS_PERDA", oQueFalta: "Bloqueio API ao perder sem motivo" }),
      item({ id: "rf-ganho-validacao", pdfRef: "Funil P12", titulo: "Ganho exige pessoa, valor, comissão", status: "gap", fase: "F3", prioridade: "P0", oQueTemos: "Etapas fechado_ganho", oQueFalta: "Validação gestor/financeiro" }),
      item({ id: "rf-alerta-parado", pdfRef: "Funil P12", titulo: "Alerta oportunidade parada / sem próxima ação", status: "gap", fase: "F2", prioridade: "P0", oQueTemos: "Coluna proxima_acao", oQueFalta: "Alertas automáticos no dashboard" }),
      item({ id: "rf-ia-limites", pdfRef: "Funil P16", titulo: "IA não decide encaminhamento/ganho sozinha", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "/crm/aprovacoes", oQueFalta: "Cobertura total dos fluxos sensíveis", rota: "/crm/aprovacoes" }),
      item({ id: "rf-ia-sugere", pdfRef: "Funil P16", titulo: "IA sugere mercado, etapa, fornecedor, risco", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "distribuicao/sugerir, copilot negócios", oQueFalta: "Registro aceite/recusa humano em todos os campos" }),
    ],
  },
  {
    id: "campos-lead",
    titulo: "6. Campos de lead por tipo",
    descricao: "PDF Consolidado Partes 3, 5–6",
    itens: [
      item({ id: "cl-imob", pdfRef: "Consolidado P5", titulo: "Lead imobiliário (formulário mínimo)", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "lead-campos-por-tipo + LeadRapidoSideover", oQueFalta: "Ação principal encaminhar corretor em 3 cliques", codigo: "lib/crm/lead-campos-por-tipo.ts" }),
      item({ id: "cl-arq", pdfRef: "Consolidado P5", titulo: "Lead arquitetura", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Campos bairro, metragem, prazo", oQueFalta: "IA resumo briefing inicial" }),
      item({ id: "cl-obra", pdfRef: "Consolidado P5", titulo: "Lead obra/reforma", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Campos tipo obra, tem projeto", oQueFalta: "IA grau urgência" }),
      item({ id: "cl-servico", pdfRef: "Consolidado P5", titulo: "Lead serviço específico", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Lista serviços pintura/elétrica/etc.", oQueFalta: "Fotos obrigatórias no fluxo" }),
      item({ id: "cl-produto", pdfRef: "Consolidado P5", titulo: "Lead produto/material", status: "parcial", fase: "F1", prioridade: "P2", oQueTemos: "Campos produto, prazo compra", oQueFalta: "Vínculo projeto" }),
      item({ id: "cl-homolog", pdfRef: "Consolidado P5", titulo: "Lead fornecedor homologação", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Campos segmento, região", oQueFalta: "Entrada direta no funil homologação" }),
      item({ id: "cl-dinamicos", pdfRef: "Consolidado P4", titulo: "Faixas metragem, prazo, urgência reutilizáveis", status: "parcial", fase: "F2", prioridade: "P2", oQueTemos: "Alguns enums no código", oQueFalta: "Padronizar em todos os formulários" }),
      item({ id: "cl-canais", pdfRef: "Consolidado P4", titulo: "Canais de origem (LinkedIn, Meta, etc.)", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "Catálogo origens no lead", oQueFalta: "—" }),
    ],
  },
  {
    id: "negocio",
    titulo: "7. Negócio — centro da operação",
    descricao: "PDF Consolidado Partes 10, 20",
    itens: [
      item({ id: "ng-campos", pdfRef: "Consolidado P10", titulo: "Campos essenciais (título, mercado, etapa, origem)", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_negocios + kanban", oQueFalta: "—", rota: "/crm/negocios" }),
      item({ id: "ng-participantes", pdfRef: "Consolidado P10", titulo: "Participantes com papéis (corretor, arquiteto, etc.)", status: "parcial", fase: "F2", prioridade: "P0", oQueTemos: "hub_negocio_vinculos API", oQueFalta: "UI completa + regras gestor", codigo: "app/api/crm/negocios/[id]" }),
      item({ id: "ng-drawer", pdfRef: "Consolidado P10", titulo: "Drawer novo negócio (ordem PDF)", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "Formulário criação", oQueFalta: "Ordem: origem → mercado → participantes → financeiro" }),
      item({ id: "ng-vinculos-neg", pdfRef: "Consolidado P10", titulo: "Vínculos entre negócios (origem, gerou, complementa)", status: "parcial", fase: "F3", prioridade: "P1", oQueTemos: "API parcial", oQueFalta: "UI linguagem simples" }),
      item({ id: "ng-converter", pdfRef: "Consolidado P10", titulo: "Conversão lead → negócio com vínculo", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "POST converter-negocio", oQueFalta: "—", codigo: "app/api/crm/leads/[id]/converter-negocio" }),
      item({ id: "ng-seguranca", pdfRef: "Consolidado P10", titulo: "Campos sensíveis só gestor/financeiro", status: "parcial", fase: "F5", prioridade: "P0", oQueTemos: "crm-permissoes básico", oQueFalta: "Bloqueio UI comissão, origem, participantes" }),
    ],
  },
  {
    id: "encaminhamento",
    titulo: "8. Encaminhamento antifraude",
    descricao: "PDF Consolidado Parte 13",
    itens: [
      item({ id: "enc-registro", pdfRef: "Consolidado P13", titulo: "Registro completo (quem, quando, IA/humano)", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "hub_encaminhamentos + modal", oQueFalta: "Campos autorizado_por, status_retorno completos", codigo: "app/api/crm/encaminhamentos" }),
      item({ id: "enc-status", pdfRef: "Consolidado P13", titulo: "12 status de encaminhamento", status: "parcial", fase: "F1", prioridade: "P1", oQueTemos: "Status básicos", oQueFalta: "Sugerido IA → Bloqueado completo" }),
      item({ id: "enc-ia-first", pdfRef: "Consolidado P13", titulo: "IA first + validação gestor", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "CRM_ENCAMINHAMENTO_V2", oQueFalta: "Fluxo aprovação antes envio definitivo", rota: "/crm/aprovacoes" }),
      item({ id: "enc-criterios", pdfRef: "Consolidado P13", titulo: "Critérios sugestão IA (cidade, homologação, etc.)", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "distribuicao/sugerir", oQueFalta: "Exibir critério na UI" }),
    ],
  },
  {
    id: "proxima-acao",
    titulo: "9. Próxima ação e tarefas",
    descricao: "PDF Consolidado Parte 12",
    itens: [
      item({ id: "pa-tipos", pdfRef: "Consolidado P12", titulo: "17 tipos de ação + 5 status", status: "parcial", fase: "F2", prioridade: "P0", oQueTemos: "hub_proximas_acoes + colunas lead", oQueFalta: "Catálogo completo na UI tarefas" }),
      item({ id: "pa-obrigatoria", pdfRef: "Consolidado P12", titulo: "Próxima ação obrigatória para avançar", status: "gap", fase: "F2", prioridade: "P0", oQueTemos: "Flag CRM_PROXIMA_ACAO_OBRIGATORIA (off)", oQueFalta: "Bloqueio global na API", codigo: "lib/crm/feature-flags.ts" }),
      item({ id: "pa-tarefas-ui", pdfRef: "Consolidado P12", titulo: "UI tarefas comerciais editável", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "/crm/tarefas lista", oQueFalta: "Criar/editar/concluir na UI", rota: "/crm/tarefas" }),
      item({ id: "pa-atraso", pdfRef: "Consolidado P12", titulo: "Ação atrasada em destaque", status: "gap", fase: "F2", prioridade: "P1", oQueTemos: "—", oQueFalta: "Alertas dashboard + inbox" }),
      item({ id: "pa-ia-sugere", pdfRef: "Consolidado P12", titulo: "IA sugere próxima ação (humano confirma)", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "Sugestões em agentes", oQueFalta: "Campo IA na ficha lead/negócio" }),
    ],
  },
  {
    id: "projeto-obra-fin",
    titulo: "10. Projetos, obras e financeiro",
    descricao: "PDF Consolidado Partes 4, 14, 15 + Funil",
    itens: [
      item({ id: "po-proj-lista", pdfRef: "Consolidado P14", titulo: "Módulo Projetos (lista)", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "/crm/projetos", oQueFalta: "—", rota: "/crm/projetos" }),
      item({ id: "po-proj-ficha", pdfRef: "Consolidado P14", titulo: "Ficha projeto (briefing, cronograma, aprovações)", status: "gap", fase: "F3", prioridade: "P0", oQueTemos: "API projetos/[id]", oQueFalta: "UI completa PDF" }),
      item({ id: "po-obra-lista", pdfRef: "Consolidado P14", titulo: "Módulo Obras (lista)", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "/crm/obras", oQueFalta: "—", rota: "/crm/obras" }),
      item({ id: "po-obra-ficha", pdfRef: "Consolidado P14", titulo: "Ficha obra (diário, medições, compras)", status: "parcial", fase: "F3", prioridade: "P0", oQueTemos: "Schema BD + página básica", oQueFalta: "Diário, medições, ocorrências na UI", rota: "/crm/obras" }),
      item({ id: "po-pedidos", pdfRef: "Consolidado P15", titulo: "Pedidos e cotações", status: "parcial", fase: "F3", prioridade: "P1", oQueTemos: "/crm/pedidos", oQueFalta: "Fluxo cotação completo", rota: "/crm/pedidos" }),
      item({ id: "po-fin-dash", pdfRef: "Consolidado P2", titulo: "Financeiro geral (pagar/receber)", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "/crm/financeiro", oQueFalta: "—", rota: "/crm/financeiro" }),
      item({ id: "po-comissoes", pdfRef: "Consolidado P2", titulo: "Comissões e repasses", status: "gap", fase: "F3", prioridade: "P0", oQueTemos: "—", oQueFalta: "Módulo comissões previstas/pagas" }),
      item({ id: "po-fin-entidade", pdfRef: "Consolidado P2", titulo: "Financeiro por negócio/projeto/obra", status: "parcial", fase: "F3", prioridade: "P1", oQueTemos: "Vínculos BD", oQueFalta: "Abas financeiro nas fichas" }),
    ],
  },
  {
    id: "ia-ux-logs",
    titulo: "11. IA, UX, duplicidade, permissões e logs",
    descricao: "PDF Consolidado Partes 16–19",
    itens: [
      item({ id: "ix-ia-preenche", pdfRef: "Consolidado P16", titulo: "IA preenche canal, resumo, cidade, interesse", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "Webhook WhatsApp + agentes", oQueFalta: "Cobertura todos os campos PDF", rota: "/crm/agentes" }),
      item({ id: "ix-confianca", pdfRef: "Consolidado P16", titulo: "Nível de confiança nos campos IA", status: "gap", fase: "F5", prioridade: "P1", oQueTemos: "—", oQueFalta: "UI alta/média/baixa por campo" }),
      item({ id: "ix-3-cliques", pdfRef: "Consolidado P16", titulo: "Regra 3 cliques (criar lead, converter, encaminhar)", status: "parcial", fase: "F2", prioridade: "P1", oQueTemos: "LeadRapidoSideover", oQueFalta: "Medir e otimizar fluxos restantes" }),
      item({ id: "ix-duplicidade", pdfRef: "Consolidado P17", titulo: "Controle duplicidade pessoa/empresa/lead", status: "parcial", fase: "F5", prioridade: "P1", oQueTemos: "verificar-documento API", oQueFalta: "Mesclar com permissão mestre" }),
      item({ id: "ix-permissoes", pdfRef: "Consolidado P19", titulo: "Perfis gestor/financeiro/mestre", status: "parcial", fase: "F5", prioridade: "P0", oQueTemos: "/crm/usuarios", oQueFalta: "Matriz completa campos sensíveis", rota: "/crm/usuarios" }),
      item({ id: "ix-logs", pdfRef: "Consolidado P18", titulo: "Logs por entidade (lead, pessoa, negócio…)", status: "parcial", fase: "F5", prioridade: "P1", oQueTemos: "hub_logs backend", oQueFalta: "UI auditoria no app principal", codigo: "lib/crm/audit-log.ts" }),
      item({ id: "ix-copiloto", pdfRef: "Menu IA", titulo: "Copiloto global", status: "gap", fase: "F5", prioridade: "P2", oQueTemos: "Placeholder /crm/agentes-reais", oQueFalta: "Implementação", rota: "/crm/agentes-reais" }),
    ],
  },
  {
    id: "infra",
    titulo: "12. Infraestrutura e deploy",
    descricao: "Ambiente local, Render, Supabase, flags",
    itens: [
      item({ id: "inf-auth", pdfRef: "—", titulo: "Auth CRM + sessão cookie", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "proxy.ts + crm-session", oQueFalta: "—", codigo: "lib/auth/crm-session.ts" }),
      item({ id: "inf-tenant", pdfRef: "—", titulo: "Multi-tenant Obra10", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "hub_tenants + RLS", oQueFalta: "Backfill tenant_id pessoas pendente", migration: "20260530120000_hub_pessoas_tenant_backfill.sql" }),
      item({ id: "inf-render", pdfRef: "—", titulo: "Deploy Render (escritorio-virtual-1)", status: "ok", fase: "F0", prioridade: "P0", oQueTemos: "Branch feature/escritorio-visual live", oQueFalta: "Flags WhatsApp/IA opcionais" }),
      item({ id: "inf-pipeline-v2", pdfRef: "—", titulo: "CRM_PIPELINE_V2", status: "parcial", fase: "F1", prioridade: "P0", oQueTemos: "Default true no código", oQueFalta: "Confirmar em prod Render" }),
      item({ id: "inf-migrations-pdf", pdfRef: "—", titulo: "Migrations PDF aplicadas em prod", status: "gap", fase: "F1", prioridade: "P0", oQueTemos: "No repositório", oQueFalta: "db push staging + produção", migration: "20260628120000_hub_pipeline_estagios_pdf_seed.sql" }),
      item({ id: "inf-whatsapp", pdfRef: "—", titulo: "WhatsApp UAZAPI + webhook", status: "parcial", fase: "F0", prioridade: "P1", oQueTemos: "Rotas + agentes", oQueFalta: "CRON_SECRET, UAZAPI no Render", rota: "/crm/canais" }),
      item({ id: "inf-analytics", pdfRef: "—", titulo: "Analytics funil PDF", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "FUNIL_LEAD_ETAPAS + funil por mercado", oQueFalta: "Validar pós-migration prod", rota: "/crm/analytics" }),
      item({ id: "inf-relatorio-diario", pdfRef: "Plano interno", titulo: "Relatório diário PDF (Progresso + operação)", status: "ok", fase: "F0", prioridade: "P1", oQueTemos: "PDF narrativo por áreas (Implementado/Corrigido) + estado sistema + anexo Git", oQueFalta: "Fase 2: envio WhatsApp automático à Nice", rota: "/crm/progresso-sistema", codigo: "lib/crm/relatorio-git-entregas.ts" }),
      item({ id: "inf-legado-office", pdfRef: "—", titulo: "Canvas /office (legado)", status: "legado", fase: "F0", prioridade: "P2", oQueTemos: "Simulação visual mantida", oQueFalta: "Não remover sem plano", rota: "/office" }),
    ],
  },
];

/** Cadeia de valor do PDF Consolidado (fechamento). */
export const CADEIA_VALOR = [
  { id: "funil-leads", label: "Lead", sub: "Entrada comercial", rota: "/crm/leads" },
  { id: "negocio", label: "Negócio", sub: "Oportunidade real", rota: "/crm/negocios" },
  { id: "encaminhamento", label: "Encaminhamento", sub: "Antifraude" },
  { id: "projeto-obra-fin", label: "Projeto / Obra", sub: "Entrega", rota: "/crm/projetos" },
  { id: "projeto-obra-fin", label: "Financeiro", sub: "Comissão e repasse", rota: "/crm/financeiro" },
] as const;

export function allProgressoItens(): ProgressoItem[] {
  return PROGRESSO_BLOCOS.flatMap((b) => b.itens);
}

const ITEM_BLOCO_MAP: Record<string, string> = {};
for (const bloco of PROGRESSO_BLOCOS) {
  for (const it of bloco.itens) ITEM_BLOCO_MAP[it.id] = bloco.id;
}

export function getFaseInfo(fase: ProgressoFase): ProgressoFaseInfo | undefined {
  return PROGRESSO_FASES.find((f) => f.id === fase);
}

export function getBlocoIdPorItem(itemId: string): string | null {
  return ITEM_BLOCO_MAP[itemId] ?? null;
}
