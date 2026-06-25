/**
 * Deriva o `tipo` (NOT NULL) de hub_negocios a partir do prefixo de mercado.
 * Compartilhado entre o POST de negócios e a conversão lead→negócio, para que
 * ambos gravem o mesmo valor e o botão "Criar negócio" não quebre.
 */
export function legacyNegocioTipoFromMercado(prefixo: string): string {
  switch (String(prefixo || "").trim().toUpperCase()) {
    case "IMB":
      return "mercado_imobiliario";
    case "RFM":
      return "reforma";
    case "FOR":
      return "fornecedor_homologacao";
    default:
      return "produto_servico";
  }
}
