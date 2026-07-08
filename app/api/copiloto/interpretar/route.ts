import { NextRequest, NextResponse } from "next/server";
import { completarChatPreferindoMistral } from "@/lib/ia/llm-completion";
import { registrarConsumoIA, saldoCreditos } from "@/lib/ia/metering";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";
import {
  COPILOTO_FERRAMENTAS_ESCRITA_FASE3,
  CopilotoSegredoAusenteError,
  assinarConfirmacao,
  construirPromptCopiloto,
  dentroDoRateLimit,
  extrairJsonObjeto,
  nivelDaFerramenta,
  rotaNavegavelValida,
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
  const leadIdCtx =
    typeof body.contexto?.leadId === "string" ? body.contexto.leadId.trim() : "";
  const temLead = leadIdCtx.length > 0;

  if ((await saldoCreditos(auth.tenantId)) < 0) {
    return NextResponse.json(
      { acao: "sem_saldo", descricao: "Seus Tijolos acabaram. Recarregue para usar o copiloto." },
      { status: 200 }
    );
  }

  // Escolhe o provedor disponível: Mistral (primário) → Anthropic → Groq.
  const hasMistral = !!process.env.MISTRAL_API_KEY?.trim();
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY?.trim();
  const hasGroq = !!process.env.GROQ_API_KEY?.trim();
  const modeloFromDb = hasMistral
    ? "mistral"
    : hasAnthropic
      ? "claude-haiku-4-5-20251001"
      : hasGroq
        ? "groq"
        : "mistral";

  const r = await completarChatPreferindoMistral({
    systemPrompt: construirPromptCopiloto({ rota, temLead }),
    mensagens: [{ role: "user", content: texto }],
    modeloFromDb,
    maxTokens: 500,
  });
  if (!r.ok) {
    const nenhuma = !hasMistral && !hasAnthropic && !hasGroq;
    const msg = nenhuma
      ? "IA não configurada no servidor. Peça ao administrador para verificar as chaves de IA e fazer um novo deploy."
      : `IA indisponível: ${r.erro}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

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

  // NAVEGAR: a IA leva o dono à tela. Seguro (não altera dados) → sem HMAC, sem confirmação.
  // Só rotas da allowlist (rotaNavegavelValida bloqueia URL fora de /crm/*).
  if (acao === "navegar") {
    const alvo = typeof obj.navegar_para === "string" ? rotaNavegavelValida(obj.navegar_para) : null;
    if (alvo) {
      return NextResponse.json({
        acao: "navegar",
        navegar_para: alvo,
        descricao: descricao || "Abrindo a tela",
        modelo: r.modeloLog,
      });
    }
    // rota inválida/fora da allowlist → cai no fluxo normal (vira "nao_entendi" abaixo).
  }

  const ehLeitura = acao === "ler" && nivelDaFerramenta(ferramenta) === "leitura";
  const ehEscritaPermitida =
    acao === "escrever" &&
    nivelDaFerramenta(ferramenta) === "escrita" &&
    (COPILOTO_FERRAMENTAS_ESCRITA_FASE3 as string[]).includes(ferramenta);

  // Tudo que não for leitura OU escrita-allowlist volta como "não entendi / em breve".
  // (Escrita fora da allowlist — ex. hub_crm_criar_cadastro — cai aqui e é recusada.)
  if (!ehLeitura && !ehEscritaPermitida) {
    return NextResponse.json({
      acao: "nao_entendi",
      descricao:
        descricao ||
        "Por enquanto consigo buscar informações, anotar e atualizar o lead. Outras ações por voz chegam em breve.",
    });
  }

  const ts = Date.now();
  let confirmacaoId: string;
  try {
    // O leadId do contexto entra na assinatura: amarra a proposta ao lead falado.
    confirmacaoId = assinarConfirmacao(ferramenta, params, ts, leadIdCtx);
  } catch (e) {
    if (e instanceof CopilotoSegredoAusenteError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    throw e;
  }

  // Escrita NÃO é executada aqui (igual a leitura, este endpoint só PROPÕE).
  // O cliente, ao ver nivelAcesso="escrita", vai para o fluxo de confirmação humana.
  return NextResponse.json({
    acao: ehLeitura ? "ler" : "escrever",
    ferramenta,
    params,
    descricao,
    confianca,
    nivelAcesso: ehLeitura ? "leitura" : "escrita",
    confirmacaoId,
    ts,
    modelo: r.modeloLog,
  });
}
