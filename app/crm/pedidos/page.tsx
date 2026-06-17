"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Package, X } from "lucide-react";
import { internalApiHeaders } from "@/lib/internal-api-headers";

type Pedido = {
  id: string;
  codigo: string | null;
  descricao: string;
  status: string;
  obra_id: string | null;
  valor_estimado: number | null;
};

type Obra = { id: string; titulo: string; codigo: string | null };

const STATUS_OPTS = ["rascunho", "cotando", "aprovado", "entregue", "cancelado"];
const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho", cotando: "Cotando", aprovado: "Aprovado",
  entregue: "Entregue", cancelado: "Cancelado",
};
const STATUS_COLOR: Record<string, string> = {
  rascunho: "#8b949e", cotando: "#60a5fa", aprovado: "#f59e0b",
  entregue: "#3fb950", cancelado: "#ef4444",
};

const FILTROS = [
  { id: "", label: "Todos" },
  { id: "rascunho", label: "Rascunho" },
  { id: "cotando", label: "Cotando" },
  { id: "aprovado", label: "Aprovado" },
  { id: "entregue", label: "Entregue" },
];

const EMPTY_FORM = { descricao: "", status: "rascunho", obra_id: "", valor_estimado: "" };

function PedidosPageInner() {
  const searchParams = useSearchParams();
  const obraIdParam = searchParams.get("obra_id") || "";

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, obra_id: obraIdParam });
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [obraSearch, setObraSearch] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const params = new URLSearchParams();
      if (obraIdParam) params.set("obra_id", obraIdParam);
      if (filtroStatus) params.set("status", filtroStatus);
      const q = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/crm/pedidos${q}`, { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Pedido[]; error?: string };
      if (!res.ok) { setErro(json.error || "Erro ao carregar."); return; }
      setPedidos(json.data ?? []);
    } catch { setErro("Erro de rede."); }
    finally { setLoading(false); }
  }, [obraIdParam, filtroStatus]);

  const carregarObras = useCallback(async () => {
    try {
      const res = await fetch("/api/crm/obras?limit=50", { headers: internalApiHeaders() });
      const json = (await res.json()) as { data?: Obra[] };
      setObras(json.data ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => { void carregarObras(); }, [carregarObras]);

  const obrasFiltradas = obras.filter((o) =>
    !obraSearch || o.titulo.toLowerCase().includes(obraSearch.toLowerCase())
  );

  const obraSelecionada = obras.find((o) => o.id === form.obra_id);

  async function mudarStatus(id: string, status: string) {
    await fetch(`/api/crm/pedidos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ status }),
    });
    setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, status } : p));
  }

  async function criar() {
    if (!form.descricao.trim()) { setErroSalvar("Descrição obrigatória."); return; }
    setSalvando(true);
    setErroSalvar("");
    const valor = form.valor_estimado ? parseFloat(form.valor_estimado) : null;
    const res = await fetch("/api/crm/pedidos", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({
        descricao: form.descricao.trim(),
        status: form.status,
        obra_id: form.obra_id || null,
        valor_estimado: isNaN(valor as number) ? null : valor,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: Pedido; error?: string };
    if (!res.ok) { setErroSalvar(json.error || "Erro ao criar."); setSalvando(false); return; }
    if (json.data) setPedidos((prev) => [json.data!, ...prev]);
    setModal(false);
    setForm({ ...EMPTY_FORM, obra_id: obraIdParam });
    setSalvando(false);
  }

  const total = pedidos.reduce((acc, p) => acc + (p.valor_estimado ?? 0), 0);

  return (
    <div className="min-h-full bg-[#0d1117]" style={{ color: "#e6edf3" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-[#30363d] bg-[#0d1117]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold">Reforma & Pedidos</h1>
            <p className="text-xs text-[#8b949e]">Pedidos de material por obra</p>
          </div>
          <button
            type="button"
            onClick={() => { setModal(true); setErroSalvar(""); setObraSearch(""); }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#c9a24a] px-4 text-xs font-bold text-[#003b26] hover:bg-[#b8912f] transition-colors"
          >
            <Plus size={14} />
            Novo pedido
          </button>
        </div>

        {/* Filtros de status */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroStatus(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filtroStatus === f.id
                  ? "bg-[#c9a24a] text-[#003b26]"
                  : "bg-[#21262d] text-[#8b949e] hover:text-[#e6edf3]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sumário */}
      {total > 0 && (
        <div className="mx-6 mt-4 rounded-xl border border-[#30363d] bg-[#161b22] px-4 py-3">
          <p className="text-xs text-[#8b949e]">Total estimado ({pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""})</p>
          <p className="text-lg font-bold text-[#c9a24a]">
            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
      )}

      <div className="p-6" style={{ maxWidth: 800 }}>
        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-[#161b22]" />)}
          </div>
        ) : erro ? (
          <div className="rounded-xl border border-[#f87171]/30 bg-[#f87171]/10 p-4 text-sm text-[#f87171]">
            {erro} <button type="button" onClick={() => void carregar()} className="underline">tentar novamente</button>
          </div>
        ) : pedidos.length === 0 ? (
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-10 text-center">
            <Package size={32} className="mx-auto mb-3 text-[#30363d]" />
            <p className="text-sm text-[#8b949e]">
              {filtroStatus ? "Nenhum pedido neste status." : "Nenhum pedido cadastrado."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pedidos.map((p) => (
              <li key={p.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#e6edf3] truncate">{p.descricao}</p>
                    <p className="mt-0.5 font-mono text-xs text-[#8b949e]">{p.codigo}</p>
                    {p.valor_estimado != null && (
                      <p className="mt-1 text-xs text-[#c9a24a] font-semibold">
                        {p.valor_estimado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </p>
                    )}
                    {p.obra_id && (
                      <Link href={`/crm/obras/${p.obra_id}`} className="mt-1 inline-block text-xs text-[#60a5fa] hover:underline">
                        Ver obra
                      </Link>
                    )}
                  </div>
                  <select
                    value={p.status}
                    onChange={(e) => void mudarStatus(p.id, e.target.value)}
                    className="shrink-0 rounded-lg border px-2 py-1 text-xs outline-none"
                    style={{
                      borderColor: STATUS_COLOR[p.status] ?? "#30363d",
                      background: `${STATUS_COLOR[p.status] ?? "#30363d"}20`,
                      color: STATUS_COLOR[p.status] ?? "#8b949e",
                    }}
                  >
                    {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal novo pedido */}
      {modal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold">Novo pedido</h2>
              <button type="button" onClick={() => setModal(false)} className="text-[#8b949e] hover:text-[#e6edf3]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Descrição *</label>
                <textarea
                  value={form.descricao}
                  onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))}
                  placeholder="Ex: 50 sacos de cimento, 10 sacos de areia…"
                  rows={3}
                  className="w-full rounded-lg border border-[#30363d] bg-[#21262d] px-3 py-2 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] focus:border-[#c9a24a] outline-none"
                  >
                    {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#8b949e]">Valor estimado (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_estimado}
                    onChange={(e) => setForm((p) => ({ ...p, valor_estimado: e.target.value }))}
                    placeholder="0,00"
                    className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                  />
                </div>
              </div>

              {/* Seletor de obra */}
              <div>
                <label className="mb-1 block text-xs text-[#8b949e]">Obra vinculada</label>
                {obraSelecionada ? (
                  <div className="flex items-center gap-2 rounded-lg border border-[#c9a24a]/50 bg-[#21262d] px-3 py-2">
                    <span className="flex-1 text-sm text-[#e6edf3] truncate">{obraSelecionada.titulo}</span>
                    <button type="button" onClick={() => setForm((p) => ({ ...p, obra_id: "" }))} className="text-[#8b949e] hover:text-[#e6edf3]">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={obraSearch}
                      onChange={(e) => setObraSearch(e.target.value)}
                      placeholder="Buscar obra…"
                      className="w-full min-h-10 rounded-lg border border-[#30363d] bg-[#21262d] px-3 text-sm text-[#e6edf3] placeholder-[#4d5562] focus:border-[#c9a24a] outline-none"
                    />
                    {obraSearch && obrasFiltradas.length > 0 && (
                      <ul className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-[#30363d] bg-[#21262d]">
                        {obrasFiltradas.slice(0, 6).map((o) => (
                          <li key={o.id}>
                            <button
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, obra_id: o.id })); setObraSearch(""); }}
                              className="w-full px-3 py-2 text-left text-xs text-[#e6edf3] hover:bg-[#30363d]"
                            >
                              {o.titulo}
                              {o.codigo && <span className="ml-1 text-[#8b949e]">· {o.codigo}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </div>

            {erroSalvar && <p className="mt-3 text-xs text-[#f87171]">{erroSalvar}</p>}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setModal(false)} className="flex-1 min-h-10 rounded-lg bg-[#21262d] text-xs text-[#8b949e]">
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void criar()}
                className="flex-1 min-h-10 rounded-lg bg-[#c9a24a] text-xs font-bold text-[#003b26] disabled:opacity-60"
              >
                {salvando ? "Criando…" : "Criar pedido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PedidosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#8b949e]">Carregando pedidos…</div>}>
      <PedidosPageInner />
    </Suspense>
  );
}
