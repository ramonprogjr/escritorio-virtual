"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bot,
  Building2,
  GitBranch,
  MessageCircle,
  Plug,
  Shield,
  Wallet,
} from "lucide-react";
import type { HubModule, HubModuleId } from "@/lib/hub/landing-content";

const ICONS: Record<HubModuleId, LucideIcon> = {
  crm: Building2,
  funil: GitBranch,
  whatsapp: MessageCircle,
  ia: Bot,
  gestao: Shield,
  financeiro: Wallet,
  analytics: BarChart3,
  integracoes: Plug,
};

type Props = {
  module: HubModule;
};

export function HubModuleCard({ module: mod }: Props) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICONS[mod.id];

  return (
    <article
      className={`hub-module-card group relative h-full w-full overflow-hidden rounded-2xl border border-[var(--obra-borda,#30363d)] transition-[transform,box-shadow,border-color] duration-300 ${
        expanded
          ? "border-[var(--obra-dourado,#c9a24a)]/50 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          : "hover:-translate-y-1 hover:border-[var(--obra-borda,#30363d)]/80"
      }`}
      style={{
        background:
          "linear-gradient(165deg, rgba(22,27,34,0.95) 0%, rgba(13,17,23,0.98) 100%)",
      }}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onClick={() => setExpanded((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div
        className="absolute inset-x-0 top-0 h-1 opacity-80"
        style={{ background: mod.accent }}
      />
      <div className="p-5 sm:p-6">
        <div
          className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${mod.accent}22`, color: mod.accent }}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <h3 className="text-lg font-bold tracking-tight">{mod.title}</h3>
        <p className="mt-2 text-sm text-[var(--obra-texto-2,#8b949e)]">{mod.tagline}</p>

        <ul
          className={`mt-4 space-y-2 overflow-hidden transition-[max-height,opacity] duration-300 ${
            expanded ? "max-h-48 opacity-100" : "max-h-0 opacity-0 sm:group-hover:max-h-48 sm:group-hover:opacity-100"
          }`}
        >
          {mod.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-xs leading-relaxed text-[var(--obra-texto,#e6edf3)]">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: mod.accent }} />
              {b}
            </li>
          ))}
        </ul>

        <p
          className={`mt-4 text-sm italic leading-snug text-[var(--obra-dourado-light,#e0b86a)] transition-opacity duration-300 ${
            expanded ? "opacity-100" : "opacity-0 sm:group-hover:opacity-100"
          }`}
        >
          {mod.outcome}
        </p>
      </div>
    </article>
  );
}
