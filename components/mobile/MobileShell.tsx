"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props { children: React.ReactNode; }

const ABAS = [
  { id: "office", label: "Office", icon: "🏢", rota: "/office" },
  { id: "leads", label: "Leads", icon: "👥", rota: "/crm/leads" },
  { id: "chat", label: "Chat", icon: "💬", rota: "/crm/atendimento" },
  { id: "aprovacoes", label: "Aprov.", icon: "✅", rota: "/crm/aprovacoes" },
  { id: "agentes", label: "Agentes", icon: "🤖", rota: "/crm/agentes" },
];

function abaAtivaPorRota(pathname: string): string {
  if (pathname === "/office") return "office";
  if (pathname.startsWith("/crm/leads")) return "leads";
  if (pathname.startsWith("/crm/atendimento")) return "chat";
  if (pathname.startsWith("/crm/aprovacoes")) return "aprovacoes";
  if (pathname.startsWith("/crm/agentes")) return "agentes";
  return "office";
}

export default function MobileShell({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [badges, setBadges] = useState({ leads: 0, chat: 0, aprovacoes: 0 });
  const [historico, setHistorico] = useState<string[]>([]);
  const abaAtiva = abaAtivaPorRota(pathname);

  useEffect(() => {
    setHistorico(prev => {
      if (prev[prev.length - 1] === pathname) return prev;
      return [...prev.slice(-9), pathname];
    });
  }, [pathname]);

  const carregarBadges = useCallback(async () => {
    const [leads, msgs, aprovs] = await Promise.all([
      supabase.from("hub_leads_crm")
        .select("id", { count: "exact", head: true })
        .not("estagio", "in", '("ganho","perdido")')
        .is("humano_responsavel", null),
      supabase.from("hub_fila_mensagens")
        .select("id", { count: "exact", head: true })
        .eq("direcao", "entrada")
        .eq("status", "pendente"),
      supabase.from("hub_aprovacoes")
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
    carregarBadges();
    const sub = supabase.channel("mobile-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_fila_mensagens" }, carregarBadges)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregarBadges)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregarBadges]);

  function voltar() {
    if (historico.length > 1) {
      const anterior = historico[historico.length - 2];
      setHistorico(prev => prev.slice(0, -1));
      router.push(anterior);
    } else {
      router.push("/office");
    }
  }

  function getBadge(abaId: string): number {
    if (abaId === "leads") return badges.leads;
    if (abaId === "chat") return badges.chat;
    if (abaId === "aprovacoes") return badges.aprovacoes;
    return 0;
  }

  function getTitulo(): string {
    if (pathname === "/office") return "Escritório";
    if (pathname === "/crm/leads") return "Pipeline";
    if (pathname.startsWith("/crm/leads/")) return "Conversa";
    if (pathname === "/crm/atendimento") return "Atendimento";
    if (pathname === "/crm/aprovacoes") return "Aprovações";
    if (pathname === "/crm/agentes") return "Agentes";
    if (pathname.startsWith("/crm/agentes/")) return "Agente";
    if (pathname === "/crm/parceiros") return "Parceiros";
    if (pathname === "/crm/ciclos") return "Ciclos IA";
    if (pathname === "/crm/kpis") return "KPIs";
    if (pathname === "/crm") return "Dashboard";
    return "Obra10+";
  }

  if (pathname.startsWith("/parceiro/")) return <>{children}</>;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0d1117" }}>
      {pathname !== "/office" && (
        <div className="flex items-center gap-3 px-4 flex-shrink-0"
          style={{
            background: "#161b22",
            borderBottom: "1px solid #30363d",
            paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
            paddingBottom: "12px",
            minHeight: "56px",
          }}>
          <button onClick={voltar}
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#21262d", border: "none", cursor: "pointer" }}>
            <span className="text-white text-lg">←</span>
          </button>
          <h1 className="text-white font-bold text-base flex-1">{getTitulo()}</h1>
          {pathname === "/crm/leads" && (
            <button onClick={() => router.push("/crm/leads/novo")}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#003b26", border: "none", cursor: "pointer" }}>
              <span style={{ color: "#c9a24a", fontSize: "1.2rem", fontWeight: 900 }}>+</span>
            </button>
          )}
          {pathname === "/crm/agentes" && (
            <button onClick={() => router.push("/crm/agentes/novo")}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#003b26", border: "none", cursor: "pointer" }}>
              <span style={{ color: "#c9a24a", fontSize: "1.2rem", fontWeight: 900 }}>+</span>
            </button>
          )}
          {pathname === "/crm/parceiros" && (
            <button onClick={() => router.push("/crm/parceiros/novo")}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "#003b26", border: "none", cursor: "pointer" }}>
              <span style={{ color: "#c9a24a", fontSize: "1.2rem", fontWeight: 900 }}>+</span>
            </button>
          )}
        </div>
      )}

      <div className="flex-1">
        {children}
      </div>

      <div className="flex-shrink-0"
        style={{
          position: "sticky", bottom: 0, zIndex: 10,
          background: "#161b22",
          borderTop: "1px solid #30363d",
          paddingBottom: "env(safe-area-inset-bottom, 8px)",
        }}>
        <div className="flex">
          {ABAS.map(aba => {
            const ativo = abaAtiva === aba.id;
            const badge = getBadge(aba.id);
            return (
              <button key={aba.id} onClick={() => router.push(aba.rota)}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors"
                style={{ color: ativo ? "#c9a24a" : "#484f58", background: "none", border: "none", cursor: "pointer" }}>
                <div className="relative">
                  <span className="text-xl">{aba.icon}</span>
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center font-black"
                      style={{ background: "#b3261e", color: "white", fontSize: "9px" }}>
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium">{aba.label}</span>
                {ativo && <div className="w-1 h-1 rounded-full" style={{ background: "#c9a24a" }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
