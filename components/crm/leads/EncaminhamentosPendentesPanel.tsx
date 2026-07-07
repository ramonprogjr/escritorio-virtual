"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type EncaminhamentoPendente = {
  id: string;
  lead_id: string;
  lead_nome: string;
  lead_codigo: string | null;
  segmento: string | null;
  parceiro_sugerido: string | null;
  parceiro_id?: string;
  criado_em: string;
};

type Props = {
  onChanged?: () => void;
  /** Quando true, o painel continua buscando e reportando a contagem, mas NÃO renderiza
   *  a lista (vira um chip controlado pelo pai). */
  collapsed?: boolean;
  /** Reporta quantos encaminhamentos estão pendentes (p/ o chip "IA · N"). */
  onCount?: (n: number) => void;
};

export function EncaminhamentosPendentesPanel({ onChanged, collapsed = false, onCount }: Props) {
  const [rows, setRows] = useState<EncaminhamentoPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await fetch("/api/crm/encaminhamentos/pendentes", {
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: EncaminhamentoPendente[]; error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao carregar encaminhamentos.");
        setRows([]);
        return;
      }
      setRows(json.data ?? []);
    } catch {
      setErro("Erro de rede.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    onCount?.(rows.length);
  }, [rows, onCount]);

  async function aprovar(id: string) {
    setProcessando(id);
    setErro("");
    try {
      const res = await fetch(`/api/crm/encaminhamentos/${encodeURIComponent(id)}/aprovar`, {
        method: "POST",
        credentials: "include",
        headers: internalApiHeaders(),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao aprovar encaminhamento.");
        return;
      }
      await carregar();
      onChanged?.();
    } catch {
      setErro("Erro de rede ao aprovar.");
    } finally {
      setProcessando(null);
    }
  }

  async function recusar(id: string) {
    setProcessando(id);
    setErro("");
    try {
      const res = await fetch("/api/crm/encaminhamentos", {
        method: "PATCH",
        credentials: "include",
        headers: { ...internalApiHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "recusado", validado_humano: true }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(json.error || "Falha ao recusar.");
        return;
      }
      await carregar();
      onChanged?.();
    } finally {
      setProcessando(null);
    }
  }

  // Modo chip: só conta (via onCount no efeito acima), o pai desenha o gatilho.
  if (collapsed) return null;

  if (loading) {
    return <p className="text-sm text-[#8b949e]">Carregando sugestões de encaminhamento…</p>;
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 rounded-xl border border-[#c9a24a]/30 bg-[#c9a24a]/5 p-4">
      <h3 className="text-sm font-bold text-[#c9a24a]">Encaminhamentos pendentes (IA)</h3>
      <p className="mt-1 text-xs text-[#8b949e]">
        Valide a sugestão da IA antes de enviar o lead ao parceiro por WhatsApp.
      </p>
      {erro && <p className="mt-2 text-xs text-red-400">{erro}</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1d3a2c] bg-[#0f1d16] px-3 py-2"
          >
            <div className="min-w-0">
              <Link
                href={`/crm/leads/${r.lead_id}`}
                className="text-sm font-semibold text-white underline-offset-2 transition-colors hover:text-[#c9a24a] hover:underline"
                title="Abrir o cliente"
              >
                {r.lead_nome}
              </Link>
              <p className="text-xs text-[#8b949e]">
                {r.segmento ?? "—"} →{" "}
                {r.parceiro_id ? (
                  <Link
                    href={`/crm/parceiros/${r.parceiro_id}`}
                    className="font-semibold underline-offset-2 transition-colors hover:text-[#c9a24a] hover:underline"
                    title="Abrir o cadastro do parceiro"
                  >
                    {r.parceiro_sugerido ?? "Parceiro sugerido"}
                  </Link>
                ) : (
                  <span>{r.parceiro_sugerido ?? "Parceiro sugerido"}</span>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={processando === r.id}
                onClick={() => void recusar(r.id)}
                className="rounded-lg border border-[#1d3a2c] px-3 py-1.5 text-xs text-[#8b949e] hover:bg-[#16271e]"
              >
                Recusar
              </button>
              <button
                type="button"
                disabled={processando === r.id}
                onClick={() => void aprovar(r.id)}
                className="rounded-lg bg-[#238636] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2ea043] disabled:opacity-50"
              >
                {processando === r.id ? "Enviando…" : "Aprovar e enviar"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
