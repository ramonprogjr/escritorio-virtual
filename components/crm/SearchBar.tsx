"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

export function SearchBar({ value, onChange, placeholder = "Buscar..." }: Props) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%",
        padding: "8px 12px",
        borderRadius: 8,
        background: "#16271e",
        border: "1px solid #1d3a2c",
        color: "#e6edf3",
        fontSize: 13,
        outline: "none",
        boxSizing: "border-box",
      }}
    />
  );
}
