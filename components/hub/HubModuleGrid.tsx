import { HUB_MODULES } from "@/lib/hub/landing-content";
import { HubModuleCard } from "./HubModuleCard";

export function HubModuleGrid() {
  return (
    <section id="modulos" className="scroll-mt-20 py-8 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="hub-reveal mb-8 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--obra-dourado,#c9a24a)]">
            Entregas do sistema
          </p>
          <h2
            className="mt-2 text-2xl font-bold sm:text-3xl"
            style={{ fontFamily: "var(--font-playfair, Georgia, serif)" }}
          >
            O que a plataforma entrega no dia a dia
          </h2>
          <p className="mt-3 text-sm text-[var(--obra-texto-2,#8b949e)]">
            Passe o cursor ou toque para ver como cada área ajuda a sua operação.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {HUB_MODULES.map((mod) => (
            <HubModuleCard key={mod.id} module={mod} />
          ))}
        </div>
      </div>
    </section>
  );
}
