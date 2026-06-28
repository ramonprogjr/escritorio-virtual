"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CheckCircle2,
  ChevronRight,
  CornerDownRight,
  FileText,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  SplitSquareVertical,
  Sparkles,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import type {
  PlaybookFlowDefinition,
  PlaybookFlowInputType,
  PlaybookFlowMedia,
  PlaybookFlowMenuFormat,
} from "@/lib/playbook/flow-definition-types";
import {
  toGuidedStepViews,
  updateStepInDefinition,
  type GuidedStepKind,
  type GuidedStepPatch,
  type GuidedStepView,
} from "@/lib/playbook/flow-guided-edit";

/**
 * VISÃO GUIADA SIMPLES do fluxo do playbook.
 *
 * Norte do dono: "a IA cria, o humano AJUSTA; simples a ponto de uma criança de
 * 5 anos usar; ajustável > construível; nada de n8n complexo".
 *
 * - Lista vertical de PASSOS grandes, na ordem do fluxo (entry → next).
 * - Cada passo é um cartão clicável que abre um EDITOR INLINE simples.
 * - Reusa o mesmo MODELO DE DADOS (`PlaybookFlowDefinition`) e o mesmo caminho
 *   de persistência do canvas: o pai grava com `upsertPlaybookFlowBlockInMarkdown`.
 * - Sem arrastar/conectar — isso é o modo "Avançado" (canvas).
 */

type Props = {
  definition: PlaybookFlowDefinition;
  agenteSlug: string;
  disabled?: boolean;
  /** Recebe a definição inteira atualizada; o pai regrava o bloco no markdown. */
  onChange: (next: PlaybookFlowDefinition) => void;
};

const KIND_META: Record<
  GuidedStepKind,
  { emoji: string; label: string; accent: string; Icon: React.ComponentType<{ size: number; strokeWidth?: number }> }
> = {
  message: { emoji: "💬", label: "Fala", accent: "#2f6f4f", Icon: MessageSquare },
  input: { emoji: "❓", label: "Pergunta", accent: "#e3b341", Icon: Pencil },
  menu: { emoji: "🔘", label: "Múltipla escolha", accent: "#c9a24a", Icon: Workflow },
  send_document: { emoji: "📎", label: "Envia PDF", accent: "#c9a24a", Icon: Paperclip },
  send_audio: { emoji: "🎤", label: "Envia áudio", accent: "#2f6f4f", Icon: Mic },
  complete: { emoji: "✅", label: "Conclui / entrega", accent: "#3fb950", Icon: CheckCircle2 },
};

export function FlowGuiadoView({ definition, agenteSlug, disabled, onChange }: Props) {
  const views = useMemo(() => toGuidedStepViews(definition), [definition]);
  const [editingId, setEditingId] = useState<string | null>(null);

  function patchStep(stepId: string, patch: GuidedStepPatch) {
    onChange(updateStepInDefinition(definition, stepId, patch));
  }

  return (
    <div style={wrapStyle}>
      {/* Gancho de IA/voz — desabilitado até a chave de IA estar ligada. */}
      <div style={aiBarStyle} title="Disponível com a IA ligada">
        <span style={aiIconStyle}>
          <Sparkles size={15} strokeWidth={2.2} />
        </span>
        <input
          disabled
          placeholder="Pedir à IA para ajustar o fluxo (em breve)…"
          style={aiInputStyle}
          aria-label="Pedir à IA para ajustar o fluxo"
        />
        <button type="button" disabled style={aiMicBtnStyle} title="Disponível com a IA ligada">
          <Mic size={15} strokeWidth={2.2} />
        </button>
        <span style={aiHintBadge}>em breve</span>
      </div>

      <ol style={listStyle}>
        {views.map((view, index) => (
          <StepCard
            key={view.id}
            view={view}
            order={index + 1}
            agenteSlug={agenteSlug}
            disabled={disabled}
            isEditing={editingId === view.id}
            onOpen={() => !disabled && setEditingId(view.id)}
            onClose={() => setEditingId(null)}
            onPatch={(patch) => patchStep(view.id, patch)}
          />
        ))}
      </ol>
    </div>
  );
}

// ─── Step card ────────────────────────────────────────────────────────────────

function StepCard({
  view,
  order,
  agenteSlug,
  disabled,
  isEditing,
  onOpen,
  onClose,
  onPatch,
}: {
  view: GuidedStepView;
  order: number;
  agenteSlug: string;
  disabled?: boolean;
  isEditing: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPatch: (patch: GuidedStepPatch) => void;
}) {
  const meta = KIND_META[view.kind];
  const preview = view.content.trim();

  return (
    <li style={cardOuterStyle}>
      {/* Cabeçalho clicável */}
      <button
        type="button"
        onClick={isEditing ? onClose : onOpen}
        disabled={disabled}
        style={{ ...cardHeaderStyle, borderColor: isEditing ? meta.accent : "#1d3a2c" }}
        aria-expanded={isEditing}
      >
        <span style={orderBadgeStyle}>{order}</span>
        <span style={{ ...emojiStyle }} aria-hidden>
          {meta.emoji}
        </span>
        <span style={cardHeaderTextStyle}>
          <span style={{ ...kindLabelStyle, color: meta.accent }}>
            {meta.label}
            {view.isEntry && <span style={entryTagStyle}>início</span>}
          </span>
          <span style={previewStyle}>{preview || "(sem texto — toque para escrever)"}</span>
        </span>
        <span style={chevronStyle}>
          {isEditing ? <X size={18} strokeWidth={2.3} /> : <ChevronRight size={18} strokeWidth={2.3} />}
        </span>
      </button>

      {/* Prévia das opções do menu (caminhos indentados) */}
      {!isEditing && view.kind === "menu" && view.optionTargets && view.optionTargets.length > 0 && (
        <ul style={menuPreviewListStyle}>
          {view.optionTargets.map((opt) => (
            <li key={opt.optionId} style={menuPreviewItemStyle}>
              <CornerDownRight size={13} strokeWidth={2.2} style={{ color: "#c9a24a", flexShrink: 0 }} />
              <span style={menuPreviewLabelStyle}>{opt.label}</span>
              <span style={menuPreviewArrowStyle}>{opt.ends ? "encerra" : opt.next ? `→ ${opt.next}` : "—"}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Prévia de mídia anexada */}
      {!isEditing && view.media?.url && (
        <div style={mediaPreviewStyle}>
          {view.media.type === "audio" ? (
            <Mic size={13} strokeWidth={2.2} style={{ color: meta.accent }} />
          ) : (
            <FileText size={13} strokeWidth={2.2} style={{ color: meta.accent }} />
          )}
          <span style={mediaPreviewNameStyle}>
            {view.media.file_name || view.media.url.split("/").pop() || "Arquivo anexado"}
          </span>
        </div>
      )}

      {/* Editor inline */}
      {isEditing && (
        <InlineEditor view={view} agenteSlug={agenteSlug} onPatch={onPatch} onDone={onClose} />
      )}
    </li>
  );
}

// ─── Inline editor (simples, por tipo) ──────────────────────────────────────────

function InlineEditor({
  view,
  agenteSlug,
  onPatch,
  onDone,
}: {
  view: GuidedStepView;
  agenteSlug: string;
  onPatch: (patch: GuidedStepPatch) => void;
  onDone: () => void;
}) {
  const contentLabel =
    view.kind === "menu"
      ? "Pergunta do menu"
      : view.kind === "input"
        ? "Pergunta"
        : view.kind === "complete"
          ? "Mensagem de encerramento"
          : view.kind === "send_document"
            ? "Legenda do PDF (opcional)"
            : view.kind === "send_audio"
              ? "Observação interna (não enviada)"
              : "Texto da fala";

  // Áudio não tem texto principal editável (só mídia).
  const showContent = view.kind !== "send_audio";

  return (
    <div style={editorStyle}>
      {showContent && (
        <label style={fieldStyle}>
          <span style={fieldLabelStyle}>{contentLabel}</span>
          <textarea
            defaultValue={view.content}
            onChange={(e) => onPatch({ content: e.target.value })}
            rows={view.kind === "menu" || view.kind === "input" ? 3 : 5}
            style={textareaStyle}
            placeholder={
              view.kind === "input"
                ? "O que a IA deve perguntar?"
                : view.kind === "menu"
                  ? "Pergunta antes das opções…"
                  : "Escreva o que o agente fala…"
            }
          />
        </label>
      )}

      {/* message: dividir em bolhas + anexar PDF/áudio */}
      {view.kind === "message" && (
        <>
          <ToggleBubble
            active={Boolean(view.split)}
            onToggle={() => onPatch({ split: !view.split })}
          />
          <MediaField
            kind="document"
            agenteSlug={agenteSlug}
            media={view.media}
            onChange={(media) => onPatch({ media: media ?? null })}
          />
          <MediaField
            kind="audio"
            agenteSlug={agenteSlug}
            media={view.media}
            onChange={(media) => onPatch({ media: media ?? null })}
          />
        </>
      )}

      {/* input: campo a guardar + tipo */}
      {view.kind === "input" && (
        <div style={twoColStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Guardar como</span>
            <input
              defaultValue={view.field ?? ""}
              onChange={(e) => onPatch({ field: e.target.value })}
              placeholder="ex.: nome, email…"
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>Tipo</span>
            <select
              defaultValue={view.inputType ?? "text"}
              onChange={(e) => onPatch({ inputType: e.target.value as PlaybookFlowInputType })}
              style={selectStyle}
            >
              <option value="text">Texto</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="number">Número</option>
            </select>
          </label>
        </div>
      )}

      {/* menu: opções */}
      {view.kind === "menu" && (
        <MenuOptionsEditor view={view} onPatch={onPatch} />
      )}

      {/* send_document: legenda já coberta acima; mídia obrigatória */}
      {view.kind === "send_document" && (
        <MediaField
          kind="document"
          agenteSlug={agenteSlug}
          media={view.media}
          onChange={(media) => onPatch({ media: media ?? null })}
        />
      )}

      {/* send_audio: só mídia */}
      {view.kind === "send_audio" && (
        <MediaField
          kind="audio"
          agenteSlug={agenteSlug}
          media={view.media}
          onChange={(media) => onPatch({ media: media ?? null })}
        />
      )}

      <button type="button" onClick={onDone} style={doneBtnStyle}>
        <CheckCircle2 size={16} strokeWidth={2.3} />
        Pronto
      </button>
    </div>
  );
}

function ToggleBubble({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{ ...bubbleToggleStyle, ...(active ? bubbleToggleActiveStyle : {}) }}
      title="Quebra o texto em mensagens separadas (cada parágrafo = 1 bolha)"
    >
      <SplitSquareVertical size={16} strokeWidth={2.2} />
      {active ? "Enviando em bolhas separadas" : "Dividir em bolhas separadas"}
    </button>
  );
}

function MenuOptionsEditor({
  view,
  onPatch,
}: {
  view: GuidedStepView;
  onPatch: (patch: GuidedStepPatch) => void;
}) {
  const options = view.menuOptions ?? [];

  function setLabel(id: string, label: string) {
    onPatch({ menuOptions: options.map((o) => (o.id === id ? { ...o, label } : o)) });
  }
  function addOption() {
    const id = `opcao_${options.length + 1}_${Date.now()}`;
    onPatch({ menuOptions: [...options, { id, label: `Opção ${options.length + 1}` }] });
  }
  function removeOption(id: string) {
    if (options.length <= 1) return;
    onPatch({ menuOptions: options.filter((o) => o.id !== id) });
  }

  return (
    <div style={fieldStyle}>
      <span style={fieldLabelStyle}>Opções ({options.length})</span>
      <div style={menuOptsWrapStyle}>
        {options.map((opt, i) => (
          <div key={opt.id} style={menuOptRowStyle}>
            <span style={menuOptNumStyle}>{i + 1}</span>
            <input
              defaultValue={opt.label}
              onChange={(e) => setLabel(opt.id, e.target.value)}
              placeholder={`Opção ${i + 1}`}
              style={menuOptInputStyle}
            />
            <button
              type="button"
              onClick={() => removeOption(opt.id)}
              disabled={options.length <= 1}
              style={{ ...menuOptRemoveStyle, opacity: options.length <= 1 ? 0.4 : 1 }}
              title="Remover opção"
            >
              <Trash2 size={14} strokeWidth={2.1} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addOption} style={addOptBtnStyle}>
          <Plus size={15} strokeWidth={2.3} />
          Adicionar opção
        </button>
      </div>
      <label style={{ ...fieldStyle, marginTop: 10 }}>
        <span style={fieldLabelStyle}>Como mostrar</span>
        <select
          defaultValue={view.menuFormat ?? "list"}
          onChange={(e) => onPatch({ menuFormat: e.target.value as PlaybookFlowMenuFormat })}
          style={selectStyle}
        >
          <option value="text">Texto numerado (1, 2, 3…)</option>
          <option value="list">Lista do WhatsApp</option>
          <option value="button">Botões (até 3)</option>
        </select>
      </label>
    </div>
  );
}

// ─── Media upload (mesmo contrato do inspector do canvas) ────────────────────────

const ACCEPT_BY_KIND: Record<"document" | "audio", string> = {
  document: ".pdf,application/pdf",
  audio: ".ogg,.mp3,.m4a,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a",
};

function MediaField({
  kind,
  agenteSlug,
  media,
  onChange,
}: {
  kind: "document" | "audio";
  agenteSlug: string;
  media?: PlaybookFlowMedia;
  onChange: (media: PlaybookFlowMedia | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const matchesKind = media && (kind === "audio" ? media.type === "audio" : media.type !== "audio");

  async function handleFile(file: File) {
    setErro("");
    if (!agenteSlug) {
      setErro("Salve o agente antes de anexar arquivos.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind === "audio" ? "audio" : "document");
      const res = await fetch(
        `/api/hub/agentes/${encodeURIComponent(agenteSlug)}/playbook-media`,
        { method: "POST", body: form }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        media?: PlaybookFlowMedia;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.media?.url) {
        setErro(data.error || "Não foi possível enviar o arquivo agora.");
        return;
      }
      onChange(data.media);
    } catch {
      setErro("Falha de rede ao enviar o arquivo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const fileLabel = matchesKind
    ? media?.file_name?.trim() || media?.url.split("/").pop() || "Arquivo anexado"
    : "";

  return (
    <div style={fieldStyle}>
      <span style={fieldLabelStyle}>{kind === "audio" ? "Áudio" : "PDF / Documento"}</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_BY_KIND[kind]}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {matchesKind ? (
        <div style={mediaAttachedStyle}>
          {kind === "audio" ? (
            <Mic size={15} strokeWidth={2.2} style={{ color: "#c9a24a", flexShrink: 0 }} />
          ) : (
            <FileText size={15} strokeWidth={2.2} style={{ color: "#c9a24a", flexShrink: 0 }} />
          )}
          <span style={mediaAttachedNameStyle} title={media?.url}>
            {fileLabel}
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={mediaRemoveStyle}
            title="Remover anexo"
          >
            <Trash2 size={14} strokeWidth={2.1} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          style={{ ...mediaPickStyle, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? (
            <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
          ) : kind === "audio" ? (
            <Mic size={15} strokeWidth={2.2} />
          ) : (
            <Paperclip size={15} strokeWidth={2.2} />
          )}
          {busy ? "Enviando…" : kind === "audio" ? "Selecionar áudio" : "Anexar PDF"}
        </button>
      )}
      {erro && <p style={mediaErroStyle}>{erro}</p>}
    </div>
  );
}

// ─── Styles (marca verde + dourado; mobile-first; alvos grandes) ────────────────

const wrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  width: "100%",
};

const aiBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 10px",
  background: "#0f1d16",
  border: "1px dashed #4d3c12",
  borderRadius: 12,
  opacity: 0.85,
};

const aiIconStyle: CSSProperties = {
  display: "inline-flex",
  color: "#c9a24a",
  flexShrink: 0,
};

const aiInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  color: "#8b949e",
  fontSize: 13,
  outline: "none",
  cursor: "not-allowed",
};

const aiMicBtnStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  border: "1px solid #1d3a2c",
  background: "#16271e",
  color: "#7a8fa6",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "not-allowed",
  flexShrink: 0,
};

const aiHintBadge: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#c9a24a",
  background: "#211a0d",
  border: "1px solid #4d3c12",
  borderRadius: 999,
  padding: "2px 8px",
  textTransform: "uppercase",
  letterSpacing: 0.4,
  flexShrink: 0,
};

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const cardOuterStyle: CSSProperties = {
  background: "#0f1d16",
  border: "1px solid #1d3a2c",
  borderRadius: 14,
  overflow: "hidden",
  boxShadow: "0 6px 18px #02061740",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: "14px 14px",
  background: "transparent",
  border: "none",
  borderLeft: "4px solid transparent",
  textAlign: "left",
  cursor: "pointer",
  color: "#e6edf3",
  minHeight: 64,
};

const orderBadgeStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  background: "#16271e",
  border: "1px solid #1d3a2c",
  color: "#9fd3bf",
  fontSize: 12,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const emojiStyle: CSSProperties = {
  fontSize: 22,
  lineHeight: 1,
  flexShrink: 0,
};

const cardHeaderTextStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
  flex: 1,
};

const kindLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

const entryTagStyle: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  color: "#0a140f",
  background: "#3fb950",
  borderRadius: 999,
  padding: "1px 7px",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const previewStyle: CSSProperties = {
  fontSize: 13,
  color: "#cdd9d2",
  lineHeight: 1.45,
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
};

const chevronStyle: CSSProperties = {
  color: "#7a8fa6",
  flexShrink: 0,
  display: "inline-flex",
};

const menuPreviewListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: "0 14px 12px 52px",
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const menuPreviewItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  fontSize: 12,
  color: "#cdd9d2",
};

const menuPreviewLabelStyle: CSSProperties = {
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const menuPreviewArrowStyle: CSSProperties = {
  fontSize: 10.5,
  color: "#8b949e",
  fontFamily: "monospace",
  marginLeft: "auto",
  flexShrink: 0,
};

const mediaPreviewStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 14px 12px 52px",
  fontSize: 12,
  color: "#cdd9d2",
};

const mediaPreviewNameStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const editorStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "4px 14px 16px",
  borderTop: "1px solid #16271e",
};

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#7a8fa6",
  textTransform: "uppercase",
  letterSpacing: 0.45,
};

const textareaStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 10,
  background: "#0a140f",
  color: "#e6edf3",
  padding: "11px 12px",
  fontSize: 14,
  fontFamily: "inherit",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 64,
};

const inputStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 10,
  background: "#0a140f",
  color: "#e6edf3",
  padding: "11px 12px",
  fontSize: 14,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: CSSProperties = {
  ...inputStyle,
};

const twoColStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const bubbleToggleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #2a3545",
  borderRadius: 10,
  background: "#0a140f",
  color: "#cdd9d2",
  padding: "11px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
};

const bubbleToggleActiveStyle: CSSProperties = {
  borderColor: "#2f6f4f",
  background: "#10231a",
  color: "#9fd3bf",
};

const menuOptsWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};

const menuOptRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #2a3545",
  borderRadius: 10,
  background: "#0a140f",
  padding: "7px 9px",
};

const menuOptNumStyle: CSSProperties = {
  minWidth: 18,
  textAlign: "center",
  fontSize: 12,
  fontWeight: 800,
  color: "#c9a24a",
  flexShrink: 0,
};

const menuOptInputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  border: "none",
  background: "transparent",
  outline: "none",
  color: "#e6edf3",
  fontSize: 14,
  fontFamily: "inherit",
};

const menuOptRemoveStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #b3261e55",
  background: "#2a1313",
  color: "#fca5a5",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

const addOptBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px dashed #2f6f4f",
  borderRadius: 10,
  background: "#10231a",
  color: "#9fd3bf",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  padding: "11px 12px",
};

const mediaPickStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "1px dashed #c9a24a",
  borderRadius: 10,
  background: "#211a0d",
  color: "#f0d8a0",
  padding: "11px 12px",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const mediaAttachedStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  border: "1px solid #4d3c12",
  borderRadius: 10,
  background: "#0a140f",
  padding: "10px 12px",
};

const mediaAttachedNameStyle: CSSProperties = {
  flex: 1,
  fontSize: 13,
  color: "#e6edf3",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mediaRemoveStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "1px solid #b3261e55",
  background: "#2a1313",
  color: "#fca5a5",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

const mediaErroStyle: CSSProperties = {
  margin: "2px 0 0",
  fontSize: 11.5,
  color: "#ff9a8a",
  lineHeight: 1.4,
};

const doneBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  borderRadius: 10,
  background: "#2f6f4f",
  color: "#0a140f",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
  padding: "12px 14px",
  marginTop: 2,
};
