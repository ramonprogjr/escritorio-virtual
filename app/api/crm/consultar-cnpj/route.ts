import { NextRequest, NextResponse } from "next/server";
import { validarCnpj, normalizarDocumento, documentoCompleto } from "@/lib/crm/documento-brasil";
import { buscarCnpjOpenCnpj } from "@/lib/crm/opencnpj";
import { checkPortalVerifyRateLimit } from "@/lib/portal-rate-limit";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** GET ?cnpj= — consulta OpenCNPJ e devolve dados para auto-preenchimento.
 *  Público (consulta legítima de CNPJ), mas com rate-limit por IP contra
 *  abuso/custo do proxy externo. */
export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  const rl = checkPortalVerifyRateLimit(`consultar-cnpj:${ip}`, 20, 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas consultas. Tente novamente em instantes.", valido: false },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const cnpj = request.nextUrl.searchParams.get("cnpj") || "";
  const digits = normalizarDocumento(cnpj);

  if (!documentoCompleto("PJ", digits)) {
    return NextResponse.json(
      { error: "Informe o CNPJ com 14 dígitos.", valido: false },
      { status: 400 }
    );
  }

  if (!validarCnpj(digits)) {
    return NextResponse.json({ error: "CNPJ inválido (dígitos verificadores).", valido: false }, { status: 400 });
  }

  const result = await buscarCnpjOpenCnpj(digits);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.erro, valido: false },
      { status: result.status >= 400 ? result.status : 502 }
    );
  }

  return NextResponse.json({
    valido: true,
    dados: result.dados,
  });
}
