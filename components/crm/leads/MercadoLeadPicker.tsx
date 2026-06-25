"use client";

import { mercadoIcon } from "@/lib/crm/mercado-visual";
import { MERCADOS_PREFIXO_OPTIONS } from "@/lib/crm/negocio-cadastro";

type Props = {
  mercados: string[];
  onToggle: (sigla: string, ativo: boolean) => void;
  disabled?: boolean;
};

/**
 * Mercados em CHIPS (Click-and-Go, múltipla escolha) — substitui a antiga parede de
 * toggles. Mesma matriz do wizard (hub_mercados / MERCADOS_PREFIXO). Props inalterados.
 */
export function MercadoLeadPicker({ mercados, onToggle, disabled }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs leading-relaxed text-[#8b949e]">
        Escolha um ou mais mercados — sem nenhum, o lead entra em{" "}
        <strong className="text-[#e6edf3]">Imobiliário</strong>.
      </p>
      <div className="flex flex-wrap gap-2">
        {MERCADOS_PREFIXO_OPTIONS.map((m) => {
          const sigla = m.value;
          const ativo = mercados.includes(sigla);
          const Icon = mercadoIcon(sigla);
          return (
            <button
              key={sigla}
              type="button"
              disabled={disabled}
              aria-pressed={ativo}
              onClick={() => onToggle(sigla, !ativo)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50"
              style={{
                borderColor: ativo ? "#c9a24a" : "#30363d",
                background: ativo ? "rgba(201,162,74,0.15)" : "#0d1117",
                color: ativo ? "#e0b86a" : "#8b949e",
                cursor: disabled ? "not-allowed" : "pointer",
              }}
            >
              <Icon size={14} strokeWidth={2} aria-hidden />
              {m.label}
              {ativo ? <span aria-hidden>✓</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
