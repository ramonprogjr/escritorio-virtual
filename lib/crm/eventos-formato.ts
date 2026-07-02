/**
 * Formatação dos `event_type` do hub_eventos (keystone F4) para a timeline/feed do Hub:
 * rótulo em PT + ícone (Lucide) + cor SEMÂNTICA. Puro e tolerante — um event_type
 * desconhecido cai num fallback legível (humaniza o slug), então a timeline nunca quebra
 * quando uma instrumentação nova adiciona um tipo antes deste mapa ser atualizado.
 *
 * `cor` é uma CHAVE semântica (não hex): o consumidor mapeia pros tokens `--obra-*`
 * do design system (verde/dourado), preservando a trava visual do Obra10+.
 */

export type CorEvento = "sucesso" | "perigo" | "destaque" | "info" | "neutro";

export type EventoFormatado = {
  /** Rótulo curto, legível, em pt-BR. */
  label: string;
  /** Nome do ícone Lucide (ex.: "Trophy"). */
  icone: string;
  /** Cor semântica → o consumidor mapeia para os tokens --obra-*. */
  cor: CorEvento;
};

/** Mapa dos event_type conhecidos (os que a instrumentação atual grava). */
const MAPA_EVENTOS: Record<string, EventoFormatado> = {
  // Funil de lead
  lead_criado: { label: "Lead criado", icone: "UserPlus", cor: "info" },
  lead_distribuido: { label: "Lead distribuído", icone: "Share2", cor: "info" },
  lead_recusado: { label: "Lead recusado", icone: "UserX", cor: "perigo" },
  lead_recolocado: { label: "Lead recolocado", icone: "RotateCcw", cor: "neutro" },
  estagio_alterado: { label: "Estágio do lead alterado", icone: "ArrowRightLeft", cor: "neutro" },

  // Funil de negócio
  negocio_criado: { label: "Negócio criado", icone: "Briefcase", cor: "info" },
  negocio_etapa_mudou: { label: "Etapa do negócio mudou", icone: "ArrowRightLeft", cor: "neutro" },
  negocio_ganho: { label: "Negócio ganho", icone: "Trophy", cor: "sucesso" },
  negocio_perdido: { label: "Negócio perdido", icone: "XCircle", cor: "perigo" },

  // Entrega / operação
  entrega_gerada: { label: "Entrega gerada", icone: "PackageCheck", cor: "sucesso" },
  fornecedor_cobrado: { label: "Fornecedor cobrado", icone: "BellRing", cor: "destaque" },

  // Gates / governança
  gate_liberado: { label: "Gate liberado", icone: "DoorOpen", cor: "sucesso" },
  gate_pendencia_bloqueio: { label: "Bloqueado por pendência", icone: "ShieldAlert", cor: "perigo" },
};

/** Humaniza um slug (`negocio_ganho` → `Negócio ganho`) para o fallback. */
export function humanizarEventType(eventType: string): string {
  const s = (eventType ?? "").trim();
  if (!s) return "Evento";
  const espaçado = s.replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return espaçado.charAt(0).toUpperCase() + espaçado.slice(1);
}

/**
 * Devolve rótulo/ícone/cor de um event_type. Nunca lança: tipo desconhecido → fallback
 * legível (`neutro`, ícone `Circle`).
 */
export function formatarEvento(eventType: string): EventoFormatado {
  const chave = (eventType ?? "").trim();
  const conhecido = MAPA_EVENTOS[chave];
  if (conhecido) return conhecido;
  return { label: humanizarEventType(chave), icone: "Circle", cor: "neutro" };
}

/** True se o event_type tem formatação dedicada (útil para testes/telemetria de cobertura). */
export function temFormatoDedicado(eventType: string): boolean {
  return Object.prototype.hasOwnProperty.call(MAPA_EVENTOS, (eventType ?? "").trim());
}
