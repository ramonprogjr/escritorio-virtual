"use client";

import { useState } from "react";
import type { BriefingSimMenuChoice } from "@/lib/playbook/briefing-flow-sim-shared";

export type BriefingSimPartMetadata = {
  kind: "text";
  text: string;
  display?: string;
} | {
  kind: "menu";
  text: string;
  menu_type: "list" | "button" | "text";
  choices: BriefingSimMenuChoice[];
  list_button?: string;
  display?: string;
};

type Props = {
  part: BriefingSimPartMetadata;
  disabled?: boolean;
  onSelectOption?: (choice: BriefingSimMenuChoice, index: number) => void;
};

export function BriefingWhatsappMenuOptions({
  menuType,
  choices,
  listButton,
  disabled,
  onSelectOption,
}: {
  menuType: "list" | "button" | "text";
  choices: BriefingSimMenuChoice[];
  listButton?: string;
  disabled?: boolean;
  onSelectOption?: (choice: BriefingSimMenuChoice, index: number) => void;
}) {
  const [listOpen, setListOpen] = useState(false);

  if (menuType === "list" && !listOpen) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setListOpen(true)}
        style={{
          marginTop: 8,
          width: "100%",
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #00a88455",
          background: "#0b141a",
          color: "#00a884",
          fontSize: 13,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center",
        }}
      >
        {listButton?.trim() || "Ver opções"}
      </button>
    );
  }

  const btnStyle = (fullWidth: boolean): React.CSSProperties => ({
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid #00a88444",
    background: "#111b21",
    color: "#e9edef",
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "center",
    lineHeight: 1.35,
    width: fullWidth ? "100%" : undefined,
    flex: fullWidth ? undefined : "1 1 45%",
  });

  const items = choices.map((choice, index) => {
    const label =
      menuType === "text" ? `${index + 1}. ${choice.label}` : choice.label;
    return (
      <button
        key={choice.id}
        type="button"
        disabled={disabled}
        onClick={() => onSelectOption?.(choice, index)}
        style={btnStyle(menuType !== "button")}
      >
        {label}
      </button>
    );
  });

  return (
    <div
      style={{
        marginTop: 8,
        display: "flex",
        flexDirection: menuType === "button" ? "row" : "column",
        flexWrap: menuType === "button" ? "wrap" : "nowrap",
        gap: 6,
      }}
    >
      {items}
    </div>
  );
}

export function BriefingWhatsappBubble({
  part,
  disabled,
  onSelectOption,
}: Props) {
  return (
    <div style={{ maxWidth: "min(92%, 420px)" }}>
      <div
        style={{
          background: "#005c4b",
          color: "#e9edef",
          borderRadius: "8px 8px 8px 2px",
          padding: "8px 10px 6px",
          fontSize: 13.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
        }}
      >
        {part.kind === "text" ? part.text : part.text}
        {part.kind === "menu" && part.menu_type === "text" && (
          <div style={{ marginTop: 6, opacity: 0.92 }}>
            {part.choices.map((c, i) => (
              <div key={c.id} style={{ marginTop: i === 0 ? 0 : 2 }}>
                {i + 1}. {c.label}
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            color: "#ffffff99",
            marginTop: 4,
          }}
        >
          agora
        </div>
      </div>
      {part.kind === "menu" && part.menu_type !== "text" ? (
        <BriefingWhatsappMenuOptions
          menuType={part.menu_type}
          choices={part.choices}
          listButton={part.list_button}
          disabled={disabled}
          onSelectOption={onSelectOption}
        />
      ) : null}
      {part.kind === "menu" && part.menu_type === "text" ? (
        <BriefingWhatsappMenuOptions
          menuType="text"
          choices={part.choices}
          disabled={disabled}
          onSelectOption={onSelectOption}
        />
      ) : null}
    </div>
  );
}

export function BriefingWhatsappUserBubble({ text }: { text: string }) {
  return (
    <div style={{ maxWidth: "min(92%, 420px)", marginLeft: "auto" }}>
      <div
        style={{
          background: "#202c33",
          color: "#e9edef",
          borderRadius: "8px 8px 2px 8px",
          padding: "8px 10px 6px",
          fontSize: 13.5,
          lineHeight: 1.45,
          whiteSpace: "pre-wrap",
          boxShadow: "0 1px 0.5px rgba(0,0,0,0.13)",
        }}
      >
        {text}
        <div
          style={{
            textAlign: "right",
            fontSize: 10,
            color: "#ffffff66",
            marginTop: 4,
          }}
        >
          agora ✓✓
        </div>
      </div>
    </div>
  );
}

export function parseSimPartFromMetadata(
  metadata: Record<string, unknown> | undefined
): BriefingSimPartMetadata | null {
  const raw = metadata?.sim_part;
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  if (p.kind === "text" && typeof p.text === "string") {
    return { kind: "text", text: p.text, display: typeof p.display === "string" ? p.display : undefined };
  }
  if (p.kind === "menu" && typeof p.text === "string" && Array.isArray(p.choices)) {
    const menuType =
      p.menu_type === "button" || p.menu_type === "list" || p.menu_type === "text"
        ? p.menu_type
        : "text";
    const choices = (p.choices as unknown[])
      .filter((c): c is BriefingSimMenuChoice => !!c && typeof c === "object" && typeof (c as BriefingSimMenuChoice).id === "string")
      .map((c) => ({ id: c.id, label: String(c.label || c.id) }));
    return {
      kind: "menu",
      text: p.text,
      menu_type: menuType,
      choices,
      list_button: typeof p.list_button === "string" ? p.list_button : undefined,
      display: typeof p.display === "string" ? p.display : undefined,
    };
  }
  return null;
}
