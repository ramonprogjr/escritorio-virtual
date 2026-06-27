"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/* SpeechRecognition não está nas libs DOM padrão — tipagem mínima. */
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

export type CopilotoEstado = "idle" | "listening" | "processing" | "done" | "erro";
export type CopilotoContexto = { rota: string; leadId?: string };

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useCopilotoVoz(opts: { contexto: CopilotoContexto }) {
  const [estado, setEstado] = useState<CopilotoEstado>("idle");
  const [transcricaoLive, setTranscricaoLive] = useState("");
  const [resultado, setResultado] = useState<unknown>(null);
  const [mensagem, setMensagem] = useState("");
  const [modeloUsado, setModeloUsado] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const silencioRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalRef = useRef("");
  const ctxRef = useRef(opts.contexto);
  ctxRef.current = opts.contexto;

  const suporteVoz =
    typeof window !== "undefined" &&
    (getSpeechRecognitionCtor() !== null || typeof navigator !== "undefined");

  const limparSilencio = () => {
    if (silencioRef.current) {
      clearTimeout(silencioRef.current);
      silencioRef.current = null;
    }
  };

  const processar = useCallback(async (texto: string) => {
    const cmd = texto.trim();
    if (!cmd) {
      setEstado("idle");
      return;
    }
    setEstado("processing");
    setMensagem("");
    setResultado(null);
    try {
      const ri = await fetch("/api/copiloto/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ texto: cmd, contexto: ctxRef.current }),
      });
      const di = (await ri.json().catch(() => ({}))) as Record<string, unknown>;
      if (!ri.ok) {
        setMensagem(typeof di.error === "string" ? di.error : "Falha ao interpretar.");
        setEstado("erro");
        return;
      }
      if (typeof di.modelo === "string") setModeloUsado(di.modelo);

      if (di.acao !== "ler") {
        setMensagem(typeof di.descricao === "string" ? di.descricao : "Não entendi o comando.");
        setEstado("done");
        return;
      }

      // Leitura: executa direto (seguro, sem fricção).
      const re = await fetch("/api/copiloto/executar", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({
          ferramenta: di.ferramenta,
          params: di.params,
          confirmacaoId: di.confirmacaoId,
          ts: di.ts,
          contexto: ctxRef.current,
        }),
      });
      const de = (await re.json().catch(() => ({}))) as Record<string, unknown>;
      if (!re.ok) {
        setMensagem(typeof de.error === "string" ? de.error : "Falha ao executar.");
        setEstado("erro");
        return;
      }
      setMensagem(typeof di.descricao === "string" ? di.descricao : "");
      setResultado(de.resultado ?? null);
      setEstado("done");
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Falha de rede.");
      setEstado("erro");
    }
  }, []);

  const parar = useCallback(() => {
    limparSilencio();
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
  }, []);

  const iniciar = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setMensagem("Seu navegador não suporta voz ao vivo. (Fallback de gravação em breve.)");
      setEstado("erro");
      return;
    }
    finalRef.current = "";
    setTranscricaoLive("");
    setResultado(null);
    setMensagem("");
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      let interim = "";
      let final = finalRef.current;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const txt = res[0]?.transcript ?? "";
        if (res.isFinal) final += txt;
        else interim += txt;
      }
      finalRef.current = final;
      setTranscricaoLive((final + interim).trim());
      // Auto-parar após 3s de silêncio.
      limparSilencio();
      silencioRef.current = setTimeout(() => parar(), 3000);
    };
    rec.onerror = () => {
      /* tratado no onend */
    };
    rec.onend = () => {
      limparSilencio();
      recRef.current = null;
      const texto = finalRef.current.trim();
      if (texto) void processar(texto);
      else setEstado((s) => (s === "listening" ? "idle" : s));
    };
    recRef.current = rec;
    setEstado("listening");
    try {
      rec.start(); // iOS exige start() direto no handler do toque.
    } catch {
      setEstado("erro");
      setMensagem("Não consegui acessar o microfone. Verifique a permissão.");
    }
  }, [parar, processar]);

  const toggle = useCallback(() => {
    if (estado === "listening") parar();
    else if (estado === "idle" || estado === "done" || estado === "erro") iniciar();
  }, [estado, iniciar, parar]);

  const cancelar = useCallback(() => {
    limparSilencio();
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
    recRef.current = null;
    setEstado("idle");
    setTranscricaoLive("");
    setResultado(null);
    setMensagem("");
  }, []);

  useEffect(() => () => {
    limparSilencio();
    try {
      recRef.current?.abort();
    } catch {
      /* noop */
    }
  }, []);

  return { estado, transcricaoLive, resultado, mensagem, modeloUsado, suporteVoz, toggle, cancelar };
}
