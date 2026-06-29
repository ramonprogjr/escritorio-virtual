"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HardHat, Layers, Plus } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";
import { EmptyState } from "@/components/crm/EmptyState";
import { NovaObraSideover } from "@/components/crm/obras/NovaObraSideover";
import { EapEditorSideover } from "@/components/crm/obras/EapEditorSideover";
import { TIPOS_OBRA, TIPOS_OBRA_PRINCIPAIS } from "@/lib/obras/eap-presets";

type Obra = {
  id: string;
  codigo: string | null;
  codigo_legivel?: string | null;
  titulo: string;
  tipo_obra?: string | null;
  status: string;
  cidade: string | null;
  estado: string | null;
};

const DOURADO = "#c9a24a";

const TIPO_META = new Map<string, (typeof TIPOS_OBRA)[number]>(
  TIPOS_OBRA.map((t) => [t.slug, t])
);

function ObrasPageInner() {
  const searchParams = useSearchParams();
  const negocioId = searchParams.get("negocio_id");

  const [obras, setObras] = useState<Obra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>(""); // "" = todas
  const [novaAberta, setNovaAberta] = useState(false);
  const [eapObra, setEapObra] = useState<Obra | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (negocioId) params.set("negocio_id", negocioId);
    if (filtroTipo) params.set("tipo", filtroTipo);
    const url = `/api/crm/obras${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url, { headers: internalApiHeaders() });
    const json = (await res.json()) as { data?: Obra[] };
    setObras(json.data ?? []);
    setCarregando(false);
  }, [negocioId, filtroTipo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const chips = useMemo(
    () => [
      { value: "", label: "Todas" },
      ...TIPOS_OBRA.filter((t) => TIPOS_OBRA_PRINCIPAIS.includes(t.slug)).map((t) => ({
        value: t.slug,
        label: t.label,
      })),
    ],
    []
  );

  return (
    <div className="min-h-full bg-[#0a140f] p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#e6edf3]">
            <HardHat className="h-5 w-5" style={{ color: DOURADO }} />
            Obras
          </h1>
          <p className="text-xs text-[#8b949e]">Carteira de obras · EAP por disciplina</p>
        </div>
        <button
          type="button"
          onClick={() => setNovaAberta(true)}
          className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-xs font-bold text-[#003b26]"
          style={{ background: DOURADO }}
        >
          <Plus className="h-4 w-4" />
          Nova obra
        </button>
      </div>

      {negocioId ? (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#c9a24a44] bg-[#003b2622] px-3 py-2">
          <span className="text-xs text-[#e6edf3]">Obras a partir de um negócio.</span>
          <Link href={`/crm/negocios/${negocioId}`} className="text-xs font-bold text-[#c9a24a]">
            ← Voltar ao negócio
          </Link>
        </div>
      ) : null}

      {/* Filtros por tipo */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
          const ativo = filtroTipo === c.value;
          return (
            <button
              key={c.value || "todas"}
              type="button"
              onClick={() => setFiltroTipo(c.value)}
              className="rounded-lg border px-3 py-1.5 text-xs font-bold"
              style={{
                borderColor: ativo ? DOURADO : "#1d3a2c",
                background: ativo ? "rgba(201,162,74,0.12)" : "#0a140f",
                color: ativo ? "#e6edf3" : "#8b949e",
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {toast ? (
        <div className="mb-4 rounded-lg border border-[#23863655] bg-[#23863618] px-3 py-2 text-xs font-bold text-[#3fb950]">
          {toast}
        </div>
      ) : null}

      {carregando ? (
        <p className="text-sm text-[#8b949e]">Carregando…</p>
      ) : obras.length === 0 ? (
        <EmptyState
          message={
            negocioId
              ? "Nenhuma obra para este negócio ainda. Crie a primeira."
              : "Nenhuma obra na carteira. Crie a primeira obra."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {obras.map((o) => {
            const meta = o.tipo_obra ? TIPO_META.get(o.tipo_obra) : undefined;
            const codigo = o.codigo_legivel || o.codigo;
            return (
              <div
                key={o.id}
                className="flex flex-col rounded-xl border border-[#1d3a2c] bg-[#0f1d16] p-4"
              >
                <Link href={`/crm/obras/${o.id}`} className="block">
                  <div className="flex items-center gap-2">
                    {meta ? (
                      <span aria-hidden className="text-base">
                        {meta.icone}
                      </span>
                    ) : null}
                    <strong className="text-sm text-[#e6edf3]">{o.titulo}</strong>
                  </div>
                  <p className="mt-1 font-mono text-[11px] text-[#8b949e]">{codigo}</p>
                  <p className="mt-2 text-xs text-[#8b949e]">
                    {meta?.label ?? o.tipo_obra ?? "Obra"} · {o.status} ·{" "}
                    {[o.cidade, o.estado].filter(Boolean).join(" / ") || "—"}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => setEapObra(o)}
                  className="mt-3 inline-flex items-center gap-1 self-start rounded-lg border border-[#1d3a2c] px-2.5 py-1.5 text-[11px] font-bold text-[#c9a24a]"
                >
                  <Layers className="h-3.5 w-3.5" />
                  EAP (frentes)
                </button>
              </div>
            );
          })}
        </div>
      )}

      <NovaObraSideover
        open={novaAberta}
        onClose={() => setNovaAberta(false)}
        negocioId={negocioId}
        onCreated={(obra, frentes) => {
          const cod = obra.codigo_legivel || obra.codigo || "obra";
          setToast(`Obra ${cod} criada${frentes ? ` · ${frentes} frentes` : ""}.`);
          void carregar();
        }}
      />

      {eapObra ? (
        <EapEditorSideover
          open={Boolean(eapObra)}
          onClose={() => setEapObra(null)}
          obraId={eapObra.id}
          obraTitulo={eapObra.titulo}
          onUpdated={() => void carregar()}
        />
      ) : null}
    </div>
  );
}

export default function ObrasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-full bg-[#0a140f] p-6 text-sm text-[#8b949e]">Carregando…</div>
      }
    >
      <ObrasPageInner />
    </Suspense>
  );
}
