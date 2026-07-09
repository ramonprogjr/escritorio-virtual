"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Botão base do CRM — um só componente com variantes e estados (hover/active/focus/disabled/loading)
 * para acabar com as ~30 cópias do CTA dourado escritas à mão (laudo de design). Usa as utilities
 * --obra-* (design system dark verde + dourado). Toda opção/ação nova deve usar este botão.
 */

export type CrmButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "link";
export type CrmButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<CrmButtonVariant, string> = {
  // CTA principal — dourado sólido sobre verde
  primary:
    "bg-obra-dourado text-obra-verde hover:brightness-110 active:brightness-95 shadow-sm hover:shadow-[0_4px_14px_rgba(201,162,74,0.35)]",
  // Ação secundária — superfície escura com borda
  secondary:
    "bg-obra-dark-3 text-obra-texto border border-obra-borda hover:border-[color:var(--color-obra-dourado)]/55 hover:text-white",
  // Terciária/discreta
  ghost: "bg-transparent text-obra-texto-2 hover:text-obra-texto hover:bg-obra-dark-3",
  // Destrutiva
  danger:
    "bg-[color:var(--color-obra-vermelho)]/15 text-[#ff7b72] border border-[color:var(--color-obra-vermelho)]/40 hover:bg-[color:var(--color-obra-vermelho)]/25",
  // Link
  link: "bg-transparent text-obra-dourado hover:text-obra-dourado-light underline-offset-2 hover:underline",
};

const SIZES: Record<CrmButtonSize, string> = {
  sm: "min-h-9 px-2.5 py-1.5 text-xs gap-1.5",
  md: "min-h-10 px-4 py-2 text-sm gap-2",
  lg: "min-h-12 px-5 py-2.5 text-[15px] gap-2",
};

export type CrmButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CrmButtonVariant;
  size?: CrmButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  fullWidth?: boolean;
};

export const CrmButton = forwardRef<HTMLButtonElement, CrmButtonProps>(function CrmButton(
  { variant = "primary", size = "md", loading = false, leftIcon, fullWidth = false, className = "", children, disabled, type, ...rest },
  ref
) {
  const base =
    "inline-flex items-center justify-center rounded-obra-sm font-bold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-obra-dourado)]/60 disabled:opacity-45 disabled:cursor-not-allowed";
  const cls = [base, VARIANTS[variant], variant === "link" ? "" : SIZES[size], fullWidth ? "w-full" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button ref={ref} type={type ?? "button"} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 size={size === "lg" ? 18 : 15} className="animate-spin" aria-hidden /> : leftIcon}
      {children}
    </button>
  );
});
