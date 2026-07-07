"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useLeadsParados } from "@/hooks/useLeadsParados";

/** rf-alerta-parado — leads sem próxima ação (parados). Reusa o hook compartilhado. */
export function CrmLeadsParados() {
  const { leads, loading } = useLeadsParados(8);

  if (loading) {
    return (
      <div className="h-full animate-pulse rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
        <div className="mb-3 h-4 w-40 rounded bg-[#16271e]" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-2 h-10 rounded-xl bg-[#16271e]" />
        ))}
      </div>
    );
  }

  return (
    <section className="h-full rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="m-0 flex items-center gap-1.5 text-sm font-bold tracking-tight text-[#e6edf3]">
          <AlertTriangle className="h-4 w-4 text-[#f59e0b]" />
          Leads parados
          {leads.length > 0 ? (
            <span className="rounded-full bg-[#3a2a0a] px-1.5 py-0.5 text-xs font-bold text-[#f59e0b]">
              {leads.length}
            </span>
          ) : null}
        </h2>
        <Link
          href="/crm/leads"
          className="rounded-lg border border-[#1d3a2c] px-2 py-1 text-xs font-bold text-[#c9a24a] transition-colors hover:border-[#c9a24a55]"
        >
          Ver todos
        </Link>
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-[#8b949e]">Nenhum lead parado — todos com próxima ação. 🎯</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {leads.map((l) => (
            <li key={l.id}>
              <Link
                href={`/crm/leads/${l.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-transparent px-2.5 py-2 transition-colors hover:border-[#1d3a2c] hover:bg-[#0f1520]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e6edf3]">
                    {l.nome || `Lead ${l.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-[#6e7681]">
                    sem próxima ação
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {l.dias_parado != null ? (
                    <span
                      className={`text-xs font-bold ${l.dias_parado >= 7 ? "text-[#f85149]" : "text-[#f59e0b]"}`}
                    >
                      {l.dias_parado}d
                    </span>
                  ) : null}
                  <ArrowRight className="h-4 w-4 text-[#484f58]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
