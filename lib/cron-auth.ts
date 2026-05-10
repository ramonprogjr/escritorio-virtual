import type { NextRequest } from "next/server";

const DEFAULT_DEV_SECRET = "obra10plus_cron_2026";

/**
 * Autoriza chamadas aos endpoints de ciclos (cron Vercel, curl manual, dev).
 * Em produção: Bearer CRON_SECRET, header/query secret legado, ou header x-vercel-cron.
 */
export function cronRequestAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const expected = process.env.CRON_SECRET || DEFAULT_DEV_SECRET;
  const qp = request.nextUrl.searchParams.get("secret");
  const hdr = request.headers.get("x-cron-secret");
  if (qp === expected || hdr === expected) return true;

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && process.env.CRON_SECRET) {
    const token = auth.slice(7);
    if (token === process.env.CRON_SECRET) return true;
  }

  if (request.headers.get("x-vercel-cron") === "1") return true;

  return false;
}
