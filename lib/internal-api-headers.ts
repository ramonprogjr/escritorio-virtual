/**
 * Cabeçalho esperado pelo middleware em `proxy.ts` para rotas /api internas.
 * No cliente use NEXT_PUBLIC_INTERNAL_API_KEY (mesmo valor que INTERNAL_API_KEY).
 */
export function internalApiHeaders(): Record<string, string> {
  const key =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_INTERNAL_API_KEY
      : process.env.INTERNAL_API_KEY;
  const h: Record<string, string> = {};
  if (key) h["x-api-key"] = key;
  return h;
}
