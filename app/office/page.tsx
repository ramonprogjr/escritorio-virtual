"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import DecisionPanel from "@/components/office/DecisionPanel";
import LiveMessageFeed from "@/components/office/LiveMessageFeed";
import FFTAgentNode from "@/components/office/FFTAgentNode";
import FFTLeadNode from "@/components/office/FFTLeadNode";
import AnalyticsPanel from "@/components/office/AnalyticsPanel";
import { MAPA_AGENTES, CORES_AREA, TAMANHO_NIVEL, getInitials } from "@/lib/data/office-map";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Leads na área de espera + entrada (coordenadas % calibradas pelo office-map.json 1672×941)
// waiting_area nav(740,720)=44.3%,76.5%  main_entrance nav(850,840)=50.8%,89.3%
const POSICOES_LEADS = [
  { x: 40.5, y: 76.5 }, { x: 44.3, y: 76.5 }, { x: 48.0, y: 76.5 },
  { x: 40.5, y: 80.0 }, { x: 44.3, y: 80.0 }, { x: 48.0, y: 80.0 },
  { x: 44.3, y: 84.0 }, { x: 48.0, y: 84.0 },
];

interface Lead {
  id: string;
  nome: string;
  telefone?: string;
  estagio: string;
  valor_estimado: number;
  agente_responsavel?: string;
  humano_responsavel?: string;
  origem: string;
  criado_em: string;
  atualizado_em: string;
  metadata?: Record<string, unknown>;
}

interface Agente {
  agente_slug: string;
  nome: string;
  cargo: string;
  nivel: number;
  area: string;
  ativo: boolean;
}

function MobileOfficeView({ leads, agentes, metricas }: {
  leads: Lead[];
  agentes: Agente[];
  metricas: { leadsAguardando: number; aprovacoesPendentes: number; leadsHoje: number };
}) {
  const router = useRouter();
  const agentesAtivos = agentes.filter(ag => ag.ativo === true);

  return (
    <div className="flex flex-col h-full" style={{ background: "#0d1117" }}>

      {/* Header — safe-area-inset-top para não sobrepor status bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4"
        style={{
          background: "#161b22",
          borderBottom: "1px solid #30363d",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
          paddingBottom: "12px",
        }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
            style={{ background: "linear-gradient(135deg, #003b26, #005c3d)" }}>O+</div>
          <div>
            <p className="text-white font-black text-sm leading-none" style={{ letterSpacing: "0.04em" }}>OBRA10+</p>
            <p className="leading-none mt-0.5" style={{ color: "#c9a24a", fontSize: "9px", letterSpacing: "0.1em" }}>ESCRITÓRIO VIRTUAL</p>
          </div>
        </div>
        {metricas.aprovacoesPendentes > 0 && (
          <button onClick={() => router.push("/crm/aprovacoes")}
            className="px-2 py-1 rounded-full text-xs font-bold"
            style={{ background: "#b3261e", color: "white" }}>
            🔴 {metricas.aprovacoesPendentes} crítico(s)
          </button>
        )}
      </div>

      {/* EQUIPE ONLINE — grid de agentes ativos (só FFTAgentNode, sem leads) */}
      {agentesAtivos.length > 0 && (
        <div className="flex-shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: "1px solid #30363d" }}>
          <p className="text-xs font-black mb-2" style={{ color: "#484f58", letterSpacing: "0.08em" }}>
            EQUIPE ONLINE · {agentesAtivos.length}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px 6px" }}>
            {agentesAtivos.map(ag => {
              const cor = CORES_AREA[ag.area] || "#c9a24a";
              return (
                <button
                  key={ag.agente_slug}
                  onClick={() => router.push(`/crm/agentes/${ag.agente_slug}`)}
                  className="flex flex-col items-center gap-1"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <div
                    className="flex items-center justify-center font-black text-white rounded-full"
                    style={{
                      width: 52, height: 52,
                      background: `radial-gradient(circle at 35% 35%, ${cor}55, #0d1117)`,
                      border: `2px solid ${cor}`,
                      boxShadow: `0 0 12px ${cor}44`,
                      fontSize: "13px",
                      flexShrink: 0,
                    }}>
                    {getInitials(ag.cargo)}
                  </div>
                  <p
                    className="text-center w-full truncate leading-tight"
                    style={{ color: "#8b949e", fontSize: "9px" }}>
                    {ag.nome.split(" ")[0]}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Métricas rápidas */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-0"
        style={{ borderBottom: "1px solid #30363d" }}>
        {[
          { label: "Leads",     valor: leads.length,                   rota: "/crm/leads",       cor: "#c9a24a" },
          { label: "Aguard.",   valor: metricas.leadsAguardando,        rota: "/crm/atendimento", cor: metricas.leadsAguardando > 0 ? "#c9a24a" : "#8b949e" },
          { label: "Msgs",      valor: 0,                              rota: "/crm/atendimento", cor: "#8b949e" },
          { label: "Aprov.",    valor: metricas.aprovacoesPendentes,    rota: "/crm/aprovacoes",  cor: metricas.aprovacoesPendentes > 0 ? "#b3261e" : "#8b949e" },
        ].map((m, i) => (
          <button key={m.label} onClick={() => router.push(m.rota)}
            className="flex flex-col items-center py-3"
            style={{ borderRight: i < 3 ? "1px solid #30363d" : "none", background: "#161b22", border: "none", cursor: "pointer" }}>
            <p className="text-lg font-black leading-none" style={{ color: m.cor }}>{m.valor}</p>
            <p className="text-xs mt-0.5" style={{ color: "#484f58" }}>{m.label}</p>
          </button>
        ))}
      </div>

      {/* LEADS ATIVOS — lista de cards (sem bolinhas flutuantes) */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <p className="text-xs font-black mb-2" style={{ color: "#c9a24a", letterSpacing: "0.08em" }}>LEADS ATIVOS</p>
        <div className="space-y-2">
          {leads.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: "#484f58" }}>Nenhum lead ativo</p>
          ) : leads.slice(0, 6).map(lead => {
            const mins = (Date.now() - new Date(lead.atualizado_em).getTime()) / 60000;
            const cor = mins > 15 ? "#b3261e" : mins > 5 ? "#c9a24a" : "#003b26";
            const tempo = mins < 1 ? "agora" : mins < 60 ? `${Math.round(mins)}min` : `${Math.round(mins / 60)}h`;
            return (
              <button key={lead.id}
                onClick={() => router.push(`/crm/leads/${lead.id}`)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left"
                style={{ background: "#161b22", border: `1px solid #30363d`, borderLeft: `3px solid ${cor}` }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                  style={{ background: `${cor}33`, border: `1px solid ${cor}` }}>
                  {lead.nome.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-sm truncate">{lead.nome}</p>
                  <p className="text-xs truncate" style={{ color: "#484f58" }}>{lead.estagio} · {lead.origem}</p>
                </div>
                <span className="text-xs font-bold flex-shrink-0" style={{ color: cor }}>{tempo}</span>
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}

export default function OfficePage() {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState<boolean | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [metricas, setMetricas] = useState({ leadsAguardando: 0, aprovacoesPendentes: 0, leadsHoje: 0 });
  const [modoVisual, setModoVisual] = useState<"escritorio" | "analytics">("escritorio");
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const carregar = useCallback(async () => {
    const [l, a, aprov] = await Promise.all([
      supabase.from("hub_leads_crm").select("*")
        .not("estagio", "in", '("ganho","perdido","arquivado")')
        .order("atualizado_em", { ascending: false }).limit(20),
      supabase.from("hub_agente_identidade").select("agente_slug, nome, cargo, nivel, area, ativo")
        .order("nivel"),
      supabase.from("hub_aprovacoes").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    ]);

    if (l.data) setLeads(l.data as Lead[]);
    if (a.data) setAgentes(a.data as Agente[]);
    const hoje = new Date().toDateString();
    setMetricas({
      leadsAguardando: (l.data || []).filter(x => !x.humano_responsavel).length,
      aprovacoesPendentes: aprov.count || 0,
      leadsHoje: (l.data || []).filter(x => new Date(x.criado_em).toDateString() === hoje).length,
    });
  }, []);

  useEffect(() => {
    carregar();
    const sub = supabase.channel("office-fft")
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_leads_crm" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "hub_aprovacoes" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [carregar]);

  function toggleModo(modo: "escritorio" | "analytics") {
    if (modo === modoVisual) return;
    setTransitioning(true);
    setTimeout(() => { setModoVisual(modo); setTransitioning(false); }, 200);
  }

  if (isMobile === null) return null;
  if (isMobile) return <MobileOfficeView leads={leads} agentes={agentes} metricas={metricas} />;

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── SIDEBAR ESQUERDA ── */}
      <div className="flex-shrink-0 flex flex-col" style={{ width: "200px", background: "#161b22", borderRight: "1px solid #30363d" }}>

        {/* Logo */}
        <div className="px-4 py-4" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-white text-sm"
              style={{ background: "linear-gradient(135deg, #003b26, #005c3d)", boxShadow: "0 0 12px rgba(0,59,38,0.5)" }}>
              O+
            </div>
            <div>
              <p className="text-white font-black text-sm leading-none" style={{ letterSpacing: "0.05em" }}>OBRA10+</p>
              <p className="leading-none" style={{ color: "#c9a24a", fontSize: "9px", letterSpacing: "0.1em" }}>ESCRITÓRIO VIRTUAL</p>
            </div>
          </div>
        </div>

        {/* Modo toggle */}
        <div className="p-3" style={{ borderBottom: "1px solid #30363d" }}>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #30363d" }}>
            {([
              { id: "escritorio", label: "🏢 Office" },
              { id: "analytics", label: "📊 Analytics" },
            ] as const).map(m => (
              <button key={m.id} onClick={() => toggleModo(m.id)}
                className="flex-1 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: modoVisual === m.id ? "#003b26" : "transparent",
                  color: modoVisual === m.id ? "#c9a24a" : "#484f58",
                  border: "none", cursor: "pointer",
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-2 p-3" style={{ borderBottom: "1px solid #30363d" }}>
          <button onClick={() => router.push("/crm/leads")} className="rounded-lg p-2 text-left hex-bg"
            style={{
              background: metricas.leadsAguardando > 0 ? "#c9a24a11" : "#21262d",
              border: `1px solid ${metricas.leadsAguardando > 0 ? "#c9a24a44" : "#30363d"}`,
            }}>
            <p className="text-xs" style={{ color: "#484f58" }}>Aguard.</p>
            <p className="font-black text-xl leading-none" style={{ color: metricas.leadsAguardando > 0 ? "#c9a24a" : "#e6edf3" }}>
              {metricas.leadsAguardando}
            </p>
          </button>
          <button onClick={() => router.push("/crm/aprovacoes")} className="rounded-lg p-2 text-left"
            style={{
              background: metricas.aprovacoesPendentes > 0 ? "#b3261e11" : "#21262d",
              border: `1px solid ${metricas.aprovacoesPendentes > 0 ? "#b3261e44" : "#30363d"}`,
            }}>
            <p className="text-xs" style={{ color: "#484f58" }}>Aprov.</p>
            <p className="font-black text-xl leading-none" style={{ color: metricas.aprovacoesPendentes > 0 ? "#b3261e" : "#e6edf3" }}>
              {metricas.aprovacoesPendentes}
            </p>
          </button>
        </div>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto py-2">
          {[
            { secao: "OPERAÇÃO", items: [
              { label: "Dashboard",    icon: "⚡", rota: "/crm" },
              { label: "Pipeline",     icon: "👥", rota: "/crm/leads" },
              { label: "Atendimento",  icon: "💬", rota: "/crm/atendimento" },
            ]},
            { secao: "PARCEIROS", items: [
              { label: "Homologação",  icon: "🤝", rota: "/crm/parceiros" },
              { label: "Convites",     icon: "📨", rota: "/crm/parceiros/novo" },
            ]},
            { secao: "SISTEMA", items: [
              { label: "Agentes",      icon: "🤖", rota: "/crm/agentes" },
              { label: "Ciclos IA",    icon: "⚙️", rota: "/crm/ciclos" },
              { label: "Notificações", icon: "🔔", rota: "/crm/contatos" },
            ]},
          ].map(grupo => (
            <div key={grupo.secao} className="mb-3">
              <p className="px-4 py-1 font-black tracking-widest" style={{ color: "#30363d", fontSize: "9px" }}>
                {grupo.secao}
              </p>
              {grupo.items.map(item => (
                <button key={item.rota} onClick={() => router.push(item.rota)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left transition-all hover:bg-white hover:bg-opacity-5"
                  style={{ color: "#8b949e", border: "none", cursor: "pointer", background: "transparent" }}>
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="p-3" style={{ borderTop: "1px solid #30363d" }}>
          <button onClick={() => router.push("/crm")} className="w-full py-2 rounded-xl text-xs font-bold"
            style={{ background: "#003b26", color: "#c9a24a", letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
            CRM COMPLETO →
          </button>
        </div>
      </div>

      {/* ── ÁREA CENTRAL ── */}
      <div className="flex-1 relative overflow-hidden">

        {/* MODO ESCRITÓRIO */}
        {modoVisual === "escritorio" && (
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
            style={{ opacity: transitioning ? 0 : 1, transition: "opacity 0.2s ease", animation: !transitioning ? "office-enter 0.3s ease" : "none", background: "#0a0a0a" }}>

            {/* Container com aspect-ratio idêntico ao office-bg.png (1672×941).
                Garante que left/top em % batem exatamente com as coordenadas do JSON. */}
            <div className="relative" style={{ aspectRatio: "1672 / 941", width: "100%", maxHeight: "100%" }}>
              <img
                src="/sprites/office-bg.png"
                className="absolute inset-0 w-full h-full"
                style={{ objectFit: "fill" }}
                loading="eager"
                alt=""
              />

              {/* Agentes posicionados por cima do escritório 3D — coords calibradas pelo office-map.json */}
              {agentes.filter(a => a.ativo === true).map(agente => {
                const pos = MAPA_AGENTES[agente.agente_slug];
                if (!pos) return null;
                const leadsDoAgente = leads.filter(l => l.agente_responsavel === agente.agente_slug).length;
                const cor = CORES_AREA[agente.area] || "#c9a24a";
                const tamanho = TAMANHO_NIVEL[agente.nivel] || 24;
                return (
                  <FFTAgentNode
                    key={agente.agente_slug}
                    slug={agente.agente_slug}
                    nome={agente.cargo}
                    cargo={agente.cargo}
                    x={pos.x}
                    y={pos.y}
                    leadsAtivos={leadsDoAgente}
                    status={leadsDoAgente > 3 ? "critico" : leadsDoAgente > 0 ? "ocupado" : "ativo"}
                    cor={cor}
                    tamanho={tamanho}
                    ativoDb={agente.ativo}
                    iniciais={getInitials(agente.cargo)}
                  />
                );
              })}

              {/* Leads na área de espera / entrada */}
              {leads.slice(0, 8).map((lead, idx) => {
                const pos = POSICOES_LEADS[idx];
                if (!pos) return null;
                return (
                  <FFTLeadNode
                    key={lead.id}
                    id={lead.id}
                    nome={lead.nome}
                    mercado={(lead.metadata?.mercado as string) || "geral"}
                    estagio={lead.estagio}
                    valor={lead.valor_estimado}
                    x={pos.x}
                    y={pos.y}
                    atualizadoEm={lead.atualizado_em}
                    onClick={() => setLeadSelecionado(lead)}
                  />
                );
              })}

              {leads.length === 0 && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                  <div className="fft-panel px-6 py-4 text-center">
                    <p className="text-white font-bold mb-1" style={{ letterSpacing: "0.1em" }}>ESCRITÓRIO TRANQUILO</p>
                    <p className="text-xs" style={{ color: "#484f58" }}>Nenhum lead ativo no momento</p>
                  </div>
                </div>
              )}

              <LiveMessageFeed />
            </div>
          </div>
        )}

        {/* MODO ANALYTICS */}
        {modoVisual === "analytics" && (
          <div className="absolute inset-0 overflow-hidden"
            style={{ opacity: transitioning ? 0 : 1, transition: "opacity 0.2s ease" }}>
            <AnalyticsPanel />
          </div>
        )}

        {/* Modal lead selecionado */}
        {leadSelecionado && (
          <div className="absolute inset-0 flex items-center justify-center z-40"
            style={{ background: "rgba(0,0,0,0.7)" }}
            onClick={() => setLeadSelecionado(null)}>
            <div className="fft-panel p-4 w-72" onClick={e => e.stopPropagation()}>
              {/* Ornamentos de canto */}
              {[
                { top: 8, left: 8, borderT: true, borderL: true },
                { top: 8, right: 8, borderT: true, borderR: true },
                { bottom: 8, left: 8, borderB: true, borderL: true },
                { bottom: 8, right: 8, borderB: true, borderR: true },
              ].map((o, i) => (
                <div key={i} className="absolute"
                  style={{
                    width: 12, height: 12,
                    top: o.top, bottom: o.bottom, left: o.left, right: o.right,
                    borderTop: o.borderT ? "1px solid #c9a24a" : undefined,
                    borderBottom: o.borderB ? "1px solid #c9a24a" : undefined,
                    borderLeft: o.borderL ? "1px solid #c9a24a" : undefined,
                    borderRight: o.borderR ? "1px solid #c9a24a" : undefined,
                  }} />
              ))}

              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-bold" style={{ letterSpacing: "0.05em" }}>
                  {leadSelecionado.nome.toUpperCase()}
                </h3>
                <button onClick={() => setLeadSelecionado(null)} style={{ color: "#484f58", background: "none", border: "none", cursor: "pointer" }}>✕</button>
              </div>

              {/* Separador FFT */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px" style={{ background: "#c9a24a44" }} />
                <div className="w-1.5 h-1.5 rotate-45" style={{ background: "#c9a24a" }} />
                <div className="flex-1 h-px" style={{ background: "#c9a24a44" }} />
              </div>

              <div className="space-y-1.5 mb-4">
                {[
                  { label: "ESTÁGIO", value: leadSelecionado.estagio },
                  { label: "ORIGEM",  value: leadSelecionado.origem },
                  { label: "AGENTE",  value: leadSelecionado.agente_responsavel || "—" },
                  { label: "MERCADO", value: (leadSelecionado.metadata?.mercado as string) || "geral" },
                ].map(f => (
                  <div key={f.label} className="flex justify-between">
                    <span className="text-xs tracking-wider" style={{ color: "#484f58" }}>{f.label}</span>
                    <span className="text-xs font-bold" style={{ color: "#c9a24a" }}>{f.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { router.push(`/crm/leads/${leadSelecionado.id}`); setLeadSelecionado(null); }}
                  className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #003b26, #005c3d)", boxShadow: "0 0 10px rgba(0,59,38,0.4)", letterSpacing: "0.05em", border: "none", cursor: "pointer" }}>
                  💬 ATENDER
                </button>
                <button onClick={() => setLeadSelecionado(null)}
                  className="px-3 py-2 rounded-lg text-xs"
                  style={{ background: "#21262d", color: "#8b949e", border: "none", cursor: "pointer" }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── DECISION PANEL DIREITO ── */}
      <div className="flex-shrink-0" style={{ width: "290px", borderLeft: "1px solid #30363d" }}>
        <DecisionPanel />
      </div>
    </div>
  );
}
