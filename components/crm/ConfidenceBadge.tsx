"use client";

import { Sparkles, FileText, Pencil } from "lucide-react";

/**
 * ConfidenceBadge (Onda U2) — mostra a confiança de um valor derivado por IA, com a origem,
 * e permite corrigir em 1 toque. Regra transversal (spec §7): "a IA preenche, o humano
 * confirma" — nada derivado grava sem confirmação, e todo campo derivado mostra origem +
 * confiança. Hoje é visual/reutilizável; passa a ter dados reais quando a IA ligar (Bloco 8).
 */
export type Confianca = "alta" | "media" | "baixa";

const ESTILO: Record<Confianca, { label: string; fg: string; bg: string; bd: string }> = {
  alta: { label: "Alta", fg: "#3fb950", bg: "rgba(63,185,80,0.12)", bd: "rgba(63,185,80,0.35)" },
  media: { label: "Média", fg: "#e0b86a", bg: "rgba(201,162,74,0.12)", bd: "rgba(201,162,74,0.35)" },
  baixa: { label: "Baixa", fg: "#f0883e", bg: "rgba(240,136,62,0.12)", bd: "rgba(240,136,62,0.35)" },
};

export function ConfidenceBadge({
  nivel,
  origem,
  onCorrigir,
}: {
  nivel: Confianca;
  /** De onde veio (ex.: "IA", "PDF p.3", "WhatsApp"). */
  origem?: string;
  /** Toque para corrigir o valor (abre edição). */
  onCorrigir?: () => void;
}) {
  const e = ESTILO[nivel];
  const OrigemIcon = origem && /pdf|arquivo|doc|xls/i.test(origem) ? FileText : Sparkles;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
      style={{ color: e.fg, background: e.bg, borderColor: e.bd }}
      title={origem ? `Confiança ${e.label} · origem: ${origem}` : `Confiança ${e.label}`}
    >
      <OrigemIcon size={11} strokeWidth={2} aria-hidden />
      {e.label}
      {origem ? <span className="font-normal opacity-80">· {origem}</span> : null}
      {onCorrigir ? (
        <button
          type="button"
          onClick={onCorrigir}
          aria-label="Corrigir valor"
          className="ml-0.5 inline-flex items-center rounded-full p-0.5 transition-opacity hover:opacity-100"
          style={{ color: e.fg, opacity: 0.7, cursor: "pointer", border: "none", background: "transparent" }}
        >
          <Pencil size={11} strokeWidth={2} aria-hidden />
        </button>
      ) : null}
    </span>
  );
}
