"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const SIDEBAR_STORAGE_KEY = "crm-sidebar-expanded";

const NAV = [
  { href: "/crm",              label: "Dashboard",   icon: "📊" },
  { href: "/crm/leads",        label: "Leads",       icon: "👥" },
  { href: "/crm/pessoas",      label: "Pessoas",     icon: "🧑" },
  { href: "/crm/empresas",     label: "Empresas",    icon: "🏢" },
  { href: "/crm/imoveis",      label: "Imóveis",     icon: "🏠" },
  { href: "/crm/negocios",     label: "Negócios",    icon: "💼" },
  { href: "/crm/atendimento",  label: "Atendimento", icon: "💬" },
  { href: "/crm/aprovacoes",   label: "Aprovações",  icon: "✅" },
  { href: "/crm/agentes",      label: "Agentes",     icon: "🤖", extra: { href: "/crm/agentes/novo", label: "Novo Agente", icon: "+" } },
  { href: "/crm/kpis",         label: "KPIs",        icon: "📈" },
  { href: "/crm/parceiros",    label: "Parceiros",   icon: "🤝" },
  { href: "/crm/relatorios",   label: "Relatórios",  icon: "📋" },
  { href: "/crm/ciclos",       label: "Ciclos IA",   icon: "⚡" },
  { href: "/crm/trafego",      label: "Tráfego",     icon: "📡" },
  { href: "/crm/conteudo",     label: "Conteúdo",    icon: "✏️" },
  { href: "/crm/configuracoes",label: "Configurações", icon: "⚙️" },
  { href: "/crm/onboarding-tenant", label: "Onboarding tenant", icon: "🔐" },
];

function SidebarToggleChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={expanded ? "" : "rotate-180"}
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (stored === "1") setSidebarExpanded(true);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleSidebar() {
    setSidebarExpanded(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <div
      className="flex flex-col md:flex-row h-[100dvh] md:h-screen min-h-0 overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url(/sprites/office-bg.webp)" }}
    >
      {/* SIDEBAR — hidden on mobile; md+ com ícones ou ícones + rótulos */}
      <aside
        className={`hidden md:flex flex-shrink-0 flex-col py-3 gap-1 transition-[width] duration-200 ease-out overflow-hidden ${
          sidebarExpanded ? "w-56 items-stretch px-2" : "w-16 items-center px-0"
        }`}
        style={{ background: "var(--obra-dark-2, #161b22)", borderRight: "1px solid var(--obra-borda, #30363d)" }}
      >
        <div
          className={`flex flex-shrink-0 items-center gap-1 mb-2 ${sidebarExpanded ? "w-full px-1" : "flex-col"}`}
        >
          <Link
            href="/office"
            className={`rounded-xl flex items-center justify-center text-white font-black transition-colors flex-shrink-0 ${
              sidebarExpanded ? "h-10 min-w-0 flex-1 gap-2 px-3 text-xs justify-start" : "w-10 h-10 text-xs"
            }`}
            style={{ background: "var(--obra-verde, #003b26)" }}
            title="Escritório Virtual"
          >
            <span className="text-lg leading-none">🏢</span>
            {sidebarExpanded && (
              <span className="truncate font-semibold tracking-tight">Escritório</span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            className={`rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${
              sidebarExpanded ? "w-10 h-10" : "w-10 h-10"
            }`}
            style={{
              color: "var(--obra-texto-2, #8b949e)",
              background: "var(--obra-dark-3, #21262d)",
            }}
            title={sidebarExpanded ? "Recolher menu" : "Expandir menu (mostrar nomes)"}
            aria-expanded={sidebarExpanded}
            aria-label={sidebarExpanded ? "Recolher menu lateral" : "Expandir menu lateral"}
          >
            <SidebarToggleChevron expanded={sidebarExpanded} />
          </button>
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto overflow-x-hidden min-h-0 w-full">
          {NAV.map(item => {
            const active = item.href === "/crm" ? pathname === "/crm" : pathname.startsWith(item.href);
            return (
              <div key={item.href} className={`relative group ${sidebarExpanded ? "w-full" : ""}`}>
                <Link
                  href={item.href}
                  title={sidebarExpanded ? undefined : item.label}
                  className={`rounded-xl flex items-center transition-colors ${
                    sidebarExpanded
                      ? `w-full min-h-10 gap-3 px-3 py-2 text-left${"extra" in item && item.extra ? " pr-10" : ""}`
                      : "w-10 h-10 justify-center text-lg mx-auto"
                  }`}
                  style={{
                    background: active ? "var(--obra-dark-3, #21262d)" : "transparent",
                    color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                  }}
                >
                  <span className="flex-shrink-0 text-lg leading-none">{item.icon}</span>
                  {sidebarExpanded && (
                    <span className="text-sm font-medium truncate min-w-0">{item.label}</span>
                  )}
                </Link>
                {"extra" in item && item.extra && (
                  <Link
                    href={item.extra.href}
                    title={item.extra.label}
                    className={
                      sidebarExpanded
                        ? "absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                        : "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
                    }
                    style={{ background: "var(--obra-dourado, #c9a24a)", color: "var(--obra-verde, #003b26)" }}
                  >
                    {item.extra.icon}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <div
          className="md:hidden flex-shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b"
          style={{
            background: "rgba(22, 27, 34, 0.96)",
            borderColor: "var(--obra-borda, #30363d)",
          }}
        >
          <span className="text-xs font-semibold truncate" style={{ color: "var(--obra-texto-2, #8b949e)" }}>
            Navegação do CRM
          </span>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="min-h-11 min-w-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "var(--obra-dark-3, #21262d)",
              color: "var(--obra-texto, #e6edf3)",
              border: "1px solid var(--obra-borda, #30363d)",
              cursor: "pointer",
            }}
            aria-expanded={mobileMenuOpen}
            aria-label="Abrir menu do CRM"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain md:pb-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden flex" role="dialog" aria-modal="true" aria-label="Menu do CRM">
          <button
            type="button"
            className="absolute inset-0 bg-black/55 border-0 cursor-default p-0 m-0"
            style={{ WebkitTapHighlightColor: "transparent" }}
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            className="relative flex flex-col h-full w-[min(100%,20rem)] max-w-[85vw] shadow-2xl border-r"
            style={{
              background: "var(--obra-dark-2, #161b22)",
              borderColor: "var(--obra-borda, #30363d)",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b flex-shrink-0" style={{ borderColor: "var(--obra-borda, #30363d)" }}>
              <span className="text-sm font-bold" style={{ color: "var(--obra-texto, #e6edf3)" }}>CRM</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-10 min-w-10 rounded-lg flex items-center justify-center text-lg"
                style={{ background: "var(--obra-dark-3, #21262d)", color: "var(--obra-texto-2, #8b949e)", border: "none", cursor: "pointer" }}
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="px-2 py-2 border-b flex-shrink-0" style={{ borderColor: "var(--obra-borda, #30363d)" }}>
              <Link
                href="/office"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
                style={{ background: "var(--obra-verde, #003b26)", color: "white" }}
              >
                <span>🏢</span> Escritório virtual
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 min-h-0" style={{ WebkitOverflowScrolling: "touch" }}>
              {NAV.map(item => {
                const active = item.href === "/crm" ? pathname === "/crm" : pathname.startsWith(item.href);
                return (
                  <div key={item.href} className="relative px-2 py-0.5">
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium min-w-0 ${"extra" in item && item.extra ? "pr-12" : ""}`}
                      style={{
                        background: active ? "var(--obra-dark-3, #21262d)" : "transparent",
                        color: active ? "var(--obra-dourado, #c9a24a)" : "var(--obra-texto-2, #8b949e)",
                      }}
                    >
                      <span className="text-lg flex-shrink-0">{item.icon}</span>
                      <span className="min-w-0">{item.label}</span>
                    </Link>
                    {"extra" in item && item.extra && (
                      <Link
                        href={item.extra.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black"
                        style={{ background: "var(--obra-dourado, #c9a24a)", color: "var(--obra-verde, #003b26)" }}
                        title={item.extra.label}
                      >
                        {item.extra.icon}
                      </Link>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
