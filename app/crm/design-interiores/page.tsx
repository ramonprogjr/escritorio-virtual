"use client";

import Link from "next/link";
import { Paintbrush, ArrowLeft } from "lucide-react";

export default function DesignInterioresPage() {
  return (
    <div className="min-h-full bg-[#0d1117] p-6">
      <Link
        href="/crm/projetos"
        className="mb-6 inline-flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
      >
        <ArrowLeft size={14} />
        Voltar para Projetos
      </Link>

      <div className="mx-auto max-w-lg mt-16 rounded-2xl border border-[#30363d] bg-[#161b22] p-10 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#21262d]">
          <Paintbrush size={32} strokeWidth={1.5} className="text-[#c9a24a]" aria-hidden />
        </div>
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#c9a24a]/30 bg-[#c9a24a]/10 px-3 py-1 text-xs font-semibold text-[#c9a24a]">
          Em breve
        </div>
        <h1 className="mt-2 text-xl font-bold text-[#e6edf3]">Design de Interiores</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#8b949e]">
          Módulo para gestão de projetos de design de interiores — briefings,
          moodboards, paletas e acompanhamento de execução. Enquanto finalizamos
          esta área, utilize{" "}
          <Link href="/crm/projetos" className="font-semibold text-[#c9a24a] hover:underline">
            Projetos
          </Link>{" "}
          para registar seus projetos de arquitetura e design.
        </p>
        <Link
          href="/crm/projetos"
          className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#c9a24a] px-5 text-sm font-bold text-[#003b26] hover:bg-[#b8912f] transition-colors"
        >
          Ir para Projetos
        </Link>
      </div>
    </div>
  );
}
