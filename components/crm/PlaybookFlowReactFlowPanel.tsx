"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, Loader2, Save, Sparkles, Workflow } from "lucide-react";
import { parsePlaybookFlowFromMarkdown } from "@/lib/playbook/flow-parse";
import { upsertPlaybookFlowBlockInMarkdown } from "@/lib/playbook/playbook-flow-markdown";
import { emitFlowVisualTelemetry } from "@/lib/playbook/flow-visual-telemetry";
import { validatePlaybookFlowDefinition } from "@/lib/playbook/flow-validate";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import type { FlowCanvasSnapshot } from "@/components/crm/playbook-flow-visual/types";

/**
 * Reconhece falhas de geração por falta de chave de IA e devolve uma mensagem amigável
 * (sem vazar o nome cru da variável de ambiente para o usuário do CRM).
 */
function mensagemAmigavelDeErro(raw: string): string {
  const texto = (raw || "").toLowerCase();
  const semChaveIa =
    texto.includes("mistral_api_key") ||
    texto.includes("anthropic_api_key") ||
    texto.includes("provedor ia") ||
    texto.includes("provedor de ia") ||
    (texto.includes("não configurad") && texto.includes("ia"));
  if (semChaveIa) {
    return "A IA vai montar o fluxo automaticamente assim que a chave de IA estiver ativa. Por enquanto, você pode montar o fluxo manualmente.";
  }
  return raw || "Não foi possível gerar o fluxo agora. Tente novamente em instantes.";
}

const FlowCanvas = dynamic(
  () => import("@/components/crm/playbook-flow-visual/FlowCanvas").then((m) => m.FlowCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={loadingStyle}>
        <Workflow size={20} style={{ opacity: 0.3 }} />
        <span>Carregando diagrama…</span>
      </div>
    ),
  }
);

type Props = {
  markdown: string;
  onMarkdownChange: (next: string) => void;
  agenteSlug: string;
  disabled?: boolean;
  hasUnsavedChanges?: boolean;
  onCanvasDirty?: () => void;
  onSaveDraft?: () => void;
  onSaveDraftAndClose?: () => void;
};

export function PlaybookFlowReactFlowPanel({
  markdown,
  onMarkdownChange,
  agenteSlug,
  disabled,
  hasUnsavedChanges = false,
  onCanvasDirty,
  onSaveDraft,
  onSaveDraftAndClose,
}: Props) {
  const canSave = hasUnsavedChanges;
  const parsed = useMemo(() => parsePlaybookFlowFromMarkdown(markdown), [markdown]);

  const validation = useMemo(
    () => (parsed.ok ? validatePlaybookFlowDefinition(parsed.definition) : null),
    [parsed]
  );

  // Track markdown written BY the canvas so we don't remount on canvas-driven changes.
  const lastCanvasMarkdownRef = useRef<string>(markdown);
  const [mountKey, setMountKey] = useState(0);

  // Estado-vazio: gerar o fluxo com IA a partir do próprio texto do playbook.
  const [gerando, setGerando] = useState(false);
  const [erroGeracao, setErroGeracao] = useState("");

  async function gerarFluxoComIa() {
    if (gerando || disabled) return;
    setGerando(true);
    setErroGeracao("");
    try {
      // A IA monta o fluxo a partir do texto do próprio playbook (sem precisar redigitar nada).
      const descricao = markdown.trim();
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook/gerar-por-ia`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", ...internalApiHeaders() },
          body: JSON.stringify({ descricao }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        markdown?: string;
        error?: string;
      };
      if (!res.ok || typeof data.markdown !== "string") {
        setErroGeracao(mensagemAmigavelDeErro(data.error || ""));
        return;
      }
      // Entrega o markdown gerado (com o bloco obra10_playbook_flow) ao editor.
      lastCanvasMarkdownRef.current = data.markdown;
      onMarkdownChange(data.markdown);
      onCanvasDirty?.();
    } catch (e) {
      setErroGeracao(
        e instanceof Error && e.message
          ? mensagemAmigavelDeErro(e.message)
          : "Falha de rede ao gerar o fluxo. Tente novamente."
      );
    } finally {
      setGerando(false);
    }
  }

  useEffect(() => {
    if (markdown !== lastCanvasMarkdownRef.current) {
      // External change (e.g. user clicked Recarregar) — remount canvas with fresh data.
      lastCanvasMarkdownRef.current = markdown;
      setMountKey((k) => k + 1);
    }
  }, [markdown]);

  function handleChange(snapshot: FlowCanvasSnapshot) {
    const next = upsertPlaybookFlowBlockInMarkdown(markdown, snapshot.definition);
    lastCanvasMarkdownRef.current = next;
    onMarkdownChange(next);
    void emitFlowVisualTelemetry({
      event: "playbook.flow_visual.markdown_applied",
      agente_slug: agenteSlug,
      metadata: {
        source: "react_flow_canvas",
        steps_count: snapshot.nodeCount,
      },
    });
  }

  // ── No playbook loaded ──
  if (!markdown.trim()) {
    return (
      <div style={emptyState}>
        <Workflow size={32} style={{ opacity: 0.2 }} />
        <p style={emptyText}>Carregue um playbook para visualizar o fluxo.</p>
      </div>
    );
  }

  // ── No flow block found → estado-vazio amigável (a IA monta) ──
  if (!parsed.ok) {
    return (
      <div style={emptyState}>
        <div style={emptyIconBubble}>
          <Workflow size={26} style={{ color: "#c9a24a" }} />
        </div>
        <p style={emptyTitle}>Este agente ainda não tem um fluxo</p>
        <p style={emptyLead}>A IA monta o fluxo automaticamente a partir do playbook.</p>

        <button
          type="button"
          onClick={() => void gerarFluxoComIa()}
          disabled={gerando || disabled}
          style={{
            ...gerarBtn,
            opacity: gerando || disabled ? 0.7 : 1,
            cursor: gerando || disabled ? "default" : "pointer",
          }}
          title="A IA monta o fluxo a partir do texto do playbook"
        >
          {gerando ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          {gerando ? "Montando o fluxo…" : "✨ Gerar fluxo com IA"}
        </button>

        {erroGeracao && <p style={emptyHint}>{erroGeracao}</p>}
        {!erroGeracao && (
          <p style={emptyHint}>
            A IA sugere; você revisa e ajusta. Você também pode montar o fluxo manualmente.
          </p>
        )}
      </div>
    );
  }

  const { definition } = parsed;

  return (
    <div style={{ ...panelStyle, opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      {/* Meta bar */}
      <div style={metaBar}>
        <span style={metaItem}>
          <Workflow size={12} />
          {definition.steps.length} passos
        </span>
        <span style={metaItem}>
          entrada: <code style={metaCode}>{definition.entry_step_id}</code>
        </span>
        {definition.id && (
          <span style={metaItem}>
            id: <code style={metaCode}>{definition.id}</code>
          </span>
        )}
        <span style={{ marginLeft: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, marginRight: 8 }}>
            {onSaveDraft ? (
              <button
                type="button"
                onClick={onSaveDraft}
                disabled={disabled || !canSave}
                style={{
                  ...saveButtonStyle,
                  opacity: disabled || !canSave ? 0.55 : 1,
                }}
                title="Salva o JSON atual no rascunho do drawer"
              >
                <Save size={12} />
                Salvar rascunho
              </button>
            ) : null}
            {onSaveDraftAndClose ? (
              <button
                type="button"
                onClick={onSaveDraftAndClose}
                disabled={disabled || !canSave}
                style={{
                  ...saveAndCloseButtonStyle,
                  opacity: disabled || !canSave ? 0.55 : 1,
                }}
                title="Salva no rascunho e volta para o drawer"
              >
                Salvar e voltar
              </button>
            ) : null}
          </span>
          {validation && !validation.ok ? (
            <span style={{ ...validationBadge, borderColor: "#f85149", color: "#ff7b72", background: "#f851491a" }}>
              <AlertTriangle size={11} strokeWidth={2.2} />
              {validation.errors.length} {validation.errors.length === 1 ? "aviso" : "avisos"}
            </span>
          ) : (
            <span style={{ ...validationBadge, borderColor: "#2ea043", color: "#3fb950", background: "#2ea0431a" }}>
              <CheckCircle2 size={11} strokeWidth={2.2} />
              Fluxo válido
            </span>
          )}
        </span>
      </div>

      {/* Canvas */}
      <div style={canvasWrapper}>
        <FlowCanvas
          key={mountKey}
          initialDefinition={definition}
          agenteSlug={agenteSlug}
          onChange={handleChange}
          onDirty={onCanvasDirty}
        />
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const metaBar: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 10,
  padding: "8px 12px",
  background: "#0f1d16",
  border: "1px solid #1d3a2c",
  borderRadius: 10,
  boxShadow: "0 6px 18px #02061780",
  flexShrink: 0,
};

const metaItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 11.5,
  color: "#cdd9d2",
};

const metaCode: CSSProperties = {
  fontSize: 10,
  color: "#e3b341",
  fontFamily: "monospace",
};

const validationBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10.5,
  fontWeight: 700,
  border: "1px solid",
  borderRadius: 20,
  padding: "2px 8px",
};

const saveButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  border: "1px solid #2f6f4f",
  background: "#0f3d2933",
  color: "#9fd3bf",
  borderRadius: 8,
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
};

const saveAndCloseButtonStyle: CSSProperties = {
  ...saveButtonStyle,
  borderColor: "#3fb95055",
  background: "#2386361f",
  color: "#7ee787",
};

const canvasWrapper: CSSProperties = {
  /* FlowCanvas sets its own explicit pixel height (680px) — just contain it */
  width: "100%",
};

const emptyState: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 12,
  padding: 40,
  height: "100%",
  minHeight: 300,
};

const emptyText: CSSProperties = {
  margin: 0,
  color: "#cdd9d2",
  fontSize: 13.5,
  textAlign: "center",
};

const emptyIconBubble: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#211a0d",
  border: "1px solid #4d3c12",
  boxShadow: "0 8px 22px #02061766",
};

const emptyTitle: CSSProperties = {
  margin: 0,
  color: "#e6edf3",
  fontSize: 15.5,
  fontWeight: 800,
  textAlign: "center",
};

const emptyLead: CSSProperties = {
  margin: 0,
  color: "#9fd3bf",
  fontSize: 12.5,
  textAlign: "center",
  maxWidth: 380,
  lineHeight: 1.6,
};

const emptyHint: CSSProperties = {
  margin: 0,
  color: "#8b949e",
  fontSize: 11,
  textAlign: "center",
  maxWidth: 380,
  lineHeight: 1.6,
};

const gerarBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#c9a24a",
  color: "#0a140f",
  fontWeight: 800,
  fontSize: 13,
  boxShadow: "0 6px 18px #c9a24a33",
};

const loadingStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  height: "100%",
  minHeight: 300,
  color: "#8b949e",
  fontSize: 12,
};
