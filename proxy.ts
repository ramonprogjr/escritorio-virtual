import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Rotas /api públicas ou com auth própria na route handler.
 * Demais /api/* exigem header `x-api-key` = INTERNAL_API_KEY (ou NEXT_PUBLIC_INTERNAL_API_KEY no browser).
 */
function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/whatsapp")) return true;
  if (pathname.startsWith("/api/health")) return true;
  if (pathname === "/api/parceiros/portal/verify") return true;
  if (pathname.startsWith("/api/validar/")) return true;
  if (pathname.startsWith("/api/ciclos/")) return true;
  if (pathname.startsWith("/api/ml/ciclo")) return true;
  return false;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const apiKey = request.headers.get("x-api-key");
  const validKey = process.env.INTERNAL_API_KEY;

  if (!validKey) {
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 });
  }

  if (apiKey !== validKey) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
