"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Obra10BrandHeaderLink } from "@/components/brand/Obra10Brand";

const NAV = [
  { href: "#o-que-e", label: "O Hub" },
  { href: "#modulos", label: "Módulos" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#plataforma", label: "Plataforma" },
];

function sectionHref(pathname: string, hash: string): string {
  return pathname === "/" ? hash : `/${hash}`;
}

type Props = {
  children: React.ReactNode;
};

export function HubPublicShell({ children }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="hub-landing relative min-h-[100dvh] overflow-x-hidden bg-[var(--obra-dark,#0d1117)] text-[var(--obra-texto,#e6edf3)]">
      <div className="hub-landing-bg pointer-events-none fixed inset-0" aria-hidden />

      <header className="sticky top-0 z-50 border-b border-[var(--obra-borda,#30363d)]/60 bg-[rgba(13,17,23,0.82)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Obra10BrandHeaderLink
            href="/"
            size="sm"
            subtitle="HUB"
            subtitleClassName="!text-[var(--obra-dourado,#c9a24a)]"
          />

          <nav className="hidden items-center gap-8 md:flex" aria-label="Principal">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={sectionHref(pathname, item.href)}
                className="text-sm text-[var(--obra-texto-2,#8b949e)] transition-colors hover:text-[var(--obra-dourado-light,#e0b86a)]"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-[var(--obra-texto,#e6edf3)] transition-colors hover:text-[var(--obra-dourado-light,#e0b86a)]"
            >
              Login
            </Link>
            <Link
              href="/cadastre-se"
              className="rounded-lg border border-[rgba(201,162,74,0.35)] px-4 py-2 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)] transition-[transform,box-shadow] hover:shadow-[0_0_24px_rgba(201,162,74,0.15)] active:scale-[0.98]"
              style={{
                background:
                  "linear-gradient(180deg, var(--obra-verde-light,#005c3d) 0%, var(--obra-verde,#003b26) 100%)",
              }}
            >
              Cadastre-se
            </Link>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--obra-borda,#30363d)] md:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-[var(--obra-borda,#30363d)]/60 px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-3" aria-label="Mobile">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={sectionHref(pathname, item.href)}
                  className="text-sm text-[var(--obra-texto-2,#8b949e)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link href="/login" className="text-sm font-medium" onClick={() => setMenuOpen(false)}>
                Login
              </Link>
              <Link
                href="/cadastre-se"
                className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[var(--obra-verde,#003b26)] px-4 text-sm font-semibold text-[var(--obra-dourado-light,#e0b86a)]"
                onClick={() => setMenuOpen(false)}
              >
                Cadastre-se
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main className="relative z-10">{children}</main>

      <footer className="border-t border-[var(--obra-borda,#30363d)]/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
          <p className="text-xs text-[var(--obra-texto-3,#484f58)]">
            © {new Date().getFullYear()} Obra10+ · Hub operacional multi-empresa
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
            <Link href="/login" className="text-[var(--obra-texto-2,#8b949e)] hover:text-[var(--obra-dourado,#c9a24a)]">
              Login
            </Link>
            <Link
              href="/cadastre-se"
              className="text-[var(--obra-texto-2,#8b949e)] hover:text-[var(--obra-dourado,#c9a24a)]"
            >
              Cadastre a sua empresa
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
