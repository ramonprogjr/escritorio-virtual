"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";
import { EntitySelect, type EntitySelectOption } from "@/components/crm/EntitySelect";

type Projeto = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  negocio_id: string | null;
  obra_id: string | null;
};

type NegocioOpt = {
  id: string;
  codigo: string | null;
  titulo: string;
  etapa?: string | null;
  status?: string | null;
};

function ProjetosPageInner() {
  const searchParams = useSearchParams();
  const negocioIdFilter = searchParams.get("negocio_id") || "";
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [modal, setModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [negocioId, setNegocioId] = useState(negocioIdFilter);
  const [salvando, setSalvando] = useState(false);
  const [negocios, setNegocios] = useState<NegocioOpt[]>([]);
  const [negociosLoading, setNegociosLoading] = useState(true);
  const [negociosErro, setNegociosErro] = useState<string | null>(null);

  const carregar = useCallback(() => {
    const q = negocioIdFilter ? `?negocio_id=${encodeURIComponent(negocioIdFilter)}` : "";
    fetch(`/api/crm/projetos${q}`, { headers: internalApiHeaders() })
      .then((r) => r.json())
      .then((d: { data?: Projeto[] }) => setProjetos(d.data ?? []));
  }, [negocioIdFilter]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Pré-seleciona o negócio quando ele vem no contexto da URL.
  useEffect(() => {
    setNegocioId(negocioIdFilter);
  }, [negocioIdFilter]);

  // Carrega negócios p/ o seletor (escolher por título, salvar o id por baixo).
  // O endpoint pagina de 20 em 20; buscamos algumas páginas para cobrir a base.
  useEffect(() => {
    let cancel = false;
    setNegociosLoading(true);
    setNegociosErro(null);
    (async () => {
      try {
        const acc: NegocioOpt[] = [];
        for (let pagina = 0; pagina < 5; pagina++) {
          const res = await fetch(`/api/crm/negocios?offset=${pagina * 20}`, {
            headers: internalApiHeaders(),
          });
          const d = (await res.json()) as { data?: NegocioOpt[]; error?: string };
          if (!res.ok) throw new Error(d.error || "Falha ao carregar negócios.");
          const lote = Array.isArray(d.data) ? d.data : [];
          acc.push(...lote);
          if (lote.length < 20) break;
        }
        if (!cancel) setNegocios(acc);
      } catch (e) {
        if (!cancel) {
          setNegociosErro(e instanceof Error ? e.message : "Falha ao carregar negócios.");
          setNegocios([]);
        }
      } finally {
        if (!cancel) setNegociosLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const negocioOpts: EntitySelectOption[] = negocios.map((n) => ({
    value: n.id,
    label: n.titulo || n.codigo || "Negócio sem título",
    sub: [n.codigo, n.etapa].filter(Boolean).join(" · ") || undefined,
  }));

  async function criar() {
    if (!titulo.trim()) return;
    setSalvando(true);
    await fetch("/api/crm/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ titulo, negocio_id: negocioId || null }),
    });
    setSalvando(false);
    setModal(false);
    setTitulo("");
    setNegocioId(negocioIdFilter);
    carregar();
  }

  return (
    <div className="min-h-full bg-[#0a140f] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-[#e6edf3]">Projetos</h1>
          <p className="text-xs text-[#8b949e]">Negócio → projeto → obra → pedidos</p>
        </div>
        <button
          type="button"
          onClick={() => setModal(true)}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-[#c9a24a] px-3 text-xs font-bold text-[#003b26]"
        >
          <Plus className="h-4 w-4" />
          Novo
        </button>
      </div>

      {projetos.length === 0 ? (
        <EmptyState message="Nenhum projeto cadastrado." />
      ) : (
        <ul className="space-y-2">
          {projetos.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4"
            >
              <p className="font-bold text-[#e6edf3]">{p.titulo}</p>
              <p className="text-xs text-[#8b949e]">
                {p.codigo} · {p.status}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {p.negocio_id && (
                  <Link href={`/crm/negocios/${p.negocio_id}`} className="font-bold text-[#c9a24a]">
                    Negócio
                  </Link>
                )}
                {p.obra_id && (
                  <Link href={`/crm/obras/${p.obra_id}`} className="font-bold text-[#c9a24a]">
                    Obra
                  </Link>
                )}
                <Link href={`/crm/pedidos?obra_id=${p.obra_id || ""}`} className="text-[#8b949e] hover:text-[#e6edf3]">
                  Pedidos
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4">
            <h2 className="text-sm font-bold text-[#e6edf3]">Novo projeto</h2>
            <input
              placeholder="Título *"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="mt-3 w-full min-h-11 rounded-lg border border-[#1d3a2c] bg-[#16271e] px-3 text-sm text-[#e6edf3]"
            />
            <div className="mt-2">
              <span className="mb-1 block text-xs text-[#8b949e]">Negócio (opcional)</span>
              <EntitySelect
                value={negocioId}
                onChange={setNegocioId}
                options={negocioOpts}
                loading={negociosLoading}
                erro={negociosErro}
                clearable
                placeholder="Selecionar negócio…"
                searchPlaceholder="Buscar negócio por título ou código…"
                emptyLabel="Nenhum negócio cadastrado ainda."
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 min-h-10 rounded-lg bg-[#16271e] text-xs text-[#8b949e]">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void criar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26]"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProjetosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8b949e]">Carregando projetos…</div>}>
      <ProjetosPageInner />
    </Suspense>
  );
}
