"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { ArvoreEscopo } from "@/components/crm/obras/ArvoreEscopo";
import { ObraItensSecao } from "@/components/crm/obras/ObraItensSecao";
import { ObraComprasEstoqueSecao } from "@/components/crm/obras/ObraComprasEstoqueSecao";
import { ObraFinanceiroSecao } from "@/components/crm/obras/ObraFinanceiroSecao";
import { ObraCronogramaSecao } from "@/components/crm/obras/ObraCronogramaSecao";
import { SecaoHistoricoMedicoes } from "@/components/crm/obras/SecaoHistoricoMedicoes";
import { ObraDiarioForm } from "@/components/crm/obras/ObraDiarioForm";

type ObraPainel = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
};

type Aba = "escopo" | "painel" | "itens" | "cronograma" | "compras" | "financeiro";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "escopo", rotulo: "Escopo" },
  { id: "itens", rotulo: "Itens & Avanço" },
  { id: "cronograma", rotulo: "Cronograma" },
  { id: "compras", rotulo: "Compras & Estoque" },
  { id: "financeiro", rotulo: "Financeiro" },
  { id: "painel", rotulo: "Painel" },
];

export default function ObraPainelPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [obra, setObra] = useState<ObraPainel | null>(null);
  const [pedidos, setPedidos] = useState<Record<string, unknown>[]>([]);
  const [checkins, setCheckins] = useState<Record<string, unknown>[]>([]);
  const [diario, setDiario] = useState<Record<string, unknown>[]>([]);
  const [aba, setAba] = useState<Aba>("escopo"); // Escopo é 1ª classe (decisão #8): a planilha viva primeiro

  const carregar = useCallback(async () => {
    const res = await fetch(`/api/crm/obras/${encodeURIComponent(id)}`, {
      headers: internalApiHeaders(),
    });
    const json = (await res.json()) as {
      data?: ObraPainel;
      pedidos?: Record<string, unknown>[];
      checkins?: Record<string, unknown>[];
      diario?: Record<string, unknown>[];
    };
    setObra(json.data ?? null);
    setPedidos(json.pedidos ?? []);
    setCheckins(json.checkins ?? []);
    setDiario(json.diario ?? []);
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (!obra) {
    return <p className="p-6 text-sm text-[#8aa99a]">Carregando painel da obra…</p>;
  }

  const localizacao =
    [obra.endereco, obra.cidade, obra.estado].filter(Boolean).join(" — ") || "Endereço não informado";

  return (
    <div className="min-h-full bg-[#0a140f] px-4 py-5 text-[#e6edf3] sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/crm/obras")}
          className="-ml-1 inline-flex min-h-[44px] items-center gap-1 px-1 text-sm font-semibold text-[#8aa99a] transition-colors hover:text-[#e6edf3]"
        >
          ← Obras
        </button>
        <h1 className="mt-1 text-xl font-bold sm:text-2xl">{obra.titulo}</h1>
        <p className="text-xs text-[#8aa99a]">
          {obra.status}
        </p>
        <p className="mt-2 text-sm text-[#c8d6cd]">{localizacao}</p>

        {/* Abas — scroll horizontal no mobile (não estoura): cada aba flex-shrink-0. */}
        <div
          role="tablist"
          aria-label="Seções da obra"
          className="mt-6 mb-4 flex gap-1 overflow-x-auto border-b border-[#1d3a2c] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {ABAS.map(({ id: tabId, rotulo }) => {
            const ativo = aba === tabId;
            return (
              <button
                key={tabId}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setAba(tabId)}
                className={`min-h-[44px] flex-shrink-0 whitespace-nowrap border-b-2 px-3.5 text-[13px] font-bold transition-colors ${
                  ativo
                    ? "border-[#c9a24a] text-[#f0c869]"
                    : "border-transparent text-[#8aa99a] hover:text-[#c8d6cd]"
                }`}
              >
                {rotulo}
              </button>
            );
          })}
        </div>

        {aba === "escopo" ? (
          <ArvoreEscopo obraId={id} obraCodigo={obra.codigo} obraTitulo={obra.titulo} />
        ) : aba === "itens" ? (
          <>
            <ObraItensSecao obraId={id} />
            <SecaoHistoricoMedicoes obraId={id} titulo="Histórico de medições da obra" />
          </>
        ) : aba === "cronograma" ? (
          <ObraCronogramaSecao obraId={id} />
        ) : aba === "compras" ? (
          <ObraComprasEstoqueSecao obraId={id} />
        ) : aba === "financeiro" ? (
          <ObraFinanceiroSecao obraId={id} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <section className="rounded-[10px] border border-[#1d3a2c] bg-[#0f1d16] p-4">
              <h2 className="mb-3 text-sm font-semibold">Pedidos de material</h2>
              {pedidos.length === 0 ? (
                <p className="text-xs text-[#8aa99a]">Nenhum pedido.</p>
              ) : (
                pedidos.map((p) => (
                  <p key={String(p.id)} className="my-1.5 text-xs">
                    {String(p.descricao)} — {String(p.status)}
                  </p>
                ))
              )}
            </section>
            <section className="rounded-[10px] border border-[#1d3a2c] bg-[#0f1d16] p-4">
              <h2 className="mb-3 text-sm font-semibold">Check-ins</h2>
              {checkins.length === 0 ? (
                <p className="text-xs text-[#8aa99a]">Nenhum check-in.</p>
              ) : (
                checkins.map((c) => (
                  <p key={String(c.id)} className="my-1.5 text-xs">
                    {String(c.tipo)} — {new Date(String(c.criado_em)).toLocaleString("pt-BR")}
                  </p>
                ))
              )}
            </section>
            <section className="rounded-[10px] border border-[#1d3a2c] bg-[#0f1d16] p-4">
              <h2 className="mb-3 text-sm font-semibold">Diário de obra</h2>
              <ObraDiarioForm obraId={id} />
              {diario.length === 0 ? (
                <p className="text-xs text-[#8aa99a]">Sem registros ainda — registre o primeiro dia.</p>
              ) : (
                diario.map((d) => (
                  <div
                    key={String(d.id)}
                    className="my-1.5 border-t border-[#16271e] pt-1.5 text-xs first:border-t-0 first:pt-0"
                  >
                    <p className="whitespace-pre-wrap text-[#e6edf3]">{String(d.resumo)}</p>
                    <p className="mt-0.5 text-[10px] text-[#8aa99a]">
                      {d.clima ? `${String(d.clima)} · ` : ""}
                      {d.criado_em ? new Date(String(d.criado_em)).toLocaleString("pt-BR") : ""}
                    </p>
                  </div>
                ))
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
