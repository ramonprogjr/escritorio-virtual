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

/**
 * Fonte do motor de distribuição (FLAG REVERSÍVEL).
 *
 * - `parceiros` (DEFAULT) → lê `hub_parceiros`, exatamente como sempre. Zero regressão.
 * - `fornecedores`        → lê o espelho `hub_fornecedores` (mesmo filtro/score),
 *                           mapeando `mercado_principal → mercado`.
 *
 * Reversão instantânea: basta `MOTOR_FONTE=parceiros` (ou remover a env). Se a leitura
 * de fornecedores ERRAR ou vier VAZIA, o motor cai de volta para parceiros sozinho.
 */
export type MotorFonte = "parceiros" | "fornecedores";

function motorFonte(): MotorFonte {
  return process.env.MOTOR_FONTE?.trim().toLowerCase() === "fornecedores"
    ? "fornecedores"
    : "parceiros";
}

/** Linha mínima que o scoreParceiro precisa, já com `mercado` normalizado. */
type LinhaCandidato = {
  id: string;
  nome: string;
  telefone: string;
  mercado: string | null;
  especialidade: string | null;
  cidade: string | null;
  estado: string | null;
  status: string | null;
  total_leads_recebidos: number | null;
  status_financeiro: string | null;
};

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

/**
 * Rankeia linhas já normalizadas (mesma regra para as duas fontes).
 * O `scoreParceiro` é REUSADO sem alteração — só muda a FONTE das linhas.
 */
function rankearCandidatos(
  linhas: LinhaCandidato[],
  input: MatchingInput
): CandidatoParceiro[] {
  const candidatos: CandidatoParceiro[] = [];
  for (const row of linhas) {
    const { score, motivo } = scoreParceiro(
      {
        mercado: row.mercado,
        especialidade: row.especialidade,
        cidade: row.cidade,
        estado: row.estado,
        total_leads_recebidos: row.total_leads_recebidos,
        status: row.status,
        status_financeiro: row.status_financeiro,
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
      status_financeiro: String(row.status_financeiro ?? "em_dia"),
    });
  }

  candidatos.sort((a, b) => b.score - a.score);
  return candidatos.slice(0, input.limite ?? 5);
}

/** Lê `hub_parceiros` (fonte PADRÃO/legada). Vazio/erro → []. */
async function lerLinhasParceiros(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LinhaCandidato[]> {
  const { data, error } = await supabase
    .from("hub_parceiros")
    .select(
      "id, nome, telefone, mercado, especialidade, cidade, estado, status, recebe_leads, total_leads_recebidos, status_financeiro"
    )
    .eq("recebe_leads", true)
    .or(tenantScopeOrFilter(tenantId))
    .eq("status", "homologado")
    .limit(100);

  if (error || !data?.length) return [];
  return data.map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    telefone: String(row.telefone),
    mercado: row.mercado ?? null,
    especialidade: row.especialidade ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    status: row.status ?? null,
    total_leads_recebidos: (row as { total_leads_recebidos?: number | null }).total_leads_recebidos ?? null,
    status_financeiro: (row as { status_financeiro?: string | null }).status_financeiro ?? null,
  }));
}

/**
 * Lê o espelho `hub_fornecedores` (fonte atrás da flag). Mapeia
 * `mercado_principal → mercado`; o resto das colunas tem o mesmo nome.
 * MESMO filtro (recebe_leads + status='homologado') e MESMO escopo de tenant.
 * Lança em erro de banco (o chamador trata o fallback).
 */
async function lerLinhasFornecedores(
  supabase: SupabaseClient,
  tenantId: string
): Promise<LinhaCandidato[]> {
  const { data, error } = await supabase
    .from("hub_fornecedores")
    .select(
      "id, nome, telefone, mercado_principal, especialidade, cidade, estado, status, recebe_leads, total_leads_recebidos, status_financeiro"
    )
    .eq("recebe_leads", true)
    .or(tenantScopeOrFilter(tenantId))
    .eq("status", "homologado")
    .limit(100);

  if (error) throw error;
  if (!data?.length) return [];
  return data.map((row) => ({
    id: String(row.id),
    nome: String(row.nome),
    telefone: String(row.telefone ?? ""),
    // Mapeamento de coluna: o scoreParceiro espera `mercado`.
    mercado: (row as { mercado_principal?: string | null }).mercado_principal ?? null,
    especialidade: row.especialidade ?? null,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    status: row.status ?? null,
    total_leads_recebidos: (row as { total_leads_recebidos?: number | null }).total_leads_recebidos ?? null,
    status_financeiro: (row as { status_financeiro?: string | null }).status_financeiro ?? null,
  }));
}

/** Lista parceiros elegíveis rankeados por score (recebe_leads + homologação). */
export async function listarCandidatosParceiro(
  supabase: SupabaseClient,
  input: MatchingInput
): Promise<CandidatoParceiro[]> {
  // Isolamento multi-tenant: o motor usa service-role (ignora RLS), então o filtro
  // por tenant é a ÚNICA barreira. Sem tenant_id no input, cai no tenant padrão e
  // SEMPRE aplica o escopo — nunca lista candidatos de todos os tenants.
  const tenantId = input.tenant_id?.trim() || defaultTenantId();

  let linhas: LinhaCandidato[] = [];
  if (motorFonte() === "fornecedores") {
    // Fonte atrás da flag. Se ERRAR ou vier VAZIA, cai de volta para parceiros.
    try {
      linhas = await lerLinhasFornecedores(supabase, tenantId);
    } catch (e) {
      console.warn("[distribuir-lead] MOTOR_FONTE=fornecedores falhou; fallback p/ parceiros:", e);
      linhas = [];
    }
    if (linhas.length === 0) {
      linhas = await lerLinhasParceiros(supabase, tenantId);
    }
  } else {
    linhas = await lerLinhasParceiros(supabase, tenantId);
  }

  return rankearCandidatos(linhas, input);
}

export async function melhorCandidatoParceiro(
  supabase: SupabaseClient,
  input: MatchingInput
): Promise<CandidatoParceiro | null> {
  const lista = await listarCandidatosParceiro(supabase, { ...input, limite: 1 });
  return lista[0] ?? null;
}
