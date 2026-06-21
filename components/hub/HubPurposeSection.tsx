import { HUB_PURPOSE } from "@/lib/hub/landing-content";

export function HubPurposeSection() {
  return (
    <section id="o-que-e" className="scroll-mt-20 border-b border-[var(--obra-borda,#30363d)]/40 py-14 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="hub-reveal mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--obra-dourado,#c9a24a)]">
            O Hub Obra10+
          </p>
          <h2
            className="mt-2 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
          >
            O que é e para que serve
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          {HUB_PURPOSE.map((block, i) => (
            <div
              key={block.title}
              className={`hub-reveal rounded-2xl border border-[var(--obra-borda,#30363d)]/80 p-6 ${
                i === 1 ? "md:-mt-2" : ""
              }`}
              style={{
                background:
                  "linear-gradient(160deg, rgba(33,38,45,0.5) 0%, rgba(13,17,23,0.85) 100%)",
              }}
            >
              <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--obra-dourado,#c9a24a)]">
                {block.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
                {block.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
