import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { gerarPlaybookViaIa } from "@/lib/playbook/gerar-fluxo-ia";
import { registrarConsumoIA } from "@/lib/ia/metering";
import { defaultTenantId } from "@/lib/tenant-default";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST { descricao: string }
 * Gera (NÃO publica) um playbook — fluxo conversacional + regras — a partir de uma descrição
 * em linguagem natural. A IA sugere; o dono revisa e publica via PUT /playbook/conteudo.
 * Debita Tijolos por fase de geração (origem="playbook_builder_ia").
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  }

  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw);

  let body: { descricao?: unknown; tenantId?: unknown };
  try {
    body = (await request.json()) as { descricao?: unknown; tenantId?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const descricao = typeof body.descricao === "string" ? body.descricao.trim() : "";
  if (descricao.length < 12) {
    return NextResponse.json(
      { error: "Descreva com um pouco mais de detalhe como o agente deve atender (mín. 12 caracteres)." },
      { status: 400 }
    );
  }

  const supabase = db();

  // Resolve o agente (mesma convenção das demais rotas de playbook: por agente_slug).
  const { data: agente, error: agErr } = await supabase
    .from("hub_agente_identidade")
    .select("agente_slug, nome, modelo_padrao")
    .eq("agente_slug", slug)
    .maybeSingle();

  if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 });
  if (!agente) return NextResponse.json({ error: "Agente não encontrado." }, { status: 404 });

  const tenantId =
    (typeof body.tenantId === "string" && body.tenantId.trim()) || defaultTenantId();

  const out = await gerarPlaybookViaIa({
    descricao,
    agenteNome: (agente.nome as string | null) ?? slug,
    agenteSlug: slug,
    modeloFromDb: (agente.modelo_padrao as string | null) ?? undefined,
  });

  // Metering (Tijolos): best-effort, por fase de geração — nunca bloqueia a resposta.
  for (const u of out.usos) {
    void registrarConsumoIA({
      tenantId,
      origem: "playbook_builder_ia",
      modelo: u.modeloLog,
      tokensEntrada: u.tokensEntrada,
      tokensSaida: u.tokensSaida,
      refTipo: "agente",
      refId: slug,
    });
  }

  if (!out.ok) {
    return NextResponse.json({ error: out.erro }, { status: 502 });
  }

  return NextResponse.json({
    markdown: out.markdown,
    flowDefinition: out.flowDefinition,
    regras: out.regras,
    avisos: out.avisos,
  });
}
