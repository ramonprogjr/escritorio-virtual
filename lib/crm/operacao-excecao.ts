/**
 * OPERAÇÃO POR EXCEÇÃO — "O que travou". Substitui os 3 contadores mortos (14/1/1) do bloco
 * Operação por uma lista acionável: só o que está PRESO/ATRASADO, com R$ (onde existe), pior
 * tempo parado e um clique pra agir. Número que não vira ação sai da tela (auditoria dashboard).
 * Puro e testável — recebe `agoraMs` (sem Date.now interno).
 */

export type OpNegocioRow = {
  status: string | null;
  atualizado_em: string | null;
  valor_estimado: number | null;
  proxima_acao: string | null;
};
export type OpObraRow = { status: string | null; data_previsao_fim: string | null };
export type OpPedidoRow = { status: string | null; atualizado_em: string | null };

export type OpExcecaoItem = {
  key: "negocios_parados" | "obras_atrasadas" | "pedidos_parados" | "sem_proxima_acao";
  label: string;
  sub: string;
  count: number;
  valor: number | null;
  piorDias: number | null;
  href: string;
  cor: string;
};

export type OpExcecaoResultado = { itens: OpExcecaoItem[]; tudoEmDia: boolean };

const NEGOCIO_ABERTO = new Set(["aberto", "em_negociacao"]);
const OBRA_ATIVA = new Set(["ativa", "planejamento", "atencao", "critica", "mobilizacao", "em_andamento"]);
const PEDIDO_TRAVADO = new Set(["rascunho", "cotando", "aprovado"]);

const DIA = 86_400_000;

function diasDesde(iso: string | null, agoraMs: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((agoraMs - t) / DIA);
}

export function montarOperacaoExcecao(input: {
  negocios: OpNegocioRow[];
  obras: OpObraRow[];
  pedidos: OpPedidoRow[];
  agoraMs: number;
}): OpExcecaoResultado {
  const { negocios, obras, pedidos, agoraMs } = input;
  const itens: OpExcecaoItem[] = [];

  // 1) Negócios parados há +7 dias (dinheiro empacado no pipeline)
  const parados = negocios.filter(
    (n) => NEGOCIO_ABERTO.has(String(n.status ?? "")) && (diasDesde(n.atualizado_em, agoraMs) ?? 0) >= 7
  );
  if (parados.length > 0) {
    itens.push({
      key: "negocios_parados",
      label: "Negócios parados",
      sub: "+7 dias sem mexer",
      count: parados.length,
      valor: parados.reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0),
      piorDias: Math.max(...parados.map((n) => diasDesde(n.atualizado_em, agoraMs) ?? 0)),
      href: "/crm/negocios",
      cor: "#EF4444",
    });
  }

  // 2) Negócios abertos SEM próxima ação (sem dono do próximo passo)
  const semAcao = negocios.filter(
    (n) => NEGOCIO_ABERTO.has(String(n.status ?? "")) && !String(n.proxima_acao ?? "").trim()
  );
  if (semAcao.length > 0) {
    itens.push({
      key: "sem_proxima_acao",
      label: "Sem próxima ação",
      sub: "negócio sem próximo passo",
      count: semAcao.length,
      valor: semAcao.reduce((s, n) => s + Number(n.valor_estimado ?? 0), 0),
      piorDias: null,
      href: "/crm/negocios",
      cor: "#EAB308",
    });
  }

  // 3) Obras com previsão de término VENCIDA
  const atrasadas = obras.filter((o) => {
    if (!OBRA_ATIVA.has(String(o.status ?? ""))) return false;
    if (!o.data_previsao_fim) return false;
    const t = new Date(o.data_previsao_fim).getTime();
    return !Number.isNaN(t) && t < agoraMs;
  });
  if (atrasadas.length > 0) {
    itens.push({
      key: "obras_atrasadas",
      label: "Obras atrasadas",
      sub: "previsão de término vencida",
      count: atrasadas.length,
      valor: null,
      piorDias: Math.max(
        ...atrasadas.map((o) => Math.floor((agoraMs - new Date(o.data_previsao_fim as string).getTime()) / DIA))
      ),
      href: "/crm/obras",
      cor: "#f85149",
    });
  }

  // 4) Pedidos de material parados há +3 dias
  const pedParados = pedidos.filter(
    (p) => PEDIDO_TRAVADO.has(String(p.status ?? "")) && (diasDesde(p.atualizado_em, agoraMs) ?? 0) >= 3
  );
  if (pedParados.length > 0) {
    itens.push({
      key: "pedidos_parados",
      label: "Pedidos parados",
      sub: "material sem andamento",
      count: pedParados.length,
      valor: null,
      piorDias: Math.max(...pedParados.map((p) => diasDesde(p.atualizado_em, agoraMs) ?? 0)),
      href: "/crm/pedidos",
      cor: "#d29922",
    });
  }

  return { itens, tudoEmDia: itens.length === 0 };
}
