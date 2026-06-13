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

export function BriefingSimMenuOptions({
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
          padding: "9px 12px",
          borderRadius: 8,
          border: "1px solid #c9a24a55",
          background: "#21262d",
          color: "#d6b976",
          fontSize: 12,
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
    padding: "8px 11px",
    borderRadius: 8,
    border: "1px solid #30363d",
    background: "#0d1117",
    color: "#e6edf3",
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    textAlign: "left",
    lineHeight: 1.35,
    width: fullWidth ? "100%" : undefined,
    flex: fullWidth ? undefined : "1 1 45%",
  });

  const items = choices.map((choice, index) => {
    const label = menuType === "text" ? `${index + 1}. ${choice.label}` : choice.label;
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
      .filter(
        (c): c is BriefingSimMenuChoice =>
          !!c && typeof c === "object" && typeof (c as BriefingSimMenuChoice).id === "string"
      )
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
