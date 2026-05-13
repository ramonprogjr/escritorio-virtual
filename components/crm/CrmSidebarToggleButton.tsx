"use client";

import { ChevronRight } from "lucide-react";
import { useCrmShell } from "@/components/crm/CrmShellContext";

type CrmSidebarToggleButtonProps = {
  className?: string;
  /** `sidebar`: visível no pai (sidebar só desktop). `header`: barra do título (`hidden` em mobile). */
  variant?: "sidebar" | "header";
};

/** Controlo compacto e discreto (não usa verde nem glow). */
export function CrmSidebarToggleButton({
  className = "",
  variant = "header",
}: CrmSidebarToggleButtonProps) {
  const shell = useCrmShell();
  if (!shell) return null;

  const { sidebarExpanded, toggleSidebar } = shell;

  const visibility = variant === "sidebar" ? "flex" : "hidden md:flex";

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={`${visibility} h-7 w-7 flex-shrink-0 touch-manipulation items-center justify-center rounded-md border border-[#30363d] bg-[#21262d] text-[#8b949e] shadow-none transition-colors hover:bg-[#2d333b] hover:text-[#e6edf3] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a24a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`.trim()}
      title={sidebarExpanded ? "Recolher menu" : "Expandir menu"}
      aria-expanded={sidebarExpanded}
      aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
    >
      <ChevronRight
        size={12}
        strokeWidth={2}
        className={`shrink-0 transition-transform duration-200 ${sidebarExpanded ? "rotate-180" : ""}`}
        aria-hidden
      />
    </button>
  );
}
