"use client";

import { useId, useRef } from "react";
import { Mic } from "lucide-react";
import { ConfidenceBadge, type Confianca } from "./ConfidenceBadge";
import type { SmartOption } from "./smartfield-faixas";

/**
 * SmartField (Onda U2 — Click-and-Go) — campo de SELEÇÃO ÚNICA por toque: o usuário ESCOLHE
 * um chip/faixa (escolher > digitar); `texto` é o fallback. Mostra origem + confiança quando
 * o valor vem da IA (ConfidenceBadge). A voz (Talk-and-Go) entra no fim do roadmap — por ora
 * só um selo discreto "em breve" (sem botão morto). Acessível: radiogroup + navegação por
 * setas (roving tabindex), foco visível, alvo de toque ≥40px. Reutilizável, design system Obra10+.
 */
type Props = {
  label: string;
  /** chips = opções soltas · faixa = faixas ordinais · texto = digitação (fallback). */
  modo: "chips" | "faixa" | "texto";
  /** Opções para chips/faixa. */
  opcoes?: SmartOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Quando o valor é derivado por IA: origem + confiança (a IA preenche, o humano confirma). */
  confianca?: { nivel: Confianca; origem?: string };
  /** Exibe o selo discreto de voz (Talk-and-Go) — "em breve". */
  voz?: boolean;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
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
  disabled = false,
  id,
}: Props) {
  const ehEscolha = modo === "chips" || modo === "faixa";
  const reactId = useId();
  const fieldId = id ?? reactId;
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function focarChip(i: number) {
    const n = opcoes.length;
    if (n === 0) return;
    btnRefs.current[(i + n) % n]?.focus();
  }

  function onChipKey(e: React.KeyboardEvent, idx: number) {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      focarChip(idx + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      focarChip(idx - 1);
    }
  }

  // Roving tabindex: só o selecionado (ou o 1º) é tabbável; setas movem o foco.
  const selIdx = opcoes.findIndex((o) => o.value === value);
  const rovingActive = selIdx >= 0 ? selIdx : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={ehEscolha ? undefined : fieldId}
          id={ehEscolha ? `${fieldId}-label` : undefined}
          className="text-xs font-semibold text-[#8b949e]"
        >
          {label}
          {required ? <span className="ml-0.5 text-[#f0883e]">*</span> : null}
        </label>
        <div className="flex items-center gap-1.5">
          {confianca ? <ConfidenceBadge nivel={confianca.nivel} origem={confianca.origem} /> : null}
          {voz ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-[#30363d] px-1.5 py-0.5 text-[10px] font-semibold text-[#484f58]"
              title="Preenchimento por voz (Talk-and-Go) em breve"
            >
              <Mic size={10} strokeWidth={2} aria-hidden />
              em breve
            </span>
          ) : null}
        </div>
      </div>

      {ehEscolha ? (
        <div role="radiogroup" aria-labelledby={`${fieldId}-label`} className="flex flex-wrap gap-2">
          {opcoes.map((o, idx) => {
            const sel = o.value === value;
            const cor = sel
              ? "bg-[#c9a24a] text-[#003b26] border-[#c9a24a]"
              : "bg-transparent text-[#e6edf3] border-[#30363d] hover:border-[#8b949e]";
            return (
              <button
                key={o.value}
                ref={(el) => {
                  btnRefs.current[idx] = el;
                }}
                type="button"
                role="radio"
                aria-checked={sel}
                tabIndex={idx === rovingActive ? 0 : -1}
                disabled={disabled}
                onKeyDown={(e) => onChipKey(e, idx)}
                onClick={() => onChange(o.value)}
                className={`min-h-10 cursor-pointer rounded-full border px-3.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${cor}`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          id={fieldId}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#e6edf3] outline-none transition-colors placeholder:text-[#484f58] focus:border-[#c9a24a] disabled:opacity-50"
        />
      )}

      {hint ? <p className="text-[11px] text-[#484f58]">{hint}</p> : null}
    </div>
  );
}
