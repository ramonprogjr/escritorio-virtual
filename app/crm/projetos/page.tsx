"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, X, FolderOpen, ChevronRight } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Projeto = {
  id: string;
  codigo: string | null;
  titulo: string;
  status: string;
  negocio_id: string | null;
  obra_id: string | null;
};

type Negocio = { id: string; titulo: string; codigo: string | null };

const STATUS_OPTS = [
  { value: "briefing", label: "Briefing" },
  { value: "desenvolvimento", label: "Desenvolvimento" },
  { value: "aprovacao_cliente", label: "Aprovação Cliente" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_COLOR: Record<string, string> = {
  briefing: "#60a5fa",
  desenvolvimento: "#f59e0b",
  aprovacao_cliente: "#a78bfa",
  concluido: "#3fb950",
  cancelado: "#8b949e",
};

const EMPTY_FORM = { titulo: "", status: "briefing", negocio_id: "" };

function ProjetosPageInner() {
  const searchParams = useSearchParams();
  const negocioIdFilter = searchParams.get("negocio_id") || "";

  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, negocio_id: negocioIdFilter });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [negocioSearch, setNegocioSearch] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const q = negocioIdFilter ? `?negocio_id=${encodeURIComponent(negocioIdFilter)}` : "";
      const res = await fetch(`/api/crm/projetos${q}`, { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Projeto[] };
      if (!res.ok) { setErro("Erro ao carregar projetos."); return; }
      setProjetos(json.data ?? []);
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, [negocioIdFilter]);

  const carregarNegocios = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/negocios?limit=50", { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Negocio[] };
      setNegocios(json.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { void carregarNegocios(); }, [carregarNegocios]);

  const negociosFiltrados = negocios.filter((n) =>
    !negocioSearch || n.titulo.toLowerCase().includes(negocioSearch.toLowerCase())
  );

  async function criar() {
    if (!form.titulo.trim()) { setErroSalvar("Título obrigatório."); return; }
    setSalvando(true);
    setErroSalvar("");
    const res = await fetch("/api/crm/projetos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        titulo: form.titulo.trim(),
        status: form.status,
        negocio_id: form.negocio_id || null,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Projeto; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao criar."); setSalvando(false); return; }
    if (json.data) setProjetos((prev) => [json.data!, ...prev]);
    setModal(false);
    setForm(EMPTY_FORM);
    setSalvando(false);
  }

  const negocioSelecionado = negocios.find((n) => n.id === form.negocio_id);

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Projetos</h1>
            <p className="text-xs text-[#8b949e]">Cadeia: Negócio → Projeto → Obra → Pedidos</p>
          </div>
          <button
            type="button"
            onClick={() => { setModal(true); setErroSalvar(""); setNegocioSearch(""); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] hover:bg-[#b8912f] transition-colors"
          >
            <Plus size={14} />
            Novo projeto
          </button>
        </div>
      </div>

      <div className="p-6" style={{ maxWidth: 800 }}>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-[#161b22]" />)}
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 p-4 text-sm text-[#f87171]">
            {erro}{" "}
            <button type="button" onClick={() => void carregar()} className="underline">tentar novamente</button>
          </div>
        ) : projetos.length === 0 ? (
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-10 text-center">
            <FolderOpen size={32} className="mx-auto mb-3 text-[#30363d]" />
            <p className="text-sm text-[#8b949e]">Nenhum projeto cadastrado. Crie o primeiro acima.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {projetos.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/crm/projetos/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#30363d] bg-[#161b22] p-4 hover:border-[#444c56] transition-colors no-underline"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-[#e6edf3] truncate">{p.titulo}</p>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          color: STATUS_COLOR[p.status] ?? "#8b949e",
                          background: `${STATUS_COLOR[p.status] ?? "#8b949e"}20`,
                        }}
                      >
                        {STATUS_OPTS.find((s) => s.value === p.status)?.label ?? p.status}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-[#8b949e]">{p.codigo}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs">
                      {p.negocio_id && (
                        <span className="text-[#60a5fa]">Negócio vinculado</span>
                      )}
                      {p.obra_id && (
                        <span className="text-[#c9a24a]">Obra vinculada</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-[#8b949e]" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal novo projeto */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Novo projeto</h2>
              <button type="button" onClick={() => setModal(false)} className="text-[#8b949e] hover:text-[#e6edf3]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Título *</label>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))}
                  placeholder="Ex: Reforma Apartamento Jardins"
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Seletor de negócio */}
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Negócio vinculado</label>
                {negocioSelecionado ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#c9a24a]/50 bg-[#21262d] px-3 py-2">
                    <span className="flex-1 text-sm text-[#e6edf3] truncate">{negocioSelecionado.titulo}</span>
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, negocio_id: "" }))}
                      className="text-[#8b949e] hover:text-[#e6edf3]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={negocioSearch}
                      onChange={(e) => setNegocioSearch(e.target.value)}
                      placeholder="Buscar negócio…"
                      className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                    />
                    {negocioSearch && negociosFiltrados.length > 0 && (
                      <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-[#30363d] bg-[#21262d]">
                        {negociosFiltrados.slice(0, 8).map((n) => (
                          <li key={n.id}>
                            <button
                              type="button"
                              onClick={() => { setForm((p) => ({ ...p, negocio_id: n.id })); setNegocioSearch(""); }}
                              className="w-full px-3 py-2 text-left text-xs text-[#e6edf3] hover:bg-[#30363d]"
                            >
                              {n.titulo}
                              {n.codigo && <span className="ml-1 text-[#8b949e]">· {n.codigo}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {negocioSearch && negociosFiltrados.length === 0 && (
                      <p className="mt-1 text-xs text-[#8b949e]">Nenhum negócio encontrado.</p>
                    )}
                  </>
                )}
              </div>
            </div>

            {erroSalvar && <p className="mt-3 text-xs text-[#f87171]">{erroSalvar}</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="flex-1 min-h-10 rounded-lg bg-[#21262d] text-xs text-[#8b949e] hover:text-[#e6edf3]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void criar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26] disabled:opacity-60"
              >
                {salvando ? "Criando…" : "Criar projeto"}
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
