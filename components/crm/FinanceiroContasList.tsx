"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { toast } from "@/components/crm/toast";
import {
  type ContaFinanceira,
  type TipoConta,
  diasAteVencimento,
  labelDias,
  moedaFinanceiroExata,
} from "@/lib/crm/finance-contas";

type Props = {
  tipo: TipoConta;
  contas: ContaFinanceira[];
  onAtualizado: () => void;
  linkDashboard?: string;
};

const STATUS_FINAL: Record<TipoConta, { status: string; label: string }> = {
  pagar: { status: "pago", label: "Marcar pago" },
  receber: { status: "recebido", label: "Marcar recebido" },
};

export function FinanceiroContasList({ tipo, contas, onAtualizado, linkDashboard }: Props) {
  const router = useRouter();
  const final = STATUS_FINAL[tipo];
  const [processando, setProcessando] = useState<string | null>(null);

  async function patchStatus(id: string, status: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/crm/financeiro/contas/${tipo}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...internalApiHeaders() },
        body: JSON.stringify({ status }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function desfazer(id: string) {
    const ok = await patchStatus(id, "pendente");
    if (ok) {
      onAtualizado();
      toast.info("Baixa desfeita.");
    } else {
      toast.error("Não foi possível desfazer.");
    }
  }

  async function marcarFinalizada(id: string) {
    setProcessando(id);
    try {
      const ok = await patchStatus(id, final.status);
      if (!ok) {
        toast.error(
          tipo === "pagar"
            ? "Não foi possível marcar como pago."
            : "Não foi possível marcar como recebido.",
        );
        return;
      }
      onAtualizado();
      toast.withAction(
        "success",
        tipo === "pagar" ? "Conta marcada como paga." : "Conta marcada como recebida.",
        { label: "Desfazer", run: () => void desfazer(id) },
      );
    } finally {
      setProcessando(null);
    }
  }

  if (contas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1d3a2c] bg-[#0f1d16] px-6 py-12 text-center">
        <p className="text-sm font-bold text-[#e6edf3]">Nenhum lançamento neste filtro</p>
        <p className="mt-1 text-xs text-[#8b949e]">
          Ajuste os filtros ou cadastre um novo lançamento no painel financeiro.
        </p>
        {linkDashboard && (
          <Link
            href={linkDashboard}
            className="mt-4 inline-block text-xs font-bold text-[#c9a24a] hover:underline"
          >
            Ir para visão financeira
          </Link>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-2 pb-4">
      {contas.map((c) => {
        const dias = diasAteVencimento(c.vencimento);
        const atrasado = dias !== null && dias < 0 && c.status === "pendente";
        const corBorda = atrasado ? "#f85149" : tipo === "pagar" ? "#e3b341" : "#3fb950";
        return (
          <li
            key={c.id}
            className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-3"
            style={{ borderLeftWidth: 3, borderLeftColor: corBorda }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#e6edf3]">{c.descricao}</p>
                {tipo === "receber" && c.origem && (
                  <p className="mt-0.5 truncate text-xs font-semibold text-[#c9a24a]">
                    {c.origem}
                  </p>
                )}
                <p className="mt-1 text-lg font-black tabular-nums text-[#e6edf3]">
                  {moedaFinanceiroExata(c.valor)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#8b949e]">
                  <span
                    className="rounded-full px-2 py-0.5 font-bold uppercase"
                    style={{
                      background: `${corBorda}22`,
                      color: corBorda,
                    }}
                  >
                    {c.status}
                  </span>
                  <span>{labelDias(dias)}</span>
                  {c.vencimento && (
                    <span>
                      {new Date(`${String(c.vencimento).slice(0, 10)}T12:00:00`).toLocaleDateString(
                        "pt-BR"
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {c.status === "pendente" && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={processando === c.id}
                  onClick={() => void marcarFinalizada(c.id)}
                  className="min-h-11 flex-1 rounded-lg bg-[#003b26] text-xs font-bold text-[#c9a24a] hover:brightness-110 disabled:opacity-60"
                >
                  {processando === c.id ? "Salvando…" : final.label}
                </button>
                {tipo === "receber" && (
                  <button
                    type="button"
                    onClick={() => router.push("/crm/negocios")}
                    className="min-h-11 rounded-lg border border-[#1d3a2c] px-3 text-xs font-semibold text-[#8b949e]"
                  >
                    Negócios
                  </button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
