import type { PrefixoMercado } from "@/lib/crm/negocio-cadastro";

export type LeadRoutingContext = {
  origem?: string | null;
  origem_cadastro?: string | null;
  mercados?: string[];
  indicado_por?: string | null;
};

/** Agente IA responsável pelo lead (slug em hub_agente_identidade). */
export function resolverAgenteResponsavelLead(ctx: LeadRoutingContext): string {
  const mercado = (ctx.mercados?.[0] ?? "").toUpperCase() as PrefixoMercado | "";
  const origemCadastro = (ctx.origem_cadastro ?? "").toLowerCase();

  if (origemCadastro === "whatsapp" || ctx.origem === "whatsapp") {
    if (mercado === "IMB" || mercado === "ARQ") return "atendente";
  }

  if (ctx.origem === "indicacao" || ctx.indicado_por) return "sdr";

  return "sdr";
}

/** Metadata extra para leads com indicação de parceiro. */
export function metadataRoutingLead(ctx: LeadRoutingContext): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (ctx.indicado_por) extra.indicado_por = ctx.indicado_por;
  return extra;
}

/** Converte mercado textual do WhatsApp para prefixo CRM (IMB, ARQ, …). */
export function mercadoWhatsappParaPrefixo(mercado: string): string {
  const m = mercado.trim().toLowerCase();
  if (m.includes("imob")) return "IMB";
  if (m.includes("arq")) return "ARQ";
  if (m.includes("reform") || m.includes("rfm")) return "RFM";
  if (m.includes("eng")) return "ENG";
  if (m.length <= 4 && m === m.toUpperCase()) return m.toUpperCase();
  return "IMB";
}
