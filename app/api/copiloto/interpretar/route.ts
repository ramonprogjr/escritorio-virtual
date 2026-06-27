import { NextRequest, NextResponse } from "next/server";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { registrarConsumoIA, saldoCreditos } from "@/lib/ia/metering";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";
import {
  assinarConfirmacao,
  construirPromptCopiloto,
  dentroDoRateLimit,
  extrairJsonObjeto,
  nivelDaFerramenta,
} from "@/lib/copiloto/copiloto-core";

/**
 * POST { texto, contexto:{ rota, leadId? } }
 * Classifica a intenção do comando de voz numa ferramenta de LEITURA e devolve uma PROPOSTA
 * assinada (HMAC) — NÃO executa. O cliente confirma/executa via /api/copiloto/executar.
 */
export async function POST(request: NextRequest) {
  const auth = await autenticarCopiloto();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  if (!dentroDoRateLimit(auth.tenantId)) {
    return NextResponse.json({ error: "Muitos comandos seguidos. Aguarde um instante." }, { status: 429 });
  }

  let body: { texto?: unknown; contexto?: { rota?: unknown; leadId?: unknown } };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (texto.length < 2) return NextResponse.json({ error: "Diga um comando." }, { status: 400 });

  const rota = typeof body.contexto?.rota === "string" ? body.contexto.rota : "/crm";
  const temLead = typeof body.contexto?.leadId === "string" && body.contexto.leadId.trim().length > 0;

  if ((await saldoCreditos(auth.tenantId)) < 0) {
    return NextResponse.json(
      { acao: "sem_saldo", descricao: "Seus Tijolos acabaram. Recarregue para usar o copiloto." },
      { status: 200 }
    );
  }

  const r = await completarChatPreferindoMistral({
    systemPrompt: construirPromptCopiloto({ rota, temLead }),
    mensagens: [{ role: "user", content: texto }],
    modeloFromDb: "mistral",
    maxTokens: 500,
  });
  if (!r.ok) return NextResponse.json({ error: `IA indisponível: ${r.erro}` }, { status: 502 });

  void registrarConsumoIA({
    tenantId: auth.tenantId,
    usuarioId: auth.userId,
    origem: "copiloto_intencao",
    modelo: r.modeloLog,
    tokensEntrada: r.tokensEntrada,
    tokensSaida: r.tokensSaida,
    refTipo: "copiloto",
    refId: rota,
  });

  const obj = extrairJsonObjeto(r.texto) ?? {};
  const acao = typeof obj.acao === "string" ? obj.acao : "nao_entendi";
  const ferramenta = typeof obj.ferramenta === "string" ? obj.ferramenta.trim() : "";
  const params = obj.params && typeof obj.params === "object" && !Array.isArray(obj.params)
    ? (obj.params as Record<string, unknown>)
    : {};
  const descricao = typeof obj.descricao_humana === "string" ? obj.descricao_humana : "";
  const confianca = typeof obj.confianca === "number" ? obj.confianca : null;

  // Fase 1: só leitura. Qualquer outra intenção volta como "não entendi / em breve".
  if (acao !== "ler" || nivelDaFerramenta(ferramenta) !== "leitura") {
    return NextResponse.json({
      acao: "nao_entendi",
      descricao:
        descricao ||
        "Por enquanto consigo buscar e mostrar informações. Ações que alteram dados por voz chegam em breve.",
    });
  }

  const ts = Date.now();
  const confirmacaoId = assinarConfirmacao(ferramenta, params, ts);

  return NextResponse.json({
    acao: "ler",
    ferramenta,
    params,
    descricao,
    confianca,
    nivelAcesso: "leitura",
    confirmacaoId,
    ts,
    modelo: r.modeloLog,
  });
}
