"use client";

import { useRef, useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp, FileText, Mic, Square } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * Agent Builder por IA (Fase 1 — texto).
 * O dono DESCREVE como o agente deve atender; a IA monta o playbook (fluxo + regras).
 * O markdown gerado é entregue ao editor existente (onGerado) — o dono revisa e publica
 * com o fluxo de publicação que já existe. A IA sugere; o dono confirma.
 */

const EXEMPLOS: Array<{ rotulo: string; texto: string }> = [
  {
    rotulo: "SDR de obra/reforma",
    texto:
      "Você é um SDR que atende leads de obra e reforma no WhatsApp. Acolha, pergunte o nome, " +
      "descubra se é construção ou reforma, o tamanho aproximado em m², a cidade e o prazo desejado. " +
      "Tom cordial e objetivo, no máximo 3 linhas por mensagem. Não fale preço — encaminhe para um especialista humano.",
  },
  {
    rotulo: "Recepção de arquitetura",
    texto:
      "Você recepciona clientes interessados em projeto de arquitetura. Cumprimente, pegue o nome, " +
      "entenda o tipo de projeto (residencial, comercial, interiores), a metragem e o prazo. " +
      "Seja acolhedor e consultivo. Ao final, encaminhe para o arquiteto responsável.",
  },
  {
    rotulo: "Pós-venda",
    texto:
      "Você faz pós-venda: confirma se a entrega/serviço ficou bom, registra a satisfação (de 1 a 5), " +
      "coleta um comentário e oferece abrir um chamado se houver problema. Tom empático e breve.",
  },
];

export type AgenteBuilderIaPanelProps = {
  agenteSlug: string;
  agenteNome: string;
  /** Recebe o markdown gerado para alimentar o editor de playbook existente. */
  onGerado: (markdown: string) => void;
};

const DOC_ACCEPT = ".pdf,.docx,.txt,.md";

function lerArquivoBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function AgenteBuilderIaPanel({ agenteSlug, agenteNome, onGerado }: AgenteBuilderIaPanelProps) {
  const [aberto, setAberto] = useState(true);
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [segGravacao, setSegGravacao] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const podeGerar = descricao.trim().length >= 12 && !gerando;

  async function executarGeracao(extra?: {
    documento?: { base64: string; mimeType: string; nomeArquivo: string };
    audio?: { base64: string; mimeType: string; nomeArquivo: string };
  }) {
    setGerando(true);
    setErro("");
    setAvisos([]);
    setSucesso(false);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/gerar-por-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: descricao.trim(), ...extra }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        markdown?: string;
        avisos?: string[];
        error?: string;
      };
      if (!res.ok || typeof data.markdown !== "string") {
        setErro(data.error || "Não foi possível gerar o playbook. Tente reescrever a descrição.");
        return;
      }
      onGerado(data.markdown);
      setAvisos(Array.isArray(data.avisos) ? data.avisos : []);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha de rede ao gerar o playbook.");
    } finally {
      setGerando(false);
    }
  }

  function gerar() {
    if (!podeGerar) return;
    void executarGeracao();
  }

  async function enviarDocumento(file: File) {
    if (gerando) return;
    try {
      const dataUrl = await lerArquivoBase64(file);
      await executarGeracao({
        documento: { base64: dataUrl, mimeType: file.type || "", nomeArquivo: file.name },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler o documento.");
    }
  }

  async function enviarAudio(file: Blob, nome: string) {
    if (gerando) return;
    try {
      const dataUrl = await lerArquivoBase64(file as File);
      await executarGeracao({
        audio: { base64: dataUrl, mimeType: file.type || "", nomeArquivo: nome },
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler o áudio.");
    }
  }

  function pararTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function alternarGravacao() {
    if (gravando) {
      recorderRef.current?.stop();
      return;
    }
    if (gerando) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Seu navegador não suporta gravação de áudio. Envie um arquivo de áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        pararTimer();
        setGravando(false);
        stream.getTracks().forEach((t) => t.stop());
        const tipo = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: tipo });
        const ext = tipo.includes("ogg") ? "ogg" : tipo.includes("mp4") ? "mp4" : "webm";
        if (blob.size > 0) void enviarAudio(blob, `gravacao-instrucao.${ext}`);
      };
      recorderRef.current = rec;
      rec.start();
      setErro("");
      setGravando(true);
      setSegGravacao(0);
      timerRef.current = setInterval(() => setSegGravacao((s) => s + 1), 1000);
    } catch {
      setErro("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  return (
    <div
      style={{
        flex: "0 0 auto",
        borderRadius: 10,
        border: "1px solid #2f6f4f",
        background: "linear-gradient(180deg, #10231a 0%, #0d1c15 100%)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#e6edf3",
        }}
      >
        <Sparkles size={15} color="#c9a24a" />
        <span style={{ fontSize: 12.5, fontWeight: 800, flex: 1, textAlign: "left" }}>
          Gerar com IA — descreva e a IA monta o playbook
        </span>
        {aberto ? <ChevronUp size={15} color="#8b949e" /> : <ChevronDown size={15} color="#8b949e" />}
      </button>

      {aberto && (
        <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
          <p style={{ margin: 0, color: "#8b949e", fontSize: 11, lineHeight: 1.5 }}>
            Conte, em palavras suas, como <strong style={{ color: "#cdd9d2" }}>{agenteNome || "o agente"}</strong> deve
            atender: o tom, o que perguntar, o que coletar e o que pode/não pode. A IA monta o fluxo + as regras — você
            revisa abaixo e publica.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {EXEMPLOS.map((ex) => (
              <button
                key={ex.rotulo}
                type="button"
                onClick={() => setDescricao(ex.texto)}
                disabled={gerando}
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: "1px solid #2f6f4f",
                  background: "#0a140f",
                  color: "#9fd3bf",
                  cursor: gerando ? "default" : "pointer",
                }}
              >
                {ex.rotulo}
              </button>
            ))}
            <span style={{ width: 1, height: 16, background: "#1d3a2c", margin: "0 2px" }} />
            <input
              ref={fileRef}
              type="file"
              accept={DOC_ACCEPT}
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviarDocumento(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={gerando || gravando}
              title="Gerar a partir de um PDF, DOCX ou TXT do seu manual de atendimento"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 999,
                border: "1px dashed #c9a24a",
                background: "#0a140f",
                color: "#e3b341",
                cursor: gerando || gravando ? "default" : "pointer",
              }}
            >
              <FileText size={12} /> Enviar PDF/DOCX
            </button>

            <input
              ref={audioFileRef}
              type="file"
              accept="audio/*"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void enviarAudio(f, f.name);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => void alternarGravacao()}
              disabled={gerando}
              title="Gravar suas instruções por voz — a IA transcreve e monta o playbook"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 10px",
                borderRadius: 999,
                border: gravando ? "1px solid #f85149" : "1px dashed #c9a24a",
                background: gravando ? "#f8514918" : "#0a140f",
                color: gravando ? "#f85149" : "#e3b341",
                cursor: gerando ? "default" : "pointer",
              }}
            >
              {gravando ? <Square size={11} /> : <Mic size={12} />}
              {gravando
                ? `Parar ${String(Math.floor(segGravacao / 60))}:${String(segGravacao % 60).padStart(2, "0")}`
                : "Gravar áudio"}
            </button>
            <button
              type="button"
              onClick={() => audioFileRef.current?.click()}
              disabled={gerando || gravando}
              title="Enviar um arquivo de áudio com instruções"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "5px 10px",
                borderRadius: 999,
                border: "1px solid #2f6f4f",
                background: "#0a140f",
                color: "#9fd3bf",
                cursor: gerando || gravando ? "default" : "pointer",
              }}
            >
              Enviar áudio
            </button>
          </div>

          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: A Mari atende leads de imóveis. Coleta nome, telefone e tipo do imóvel. Não fala preço antes do consultor. Tom acolhedor…"
            spellCheck
            style={{
              width: "100%",
              minHeight: 92,
              resize: "vertical",
              borderRadius: 9,
              border: "1px solid #1d3a2c",
              background: "#0a140f",
              color: "#e6edf3",
              fontSize: 12.5,
              lineHeight: 1.55,
              padding: 11,
              boxSizing: "border-box",
            }}
          />

          {erro && (
            <p style={{ margin: 0, color: "#f85149", fontSize: 11.5, lineHeight: 1.5 }}>{erro}</p>
          )}
          {sucesso && (
            <p style={{ margin: 0, color: "#3fb950", fontSize: 11.5, lineHeight: 1.5 }}>
              ✓ Playbook gerado e carregado no editor abaixo. Revise e publique quando estiver bom.
            </p>
          )}
          {avisos.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 16, color: "#e3b341", fontSize: 11, lineHeight: 1.5 }}>
              {avisos.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 10.5, color: "#6e7681" }}>
              {descricao.trim().length < 12 ? "Descreva um pouco mais para gerar." : "A IA sugere; você confirma."}
            </span>
            <button
              type="button"
              onClick={() => void gerar()}
              disabled={!podeGerar}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "9px 16px",
                borderRadius: 9,
                border: "none",
                background: podeGerar ? "#c9a24a" : "#2a2f2b",
                color: podeGerar ? "#0a140f" : "#6e7681",
                fontWeight: 800,
                fontSize: 12.5,
                cursor: podeGerar ? "pointer" : "default",
              }}
            >
              {gerando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {gerando ? "Montando o playbook…" : "Gerar com IA"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
