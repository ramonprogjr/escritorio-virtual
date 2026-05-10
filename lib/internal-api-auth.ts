import type { NextRequest } from "next/server";

/** Mesma chave que o middleware exige para /api internas (exceto rotas públicas). */
export function internalApiKeyAuthorized(request: NextRequest): boolean {
  const apiKey = request.headers.get("x-api-key");
  const validKey = process.env.INTERNAL_API_KEY;
  return !!(validKey && apiKey === validKey);
}
