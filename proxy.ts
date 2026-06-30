import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { CRM_ACCESS_COOKIE, fetchAuthUserFromAccessToken } from "@/lib/auth/crm-session";
import { getSafeReturnPath } from "@/lib/auth/safe-return-path";

/**
 * Rotas /api públicas ou com auth própria na route handler.
 * Escritório virtual (/office) e CRM (/crm): mesma sessão (cookie após login).
 */
function isPublicApiPath(pathname: string): boolean {
  if (pathname.startsWith("/api/whatsapp")) return true;
  // G-D1: /api/health saiu da lista pública — expõe QUAIS segredos da plataforma existem.
  // Agora é owner-only (guard na própria route handler). Decisão do dono.
  if (pathname.startsWith("/api/public/")) return true;
  if (pathname === "/api/parceiros/portal/verify") return true;
  if (pathname.startsWith("/api/validar/")) return true;
  if (pathname.startsWith("/api/ciclos/")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/ml/ciclo")) return true;
  if (pathname === "/api/auth/crm-session") return true;
  // Cadastro público de parceiro via link da rede — acesso anônimo intencional;
  // rate-limit aplicado no próprio handler (H-SEC-2).
  if (pathname === "/api/parceiro/cadastro-publico") return true;
  return false;
}

async function getSessionUser(request: NextRequest) {
  const token = request.cookies.get(CRM_ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const authUser = await fetchAuthUserFromAccessToken(token);
    if (!authUser) return null;
    return authUser;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionUser = await getSessionUser(request);

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    if (sessionUser) {
      const url = request.nextUrl.clone();
      const next = url.searchParams.get("next");
      url.pathname = getSafeReturnPath(next, "/crm");
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/cadastre-se" || pathname.startsWith("/cadastre-se/")) {
    if (sessionUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/crm/onboarding-tenant";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = sessionUser ? "/crm" : "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (pathname === "/office" || pathname.startsWith("/office/")) {
    if (!sessionUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/crm" || pathname.startsWith("/crm/")) {
    if (!sessionUser) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  const validKey = process.env.INTERNAL_API_KEY;
  const apiKey = request.headers.get("x-api-key");

  if (validKey && apiKey === validKey) {
    return NextResponse.next();
  }

  if (sessionUser) {
    return NextResponse.next();
  }

  if (!validKey) {
    return NextResponse.json(
      {
        error: "API não autenticável neste pedido",
        detail:
          "Sem sessão CRM e sem INTERNAL_API_KEY no servidor. Para chamadas sem cookie: defina INTERNAL_API_KEY e no cliente NEXT_PUBLIC_INTERNAL_API_KEY (mesmo valor). Para validar o cookie no middleware: NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY devem estar definidos.",
      },
      { status: 401 }
    );
  }

  return NextResponse.json({ error: "Acesso negado" }, { status: 401 });
}

export const config = {
  matcher: [
    "/",
    "/cadastre-se",
    "/cadastre-se/:path*",
    "/office",
    "/office/:path*",
    "/crm",
    "/crm/:path*",
    "/login",
    "/login/:path*",
    "/api/:path*",
  ],
};
