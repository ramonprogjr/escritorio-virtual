import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultTenantId, tenantScopeOrFilter } from "@/lib/tenant-default";

export type CandidatoParceiro = {
  parceiro_id: string;
  nome: string;
  telefone: string;
  mercado: string | null;
  cidade: string | null;
  estado: string | null;
  score: number;
  motivo: string;
  status_financeiro: string;
};

export type MatchingInput = {
  mercado: string;
  cidade?: string | null;
  estado?: string | null;
  tenant_id?: string;
  limite?: number;
};

const STATUS_HOMOLOGADO = new Set(["homologado", "ativo", "aprovado"]);

function normalizar(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

function scoreParceiro(
  p: {
    mercado: string | null;
    especialidade: string | null;
    cidade: string | null;
    estado: string | null;
    total_leads_recebidos: number | null;
    status: string | null;
    status_financeiro?: string | null;
  },
  input: MatchingInput
): { score: number; motivo: string } {
  let score = 0;
  const motivos: string[] = [];
  const mercadoAlvo = input.mercado.trim().toUpperCase();
  const mercadoParceiro = (p.mercado ?? "").trim().toUpperCase();
  const esp = (p.especialidade ?? "").trim().toUpperCase();

  if (mercadoParceiro === mercadoAlvo) {
    score += 40;
    motivos.push(`mercado ${mercadoAlvo}`);
  } else if (esp.includes(mercadoAlvo)) {
    score += 25;
    motivos.push(`especialidade compatível`);
  } else if (!mercadoParceiro && !esp) {
    score += 5;
    motivos.push("sem mercado definido");
  }

  const cidadeLead = normalizar(input.cidade);
  const ufLead = normalizar(input.estado);
  const cidadeParceiro = normalizar(p.cidade);
  const ufParceiro = normalizar(p.estado);

  if (cidadeLead && cidadeParceiro && cidadeLead === cidadeParceiro) {
    score += 30;
    motivos.push("mesma cidade");
  } else if (ufLead && ufParceiro && ufLead === ufParceiro) {
    score += 15;
    motivos.push("mesmo UF");
  }

  const carga = p.total_leads_recebidos ?? 0;
  score += Math.max(0, 20 - Math.min(carga, 20));
  motivos.push(`carga ${carga}`);

  if (p.status && STATUS_HOMOLOGADO.has(p.status.toLowerCase())) {
    score += 10;
    motivos.push("homologado");
  }

  // Flywheel IAH (dimensão financeira): pendência rebaixa o ranking → incentivo a ficar em dia.
  const fin = (p.status_financeiro ?? "em_dia").toLowerCase();
  if (fin === "bloqueado") {
    score -= 40;
    motivos.push("bloqueado −40");
  } else if (fin === "pendente") {
    score -= 15;
    motivos.push("pendência −15");
  }

  return { score, motivo: motivos.join(" · ") || "score base" };
}

/** Lista parceiros elegíveis rankeados por score (recebe_leads + homologação). */
export async function listarCandidatosParceiro(
  supabase: SupabaseClient,
  input: MatchingInput
): Promise<CandidatoParceiro[]> {
  // Isolamento multi-tenant: o motor usa service-role (ignora RLS), então o filtro
  // por tenant é a ÚNICA barreira. Sem tenant_id no input, cai no tenant padrão e
  // SEMPRE aplica o escopo — nunca lista parceiros de todos os tenants.
  const tenantId = input.tenant_id?.trim() || defaultTenantId();
  const query = supabase
    .from("hub_parceiros")
    .select(
      "id, nome, telefone, mercado, especialidade, cidade, estado, status, recebe_leads, total_leads_recebidos, status_financeiro"
    )
    .eq("recebe_leads", true)
    .or(tenantScopeOrFilter(tenantId));

  const { data, error } = await query.eq("status", "homologado").limit(100);
  if (error || !data?.length) return [];

  const candidatos: CandidatoParceiro[] = [];
  for (const row of data) {
    const { score, motivo } = scoreParceiro(
      {
        mercado: row.mercado,
        especialidade: row.especialidade,
        cidade: row.cidade,
        estado: row.estado,
        total_leads_recebidos: row.total_leads_recebidos,
        status: row.status,
        status_financeiro: (row as { status_financeiro?: string | null }).status_financeiro,
      },
      input
    );

    if (score < 10) continue;

    candidatos.push({
      parceiro_id: String(row.id),
      nome: String(row.nome),
      telefone: String(row.telefone),
      mercado: row.mercado,
      cidade: row.cidade,
      estado: row.estado,
      score,
      motivo,
      status_financeiro: String((row as { status_financeiro?: string | null }).status_financeiro ?? "em_dia"),
    });
  }

  candidatos.sort((a, b) => b.score - a.score);
  return candidatos.slice(0, input.limite ?? 5);
}

export async function melhorCandidatoParceiro(
  supabase: SupabaseClient,
  input: MatchingInput
): Promise<CandidatoParceiro | null> {
  const lista = await listarCandidatosParceiro(supabase, { ...input, limite: 1 });
  return lista[0] ?? null;
}
