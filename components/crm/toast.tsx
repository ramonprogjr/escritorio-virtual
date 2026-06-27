"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

/**
 * Sistema de toast global — store singleton + viewport.
 *
 * Por quê store em vez de Context: o layout do CRM tem DUAS árvores (mobile e
 * desktop) e o root layout é Server Component. Um store-módulo + `<ToastViewport/>`
 * montado uma vez no root cobre o app inteiro, e `toast.*` é importável em
 * qualquer client component sem plumbing de provider.
 *
 * Uso:
 *   import { toast } from "@/components/crm/toast";
 *   toast.success("Salvo");
 *   toast.error("Falha ao salvar");
 */

export type ToastKind = "success" | "error" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  /** ms até auto-dispensar (0 = não dispensa sozinho) */
  duration: number;
};

type Listener = () => void;

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  // Nova referência de array para o useSyncExternalStore detectar a mudança.
  items = items.slice();
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ToastItem[] {
  return items;
}

function dismiss(id: number) {
  const t = timers.get(id);
  if (t) {
    clearTimeout(t);
    timers.delete(id);
  }
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return;
  items.splice(idx, 1);
  emit();
}

function push(kind: ToastKind, message: string, duration: number): number {
  const id = nextId++;
  items.push({ id, kind, message, duration });
  emit();
  if (duration > 0 && typeof window !== "undefined") {
    timers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
  }
  return id;
}

export const toast = {
  success: (message: string, duration = 3200) => push("success", message, duration),
  error: (message: string, duration = 5200) => push("error", message, duration),
  info: (message: string, duration = 3600) => push("info", message, duration),
  dismiss,
};

const KIND_STYLE: Record<
  ToastKind,
  { bg: string; border: string; text: string; Icon: typeof CheckCircle2 }
> = {
  success: { bg: "#0d1a13", border: "#2ea04366", text: "#3fb950", Icon: CheckCircle2 },
  error: { bg: "#1a0a0a", border: "#f8514966", text: "#ff7b72", Icon: AlertTriangle },
  info: { bg: "#0f1d16", border: "#c9a24a55", text: "#e0b86a", Icon: Info },
};

function ToastCard({ item }: { item: ToastItem }) {
  const [shown, setShown] = useState(false);
  const style = KIND_STYLE[item.kind];
  const Icon = style.Icon;

  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  return (
    <div
      role="status"
      aria-live={item.kind === "error" ? "assertive" : "polite"}
      className="pointer-events-auto flex w-[min(92vw,22rem)] items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-2xl transition-all duration-200 ease-out"
      style={{
        background: style.bg,
        borderColor: style.border,
        boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(8px)",
      }}
    >
      <Icon size={18} strokeWidth={2} aria-hidden style={{ color: style.text, flexShrink: 0, marginTop: 1 }} />
      <p className="min-w-0 flex-1 text-sm font-medium leading-snug" style={{ color: "#e6edf3" }}>
        {item.message}
      </p>
      <button
        type="button"
        onClick={() => toast.dismiss(item.id)}
        aria-label="Fechar"
        className="flex-shrink-0 rounded-md p-0.5 transition-colors hover:bg-white/10"
        style={{ color: "#8b949e", cursor: "pointer" }}
      >
        <X size={15} strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[200] flex flex-col items-center gap-2 px-3"
      style={{
        paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
