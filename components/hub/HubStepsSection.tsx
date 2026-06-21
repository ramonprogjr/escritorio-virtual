import { HUB_STEPS } from "@/lib/hub/landing-content";

export function HubStepsSection() {
  return (
    <section id="como-funciona" className="scroll-mt-20 border-y border-[var(--obra-borda,#30363d)]/40 bg-[var(--obra-dark-2,#161b22)]/40 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="hub-reveal mb-12 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--obra-dourado,#c9a24a)]">
            Como funciona
          </p>
          <h2
            className="mt-2 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
          >
            Da adesão à operação em três passos
          </h2>
        </div>

        <ol className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {HUB_STEPS.map((step, i) => (
            <li
              key={step.step}
              className={`hub-reveal relative rounded-2xl border border-[var(--obra-borda,#30363d)] p-6 ${
                i === 1 ? "lg:mt-8" : i === 2 ? "lg:mt-16" : ""
              }`}
              style={{
                background:
                  "linear-gradient(160deg, rgba(33,38,45,0.6) 0%, rgba(13,17,23,0.9) 100%)",
              }}
            >
              <span className="font-mono text-4xl font-bold text-[var(--obra-dourado,#c9a24a)]/30">
                0{step.step}
              </span>
              <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--obra-texto-2,#8b949e)]">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
