import type { SupabaseClient } from "@supabase/supabase-js";
import { registrarEvento } from "@/lib/crm/registrar-evento";

const DEFAULT_TENANT = "00000000-0000-4000-8000-000000000001";
// Não recobra o mesmo fornecedor pelo mesmo motivo dentro deste período (idempotência).
const COBRANCA_COOLDOWN_MS = 12 * 60 * 60 * 1000;

type EventoRow = {
  event_type: string;
  fornecedor_id: string | null;
  payload: Record<string, unknown> | null;
  ts: string;
};

export type AuditorResult = {
  avaliados: number;
  cobrancas: Array<{ fornecedor_id: string; nome: string | null; motivo: string }>;
};

/**
 * Auditor autônomo da rede (C.1c) — "a IA audita e cobra sozinha".
 * Lê `hub_eventos`, agrega por fornecedor, cruza com `hub_parceiros.status_financeiro` e,
 * para quem tem pendência / alta recusa, EMITE uma cobrança automática (`fornecedor_cobrado`,
 * ator `ia_auditor`) — que aparece no feed e no sino. Idempotente: respeita um cooldown de 12h
 * por fornecedor (não recobra a cada tick). Regras determinísticas (padrão "propõe-não-altera").
 * Rodável por cron (agendado) ou pelo botão "Rodar auditor agora".
 */
export async function rodarAuditorRede(
  supabase: SupabaseClient,
  tenantId: string | null,
  agoraMs: number
): Promise<AuditorResult> {
  let q = supabase
    .from("hub_eventos")
    .select("event_type, fornecedor_id, payload, ts")
    .order("ts", { ascending: false })
    .limit(3000);
  // `.eq` puro (nunca `.or(...is.null)`): agrega hub_eventos por tenant sem over-share cross-tenant.
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data } = await q;
  const eventos = (data ?? []) as EventoRow[];

  type Agg = { nome: string | null; recebidos: number; recusados: number; ultimoCobradoMs: number | null };
  const agg = new Map<string, Agg>();
  const get = (id: string, nome: string | null): Agg => {
    let a = agg.get(id);
    if (!a) {
      a = { nome, recebidos: 0, recusados: 0, ultimoCobradoMs: null };
      agg.set(id, a);
    }
    if (nome && !a.nome) a.nome = nome;
    return a;
  };

  for (const e of eventos) {
    const fid = e.fornecedor_id;
    if (!fid) continue;
    const nome = (e.payload?.parceiro_nome as string | undefined) ?? null;
    if (e.event_type === "lead_distribuido" || e.event_type === "lead_recolocado") get(fid, nome).recebidos++;
    else if (e.event_type === "lead_recusado") get(fid, nome).recusados++;
    else if (e.event_type === "fornecedor_cobrado") {
      const a = get(fid, nome);
      const t = Date.parse(e.ts);
      if (!Number.isNaN(t) && (a.ultimoCobradoMs === null || t > a.ultimoCobradoMs)) a.ultimoCobradoMs = t;
    }
  }

  const ids = [...agg.keys()];
  const statusById = new Map<string, string>();
  const nomeById = new Map<string, string | null>();
  if (ids.length) {
    // Resolve nome/status SÓ de parceiros do mesmo tenant (não cruza parceiro de outro tenant).
    let pq = supabase
      .from("hub_parceiros")
      .select("id, nome, status_financeiro")
      .in("id", ids);
    if (tenantId) pq = pq.eq("tenant_id", tenantId);
    const { data: ps } = await pq;
    for (const p of ps ?? []) {
      statusById.set(p.id as string, (p.status_financeiro as string) ?? "em_dia");
      nomeById.set(p.id as string, (p.nome as string) ?? null);
    }
  }

  const cobrancas: AuditorResult["cobrancas"] = [];
  for (const [fid, a] of agg) {
    const status = statusById.get(fid) ?? "em_dia";
    const nome = nomeById.get(fid) ?? a.nome;
    let motivo: string | null = null;
    if (status === "bloqueado") motivo = "Pendência financeira — bloqueado para receber leads";
    else if (status === "pendente") motivo = "Pendência financeira em aberto";
    else if (a.recusados >= 2 && a.recusados >= a.recebidos) motivo = "Alta taxa de recusa — avaliar aderência";
    if (!motivo) continue;

    // Idempotência: já cobrado nas últimas 12h? então pula (não recobra a cada tick).
    if (a.ultimoCobradoMs !== null && agoraMs - a.ultimoCobradoMs < COBRANCA_COOLDOWN_MS) continue;

    await registrarEvento(supabase, {
      event_type: "fornecedor_cobrado",
      entity_type: "fornecedor",
      entity_id: fid,
      fornecedor_id: fid,
      ator: "ia_auditor",
      payload: { parceiro_nome: nome, motivo, automatico: true },
      tenant_id: tenantId ?? DEFAULT_TENANT,
    });
    cobrancas.push({ fornecedor_id: fid, nome, motivo });
  }

  return { avaliados: agg.size, cobrancas };
}
