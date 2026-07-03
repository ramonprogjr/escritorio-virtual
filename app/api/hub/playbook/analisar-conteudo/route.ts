import { NextRequest, NextResponse } from "next/server";
import { analyzePlaybookWithMistral, buildLocalPlaybookAnalysisFallback } from "@/lib/playbook/mistral-analysis";
import { normalizePlaybookText } from "@/lib/playbook/custom-playbook";
import { requireCrmGestor } from "@/lib/crm/crm-api-auth";
import { requireIaRateLimit } from "@/lib/ia/rate-limit-ia";
import { registrarConsumoIA } from "@/lib/ia/metering";

const MAX_CHARS = 40_000;

/**
 * POST — analisa conteúdo de playbook antes de criar/publicar o agente (sem slug).
 * Body: { content: string, filename?: string }
 */
export async function POST(request: NextRequest) {
  // Aceita até 40k chars e chama a Mistral (custo real) — exige gestor/owner (wizard interno).
  // Antes: SEM auth, SEM teto, SEM metering.
  const g = await requireCrmGestor(request);
  if ("error" in g) return g.error;

  const limite = requireIaRateLimit(`playbook-analisar-conteudo:${g.ctx.tenantId}`, 20);
  if (limite) return limite;

  let body: { content?: unknown; filename?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const raw = typeof body.content === "string" ? body.content : "";
  const markdown = normalizePlaybookText(raw);
  if (!markdown.trim()) {
    return NextResponse.json({ error: "Envie o conteúdo do playbook (campo content)." }, { status: 400 });
  }
  if (markdown.length > MAX_CHARS) {
    return NextResponse.json(
      { error: `Playbook acima de ${MAX_CHARS} caracteres. Reduza o tamanho.` },
      { status: 413 }
    );
  }

  const analysis = await analyzePlaybookWithMistral(markdown);
  if (!analysis.ok) {
    return NextResponse.json({
      sucesso: true,
      origem: "conteudo_local",
      filename: typeof body.filename === "string" ? body.filename : null,
      model: "local-fallback",
      analise: buildLocalPlaybookAnalysisFallback(markdown),
      analise_origem: "fallback",
      aviso: analysis.error,
    });
  }

  // Metering (Tijolos) — best-effort. `analyzePlaybookWithMistral` não expõe usage de tokens,
  // então estimamos (~4 chars/token, mesmo heurístico do fallback de mistral-chat). Modo sombra.
  void registrarConsumoIA({
    tenantId: g.ctx.tenantId,
    usuarioId: g.ctx.userId,
    origem: "playbook_analisar_conteudo",
    modelo: analysis.model,
    tokensEntrada: Math.ceil(markdown.length / 4),
    tokensSaida: Math.ceil(JSON.stringify(analysis.analise).length / 4),
  });

  return NextResponse.json({
    sucesso: true,
    origem: "conteudo_local",
    filename: typeof body.filename === "string" ? body.filename : null,
    model: analysis.model,
    analise: analysis.analise,
    analise_origem: "mistral",
  });
}
