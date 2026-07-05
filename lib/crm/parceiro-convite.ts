import crypto from "crypto";

/**
 * Atribuição de "QUEM CONVIDOU" no link público de parceiro — à prova de forja (Fase 2).
 *
 * O userId do convidador vai NA URL (`?por=`), acompanhado de uma assinatura HMAC (`?sig=`)
 * gerada no SERVIDOR a partir do userId da sessão. O cadastro público só CREDITA o convidador
 * quando a assinatura confere — um visitante não consegue forjar atribuição (não tem o segredo).
 * Isto resolve o problema do `?por` cru (forjável) que o próprio repo já rejeitou no especialista
 * (nota H-SEC-3): sem assinatura, qualquer um creditaria qualquer vendedor = fraude de comissão.
 *
 * Segredo: reusa o do portal do parceiro (PORTAL_HMAC_SECRET || CRON_SECRET). Em prod ele DEVE
 * estar definido; sem ele cai no fallback dev e a atribuição deixa de ser confiável (assinatura
 * previsível). O payload é domain-separado ("convite-parceiro:") p/ um sig do portal nunca valer
 * como sig de convite, mesmo com o mesmo segredo.
 */
function conviteSecret(): string {
  return process.env.PORTAL_HMAC_SECRET || process.env.CRON_SECRET || "obra10plus_dev_only";
}

export function assinarConviteParceiro(userId: string): string {
  return crypto
    .createHmac("sha256", conviteSecret())
    .update(`convite-parceiro:${userId}`)
    .digest("hex");
}

export function conviteParceiroValido(userId: string, assinatura: string): boolean {
  if (!userId || !assinatura) return false;
  try {
    const esperado = assinarConviteParceiro(userId);
    // timingSafeEqual exige mesmo tamanho — compara comprimento antes (sem vazar por timing).
    if (esperado.length !== assinatura.length) return false;
    return crypto.timingSafeEqual(Buffer.from(esperado, "utf8"), Buffer.from(assinatura, "utf8"));
  } catch {
    return false;
  }
}
