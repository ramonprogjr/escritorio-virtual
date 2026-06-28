"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import {
  CheckCircle,
  ClipboardList,
  Link2,
  MessageSquare,
  Plus,
  Check,
  Pencil,
  Paperclip,
  Mic,
  FileText,
  SplitSquareVertical,
  X,
} from "lucide-react";
import type { FlowMenuOption, FlowNodeKind, FlowVisualNodeData } from "./types";

// ─── Context ─────────────────────────────────────────────────────────────────

export type NodeCallbacks = {
  onUpdate: (nodeId: string, updates: Partial<FlowVisualNodeData>) => void;
  onDelete: (nodeId: string) => void;
  /** Remove opção do menu e a aresta associada (evita ressuscitar opção no JSON). */
  onRemoveMenuOption: (nodeId: string, optionId: string) => void;
};

export const FlowNodeCallbacksContext = createContext<NodeCallbacks>({
  onUpdate: () => undefined,
  onDelete: () => undefined,
  onRemoveMenuOption: () => undefined,
});

// ─── Theme ───────────────────────────────────────────────────────────────────

type KindTheme = {
  border: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  Icon: React.ComponentType<{ size: number; strokeWidth: number }>;
};

// Paleta da marca (verde + dourado) — alinhada a app/globals.css e às telas do CRM.
//  message  → verde da marca   |  menu (múltipla escolha) → dourado #c9a24a
//  input    → dourado claro    |  complete → verde escuro com destaque
const KIND_THEME: Record<FlowNodeKind, KindTheme> = {
  message: {
    border: "#2f6f4f",
    headerBg: "#10231a",
    headerText: "#cdd9d2",
    badgeBg: "#0f3d29",
    badgeText: "#9fd3bf",
    label: "Mensagem",
    Icon: MessageSquare,
  },
  input: {
    border: "#e3b341",
    headerBg: "#241c0c",
    headerText: "#f0d8a0",
    badgeBg: "#5c4410",
    badgeText: "#f5e3b0",
    label: "Coleta",
    Icon: Pencil,
  },
  menu: {
    border: "#c9a24a",
    headerBg: "#211a0d",
    headerText: "#e3b341",
    badgeBg: "#4d3c12",
    badgeText: "#f0d8a0",
    label: "Menu",
    Icon: ClipboardList,
  },
  complete: {
    border: "#3fb950",
    headerBg: "#0e2a1b",
    headerText: "#9fd3bf",
    badgeBg: "#15532f",
    badgeText: "#bfe8cf",
    label: "Conclusão",
    Icon: CheckCircle,
  },
  // Documento → dourado (anexo). Áudio → verde claro (voz).
  send_document: {
    border: "#c9a24a",
    headerBg: "#211a0d",
    headerText: "#f0d8a0",
    badgeBg: "#4d3c12",
    badgeText: "#f5e3b0",
    label: "Documento",
    Icon: Paperclip,
  },
  send_audio: {
    border: "#2f6f4f",
    headerBg: "#10231a",
    headerText: "#9fd3bf",
    badgeBg: "#0f3d29",
    badgeText: "#bfe8cf",
    label: "Áudio",
    Icon: Mic,
  },
};

// ─── Inline edit hook ────────────────────────────────────────────────────────

function useInlineEdit(initial: string, onSave: (v: string) => void) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  function startEdit() {
    setValue(initial);
    setEditing(true);
    setTimeout(() => ref.current?.focus(), 0);
  }

  function commit() {
    setEditing(false);
    if (value !== initial) onSave(value);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      setEditing(false);
      setValue(initial);
    }
  }

  return { editing, value, setValue, ref, startEdit, commit, onKeyDown };
}

// ─── Base card ───────────────────────────────────────────────────────────────

type BaseCardProps = {
  id: string;
  kind: FlowNodeKind;
  title?: string;
  content: string;
  selected: boolean;
  isConnectable: boolean;
  children?: React.ReactNode;
  showTargetHandle?: boolean;
  showSourceHandle?: boolean;
  /** Mídia anexada (clipe/microfone + nome do arquivo). */
  media?: FlowVisualNodeData["media"];
  /** Indica "dividir em bolhas". */
  split?: boolean;
};

function MediaChip({ media }: { media: NonNullable<FlowVisualNodeData["media"]> }) {
  const isAudio = media.type === "audio";
  const Icon = isAudio ? Mic : media.type === "image" ? FileText : Paperclip;
  const label = isAudio
    ? media.file_name?.trim() || "Áudio anexado"
    : media.file_name?.trim() || media.url.split("/").pop() || "Arquivo anexado";
  return (
    <span style={mediaChipStyle} title={media.url}>
      <Icon size={11} strokeWidth={2.2} />
      <span style={mediaChipLabel}>{label}</span>
    </span>
  );
}

function SplitChip() {
  return (
    <span style={splitChipStyle} title="Esta mensagem será enviada em bolhas separadas">
      <SplitSquareVertical size={11} strokeWidth={2.2} />
      Dividir em bolhas
    </span>
  );
}

function BaseCard({
  id,
  kind,
  title,
  content,
  selected,
  isConnectable,
  children,
  showTargetHandle = true,
  showSourceHandle = true,
  media,
  split,
}: BaseCardProps) {
  const { onUpdate, onDelete } = useContext(FlowNodeCallbacksContext);
  const [hovered, setHovered] = useState(false);
  const theme = KIND_THEME[kind];
  const { Icon } = theme;

  const titleEdit = useInlineEdit(title ?? "", (v) => onUpdate(id, { title: v }));
  const contentEdit = useInlineEdit(content, (v) => onUpdate(id, { content: v }));

  return (
    <div
      style={{
        ...cardBase,
        border: `1px solid ${selected ? theme.border : `${theme.border}88`}`,
        boxShadow: selected
          ? `0 0 0 2px ${theme.border}55, 0 12px 34px #02061799`
          : "0 8px 24px #02061780",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {showTargetHandle && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={isConnectable}
          style={handleStyle(theme.border, "top")}
        />
      )}

      {/* Header */}
      <div style={{ ...headerBase, background: theme.headerBg }}>
        <div style={badgeRow}>
          <span style={{ ...badge, background: theme.badgeBg, color: theme.badgeText }}>
            <Icon size={11} strokeWidth={2.2} />
            {theme.label}
          </span>
          <span style={idTag}>
            <Link2 size={10} strokeWidth={2.3} />
            <code style={idCode}>{id}</code>
          </span>
        </div>

        {/* Editable title */}
        {titleEdit.editing ? (
          <input
            ref={titleEdit.ref as React.RefObject<HTMLInputElement>}
            value={titleEdit.value}
            onChange={(e) => titleEdit.setValue(e.target.value)}
            onBlur={titleEdit.commit}
            onKeyDown={titleEdit.onKeyDown}
            style={titleInput}
            placeholder="Título do passo…"
          />
        ) : (
          <p
            style={{ ...titleDisplay, color: theme.headerText }}
            onClick={titleEdit.startEdit}
            title="Clique para editar o título"
          >
            {title?.trim() || <span style={{ opacity: 0.35 }}>sem título</span>}
          </p>
        )}
      </div>

      {/* Body */}
      <div style={bodyBase}>
        {/* Editable content */}
        {contentEdit.editing ? (
          <textarea
            ref={contentEdit.ref as React.RefObject<HTMLTextAreaElement>}
            value={contentEdit.value}
            onChange={(e) => contentEdit.setValue(e.target.value)}
            onBlur={contentEdit.commit}
            onKeyDown={contentEdit.onKeyDown}
            style={contentTextarea}
            rows={3}
          />
        ) : (
          <p
            style={contentDisplay}
            onClick={contentEdit.startEdit}
            title="Clique para editar o conteúdo"
          >
            {content?.trim() || <span style={{ opacity: 0.35 }}>sem conteúdo</span>}
          </p>
        )}

        {(media || split) && (
          <div style={chipsRow}>
            {media ? <MediaChip media={media} /> : null}
            {split ? <SplitChip /> : null}
          </div>
        )}

        {children}
        <p style={legendText}>Clique para editar · X para remover</p>
      </div>

      {/* Delete */}
      {(hovered || selected) && (
        <button
          type="button"
          onClick={() => onDelete(id)}
          style={deleteBtn}
          title="Remover nó"
        >
          <X size={10} strokeWidth={2.5} />
        </button>
      )}

      {showSourceHandle && (
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={isConnectable}
          style={handleStyle(theme.border, "bottom")}
        />
      )}
    </div>
  );
}

// ─── Node components ─────────────────────────────────────────────────────────

export function MessageNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="message" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable}
      media={data.media} split={data.split} />
  );
}

export function SendDocumentNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="send_document" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} media={data.media} />
  );
}

export function SendAudioNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="send_audio" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} media={data.media} />
  );
}

export function InputNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="input" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} />
  );
}

export function MenuNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  const { onUpdate, onRemoveMenuOption } = useContext(FlowNodeCallbacksContext);
  const [addingOption, setAddingOption] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const options: FlowMenuOption[] = (data.menuOptions as FlowMenuOption[] | undefined) ?? [];

  function updateLabel(optId: string, label: string) {
    onUpdate(id, { menuOptions: options.map((o) => (o.id === optId ? { ...o, label } : o)) });
  }

  function removeOption(optId: string) {
    if (options.length <= 1) return;
    onRemoveMenuOption(id, optId);
  }

  function addOption() {
    if (!newLabel.trim()) return;
    onUpdate(id, {
      menuOptions: [...options, { id: `opcao_${Date.now()}`, label: newLabel.trim() }],
    });
    setNewLabel("");
    setAddingOption(false);
  }

  return (
    <BaseCard id={id} kind="menu" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable}>
      <div style={optionsSection}>
        <span style={optionsSectionLabel}>Opções do menu</span>
        {options.map((opt, idx) => (
          <OptionRow key={opt.id} option={opt} index={idx}
            onUpdate={(l) => updateLabel(opt.id, l)}
            onRemove={() => removeOption(opt.id)} />
        ))}
        {addingOption ? (
          <div style={addOptRow}>
            <input
              autoFocus
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addOption();
                if (e.key === "Escape") { setAddingOption(false); setNewLabel(""); }
              }}
              placeholder="Label da opção…"
              style={addOptInput}
            />
            <button type="button" onClick={addOption} style={addOptConfirm}>
              <Check size={10} strokeWidth={2.4} />
            </button>
            <button type="button" onClick={() => { setAddingOption(false); setNewLabel(""); }} style={addOptCancel}><X size={10} strokeWidth={2} /></button>
          </div>
        ) : (
          <button type="button" onClick={() => setAddingOption(true)} style={addOptBtn}>
            <Plus size={11} strokeWidth={2.2} />
            Adicionar opção
          </button>
        )}
      </div>
    </BaseCard>
  );
}

type OptionRowProps = { option: FlowMenuOption; index: number; onUpdate: (l: string) => void; onRemove: () => void };

function OptionRow({ option, index, onUpdate, onRemove }: OptionRowProps) {
  const edit = useInlineEdit(option.label, onUpdate);
  return (
    <div style={optRow}>
      <span style={optNum}>{index + 1}</span>
      {edit.editing ? (
        <input
          ref={edit.ref as React.RefObject<HTMLInputElement>}
          value={edit.value}
          onChange={(e) => edit.setValue(e.target.value)}
          onBlur={edit.commit}
          onKeyDown={edit.onKeyDown}
          style={optInput}
        />
      ) : (
        <span style={optLabel} onClick={edit.startEdit} title="Clique para editar">
          {option.label}
        </span>
      )}
      <button type="button" onClick={onRemove} style={optRemove} title="Remover opção">
        <X size={9} strokeWidth={2} />
      </button>
    </div>
  );
}

export function CompleteNode({ id, data, selected, isConnectable }: NodeProps<Node<FlowVisualNodeData>>) {
  return (
    <BaseCard id={id} kind="complete" title={data.title} content={data.content}
      selected={selected} isConnectable={isConnectable} showSourceHandle={false} />
  );
}

// ─── nodeTypes registry ───────────────────────────────────────────────────────

export const FLOW_NODE_TYPES = {
  message: MessageNode,
  input: InputNode,
  menu: MenuNode,
  complete: CompleteNode,
  send_document: SendDocumentNode,
  send_audio: SendAudioNode,
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const cardBase: CSSProperties = {
  width: 300,
  minWidth: 300,
  maxWidth: 300,
  background: "#0a140f",
  borderRadius: 14,
  overflow: "visible",
  cursor: "default",
  position: "relative",
  fontFamily: "inherit",
};

const headerBase: CSSProperties = {
  padding: "10px 12px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  borderRadius: "13px 13px 0 0",
  borderBottom: "1px solid #1d3a2c",
};

const badgeRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  justifyContent: "space-between",
};

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 8px 2px 6px",
  borderRadius: 999,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: 0.3,
  lineHeight: 1.6,
};

const idTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "#8b949e",
  background: "#0a140f",
  border: "1px solid #1d3a2c",
  borderRadius: 999,
  padding: "2px 7px",
};

const idCode: CSSProperties = {
  fontSize: 9.5,
  color: "#cdd9d2",
  fontFamily: "monospace",
  lineHeight: 1,
  flexShrink: 1,
  maxWidth: 94,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const titleDisplay: CSSProperties = {
  margin: 0,
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "text",
  lineHeight: 1.35,
  wordBreak: "break-word",
  paddingBottom: 2,
  borderBottom: "1px dashed transparent",
};

const titleInput: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  background: "#0f1d16",
  border: "1px solid #c9a24a",
  borderRadius: 6,
  color: "#e6edf3",
  padding: "5px 7px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

const bodyBase: CSSProperties = {
  padding: "10px 12px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const legendText: CSSProperties = {
  margin: 0,
  fontSize: 10,
  color: "#6e7c74",
  letterSpacing: 0.2,
  lineHeight: 1.35,
};

const chipsRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const mediaChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: "100%",
  background: "#211a0d",
  border: "1px solid #4d3c12",
  color: "#f0d8a0",
  borderRadius: 7,
  padding: "4px 8px",
  fontSize: 10.5,
  fontWeight: 600,
};

const mediaChipLabel: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: 200,
};

const splitChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "#10231a",
  border: "1px solid #1d3a2c",
  color: "#9fd3bf",
  borderRadius: 7,
  padding: "4px 8px",
  fontSize: 10.5,
  fontWeight: 600,
};

const contentDisplay: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#cdd9d2",
  lineHeight: 1.55,
  cursor: "text",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  borderRadius: 8,
  padding: "7px 8px",
  background: "#0f1d16",
  border: "1px solid #1d3a2c",
  minHeight: 42,
};

const contentTextarea: CSSProperties = {
  fontSize: 12,
  color: "#e6edf3",
  lineHeight: 1.55,
  background: "#0f1d16",
  border: "1px solid #c9a24a",
  borderRadius: 8,
  padding: "7px 8px",
  resize: "vertical",
  outline: "none",
  width: "100%",
  boxSizing: "border-box" as const,
  minHeight: 60,
  fontFamily: "inherit",
};

const deleteBtn: CSSProperties = {
  position: "absolute",
  top: 9,
  right: 9,
  width: 22,
  height: 22,
  border: "1px solid #ef444488",
  borderRadius: "50%",
  background: "#2a1313",
  color: "#fca5a5",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  zIndex: 10,
};

function handleStyle(color: string, pos: "top" | "bottom"): CSSProperties {
  return {
    [pos]: -8,
    width: 14,
    height: 14,
    background: color,
    border: "2px solid #0a140f",
    borderRadius: "50%",
    boxShadow: "0 0 0 3px #0f1d16",
  };
}

// Menu option styles

const optionsSection: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  borderTop: "1px solid #1d3a2c",
  paddingTop: 8,
};

const optionsSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#c9a24a",
  letterSpacing: 0.5,
  textTransform: "uppercase",
  marginBottom: 1,
};

const optRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  background: "#0f1d16",
  border: "1px solid #4d3c12",
  borderRadius: 7,
  padding: "4px 7px",
  minHeight: 27,
};

const optNum: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: "#c9a24a",
  minWidth: 14,
  textAlign: "center",
};

const optLabel: CSSProperties = {
  flex: 1,
  fontSize: 11,
  color: "#cdd9d2",
  cursor: "text",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const optInput: CSSProperties = {
  flex: 1,
  fontSize: 10.5,
  color: "#e6edf3",
  background: "transparent",
  border: "none",
  outline: "none",
  padding: 0,
  fontFamily: "inherit",
};

const optRemove: CSSProperties = {
  fontSize: 9.5,
  color: "#8b949e",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 2px",
  display: "flex",
  alignItems: "center",
};

const addOptBtn: CSSProperties = {
  fontSize: 10.5,
  color: "#e3b341",
  background: "#211a0d",
  border: "1px dashed #c9a24a",
  borderRadius: 7,
  padding: "6px 8px",
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
};

const addOptRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
};

const addOptInput: CSSProperties = {
  flex: 1,
  fontSize: 10.5,
  color: "#e6edf3",
  background: "#0f1d16",
  border: "1px solid #c9a24a",
  borderRadius: 7,
  padding: "5px 7px",
  outline: "none",
  fontFamily: "inherit",
};

const addOptConfirm: CSSProperties = {
  color: "#bfe8cf",
  background: "#0e2a1b",
  border: "1px solid #15532f",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const addOptCancel: CSSProperties = {
  color: "#8b949e",
  background: "#0f1d16",
  border: "1px solid #1d3a2c",
  borderRadius: 6,
  cursor: "pointer",
  width: 24,
  height: 24,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
