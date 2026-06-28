import { normalizarDocumento } from "@/lib/crm/documento-brasil";

/** Linha mínima de pessoa usada na detecção de duplicatas e no scoring. */
export type PessoaMergeRow = {
  id: string;
  codigo?: string | null;
  nome?: string | null;
  telefone?: string | null;
  email?: string | null;
  documento?: string | null;
  tipo_pessoa?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  area_atuacao?: string | null;
  origem?: string | null;
  dados_extras?: Record<string, unknown> | null;
  tenant_id?: string | null;
  criado_em?: string | null;
  arquivado_em?: string | null;
};

export type MotivoDuplicata = "documento" | "telefone" | "email";

export type ParDuplicata = {
  /** Chave estável do par (ids ordenados) — para dedupe e React key. */
  chave: string;
  a: PessoaMergeRow;
  b: PessoaMergeRow;
  motivos: MotivoDuplicata[];
  /** Vencedor sugerido (mais campos preenchidos; empate → menor criado_em). */
  vencedorId: string;
  perdedorId: string;
  /** true quando os dois têm documento DIFERENTE preenchido (bloqueia merge). */
  documentosConflitam: boolean;
};

/**
 * Chave canônica de telefone para dedup: só dígitos, sem o DDI 55 do Brasil.
 * Assim "11999998888" e "+55 (11) 99999-8888" caem na mesma chave (últimos 11).
 */
export function telefoneDigits(v: unknown): string {
  const d = String(v ?? "").replace(/\D/g, "");
  // E.164 BR: 55 + DDD(2) + número(8-9) = 12-13 dígitos → tira o DDI.
  if (d.length >= 12 && d.startsWith("55")) return d.slice(2);
  return d;
}

/** E-mail canônico (trim + lowercase) para comparação. */
export function emailCanonico(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * Score de "completude" do registo (decisão do CEO): soma de campos relevantes
 * preenchidos + nº de vínculos/negócios. Maior score vence.
 */
export function scorePessoa(
  p: PessoaMergeRow,
  contagens?: { vinculos?: number; negocios?: number; leads?: number }
): number {
  const campos: (keyof PessoaMergeRow)[] = [
    "documento",
    "email",
    "telefone",
    "tipo_pessoa",
    "empresa",
    "cep",
    "logradouro",
    "numero",
    "bairro",
    "cidade",
    "estado",
    "area_atuacao",
  ];
  let score = 0;
  for (const c of campos) {
    const v = p[c];
    if (v != null && String(v).trim() !== "") score += 1;
  }
  // vínculos/negócios pesam mais que um campo isolado (representam histórico).
  score += (contagens?.vinculos ?? 0) * 2;
  score += (contagens?.negocios ?? 0) * 2;
  score += (contagens?.leads ?? 0) * 1;
  return score;
}

function tsMillis(v: unknown): number {
  const t = Date.parse(String(v ?? ""));
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Decide o vencedor entre dois registos.
 * Regra (CEO): maior score vence; empate → menor criado_em (mais antigo);
 * empate persistente → menor id (determinístico).
 */
export function decidirVencedor(
  a: PessoaMergeRow,
  b: PessoaMergeRow,
  contagens?: {
    a?: { vinculos?: number; negocios?: number; leads?: number };
    b?: { vinculos?: number; negocios?: number; leads?: number };
  }
): { vencedorId: string; perdedorId: string } {
  const sa = scorePessoa(a, contagens?.a);
  const sb = scorePessoa(b, contagens?.b);
  let venc: PessoaMergeRow;
  let perd: PessoaMergeRow;
  if (sa !== sb) {
    [venc, perd] = sa > sb ? [a, b] : [b, a];
  } else {
    const ta = tsMillis(a.criado_em);
    const tb = tsMillis(b.criado_em);
    if (ta !== tb) {
      [venc, perd] = ta < tb ? [a, b] : [b, a];
    } else {
      [venc, perd] = a.id < b.id ? [a, b] : [b, a];
    }
  }
  return { vencedorId: venc.id, perdedorId: perd.id };
}

/** Documentos diferentes preenchidos → não são a mesma pessoa. */
export function documentosConflitam(a: PessoaMergeRow, b: PessoaMergeRow): boolean {
  const da = normalizarDocumento(String(a.documento ?? ""));
  const db = normalizarDocumento(String(b.documento ?? ""));
  return !!da && !!db && da !== db;
}

function chavePar(id1: string, id2: string): string {
  return id1 < id2 ? `${id1}|${id2}` : `${id2}|${id1}`;
}

/**
 * Detecta pares de pessoas candidatas a duplicata na MESMA lista (já filtrada
 * por tenant pelo chamador). Agrupa por documento, telefone e e-mail; ignora
 * registos arquivados. Cada par carrega motivos + vencedor sugerido.
 *
 * Determinístico (independe da ordem de iteração de objetos) e O(n) por chave.
 */
export function detectarParesDuplicados(pessoas: PessoaMergeRow[]): ParDuplicata[] {
  const ativos = pessoas.filter((p) => !p.arquivado_em);

  const porDocumento = new Map<string, PessoaMergeRow[]>();
  const porTelefone = new Map<string, PessoaMergeRow[]>();
  const porEmail = new Map<string, PessoaMergeRow[]>();

  for (const p of ativos) {
    const doc = normalizarDocumento(String(p.documento ?? ""));
    if (doc) (porDocumento.get(doc) ?? porDocumento.set(doc, []).get(doc)!).push(p);
    const tel = telefoneDigits(p.telefone);
    if (tel.length >= 8) (porTelefone.get(tel) ?? porTelefone.set(tel, []).get(tel)!).push(p);
    const mail = emailCanonico(p.email);
    if (mail.includes("@")) (porEmail.get(mail) ?? porEmail.set(mail, []).get(mail)!).push(p);
  }

  // motivos acumulados por chave-de-par
  const motivosPorPar = new Map<string, Set<MotivoDuplicata>>();
  const linhasPorId = new Map<string, PessoaMergeRow>();
  for (const p of ativos) linhasPorId.set(p.id, p);

  function registrarGrupo(grupo: PessoaMergeRow[], motivo: MotivoDuplicata) {
    if (grupo.length < 2) return;
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const k = chavePar(grupo[i].id, grupo[j].id);
        const set = motivosPorPar.get(k) ?? motivosPorPar.set(k, new Set()).get(k)!;
        set.add(motivo);
      }
    }
  }

  for (const g of porDocumento.values()) registrarGrupo(g, "documento");
  for (const g of porTelefone.values()) registrarGrupo(g, "telefone");
  for (const g of porEmail.values()) registrarGrupo(g, "email");

  const ordemMotivo: Record<MotivoDuplicata, number> = { documento: 0, telefone: 1, email: 2 };

  const pares: ParDuplicata[] = [];
  for (const [chave, motivosSet] of motivosPorPar) {
    const [id1, id2] = chave.split("|");
    const a = linhasPorId.get(id1);
    const b = linhasPorId.get(id2);
    if (!a || !b) continue;
    const motivos = [...motivosSet].sort((x, y) => ordemMotivo[x] - ordemMotivo[y]);
    const { vencedorId, perdedorId } = decidirVencedor(a, b);
    pares.push({
      chave,
      a,
      b,
      motivos,
      vencedorId,
      perdedorId,
      documentosConflitam: documentosConflitam(a, b),
    });
  }

  // Ordena: pares por documento primeiro (mais confiável), depois telefone/email.
  pares.sort((x, y) => {
    const px = Math.min(...x.motivos.map((m) => ordemMotivo[m]));
    const py = Math.min(...y.motivos.map((m) => ordemMotivo[m]));
    if (px !== py) return px - py;
    return x.chave.localeCompare(y.chave);
  });

  return pares;
}
