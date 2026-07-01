import { NextRequest, NextResponse } from "next/server";
import { crmApiConfigError, resolveCallerAuthId } from "@/lib/crm/crm-api-auth";
import {
  crmHandoffDb,
  resolveOperador,
  assumirAtendimentoCrm,
} from "@/lib/crm/atendimento-handoff";

export async function POST(request: NextRequest) {
  const configErr = crmApiConfigError();
  if (configErr) return configErr;

  const authId = await resolveCallerAuthId(request);
  if (!authId) {
    return NextResponse.json(
      { error: "Sessão inválida ou identidade ausente." },
      { status: 401 }
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

  const result = await assumirAtendimentoCrm(supabase, { leadId, operador });
  if (!result.ok) {
    return NextResponse.json({ error: result.erro ?? "Erro ao assumir atendimento." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    operadorSlug: operador.slug,
    operadorNome: operador.nome,
    jobsCancelados: result.jobsCancelados,
  });
}
