import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Matriz de códigos do Hub (rastreio ponta a ponta).
 *
 * | Prefixo | Entidade        | Tabela           | Quando é gerado                          |
 * |---------|-----------------|------------------|------------------------------------------|
 * | PES     | Pessoa/contato  | hub_pessoas      | Cadastro PF/PJ, vínculo automático lead  |
 * | EMP     | Empresa (PJ)    | hub_empresas     | Super cadastro PJ                        |
 * | LED     | Lead comercial  | hub_leads_crm    | Pipeline vendas (WhatsApp, CRM, cadastro)|
 * | NEG     | Negócio         | hub_negocios     | Conversão lead → oportunidade            |
 * | PAR     | Parceiro rede   | hub_parceiros    | Formulário / convite parceiro            |
 * | IMO     | Imóvel          | hub_imoveis      | Cadastro de imóvel                       |
 *
 * Cadeia típica (PDF Pt.20): PES → LED → NEG → PAR; PJ também EMP; imóvel IMO.
 * Busca unificada: GET /api/crm/rastreio?codigo=
 */
export const HUB_PREFIXO_CODIGO = {
  pessoa: "PES",
  empresa: "EMP",
  lead: "LED",
  negocio: "NEG",
  parceiro: "PAR",
  imovel: "IMO",
} as const;

export type HubPrefixoCodigo = (typeof HUB_PREFIXO_CODIGO)[keyof typeof HUB_PREFIXO_CODIGO];

/** Prefixo legado (3 letras) → entidade, para a rpc atômica `crm_proximo_codigo`. */
const ENTIDADE_POR_PREFIXO: Record<string, string> = {
  PES: "pessoa",
  EMP: "empresa",
  LED: "lead",
  NEG: "negocio",
  PAR: "parceiro",
  IMO: "imovel",
};

/**
 * Gera o código único do cadastro (rastreio ponta a ponta, tipo "CPF").
 * Formato compacto `PREFIXO+AAAA+SEQ` (ex.: PS2026001; negócio embute o mercado:
 * NGIMB2026001). Gerado por sequência ATÔMICA no banco (`crm_proximo_codigo`,
 * contador por ano) → sem corrida e sem vazar contagem entre tenants.
 * Fallback degradado (PREFIXO-AAAA-####, COUNT+1) só se a rpc estiver indisponível.
 */
export async function gerarCodigoSequencial(
  supabase: SupabaseClient,
  tabela: string,
  prefixo: HubPrefixoCodigo,
  mercado?: string | null
): Promise<string> {
  const entidade = ENTIDADE_POR_PREFIXO[prefixo] ?? "pessoa";
  try {
    const { data, error } = await supabase.rpc("crm_proximo_codigo", {
      p_entidade: entidade,
      p_mercado: mercado ?? null,
    });
    if (!error && typeof data === "string" && data) return data;
  } catch {
    /* cai no fallback abaixo */
  }
  const year = new Date().getFullYear();
  const { count } = await supabase.from(tabela).select("*", { count: "exact", head: true });
  const seq = String((count || 0) + 1).padStart(4, "0");
  return `${prefixo}-${year}-${seq}`;
}
