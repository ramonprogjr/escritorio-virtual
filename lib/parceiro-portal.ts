import crypto from "crypto";

/**
 * Assinatura HMAC do id do parceiro para acesso ao portal (sem Supabase Auth).
 * Em produção defina PORTAL_HMAC_SECRET; caso contrário usa CRON_SECRET.
 */
export function assinarParceiroPortal(parceiroId: string): string {
  const secret = process.env.PORTAL_HMAC_SECRET || process.env.CRON_SECRET || "obra10plus_dev_only";
  return crypto.createHmac("sha256", secret).update(parceiroId).digest("hex");
}

export function parceiroPortalValido(parceiroId: string, assinatura: string): boolean {
  try {
    const esperado = assinarParceiroPortal(parceiroId);
    if (esperado.length !== assinatura.length) return false;
    return crypto.timingSafeEqual(Buffer.from(esperado, "utf8"), Buffer.from(assinatura, "utf8"));
  } catch {
    return false;
  }
}
