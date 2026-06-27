"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Menu, X, ChevronLeft, Bell } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import {
  isMobileShellRoute,
  needsMobileSubHeader,
  mobilePageTitle,
} from "@/lib/mobile/nav";
import {
  CRM_NAV_GROUPS,
  filterCrmNavGroupsForRole,
  isCrmNavPathActive,
} from "@/lib/crm-nav-groups";

interface Props {
  children: React.ReactNode;
}

/* Identidade da marca (espelha a Área de Membros / onboarding): verde escuro + dourado. */
const CHROME_BG = "#0b1410";
const CHROME_BORDER = "#1d3a2c";
const DRAWER_BG = "#0c1712";
const GOLD = "#c9a24a";
const SECTION_LABEL = "#5f8470";
const ITEM_TEXT = "#a9c6b6";

export default function MobileShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState({ leads: 0, chat: 0, aprovacoes: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [historico, setHistorico] = useState<string[]>([]);
  const [userRole, setUserRole] = useState("");

  // Papel do usuário p/ filtrar os grupos do menu (mesma fonte do desktop).
  useEffect(() => {
    let cancelled = false;
    async function loadRole(u: User) {
      const row = await supabase.from("users").select("role").eq("auth_id", u.id).maybeSingle();
      if (!cancelled) setUserRole(row.data?.role != null ? String(row.data.role) : "");
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (u) void loadRole(u);
      else setUserRole("");
    });
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) void loadRole(user);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const navGroups = useMemo(() => filterCrmNavGroupsForRole(CRM_NAV_GROUPS, userRole), [userRole]);

  useEffect(() => {
    setHistorico((prev) => {
      if (prev[prev.length - 1] === pathname) return prev;
      return [...prev.slice(-9), pathname];
    });
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const carregarBadges = useCallback(async () => {
    const [leads, msgs, aprovs] = await Promise.all([
      supabase
        .from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .not("estagio", "in", '("ganho","perdido")')
        .is("humano_responsavel", null),
      supabase
        .from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("direcao", "entrada")
        .eq("status", "pendente"),
      supabase
        .from("hub_aprovacoes")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente"),
    ]);
    setBadges({
      leads: leads.count || 0,
      chat: msgs.count || 0,
      aprovacoes: aprovs.count || 0,
    });
  }, []);

  useEffect(() => {
    void carregarBadges();
    const sub = supabase
      .channel("mobile-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregarBadges)
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
    };
  }, [carregarBadges]);

  if (!isMobileShellRoute(pathname)) {
    return <>{children}</>;
  }

  function voltar() {
    if (historico.length > 1) {
      const anterior = historico[historico.length - 2];
      setHistorico((prev) => prev.slice(0, -1));
      router.push(anterior);
    } else {
      router.push("/crm");
    }
  }

  /** Badge de contagem para um item de nav pelo href. */
  function badgeForHref(href: string): number {
    if (href === "/crm/leads") return badges.leads;
    if (href === "/crm/aprovacoes") return badges.aprovacoes;
    if (href.startsWith("/crm/atendimento")) return badges.chat;
    return 0;
  }

  const aprovacoesGlobais = badges.leads + badges.aprovacoes + badges.chat;
  const showBack = needsMobileSubHeader(pathname);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden" style={{ background: "#0d1117" }}>
      {/* Top bar único (sanduíche → menu em seções, igual ao desktop/onboarding) */}
      <header
        className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b px-3"
        style={{
          background: CHROME_BG,
          borderColor: CHROME_BORDER,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)",
          paddingBottom: "10px",
          minHeight: "54px",
        }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "#11241b", color: "#dCEbe2", border: `1px solid ${CHROME_BORDER}` }}
        >
          <Menu size={20} strokeWidth={2} aria-hidden />
        </button>

        {showBack && (
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar"
            className="flex h-11 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ color: ITEM_TEXT }}
          >
            <ChevronLeft size={22} strokeWidth={2} aria-hidden />
          </button>
        )}

        <h1 className="min-w-0 flex-1 truncate text-base font-bold" style={{ color: "#eaf4ee" }}>
          {mobilePageTitle(pathname)}
        </h1>

        <button
          type="button"
          onClick={() => router.push("/crm/aprovacoes")}
          aria-label="Pendências"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "#11241b", color: "#dCEbe2", border: `1px solid ${CHROME_BORDER}` }}
        >
          <Bell size={19} strokeWidth={2} aria-hidden />
          {aprovacoesGlobais > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white"
              style={{ background: "#b3261e" }}
            >
              {aprovacoesGlobais > 9 ? "9+" : aprovacoesGlobais}
            </span>
          )}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>

      {/* Drawer em seções (espelha o sidebar do desktop e o sanduíche do onboarding) */}
      <div
        className={`fixed inset-0 z-[100] flex transition-opacity duration-200 ${
          menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        aria-hidden={!menuOpen}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 border-0 p-0"
          style={{ background: "rgba(3,10,7,0.78)", backdropFilter: "blur(2px)" }}
        />
        <aside
          className={`relative flex h-full w-[min(86vw,20rem)] flex-col border-r transition-transform duration-200 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{
            background: DRAWER_BG,
            borderColor: CHROME_BORDER,
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          <div className="flex items-center justify-between gap-2 border-b px-4 py-3.5" style={{ borderColor: CHROME_BORDER }}>
            <div className="min-w-0">
              <p className="text-sm font-black tracking-tight" style={{ color: "#eaf4ee" }}>
                OBRA<span style={{ color: GOLD }}>10+</span>
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: SECTION_LABEL }}>
                Plataforma
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "#11241b", color: ITEM_TEXT, border: `1px solid ${CHROME_BORDER}` }}
            >
              <X size={18} strokeWidth={2} aria-hidden />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
            {navGroups.map((group) => (
              <div key={group.id} className="mb-3">
                <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: SECTION_LABEL }}>
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const ativo = isCrmNavPathActive(pathname, item.href);
                    const Icon = item.icon;
                    const count = badgeForHref(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex min-h-[44px] items-center gap-3 rounded-xl border-l-2 px-3 py-2 text-sm font-semibold transition-colors"
                        style={{
                          borderColor: ativo ? GOLD : "transparent",
                          background: ativo ? "rgba(0,59,38,0.38)" : "transparent",
                          color: ativo ? GOLD : ITEM_TEXT,
                        }}
                      >
                        <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {count > 0 && (
                          <span
                            className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-black"
                            style={{ background: GOLD, color: "#04150d" }}
                          >
                            {count > 9 ? "9+" : count}
                          </span>
                        )}
                        {item.navBadge && count === 0 ? (
                          <span
                            className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                            style={{ background: "#c9a24a18", color: GOLD, borderColor: "#c9a24a35" }}
                          >
                            {item.navBadge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
