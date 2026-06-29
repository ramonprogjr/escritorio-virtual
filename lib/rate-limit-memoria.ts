/**
 * Rate-limit em memória (best-effort) para endpoints PÚBLICOS de captação.
 * Por-instância (reseta em deploy; não compartilha entre réplicas) — é uma 1ª barreira
 * anti-spam/anti-abuso, não uma garantia distribuída. Para limite forte, migrar p/ Redis.
 */
const buckets = new Map<string, number[]>();

export function rateLimitExcedido(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now();
  const recentes = (buckets.get(chave) || []).filter((t) => agora - t < janelaMs);
  if (recentes.length >= max) {
    buckets.set(chave, recentes);
    return true;
  }
  recentes.push(agora);
  buckets.set(chave, recentes);
  // GC ocasional para não vazar memória sob muitos IPs distintos.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.some((t) => agora - t < janelaMs)) buckets.delete(k);
    }
  }
  return false;
}
