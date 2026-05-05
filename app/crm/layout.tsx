"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/crm",              label: "Dashboard",   icon: "📊" },
  { href: "/crm/leads",        label: "Leads",       icon: "👥" },
  { href: "/crm/atendimento",  label: "Atendimento", icon: "💬" },
  { href: "/crm/aprovacoes",   label: "Aprovações",  icon: "✅" },
  { href: "/crm/agentes",      label: "Agentes",     icon: "🤖", extra: { href: "/crm/agentes/novo", label: "Novo Agente", icon: "+" } },
  { href: "/crm/kpis",         label: "KPIs",        icon: "📈" },
  { href: "/crm/parceiros",    label: "Parceiros",   icon: "🤝" },
  { href: "/crm/relatorios",   label: "Relatórios",  icon: "📋" },
  { href: "/crm/configuracoes",label: "Config",      icon: "⚙️" },
];

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-16 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col items-center py-4 gap-1">
        <Link href="/office"
          className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center text-white font-black text-xs mb-4 hover:bg-orange-500 transition-colors"
          title="Escritório Virtual">
          O+
        </Link>
        {NAV.map(item => {
          const active = item.href === "/crm" ? pathname === "/crm" : pathname.startsWith(item.href);
          return (
            <div key={item.href} className="relative group">
              <Link href={item.href} title={item.label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-colors ${active ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-800 hover:text-white"}`}>
                {item.icon}
              </Link>
              {"extra" in item && item.extra && (
                <Link href={item.extra.href} title={item.extra.label}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#c9a24a] flex items-center justify-center text-[9px] font-black text-[#003b26] opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.extra.icon}
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {/* CONTEÚDO */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
