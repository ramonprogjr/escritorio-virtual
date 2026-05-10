/**
 * Rate limit em memória (melhor em instância única; em serverless reduz abuso casual).
 * Chave típica: IP do cliente.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export type PortalRateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkPortalVerifyRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number
): PortalRateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= maxPerWindow) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}

/** Limpeza ocasional para não crescer sem limite em dev */
export function _resetPortalRateLimitForTests(): void {
  buckets.clear();
}
