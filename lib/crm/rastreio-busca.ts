import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * BUSCA POR NOME do cabeçalho do CRM (o usuário chama tudo pelo NOME — códigos de
 * identidade são internos e escondidos). Complementa a resolução por CÓDIGO
 * (resolver-rastreio-codigo): quando o texto digitado NÃO é um código, procuramos
 * pessoas/empresas/negócios/leads cujo nome casa (ILIKE) e devolvemos uma lista
 * navegável.
 *
 * SEGURANÇA (crmDb é service-role e BYPASSA RLS): tenant SEMPRE por `.eq('tenant_id')`
 * PURO (nunca `.or(is.null)`) — código novo não herda o over-share legado. A entrada é
 * saneada antes de virar padrão ILIKE para não quebrar o parser do PostgREST nem permitir
 * curinga/`or`-injection. Comprimento mínimo de 2 evita varredura com 1 caractere.
 */

export type RastreioBuscaResultado = {
  tipo: "pessoa" | "empresa" | "negocio" | "lead";
  id: string;
  titulo: string;
  sub: string;
  href: string;
};

/** Quantos por entidade e no total (mantém o dropdown enxuto e a query barata). */
const LIMITE_POR_ENTIDADE = 5;
const LIMITE_TOTAL = 20;
export const BUSCA_NOME_MIN = 2;

/**
 * Remove o que quebra o PostgREST (`,` `(` `)` separam termos no `.or`), os curingas do
 * ILIKE (`%` `_`) e a barra de escape — reduz a um texto simples de nome. Colapsa espaços.
 */
export function sanitizarBuscaNome(raw: string): string {
  return (raw ?? "")
    .replace(/[,()*%_\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type Linha = Record<string, unknown>;

function s(v: unknown): string {
  return v == null ? "" : String(v);
}

export async function buscarPorNome(
  supabase: SupabaseClient,
  qRaw: string,
  tenantId: string
): Promise<RastreioBuscaResultado[]> {
  const q = sanitizarBuscaNome(qRaw);
  if (q.length < BUSCA_NOME_MIN) return [];
  const like = `%${q}%`;

  const [pessoasRes, empresasRes, negociosRes, leadsRes] = await Promise.all([
    supabase
      .from("hub_pessoas")
      .select("id, nome")
      .eq("tenant_id", tenantId)
      .ilike("nome", like)
      .limit(LIMITE_POR_ENTIDADE),
    supabase
      .from("hub_empresas")
      .select("id, razao_social, nome_fantasia")
      .eq("tenant_id", tenantId)
      .or(`razao_social.ilike.${like},nome_fantasia.ilike.${like}`)
      .limit(LIMITE_POR_ENTIDADE),
    supabase
      .from("hub_negocios")
      .select("id, titulo, status")
      .eq("tenant_id", tenantId)
      .ilike("titulo", like)
      .limit(LIMITE_POR_ENTIDADE),
    supabase
      .from("hub_leads_crm")
      .select("id, nome, estagio")
      .eq("tenant_id", tenantId)
      .ilike("nome", like)
      .limit(LIMITE_POR_ENTIDADE),
  ]);

  const out: RastreioBuscaResultado[] = [];

  for (const r of (pessoasRes.data ?? []) as Linha[]) {
    out.push({ tipo: "pessoa", id: s(r.id), titulo: s(r.nome) || "—", sub: "Pessoa", href: `/crm/pessoas/${s(r.id)}` });
  }
  for (const r of (empresasRes.data ?? []) as Linha[]) {
    const nome = s(r.razao_social) || s(r.nome_fantasia) || "—";
    out.push({ tipo: "empresa", id: s(r.id), titulo: nome, sub: "Empresa", href: `/crm/empresas/${s(r.id)}` });
  }
  for (const r of (negociosRes.data ?? []) as Linha[]) {
    out.push({ tipo: "negocio", id: s(r.id), titulo: s(r.titulo) || "—", sub: `Negócio · ${s(r.status) || "—"}`, href: `/crm/negocios/${s(r.id)}` });
  }
  for (const r of (leadsRes.data ?? []) as Linha[]) {
    out.push({ tipo: "lead", id: s(r.id), titulo: s(r.nome) || "—", sub: `Lead · ${s(r.estagio) || "—"}`, href: `/crm/leads/${s(r.id)}` });
  }

  return out.slice(0, LIMITE_TOTAL);
}
