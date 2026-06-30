import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildHealthResponse } from "@/lib/crm/health-checks";
import { requireCrmOwner } from "@/lib/crm/crm-api-auth";

// G-D1 (decisão do dono): o health revela QUAIS segredos/env da plataforma existem (nomes, não
// valores). Isso é superfície desnecessária — fica owner-only. A tela de Configurações só busca
// este endpoint quando o utilizador é owner, e trata o 401 sem quebrar.
export async function GET(request: NextRequest) {
  const g = await requireCrmOwner(request);
  if ("error" in g) return g.error;
  return NextResponse.json(buildHealthResponse());
}
