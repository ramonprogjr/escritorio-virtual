"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, ClipboardList, UserPlus } from "lucide-react";
import { CrmOQuePrecisaDeVoce } from "@/components/crm/CrmOQuePrecisaDeVoce";
import { CrmEquipeResumo } from "@/components/crm/CrmEquipeResumo";
import { CrmMetricCard, CrmSectionTitle } from "@/components/crm/CrmMetricCard";
import { CrmOperacaoResumo } from "@/components/crm/CrmOperacaoResumo";
import { CrmPipelineResumo } from "@/components/crm/CrmPipelineResumo";
import { CrmUltimosLeads } from "@/components/crm/CrmUltimosLeads";
import { useCrmHeaderSlot } from "@/components/crm/CrmHeaderContext";
import { useNarrowViewport } from "@/hooks/useNarrowViewport";
import { useAgentes } from "@/hooks/useAgentes";
import { useCrmDashboard } from "@/hooks/useCrmDashboard";
import { moedaPipeline } from "@/lib/crm/pipeline-funil";

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { setSlot } = useCrmHeaderSlot();
  const narrow = useNarrowViewport();
  const isMobile = narrow !== false;
  const dash = useCrmDashboard();
  const { agentes, loading: loadingAgentes } = useAgentes();
  const m = dash;

  useEffect(() => {
    if (isMobile) {
      setSlot(null);
      return;
    }
    setSlot({
      path: pathname,
      actions: (
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/crm/analytics"
            className="flex items-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-1.5 text-xs font-bold text-[#e6edf3] transition-colors hover:border-[#c9a24a55] hover:text-[#c9a24a]"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Analytics
          </Link>
          <Link
            href="/crm/relatorios"
            className="flex items-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 py-1.5 text-xs font-bold text-[#e6edf3] transition-colors hover:border-[#c9a24a55] hover:text-[#c9a24a]"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            Relatórios
          </Link>
          <button
            type="button"
            onClick={() => router.push("/crm/leads")}
            className="flex items-center gap-1.5 rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-1.5 text-xs font-bold text-[#c9a24a] hover:bg-[#003b2640]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Leads
          </button>
        </div>
      ),
    });
    return () => setSlot(null);
  }, [pathname, setSlot, router, isMobile]);

  const receita =
    m.receitaPotencial > 0 ? moedaPipeline(m.receitaPotencial) : "R$0";

  // Visão comercial enxuta — KPIs essenciais num só grid (sem duplicar o painel acionável)
  const visaoComercial = [
    {
      label: "Receita potencial",
      valor: receita,
      sub: "pipeline em aberto",
      cor: "#c9a24a",
      rota: "/crm/leads",
    },
    {
      label: "Taxa qualificação",
      valor: `${m.taxaQualificacao}%`,
      sub: "do total de leads",
      cor: "#34d399",
      rota: "/crm/leads",
    },
    {
      label: "Taxa encaminhamento",
      valor: `${m.taxaEncaminhamento}%`,
      sub: "leads encaminhados",
      cor: "#f59e0b",
      rota: "/crm/distribuicao",
    },
    {
      label: "Parceiros ativos",
      valor: m.parceirosAtivos,
      sub: "homologados",
      cor: "#4db3c4",
      rota: "/crm/parceiros",
    },
    {
      label: "Encaminhamentos hoje",
      valor: m.encaminhamentosHoje,
      sub: "rede de parceiros",
      cor: "#b58a63",
      rota: "/crm/distribuicao",
    },
    {
      label: "Agentes cadastrados",
      valor: m.agentesAtivos,
      sub: "no hub — IA liga com a chave",
      cor: "#4db3c4",
      rota: "/crm/agentes",
    },
  ];

  return (
    <div
      className={`bg-[#0a140f] ${isMobile ? "min-h-0 px-3 pb-6 pt-1" : "min-h-screen px-4 py-5 sm:px-6 sm:py-6"}`}
    >
      <div className="mx-auto w-full max-w-[1400px] space-y-6">
        {isMobile && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#2b3544] bg-[#121926] px-3.5 py-3">
            <h1 className="text-lg font-bold tracking-tight text-[#e6edf3]">Dashboard</h1>
            <div className="flex items-center gap-1.5">
              <Link
                href="/crm/analytics"
                aria-label="Analytics"
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1d3a2c] bg-[#16271e] px-3 text-xs font-bold text-[#c9a24a]"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Link>
              <Link
                href="/crm/relatorios"
                aria-label="Relatórios"
                className="flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1d3a2c] bg-[#16271e] px-3 text-xs font-bold text-[#c9a24a]"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Relatórios
              </Link>
            </div>
          </div>
        )}

        {dash.erro && (
          <div
            className="rounded-2xl border border-[#f8514966] bg-[#1a0a0a] px-4 py-3 text-sm text-[#ff7b72]"
            role="alert"
          >
            {dash.erro}
            <button
              type="button"
              onClick={() => dash.recarregar()}
              className="ml-2 text-xs font-bold underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Painel único acionável — o que exige decisão/ação agora (UX §5) */}
        <CrmOQuePrecisaDeVoce
          m={m}
          alertas={dash.alertas}
          loading={m.loading}
          indisponivel={!!dash.erro && !dash.carregado}
        />

        {/* Visão geral da operação */}
        <CrmPipelineResumo />

        <div className="grid gap-6 xl:grid-cols-2">
          <CrmUltimosLeads leads={dash.leadsRecentes} loading={dash.loading} />
          <CrmOperacaoResumo operacao={dash.operacao} loading={dash.loading} />
        </div>

        <div>
          <CrmSectionTitle>Visão comercial</CrmSectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {visaoComercial.map((c) => (
              <CrmMetricCard
                key={c.label}
                label={c.label}
                valor={c.valor}
                sub={c.sub}
                cor={c.cor}
                loading={m.loading}
                onClick={() => router.push(c.rota)}
              />
            ))}
          </div>
        </div>

        <CrmEquipeResumo agentes={agentes} ciclos={dash.ciclos} loading={loadingAgentes || dash.loading} />
      </div>
    </div>
  );
}
