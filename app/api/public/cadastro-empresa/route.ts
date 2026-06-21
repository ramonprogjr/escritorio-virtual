import { NextRequest, NextResponse } from "next/server";
import { crmDb } from "@/lib/crm/supabase-server";
import {
  executarCadastroEmpresaPublico,
  publicSignupEnabled,
  validarCadastroEmpresaPublico,
} from "@/lib/crm/cadastro-empresa-publico";
import { checkPortalVerifyRateLimit } from "@/lib/portal-rate-limit";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: NextRequest) {
  if (!publicSignupEnabled()) {
    return NextResponse.json(
      { error: "Cadastro público temporariamente indisponível." },
      { status: 503 }
    );
  }

  const ip = clientIp(request);
  const rl = checkPortalVerifyRateLimit(`signup:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente mais tarde." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = validarCadastroEmpresaPublico(body as Record<string, unknown>);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await executarCadastroEmpresaPublico(crmDb(), parsed.data);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json(
      {
        ok: true,
        tenantId: result.tenantId,
        slug: result.slug,
        needsEmailConfirmation: result.needsEmailConfirmation,
      },
      { status: 201 }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao processar cadastro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
