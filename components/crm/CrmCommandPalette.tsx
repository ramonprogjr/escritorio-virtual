"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import type { CrmNavGroup } from "@/lib/crm-nav-groups";

type FlatItem = { href: string; label: string; group: string; Icon: CrmNavGroup["items"][number]["icon"] };

/**
 * ⌘K / Ctrl+K — paleta "ir para…". Recebe os grupos JÁ filtrados por papel, então só
 * navega para onde o usuário pode ir. Teclado: ↑/↓ move, Enter abre, Esc fecha.
 */
export function CrmCommandPalette({ groups }: { groups: CrmNavGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const items = useMemo<FlatItem[]>(
    () => groups.flatMap(g => g.items.map(i => ({ href: i.href, label: i.label, group: g.label, Icon: i.icon }))),
    [groups]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q));
  }, [items, query]);

  // Abrir/fechar com ⌘K / Ctrl+K (global).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setActive(a => Math.min(a, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  const go = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") return setOpen(false);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(a => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[active];
      if (it) go(it.href);
    }
  }

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Ir para"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default border-0 bg-[#0d1117]/80 p-0 backdrop-blur-sm"
      />
      <div
        className="relative z-10 flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-[#2b3544]"
        style={{ background: "#0f1520", boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
      >
        <div className="flex items-center gap-2 border-b border-[#2b3544] px-3.5 py-3">
          <Search size={18} strokeWidth={1.75} className="shrink-0 text-[#6e7681]" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Ir para… (página, módulo)"
            aria-label="Buscar destino"
            className="w-full bg-transparent text-[15px] text-[#e6edf3] placeholder:text-[#6e7681] focus:outline-none"
          />
          <kbd className="shrink-0 rounded-md border border-[#2b3544] bg-[#161b22] px-1.5 py-0.5 text-[10px] font-bold text-[#8b949e]">
            ESC
          </kbd>
        </div>
        <ul ref={listRef} className="m-0 max-h-[52vh] list-none overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[#6e7681]">Nada encontrado.</li>
          ) : (
            filtered.map((it, idx) => {
              const isActive = idx === active;
              const Icon = it.Icon;
              return (
                <li key={it.href} data-idx={idx}>
                  <button
                    type="button"
                    onMouseMove={() => setActive(idx)}
                    onClick={() => go(it.href)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      isActive ? "bg-[#1a2332]" : "hover:bg-[#1a2332]/60"
                    }`}
                    style={{ cursor: "pointer", border: "none" }}
                  >
                    <Icon
                      size={17}
                      strokeWidth={1.5}
                      className={`shrink-0 ${isActive ? "text-[#c9a24a]" : "text-[#8b949e]"}`}
                      aria-hidden
                    />
                    <span className={`flex-1 truncate text-sm font-medium ${isActive ? "text-[#e6edf3]" : "text-[#c7d5e0]"}`}>
                      {it.label}
                    </span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#6e7681]">{it.group}</span>
                    {isActive ? (
                      <CornerDownLeft size={14} strokeWidth={2} className="shrink-0 text-[#6e7681]" aria-hidden />
                    ) : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
