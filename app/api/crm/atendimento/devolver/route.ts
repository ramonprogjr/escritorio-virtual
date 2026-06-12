import { NextRequest, NextResponse } from "next/server";
import { requireInternalApiKey, crmApiConfigError } from "@/lib/crm/crm-api-auth";
import {
  crmHandoffDb,
  resolveOperador,
  devolverAtendimentoIA,
} from "@/lib/crm/atendimento-handoff";

export async function POST(request: NextRequest) {
  const configErr = crmApiConfigError();
  if (configErr) return configErr;
  const keyErr = requireInternalApiKey(request);
  if (keyErr) return keyErr;

  const authId = request.headers.get("x-caller-auth-id")?.trim();
  if (!authId) {
    return NextResponse.json(
      { error: "Cabeçalho x-caller-auth-id obrigatório." },
      { status: 403 }
    );
  }

  let body: { leadId?: string };
  try {
    body = (await request.json()) as { leadId?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const leadId = body.leadId?.trim();
  if (!leadId) {
    return NextResponse.json({ error: "leadId é obrigatório" }, { status: 400 });
  }

  const supabase = crmHandoffDb();

  const operador = await resolveOperador(supabase, authId);
  if (!operador) {
    return NextResponse.json(
      { error: "Utilizador não encontrado ou conta inativa." },
      { status: 403 }
    );
  }

  const result = await devolverAtendimentoIA(supabase, { leadId, operador });
  if (!result.ok) {
    return NextResponse.json({ error: result.erro ?? "Erro ao devolver à IA." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, operadorSlug: operador.slug });
}
