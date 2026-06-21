"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HUB_HERO } from "@/lib/hub/landing-content";

export function HubHero() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
      <div className="hub-reveal max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--obra-dourado,#c9a24a)]">
          {HUB_HERO.eyebrow}
        </p>
        <h1
          className="text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.25rem]"
          style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
        >
          {HUB_HERO.title}
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--obra-texto-2,#8b949e)] sm:text-lg">
          {HUB_HERO.subtitle}
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {HUB_HERO.pills.map((pill) => (
            <span
              key={pill}
              className="rounded-full border border-[var(--obra-borda,#30363d)] bg-[var(--obra-dark-2,#161b22)]/80 px-3 py-1 text-xs font-medium text-[var(--obra-texto-2,#8b949e)]"
            >
              {pill}
            </span>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/cadastre-se"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)] transition-transform active:scale-[0.99]"
            style={{
              background:
                "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
              boxShadow: "0 12px 40px rgba(0, 59, 38, 0.35)",
            }}
          >
            {HUB_HERO.ctaPrimary}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <a
            href="#modulos"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--obra-borda,#30363d)] px-6 text-sm font-medium text-[var(--obra-texto,#e6edf3)] transition-colors hover:border-[var(--obra-dourado,#c9a24a)]/40"
          >
            {HUB_HERO.ctaSecondary}
          </a>
        </div>
      </div>

      <div
        className="hub-reveal-delay pointer-events-none absolute -right-20 top-8 hidden h-72 w-72 rounded-full opacity-40 blur-3xl lg:block"
        style={{ background: "radial-gradient(circle, rgba(201,162,74,0.25) 0%, transparent 70%)" }}
      />
    </section>
  );
}
