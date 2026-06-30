"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, RefreshCw } from "lucide-react";
import { CrmStickyPageHeader } from "@/components/crm/CrmStickyPageHeader";
import { crmApiHeaders } from "@/lib/internal-api-headers-client";

type ConsumoRow = {
  origem: string;
  modelo: string;
  creditos: number;
  // custo_brl removido da API (E-A1) — margem interna, nunca exposta ao browser.
  criado_em: string;
};

const ORIGEM_LABEL: Record<string, string> = {
  chat_atendimento: "Atendimento (IA)",
  relatorio: "Relatório",
  contrato: "Contrato",
  cronograma: "Cronograma",
  pedido_material: "Pedido de material",
  dashboard: "Dashboard",
};

function labelOrigem(origem: string): string {
  return ORIGEM_LABEL[origem] ?? origem.replace(/_/g, " ");
}

function labelModelo(modelo: string): string {
  if (modelo.startsWith("claude")) return "Turbo";
  if (modelo.startsWith("mistral")) return "Econômico";
  return modelo;
}

function quando(iso: string): string {
  const d = new Date(iso);
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return d.toLocaleDateString("pt-BR");
}

export default function CreditosPage() {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [consumo, setConsumo] = useState<ConsumoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/ia/creditos", { headers: await crmApiHeaders() });
      const json = (await res.json()) as { saldo?: number; consumo?: ConsumoRow[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar a carteira");
        return;
      }
      setSaldo(json.saldo ?? 0);
      setConsumo(json.consumo ?? []);
    } catch {
      setErro("Erro de rede");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalConsumido = consumo.reduce((s, c) => s + Math.abs(c.creditos), 0);
  const temSaldoPositivo = (saldo ?? 0) > 0;

  return (
    <div className="flex min-h-full flex-col bg-[#0a140f]">
      <CrmStickyPageHeader
        title="Carteira de Tijolos"
        description="Tijolos 🧱 — a moeda de IA do Obra10+. Cada ação da IA consome Tijolos."
        actions={
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 text-xs font-bold text-[#8b949e] transition-colors hover:text-[#e6edf3]"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {erro && (
          <p className="mb-4 rounded-lg border border-[#f8514966] bg-[#1a0a0a] px-3 py-2 text-sm text-[#ff7b72]">
            {erro}
          </p>
        )}

        {/* Cartões de topo */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "#c9a24a55", background: "linear-gradient(135deg,#0f1d16,#1a1505)" }}
          >
            <div className="mb-1 flex items-center gap-2">
              <Layers className="h-4 w-4" style={{ color: "#c9a24a" }} />
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#8b949e]">
                {temSaldoPositivo ? "Saldo" : "Carteira"}
              </span>
            </div>
            {loading ? (
              <p className="text-2xl font-black text-[#484f58]">—</p>
            ) : temSaldoPositivo ? (
              <p className="text-3xl font-black" style={{ color: "#e0b86a" }}>
                {(saldo ?? 0).toLocaleString("pt-BR")} <span className="text-base font-bold text-[#8b949e]">Tijolos</span>
              </p>
            ) : (
              <p className="text-sm text-[#8b949e]">
                Em modo de medição — sem compras ainda. Os Tijolos consumidos aparecem ao lado.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[#1d3a2c] bg-[#0f1d16] p-5">
            <div className="mb-1 flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#8b949e]" />
              <span className="text-[11px] font-bold uppercase tracking-wide text-[#8b949e]">Consumido (recente)</span>
            </div>
            <p className="text-3xl font-black text-[#e6edf3]">
              {loading ? "—" : totalConsumido.toLocaleString("pt-BR")}{" "}
              <span className="text-base font-bold text-[#8b949e]">Tijolos</span>
            </p>
            <p className="mt-1 text-[11px] text-[#6e7681]">nas últimas {consumo.length} ações de IA</p>
          </div>
        </div>

        {/* Extrato */}
        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-[#8b949e]">Extrato de consumo</h2>
        {loading ? (
          <p className="text-sm text-[#8b949e]">Carregando…</p>
        ) : consumo.length === 0 ? (
          <p className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-4 py-8 text-center text-sm text-[#8b949e]">
            Nenhum consumo ainda. Assim que a IA gerar algo (atendimento, relatório, cronograma…), aparece aqui.
          </p>
        ) : (
          <ul className="space-y-2">
            {consumo.map((c, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#1d3a2c] bg-[#0f1d16] px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#e6edf3]">{labelOrigem(c.origem)}</p>
                  <p className="text-[11px] text-[#6e7681]">
                    {labelModelo(c.modelo)} · {quando(c.criado_em)}
                  </p>
                </div>
                <span className="flex-shrink-0 text-sm font-black" style={{ color: "#e0b86a" }}>
                  −{Math.abs(c.creditos).toLocaleString("pt-BR")}{" "}
                  <span className="text-[11px] font-bold text-[#8b949e]">Tijolos</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
