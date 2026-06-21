import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HUB_CTA, HUB_STATS } from "@/lib/hub/landing-content";

export function HubStatsBand() {
  return (
    <section id="plataforma" className="scroll-mt-20 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HUB_STATS.map((stat) => (
            <div
              key={stat.label}
              className="hub-reveal rounded-xl border border-[var(--obra-borda,#30363d)]/80 px-5 py-6 text-center sm:text-left"
            >
              <p className="text-lg font-bold text-[var(--obra-dourado-light,#e0b86a)]">{stat.value}</p>
              <p className="mt-1 text-xs text-[var(--obra-texto-2,#8b949e)]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HubCtaBand() {
  return (
    <section className="pb-20 pt-4">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div
          className="hub-reveal relative overflow-hidden rounded-3xl border border-[var(--obra-dourado,#c9a24a)]/25 px-6 py-12 text-center sm:px-12 sm:py-16"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,59,38,0.35) 0%, rgba(13,17,23,0.95) 50%, rgba(201,162,74,0.08) 100%)",
          }}
        >
          <h2
            className="text-balance text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
          >
            {HUB_CTA.title}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[var(--obra-texto-2,#8b949e)]">
            {HUB_CTA.subtitle}
          </p>
          <Link
            href="/cadastre-se"
            className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl px-8 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)]"
            style={{
              background:
                "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
            }}
          >
            {HUB_CTA.button}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
