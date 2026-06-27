import { NextRequest, NextResponse } from "next/server";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";
import {
  COPILOTO_AGENTE_SLUG,
  nivelDaFerramenta,
  validarConfirmacao,
} from "@/lib/copiloto/copiloto-core";

/**
 * POST { ferramenta, params, confirmacaoId, ts, contexto:{ leadId? } }
 * Executa a ferramenta proposta — SOMENTE após validar o HMAC e SOMENTE ferramentas de leitura
 * (gate por construção; escrita só na Fase 3). tenantId vem da sessão, nunca do body.
 */
export async function POST(request: NextRequest) {
  const auth = await autenticarCopiloto();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  let body: {
    ferramenta?: unknown;
    params?: unknown;
    confirmacaoId?: unknown;
    ts?: unknown;
    contexto?: { leadId?: unknown };
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const ferramenta = typeof body.ferramenta === "string" ? body.ferramenta.trim() : "";
  const params =
    body.params && typeof body.params === "object" && !Array.isArray(body.params)
      ? (body.params as Record<string, unknown>)
      : {};
  const confirmacaoId = typeof body.confirmacaoId === "string" ? body.confirmacaoId : "";
  const ts = typeof body.ts === "number" ? body.ts : NaN;

  // 1) Integridade: a proposta tem de ter sido assinada por nós e estar no prazo.
  const v = validarConfirmacao(confirmacaoId, ferramenta, params, ts);
  if (!v.ok) {
    const msg =
      v.erro === "confirmacao_expirada"
        ? "A proposta expirou. Fale o comando de novo."
        : "Proposta inválida.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  // 2) Trava de construção: nesta fase só LEITURA é executável.
  if (nivelDaFerramenta(ferramenta) !== "leitura") {
    return NextResponse.json(
      { error: "Esta ação altera dados — disponível em breve, com confirmação." },
      { status: 403 }
    );
  }

  const leadId =
    typeof body.contexto?.leadId === "string" ? body.contexto.leadId.trim() : "";

  let resultadoStr: string;
  try {
    resultadoStr = await executarFerramentaHub(ferramenta, JSON.stringify(params), {
      leadId,
      agenteSlug: COPILOTO_AGENTE_SLUG,
      tenantId: auth.tenantId,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao executar." },
      { status: 500 }
    );
  }

  let resultado: unknown = resultadoStr;
  try {
    resultado = JSON.parse(resultadoStr);
  } catch {
    /* resultado textual simples */
  }

  return NextResponse.json({ ok: true, ferramenta, resultado });
}
