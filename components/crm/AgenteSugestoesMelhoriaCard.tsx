"use client";

import { useState } from "react";
import { Sparkles, ArrowUpCircle } from "lucide-react";
import { CrmButton } from "@/components/crm/CrmButton";
import { internalApiHeaders } from "@/lib/internal-api-headers";

/**
 * IA VIVA — card na ficha do agente onde a IA do sistema PREVÊ e SUGERE melhorias concretas e priorizadas.
 * On-demand (botão "Analisar com IA") para não gastar crédito a cada abertura da ficha. Diretriz do dono 09/jul.
 */

type Sugestao = { titulo: string; porque: string; como: string; prioridade: "alta" | "media" | "baixa" };

const COR_PRIO: Record<Sugestao["prioridade"], { bg: string; fg: string; label: string }> = {
  alta: { bg: "#f8514922", fg: "#ff7b72", label: "Alta" },
  media: { bg: "#c9a24a22", fg: "#e3b341", label: "Média" },
  baixa: { bg: "#8b949e22", fg: "#8b949e", label: "Baixa" },
};

export function AgenteSugestoesMelhoriaCard({ slug }: { slug: string }) {
  const [sugestoes, setSugestoes] = useState<Sugestao[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function analisar() {
    if (carregando) return;
    setCarregando(true);
    setErro("");
    try {
      const res = await fetch(`/api/hub/agentes/${encodeURIComponent(slug)}/sugestoes-melhoria`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; sugestoes?: Sugestao[]; error?: string };
      if (!res.ok || !j.ok || !Array.isArray(j.sugestoes)) {
        if (res.status === 429) {
          setErro("Muitas análises seguidas — aguarde um minuto e tente de novo.");
        } else if (j.error === "sem_sugestoes") {
          setErro("A IA não encontrou melhorias claras agora — tente de novo.");
        } else if (j.error === "sem_creditos") {
          setErro("Sem créditos de IA no momento para analisar.");
        } else {
          setErro("Não foi possível analisar agora. Tente novamente em instantes.");
        }
        return;
      }
      setSugestoes(j.sugestoes);
    } catch {
      setErro("Erro de rede ao analisar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <section className="rounded-xl border border-obra-borda bg-obra-dark-2 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Sparkles size={18} className="mt-0.5 text-obra-dourado" aria-hidden />
          <div>
            <h3 className="m-0 text-sm font-semibold text-obra-texto">Como melhorar este agente</h3>
            <p className="m-0 mt-0.5 text-xs text-obra-texto-2">
              A IA analisa a configuração e sugere melhorias concretas e priorizadas.
            </p>
          </div>
        </div>
        <CrmButton
          size="sm"
          variant={sugestoes ? "secondary" : "primary"}
          loading={carregando}
          onClick={() => void analisar()}
          leftIcon={<Sparkles size={14} />}
        >
          {sugestoes ? "Analisar de novo" : "Analisar com IA"}
        </CrmButton>
      </div>

      {erro && (
        <p role="alert" className="mt-3 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 px-3 py-2 text-xs font-semibold text-[#ff7b72]">
          {erro}
        </p>
      )}

      {carregando && !sugestoes && (
        <p className="mt-3 text-center text-xs text-obra-texto-3">A IA está analisando o agente…</p>
      )}

      {sugestoes && sugestoes.length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {sugestoes.map((s, i) => {
            const cor = COR_PRIO[s.prioridade];
            return (
              <li key={i} className="rounded-lg border border-obra-borda bg-obra-dark p-3">
                <div className="mb-1 flex items-start gap-2">
                  <ArrowUpCircle size={15} className="mt-0.5 shrink-0" style={{ color: cor.fg }} aria-hidden />
                  <p className="m-0 flex-1 text-sm font-semibold text-obra-texto">{s.titulo}</p>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: cor.bg, color: cor.fg }}
                  >
                    {cor.label}
                  </span>
                </div>
                {s.porque && <p className="m-0 text-xs text-obra-texto-2"><strong className="text-obra-texto-2">Por quê:</strong> {s.porque}</p>}
                {s.como && <p className="m-0 mt-0.5 text-xs text-obra-texto-2"><strong className="text-obra-texto-2">Como:</strong> {s.como}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
