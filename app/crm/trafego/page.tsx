"use client";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import Link from "next/link";

type Campanha = {
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  cpc: number;
  ctr: number;
  conversions: number;
};

const PERIODOS = [
  { label: "7 dias", value: "7d" },
  { label: "14 dias", value: "14d" },
  { label: "30 dias", value: "30d" },
];

function moeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(v);
}

function num(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

export default function TrafegoPage() {
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const [periodo, setPeriodo] = useState("7d");
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErro(null);
    fetch(`/api/windsor/campanhas?periodo=${periodo}`, { headers: internalApiHeaders() })
      .then(async (r) => {
        // Tráfego da rede = dado global → owner-only (decisão do dono). 403 vira aviso amigável.
        if (r.status === 403) {
          setErro("Tráfego da rede — disponível apenas para o administrador da rede.");
          setCampanhas([]);
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (!d) return;
        if (d.error) { setErro(d.error); setCampanhas([]); }
        else setCampanhas(Array.isArray(d) ? d : []);
      })
      .catch(() => setErro("Erro ao conectar com Windsor.ai"))
      .finally(() => setLoading(false));
  }, [periodo]);

  const totalGasto = campanhas.reduce((s, c) => s + c.spend, 0);
  const totalCliques = campanhas.reduce((s, c) => s + c.clicks, 0);
  const totalConversoes = campanhas.reduce((s, c) => s + (c.conversions || 0), 0);
  const cpcMedio = totalCliques > 0 ? totalGasto / totalCliques : 0;

  const kpis = [
    { label: "Gasto Total", value: moeda(totalGasto), cor: "#EF4444" },
    { label: "Cliques", value: num(totalCliques), cor: "#c9a24a" },
    { label: "CPC Médio", value: moeda(cpcMedio), cor: "#d6a129" },
    { label: "Conversões", value: String(totalConversoes), cor: "#22C55E" },
  ];

  const periodoControls = (
    <div className="flex rounded-lg p-0.5" style={{ background: "#16271e" }}>
      {PERIODOS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => setPeriodo(p.value)}
          className="min-h-11 flex-1 rounded-md px-3 py-2 text-xs font-bold transition-colors md:min-h-0 md:flex-none md:py-1.5"
          style={{
            background: periodo === p.value ? "#1d3a2c" : "transparent",
            color: periodo === p.value ? "#e6edf3" : "#8b949e",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({ path: pathname, actions: periodoControls });
    return () => setSlot(null);
  }, [pathname, setSlot, periodo, isMobile]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:h-screen" style={{ background: "#0a140f" }}>
      {isMobile && (
        <div className="shrink-0 space-y-2 border-b border-[#1d3a2c] px-3 py-3">
          <h1 className="text-base font-bold text-[#e6edf3]">Marketing</h1>
          {periodoControls}
        </div>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-px flex-shrink-0 md:grid-cols-4" style={{ background: "#16271e" }}>
        {kpis.map(k => (
          <div key={k.label} className="px-5 py-3" style={{ background: "#0a140f" }}>
            <p className="text-xs mb-0.5" style={{ color: "#8b949e" }}>{k.label}</p>
            <p className="font-black text-lg" style={{ color: loading ? "#484f58" : k.cor }}>{loading ? "—" : k.value}</p>
          </div>
        ))}
      </div>

      {/* Campanhas */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <ul className="space-y-3" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <li
                key={i}
                className="animate-pulse rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4"
              >
                <div className="mb-3 h-3.5 w-2/5 rounded bg-[#16271e]" />
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j}>
                      <div className="mb-1.5 h-2.5 w-12 rounded bg-[#16271e]" />
                      <div className="h-3 w-16 rounded bg-[#16271e]" />
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && erro && (
          <div className="rounded-xl p-6 text-center" style={{ background: "#1a0a0a", border: "1px solid #4a1a1a" }}>
            <p className="text-sm mb-1" style={{ color: "#EF4444" }}>Campanhas indisponíveis</p>
            <p className="text-xs" style={{ color: "#8b949e" }}>{erro}</p>
            <Link href="/crm/integracoes" className="mt-4 inline-block min-h-11 rounded-lg bg-[#c9a24a] px-4 py-2.5 text-xs font-bold text-[#003b26]">
              Configurar em Integrações
            </Link>
          </div>
        )}

        {!loading && !erro && campanhas.length === 0 && (
          <div className="rounded-xl p-8 text-center" style={{ background: "#0f1d16", border: "1px solid #1d3a2c" }}>
            <p className="text-4xl mb-3">📡</p>
            <p className="font-bold mb-1" style={{ color: "#e6edf3" }}>Nenhuma campanha encontrada</p>
            <p className="text-xs" style={{ color: "#8b949e" }}>Conecte suas contas de anúncios no Windsor.ai</p>
            <Link href="/crm/integracoes" className="mt-4 inline-block text-xs font-bold text-[#c9a24a] underline">
              Configurar integrações
            </Link>
          </div>
        )}

        {!loading && !erro && campanhas.length > 0 && isMobile && (
          <ul className="space-y-3">
            {campanhas.map((c, i) => (
              <li
                key={i}
                className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4"
              >
                <p className="mb-2 truncate text-sm font-bold text-[#e6edf3]">{c.campaign_name}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[#8b949e]">Gasto</span><p className="font-bold text-[#EF4444]">{moeda(c.spend)}</p></div>
                  <div><span className="text-[#8b949e]">Cliques</span><p className="font-bold text-[#c9a24a]">{num(c.clicks)}</p></div>
                  <div><span className="text-[#8b949e]">CTR</span><p className="font-bold text-[#d6a129]">{(c.ctr * 100).toFixed(2)}%</p></div>
                  <div><span className="text-[#8b949e]">Conv.</span><p className="font-bold text-[#22C55E]">{c.conversions || 0}</p></div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && !erro && campanhas.length > 0 && !isMobile && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1d3a2c" }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#0f1d16" }}>
                <tr>
                  {["Campanha", "Gasto", "Cliques", "Impressões", "CTR", "CPC", "Conversões"].map(h => (
                    <th key={h} className="text-left text-xs font-bold uppercase tracking-wide px-4 py-3" style={{ color: "#8b949e" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campanhas.map((c, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #16271e" }}>
                    <td className="px-4 py-3">
                      <p className="font-bold text-xs truncate max-w-xs" style={{ color: "#e6edf3" }}>{c.campaign_name}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-xs" style={{ color: "#EF4444" }}>{moeda(c.spend)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#c9a24a" }}>{num(c.clicks)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#8b949e" }}>{num(c.impressions)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#d6a129" }}>{(c.ctr * 100).toFixed(2)}%</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "#c9a24a" }}>{moeda(c.cpc)}</td>
                    <td className="px-4 py-3 text-xs font-bold" style={{ color: "#22C55E" }}>{c.conversions || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
