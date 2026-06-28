"use client";

import { useRef, useState, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import {
  CheckCircle,
  ClipboardList,
  MessageSquare,
  Pencil,
  Plus,
  Trash2,
  Paperclip,
  Mic,
  FileText,
  Loader2,
  SplitSquareVertical,
  ListChecks,
  X,
} from "lucide-react";
import type { FlowMenuOption, FlowVisualNodeData } from "./types";
import type {
  PlaybookFlowInputType,
  PlaybookFlowJourney,
  PlaybookFlowMedia,
  PlaybookFlowMenuFormat,
} from "@/lib/playbook/flow-definition-types";

type FlowNodeEditorSideoverProps = {
  selectedNode: Node<FlowVisualNodeData>;
  allNodeIds: string[];
  entryStepId: string;
  agenteSlug?: string;
  onSetEntryStepId: (stepId: string) => void;
  onRenameNodeId: (oldId: string, nextId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<FlowVisualNodeData>) => void;
  onRemoveMenuOption: (nodeId: string, optionId: string) => void;
  onConvertToMenu?: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
};

const KIND_COLOR: Record<string, string> = {
  message: "#2f6f4f",
  input: "#e3b341",
  menu: "#c9a24a",
  complete: "#3fb950",
  send_document: "#c9a24a",
  send_audio: "#2f6f4f",
};

const KIND_LABEL: Record<string, string> = {
  message: "Mensagem",
  input: "Entrada",
  menu: "Menu",
  complete: "Conclusao",
  send_document: "Documento",
  send_audio: "Áudio",
};

const KIND_ICON: Record<string, React.ComponentType<{ size: number; strokeWidth: number }>> = {
  message: MessageSquare,
  input: Pencil,
  menu: ClipboardList,
  complete: CheckCircle,
  send_document: Paperclip,
  send_audio: Mic,
};

export function FlowNodeEditorSideover({
  selectedNode,
  allNodeIds,
  entryStepId,
  agenteSlug,
  onSetEntryStepId,
  onRenameNodeId,
  onUpdateNode,
  onRemoveMenuOption,
  onConvertToMenu,
  onDeleteNode,
  onClose,
}: FlowNodeEditorSideoverProps) {
  const { id, data } = selectedNode;
  const accent = KIND_COLOR[data.kind] ?? "#475569";
  const kindLabel = KIND_LABEL[data.kind] ?? String(data.kind);
  const KindIcon = KIND_ICON[data.kind] ?? MessageSquare;

  function update(updates: Partial<FlowVisualNodeData>) {
    onUpdateNode(id, updates);
  }

  function handleRenameId(nextRaw: string) {
    const next = nextRaw.trim();
    if (!next || next === id) return;
    onRenameNodeId(id, next);
  }

  function updateOptionLabel(optionId: string, label: string) {
    const options = (data.menuOptions ?? []).map((opt) =>
      opt.id === optionId ? { ...opt, label } : opt
    );
    update({ menuOptions: options });
  }

  function removeOption(optionId: string) {
    const current = data.menuOptions ?? [];
    if (current.length <= 1) return;
    onRemoveMenuOption(id, optionId);
  }

  function addOption() {
    const current = data.menuOptions ?? [];
    const nextOption: FlowMenuOption = {
      id: `opcao_${current.length + 1}_${Date.now()}`,
      label: `Opcao ${current.length + 1}`,
    };
    update({ menuOptions: [...current, nextOption] });
  }

  const contentLabel =
    data.kind === "menu"
      ? "Prompt do menu"
      : data.kind === "input"
        ? "Prompt da entrada"
        : data.kind === "complete"
          ? "Mensagem de conclusao"
          : data.kind === "send_document"
            ? "Legenda do documento (opcional)"
            : data.kind === "send_audio"
              ? "Observação interna (não enviada)"
              : "Mensagem";

  return (
    <>
      <div style={backdropStyle} onClick={onClose} />
      <aside style={panelStyle}>
        <div style={headerStyle}>
          <div style={titleWrapStyle}>
            <span style={{ ...iconWrapStyle, color: accent }}>
              <KindIcon size={14} strokeWidth={2.2} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={headerLabelStyle}>Editor do card</p>
              <p style={headerIdStyle}>{id}</p>
            </div>
          </div>
          <div style={headerActionsStyle}>
            <span style={{ ...kindBadgeStyle, borderColor: accent, color: accent }}>{kindLabel}</span>
            <button type="button" onClick={onClose} style={closeButtonStyle} title="Fechar editor">
              <X size={14} strokeWidth={2.3} />
            </button>
          </div>
        </div>

        <div style={bodyStyle}>
          <FieldRow label="ID do step (único)">
            <input
              defaultValue={id}
              onBlur={(event) => handleRenameId(event.target.value)}
              placeholder="id_do_step"
              style={inputStyle}
            />
          </FieldRow>

          <FieldRow label="Step de entrada">
            <button
              type="button"
              onClick={() => onSetEntryStepId(id)}
              style={{
                ...entryButtonStyle,
                ...(entryStepId === id ? entryButtonActiveStyle : {}),
              }}
            >
              {entryStepId === id ? "Este é o início do fluxo" : "Definir este step como início"}
            </button>
          </FieldRow>

          <FieldRow label="Jornada">
            <select
              value={String(data.journey ?? "")}
              onChange={(event) => {
                const value = event.target.value.trim();
                update({ journey: (value || undefined) as PlaybookFlowJourney | undefined });
              }}
              style={selectStyle}
            >
              <option value="">(sem jornada)</option>
              <option value="triagem">triagem</option>
              <option value="arquitetura">arquitetura</option>
              <option value="imobiliario">imobiliario</option>
            </select>
          </FieldRow>

          <FieldRow label="Titulo">
            <input
              value={data.title ?? ""}
              onChange={(event) => update({ title: event.target.value })}
              placeholder="Titulo do passo..."
              style={inputStyle}
            />
          </FieldRow>

          <FieldRow label={contentLabel}>
            <textarea
              value={data.content}
              onChange={(event) => update({ content: event.target.value })}
              rows={6}
              style={textareaStyle}
            />
          </FieldRow>

          {(data.kind === "input" || data.kind === "menu") && (
            <FieldRow label="Field (chave)">
              <input
                value={String(data.field ?? "")}
                onChange={(event) => update({ field: event.target.value })}
                placeholder="nome_do_campo"
                style={inputStyle}
              />
            </FieldRow>
          )}

          {data.kind === "input" && (
            <FieldRow label="Tipo de input">
              <select
                value={String(data.inputType ?? "text")}
                onChange={(event) => update({ inputType: event.target.value as PlaybookFlowInputType })}
                style={selectStyle}
              >
                <option value="text">text</option>
                <option value="email">email</option>
                <option value="phone">phone</option>
                <option value="number">number</option>
              </select>
            </FieldRow>
          )}

          {data.kind === "menu" && (
            <>
              <FieldRow label="Formato das opções">
                <select
                  value={String(data.menuFormat ?? "list")}
                  onChange={(event) =>
                    update({ menuFormat: event.target.value as PlaybookFlowMenuFormat })
                  }
                  style={selectStyle}
                >
                  <option value="text">Texto numerado (1, 2, 3…)</option>
                  <option value="list">Lista nativa WhatsApp</option>
                  <option value="button">Botões nativos (até 3)</option>
                </select>
              </FieldRow>
              <FieldRow label={`Opcoes (${(data.menuOptions ?? []).length})`}>
              <div style={optionsWrapStyle}>
                {(data.menuOptions ?? []).map((option, index) => (
                  <div key={option.id} style={optionRowStyle}>
                    <span style={{ ...optionIndexStyle, color: accent }}>{index + 1}</span>
                    <input
                      list="flow-existing-node-ids"
                      value={option.label}
                      onChange={(event) => updateOptionLabel(option.id, event.target.value)}
                      placeholder={`Opcao ${index + 1}...`}
                      style={optionInputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(option.id)}
                      style={optionRemoveStyle}
                      title="Remover opcao"
                    >
                      <Trash2 size={11} strokeWidth={2.1} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addOption} style={addOptionButtonStyle}>
                  <Plus size={12} strokeWidth={2.3} />
                  Adicionar opcao
                </button>
              </div>
            </FieldRow>
            </>
          )}

          {/* PDF / Documento: anexar em mensagens ou no card de documento */}
          {(data.kind === "message" || data.kind === "send_document") && (
            <MediaAttachField
              kind="document"
              accent={accent}
              media={data.media}
              agenteSlug={agenteSlug}
              onChange={(media) => update({ media })}
            />
          )}

          {/* Áudio: anexar em mensagens ou no card de áudio */}
          {(data.kind === "message" || data.kind === "send_audio") && (
            <MediaAttachField
              kind="audio"
              accent={accent}
              media={data.media}
              agenteSlug={agenteSlug}
              onChange={(media) => update({ media })}
            />
          )}

          {/* Separar em bolhas (apenas mensagem) */}
          {data.kind === "message" && (
            <FieldRow label="Separar em bolhas">
              <button
                type="button"
                onClick={() => update({ split: !data.split })}
                style={{
                  ...toggleButtonStyle,
                  ...(data.split ? toggleButtonActiveStyle : {}),
                }}
                title="Quebra o texto em mensagens separadas (parágrafos divididos por linha em branco)"
              >
                <SplitSquareVertical size={13} strokeWidth={2.2} />
                {data.split ? "Dividindo em bolhas (cada parágrafo = 1 mensagem)" : "Enviar em bolhas separadas"}
              </button>
            </FieldRow>
          )}

          {/* Transformar mensagem em múltipla escolha */}
          {data.kind === "message" && onConvertToMenu && (
            <FieldRow label="Múltipla escolha">
              <button
                type="button"
                onClick={() => onConvertToMenu(id)}
                style={convertButtonStyle}
                title="Converte esta mensagem em um menu de opções, mantendo o texto como pergunta"
              >
                <ListChecks size={13} strokeWidth={2.2} />
                Transformar em múltipla escolha
              </button>
            </FieldRow>
          )}

          <datalist id="flow-existing-node-ids">
            {allNodeIds.map((nodeId) => (
              <option key={nodeId} value={nodeId} />
            ))}
          </datalist>
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={() => onDeleteNode(id)} style={deleteButtonStyle}>
            <Trash2 size={12} strokeWidth={2.2} />
            Remover card
          </button>
        </div>
      </aside>
    </>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={fieldRowStyle}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

const ACCEPT_BY_KIND: Record<"document" | "audio", string> = {
  document: ".pdf,application/pdf",
  audio: ".ogg,.mp3,.m4a,audio/ogg,audio/mpeg,audio/mp4,audio/x-m4a",
};

const LABEL_BY_KIND: Record<"document" | "audio", string> = {
  document: "PDF / Documento",
  audio: "Áudio",
};

type MediaUploadResponse = {
  ok?: boolean;
  media?: PlaybookFlowMedia;
  error?: string;
};

/**
 * Anexa PDF/áudio via upload server-side (bucket `playbook-media`).
 * Tolerante: sem agenteSlug ou bucket ausente → mensagem amigável, não quebra a UI.
 */
function MediaAttachField({
  kind,
  accent,
  media,
  agenteSlug,
  onChange,
}: {
  kind: "document" | "audio";
  accent: string;
  media?: PlaybookFlowMedia;
  agenteSlug?: string;
  onChange: (media: PlaybookFlowMedia | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  // Mostra o anexo só quando o tipo bate com este campo (PDF não aparece no campo de áudio).
  const matchesKind =
    media && (kind === "audio" ? media.type === "audio" : media.type !== "audio");

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
      const data = (await res.json().catch(() => ({}))) as MediaUploadResponse;
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

  const Icon = kind === "audio" ? Mic : FileText;
  const fileLabel = matchesKind
    ? media?.file_name?.trim() || media?.url.split("/").pop() || "Arquivo anexado"
    : "";

  return (
    <FieldRow label={LABEL_BY_KIND[kind]}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_BY_KIND[kind]}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {matchesKind ? (
        <div style={mediaAttachedStyle}>
          <span style={{ ...mediaAttachedIcon, color: accent }}>
            <Icon size={13} strokeWidth={2.2} />
          </span>
          <span style={mediaAttachedName} title={media?.url}>
            {fileLabel}
          </span>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={mediaRemoveStyle}
            title="Remover anexo"
          >
            <Trash2 size={11} strokeWidth={2.1} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          style={{ ...mediaPickButtonStyle, opacity: busy ? 0.7 : 1 }}
        >
          {busy ? (
            <Loader2 size={13} strokeWidth={2.2} className="animate-spin" />
          ) : kind === "audio" ? (
            <Mic size={13} strokeWidth={2.2} />
          ) : (
            <Paperclip size={13} strokeWidth={2.2} />
          )}
          {busy ? "Enviando…" : kind === "audio" ? "Selecionar áudio" : "Anexar PDF"}
        </button>
      )}
      {erro && <p style={mediaErroStyle}>{erro}</p>}
    </FieldRow>
  );
}

const backdropStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(90deg, transparent 0%, #00000033 70%, #00000055 100%)",
  zIndex: 7,
};

const panelStyle: CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: "min(360px, 42vw)",
  borderLeft: "1px solid #1e2b3d",
  background: "#0d1420",
  boxShadow: "-16px 0 36px #00000066",
  display: "flex",
  flexDirection: "column",
  zIndex: 8,
};

const headerStyle: CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #1e2b3d",
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
};

const titleWrapStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  minWidth: 0,
  alignItems: "flex-start",
};

const iconWrapStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 999,
  background: "#161c28",
  border: "1px solid #2b3544",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const headerLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#e6edf3",
  fontWeight: 700,
  lineHeight: 1.2,
};

const headerIdStyle: CSSProperties = {
  margin: "3px 0 0",
  fontSize: 11,
  color: "#94a3b8",
  fontFamily: "monospace",
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const kindBadgeStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  border: "1px solid",
  borderRadius: 999,
  padding: "2px 8px",
};

const closeButtonStyle: CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 7,
  border: "1px solid #2b3544",
  background: "#161c28",
  color: "#94a3b8",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const bodyStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  padding: "12px 14px",
  overflowY: "auto",
  flex: 1,
  minHeight: 0,
};

const fieldRowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  color: "#7a8fa6",
  textTransform: "uppercase",
  letterSpacing: 0.45,
};

const inputStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 9,
  background: "#0f1d16",
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 12.5,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const textareaStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 9,
  background: "#0f1d16",
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 12,
  fontFamily: "inherit",
  lineHeight: 1.5,
  resize: "vertical",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  minHeight: 120,
};

const optionsWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const optionRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  borderRadius: 8,
  border: "1px solid #2a3545",
  background: "#0f1d16",
  padding: "6px 8px",
};

const optionIndexStyle: CSSProperties = {
  minWidth: 14,
  textAlign: "center",
  fontSize: 10,
  fontWeight: 700,
};

const optionInputStyle: CSSProperties = {
  flex: 1,
  border: "none",
  background: "transparent",
  outline: "none",
  color: "#cbd5e1",
  fontSize: 11.5,
  fontFamily: "inherit",
};

const optionRemoveStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 7,
  border: "1px solid #ef444488",
  background: "#2a1313",
  color: "#fca5a5",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
};

const addOptionButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  border: "1px dashed #1d3a2c",
  borderRadius: 8,
  background: "#161c28",
  color: "#94a3b8",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer",
  padding: "8px 10px",
};

const footerStyle: CSSProperties = {
  padding: 12,
  borderTop: "1px solid #1e2b3d",
};

const deleteButtonStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #f8514944",
  borderRadius: 8,
  background: "#f851491a",
  color: "#ff7b72",
  fontSize: 11.5,
  fontWeight: 700,
  cursor: "pointer",
  padding: "8px 10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
};

const entryButtonStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 9,
  background: "#0f1d16",
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
};

const entryButtonActiveStyle: CSSProperties = {
  borderColor: "#22c55e66",
  color: "#4ade80",
  background: "#112a1b",
};

const selectStyle: CSSProperties = {
  border: "1px solid #2a3545",
  borderRadius: 9,
  background: "#0f1d16",
  color: "#e2e8f0",
  padding: "8px 10px",
  fontSize: 12.5,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const mediaPickButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px dashed #c9a24a",
  borderRadius: 9,
  background: "#211a0d",
  color: "#f0d8a0",
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};

const mediaAttachedStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  border: "1px solid #4d3c12",
  borderRadius: 9,
  background: "#0f1d16",
  padding: "8px 10px",
};

const mediaAttachedIcon: CSSProperties = {
  display: "inline-flex",
  flexShrink: 0,
};

const mediaAttachedName: CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: "#e2e8f0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const mediaRemoveStyle: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 7,
  border: "1px solid #ef444488",
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
  fontSize: 10.5,
  color: "#ff9a8a",
  lineHeight: 1.4,
};

const toggleButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  border: "1px solid #2a3545",
  borderRadius: 9,
  background: "#0f1d16",
  color: "#cbd5e1",
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  textAlign: "left",
};

const toggleButtonActiveStyle: CSSProperties = {
  borderColor: "#2f6f4f",
  background: "#10231a",
  color: "#9fd3bf",
};

const convertButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  border: "1px solid #c9a24a",
  borderRadius: 9,
  background: "#211a0d",
  color: "#f0d8a0",
  padding: "9px 10px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  width: "100%",
};
