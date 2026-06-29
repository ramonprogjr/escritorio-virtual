/**
 * Cockpit de Obras (E1) — lógica PURA de classificação (sem I/O, testável).
 *
 * Reusa o vocabulário visual da marca (verde+dourado) e a régua do "Hoje" da planilha
 * do dono: situação automática POR PRAZO (atrasado / próximos 15d) × andamento manual.
 * Nada aqui toca o banco — recebe linhas já lidas pelo agregador e devolve a saúde,
 * o avanço, o próximo marco e a ordenação por urgência das obras.
 *
 * NOMES DE COLUNA REAIS (confirmados no schema): cronograma = (fase, percentual,
 * data_prevista, concluida). Status macro legado pode ser `em_andamento` (pré-E0) —
 * mapeamos em LEITURA para "ativa" sem depender da migração.
 */

/**
 * Saúde derivada da obra — define a cor da borda e a ordem na carteira.
 * `atrasada` = há fase REALMENTE vencida (data < hoje). `urgente` = marco chegando em ≤2d
 * (futuro próximo) — fica na fila "Próximos 15d", não em "Atrasados" (coerência card×fila).
 */
export type SaudeObra =
  | "critica"
  | "atrasada"
  | "urgente"
  | "atencao"
  | "ok"
  | "planejamento"
  | "pausada"
  | "encerrada";

/** Cores oficiais da marca por saúde (mesma paleta do CopilotoVoz / pills). */
export const COR_SAUDE: Record<SaudeObra, string> = {
  critica: "#f85149", // vermelho — bloqueio/ocorrência crítica
  atrasada: "#e3b341", // âmbar forte — fase vencida
  urgente: "#e3b341", // âmbar — marco em ≤2d (futuro próximo, ainda não vencido)
  atencao: "#d6a129", // dourado — marco próximo
  ok: "#3fb950", // verde — em dia
  planejamento: "#6e9e8a", // verde-acinzentado — ainda sem cronograma
  pausada: "#8b949e", // cinza
  encerrada: "#5c6b62", // cinza escuro
};

export const ROTULO_SAUDE: Record<SaudeObra, string> = {
  critica: "Crítica",
  atrasada: "Atrasada",
  urgente: "Urgente",
  atencao: "Atenção",
  ok: "Em dia",
  planejamento: "Planejamento",
  pausada: "Pausada",
  encerrada: "Encerrada",
};

/** Peso de ordenação: menor = mais urgente (topo da carteira). */
const ORDEM_SAUDE: Record<SaudeObra, number> = {
  critica: 0,
  atrasada: 1,
  urgente: 2, // marco em ≤2d: depois de vencido, antes de "atenção"
  atencao: 3,
  ok: 4,
  planejamento: 5,
  pausada: 6,
  encerrada: 7,
};

/** Status macro vindo do banco → normalizado (mapeia legado `em_andamento`→`ativa`). */
export function normalizarStatusObra(status: string | null | undefined): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (s === "em_andamento") return "ativa";
  if (s === "concluida") return "encerrada";
  if (!s) return "planejamento";
  return s;
}

/** Uma fase do cronograma (subconjunto das colunas reais usadas pelo cockpit). */
export type FaseCronograma = {
  fase: string | null;
  percentual: number | null;
  data_prevista: string | null; // ISO date (YYYY-MM-DD) ou null
  concluida: boolean | null;
};

/** Início do dia local em ISO date (YYYY-MM-DD) — base de comparação de prazo. */
export function hojeISODate(agora: Date = new Date()): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, "0");
  const d = String(agora.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normaliza um valor de data para YYYY-MM-DD (aceita ISO com hora). null se inválido. */
export function soData(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/** Dias entre duas datas YYYY-MM-DD (b - a). Positivo = b no futuro. */
export function diasEntre(aISO: string, bISO: string): number {
  const a = Date.parse(`${aISO}T00:00:00Z`);
  const b = Date.parse(`${bISO}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Avanço da obra = média do `percentual` das fases (real, existe no schema). null se sem cronograma. */
export function avancoMedio(fases: FaseCronograma[]): number | null {
  if (!fases.length) return null;
  const vals = fases.map((f) => {
    const n = Number(f.percentual);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  });
  const soma = vals.reduce((s, n) => s + n, 0);
  return Math.round(soma / vals.length);
}

export type MarcoProximo = {
  fase: string;
  data_prevista: string;
  /** Dias até o marco (negativo = vencido — mas próximo marco só considera não-vencidos). */
  dias: number;
};

/**
 * Próximo marco = a fase NÃO concluída com a MENOR data_prevista FUTURA (≥ hoje).
 * Se só houver datas vencidas, elas viram "atrasados" (não marco) — aqui retornamos null.
 */
export function proximoMarco(fases: FaseCronograma[], hojeISO = hojeISODate()): MarcoProximo | null {
  let melhor: MarcoProximo | null = null;
  for (const f of fases) {
    if (f.concluida) continue;
    const d = soData(f.data_prevista);
    if (!d) continue;
    const dias = diasEntre(hojeISO, d);
    if (dias < 0) continue; // vencida → é atrasado, não marco
    if (!melhor || d < melhor.data_prevista) {
      melhor = { fase: String(f.fase ?? "Marco"), data_prevista: d, dias };
    }
  }
  return melhor;
}

/** Fase atrasada = não concluída E data_prevista < hoje. */
export function ehAtrasada(f: FaseCronograma, hojeISO = hojeISODate()): boolean {
  if (f.concluida) return false;
  const d = soData(f.data_prevista);
  if (!d) return false;
  return diasEntre(hojeISO, d) < 0;
}

/** Fase nos próximos 15 dias = não concluída E hoje < data_prevista ≤ hoje+15. */
export function ehProxima15(f: FaseCronograma, hojeISO = hojeISODate()): boolean {
  if (f.concluida) return false;
  const d = soData(f.data_prevista);
  if (!d) return false;
  const dias = diasEntre(hojeISO, d);
  return dias >= 0 && dias <= 15;
}

/** Sinais que entram na derivação de saúde de uma obra (já contados pelo agregador). */
export type SinaisObra = {
  status: string | null | undefined;
  atrasados: number; // nº de fases vencidas não concluídas
  ocorrenciasCriticas: number; // hub_obras_ocorrencias severidade=critico
  pedidosAbertos: number; // hub_pedidos_material em rascunho/cotando/aprovado
  /** Dias até o próximo marco (null = sem marco futuro). */
  diasProximoMarco: number | null;
  /** Há ao menos uma linha de cronograma para a obra. */
  temCronograma: boolean;
};

/**
 * Deriva a saúde da obra (cor + ordem). Regra de prioridade (do mais grave ao menos):
 *  1) pausada/encerrada → respeita o status macro (fora da fila de urgência);
 *  2) ocorrência crítica → CRÍTICA;
 *  3) fase REALMENTE vencida (data < hoje) → ATRASADA;
 *  4) marco em ≤2d (futuro próximo) → URGENTE / em ≤7d → ATENÇÃO;
 *  5) sem cronograma → PLANEJAMENTO;
 *  6) resto → OK.
 * Coerência card×fila: "atrasada" é reservado a item vencido (que aparece em "Atrasados").
 * Um marco que ainda VAI vencer (≤2d) é "urgente" — ele vive na fila "Próximos 15d", não em
 * "Atrasados"; usar "atrasada" aqui faria o card dizer "Atrasada" sem item na lista de atrasados.
 * Pedidos abertos sozinhos não rebaixam (são pill informativa), mas SOMAM à crítica.
 */
export function derivarSaude(s: SinaisObra): SaudeObra {
  const st = normalizarStatusObra(s.status);
  if (st === "pausada") return "pausada";
  if (st === "encerrada" || st === "cancelada") return "encerrada";

  if (s.ocorrenciasCriticas > 0) return "critica";
  if (s.atrasados > 0) return "atrasada";

  if (s.diasProximoMarco != null) {
    if (s.diasProximoMarco <= 2) return "urgente";
    if (s.diasProximoMarco <= 7) return "atencao";
  }

  if (st === "planejamento" && !s.temCronograma) return "planejamento";
  if (!s.temCronograma) return "planejamento";
  return "ok";
}

/** Item de carteira pronto p/ a UI (sem nada de I/O). */
export type ObraCard = {
  id: string;
  titulo: string;
  codigo: string | null;
  tipo_obra: string | null;
  status: string | null;
  cidade: string | null;
  estado: string | null;
  saude: SaudeObra;
  avanco: number | null; // % média das fases (null = sem cronograma)
  proximoMarco: MarcoProximo | null;
  atrasados: number;
  ocorrenciasCriticas: number;
  pedidosAbertos: number;
  temCronograma: boolean;
};

/** Ordena a carteira por urgência (crítica→…→encerrada); empate = mais atrasados, depois título. */
export function ordenarPorUrgencia(cards: ObraCard[]): ObraCard[] {
  return [...cards].sort((a, b) => {
    const oa = ORDEM_SAUDE[a.saude];
    const ob = ORDEM_SAUDE[b.saude];
    if (oa !== ob) return oa - ob;
    if (b.atrasados !== a.atrasados) return b.atrasados - a.atrasados;
    return (a.titulo || "").localeCompare(b.titulo || "", "pt-BR");
  });
}

/** Filtro da carteira por chip de saúde. "" = todas. */
export type FiltroSaude = "" | "atencao" | "critica" | "ativas" | "planejamento";

export function passaFiltroSaude(card: ObraCard, filtro: FiltroSaude): boolean {
  switch (filtro) {
    case "":
      return true;
    case "critica":
      return card.saude === "critica";
    case "atencao":
      return (
        card.saude === "atencao" ||
        card.saude === "urgente" ||
        card.saude === "atrasada" ||
        card.saude === "critica"
      );
    case "ativas":
      return (
        card.saude === "ok" ||
        card.saude === "atencao" ||
        card.saude === "urgente" ||
        card.saude === "atrasada" ||
        card.saude === "critica"
      );
    case "planejamento":
      return card.saude === "planejamento";
    default:
      return true;
  }
}

/** Texto humano de prazo p/ um marco/atraso. dias<0 = "venceu há Nd"; ≥0 = "em Nd". */
export function rotuloPrazo(dias: number): string {
  if (dias < 0) {
    const n = Math.abs(dias);
    return n === 1 ? "venceu ontem" : `venceu há ${n}d`;
  }
  if (dias === 0) return "vence hoje";
  if (dias === 1) return "vence amanhã";
  return `vence em ${dias}d`;
}
