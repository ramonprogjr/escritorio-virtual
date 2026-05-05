import { NextRequest, NextResponse } from "next/server";

function validarCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;

  const calc = (d: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + parseInt(d[i]) * w, 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(digits, w1) === parseInt(digits[12]) && calc(digits, w2) === parseInt(digits[13]);
}

export async function GET(request: NextRequest) {
  const cnpj = request.nextUrl.searchParams.get("cnpj") || "";
  const digits = cnpj.replace(/\D/g, "");
  const valido = validarCNPJ(digits);

  if (!valido) {
    return NextResponse.json({ valido: false, cnpj: digits });
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`, {
      headers: { "Accept": "application/json" },
      next: { revalidate: 3600 },
    });
    if (res.ok) {
      const dados = await res.json();
      return NextResponse.json({
        valido: true,
        cnpj: digits,
        razao_social: dados.razao_social,
        nome_fantasia: dados.nome_fantasia,
        situacao: dados.descricao_situacao_cadastral,
        ativo: dados.descricao_situacao_cadastral === "ATIVA",
        municipio: dados.municipio,
        uf: dados.uf,
      });
    }
  } catch {
    // BrasilAPI unavailable — return local validation only
  }

  return NextResponse.json({ valido: true, cnpj: digits });
}

export async function POST(request: NextRequest) {
  const { cnpj } = await request.json();
  const digits = (cnpj || "").replace(/\D/g, "");
  const valido = validarCNPJ(digits);
  return NextResponse.json({ valido, cnpj: digits });
}
