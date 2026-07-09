"use client";

import Link from "next/link";
import { CalendarClock, Repeat } from "lucide-react";

/**
 * Fecha o buraco de navegação apontado pela auditoria de edição de agente: hoje a ficha NÃO tem nenhum
 * link para Follow-up (/crm/configuracoes) nem Ciclos (/crm/ciclos) — o dono tem que caçar. Card discreto
 * com deep-links. Aditivo, todos os tipos de agente.
 */
export function SecaoAcompanhamento({ slug }: { slug: string }) {
  const itens = [
    {
      href: "/crm/configuracoes",
      icon: <CalendarClock size={16} aria-hidden />,
      titulo: "Follow-up",
      desc: "Régua de retomada automática dos contatos.",
    },
    {
      href: `/crm/ciclos?agente=${encodeURIComponent(slug)}`,
      icon: <Repeat size={16} aria-hidden />,
      titulo: "Ciclos",
      desc: "Rotinas e execuções agendadas do agente.",
    },
  ];
  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <h3 className="m-0 mb-3 text-sm font-semibold text-obra-texto">Acompanhamento</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {itens.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className="flex items-start gap-2.5 rounded-lg border border-obra-borda bg-obra-dark p-3 transition-colors hover:border-obra-dourado"
          >
            <span className="mt-0.5 text-obra-dourado">{it.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-obra-texto">{it.titulo}</span>
              <span className="block text-[11px] text-obra-texto-2">{it.desc}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
