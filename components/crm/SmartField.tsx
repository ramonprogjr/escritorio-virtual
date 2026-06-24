"use client";

import { Mic } from "lucide-react";
import { ConfidenceBadge, type Confianca } from "./ConfidenceBadge";
import type { SmartOption } from "./smartfield-faixas";

/**
 * SmartField (Onda U2 — Click-and-Go / Talk-and-Go) — campo híbrido: o usuário ESCOLHE
 * (chips de múltipla escolha ou faixa) e, no futuro, FALA (voz); digitar é o fallback.
 * Mostra origem + confiança quando o valor vem da IA (ConfidenceBadge). O botão de
 * microfone já nasce aqui, mas é STUB até a decisão de voz (on-device vs serviço); a voz
 * "de verdade" amadurece com a IA (Bloco 8). Componente reutilizável, sobre o design system.
 */
type Props = {
  label: string;
  /** chips = múltipla escolha · faixa = faixas (ex.: ticket) · texto = digitação (fallback). */
  modo: "chips" | "faixa" | "texto";
  /** Opções para chips/faixa. */
  opcoes?: SmartOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Quando o valor é derivado por IA: origem + confiança (a IA preenche, o humano confirma). */
  confianca?: { nivel: Confianca; origem?: string };
  /** Exibe o botão de microfone (Talk-and-Go) — hoje STUB ("em breve"). */
  voz?: boolean;
  hint?: string;
  required?: boolean;
};

export function SmartField({
  label,
  modo,
  opcoes = [],
  value,
  onChange,
  placeholder,
  confianca,
  voz = false,
  hint,
  required = false,
}: Props) {
  const ehEscolha = modo === "chips" || modo === "faixa";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold text-[#8b949e]">
          {label}
          {required ? <span className="ml-0.5 text-[#f0883e]">*</span> : null}
        </label>
        <div className="flex items-center gap-1.5">
          {confianca ? <ConfidenceBadge nivel={confianca.nivel} origem={confianca.origem} /> : null}
          {voz ? (
            <button
              type="button"
              aria-label="Preencher por voz (em breve)"
              title="Voz (Talk-and-Go) — em breve"
              aria-disabled
              className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#30363d] text-[#484f58]"
              style={{ background: "transparent", cursor: "not-allowed" }}
              onClick={(e) => e.preventDefault()}
            >
              <Mic size={13} strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      {ehEscolha ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
          {opcoes.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={sel}
                onClick={() => onChange(sel ? "" : o.value)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  cursor: "pointer",
                  background: sel ? "#c9a24a" : "transparent",
                  color: sel ? "#003b26" : "#e6edf3",
                  borderColor: sel ? "#c9a24a" : "#30363d",
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#484f58] focus:border-[#c9a24a]"
        />
      )}

      {hint ? <p className="text-[11px] text-[#484f58]">{hint}</p> : null}
    </div>
  );
}
