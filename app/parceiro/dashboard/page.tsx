"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

type ParceiroResumo = {
  id: string;
  nome: string;
  status: string;
  modulo_atual: number;
  comissao_pct: number;
  total_leads_recebidos: number;
  total_leads_convertidos: number;
  recebe_leads: boolean;
  cidade: string | null;
  estado: string | null;
};

function Painel() {
  const search = useSearchParams();
  const id = search.get("id");
  const s = search.get("s");

  const [parceiro, setParceiro] = useState<ParceiroResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function validar() {
      if (!id || !s) {
        setErro("Abra este painel pelo link completo enviado pelo gestor (parâmetros id e s).");
        setCarregando(false);
        return;
      }
      const res = await fetch("/api/parceiros/portal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, s }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErro(data.erro || "Não foi possível validar o acesso.");
        setCarregando(false);
        return;
      }
      setParceiro(data.parceiro);
      setCarregando(false);
    }
    validar();
  }, [id, s]);

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-[#8b949e]">
        Carregando…
      </div>
    );
  }

  if (erro || !parceiro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0d1117] px-6 text-center">
        <p className="text-[#b3261e] max-w-md">{erro || "Acesso negado."}</p>
        <a href="/parceiro" className="text-[#c9a24a] underline text-sm">
          Voltar
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1117] text-white px-4 py-8 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-1">Olá, {parceiro.nome.split(" ")[0]}</h1>
      <p className="text-xs text-[#8b949e] mb-6">
        {parceiro.cidade ? `${parceiro.cidade}/${parceiro.estado}` : "Parceiro Obra10+"}
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {[
          { k: "Status", v: parceiro.status.replace("_", " ") },
          { k: "Módulo atual", v: String(parceiro.modulo_atual) },
          { k: "Comissão", v: `${parceiro.comissao_pct}%` },
          { k: "Recebe leads", v: parceiro.recebe_leads ? "Sim" : "Não" },
          { k: "Leads recebidos", v: String(parceiro.total_leads_recebidos) },
          { k: "Convertidos", v: String(parceiro.total_leads_convertidos) },
        ].map((x) => (
          <div key={x.k} className="rounded-lg p-3 bg-[#161b22] border border-[#30363d]">
            <div className="text-[10px] uppercase text-[#8b949e]">{x.k}</div>
            <div className="font-semibold text-[#c9a24a]">{x.v}</div>
          </div>
        ))}
      </div>

      <p className="text-sm text-[#8b949e]">
        Leads e documentos detalhados permanecem no CRM interno; este painel é a visão restrita do parceiro
        (Fase 2 — evolução contínua).
      </p>
    </div>
  );
}

export default function ParceiroDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0d1117] text-[#8b949e]">
          Carregando…
        </div>
      }
    >
      <Painel />
    </Suspense>
  );
}
