import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import { requireCrmSessao } from "@/lib/crm/crm-api-auth";

type EventoRow = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  lead_id: string | null;
  negocio_id: string | null;
  payload: Record<string, unknown> | null;
  ts: string;
};

export type Notificacao = {
  id: string;
  tipo: "info" | "sucesso" | "alerta";
  titulo: string;
  descricao: string;
  href: string | null;
  acionavel: boolean;
  ts: string;
};

// Só os eventos que valem como notificação acionável para o Hub.
const RELEVANTES = new Set([
  "lead_distribuido",
  "lead_recusado",
  "lead_recolocado",
  "lead_sem_proximo",
  "gate_pendencia_bloqueio",
  "gate_liberado",
  "entrega_gerada",
  "fornecedor_cobrado",
]);

function hrefDoEvento(e: EventoRow): string {
  if (e.lead_id) return `/crm/leads/${e.lead_id}`;
  if (e.negocio_id) return `/crm/negocios/${e.negocio_id}`;
  return "/crm/distribuicao";
}

function mapear(e: EventoRow): Notificacao {
  const p = e.payload ?? {};
  const nome = (p.parceiro_nome as string | undefined) ?? "fornecedor";
  const base = { id: e.id, href: hrefDoEvento(e), ts: e.ts };
  switch (e.event_type) {
    case "lead_distribuido":
      return { ...base, tipo: "info", titulo: "Lead distribuído", descricao: `Encaminhado para ${nome}${p.score != null ? ` · aderência ${p.score}` : ""}`, acionavel: false };
    case "lead_recolocado":
      return { ...base, tipo: "info", titulo: "Lead recolocado", descricao: `Recolocado para ${nome}`, acionavel: false };
    case "lead_recusado":
      return { ...base, tipo: "alerta", titulo: "Fornecedor recusou", descricao: `${nome} recusou — oferecendo ao próximo`, acionavel: false };
    case "lead_sem_proximo":
      return { ...base, href: "/crm/distribuicao", tipo: "alerta", titulo: "Lead sem fornecedor", descricao: "Voltou à fila — avaliar cobertura da rede", acionavel: true };
    case "gate_pendencia_bloqueio":
      return { ...base, href: "/crm/distribuicao", tipo: "alerta", titulo: "Envio barrado por pendência", descricao: `${nome} bloqueado por pendência financeira`, acionavel: true };
    case "gate_liberado":
      return { ...base, href: "/crm/distribuicao", tipo: "sucesso", titulo: "Fornecedor liberado", descricao: `${nome} liberado pelo Hub`, acionavel: false };
    case "entrega_gerada":
      return { ...base, tipo: "sucesso", titulo: "Entrega gerada", descricao: `${p.codigo ?? "Entrega"} · ${p.tipo ?? "obra"}`, acionavel: false };
    case "fornecedor_cobrado":
      return { ...base, href: "/crm/distribuicao", tipo: "alerta", titulo: "Cobrança enviada", descricao: `${nome}: ${p.motivo ?? "pendência / KPI"}`, acionavel: false };
    default:
      return { ...base, tipo: "info", titulo: e.event_type.replace(/_/g, " "), descricao: "", acionavel: false };
  }
}

/**
 * Notificações do Hub (C.2) — derivadas do keystone `hub_eventos` (sem tabela nova,
 * fonte única de verdade). Read-only. v1 foca no Hub; per-fornecedor e canais (WhatsApp/
 * email/push) são próximos incrementos.
 */
export async function GET(request: NextRequest) {
  const g = await requireCrmSessao(request);
  if ("error" in g) return g.error;

  const { data, error } = await crmDb()
    .from("hub_eventos")
    .select("id, event_type, entity_type, entity_id, lead_id, negocio_id, payload, ts")
    .order("ts", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notificacoes = ((data ?? []) as EventoRow[])
    .filter((e) => RELEVANTES.has(e.event_type))
    .map(mapear)
    .slice(0, 20);

  return NextResponse.json({ notificacoes });
}
