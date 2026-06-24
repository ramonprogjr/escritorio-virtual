import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverAgenteResponsavelLead, type LeadRoutingContext } from "@/lib/crm/lead-routing-rules";

export type RegraRoteamento = {
  id: string;
  prioridade: number;
  ativo: boolean;
  origem: string | null;
  mercado: string | null;
  uf: string | null;
  destino_tipo: string;
  destino_valor: string | null;
  rotulo: string | null;
};

function normaliza(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Roteamento configurável: aplica a 1ª regra ATIVA que casa (origem/mercado/uf, com
 * null = "qualquer"), por prioridade asc. Cai na heurística atual se nenhuma regra
 * casar OU a query falhar (nunca quebra o fluxo de criação de lead).
 * Retorna o slug do agente/atendente responsável.
 */
export async function resolverDestinoLead(
  supabase: SupabaseClient,
  ctx: LeadRoutingContext & { uf?: string | null }
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from("hub_lead_routing_regras")
      .select("id, prioridade, ativo, origem, mercado, uf, destino_tipo, destino_valor")
      .eq("ativo", true)
      .in("destino_tipo", ["agente", "atendente"])
      .order("prioridade", { ascending: true });

    if (!error && Array.isArray(data) && data.length) {
      const origem = normaliza(ctx.origem ?? ctx.origem_cadastro);
      const mercado = normaliza(ctx.mercados?.[0]);
      const uf = normaliza(ctx.uf);
      const regra = (data as RegraRoteamento[]).find(
        r =>
          (!r.origem || normaliza(r.origem) === origem) &&
          (!r.mercado || normaliza(r.mercado) === mercado) &&
          (!r.uf || normaliza(r.uf) === uf)
      );
      if (regra?.destino_valor?.trim()) return regra.destino_valor.trim();
    }
  } catch {
    /* fallback abaixo */
  }
  return resolverAgenteResponsavelLead(ctx);
}
