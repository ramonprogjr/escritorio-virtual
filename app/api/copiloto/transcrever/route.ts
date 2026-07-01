import { NextRequest, NextResponse } from "next/server";
import { groqTranscreverAudioBuffer } from "@/lib/ia/groq-transcribe-audio";
import { mistralTranscreverAudioBuffer } from "@/lib/whatsapp/mistral-transcribe-audio";
import { autenticarCopiloto } from "@/lib/copiloto/copiloto-auth";

/**
 * POST (multipart) { audio } — fallback de transcrição quando o navegador não tem Web Speech API.
 * Usa Voxtral (já existe). A transcrição ao vivo do device (grátis) é o caminho principal no cliente.
 */
export async function POST(request: NextRequest) {
  const auth = await autenticarCopiloto();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Envie o áudio como multipart/form-data." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Áudio ausente." }, { status: 400 });
  }
  if (audio.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "Áudio muito grande (máx. 25 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await audio.arrayBuffer());
  const mimeType = (audio as Blob).type || undefined;
  const fileName = "copiloto.webm";

  let tr = await mistralTranscreverAudioBuffer(buffer, fileName, mimeType);
  if (!tr.ok && tr.erro === "mistral_api_key_ausente") {
    tr = await groqTranscreverAudioBuffer(buffer, fileName, mimeType);
  } else if (!tr.ok && process.env.GROQ_API_KEY?.trim()) {
    const groq = await groqTranscreverAudioBuffer(buffer, fileName, mimeType);
    if (groq.ok) tr = groq;
  }

  if (!tr.ok) {
    const amigavel =
      tr.erro === "mistral_api_key_ausente" || tr.erro === "groq_api_key_ausente"
        ? "Transcrição indisponível (sem chave de IA configurada no servidor)."
        : tr.erro === "mistral_transcricao_vazia" || tr.erro === "groq_transcricao_vazia"
          ? "Não entendi o áudio. Fale mais perto do microfone."
          : `Falha ao transcrever: ${tr.erro}`;
    return NextResponse.json({ error: amigavel }, { status: 502 });
  }
  return NextResponse.json({ texto: tr.texto });
}
