export type HubModuleId =
  | "crm"
  | "funil"
  | "whatsapp"
  | "ia"
  | "gestao"
  | "financeiro"
  | "analytics"
  | "integracoes";

export type HubModule = {
  id: HubModuleId;
  title: string;
  tagline: string;
  bullets: string[];
  outcome: string;
  accent: string;
};

export type HubStep = {
  step: number;
  title: string;
  description: string;
};

export type HubStat = {
  value: string;
  label: string;
};

export type HubPurposeBlock = {
  title: string;
  body: string;
};

export const HUB_HERO = {
  eyebrow: "Hub Obra10+",
  title: "Um só lugar para vender, atender e gerir obras",
  subtitle:
    "Capte leads no WhatsApp, qualifique oportunidades no funil, feche negócios com a sua equipa e acompanhe o financeiro — sem planilhas soltas nem conversas perdidas.",
  ctaPrimary: "Cadastre a sua empresa",
  ctaSecondary: "Ver módulos",
  pills: ["Captação", "Funil", "IA", "Financeiro"],
};

export const HUB_PURPOSE: HubPurposeBlock[] = [
  {
    title: "O que é",
    body: "Plataforma de operação comercial para construtoras, incorporadoras, engenharias, arquitetura, imobiliárias e corretores — um único lugar para captar, qualificar, vender e acompanhar obras e negócios.",
  },
  {
    title: "Para quem",
    body: "Engenheiros, escritórios de engenharia e arquitetura, corretores, imobiliárias e construtoras do mercado da construção e do imobiliário — que precisam captar leads, atender no WhatsApp e acompanhar obras e negócios sem planilhas soltas nem sistemas desconectados.",
  },
  {
    title: "O que resolve",
    body: "Centraliza leads, conversas, funil, aprovações e indicadores. A IA apoia o dia a dia, mas decisões sensíveis ficam sempre com a sua equipa.",
  },
];

export const HUB_MODULES: HubModule[] = [
  {
    id: "crm",
    title: "CRM integral",
    tagline: "Todos os contactos e empresas num só cadastro",
    bullets: [
      "Histórico completo de quem entrou e de onde veio",
      "Pessoas e empresas ligadas entre si",
      "Rastreio de cada oportunidade desde a origem",
    ],
    outcome: "Nada se perde entre atendimento, comercial e gestão.",
    accent: "#5d9e72",
  },
  {
    id: "funil",
    title: "Funil comercial",
    tagline: "Do primeiro contacto ao negócio fechado",
    bullets: [
      "Visualize oportunidades por etapa do funil",
      "Propostas e conversão lead → negócio",
      "Encaminhamentos com aprovação da gestão",
    ],
    outcome: "Menos leads parados e mais previsibilidade de fechamento.",
    accent: "#c9a24a",
  },
  {
    id: "whatsapp",
    title: "WhatsApp & Inbox",
    tagline: "Atenda clientes sem perder conversas",
    bullets: [
      "Inbox centralizado para toda a equipa",
      "Assuma a conversa quando a IA precisa de humano",
      "Responda pelo mesmo canal, com contexto do lead",
    ],
    outcome: "O cliente não repete a história toda vez que muda de atendente.",
    accent: "#25d366",
  },
  {
    id: "ia",
    title: "Multi-agente IA",
    tagline: "Assistentes que trabalham com a sua equipa",
    bullets: [
      "Qualificação e triagem automática de leads",
      "Playbooks alinhados ao seu mercado",
      "Copiloto nas negociações e próximos passos",
    ],
    outcome: "Mais velocidade no atendimento, com controlo humano nas decisões.",
    accent: "#60a5fa",
  },
  {
    id: "gestao",
    title: "Gestão & aprovações",
    tagline: "Permissões e aprovações claras para cada perfil",
    bullets: [
      "Cada pessoa vê apenas o que precisa",
      "Central de aprovações antes de decisões críticas",
      "Tarefas e responsabilidades da equipa organizadas",
    ],
    outcome: "Operação segura: gestor no comando, equipa focada.",
    accent: "#f472b6",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    tagline: "Pagamentos e recebimentos organizados",
    bullets: [
      "Visão consolidada do caixa e pendências",
      "Lançamentos ligados a negócios e obras",
      "Base para comissões e repasses em evolução",
    ],
    outcome: "Financeiro alinhado ao que acontece no comercial.",
    accent: "#34d399",
  },
  {
    id: "analytics",
    title: "Analytics",
    tagline: "Saiba onde está a ganhar ou a perder",
    bullets: [
      "Funil de leads e negócios em tempo real",
      "Indicadores para reuniões de gestão",
      "Relatórios exportáveis para partilhar",
    ],
    outcome: "Decisões com dados, não só com feeling.",
    accent: "#a78bfa",
  },
  {
    id: "integracoes",
    title: "Integrações",
    tagline: "Campanhas e dados externos ligados ao CRM",
    bullets: [
      "Meta Ads e Google Ads no mesmo painel",
      "Validação de CNPJ no cadastro",
      "WhatsApp e canais conectados à operação",
    ],
    outcome: "Marketing e vendas falando a mesma língua.",
    accent: "#fb923c",
  },
];

export const HUB_STEPS: HubStep[] = [
  {
    step: 1,
    title: "Cadastre a empresa",
    description:
      "Registe a sua organização com CNPJ, segmento e responsável. Confirme o e-mail para activar o acesso.",
  },
  {
    step: 2,
    title: "Configure WhatsApp, funil e IA",
    description:
      "Ligue os canais de atendimento, alinhe o funil ao seu mercado (imobiliário, obra, arquitetura) e active os agentes.",
  },
  {
    step: 3,
    title: "Opere com IA + equipa",
    description:
      "Qualifique leads, encaminhe oportunidades, aprove decisões importantes e acompanhe resultados no dashboard.",
  },
];

export const HUB_STATS: HubStat[] = [
  { value: "Sua empresa isolada", label: "Dados separados por organização" },
  { value: "Tudo integrado", label: "CRM, WhatsApp, IA e financeiro" },
  { value: "Por segmento", label: "Imobiliário, obra, arquitetura, engenharia" },
  { value: "Equipa organizada", label: "Dono, gestor, comercial, financeiro" },
];

export const HUB_CTA = {
  title: "Pronto para digitalizar o seu escritório?",
  subtitle: "Cadastre a sua empresa e comece o onboarding em minutos.",
  button: "Começar gratuitamente",
};

export const SIGNUP_SEGMENTOS = [
  { value: "construtora", label: "Construtora" },
  { value: "incorporadora", label: "Incorporadora" },
  { value: "arquitetura", label: "Arquitetura / engenharia" },
  { value: "imobiliaria", label: "Imobiliária" },
  { value: "outro", label: "Outro segmento" },
] as const;

export type SignupSegmento = (typeof SIGNUP_SEGMENTOS)[number]["value"];
