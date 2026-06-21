import {
  buildResumoDesenvolvimentoNarrativo,
  normalizarMensagemCommit,
  type RelatorioEntregaRelacionada,
  type RelatorioGitEntrega,
} from "@/lib/crm/relatorio-git-entregas";

export type RelatorioSecaoNarrativa = {
  ordem: number;
  titulo: string;
  implementado: string[];
  corrigido: string[];
};

export type RelatorioDesenvolvimentoEstruturado = {
  intro: string;
  secoes: RelatorioSecaoNarrativa[];
  anexoCommits: RelatorioGitEntrega[];
};

type TemaId =
  | "hub-landing"
  | "cadastro-lead"
  | "relatorio-pdf"
  | "progresso-build"
  | "rbac"
  | "deploy"
  | "dev-local"
  | "crm-outros";

type TemaDef = {
  id: TemaId;
  ordem: number;
  titulo: string;
  pathPatterns: string[];
  messageKeywords: string[];
};

const TEMAS: TemaDef[] = [
  {
    id: "hub-landing",
    ordem: 1,
    titulo: "1. Landing pública Obra10+ Hub (/)",
    pathPatterns: [
      "app/page.tsx",
      "components/hub/Hub",
      "HubPublicShell",
      "HubScrollReveal",
      "HubHero",
      "app/loading.tsx",
      "components/hub/HubModules",
      "components/hub/HubSteps",
    ],
    messageKeywords: ["landing", "hub público", "hero", "scroll reveal"],
  },
  {
    id: "cadastro-lead",
    ordem: 2,
    titulo: "2. Cadastro / captura de lead (/cadastre-se)",
    pathPatterns: [
      "cadastre-se",
      "lead-hub",
      "HubLeadForm",
      "lead-hub-publico",
      "cadastro-empresa",
      "CadastreSeForm",
    ],
    messageKeywords: ["lead", "cadastre-se", "captura", "formulário de lead"],
  },
  {
    id: "relatorio-pdf",
    ordem: 3,
    titulo: "3. Relatório PDF diário (/crm/progresso-sistema)",
    pathPatterns: [
      "relatorio-diario",
      "relatorio-git",
      "relatorio-deploy",
      "ProgressoSistemaDashboard",
      "relatorio-desenvolvimento",
    ],
    messageKeywords: ["relatório", "relatorio", "pdf diário", "pdf diario"],
  },
  {
    id: "progresso-build",
    ordem: 4,
    titulo: "4. Progresso sistema e build automático",
    pathPatterns: [
      "progresso-sistema",
      "verify-progresso",
      "collect-entregas",
      "progresso-verificacao",
      "progresso-checks",
      "scripts/verify-progresso",
      "scripts/collect-entregas",
    ],
    messageKeywords: ["progresso", "verify:progresso", "matriz progresso"],
  },
  {
    id: "rbac",
    ordem: 5,
    titulo: "5. RBAC e multi-tenant (CRM)",
    pathPatterns: [
      "crm-permissoes",
      "usuarios",
      "rbac",
      "onboarding-tenant",
      "users_rbac",
      "crm-query-keys",
      "hub_tenants",
    ],
    messageKeywords: ["rbac", "multi-tenant", "permiss", "convite"],
  },
  {
    id: "deploy",
    ordem: 6,
    titulo: "6. Deploy Render (produção)",
    pathPatterns: ["package.json", "render.yaml", "render.toml"],
    messageKeywords: ["deploy", "render", "tsx", "pdfkit", "build render"],
  },
  {
    id: "dev-local",
    ordem: 7,
    titulo: "7. Dev local",
    pathPatterns: [
      "dev-insecure-tls",
      "dev-strict-tls",
      "next.config",
      "MobileShell",
      ".next-dev",
    ],
    messageKeywords: ["dev local", "node_env", "tailwind", "postcss", "porta 3001"],
  },
  {
    id: "crm-outros",
    ordem: 8,
    titulo: "8. CRM / outras entregas",
    pathPatterns: ["app/crm/", "lib/crm/", "components/crm/", "app/api/crm/"],
    messageKeywords: [],
  },
];

const CORRIGIDO_PREFIXES = /^(fix|chore)(\([^)]+\))?!?:/i;
const IMPLEMENTADO_PREFIXES = /^(feat|refactor|docs|style|test)(\([^)]+\))?!?:/i;
const CORRIGIDO_KEYWORDS = /\b(fix|corrige|corrigido|correção|correcao|hotfix|ajuste)\b/i;

function mensagemBruta(entrega: RelatorioGitEntrega): string {
  return entrega.mensagemRaw?.trim() || entrega.mensagem.trim();
}

function classificarTipo(entrega: RelatorioGitEntrega): "implementado" | "corrigido" {
  const raw = mensagemBruta(entrega);
  if (CORRIGIDO_PREFIXES.test(raw)) return "corrigido";
  if (IMPLEMENTADO_PREFIXES.test(raw)) return "implementado";
  if (CORRIGIDO_KEYWORDS.test(raw)) return "corrigido";
  if (/^(chore|build|ci)(\([^)]+\))?!?:/i.test(raw)) return "corrigido";
  return "implementado";
}

function pathMatchesPattern(filePath: string, pattern: string): boolean {
  const p = filePath.replace(/\\/g, "/");
  const pat = pattern.replace(/\\/g, "/");
  if (pat.endsWith("/")) return p.startsWith(pat) || p.includes(pat.slice(0, -1));
  return p === pat || p.includes(pat) || p.startsWith(`${pat}/`);
}

function scoreTema(entrega: RelatorioGitEntrega, tema: TemaDef): number {
  let score = 0;
  for (const f of entrega.arquivos) {
    for (const pat of tema.pathPatterns) {
      if (pathMatchesPattern(f, pat)) score += 3;
    }
  }
  const msg = `${mensagemBruta(entrega)} ${entrega.mensagem}`.toLowerCase();
  for (const kw of tema.messageKeywords) {
    if (msg.includes(kw.toLowerCase())) score += 2;
  }
  return score;
}

function classificarTema(entrega: RelatorioGitEntrega): TemaId {
  let best: TemaDef = TEMAS[TEMAS.length - 1]!;
  let bestScore = 0;

  for (const tema of TEMAS) {
    if (tema.id === "crm-outros") continue;
    const s = scoreTema(entrega, tema);
    if (s > bestScore) {
      bestScore = s;
      best = tema;
    }
  }

  if (bestScore === 0) {
    const crmScore = scoreTema(entrega, TEMAS.find((t) => t.id === "crm-outros")!);
    if (crmScore > 0) return "crm-outros";
    return "crm-outros";
  }

  return best.id;
}

function capitalizarPrimeira(s: string): string {
  const t = s.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatarBulletProblemaSolucao(texto: string, temaId: TemaId): string {
  if (temaId !== "deploy" && temaId !== "dev-local") return texto;

  const arrow = texto.match(/^(.+?)\s*(?:→|->)\s*(.+)$/);
  if (arrow) {
    return `Problema: ${capitalizarPrimeira(arrow[1]!.trim())} → Solução: ${capitalizarPrimeira(arrow[2]!.trim())}`;
  }

  const colon = texto.match(/^(.+?):\s*(.+)$/);
  if (colon && colon[1]!.length < 60) {
    return `Problema: ${capitalizarPrimeira(colon[1]!.trim())} → Solução: ${capitalizarPrimeira(colon[2]!.trim())}`;
  }

  return texto;
}

function bulletFromCommit(entrega: RelatorioGitEntrega, tipo: "implementado" | "corrigido", temaId: TemaId): string {
  const texto = capitalizarPrimeira(normalizarMensagemCommit(mensagemBruta(entrega)));
  if (tipo === "corrigido") {
    return formatarBulletProblemaSolucao(texto, temaId);
  }
  return texto;
}

function dedupeBullets(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildRelatorioDesenvolvimentoEstruturado(
  dateLabel: string,
  entregas: RelatorioGitEntrega[],
  entregasRelacionadas: RelatorioEntregaRelacionada[]
): RelatorioDesenvolvimentoEstruturado {
  const intro = buildResumoDesenvolvimentoNarrativo(dateLabel, entregas, entregasRelacionadas);

  const buckets = new Map<TemaId, { implementado: string[]; corrigido: string[] }>();
  for (const tema of TEMAS) {
    buckets.set(tema.id, { implementado: [], corrigido: [] });
  }

  for (const entrega of entregas) {
    const temaId = classificarTema(entrega);
    const tipo = classificarTipo(entrega);
    const bucket = buckets.get(temaId)!;
    bucket[tipo].push(bulletFromCommit(entrega, tipo, temaId));
  }

  const secoes: RelatorioSecaoNarrativa[] = TEMAS.map((tema) => {
    const b = buckets.get(tema.id)!;
    return {
      ordem: tema.ordem,
      titulo: tema.titulo,
      implementado: dedupeBullets(b.implementado),
      corrigido: dedupeBullets(b.corrigido),
    };
  }).filter((s) => s.implementado.length > 0 || s.corrigido.length > 0);

  return {
    intro,
    secoes,
    anexoCommits: entregas,
  };
}
