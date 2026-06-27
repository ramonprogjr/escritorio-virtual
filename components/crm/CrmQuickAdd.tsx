"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Users, Briefcase, User, Building2, type LucideIcon } from "lucide-react";
import { crmPodeVerRota } from "@/lib/crm/crm-permissoes";

/**
 * QuickAdd (FAB) — botão flutuante "+" com criação rápida (Onda U2, Click-and-Go).
 * Cada ação faz deep-link para a tela que JÁ tem o criador, abrindo-o via `?novo=...`
 * (leads/negocios `?novo=1`, cadastro `?novo=pf|pj`). Não duplica formulário — reaproveita
 * os criadores existentes. Filtra ações pelo MESMO guard de rota do menu (`crmPodeVerRota`).
 */
type QuickAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Destino com deep-link que abre o criador. */
  href: string;
  /** Rota-base para checagem de permissão (mesmo guard do menu). */
  rota: string;
};

const ACTIONS: QuickAction[] = [
  { key: "lead", label: "Lead", icon: Users, href: "/crm/leads?novo=1", rota: "/crm/leads" },
  { key: "negocio", label: "Negócio", icon: Briefcase, href: "/crm/negocios?novo=1", rota: "/crm/negocios" },
  { key: "pessoa", label: "Pessoa", icon: User, href: "/crm/cadastro?novo=pf", rota: "/crm/cadastro" },
  { key: "empresa", label: "Empresa", icon: Building2, href: "/crm/cadastro?novo=pj", rota: "/crm/cadastro" },
];

export function CrmQuickAdd({ role }: { role: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const actions = ACTIONS.filter((a) => crmPodeVerRota(role, a.rota));

  // Esconde o FAB quando há um sideover/modal aberto, para não sobrepor o botão de
  // ação (Criar/Guardar) do painel — evita o clique cair no FAB.
  useEffect(() => {
    const check = () =>
      setModalAberto(Boolean(document.querySelector('[aria-modal="true"], [role="dialog"]')));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal", "role"],
    });
    return () => obs.disconnect();
  }, []);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  // Fechar com Esc e clique-fora.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (actions.length === 0 || modalAberto) return null;

  return (
    <div
      ref={rootRef}
      className="fixed bottom-20 right-4 z-[90] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6"
    >
      {open ? (
        <div className="flex flex-col items-end gap-2" role="menu" aria-label="Criar">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                type="button"
                role="menuitem"
                onClick={() => go(a.href)}
                className="flex items-center gap-2.5 rounded-full border border-[#1d3a2c] bg-[#0f1d16] py-2 pl-3 pr-4 text-sm font-semibold text-[#e6edf3] shadow-lg transition-colors hover:border-[#c9a24a] hover:text-[#e0b86a]"
                style={{ cursor: "pointer" }}
              >
                <Icon size={16} strokeWidth={1.75} className="text-[#c9a24a]" aria-hidden />
                {a.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Fechar menu criar" : "Criar"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform active:scale-95"
        style={{ background: "#c9a24a", color: "#003b26", cursor: "pointer", border: "none" }}
      >
        {open ? (
          <X size={24} strokeWidth={2.25} aria-hidden />
        ) : (
          <Plus size={26} strokeWidth={2.25} aria-hidden />
        )}
      </button>
    </div>
  );
}
