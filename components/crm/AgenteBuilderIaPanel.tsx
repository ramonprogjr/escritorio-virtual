"use client";

import { useState } from "react";
import { Sparkles, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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

export function AgenteBuilderIaPanel({ agenteSlug, agenteNome, onGerado }: AgenteBuilderIaPanelProps) {
  const [aberto, setAberto] = useState(true);
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [sucesso, setSucesso] = useState(false);

  const podeGerar = descricao.trim().length >= 12 && !gerando;

  async function gerar() {
    if (!podeGerar) return;
    setGerando(true);
    setErro("");
    setAvisos([]);
    setSucesso(false);
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/gerar-por-ia`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ descricao: descricao.trim() }),
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
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
