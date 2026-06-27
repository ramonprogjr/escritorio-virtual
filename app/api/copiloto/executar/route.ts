import { NextRequest, NextResponse } from "next/server";
import { executarFerramentaHub } from "@/lib/hub/executar-ferramenta-ia";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";
import {
  COPILOTO_AGENTE_SLUG,
  CopilotoSegredoAusenteError,
  ferramentaExecutavel,
  nivelDaFerramenta,
  validarConfirmacao,
} from "@/lib/copiloto/copiloto-core";

/**
 * POST { ferramenta, params, confirmacaoId, ts, contexto:{ leadId? } }
 * Executa a ferramenta proposta — SOMENTE após validar o HMAC e SOMENTE ferramentas executáveis
 * pelo copiloto (leitura OU allowlist de escrita Fase 3). tenantId vem da sessão, nunca do body.
 *
 * Segurança da escrita: este endpoint só roda quando o cliente o chama APÓS o dono CONFIRMAR
 * (o fluxo de leitura auto-executa; o de escrita exige clique). A allowlist + HMAC + TTL garantem
 * que não há execução de escrita não-proposta ou adulterada.
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

  const leadId =
    typeof body.contexto?.leadId === "string" ? body.contexto.leadId.trim() : "";

  // 1) Integridade: a proposta tem de ter sido assinada por nós, estar no prazo E
  //    ter sido feita para ESTE lead. O leadId entra na assinatura — se o dono falou
  //    num lead, navegou para outro e confirmou, o leadId do body não casa → recusa.
  let v: ReturnType<typeof validarConfirmacao>;
  try {
    v = validarConfirmacao(confirmacaoId, ferramenta, params, ts, leadId);
  } catch (e) {
    if (e instanceof CopilotoSegredoAusenteError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }
  if (!v.ok) {
    const msg =
      v.erro === "confirmacao_expirada"
        ? "A proposta expirou. Fale o comando de novo."
        : "Proposta inválida.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }

  // 2) Trava de construção: só LEITURA ou as ferramentas de escrita da allowlist Fase 3.
  //    Qualquer outra ferramenta (ex. hub_crm_criar_cadastro, hub_whatsapp_menu) → 403.
  if (!ferramentaExecutavel(ferramenta)) {
    return NextResponse.json(
      { error: "Esta ação não está disponível pelo copiloto." },
      { status: 403 }
    );
  }

  const ehEscrita = nivelDaFerramenta(ferramenta) === "escrita";

  // Escrita sobre lead exige um lead aberto (as tools de escrita operam sobre ctx.leadId).
  if (ehEscrita && !leadId) {
    return NextResponse.json(
      { error: "Abra um lead para registrar nota ou atualizar." },
      { status: 400 }
    );
  }

  let resultadoStr: string;
  try {
    resultadoStr = await executarFerramentaHub(ferramenta, JSON.stringify(params), {
      leadId,
      agenteSlug: COPILOTO_AGENTE_SLUG,
      tenantId: auth.tenantId,
      // As tools de escrita exigem modoOperacao="canal_whatsapp" por construção interna.
      // O copiloto é o DONO autenticado confirmando manualmente — gate equivalente/superior ao
      // do atendimento automático — então liberamos esse modo apenas para a escrita allowlist.
      ...(ehEscrita ? { modoOperacao: "canal_whatsapp" } : {}),
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
